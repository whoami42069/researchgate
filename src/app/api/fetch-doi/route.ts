import { NextRequest, NextResponse } from "next/server";

export interface DOIArticle {
    doi: string;
    title: string;
    abstract: string;
    authors: string[];
    published?: string;
    error?: string;
}

/**
 * POST /api/fetch-doi
 * Fetches article metadata from CrossRef API for given DOIs.
 * Request body: { dois: string[] }
 * Returns: Array of article metadata with title, abstract, authors
 */
export async function POST(req: NextRequest) {
    try {
        const { dois } = await req.json();

        if (!dois || !Array.isArray(dois) || dois.length === 0) {
            return NextResponse.json(
                { error: "No DOIs provided. Expected array of DOI strings." },
                { status: 400 }
            );
        }

        // Validate DOI format (lenient check - just needs 10. and a slash)
        const validDOIs = dois.filter((doi) => {
            if (typeof doi !== "string") return false;
            const trimmed = doi.trim();
            // Basic DOI check: starts with 10. and contains a slash
            return trimmed.startsWith("10.") && trimmed.includes("/");
        });

        if (validDOIs.length === 0) {
            return NextResponse.json(
                { error: "No valid DOIs provided. DOI format should be: 10.xxxx/xxxxx" },
                { status: 400 }
            );
        }

        // Fetch metadata for each DOI from CrossRef
        const results = await Promise.all(
            validDOIs.map(async (doi) => {
                try {
                    return await fetchDOIMetadata(doi.trim());
                } catch (error) {
                    console.error(`Error fetching DOI ${doi}:`, error);
                    return {
                        doi,
                        title: "",
                        abstract: "",
                        authors: [],
                        error: error instanceof Error ? error.message : "Failed to fetch metadata",
                    };
                }
            })
        );

        return NextResponse.json({
            success: true,
            articles: results,
        });
    } catch (error) {
        console.error("DOI fetch failed:", error);
        return NextResponse.json(
            { error: "Failed to process DOI request" },
            { status: 500 }
        );
    }
}

/**
 * Fetches metadata for a single DOI from CrossRef API.
 * @param doi - The DOI to fetch
 * @returns Article metadata
 */
async function fetchDOIMetadata(doi: string): Promise<DOIArticle> {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "ResearchDiscoveryApp/1.0 (Academic Research Tool)",
                "Accept": "application/json",
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("DOI not found in CrossRef");
            }
            throw new Error(`CrossRef API error: ${response.status}`);
        }

        const data = await response.json();
        const work = data.message;

        // Extract title
        const title = Array.isArray(work.title) && work.title.length > 0
            ? work.title[0]
            : "";

        // Extract abstract (if available)
        const abstract = work.abstract || "";

        // Extract authors
        const authors: string[] = [];
        if (Array.isArray(work.author)) {
            work.author.forEach((author: any) => {
                const name = [author.given, author.family].filter(Boolean).join(" ");
                if (name) authors.push(name);
            });
        }

        // Extract publication date
        let published = "";
        if (work.published) {
            const dateParts = work.published["date-parts"];
            if (Array.isArray(dateParts) && Array.isArray(dateParts[0])) {
                published = dateParts[0].join("-");
            }
        } else if (work["published-print"]) {
            const dateParts = work["published-print"]["date-parts"];
            if (Array.isArray(dateParts) && Array.isArray(dateParts[0])) {
                published = dateParts[0].join("-");
            }
        }

        return {
            doi,
            title,
            abstract,
            authors,
            published,
        };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error("Request timed out - CrossRef API slow");
        }
        throw error;
    }
}
