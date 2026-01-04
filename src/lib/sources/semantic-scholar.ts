/**
 * Semantic Scholar API Client
 * Coverage: 200M+ papers with AI-powered relevancy ranking
 * Rate Limit: 1000 requests/second (shared), 1 RPS with API key
 * Provides TLDR summaries (AI-generated abstracts)
 */

export interface SemanticScholarArticle {
    id: string;
    doi: string | null;
    title: string;
    abstract: string | null;
    tldr: string | null; // AI-generated 1-2 sentence summary
    authors: string[];
    published: string;
    year: number;
    source: 'semantic-scholar';
    citedByCount: number;
    fieldsOfStudy: string[];
    isOpenAccess: boolean;
    pdfUrl: string | null;
}

// Psychology-related fields of study for Semantic Scholar
export const PSYCHOLOGY_FIELDS = [
    'Psychology',
    'Clinical Psychology',
    'Social Psychology',
    'Cognitive Psychology',
    'Developmental Psychology',
    'Health Psychology',
    'Educational Psychology',
    'Neuropsychology',
];

/**
 * Search Semantic Scholar for academic articles
 * @param query - Search query
 * @param maxResults - Maximum number of results (default 25)
 * @param fieldsOfStudy - Optional array of fields to filter by
 */
export async function searchSemanticScholar(
    query: string,
    maxResults: number = 25,
    fieldsOfStudy: string[] = []
): Promise<SemanticScholarArticle[]> {
    try {
        const params = new URLSearchParams({
            query: query,
            limit: maxResults.toString(),
            fields: 'paperId,externalIds,title,abstract,tldr,authors,year,citationCount,fieldsOfStudy,isOpenAccess,openAccessPdf,publicationDate',
        });

        // Add fields of study filter
        if (fieldsOfStudy.length > 0) {
            params.append('fieldsOfStudy', fieldsOfStudy.join(','));
        }

        const url = `https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            // If rate limited, wait and retry once
            if (response.status === 429) {
                console.warn('Semantic Scholar rate limited, waiting 1s...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                const retryResponse = await fetch(url);
                if (!retryResponse.ok) {
                    console.error('Semantic Scholar API retry failed:', retryResponse.status);
                    return [];
                }
                const retryData = await retryResponse.json();
                return parseSemanticScholarResults(retryData.data || []);
            }
            console.error('Semantic Scholar API error:', response.status, response.statusText);
            return [];
        }

        const data = await response.json();
        return parseSemanticScholarResults(data.data || []);
    } catch (error) {
        console.error('Semantic Scholar search error:', error);
        return [];
    }
}

function parseSemanticScholarResults(papers: any[]): SemanticScholarArticle[] {
    return papers.map((paper: any): SemanticScholarArticle => {
        // Extract DOI from externalIds
        const doi = paper.externalIds?.DOI || null;

        // Extract authors
        const authors = (paper.authors || [])
            .map((auth: any) => auth.name)
            .filter(Boolean)
            .slice(0, 5);

        // Extract fields of study
        const fieldsOfStudy = (paper.fieldsOfStudy || []).slice(0, 5);

        // Get TLDR if available
        const tldr = paper.tldr?.text || null;

        return {
            id: paper.paperId || `semantic-${Date.now()}-${Math.random()}`,
            doi,
            title: paper.title || 'Untitled',
            abstract: paper.abstract || null,
            tldr,
            authors,
            published: paper.publicationDate || paper.year?.toString() || '',
            year: paper.year || new Date().getFullYear(),
            source: 'semantic-scholar',
            citedByCount: paper.citationCount || 0,
            fieldsOfStudy,
            isOpenAccess: paper.isOpenAccess || false,
            pdfUrl: paper.openAccessPdf?.url || null,
        };
    });
}

/**
 * Search Semantic Scholar specifically for psychology articles
 */
export async function searchSemanticScholarPsychology(
    query: string,
    maxResults: number = 25
): Promise<SemanticScholarArticle[]> {
    return searchSemanticScholar(query, maxResults, PSYCHOLOGY_FIELDS);
}
