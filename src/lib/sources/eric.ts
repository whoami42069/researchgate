/**
 * ERIC (Education Resources Information Center) API Client
 * Free API - No authentication required
 * 1.6 million records - U.S. Department of Education
 * Good for: Educational psychology, learning sciences, school counseling
 */

export interface ERICArticle {
    id: string;
    doi: string | null;
    title: string;
    abstract: string | null;
    authors: string[];
    year: number | null;
    source: 'eric';
    publicationType: string | null;
    peerReviewed: boolean;
    url: string | null;
}

interface ERICDoc {
    id: string;
    title?: string;
    description?: string;
    author?: string[];
    publicationdateyear?: number;
    publicationtype?: string[];
    peerreviewed?: string;
    url?: string;
    identifierDOI?: string;
}

interface ERICResponse {
    response: {
        docs: ERICDoc[];
        numFound: number;
    };
}

// Educational psychology descriptors
export const EDUCATIONAL_PSYCHOLOGY_TERMS = [
    'Educational Psychology', 'Learning Disabilities', 'Cognitive Development',
    'Behavioral Objectives', 'School Psychology', 'Counseling Psychology',
    'Child Development', 'Adolescent Development', 'Mental Health',
    'Anxiety', 'Depression', 'Self Efficacy', 'Motivation'
];

/**
 * Search ERIC for education/psychology articles
 */
export async function searchERIC(
    query: string,
    maxResults: number = 25,
    psychologyFilter: boolean = false
): Promise<ERICArticle[]> {
    try {
        // Build search query
        let searchTerms = query;
        if (psychologyFilter) {
            searchTerms = `${query} AND (psychology OR "mental health" OR counseling OR behavioral)`;
        }

        const params = new URLSearchParams({
            search: searchTerms,
            format: 'json',
            rows: maxResults.toString(),
        });

        const url = `https://api.ies.ed.gov/eric/?${params}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.error(`ERIC API error: ${response.status}`);
            return [];
        }

        const data: ERICResponse = await response.json();

        if (!data.response?.docs) {
            return [];
        }

        return data.response.docs.map((doc): ERICArticle => ({
            id: doc.id || `eric-${Date.now()}-${Math.random()}`,
            doi: doc.identifierDOI || null,
            title: doc.title || 'Untitled',
            abstract: doc.description || null,
            authors: doc.author || [],
            year: doc.publicationdateyear || null,
            source: 'eric',
            publicationType: doc.publicationtype?.[0] || null,
            peerReviewed: doc.peerreviewed === 'T',
            url: doc.url || (doc.id ? `https://eric.ed.gov/?id=${doc.id}` : null)
        }));

    } catch (error) {
        console.error('ERIC search error:', error);
        return [];
    }
}

/**
 * Search specifically for educational psychology topics
 */
export async function searchERICPsychology(
    query: string,
    maxResults: number = 25
): Promise<ERICArticle[]> {
    return searchERIC(query, maxResults, true);
}
