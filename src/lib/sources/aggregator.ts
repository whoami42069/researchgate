/**
 * Multi-Source Article Aggregator
 * Combines results from multiple academic databases with deduplication
 */

import { searchArxiv, type Article as ArxivArticle } from '../arxiv';
import { searchOpenAlex, searchOpenAlexPsychology, type OpenAlexArticle } from './openalex';
import { searchSemanticScholar, searchSemanticScholarPsychology, type SemanticScholarArticle } from './semantic-scholar';
import { searchPubMed, searchPubMedPsychology, type PubMedArticle } from './pubmed';
import { searchEuropePMC, searchEuropePMCPsychology, type EuropePMCArticle } from './europe-pmc';
import { searchDOAJ, searchDOAJPsychology, type DOAJArticle } from './doaj';
import { searchERIC, searchERICPsychology, type ERICArticle } from './eric';
import { searchCrossRef, searchCrossRefBusiness, type CrossRefArticle } from './crossref';
import { searchCORE, searchCOREBusiness, searchCOREPsychology, type COREArticle } from './core';

// Unified article interface for all sources
export interface UnifiedArticle {
    id: string;
    doi: string | null;
    title: string;
    abstract: string | null;
    summary: string; // 2-sentence summary for display
    authors: string[];
    published: string;
    year: number;
    source: 'arxiv' | 'openalex' | 'semantic-scholar' | 'pubmed' | 'psyarxiv' | 'europe-pmc' | 'doaj' | 'eric' | 'crossref' | 'core';
    link: string;
    citedByCount?: number;
    topics?: string[];
    isOpenAccess?: boolean;
    pdfUrl?: string | null;
    tldr?: string | null; // AI summary from Semantic Scholar
}

export type SourceType = 'arxiv' | 'openalex' | 'semantic-scholar' | 'pubmed' | 'europe-pmc' | 'doaj' | 'eric' | 'crossref' | 'core';

export interface AggregatorOptions {
    maxResultsPerSource: number;
    includePsychologyFilter: boolean;
    sources: SourceType[];
    // Field-specific options
    sourceMaxResults?: Partial<Record<SourceType, number>>;
    sourceWeights?: Partial<Record<SourceType, number>>;
    boostKeywords?: string[];
}

const DEFAULT_OPTIONS: AggregatorOptions = {
    maxResultsPerSource: 20,
    includePsychologyFilter: false,
    sources: ['arxiv', 'openalex', 'semantic-scholar', 'pubmed', 'europe-pmc', 'doaj', 'eric', 'crossref', 'core'],
    sourceMaxResults: {},
    sourceWeights: {},
    boostKeywords: [],
};

/**
 * Generate a 2-sentence summary from abstract
 */
function generateSummary(abstract: string | null, tldr: string | null): string {
    // Prefer TLDR if available (from Semantic Scholar)
    if (tldr) {
        return tldr;
    }

    if (!abstract) {
        return 'No abstract available for this article.';
    }

    // Split into sentences and take first 2
    const sentences = abstract
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.length > 20); // Filter out very short fragments

    if (sentences.length === 0) {
        return abstract.slice(0, 300) + (abstract.length > 300 ? '...' : '');
    }

    const summary = sentences.slice(0, 2).join(' ');
    return summary.length > 400 ? summary.slice(0, 400) + '...' : summary;
}

/**
 * Generate article link based on source
 */
function getArticleLink(article: any, source: string): string {
    if (article.doi) {
        return `https://doi.org/${article.doi}`;
    }

    switch (source) {
        case 'arxiv':
            return article.id || article.link || '';
        case 'openalex':
            return article.id?.replace('https://openalex.org/', 'https://openalex.org/works/') || '';
        case 'semantic-scholar':
            return `https://www.semanticscholar.org/paper/${article.id}`;
        case 'pubmed':
            return `https://pubmed.ncbi.nlm.nih.gov/${article.id.replace('PMID:', '')}`;
        case 'psyarxiv':
            return `https://osf.io/preprints/psyarxiv/${article.id}`;
        case 'europe-pmc':
            return article.doi ? `https://doi.org/${article.doi}` : `https://europepmc.org/article/MED/${article.id}`;
        case 'doaj':
            return article.fullTextUrl || (article.doi ? `https://doi.org/${article.doi}` : `https://doaj.org/article/${article.id}`);
        case 'eric':
            return article.url || `https://eric.ed.gov/?id=${article.id}`;
        default:
            return '';
    }
}

/**
 * Convert ArXiv article to unified format
 */
function convertArxiv(article: ArxivArticle): UnifiedArticle {
    // Extract DOI from ArXiv ID if possible
    const arxivId = article.id.replace('http://arxiv.org/abs/', '');

    return {
        id: article.id,
        doi: null, // ArXiv doesn't always have DOI
        title: article.title,
        abstract: article.summary,
        summary: generateSummary(article.summary, null),
        authors: article.authors,
        published: article.published,
        year: new Date(article.published).getFullYear() || new Date().getFullYear(),
        source: 'arxiv',
        link: article.link || article.id,
        isOpenAccess: true,
        pdfUrl: article.id.replace('/abs/', '/pdf/') + '.pdf',
    };
}

/**
 * Convert OpenAlex article to unified format
 */
function convertOpenAlex(article: OpenAlexArticle): UnifiedArticle {
    return {
        id: article.id,
        doi: article.doi,
        title: article.title,
        abstract: article.abstract,
        summary: generateSummary(article.abstract, null),
        authors: article.authors,
        published: article.published,
        year: article.year,
        source: 'openalex',
        link: getArticleLink(article, 'openalex'),
        citedByCount: article.citedByCount,
        topics: article.topics,
        isOpenAccess: article.isOpenAccess,
        pdfUrl: article.pdfUrl,
    };
}

/**
 * Convert Semantic Scholar article to unified format
 */
function convertSemanticScholar(article: SemanticScholarArticle): UnifiedArticle {
    return {
        id: article.id,
        doi: article.doi,
        title: article.title,
        abstract: article.abstract,
        summary: generateSummary(article.abstract, article.tldr),
        authors: article.authors,
        published: article.published,
        year: article.year,
        source: 'semantic-scholar',
        link: getArticleLink(article, 'semantic-scholar'),
        citedByCount: article.citedByCount,
        topics: article.fieldsOfStudy,
        isOpenAccess: article.isOpenAccess,
        pdfUrl: article.pdfUrl,
        tldr: article.tldr,
    };
}

/**
 * Convert PubMed article to unified format
 */
function convertPubMed(article: PubMedArticle): UnifiedArticle {
    return {
        id: article.id,
        doi: article.doi,
        title: article.title,
        abstract: article.abstract,
        summary: generateSummary(article.abstract, null),
        authors: article.authors,
        published: article.published,
        year: article.year,
        source: 'pubmed',
        link: getArticleLink(article, 'pubmed'),
        topics: article.meshTerms,
    };
}

/**
 * Convert Europe PMC article to unified format
 */
function convertEuropePMC(article: EuropePMCArticle): UnifiedArticle {
    return {
        id: article.id,
        doi: article.doi,
        title: article.title,
        abstract: article.abstract,
        summary: generateSummary(article.abstract, null),
        authors: article.authors,
        published: article.year?.toString() || '',
        year: article.year || new Date().getFullYear(),
        source: 'europe-pmc',
        link: getArticleLink(article, 'europe-pmc'),
        citedByCount: article.citedByCount,
        isOpenAccess: article.isOpenAccess,
    };
}

/**
 * Convert DOAJ article to unified format
 */
function convertDOAJ(article: DOAJArticle): UnifiedArticle {
    return {
        id: article.id,
        doi: article.doi,
        title: article.title,
        abstract: article.abstract,
        summary: generateSummary(article.abstract, null),
        authors: article.authors,
        published: article.year?.toString() || '',
        year: article.year || new Date().getFullYear(),
        source: 'doaj',
        link: getArticleLink(article, 'doaj'),
        topics: article.keywords,
        isOpenAccess: true, // DOAJ is all open access
        pdfUrl: article.fullTextUrl,
    };
}

/**
 * Convert ERIC article to unified format
 */
function convertERIC(article: ERICArticle): UnifiedArticle {
    return {
        id: article.id,
        doi: article.doi,
        title: article.title,
        abstract: article.abstract,
        summary: generateSummary(article.abstract, null),
        authors: article.authors,
        published: article.year?.toString() || '',
        year: article.year || new Date().getFullYear(),
        source: 'eric',
        link: getArticleLink(article, 'eric'),
    };
}

/**
 * Convert CrossRef article to unified format
 */
function convertCrossRef(article: CrossRefArticle): UnifiedArticle {
    return {
        id: article.id,
        doi: article.doi,
        title: article.title,
        abstract: article.abstract,
        summary: generateSummary(article.abstract, null),
        authors: article.authors,
        published: article.year?.toString() || '',
        year: article.year || new Date().getFullYear(),
        source: 'crossref',
        link: `https://doi.org/${article.doi}`,
        citedByCount: article.citedByCount,
        isOpenAccess: article.isOpenAccess,
    };
}

/**
 * Convert CORE article to unified format
 */
function convertCORE(article: COREArticle): UnifiedArticle {
    return {
        id: article.id,
        doi: article.doi,
        title: article.title,
        abstract: article.abstract,
        summary: generateSummary(article.abstract, null),
        authors: article.authors,
        published: article.year?.toString() || '',
        year: article.year || new Date().getFullYear(),
        source: 'core',
        link: article.doi ? `https://doi.org/${article.doi}` : (article.downloadUrl || `https://core.ac.uk/works/${article.id}`),
        isOpenAccess: true, // CORE is all open access
        pdfUrl: article.downloadUrl || article.sourceFulltextUrls?.[0] || null,
    };
}

/**
 * Deduplicate articles by DOI and similar titles
 */
function deduplicateArticles(articles: UnifiedArticle[]): UnifiedArticle[] {
    const seen = new Map<string, UnifiedArticle>();
    const seenTitles = new Map<string, UnifiedArticle>();

    for (const article of articles) {
        // Check DOI first (most reliable)
        if (article.doi) {
            const normalizedDoi = article.doi.toLowerCase().trim();
            if (seen.has(normalizedDoi)) {
                // Merge: prefer article with more info
                const existing = seen.get(normalizedDoi)!;
                if (!existing.abstract && article.abstract) {
                    seen.set(normalizedDoi, { ...existing, abstract: article.abstract, summary: article.summary });
                }
                continue;
            }
            seen.set(normalizedDoi, article);
        }

        // Check normalized title for duplicates
        const normalizedTitle = article.title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 100); // First 100 chars

        if (normalizedTitle.length > 20) {
            if (seenTitles.has(normalizedTitle)) {
                continue; // Skip duplicate
            }
            seenTitles.set(normalizedTitle, article);
        }
    }

    // Combine DOI-based and title-based unique articles
    const uniqueByDoi = Array.from(seen.values());
    const uniqueByTitle = Array.from(seenTitles.values());

    // Merge, preferring DOI-matched articles
    const doiSet = new Set(uniqueByDoi.map(a => a.id));
    const titleOnlyArticles = uniqueByTitle.filter(a => !doiSet.has(a.id) && !a.doi);

    return [...uniqueByDoi, ...titleOnlyArticles];
}

/**
 * Get max results for a specific source
 */
function getMaxResults(opts: AggregatorOptions, source: SourceType): number {
    return opts.sourceMaxResults?.[source] || opts.maxResultsPerSource;
}

/**
 * Enhance query with boost keywords if provided
 */
function enhanceQuery(query: string, boostKeywords?: string[]): string {
    if (!boostKeywords || boostKeywords.length === 0) return query;
    // Add a few boost keywords to the query (not all, to avoid over-filtering)
    const keywordsToAdd = boostKeywords.slice(0, 3).join(' OR ');
    return `${query} ${keywordsToAdd}`;
}

/**
 * Search all sources and aggregate results
 */
export async function searchAllSources(
    query: string,
    options: Partial<AggregatorOptions> = {}
): Promise<UnifiedArticle[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const allArticles: UnifiedArticle[] = [];

    // Optionally enhance query with boost keywords
    const enhancedQuery = enhanceQuery(query, opts.boostKeywords);

    // Create promises for parallel fetching
    const searchPromises: Promise<void>[] = [];

    // ArXiv
    if (opts.sources.includes('arxiv')) {
        const maxResults = getMaxResults(opts, 'arxiv');
        searchPromises.push(
            searchArxiv(query, maxResults) // ArXiv uses original query (boost keywords may not work well)
                .then(articles => {
                    allArticles.push(...articles.map(convertArxiv));
                })
                .catch(err => console.error('ArXiv search failed:', err))
        );
    }

    // OpenAlex
    if (opts.sources.includes('openalex')) {
        const maxResults = getMaxResults(opts, 'openalex');
        const searchFn = opts.includePsychologyFilter ? searchOpenAlexPsychology : searchOpenAlex;
        searchPromises.push(
            searchFn(enhancedQuery, maxResults)
                .then(articles => {
                    allArticles.push(...articles.map(convertOpenAlex));
                })
                .catch(err => console.error('OpenAlex search failed:', err))
        );
    }

    // Semantic Scholar
    if (opts.sources.includes('semantic-scholar')) {
        const maxResults = getMaxResults(opts, 'semantic-scholar');
        const searchFn = opts.includePsychologyFilter ? searchSemanticScholarPsychology : searchSemanticScholar;
        searchPromises.push(
            searchFn(enhancedQuery, maxResults)
                .then(articles => {
                    allArticles.push(...articles.map(convertSemanticScholar));
                })
                .catch(err => console.error('Semantic Scholar search failed:', err))
        );
    }

    // PubMed
    if (opts.sources.includes('pubmed')) {
        const maxResults = getMaxResults(opts, 'pubmed');
        const searchFn = opts.includePsychologyFilter ? searchPubMedPsychology : searchPubMed;
        searchPromises.push(
            searchFn(enhancedQuery, maxResults)
                .then(articles => {
                    allArticles.push(...articles.map(convertPubMed));
                })
                .catch(err => console.error('PubMed search failed:', err))
        );
    }

    // Europe PMC (strong for behavioral/health psychology)
    if (opts.sources.includes('europe-pmc')) {
        const maxResults = getMaxResults(opts, 'europe-pmc');
        const searchFn = opts.includePsychologyFilter ? searchEuropePMCPsychology : searchEuropePMC;
        searchPromises.push(
            searchFn(enhancedQuery, maxResults)
                .then(articles => {
                    allArticles.push(...articles.map(convertEuropePMC));
                })
                .catch(err => console.error('Europe PMC search failed:', err))
        );
    }

    // DOAJ (open access psychology journals)
    if (opts.sources.includes('doaj')) {
        const maxResults = getMaxResults(opts, 'doaj');
        const searchFn = opts.includePsychologyFilter ? searchDOAJPsychology : searchDOAJ;
        searchPromises.push(
            searchFn(enhancedQuery, maxResults)
                .then(articles => {
                    allArticles.push(...articles.map(convertDOAJ));
                })
                .catch(err => console.error('DOAJ search failed:', err))
        );
    }

    // ERIC (educational psychology)
    if (opts.sources.includes('eric')) {
        const maxResults = getMaxResults(opts, 'eric');
        const searchFn = opts.includePsychologyFilter ? searchERICPsychology : searchERIC;
        searchPromises.push(
            searchFn(enhancedQuery, maxResults)
                .then(articles => {
                    allArticles.push(...articles.map(convertERIC));
                })
                .catch(err => console.error('ERIC search failed:', err))
        );
    }

    // CrossRef (business, marketing, interdisciplinary)
    if (opts.sources.includes('crossref')) {
        const maxResults = getMaxResults(opts, 'crossref');
        // Use business-focused search when not psychology filter (business fields)
        const searchFn = opts.includePsychologyFilter ? searchCrossRef : searchCrossRefBusiness;
        searchPromises.push(
            searchFn(enhancedQuery, maxResults)
                .then(articles => {
                    allArticles.push(...articles.map(convertCrossRef));
                })
                .catch(err => console.error('CrossRef search failed:', err))
        );
    }

    // CORE (largest open access aggregator - 431M+ papers)
    if (opts.sources.includes('core')) {
        const maxResults = getMaxResults(opts, 'core');
        // Use field-specific search variants
        let searchFn = searchCORE;
        if (opts.includePsychologyFilter) {
            searchFn = searchCOREPsychology;
        } else if (opts.boostKeywords?.some(k =>
            ['business', 'marketing', 'management', 'economics', 'finance'].includes(k.toLowerCase())
        )) {
            searchFn = searchCOREBusiness;
        }
        searchPromises.push(
            searchFn(enhancedQuery, maxResults)
                .then(articles => {
                    allArticles.push(...articles.map(convertCORE));
                })
                .catch(err => console.error('CORE search failed:', err))
        );
    }

    // Wait for all sources (with timeout)
    await Promise.allSettled(searchPromises);

    // Deduplicate and return
    return deduplicateArticles(allArticles);
}

/**
 * Search specifically for psychology-related articles
 */
export async function searchPsychologyArticles(
    query: string,
    maxResultsPerSource: number = 30
): Promise<UnifiedArticle[]> {
    return searchAllSources(query, {
        maxResultsPerSource,
        includePsychologyFilter: true,
        sources: ['openalex', 'semantic-scholar', 'pubmed', 'arxiv'],
    });
}

/**
 * Get source display name
 */
export function getSourceDisplayName(source: string): string {
    switch (source) {
        case 'arxiv': return 'ArXiv';
        case 'openalex': return 'OpenAlex';
        case 'semantic-scholar': return 'Semantic Scholar';
        case 'pubmed': return 'PubMed';
        case 'psyarxiv': return 'PsyArXiv';
        case 'europe-pmc': return 'Europe PMC';
        case 'doaj': return 'DOAJ';
        case 'eric': return 'ERIC';
        case 'crossref': return 'CrossRef';
        case 'core': return 'CORE';
        default: return source;
    }
}

/**
 * Get source color for UI badges
 */
export function getSourceColor(source: string): string {
    switch (source) {
        case 'arxiv': return 'bg-orange-100 text-orange-700 border-orange-200';
        case 'openalex': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'semantic-scholar': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'pubmed': return 'bg-green-100 text-green-700 border-green-200';
        case 'psyarxiv': return 'bg-pink-100 text-pink-700 border-pink-200';
        case 'europe-pmc': return 'bg-teal-100 text-teal-700 border-teal-200';
        case 'doaj': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'eric': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        case 'crossref': return 'bg-rose-100 text-rose-700 border-rose-200';
        case 'core': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
        default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
}
