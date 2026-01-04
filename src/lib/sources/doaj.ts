/**
 * DOAJ (Directory of Open Access Journals) API Client
 * Free API - No authentication required
 * 21,000+ open access journals, 11+ million articles
 * Excellent coverage for psychology journals
 */

export interface DOAJArticle {
    id: string;
    doi: string | null;
    title: string;
    abstract: string | null;
    authors: string[];
    year: number | null;
    journal: string | null;
    keywords: string[];
    source: 'doaj';
    fullTextUrl: string | null;
}

interface DOAJAuthor {
    name?: string;
    affiliation?: string;
}

interface DOAJBibJson {
    title?: string;
    abstract?: string;
    author?: DOAJAuthor[];
    year?: string;
    month?: string;
    journal?: {
        title?: string;
        issns?: string[];
    };
    keywords?: string[];
    identifier?: Array<{
        type: string;
        id: string;
    }>;
    link?: Array<{
        url: string;
        type: string;
    }>;
}

interface DOAJResult {
    id: string;
    bibjson: DOAJBibJson;
}

interface DOAJResponse {
    results: DOAJResult[];
    total: number;
}

// Psychology-related journals and terms for filtering
export const PSYCHOLOGY_KEYWORDS = [
    'psychology', 'psychological', 'psychiatry', 'psychiatric',
    'mental health', 'psychotherapy', 'behavioral', 'cognitive',
    'clinical psychology', 'social psychology', 'health psychology',
    'neuropsychology', 'developmental psychology'
];

/**
 * Search DOAJ for open access articles
 */
export async function searchDOAJ(
    query: string,
    maxResults: number = 25,
    psychologyFilter: boolean = false
): Promise<DOAJArticle[]> {
    try {
        // Build query with optional psychology filter
        let searchQuery = query;
        if (psychologyFilter) {
            searchQuery = `${query} AND (psychology OR psychiatric OR "mental health" OR behavioral)`;
        }

        const params = new URLSearchParams({
            q: searchQuery,
            pageSize: maxResults.toString(),
        });

        const url = `https://doaj.org/api/v3/search/articles?${params}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.error(`DOAJ API error: ${response.status}`);
            return [];
        }

        const data: DOAJResponse = await response.json();

        if (!data.results) {
            return [];
        }

        return data.results.map((item): DOAJArticle => {
            const bib = item.bibjson;

            // Extract DOI from identifiers
            const doiIdentifier = bib.identifier?.find(id => id.type === 'doi');
            const doi = doiIdentifier?.id || null;

            // Extract full text URL
            const fullTextLink = bib.link?.find(l => l.type === 'fulltext');
            const fullTextUrl = fullTextLink?.url || null;

            // Extract authors
            const authors = bib.author?.map(a => a.name || 'Unknown').filter(Boolean) || [];

            return {
                id: item.id || `doaj-${Date.now()}-${Math.random()}`,
                doi: doi,
                title: bib.title || 'Untitled',
                abstract: bib.abstract || null,
                authors: authors,
                year: bib.year ? parseInt(bib.year) : null,
                journal: bib.journal?.title || null,
                keywords: bib.keywords || [],
                source: 'doaj',
                fullTextUrl: fullTextUrl
            };
        });

    } catch (error) {
        console.error('DOAJ search error:', error);
        return [];
    }
}

/**
 * Search specifically for psychology journals
 */
export async function searchDOAJPsychology(
    query: string,
    maxResults: number = 25
): Promise<DOAJArticle[]> {
    return searchDOAJ(query, maxResults, true);
}
