import { NextRequest, NextResponse } from "next/server";
import { extractAndSummarizeText } from "@/lib/pdf-loader";
import { deepseek, MODELS, truncateToTokenLimit, estimateTokenCount, MAX_TOKENS } from "@/lib/deepseek";
import { buildAnalysisPrompt, buildQueryGenerationPrompt, validateAnalysisOutput, type AnalysisWeights, type PdfDocument, type DoiDocument } from "@/lib/prompts";
import { getFieldConfig } from "@/lib/field-config";
import { tokenize, jaccardSimilarity } from "@/lib/text-utils";
import OpenAI from "openai";

// Initialize OpenAI client for GPT-4o-mini
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Helper to fetch DOI metadata from CrossRef
async function fetchDOIMetadata(doi: string): Promise<{ doi: string; title: string; abstract: string; authors: string[] } | null> {
    try {
        const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            headers: {
                "User-Agent": "ResearchDiscoveryApp/1.0 (Academic Research Tool)",
                "Accept": "application/json",
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const data = await response.json();
        const work = data.message;

        const title = Array.isArray(work.title) && work.title.length > 0 ? work.title[0] : "";
        const abstract = work.abstract || "";
        const authors: string[] = [];
        if (Array.isArray(work.author)) {
            work.author.forEach((author: any) => {
                const name = [author.given, author.family].filter(Boolean).join(" ");
                if (name) authors.push(name);
            });
        }

        return { doi, title, abstract, authors };
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const files = formData.getAll("files") as File[];
        const buzzwords = formData.get("buzzwords") as string;
        const researchContext = formData.get("researchContext") as string;
        const doiArticlesRaw = formData.get("doiArticles") as string;
        const rawDoisString = formData.get("rawDois") as string; // Raw DOI strings to fetch
        const researchField = formData.get("researchField") as string; // Research field for query optimization
        const conceptAnchor = formData.get("conceptAnchor") as string; // Core concept that must appear in all queries
        const anchorVariationsRaw = formData.get("anchorVariations") as string; // User-selected variations

        // Parse anchor variations if provided
        let userSelectedVariations: string[] = [];
        if (anchorVariationsRaw) {
            try {
                userSelectedVariations = JSON.parse(anchorVariationsRaw);
            } catch {
                console.warn("Failed to parse anchorVariations JSON");
            }
        }

        // Parse pre-fetched DOI articles if provided
        let doiArticles: Array<{ doi: string; title: string; abstract: string; authors: string[] }> = [];
        if (doiArticlesRaw) {
            try {
                doiArticles = JSON.parse(doiArticlesRaw);
            } catch {
                console.warn("Failed to parse doiArticles JSON");
            }
        }

        // Parse and fetch raw DOIs if provided (auto-fetch feature)
        if (rawDoisString) {
            try {
                const rawDois: string[] = JSON.parse(rawDoisString);
                if (rawDois.length > 0) {
                    console.log(`[Analyze] Auto-fetching ${rawDois.length} DOIs...`);
                    const fetchedArticles = await Promise.all(
                        rawDois.map(doi => fetchDOIMetadata(doi.trim()))
                    );
                    // Add successfully fetched articles
                    const validFetched = fetchedArticles.filter((a): a is NonNullable<typeof a> => a !== null);
                    doiArticles = [...doiArticles, ...validFetched];
                    console.log(`[Analyze] Successfully fetched ${validFetched.length}/${rawDois.length} DOIs`);
                }
            } catch {
                console.warn("Failed to parse rawDois JSON");
            }
        }

        // Must have either researchContext, files, or DOI articles
        if (!researchContext && !files.length && !doiArticles.length) {
            return NextResponse.json(
                { error: "Must provide at least one of: research context, PDF files, or DOI articles" },
                { status: 400 }
            );
        }

        // 1. Extract and Summarize Text from PDFs (PARALLEL PROCESSING)
        const pdfDocuments = await Promise.all(
            files.map(async (file) => {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    // Use optimized summarization with timeout
                    const summarizedText = await extractAndSummarizeText(buffer, 10000);
                    return {
                        name: file.name,
                        content: summarizedText,
                        error: null,
                    };
                } catch (error) {
                    console.error(`Failed to process PDF ${file.name}:`, error);
                    return {
                        name: file.name,
                        content: "",
                        error: error instanceof Error ? error.message : "Unknown error",
                    };
                }
            })
        );

        // Filter out failed PDFs
        const validPdfDocuments = pdfDocuments.filter((doc) => !doc.error && doc.content);
        const failedPdfs = pdfDocuments.filter((doc) => doc.error);

        // 2. Format DOI articles as documents (already condensed)
        const doiDocuments = doiArticles.map((article) => ({
            name: `DOI: ${article.doi}`,
            content: `Title: ${article.title}\n\nAbstract: ${article.abstract || "No abstract available"}\n\nAuthors: ${article.authors?.join(", ") || "Unknown"}`,
        }));

        // 3. Calculate hierarchical weights based on available inputs
        const hasContext = !!researchContext && researchContext.trim().length > 0;
        const hasPdfs = validPdfDocuments.length > 0;
        const hasDois = doiDocuments.length > 0;

        let weights = { context: 0, pdfs: 0, dois: 0 };

        if (hasContext && hasPdfs && hasDois) {
            weights = { context: 50, pdfs: 35, dois: 15 };
        } else if (hasContext && hasPdfs) {
            weights = { context: 60, pdfs: 40, dois: 0 };
        } else if (hasContext && hasDois) {
            weights = { context: 70, pdfs: 0, dois: 30 };
        } else if (hasPdfs && hasDois) {
            weights = { context: 0, pdfs: 65, dois: 35 };
        } else if (hasContext) {
            weights = { context: 100, pdfs: 0, dois: 0 };
        } else if (hasPdfs) {
            weights = { context: 0, pdfs: 100, dois: 0 };
        } else if (hasDois) {
            weights = { context: 0, pdfs: 0, dois: 100 };
        }

        // 4. Prepare optimized prompt using research-grade prompts library
        const pdfDocs: PdfDocument[] = validPdfDocuments.map(d => ({ name: d.name, content: d.content }));
        const doiDocs: DoiDocument[] = doiDocuments;

        const { systemPrompt, userPrompt: userContent } = buildAnalysisPrompt(
            researchContext,
            pdfDocs,
            doiDocs,
            weights as AnalysisWeights,
            buzzwords || undefined
        );

        // 5. TOKEN ESTIMATION BEFORE CALL - Smart truncation if needed
        const systemTokens = estimateTokenCount(systemPrompt);
        let userTokens = estimateTokenCount(userContent);
        const reservedTokens = 2000; // Reserve for response (increased for richer output)
        let totalInputTokens = systemTokens + userTokens;
        let finalUserContent = userContent;

        // If over limit, truncate intelligently (DOIs first, then PDFs, NEVER context)
        if (totalInputTokens > MAX_TOKENS - reservedTokens) {
            console.warn(`Token limit exceeded (${totalInputTokens}). Applying intelligent truncation...`);

            const maxUserTokens = MAX_TOKENS - systemTokens - reservedTokens;

            // Rebuild content with truncation (reverse priority order)
            let rebuiltContent = "HIERARCHICAL INPUT ANALYSIS\n===========================\n\n";

            if (hasContext) {
                rebuiltContent += `[WEIGHT: ${weights.context}%] PRIMARY RESEARCH CONTEXT\n`;
                rebuiltContent += "------------------------------------------------------\n";
                rebuiltContent += `${researchContext}\n\n`;
            }

            const remainingTokens = maxUserTokens - estimateTokenCount(rebuiltContent);

            // Allocate remaining tokens based on weights
            if (hasPdfs && hasDois) {
                const pdfTokenBudget = Math.floor(remainingTokens * (weights.pdfs / (weights.pdfs + weights.dois)));
                const doiTokenBudget = remainingTokens - pdfTokenBudget;

                const pdfSection = pdfDocs.map((d, i) => `--- Document ${i + 1}: ${d.name} ---\n${d.content}\n`).join("\n");
                const doiSection = doiDocs.map((d, i) => `--- Reference ${i + 1}: ${d.name} ---\n${d.content}\n`).join("\n");

                rebuiltContent += `[WEIGHT: ${weights.pdfs}%] EXAMPLE RESEARCH PAPERS (PDFs)\n`;
                rebuiltContent += "-------------------------------------------------------\n";
                rebuiltContent += `${truncateToTokenLimit(pdfSection, pdfTokenBudget)}\n\n`;
                rebuiltContent += `[WEIGHT: ${weights.dois}%] REFERENCE ARTICLES (DOI Metadata)\n`;
                rebuiltContent += "----------------------------------------------------------\n";
                rebuiltContent += truncateToTokenLimit(doiSection, doiTokenBudget);
            } else if (hasPdfs) {
                const pdfSection = pdfDocs.map((d, i) => `--- Document ${i + 1}: ${d.name} ---\n${d.content}\n`).join("\n");
                rebuiltContent += `[WEIGHT: ${weights.pdfs}%] EXAMPLE RESEARCH PAPERS (PDFs)\n`;
                rebuiltContent += "-------------------------------------------------------\n";
                rebuiltContent += truncateToTokenLimit(pdfSection, remainingTokens);
            } else if (hasDois) {
                const doiSection = doiDocs.map((d, i) => `--- Reference ${i + 1}: ${d.name} ---\n${d.content}\n`).join("\n");
                rebuiltContent += `[WEIGHT: ${weights.dois}%] REFERENCE ARTICLES (DOI Metadata)\n`;
                rebuiltContent += "----------------------------------------------------------\n";
                rebuiltContent += truncateToTokenLimit(doiSection, remainingTokens);
            }

            if (buzzwords) {
                rebuiltContent += `\n\nMANDATORY KEYWORD FILTERS: ${buzzwords}\n`;
                rebuiltContent += "(All search queries MUST include at least one of these terms)\n";
            }

            rebuiltContent += "\nGenerate the analysis JSON now.";
            finalUserContent = rebuiltContent;
        }

        // 6. Final token calculation
        const finalUserTokens = estimateTokenCount(finalUserContent);
        const finalTotalInputTokens = systemTokens + finalUserTokens;

        // 7. PARALLEL QUERY GENERATION - Both GPT-4o-mini and DeepSeek generate queries
        console.log("[Analyze] Phase 1: Parallel query generation (GPT-4o-mini + DeepSeek)...");

        // Get field-specific configuration for boost keywords
        const fieldConfig = getFieldConfig(researchField);
        const boostKeywords = fieldConfig.boostKeywords || [];
        console.log(`[Analyze] Field: ${fieldConfig.displayName}, Boost keywords: ${boostKeywords.length}`);

        // Build enhanced prompt for GPT-4o-mini with field context, few-shot examples, and concept anchor
        const { systemPrompt: gptSystemPrompt, userPrompt: gptUserPrompt, suggestedVariations } = buildQueryGenerationPrompt(
            researchContext?.slice(0, 2000) || "General academic research",
            researchField || null,
            boostKeywords,
            conceptAnchor || null,
            userSelectedVariations
        );

        if (conceptAnchor) {
            console.log(`[Analyze] Concept Anchor: "${conceptAnchor}" with ${userSelectedVariations.length} selected variations`);
        }

        // Run both LLMs in parallel
        const [deepseekResult, gptResult] = await Promise.allSettled([
            // DeepSeek - uses full analysis prompt (comprehensive)
            deepseek.chat.completions.create({
                model: MODELS.CHAT,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: finalUserContent },
                ],
                response_format: { type: "json_object" },
                temperature: 0.2,
                max_tokens: 2000,
            }),
            // GPT-4o-mini - creative, diverse queries with field-specific guidance
            openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: gptSystemPrompt },
                    { role: "user", content: gptUserPrompt },
                ],
                response_format: { type: "json_object" },
                temperature: 0.4, // Balanced temp for diversity with precision
                max_tokens: 800, // More tokens for 4 detailed queries
            }),
        ]);

        // Parse DeepSeek result (primary - has full analysis)
        let rawResult: Record<string, unknown> = {};
        if (deepseekResult.status === "fulfilled") {
            try {
                rawResult = JSON.parse(deepseekResult.value.choices[0].message.content || "{}");
            } catch {
                console.error("[Analyze] DeepSeek JSON parse error");
            }
        } else {
            console.error("[Analyze] DeepSeek call failed:", deepseekResult.reason);
        }

        // Parse GPT result (additional queries)
        let gptQueries: string[] = [];
        if (gptResult.status === "fulfilled") {
            try {
                const gptData = JSON.parse(gptResult.value.choices[0].message.content || "{}");
                gptQueries = Array.isArray(gptData.searchQueries) ? gptData.searchQueries : [];
                console.log(`[Analyze] GPT-4o-mini generated ${gptQueries.length} additional queries`);
            } catch {
                console.error("[Analyze] GPT JSON parse error");
            }
        } else {
            console.error("[Analyze] GPT call failed:", gptResult.reason);
        }

        // 8. Merge and dedupe queries from both LLMs
        const deepseekQueries = Array.isArray(rawResult.searchQueries) ? rawResult.searchQueries as string[] : [];

        // Combine: DeepSeek queries first (higher priority), then GPT queries
        const allQueries = [...deepseekQueries, ...gptQueries];

        // Stage A: Exact-match dedup (lowercase, trimmed)
        const seenExact = new Set<string>();
        const exactDeduped = allQueries.filter(q => {
            if (!q || typeof q !== "string") return false;
            const normalized = q.toLowerCase().trim();
            if (seenExact.has(normalized)) return false;
            seenExact.add(normalized);
            return true;
        });

        // Stage B: Jaccard similarity dedup (threshold 0.5)
        const acceptedTokenSets: Set<string>[] = [];
        const uniqueQueries: string[] = [];
        for (const q of exactDeduped) {
            const tokens = tokenize(q);
            let tooSimilar = false;
            for (const existing of acceptedTokenSets) {
                if (jaccardSimilarity(tokens, existing) > 0.5) {
                    console.log(`[Analyze] Dropped semantically similar query: "${q}"`);
                    tooSimilar = true;
                    break;
                }
            }
            if (!tooSimilar) {
                uniqueQueries.push(q);
                acceptedTokenSets.push(tokens);
            }
            if (uniqueQueries.length >= 8) break;
        }

        // Stage C: Dimension coverage check (informational)
        const DIMENSION_MARKERS: Record<string, string[]> = {
            CORE_TOPIC: ["therapy", "treatment", "intervention", "disorder", "disease", "syndrome", "symptom"],
            MECHANISM: ["mechanism", "pathway", "mediator", "moderator", "theory", "model", "neural", "cognitive", "process"],
            CONTEXT: ["clinical", "community", "school", "workplace", "primary care", "population", "setting", "adults", "children", "adolescents"],
            METHODOLOGY: ["randomized", "meta-analysis", "systematic review", "longitudinal", "cross-sectional", "qualitative", "trial", "cohort", "survey"],
        };
        const coveredDimensions = new Set<string>();
        for (const q of uniqueQueries) {
            const lower = q.toLowerCase();
            for (const [dim, markers] of Object.entries(DIMENSION_MARKERS)) {
                if (markers.some(m => lower.includes(m))) {
                    coveredDimensions.add(dim);
                }
            }
        }
        console.log(`[Analyze] Dimension coverage: ${coveredDimensions.size}/4 (${Array.from(coveredDimensions).join(", ")})`);

        console.log(`[Analyze] Merged queries: ${uniqueQueries.length} unique (DeepSeek: ${deepseekQueries.length}, GPT: ${gptQueries.length})`);

        // Update result with merged queries
        rawResult.searchQueries = uniqueQueries;

        // 9. Validate and normalize output
        const validation = validateAnalysisOutput(rawResult);
        const result = validation.valid ? validation.data : rawResult;

        // Calculate token usage from both LLMs
        const deepseekInputTokens = finalTotalInputTokens;
        const deepseekOutputTokens = deepseekResult.status === "fulfilled"
            ? estimateTokenCount(deepseekResult.value.choices[0].message.content || "")
            : 0;
        const gptInputTokens = estimateTokenCount(gptSystemPrompt + gptUserPrompt);
        const gptOutputTokens = gptResult.status === "fulfilled"
            ? estimateTokenCount(gptResult.value.choices[0].message.content || "")
            : 0;

        return NextResponse.json({
            success: true,
            data: result,
            weights: weights,
            suggestedVariations: suggestedVariations, // Variations for the concept anchor
            metadata: {
                processedPdfs: validPdfDocuments.length,
                failedPdfs: failedPdfs.length,
                processedDois: doiDocuments.length,
                hasResearchContext: hasContext,
                dualLLM: true, // Flag indicating dual-LLM was used
                conceptAnchor: conceptAnchor || null,
                querySources: {
                    deepseek: deepseekQueries.length,
                    gpt: gptQueries.length,
                    merged: uniqueQueries.length,
                },
            },
            tokenEstimate: {
                deepseek: { input: deepseekInputTokens, output: deepseekOutputTokens },
                gpt: { input: gptInputTokens, output: gptOutputTokens },
                total: deepseekInputTokens + deepseekOutputTokens + gptInputTokens + gptOutputTokens,
            },
        });

    } catch (error) {
        console.error("Analysis failed:", error);
        return NextResponse.json(
            { error: "Failed to analyze documents" },
            { status: 500 }
        );
    }
}
