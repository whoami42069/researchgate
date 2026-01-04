/**
 * Research Field Configuration
 * Defines database priorities, weights, keywords, and exclusions per field
 * Based on agent analysis of 7 databases x 13 fields
 */

// Available data sources
export type DataSource = 'arxiv' | 'openalex' | 'semantic-scholar' | 'pubmed' | 'europe-pmc' | 'doaj' | 'eric' | 'crossref' | 'core';

// Research field identifiers
export type ResearchField =
    | 'health-psychology'
    | 'clinical-psychology'
    | 'social-psychology'
    | 'cognitive-psychology'
    | 'developmental-psychology'
    | 'neuroscience'
    | 'psychiatry'
    | 'behavioral-science'
    | 'public-health'
    | 'medicine'
    | 'education'
    | 'computer-science'
    | 'economics'
    | 'marketing'
    | 'business'
    | 'management';

// Field cluster for shared configurations
export type FieldCluster = 'clinical-medical' | 'cognitive-behavioral' | 'stem' | 'education' | 'business';

// Configuration for each field
export interface FieldConfig {
    cluster: FieldCluster;
    displayName: string;
    // Sources to query (in priority order)
    sources: DataSource[];
    // Weight multiplier for each source (higher = more important)
    sourceWeights: Partial<Record<DataSource, number>>;
    // Max results to fetch per source
    maxResultsPerSource: Partial<Record<DataSource, number>>;
    // Keywords to boost in search queries
    boostKeywords: string[];
    // Whether to enable psychology-specific filters
    psychologyFilter: boolean;
}

// Default max results per source
const DEFAULT_MAX_RESULTS = 20;

/**
 * Field-specific search configurations
 * Based on agent analysis of database coverage and field requirements
 */
export const FIELD_CONFIGS: Record<ResearchField, FieldConfig> = {
    // ============================================
    // CLINICAL/MEDICAL CLUSTER
    // Primary: PubMed, Europe PMC
    // Exclude: ArXiv, ERIC
    // ============================================

    'health-psychology': {
        cluster: 'clinical-medical',
        displayName: 'Health Psychology',
        sources: ['pubmed', 'semantic-scholar', 'europe-pmc', 'openalex', 'core', 'doaj'],
        sourceWeights: {
            'pubmed': 2.0,
            'semantic-scholar': 1.5,
            'europe-pmc': 1.4,
            'openalex': 1.0,
            'core': 0.8,
            'doaj': 0.8,
        },
        maxResultsPerSource: {
            'pubmed': 30,
            'semantic-scholar': 25,
            'europe-pmc': 20,
            'openalex': 15,
            'core': 15,
            'doaj': 10,
        },
        boostKeywords: [
            'health behavior', 'behavioral medicine', 'chronic illness',
            'patient adherence', 'health intervention', 'psychosomatic',
            'stress coping', 'health promotion', 'illness perception'
        ],
        psychologyFilter: true,
    },

    'clinical-psychology': {
        cluster: 'clinical-medical',
        displayName: 'Clinical Psychology',
        sources: ['pubmed', 'europe-pmc', 'semantic-scholar', 'openalex', 'core', 'doaj'],
        sourceWeights: {
            'pubmed': 2.0,
            'europe-pmc': 1.6,
            'semantic-scholar': 1.4,
            'openalex': 1.0,
            'core': 0.8,
            'doaj': 0.8,
        },
        maxResultsPerSource: {
            'pubmed': 35,
            'europe-pmc': 25,
            'semantic-scholar': 20,
            'openalex': 15,
            'core': 15,
            'doaj': 10,
        },
        boostKeywords: [
            'psychotherapy', 'CBT', 'cognitive behavioral therapy',
            'treatment outcome', 'clinical trial', 'mental disorder',
            'diagnostic criteria', 'therapeutic intervention', 'evidence-based treatment'
        ],
        psychologyFilter: true,
    },

    'psychiatry': {
        cluster: 'clinical-medical',
        displayName: 'Psychiatry',
        sources: ['pubmed', 'europe-pmc', 'semantic-scholar', 'openalex', 'core', 'doaj'],
        sourceWeights: {
            'pubmed': 2.0,
            'europe-pmc': 1.7,
            'semantic-scholar': 1.3,
            'openalex': 1.0,
            'core': 0.8,
            'doaj': 0.7,
        },
        maxResultsPerSource: {
            'pubmed': 35,
            'europe-pmc': 25,
            'semantic-scholar': 20,
            'openalex': 15,
            'core': 15,
            'doaj': 10,
        },
        boostKeywords: [
            'psychiatric disorder', 'antipsychotic', 'psychopharmacology',
            'schizophrenia', 'bipolar', 'major depression',
            'anxiety disorder', 'PTSD', 'psychiatric treatment'
        ],
        psychologyFilter: true,
    },

    'neuroscience': {
        cluster: 'clinical-medical',
        displayName: 'Neuroscience',
        sources: ['pubmed', 'arxiv', 'semantic-scholar', 'europe-pmc', 'openalex', 'core'],
        sourceWeights: {
            'pubmed': 2.0,
            'arxiv': 1.5,  // ArXiv has computational neuroscience
            'semantic-scholar': 1.4,
            'europe-pmc': 1.3,
            'openalex': 1.0,
            'core': 0.8,
        },
        maxResultsPerSource: {
            'pubmed': 30,
            'arxiv': 20,
            'semantic-scholar': 20,
            'europe-pmc': 15,
            'openalex': 15,
            'core': 15,
        },
        boostKeywords: [
            'neuroimaging', 'fMRI', 'EEG', 'neural circuit',
            'synaptic plasticity', 'neurotransmitter', 'brain connectivity',
            'cognitive neuroscience', 'neurodegeneration'
        ],
        psychologyFilter: false,
    },

    'public-health': {
        cluster: 'clinical-medical',
        displayName: 'Public Health',
        sources: ['pubmed', 'europe-pmc', 'openalex', 'semantic-scholar', 'core', 'doaj'],
        sourceWeights: {
            'pubmed': 2.0,
            'europe-pmc': 1.6,
            'openalex': 1.2,
            'semantic-scholar': 1.0,
            'core': 0.8,
            'doaj': 0.9,
        },
        maxResultsPerSource: {
            'pubmed': 35,
            'europe-pmc': 25,
            'openalex': 20,
            'semantic-scholar': 15,
            'core': 15,
            'doaj': 15,
        },
        boostKeywords: [
            'epidemiology', 'disease prevention', 'health policy',
            'population health', 'health disparities', 'vaccination',
            'public health intervention', 'health surveillance'
        ],
        psychologyFilter: false,
    },

    'medicine': {
        cluster: 'clinical-medical',
        displayName: 'Medicine',
        sources: ['pubmed', 'europe-pmc', 'semantic-scholar', 'openalex', 'core', 'doaj'],
        sourceWeights: {
            'pubmed': 2.0,
            'europe-pmc': 1.8,
            'semantic-scholar': 1.2,
            'openalex': 1.0,
            'core': 0.8,
            'doaj': 0.8,
        },
        maxResultsPerSource: {
            'pubmed': 40,
            'europe-pmc': 30,
            'semantic-scholar': 20,
            'openalex': 15,
            'core': 15,
            'doaj': 10,
        },
        boostKeywords: [
            'clinical diagnosis', 'treatment efficacy', 'randomized controlled trial',
            'drug therapy', 'surgical intervention', 'patient outcome',
            'clinical guideline', 'meta-analysis'
        ],
        psychologyFilter: false,
    },

    // ============================================
    // COGNITIVE/BEHAVIORAL CLUSTER
    // Primary: OpenAlex, Semantic Scholar, PubMed
    // Exclude: ArXiv
    // ============================================

    'cognitive-psychology': {
        cluster: 'cognitive-behavioral',
        displayName: 'Cognitive Psychology',
        sources: ['semantic-scholar', 'pubmed', 'openalex', 'europe-pmc', 'core', 'doaj'],
        sourceWeights: {
            'semantic-scholar': 1.8,
            'pubmed': 1.6,
            'openalex': 1.4,
            'europe-pmc': 1.0,
            'core': 0.8,
            'doaj': 0.8,
        },
        maxResultsPerSource: {
            'semantic-scholar': 30,
            'pubmed': 25,
            'openalex': 20,
            'europe-pmc': 15,
            'core': 15,
            'doaj': 10,
        },
        boostKeywords: [
            'working memory', 'attention', 'cognitive load',
            'decision making', 'perception', 'executive function',
            'language processing', 'cognitive bias', 'metacognition'
        ],
        psychologyFilter: true,
    },

    'social-psychology': {
        cluster: 'cognitive-behavioral',
        displayName: 'Social Psychology',
        sources: ['openalex', 'semantic-scholar', 'pubmed', 'europe-pmc', 'core', 'doaj'],
        sourceWeights: {
            'openalex': 1.8,
            'semantic-scholar': 1.5,
            'pubmed': 1.2,
            'europe-pmc': 1.0,
            'core': 0.8,
            'doaj': 0.9,
        },
        maxResultsPerSource: {
            'openalex': 30,
            'semantic-scholar': 25,
            'pubmed': 15,
            'europe-pmc': 15,
            'core': 15,
            'doaj': 15,
        },
        boostKeywords: [
            'social influence', 'group dynamics', 'intergroup relations',
            'prejudice', 'social identity', 'prosocial behavior',
            'attitude change', 'conformity', 'social cognition'
        ],
        psychologyFilter: true,
    },

    'developmental-psychology': {
        cluster: 'cognitive-behavioral',
        displayName: 'Developmental Psychology',
        sources: ['openalex', 'pubmed', 'semantic-scholar', 'eric', 'europe-pmc', 'core', 'doaj'],
        sourceWeights: {
            'openalex': 1.7,
            'pubmed': 1.5,
            'semantic-scholar': 1.3,
            'eric': 1.2,
            'europe-pmc': 1.0,
            'core': 0.8,
            'doaj': 0.8,
        },
        maxResultsPerSource: {
            'openalex': 25,
            'pubmed': 20,
            'semantic-scholar': 20,
            'eric': 15,
            'europe-pmc': 15,
            'core': 15,
            'doaj': 10,
        },
        boostKeywords: [
            'child development', 'adolescent development', 'attachment',
            'developmental milestone', 'parenting', 'cognitive development',
            'lifespan development', 'developmental trajectory'
        ],
        psychologyFilter: true,
    },

    'behavioral-science': {
        cluster: 'cognitive-behavioral',
        displayName: 'Behavioral Science',
        sources: ['openalex', 'pubmed', 'semantic-scholar', 'europe-pmc', 'core', 'doaj'],
        sourceWeights: {
            'openalex': 1.7,
            'pubmed': 1.5,
            'semantic-scholar': 1.4,
            'europe-pmc': 1.2,
            'core': 0.8,
            'doaj': 0.9,
        },
        maxResultsPerSource: {
            'openalex': 30,
            'pubmed': 25,
            'semantic-scholar': 20,
            'europe-pmc': 15,
            'core': 15,
            'doaj': 10,
        },
        boostKeywords: [
            'behavior change', 'behavioral intervention', 'habit formation',
            'behavioral economics', 'nudge', 'decision behavior',
            'behavioral risk', 'conditioning', 'reinforcement'
        ],
        psychologyFilter: true,
    },

    // ============================================
    // STEM CLUSTER
    // Primary: ArXiv, Semantic Scholar
    // Exclude: PubMed, ERIC, Europe PMC
    // ============================================

    'computer-science': {
        cluster: 'stem',
        displayName: 'Computer Science',
        sources: ['arxiv', 'semantic-scholar', 'openalex', 'doaj'],
        sourceWeights: {
            'arxiv': 2.0,
            'semantic-scholar': 1.8,
            'openalex': 1.2,
            'doaj': 0.8,
        },
        maxResultsPerSource: {
            'arxiv': 35,
            'semantic-scholar': 30,
            'openalex': 25,
            'doaj': 15,
        },
        boostKeywords: [
            'machine learning', 'deep learning', 'neural network',
            'algorithm', 'artificial intelligence', 'NLP',
            'computer vision', 'software engineering', 'distributed systems'
        ],
        psychologyFilter: false,
    },

    'economics': {
        cluster: 'stem',
        displayName: 'Economics',
        sources: ['openalex', 'semantic-scholar', 'doaj', 'arxiv'],
        sourceWeights: {
            'openalex': 1.8,
            'semantic-scholar': 1.5,
            'doaj': 1.2,
            'arxiv': 1.0,  // ArXiv has some quantitative economics
        },
        maxResultsPerSource: {
            'openalex': 30,
            'semantic-scholar': 25,
            'doaj': 20,
            'arxiv': 15,
        },
        boostKeywords: [
            'econometrics', 'microeconomics', 'macroeconomics',
            'behavioral economics', 'labor economics', 'monetary policy',
            'economic growth', 'market analysis', 'causal inference'
        ],
        psychologyFilter: false,
    },

    // ============================================
    // EDUCATION CLUSTER
    // Primary: ERIC (mandatory), OpenAlex
    // Exclude: ArXiv
    // ============================================

    'education': {
        cluster: 'education',
        displayName: 'Education',
        sources: ['eric', 'openalex', 'semantic-scholar', 'core', 'doaj', 'pubmed'],
        sourceWeights: {
            'eric': 2.0,  // ERIC is mandatory for education
            'openalex': 1.5,
            'semantic-scholar': 1.2,
            'core': 0.9,
            'doaj': 1.0,
            'pubmed': 0.8,  // Only for health education
        },
        maxResultsPerSource: {
            'eric': 35,
            'openalex': 25,
            'semantic-scholar': 20,
            'core': 15,
            'doaj': 15,
            'pubmed': 10,
        },
        boostKeywords: [
            'educational outcome', 'teaching method', 'curriculum',
            'student achievement', 'learning assessment', 'pedagogy',
            'educational technology', 'teacher training', 'classroom instruction'
        ],
        psychologyFilter: false,
    },

    // ============================================
    // BUSINESS CLUSTER
    // Primary: OpenAlex, Semantic Scholar, CrossRef
    // Good for: Marketing, Management, Business Strategy
    // ============================================

    'marketing': {
        cluster: 'business',
        displayName: 'Marketing',
        sources: ['openalex', 'semantic-scholar', 'crossref', 'core', 'doaj'],
        sourceWeights: {
            'openalex': 1.8,
            'semantic-scholar': 1.7,
            'crossref': 1.5,
            'core': 1.4,
            'doaj': 1.2,
        },
        maxResultsPerSource: {
            'openalex': 30,
            'semantic-scholar': 30,
            'crossref': 25,
            'core': 25,
            'doaj': 15,
        },
        boostKeywords: [
            'consumer behavior', 'brand management', 'digital marketing',
            'marketing strategy', 'customer experience', 'market research',
            'advertising effectiveness', 'social media marketing', 'brand equity',
            'customer satisfaction', 'purchase intention', 'marketing communication'
        ],
        psychologyFilter: false,
    },

    'business': {
        cluster: 'business',
        displayName: 'Business',
        sources: ['openalex', 'semantic-scholar', 'crossref', 'core', 'doaj'],
        sourceWeights: {
            'openalex': 1.8,
            'semantic-scholar': 1.6,
            'crossref': 1.4,
            'core': 1.3,
            'doaj': 1.2,
        },
        maxResultsPerSource: {
            'openalex': 30,
            'semantic-scholar': 25,
            'crossref': 25,
            'core': 25,
            'doaj': 15,
        },
        boostKeywords: [
            'business strategy', 'corporate governance', 'entrepreneurship',
            'organizational performance', 'competitive advantage', 'business model',
            'firm performance', 'strategic management', 'corporate social responsibility',
            'innovation management', 'business ethics', 'stakeholder'
        ],
        psychologyFilter: false,
    },

    'management': {
        cluster: 'business',
        displayName: 'Management',
        sources: ['openalex', 'semantic-scholar', 'crossref', 'core', 'doaj'],
        sourceWeights: {
            'openalex': 1.8,
            'semantic-scholar': 1.6,
            'crossref': 1.5,
            'core': 1.3,
            'doaj': 1.2,
        },
        maxResultsPerSource: {
            'openalex': 30,
            'semantic-scholar': 25,
            'crossref': 25,
            'core': 25,
            'doaj': 15,
        },
        boostKeywords: [
            'leadership', 'organizational behavior', 'human resource management',
            'employee engagement', 'change management', 'knowledge management',
            'team performance', 'decision making', 'organizational culture',
            'talent management', 'work motivation', 'project management'
        ],
        psychologyFilter: false,
    },
};

/**
 * Default configuration for unspecified fields
 * Uses balanced approach across all sources
 */
export const DEFAULT_FIELD_CONFIG: FieldConfig = {
    cluster: 'cognitive-behavioral',
    displayName: 'General Research',
    sources: ['openalex', 'semantic-scholar', 'pubmed', 'arxiv', 'europe-pmc', 'doaj', 'eric', 'crossref', 'core'],
    sourceWeights: {
        'openalex': 1.2,
        'semantic-scholar': 1.2,
        'pubmed': 1.0,
        'arxiv': 1.0,
        'europe-pmc': 1.0,
        'crossref': 1.0,
        'core': 1.0,
        'doaj': 0.9,
        'eric': 0.9,
    },
    maxResultsPerSource: {
        'openalex': 20,
        'semantic-scholar': 20,
        'pubmed': 20,
        'arxiv': 15,
        'europe-pmc': 15,
        'crossref': 15,
        'core': 20,
        'doaj': 15,
        'eric': 15,
    },
    boostKeywords: [],
    psychologyFilter: false,
};

/**
 * Get configuration for a specific field
 */
export function getFieldConfig(field: string | null | undefined): FieldConfig {
    if (!field) return DEFAULT_FIELD_CONFIG;
    return FIELD_CONFIGS[field as ResearchField] || DEFAULT_FIELD_CONFIG;
}

/**
 * Get display name for a field
 */
export function getFieldDisplayName(field: string | null | undefined): string {
    if (!field) return 'All Fields';
    return FIELD_CONFIGS[field as ResearchField]?.displayName || 'All Fields';
}

/**
 * Get source weight for relevancy scoring
 */
export function getSourceWeight(field: string | null | undefined, source: DataSource): number {
    const config = getFieldConfig(field);
    return config.sourceWeights[source] || 1.0;
}

/**
 * Get max results for a specific source in a field
 */
export function getMaxResultsForSource(field: string | null | undefined, source: DataSource): number {
    const config = getFieldConfig(field);
    return config.maxResultsPerSource[source] || DEFAULT_MAX_RESULTS;
}

/**
 * Check if a source should be included for a field
 */
export function isSourceIncluded(field: string | null | undefined, source: DataSource): boolean {
    const config = getFieldConfig(field);
    return config.sources.includes(source);
}

/**
 * Get boost keywords for a field
 */
export function getBoostKeywords(field: string | null | undefined): string[] {
    const config = getFieldConfig(field);
    return config.boostKeywords;
}
