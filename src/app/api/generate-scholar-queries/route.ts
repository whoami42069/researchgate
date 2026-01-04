import { NextRequest, NextResponse } from "next/server";
import { deepseek, MODELS } from "@/lib/deepseek";

export async function POST(req: NextRequest) {
    try {
        const { summary, searchQueries, buzzwords, exclusionCriteria, researchField } = await req.json();

        // Validate inputs (check for actual content, not just whitespace)
        const hasSummary = summary && summary.trim().length > 0;
        const hasQueries = searchQueries && searchQueries.filter((q: string) => q.trim()).length > 0;

        if (!hasSummary && !hasQueries) {
            return NextResponse.json(
                { error: "Must provide summary or search queries" },
                { status: 400 }
            );
        }

        const systemPrompt = `You are an expert academic research librarian with 15+ years of experience optimizing Google Scholar searches.

## Google Scholar Advanced Operators:

### Core Operators:
- Exact phrase: "exact phrase in quotes"
- OR operator: term1 OR term2 (MUST be uppercase)
- AND operator: implicit (space between terms), or explicit AND
- Exclude term: -excludedword (no space after hyphen)
- Grouping: (term1 OR term2) AND term3

### Field-Specific Operators:
- Author search: author:"lastname"
- Title search: intitle:"keyword"
- Publication: source:"Journal Name"
- Year range: after:2020 or before:2024

### Best Practices:
- Keep queries under 256 characters (Google Scholar truncates longer queries)
- Use 2-3 exact phrases max per query
- Put most important terms first
- Don't over-complicate with too many operators

## Strategy: Generate 3-5 DIFFERENT query types:
1. BROAD query (high recall, survey the field)
2. NARROW query (high precision, specific subtopic)
3. TEMPORAL query (recent literature with after:YEAR)
4. EXCLUSION query (remove noise with -term)
5. Optional: METHODOLOGY query (e.g., "meta-analysis", "systematic review")

## Example Queries (for "Machine learning in healthcare"):
- Broad: "machine learning" healthcare (diagnosis OR diagnostics)
- Narrow: "deep learning" "medical imaging" intitle:diagnosis
- Recent: "artificial intelligence" healthcare diagnostics after:2022
- Exclusion: "machine learning" medical -"computer science" -survey

## Output Format (strict JSON):
{
    "queries": [
        {
            "query": "the actual search string ready to paste",
            "purpose": "what this query targets (1 sentence)",
            "tips": "usage tip or modification suggestion"
        }
    ],
    "advancedSearchTip": "one tip for Google Scholar"
}

IMPORTANT:
- Every query must be valid and ready-to-use
- Ensure quotes and parentheses are balanced
- Keep each query under 256 characters`;

        const userPrompt = `Generate optimized Google Scholar search queries for this research profile:

RESEARCH FIELD: ${researchField || "Academic Research"}

RESEARCH SUMMARY:
${summary || "Not provided"}

EXISTING SEARCH QUERIES (for reference):
${searchQueries?.filter((q: string) => q.trim()).join("\n") || "None"}

KEY TERMS/BUZZWORDS:
${buzzwords?.join(", ") || "None specified"}

EXCLUSION CRITERIA (terms to potentially exclude):
${exclusionCriteria?.join(", ") || "None"}

Generate the Google Scholar queries JSON now.`;

        const completion = await deepseek.chat.completions.create({
            model: MODELS.CHAT,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.5, // Slightly higher for more diverse queries
            max_tokens: 1500,
        });

        // Validate LLM response exists
        if (!completion?.choices?.[0]?.message?.content) {
            console.error("Empty response from LLM");
            return NextResponse.json(
                { error: "Empty response from AI" },
                { status: 500 }
            );
        }

        // Safely parse JSON with error handling
        let result;
        try {
            result = JSON.parse(completion.choices[0].message.content);

            // Validate structure
            if (!result.queries || !Array.isArray(result.queries)) {
                throw new Error("Invalid response structure - missing queries array");
            }

            // Filter out any malformed queries
            result.queries = result.queries.filter((q: { query?: string; purpose?: string }) =>
                q.query && typeof q.query === 'string' && q.query.trim().length > 0 &&
                q.purpose && typeof q.purpose === 'string'
            );

            if (result.queries.length === 0) {
                throw new Error("No valid queries in response");
            }
        } catch (parseError) {
            console.error("JSON parse error:", parseError, "Raw content:", completion.choices[0].message.content?.slice(0, 500));
            return NextResponse.json(
                { error: "Invalid response format from AI. Please try again." },
                { status: 500 }
            );
        }

        // Generate scholarUrl for convenience
        const firstQuery = result.queries[0].query;
        result.scholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(firstQuery)}`;

        return NextResponse.json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error("Scholar query generation failed:", error);
        return NextResponse.json(
            { error: "Failed to generate Google Scholar queries" },
            { status: 500 }
        );
    }
}
