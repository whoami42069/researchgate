/**
 * Europe PMC API Client
 * Free API - No authentication required
 * 33+ million publications from PubMed, Agricola, and more
 * Strong coverage: biological psychology, neuroscience, behavioral science
 */

export interface EuropePMCArticle {
    id: string;
    doi: string | null;
    title: string;
    abstract: string | null;
    authors: string[];
    year: number | null;
    journal: string | null;
    citedByCount: number;
    isOpenAccess: boolean;
    source: 'europe-pmc';
}

interface EuropePMCResult {
    id: string;
    doi?: string;
    title: string;
    abstractText?: string;
    authorString?: string;
    pubYear?: string;
    journalTitle?: string;
    citedByCount?: number;
    isOpenAccess?: string;
    pmid?: string;
    pmcid?: string;
}

interface EuropePMCResponse {
    resultList: {
        result: EuropePMCResult[];
    };
    hitCount: number;
}

// Psychology-related search terms to enhance queries
export const PSYCHOLOGY_TERMS = [
    'psychology', 'psychiatric', 'mental health', 'behavioral',
    'cognitive', 'anxiety', 'depression', 'therapy', 'psychotherapy',
    'neuropsychology', 'social psychology', 'clinical psychology'
];

/**
 * Search Europe PMC for articles
 */
export async function searchEuropePMC(
    query: string,
    maxResults: number = 25,
    psychologyFilter: boolean = false
): Promise<EuropePMCArticle[]> {
    try {
        // Build query with optional psychology filter
        let searchQuery = query;
        if (psychologyFilter) {
            searchQuery = `(${query}) AND (psychology OR psychiatric OR "mental health" OR behavioral OR cognitive)`;
        }

        const params = new URLSearchParams({
            query: searchQuery,
            format: 'json',
            pageSize: maxResults.toString(),
            resultType: 'core', // Get full metadata including abstract
            sort: 'RELEVANCE'
        });

        const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.error(`Europe PMC API error: ${response.status}`);
            return [];
        }

        const data: EuropePMCResponse = await response.json();

        if (!data.resultList?.result) {
            return [];
        }

        return data.resultList.result.map((item): EuropePMCArticle => ({
            id: item.pmid || item.pmcid || item.id || `epmc-${Date.now()}-${Math.random()}`,
            doi: item.doi || null,
            title: item.title || 'Untitled',
            abstract: item.abstractText || null,
            authors: item.authorString ? item.authorString.split(', ') : [],
            year: item.pubYear ? parseInt(item.pubYear) : null,
            journal: item.journalTitle || null,
            citedByCount: item.citedByCount || 0,
            isOpenAccess: item.isOpenAccess === 'Y',
            source: 'europe-pmc'
        }));

    } catch (error) {
        console.error('Europe PMC search error:', error);
        return [];
    }
}

/**
 * Search with psychology-specific enhancement
 */
export async function searchEuropePMCPsychology(
    query: string,
    maxResults: number = 25
): Promise<EuropePMCArticle[]> {
    return searchEuropePMC(query, maxResults, true);
}
