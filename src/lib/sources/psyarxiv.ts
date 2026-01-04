/**
 * PsyArXiv (OSF Preprints) API Client
 * Coverage: 100K+ psychology preprints
 * Rate Limit: No strict limits, be respectful
 */

export interface PsyArXivArticle {
    id: string;
    doi: string | null;
    title: string;
    abstract: string | null;
    authors: string[];
    published: string;
    year: number;
    source: 'psyarxiv';
    preprint: true;
}

/**
 * Search PsyArXiv for psychology preprints
 * @param query - Search query
 * @param maxResults - Maximum number of results (default 25)
 */
export async function searchPsyArXiv(
    query: string,
    maxResults: number = 25
): Promise<PsyArXivArticle[]> {
    try {
        // Use OSF API to search PsyArXiv preprints
        const params = new URLSearchParams({
            'filter[provider]': 'psyarxiv',
            'page[size]': maxResults.toString(),
        });

        const url = `https://api.osf.io/v2/preprints/?${params.toString()}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/vnd.api+json',
            },
        });

        if (!response.ok) {
            console.error('PsyArXiv API error:', response.status, response.statusText);
            return [];
        }

        const data = await response.json();
        const preprints = data.data || [];

        // Filter by query terms (OSF API doesn't support full-text search well)
        const queryTerms = query.toLowerCase().split(/\s+/);

        return preprints
            .filter((preprint: any) => {
                const title = (preprint.attributes?.title || '').toLowerCase();
                const description = (preprint.attributes?.description || '').toLowerCase();
                const combined = title + ' ' + description;

                // Check if any query term matches
                return queryTerms.some(term => combined.includes(term));
            })
            .map((preprint: any): PsyArXivArticle => {
                // Extract DOI
                const doi = preprint.attributes?.doi || null;

                // Extract contributors (authors)
                const authors: string[] = [];
                // Note: OSF API requires additional call for contributors
                // For now, we'll leave authors empty and let the UI handle it

                // Get publication date
                const datePublished = preprint.attributes?.date_published || preprint.attributes?.date_created;
                const year = datePublished ? new Date(datePublished).getFullYear() : new Date().getFullYear();

                return {
                    id: preprint.id || `psyarxiv-${Date.now()}-${Math.random()}`,
                    doi: doi?.replace('https://doi.org/', ''),
                    title: preprint.attributes?.title || 'Untitled',
                    abstract: preprint.attributes?.description || null,
                    authors,
                    published: datePublished || '',
                    year,
                    source: 'psyarxiv',
                    preprint: true,
                };
            })
            .slice(0, maxResults);
    } catch (error) {
        console.error('PsyArXiv search error:', error);
        return [];
    }
}
