/**
 * OpenAlex API Client
 * Coverage: 240M+ works across all disciplines including psychology
 * Rate Limit: 100,000 requests/day, 10 requests/second
 * No authentication required
 */

export interface OpenAlexArticle {
    id: string;
    doi: string | null;
    title: string;
    abstract: string | null;
    authors: string[];
    published: string;
    year: number;
    source: 'openalex';
    citedByCount: number;
    topics: string[];
    isOpenAccess: boolean;
    pdfUrl: string | null;
}

// Psychology-related topic filters for OpenAlex
export const PSYCHOLOGY_TOPICS = [
    'Psychology',
    'Clinical Psychology',
    'Social Psychology',
    'Cognitive Psychology',
    'Developmental Psychology',
    'Health Psychology',
    'Educational Psychology',
    'Industrial and Organizational Psychology',
    'Neuropsychology',
    'Counseling Psychology',
    'Behavioral Science',
    'Mental Health',
];

/**
 * Convert OpenAlex inverted abstract index to plain text
 */
function convertInvertedAbstract(invertedIndex: Record<string, number[]> | null): string | null {
    if (!invertedIndex) return null;

    try {
        // Find maximum position
        let maxPos = 0;
        for (const positions of Object.values(invertedIndex)) {
            if (positions && positions.length > 0) {
                maxPos = Math.max(maxPos, Math.max(...positions));
            }
        }

        // Build word array
        const words: string[] = new Array(maxPos + 1).fill('');
        for (const [word, positions] of Object.entries(invertedIndex)) {
            for (const pos of positions) {
                words[pos] = word;
            }
        }

        return words.join(' ').trim();
    } catch {
        return null;
    }
}

/**
 * Search OpenAlex for academic articles
 * @param query - Search query
 * @param maxResults - Maximum number of results (default 25)
 * @param psychologyFilter - Whether to filter for psychology-related topics
 */
export async function searchOpenAlex(
    query: string,
    maxResults: number = 25,
    psychologyFilter: boolean = false
): Promise<OpenAlexArticle[]> {
    try {
        const params = new URLSearchParams({
            search: query,
            per_page: maxResults.toString(),
            sort: 'relevance_score:desc',
            mailto: 'research-app@example.com', // Required for polite pool
        });

        // Add psychology filter if requested
        if (psychologyFilter) {
            params.append('filter', 'topics.field.display_name:Psychology');
        }

        const url = `https://api.openalex.org/works?${params.toString()}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('OpenAlex API error:', response.status, response.statusText);
            return [];
        }

        const data = await response.json();
        const results = data.results || [];

        return results.map((work: any): OpenAlexArticle => {
            // Extract DOI (remove https://doi.org/ prefix if present)
            let doi = work.doi || null;
            if (doi && doi.startsWith('https://doi.org/')) {
                doi = doi.replace('https://doi.org/', '');
            }

            // Extract authors
            const authors = (work.authorships || [])
                .map((auth: any) => auth.author?.display_name)
                .filter(Boolean)
                .slice(0, 5); // Limit to first 5 authors

            // Extract topics
            const topics = (work.topics || [])
                .map((topic: any) => topic.display_name)
                .filter(Boolean)
                .slice(0, 5);

            // Get abstract
            const abstract = convertInvertedAbstract(work.abstract_inverted_index);

            return {
                id: work.id || `openalex-${Date.now()}-${Math.random()}`,
                doi,
                title: work.title || 'Untitled',
                abstract,
                authors,
                published: work.publication_date || work.publication_year?.toString() || '',
                year: work.publication_year || new Date().getFullYear(),
                source: 'openalex',
                citedByCount: work.cited_by_count || 0,
                topics,
                isOpenAccess: work.open_access?.is_oa || false,
                pdfUrl: work.open_access?.oa_url || work.primary_location?.pdf_url || null,
            };
        });
    } catch (error) {
        console.error('OpenAlex search error:', error);
        return [];
    }
}

/**
 * Search OpenAlex specifically for psychology articles
 */
export async function searchOpenAlexPsychology(
    query: string,
    maxResults: number = 25
): Promise<OpenAlexArticle[]> {
    return searchOpenAlex(query, maxResults, true);
}
