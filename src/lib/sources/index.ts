/**
 * Multi-Source Academic Article Search
 * Exports all source clients and the unified aggregator
 */

// Individual source clients
export { searchOpenAlex, searchOpenAlexPsychology, PSYCHOLOGY_TOPICS, type OpenAlexArticle } from './openalex';
export { searchSemanticScholar, searchSemanticScholarPsychology, PSYCHOLOGY_FIELDS, type SemanticScholarArticle } from './semantic-scholar';
export { searchPubMed, searchPubMedPsychology, PSYCHOLOGY_MESH_TERMS, type PubMedArticle } from './pubmed';
export { searchPsyArXiv, type PsyArXivArticle } from './psyarxiv';

// Additional psychology-focused sources
export { searchEuropePMC, searchEuropePMCPsychology, PSYCHOLOGY_TERMS, type EuropePMCArticle } from './europe-pmc';
export { searchDOAJ, searchDOAJPsychology, PSYCHOLOGY_KEYWORDS, type DOAJArticle } from './doaj';
export { searchERIC, searchERICPsychology, EDUCATIONAL_PSYCHOLOGY_TERMS, type ERICArticle } from './eric';

// Business/Marketing focused source
export { searchCrossRef, searchCrossRefBusiness, BUSINESS_KEYWORDS, type CrossRefArticle } from './crossref';

// CORE - largest open access aggregator (431M+ papers)
export { searchCORE, searchCOREBusiness, searchCOREPsychology, type COREArticle } from './core';

// Unified aggregator
export {
    searchAllSources,
    searchPsychologyArticles,
    getSourceDisplayName,
    getSourceColor,
    type UnifiedArticle,
    type AggregatorOptions,
    type SourceType,
} from './aggregator';
