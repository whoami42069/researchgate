/**
 * CORE API Client (core.ac.uk)
 * World's largest aggregator of open access research
 * 431M+ metadata records, 200M+ open access papers
 * Free API with generous rate limits
 */

export interface COREArticle {
    id: string;
    doi: string | null;
    title: string;
    abstract: string | null;
    authors: string[];
    year: number | null;
    publisher: string | null;
    source: 'core';
    downloadUrl: string | null;
    sourceFulltextUrls: string[];
    language: string | null;
}

interface COREAuthor {
    name?: string;
}

interface COREWork {
    id: string | number;
    doi?: string;
    title?: string;
    abstract?: string;
    authors?: COREAuthor[];
    yearPublished?: number;
    publisher?: string;
    downloadUrl?: string;
    sourceFulltextUrls?: string[];
    language?: { code?: string };
}

interface COREResponse {
    totalHits: number;
    results: COREWork[];
}

// API configuration
const CORE_API_BASE = 'https://api.core.ac.uk/v3';
const CORE_API_KEY = process.env.CORE_API_KEY || '';

/**
 * Search CORE for open access articles
 */
export async function searchCORE(
    query: string,
    maxResults: number = 25
): Promise<COREArticle[]> {
    try {
        const params = new URLSearchParams({
            q: query,
            limit: Math.min(maxResults, 100).toString(),
        });

        // Add API key if available
        if (CORE_API_KEY) {
            params.append('apiKey', CORE_API_KEY);
        }

        const url = `${CORE_API_BASE}/search/works?${params.toString()}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const headers: Record<string, string> = {
            'Accept': 'application/json',
        };

        // Use Bearer token if API key available
        if (CORE_API_KEY) {
            headers['Authorization'] = `Bearer ${CORE_API_KEY}`;
        }

        const response = await fetch(url, {
            headers,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            if (response.status === 429) {
                console.warn('CORE API rate limited, returning empty results');
                return [];
            }
            console.error(`CORE API error: ${response.status}`);
            return [];
        }

        const data: COREResponse = await response.json();

        if (!data.results || !Array.isArray(data.results)) {
            return [];
        }

        return data.results
            .filter(work => work.title && work.title.length > 0)
            .map(work => ({
                id: work.id?.toString() || '',
                doi: work.doi || null,
                title: work.title || 'Untitled',
                abstract: work.abstract || null,
                authors: work.authors?.map(a => a.name || 'Unknown').filter(Boolean) || [],
                year: work.yearPublished || null,
                publisher: work.publisher || null,
                source: 'core' as const,
                downloadUrl: work.downloadUrl || null,
                sourceFulltextUrls: work.sourceFulltextUrls || [],
                language: work.language?.code || null,
            }));
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('CORE search timed out');
        } else {
            console.error('CORE search failed:', error);
        }
        return [];
    }
}

/**
 * Search CORE with business/social science focus
 */
export async function searchCOREBusiness(
    query: string,
    maxResults: number = 25
): Promise<COREArticle[]> {
    // Enhance query with business-related terms
    const businessQuery = `${query} AND (business OR management OR marketing OR economics OR finance OR organizational)`;
    return searchCORE(businessQuery, maxResults);
}

/**
 * Search CORE with psychology focus
 */
export async function searchCOREPsychology(
    query: string,
    maxResults: number = 25
): Promise<COREArticle[]> {
    // Enhance query with psychology-related terms
    const psychQuery = `${query} AND (psychology OR psychological OR mental health OR cognitive OR behavioral)`;
    return searchCORE(psychQuery, maxResults);
}

/**
 * Search CORE with year filter
 */
export async function searchCOREByYear(
    query: string,
    startYear: number,
    endYear: number,
    maxResults: number = 25
): Promise<COREArticle[]> {
    const yearQuery = `${query} AND yearPublished>=${startYear} AND yearPublished<=${endYear}`;
    return searchCORE(yearQuery, maxResults);
}
