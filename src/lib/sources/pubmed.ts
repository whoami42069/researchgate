/**
 * PubMed E-Utilities API Client
 * Coverage: 35M+ biomedical citations, excellent for clinical/health psychology
 * Rate Limit: 3 requests/second (without key), 10/second (with key)
 */

export interface PubMedArticle {
    id: string; // PMID
    doi: string | null;
    title: string;
    abstract: string | null;
    authors: string[];
    published: string;
    year: number;
    source: 'pubmed';
    journal: string;
    meshTerms: string[];
}

// Psychology-related MeSH terms for PubMed
export const PSYCHOLOGY_MESH_TERMS = [
    'Psychology',
    'Psychology, Clinical',
    'Psychology, Social',
    'Psychology, Developmental',
    'Psychology, Educational',
    'Mental Health',
    'Anxiety Disorders',
    'Depressive Disorder',
    'Cognitive Therapy',
    'Psychotherapy',
    'Behavioral Medicine',
    'Stress, Psychological',
];

/**
 * Search PubMed for academic articles
 * @param query - Search query
 * @param maxResults - Maximum number of results (default 25)
 * @param useMeshFilter - Whether to add psychology MeSH term filters
 */
export async function searchPubMed(
    query: string,
    maxResults: number = 25,
    useMeshFilter: boolean = false
): Promise<PubMedArticle[]> {
    try {
        // Build search term with optional MeSH filter
        let searchTerm = query;
        if (useMeshFilter) {
            // Add psychology MeSH terms to broaden coverage
            const meshFilter = PSYCHOLOGY_MESH_TERMS.slice(0, 3)
                .map(term => `"${term}"[MESH]`)
                .join(' OR ');
            searchTerm = `(${query}) AND (${meshFilter})`;
        }

        // Step 1: Search for PMIDs
        const searchParams = new URLSearchParams({
            db: 'pubmed',
            term: searchTerm,
            retmax: maxResults.toString(),
            retmode: 'json',
            sort: 'relevance',
        });

        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams.toString()}`;
        const searchResponse = await fetch(searchUrl);

        if (!searchResponse.ok) {
            console.error('PubMed search error:', searchResponse.status);
            return [];
        }

        const searchData = await searchResponse.json();
        const pmids: string[] = searchData.esearchresult?.idlist || [];

        if (pmids.length === 0) {
            return [];
        }

        // Step 2: Fetch article details
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 350));

        const fetchParams = new URLSearchParams({
            db: 'pubmed',
            id: pmids.join(','),
            retmode: 'xml',
            rettype: 'abstract',
        });

        const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${fetchParams.toString()}`;
        const fetchResponse = await fetch(fetchUrl);

        if (!fetchResponse.ok) {
            console.error('PubMed fetch error:', fetchResponse.status);
            return [];
        }

        const xmlText = await fetchResponse.text();
        return parsePubMedXML(xmlText);
    } catch (error) {
        console.error('PubMed search error:', error);
        return [];
    }
}

/**
 * Parse PubMed XML response into structured articles
 */
function parsePubMedXML(xml: string): PubMedArticle[] {
    const articles: PubMedArticle[] = [];

    try {
        // Simple XML parsing using regex (for robustness without dependencies)
        const articleMatches = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];

        for (const articleXml of articleMatches) {
            // Extract PMID
            const pmidMatch = articleXml.match(/<PMID[^>]*>(\d+)<\/PMID>/);
            const pmid = pmidMatch ? pmidMatch[1] : null;
            if (!pmid) continue;

            // Extract title
            const titleMatch = articleXml.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/);
            const title = titleMatch ? cleanXmlText(titleMatch[1]) : 'Untitled';

            // Extract abstract
            const abstractMatch = articleXml.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
            let abstract: string | null = null;
            if (abstractMatch) {
                abstract = abstractMatch
                    .map(m => {
                        const textMatch = m.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/);
                        return textMatch ? cleanXmlText(textMatch[1]) : '';
                    })
                    .join(' ')
                    .trim();
            }

            // Extract DOI
            const doiMatch = articleXml.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/);
            const doi = doiMatch ? cleanXmlText(doiMatch[1]) : null;

            // Extract authors
            const authorMatches = articleXml.match(/<Author[^>]*>[\s\S]*?<\/Author>/g) || [];
            const authors = authorMatches.slice(0, 5).map(authorXml => {
                const lastNameMatch = authorXml.match(/<LastName>([\s\S]*?)<\/LastName>/);
                const foreNameMatch = authorXml.match(/<ForeName>([\s\S]*?)<\/ForeName>/);
                const lastName = lastNameMatch ? cleanXmlText(lastNameMatch[1]) : '';
                const foreName = foreNameMatch ? cleanXmlText(foreNameMatch[1]) : '';
                return `${foreName} ${lastName}`.trim();
            }).filter(Boolean);

            // Extract publication date
            const yearMatch = articleXml.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/);
            const monthMatch = articleXml.match(/<PubDate>[\s\S]*?<Month>(\w+)<\/Month>/);
            const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
            const month = monthMatch ? monthMatch[1] : '01';
            const published = `${year}-${month}`;

            // Extract journal
            const journalMatch = articleXml.match(/<Title>([\s\S]*?)<\/Title>/);
            const journal = journalMatch ? cleanXmlText(journalMatch[1]) : '';

            // Extract MeSH terms
            const meshMatches = articleXml.match(/<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/g) || [];
            const meshTerms = meshMatches.slice(0, 10).map(m => {
                const textMatch = m.match(/<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/);
                return textMatch ? cleanXmlText(textMatch[1]) : '';
            }).filter(Boolean);

            articles.push({
                id: `PMID:${pmid}`,
                doi,
                title,
                abstract,
                authors,
                published,
                year,
                source: 'pubmed',
                journal,
                meshTerms,
            });
        }
    } catch (error) {
        console.error('PubMed XML parsing error:', error);
    }

    return articles;
}

/**
 * Clean XML text by removing tags and decoding entities
 */
function cleanXmlText(text: string): string {
    return text
        .replace(/<[^>]+>/g, '') // Remove XML tags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Search PubMed specifically for psychology articles
 */
export async function searchPubMedPsychology(
    query: string,
    maxResults: number = 25
): Promise<PubMedArticle[]> {
    return searchPubMed(query, maxResults, true);
}
