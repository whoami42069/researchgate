import { NextRequest, NextResponse } from "next/server";
import { deepseek, MODELS, estimateTokenCount, MAX_TOKENS } from "@/lib/deepseek";
import { searchAllSources, type UnifiedArticle, type SourceType } from "@/lib/sources";
import {
    buildQuickFilterPrompt,
    buildGPTScoringPrompt,
    selectCalibrationAnchors,
    validateFilterOutput,
    validateGPTScoringOutput,
    type ArticleCandidate
} from "@/lib/prompts";
import { getFieldConfig, getSourceWeight, type ResearchField } from "@/lib/field-config";
import { tokenizeForRelevancy, jaccardSimilarity } from "@/lib/text-utils";
import OpenAI from "openai";

// Initialize OpenAI client for GPT-4o-mini scoring
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Maximum number of articles to process (increased for better coverage)
const MAX_ARTICLES = 150;

// Maximum articles to send to GPT for scoring (after filter)
const MAX_SCORING_BATCH = 100;

// ============================================================================
// STEP 2: Heuristic Pre-Filter — removes obvious noise before LLM filter
// ============================================================================

interface PreFilterStats {
    before: number;
    after: number;
    rejected: number;
    reasons: Record<string, number>;
}

function heuristicPreFilter(
    articles: UnifiedArticle[],
    scopeSummary: string,
    fieldCluster: string
): { filtered: UnifiedArticle[]; stats: PreFilterStats } {
    const currentYear = new Date().getFullYear();
    const maxAge = fieldCluster === "stem" ? 15 : 20;
    const scopeTokens = tokenizeForRelevancy(scopeSummary);

    const reasons: Record<string, number> = {
        shortTitle: 0,
        noContent: 0,
        tooOld: 0,
        lowOverlap: 0,
        compoundWeak: 0,
    };

    const filtered = articles.filter(article => {
        // Rule 1: Short title (likely malformed)
        if ((article.title || "").length < 20) {
            reasons.shortTitle++;
            return false;
        }

        const abstractText = article.abstract || article.summary || "";

        // Rule 2: No content — no abstract AND no summary > 30 chars
        if (abstractText.length < 30) {
            reasons.noContent++;
            return false;
        }

        // Rule 3: Too old
        const year = article.year || 0;
        if (year > 0 && currentYear - year > maxAge) {
            reasons.tooOld++;
            return false;
        }

        // Rule 4: Low keyword overlap — check both title and abstract against scope
        const titleTokens = tokenizeForRelevancy(article.title || "");
        const abstractTokens = tokenizeForRelevancy(abstractText);
        const titleOverlap = jaccardSimilarity(titleTokens, scopeTokens);
        const abstractOverlap = jaccardSimilarity(abstractTokens, scopeTokens);

        if (titleOverlap < 0.05 && abstractOverlap < 0.05) {
            reasons.lowOverlap++;
            return false;
        }

        // Rule 5: Zero-cite + old (>3yr) + low overlap — compound signal
        const citations = (article as any).citationCount ?? -1;
        if (
            citations === 0 &&
            year > 0 && currentYear - year > 3 &&
            titleOverlap < 0.08 && abstractOverlap < 0.08
        ) {
            reasons.compoundWeak++;
            return false;
        }

        return true;
    });

    const stats: PreFilterStats = {
        before: articles.length,
        after: filtered.length,
        rejected: articles.length - filtered.length,
        reasons,
    };

    console.log(
        `[Search] Heuristic pre-filter: ${stats.before} → ${stats.after} (rejected ${stats.rejected}: ${JSON.stringify(reasons)})`
    );

    return { filtered, stats };
}

export async function POST(req: NextRequest) {
    try {
        const { queries, scopeSummary, buzzwords, researchField } = await req.json();

        if (!queries || !Array.isArray(queries) || queries.length === 0) {
            return NextResponse.json({ error: "No queries provided" }, { status: 400 });
        }

        // Get field-specific configuration
        const fieldConfig = getFieldConfig(researchField);
        console.log(`[Search] Using field config: ${fieldConfig.displayName} (${fieldConfig.cluster} cluster)`);
        console.log(`[Search] Sources: ${fieldConfig.sources.join(', ')}`);
        console.log(`[Search] Queries: ${queries.length} total`);

        // 1. Search sources based on field configuration
        // Use all 8 queries for maximum coverage
        const searchPromises = queries.slice(0, 8).map((query, idx) => {
            // Primary queries get more results, decreasing for later queries
            const resultsPerQuery = [30, 25, 22, 20, 18, 16, 14, 12];
            const maxResults = resultsPerQuery[idx] || 12;
            return searchAllSources(query, {
                maxResultsPerSource: maxResults,
                includePsychologyFilter: fieldConfig.psychologyFilter,
                sources: fieldConfig.sources as SourceType[],
                sourceMaxResults: fieldConfig.maxResultsPerSource as Partial<Record<SourceType, number>>,
                sourceWeights: fieldConfig.sourceWeights as Partial<Record<SourceType, number>>,
                boostKeywords: fieldConfig.boostKeywords,
            });
        });

        const searchResults = await Promise.all(searchPromises);
        const allCandidates = searchResults.flat();

        // Deduplicate by DOI/title and enforce MAX_ARTICLES limit
        const seen = new Set<string>();
        const uniqueCandidates = allCandidates
            .filter(c => {
                const key = c.doi || c.title.toLowerCase().slice(0, 50);
                const duplicate = seen.has(key);
                seen.add(key);
                return !duplicate;
            })
            .slice(0, MAX_ARTICLES);

        console.log(`[Search] Found ${allCandidates.length} total, ${uniqueCandidates.length} unique candidates`);

        if (uniqueCandidates.length === 0) {
            return NextResponse.json({
                success: true,
                articles: [],
                filter: { enabled: false },
                scoring: { enabled: false },
            });
        }

        // STEP 2: Heuristic pre-filter before LLM
        const { filtered: preFilteredCandidates, stats: preFilterStats } = heuristicPreFilter(
            uniqueCandidates,
            scopeSummary,
            fieldConfig.cluster
        );

        if (preFilteredCandidates.length === 0) {
            return NextResponse.json({
                success: true,
                articles: [],
                preFilter: preFilterStats,
                filter: { enabled: false },
                scoring: { enabled: false },
            });
        }

        // 2. PHASE 1: DeepSeek Quick Filter (short, cacheable prompt)
        console.log("[Search] Phase 1: DeepSeek quick filter...");

        const candidates: ArticleCandidate[] = preFilteredCandidates.map((c, i) => ({
            id: i.toString(),
            title: c.title,
            summary: c.abstract || c.summary,
        }));

        const { systemPrompt: filterSystemPrompt, userPrompt: filterUserPrompt } =
            buildQuickFilterPrompt(scopeSummary, candidates);

        // DeepSeek filter call - intelligent pre-filtering
        const filterStartTime = Date.now();
        const filterCompletion = await deepseek.chat.completions.create({
            model: MODELS.CHAT,
            messages: [
                { role: "system", content: filterSystemPrompt },
                { role: "user", content: filterUserPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1, // Very low temp for consistent filtering
            max_tokens: 3600, // Enough for 150 articles (1.2x increase)
        });

        const filterDuration = Date.now() - filterStartTime;
        console.log(`[Search] Filter completed in ${filterDuration}ms`);

        // Parse filter response
        let filterRaw: Record<string, string> = {};
        try {
            filterRaw = JSON.parse(filterCompletion.choices[0].message.content || "{}");
        } catch {
            console.error("[Search] Filter JSON parse error, keeping all articles");
        }

        const filterResult = validateFilterOutput(filterRaw, preFilteredCandidates.length);
        console.log(`[Search] Filter: ${filterResult.kept.length} KEEP, ${filterResult.skipped.length} SKIP`);

        // Get filtered candidates (only KEEP)
        const keptCandidates = filterResult.kept.map(idx => ({
            originalIndex: idx,
            article: preFilteredCandidates[idx],
            candidate: candidates[idx],
        }));

        // Limit to MAX_SCORING_BATCH for GPT scoring
        const candidatesForScoring = keptCandidates.slice(0, MAX_SCORING_BATCH);

        if (candidatesForScoring.length === 0) {
            console.log("[Search] No articles passed filter");
            return NextResponse.json({
                success: true,
                articles: [],
                preFilter: preFilterStats,
                filter: {
                    enabled: true,
                    totalCandidates: preFilteredCandidates.length,
                    kept: 0,
                    skipped: filterResult.skipped.length,
                },
                scoring: { enabled: false },
            });
        }

        // STEP 4: Select calibration anchors from actual candidates
        const scoringCandidates: ArticleCandidate[] = candidatesForScoring.map((c, i) => ({
            id: i.toString(),
            title: c.candidate.title,
            summary: c.candidate.summary,
        }));

        const anchorArticles = selectCalibrationAnchors(scopeSummary, scoringCandidates);
        if (anchorArticles) {
            console.log(
                `[Search] Calibration anchors selected: HIGH="${anchorArticles.high.title.slice(0, 50)}..." MED="${anchorArticles.medium.title.slice(0, 50)}..." LOW="${anchorArticles.low.title.slice(0, 50)}..."`
            );
        }

        // 3. PHASE 2: GPT-4o-mini Detailed Scoring
        console.log(`[Search] Phase 2: GPT-4o-mini scoring ${candidatesForScoring.length} articles...`);

        const { systemPrompt: scoringSystemPrompt, userPrompt: scoringUserPrompt } =
            buildGPTScoringPrompt(scopeSummary, buzzwords || null, scoringCandidates, anchorArticles);

        // GPT-4o-mini scoring call - detailed evaluation
        const scoringStartTime = Date.now();
        const scoringCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: scoringSystemPrompt },
                { role: "user", content: scoringUserPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
            max_tokens: 12000, // More tokens for 100 articles with detailed reasoning
        });

        const scoringDuration = Date.now() - scoringStartTime;
        console.log(`[Search] Scoring completed in ${scoringDuration}ms`);

        // Parse scoring response
        let scoringRaw: Record<string, unknown> = {};
        try {
            scoringRaw = JSON.parse(scoringCompletion.choices[0].message.content || "{}");
        } catch (parseError) {
            console.error("[Search] Scoring JSON parse error, attempting repair...");
            const content = scoringCompletion.choices[0].message.content || "{}";
            const lastBrace = content.lastIndexOf("}");
            if (lastBrace > 0) {
                try {
                    const truncated = content.substring(0, lastBrace + 1);
                    const repaired = truncated.replace(/,\s*$/, "") + "}";
                    scoringRaw = JSON.parse(repaired);
                } catch {
                    console.error("[Search] JSON repair failed");
                }
            }
        }

        const scoringResult = validateGPTScoringOutput(scoringRaw, candidatesForScoring.length);
        const scores = scoringResult.valid ? scoringResult.data! : {};

        // STEP 5: Compute adaptive source weights from GPT results
        const allRawScores: number[] = [];
        const perSourceScores: Record<string, number[]> = {};

        candidatesForScoring.forEach((item, scoringIdx) => {
            const scoreData = scores[scoringIdx.toString()] || { score: 30, reason: "No score" };
            const raw = scoreData.score;
            allRawScores.push(raw);
            const src = item.article.source || "unknown";
            if (!perSourceScores[src]) perSourceScores[src] = [];
            perSourceScores[src].push(raw);
        });

        const globalAvgScore = allRawScores.length > 0
            ? allRawScores.reduce((a, b) => a + b, 0) / allRawScores.length
            : 50;

        const adaptiveWeights: Record<string, { avg: number; adjustment: number }> = {};
        for (const [src, srcScores] of Object.entries(perSourceScores)) {
            const srcAvg = srcScores.reduce((a, b) => a + b, 0) / srcScores.length;
            const adjustment = Math.min(5, Math.max(-5, Math.round((srcAvg - globalAvgScore) / 10)));
            adaptiveWeights[src] = { avg: Math.round(srcAvg * 10) / 10, adjustment };
        }

        console.log(
            `[Search] Adaptive weights — Global avg: ${Math.round(globalAvgScore * 10) / 10}, Adjustments: ${JSON.stringify(
                Object.fromEntries(Object.entries(adaptiveWeights).map(([k, v]) => [k, v.adjustment]))
            )}`
        );

        // 4. Merge scores into articles with CAPPED source bonus + adaptive adjustment
        const scoredArticles = candidatesForScoring
            .map((item, scoringIdx) => {
                const scoreData = scores[scoringIdx.toString()] || { score: 30, reason: "No score" };
                const rawScore = scoreData.score;

                // Get source weight from field config
                const sourceWeight = getSourceWeight(researchField, item.article.source as any) || 1.0;

                // Base bonus from static config
                const baseSourceBonus = Math.min(10, Math.max(-10, Math.round((sourceWeight - 1.0) * 10)));

                // Performance adjustment from adaptive weights
                const src = item.article.source || "unknown";
                const performanceAdjustment = adaptiveWeights[src]?.adjustment ?? 0;

                // Combined source bonus
                const sourceBonus = Math.min(10, Math.max(-10, baseSourceBonus + performanceAdjustment));
                const finalScore = Math.max(0, Math.min(100, rawScore + sourceBonus));

                return {
                    ...item.article,
                    relevancyScore: finalScore,
                    relevancyReason: scoreData.reason,
                    scoring: {
                        rawScore,
                        baseSourceBonus,
                        performanceAdjustment,
                        sourceBonus,
                        finalScore,
                        model: "gpt-4o-mini",
                    },
                };
            })
            .sort((a, b) => b.relevancyScore - a.relevancyScore);

        // Calculate source breakdown
        const sourceBreakdown = scoredArticles.reduce((acc, article) => {
            const source = article.source || 'unknown';
            acc[source] = (acc[source] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Token usage estimates
        const filterInputTokens = estimateTokenCount(filterSystemPrompt + filterUserPrompt);
        const filterOutputTokens = estimateTokenCount(filterCompletion.choices[0].message.content || "");
        const scoringInputTokens = estimateTokenCount(scoringSystemPrompt + scoringUserPrompt);
        const scoringOutputTokens = estimateTokenCount(scoringCompletion.choices[0].message.content || "");

        // Score distribution for analytics
        const scoreDistribution = {
            excellent: scoredArticles.filter(a => a.relevancyScore >= 85).length,
            strong: scoredArticles.filter(a => a.relevancyScore >= 70 && a.relevancyScore < 85).length,
            moderate: scoredArticles.filter(a => a.relevancyScore >= 50 && a.relevancyScore < 70).length,
            weak: scoredArticles.filter(a => a.relevancyScore >= 25 && a.relevancyScore < 50).length,
            poor: scoredArticles.filter(a => a.relevancyScore < 25).length,
        };

        console.log(`[Search] Score distribution: ${JSON.stringify(scoreDistribution)}`);

        return NextResponse.json({
            success: true,
            articles: scoredArticles,
            tokenEstimate: {
                filter: {
                    input: filterInputTokens,
                    output: filterOutputTokens,
                    model: "deepseek-chat",
                    cacheable: true,
                },
                scoring: {
                    input: scoringInputTokens,
                    output: scoringOutputTokens,
                    model: "gpt-4o-mini",
                },
                total: filterInputTokens + filterOutputTokens + scoringInputTokens + scoringOutputTokens,
            },
            metadata: {
                totalCandidates: uniqueCandidates.length,
                returnedArticles: scoredArticles.length,
                maxArticlesLimit: MAX_ARTICLES,
                sources: sourceBreakdown,
                queriesUsed: queries.slice(0, 8).length,
                adaptiveWeights,
            },
            preFilter: preFilterStats,
            filter: {
                enabled: true,
                totalCandidates: preFilteredCandidates.length,
                kept: filterResult.kept.length,
                skipped: filterResult.skipped.length,
                durationMs: filterDuration,
            },
            scoring: {
                enabled: true,
                articlesScored: candidatesForScoring.length,
                model: "gpt-4o-mini",
                durationMs: scoringDuration,
                distribution: scoreDistribution,
            },
        });

    } catch (error) {
        console.error("Search failed:", error);
        return NextResponse.json(
            { error: "Failed to search and score" },
            { status: 500 }
        );
    }
}
