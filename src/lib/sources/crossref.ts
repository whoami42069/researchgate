/**
 * CrossRef API Client
 * Free API - No authentication required (polite pool with email)
 * 140+ million scholarly works
 * Excellent for business, marketing, and interdisciplinary research
 */

export interface CrossRefArticle {
    id: string;
    doi: string;
    title: string;
    abstract: string | null;
    authors: string[];
    year: number | null;
    journal: string | null;
    source: 'crossref';
    citedByCount: number;
    isOpenAccess: boolean;
    type: string;
}

interface CrossRefAuthor {
    given?: string;
    family?: string;
    name?: string;
}

interface CrossRefWork {
    DOI: string;
    title?: string[];
    abstract?: string;
    author?: CrossRefAuthor[];
    published?: {
        'date-parts'?: number[][];
    };
    'published-print'?: {
        'date-parts'?: number[][];
    };
    'published-online'?: {
        'date-parts'?: number[][];
    };
    'container-title'?: string[];
    'is-referenced-by-count'?: number;
    type?: string;
    link?: Array<{
        URL: string;
        'content-type'?: string;
    }>;
}

interface CrossRefResponse {
    status: string;
    message: {
        items: CrossRefWork[];
        'total-results': number;
    };
}

// Business/Marketing related terms for filtering
export const BUSINESS_KEYWORDS = [
    'marketing', 'consumer', 'brand', 'business',
    'management', 'organizational', 'strategic',
    'customer', 'market research', 'advertising'
];

/**
 * Parse author from CrossRef format
 */
function parseAuthor(author: CrossRefAuthor): string {
    if (author.name) return author.name;
    const parts = [author.given, author.family].filter(Boolean);
    return parts.join(' ') || 'Unknown Author';
}

/**
 * Extract year from CrossRef date parts
 */
function extractYear(work: CrossRefWork): number | null {
    const dateParts =
        work.published?.['date-parts']?.[0] ||
        work['published-print']?.['date-parts']?.[0] ||
        work['published-online']?.['date-parts']?.[0];

    if (dateParts && dateParts[0]) {
        return dateParts[0];
    }
    return null;
}

/**
 * Search CrossRef for scholarly works
 */
export async function searchCrossRef(
    query: string,
    maxResults: number = 25
): Promise<CrossRefArticle[]> {
    try {
        const params = new URLSearchParams({
            query: query,
            rows: maxResults.toString(),
            sort: 'relevance',
            order: 'desc',
            select: 'DOI,title,abstract,author,published,published-print,published-online,container-title,is-referenced-by-count,type,link',
        });

        // Use polite pool with email for better rate limits
        const url = `https://api.crossref.org/works?${params.toString()}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'ResearchDiscoveryApp/1.0 (mailto:research@academic.app)',
                'Accept': 'application/json',
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`CrossRef API error: ${response.status}`);
            return [];
        }

        const data: CrossRefResponse = await response.json();

        if (!data.message?.items) {
            return [];
        }

        return data.message.items
            .filter(work => work.title && work.title.length > 0)
            .map(work => ({
                id: work.DOI,
                doi: work.DOI,
                title: work.title?.[0] || 'Untitled',
                abstract: work.abstract || null,
                authors: work.author?.map(parseAuthor) || [],
                year: extractYear(work),
                journal: work['container-title']?.[0] || null,
                source: 'crossref' as const,
                citedByCount: work['is-referenced-by-count'] || 0,
                isOpenAccess: false, // CrossRef doesn't directly indicate OA status
                type: work.type || 'article',
            }));
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('CrossRef search timed out');
        } else {
            console.error('CrossRef search failed:', error);
        }
        return [];
    }
}

/**
 * Search CrossRef with business/marketing filter
 */
export async function searchCrossRefBusiness(
    query: string,
    maxResults: number = 25
): Promise<CrossRefArticle[]> {
    // Add business-related terms to query
    const businessQuery = `${query} AND (marketing OR business OR management OR consumer OR organizational)`;
    return searchCrossRef(businessQuery, maxResults);
}

/**
 * Search CrossRef by subject filter
 * Useful for narrowing down to specific disciplines
 */
export async function searchCrossRefBySubject(
    query: string,
    subject: string,
    maxResults: number = 25
): Promise<CrossRefArticle[]> {
    try {
        const params = new URLSearchParams({
            query: query,
            rows: maxResults.toString(),
            sort: 'relevance',
            order: 'desc',
            filter: `has-abstract:true`,
            select: 'DOI,title,abstract,author,published,published-print,published-online,container-title,is-referenced-by-count,type',
        });

        const url = `https://api.crossref.org/works?${params.toString()}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'ResearchDiscoveryApp/1.0 (mailto:research@academic.app)',
                'Accept': 'application/json',
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            return [];
        }

        const data: CrossRefResponse = await response.json();

        if (!data.message?.items) {
            return [];
        }

        return data.message.items
            .filter(work => work.title && work.title.length > 0)
            .map(work => ({
                id: work.DOI,
                doi: work.DOI,
                title: work.title?.[0] || 'Untitled',
                abstract: work.abstract || null,
                authors: work.author?.map(parseAuthor) || [],
                year: extractYear(work),
                journal: work['container-title']?.[0] || null,
                source: 'crossref' as const,
                citedByCount: work['is-referenced-by-count'] || 0,
                isOpenAccess: false,
                type: work.type || 'article',
            }));
    } catch (error) {
        console.error('CrossRef subject search failed:', error);
        return [];
    }
}
