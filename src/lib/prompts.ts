// ============================================================================
// RESEARCH DISCOVERY PLATFORM - MULTI-AGENT PROMPTS
// Designed by: prompt-engineer + ai-engineer agents (Jan 2026)
// Pattern: Dual-LLM Query Generation + DeepSeek Filter + GPT-mini Scoring
// ============================================================================

import { tokenizeForRelevancy, jaccardSimilarity } from "@/lib/text-utils";

// ============================================================================
// QUERY GENERATION PROMPT (GPT-4o-mini) - Enhanced with few-shot examples
// ============================================================================

export const QUERY_GENERATION_SYSTEM_PROMPT = `You are an expert academic research librarian specializing in systematic review search strategy design. Your task is to generate highly effective AND DIVERSE search queries for academic databases.

## CRITICAL: DIVERSITY REQUIREMENTS

### MANDATORY DIVERSITY RULES
Each query MUST target a DIFFERENT DIMENSION. Never generate queries that are just rephrased versions of each other.

**The 4 dimensions you MUST cover:**
1. **CORE TOPIC** - Direct terminology for the main research question
2. **MECHANISM/THEORY** - Underlying processes, mechanisms, or theoretical frameworks
3. **CONTEXT/APPLICATION** - Settings, populations, or practical applications
4. **METHODOLOGY/EVIDENCE** - Study designs, measurement approaches, or evidence types

### DIVERSITY SELF-CHECK
Before outputting, verify that:
- NO two queries share more than 50% of their key terms
- Each query would likely return DIFFERENT sets of articles
- Queries cover different "angles" of the research topic
- At least one query uses terminology from adjacent/related fields

### EXAMPLES OF BAD (REDUNDANT) QUERIES:
❌ "stress coping adolescents" + "teen stress management" + "youth stress coping strategies"
   (All 3 are essentially the same search with synonyms)

### EXAMPLES OF GOOD (DIVERSE) QUERIES:
✓ "stress coping adolescents" (core topic)
✓ "emotion regulation developing brain prefrontal cortex" (mechanism)
✓ "school-based mental health intervention high school" (context)
✓ "resilience protective factors longitudinal cohort study" (methodology)

## QUERY GENERATION PRINCIPLES

### 1. COVERAGE STRATEGY
Generate queries that maximize recall while maintaining precision:
- BROAD query: Captures the general topic area with common terms
- SPECIFIC query: Targets the exact research question with precise terminology
- ALTERNATIVE query: Uses synonyms, related terms, or different conceptual framings
- METHODOLOGICAL query: Focuses on study design or methodology aspects

### 2. ACADEMIC SEARCH BEST PRACTICES
- Use exact phrases in quotes for multi-word concepts: "cognitive behavioral therapy"
- Include both acronyms AND full terms: CBT OR "cognitive behavioral therapy"
- Include population qualifiers: adults, elderly, pediatric, adolescents
- Include study design terms when relevant: RCT, meta-analysis, longitudinal, qualitative
- Use truncation mentally (the APIs handle this): treat "adult" as matching "adults"

### 3. TERMINOLOGY EXPANSION
For each core concept, consider:
- British vs American spelling (behaviour/behavior, randomised/randomized)
- Historical vs current terminology
- Related but distinct constructs that might be relevant
- Field-specific jargon vs lay terms

### 4. WHAT MAKES A BAD QUERY
- Too generic: "psychology research" (millions of results)
- Too narrow: "CBT for GAD in 45-50 year old women in urban UK" (zero results)
- Redundant terms: repeating the same concept multiple ways
- Missing key concepts: forgetting population, intervention, or outcome
- TOO SIMILAR to another query you're generating

## OUTPUT FORMAT
Return ONLY valid JSON:
{
  "searchQueries": [
    "CORE TOPIC query",
    "MECHANISM/THEORY query",
    "CONTEXT/APPLICATION query",
    "METHODOLOGY/EVIDENCE query"
  ]
}`;

export const QUERY_GENERATION_FEW_SHOT = `## CALIBRATION EXAMPLES (Showing Diversity Dimensions)

### Example 1: Clinical Psychology Research
Research Context: "Effectiveness of cognitive behavioral therapy for generalized anxiety disorder in adults"
Field: Clinical Psychology

OUTPUT:
{
  "searchQueries": [
    "cognitive behavioral therapy generalized anxiety disorder adults CBT GAD",
    "cognitive restructuring worry reduction amygdala prefrontal regulation",
    "outpatient anxiety treatment primary care psychiatric clinic",
    "CBT anxiety randomized controlled trial meta-analysis effect size"
  ]
}
Note: Query 1=core topic, Query 2=mechanism (brain), Query 3=context (settings), Query 4=methodology

### Example 2: Health Psychology Research
Research Context: "Impact of stress management interventions on cardiovascular health outcomes"
Field: Health Psychology

OUTPUT:
{
  "searchQueries": [
    "stress management intervention cardiovascular health outcomes",
    "cortisol HPA axis inflammation atherosclerosis psychoneuroimmunology",
    "workplace stress reduction program employee cardiac risk",
    "stress intervention blood pressure heart rate variability RCT prospective"
  ]
}
Note: Query 1=core topic, Query 2=mechanism (biological), Query 3=context (workplace), Query 4=methodology

### Example 3: Education Research
Research Context: "Effects of formative assessment feedback on student motivation in secondary education"
Field: Education

OUTPUT:
{
  "searchQueries": [
    "formative assessment feedback student motivation secondary school",
    "self-determination theory autonomy competence intrinsic motivation",
    "classroom assessment practice teacher feedback high school adolescent",
    "formative evaluation achievement quasi-experimental longitudinal growth"
  ]
}
Note: Query 1=core topic, Query 2=mechanism (SDT theory), Query 3=context (classroom), Query 4=methodology

### Example 4: Neuroscience Research
Research Context: "Neural mechanisms of working memory decline in healthy aging"
Field: Neuroscience

OUTPUT:
{
  "searchQueries": [
    "working memory decline healthy aging neural mechanisms",
    "prefrontal cortex dopamine white matter integrity cognitive aging",
    "older adults executive function laboratory neuropsychological assessment",
    "working memory fMRI longitudinal structural MRI lifespan trajectory"
  ]
}
Note: Query 1=core topic, Query 2=mechanism (neurotransmitter/structure), Query 3=context (assessment), Query 4=methodology`;

// Field-specific query guidance
const FIELD_QUERY_GUIDANCE: Record<string, { tips: string; sources: string }> = {
    'health-psychology': {
        tips: `Consider including:
- Health behavior terms: adherence, self-management, coping
- Intervention types: behavioral intervention, health promotion, psychoeducation
- Outcome measures: quality of life, health outcomes, wellbeing
- Biopsychosocial terminology`,
        sources: 'PubMed, Semantic Scholar, Europe PMC'
    },
    'clinical-psychology': {
        tips: `Consider including:
- Diagnostic terminology: disorder names, symptom clusters
- Therapy modalities: CBT, DBT, ACT, psychodynamic, EMDR
- Study design terms: RCT, clinical trial, treatment outcome
- Severity/population: severe, treatment-resistant, outpatient`,
        sources: 'PubMed, Europe PMC, Semantic Scholar'
    },
    'social-psychology': {
        tips: `Consider including:
- Social phenomena: attitudes, prejudice, conformity, identity
- Experimental terms: manipulation, prime, between-subjects
- Measurement: implicit, explicit, self-report, behavioral
- Contexts: group, intergroup, interpersonal`,
        sources: 'OpenAlex, Semantic Scholar, PubMed'
    },
    'cognitive-psychology': {
        tips: `Consider including:
- Cognitive processes: attention, memory, perception, decision-making
- Paradigms: Stroop, n-back, lexical decision
- Measures: reaction time, accuracy, ERP, eye-tracking
- Populations: healthy adults, experts, novices`,
        sources: 'Semantic Scholar, PubMed, OpenAlex'
    },
    'neuroscience': {
        tips: `Consider including:
- Neuroimaging: fMRI, EEG, MEG, PET, MRI
- Brain regions: prefrontal, hippocampus, amygdala
- Mechanisms: connectivity, activation, plasticity
- Methods: resting-state, task-based, structural`,
        sources: 'PubMed, ArXiv, Semantic Scholar'
    },
    'education': {
        tips: `Consider including:
- Educational levels: K-12, secondary, higher education, undergraduate
- Pedagogical terms: scaffolding, differentiation, formative
- Outcomes: achievement, engagement, retention, transfer
- Contexts: classroom, online, blended`,
        sources: 'ERIC, OpenAlex, Semantic Scholar'
    },
    'computer-science': {
        tips: `Consider including:
- Technical terms: algorithm, neural network, transformer, model
- Methodology: supervised, unsupervised, fine-tuning, pre-training
- Benchmarks: dataset names, evaluation metrics
- Applications: NLP, vision, robotics`,
        sources: 'ArXiv, Semantic Scholar, OpenAlex'
    },
    'marketing': {
        tips: `Consider including:
- Marketing concepts: consumer behavior, brand, advertising
- Channels: digital, social media, e-commerce
- Metrics: purchase intention, loyalty, satisfaction
- Methods: survey, experiment, qualitative`,
        sources: 'OpenAlex, Semantic Scholar, CrossRef, CORE'
    },
    'business': {
        tips: `Consider including:
- Business concepts: strategy, performance, governance
- Contexts: SME, multinational, startup
- Outcomes: profitability, growth, sustainability
- Methods: case study, quantitative, panel data`,
        sources: 'OpenAlex, Semantic Scholar, CrossRef, CORE'
    },
};

// Common academic term variations for concept anchoring
const CONCEPT_VARIATIONS: Record<string, string[]> = {
    'stress': ['psychological stress', 'work stress', 'occupational stress', 'job strain', 'stress response', 'stressor'],
    'anxiety': ['anxiety disorder', 'anxious', 'generalized anxiety', 'social anxiety', 'anxiety symptoms', 'worry'],
    'depression': ['depressive disorder', 'depressive symptoms', 'major depression', 'MDD', 'depressed', 'mood disorder'],
    'mindfulness': ['mindfulness-based', 'MBSR', 'MBCT', 'meditation', 'present-moment awareness', 'contemplative'],
    'wellbeing': ['well-being', 'wellness', 'psychological wellbeing', 'subjective wellbeing', 'mental health'],
    'resilience': ['psychological resilience', 'stress resilience', 'adaptive coping', 'hardiness', 'post-traumatic growth'],
    'coping': ['coping strategies', 'coping mechanisms', 'coping skills', 'adaptive coping', 'stress coping'],
    'trauma': ['traumatic stress', 'PTSD', 'post-traumatic', 'psychological trauma', 'adverse experiences'],
    'cognition': ['cognitive function', 'cognitive performance', 'cognitive ability', 'executive function', 'memory'],
    'emotion': ['emotional regulation', 'affect', 'affective', 'emotional processing', 'mood'],
    'motivation': ['intrinsic motivation', 'extrinsic motivation', 'self-determination', 'goal', 'drive'],
    'learning': ['educational', 'academic achievement', 'student learning', 'knowledge acquisition', 'skill development'],
    'behavior': ['behavioural', 'behavior change', 'health behavior', 'behavioral intervention'],
    'intervention': ['treatment', 'therapy', 'program', 'training', 'psychotherapy'],
    'adolescent': ['teenager', 'youth', 'young people', 'teen', 'juvenile', 'high school'],
    'children': ['pediatric', 'childhood', 'child development', 'paediatric', 'kids'],
    'elderly': ['older adults', 'aging', 'geriatric', 'seniors', 'aged'],
};

/**
 * Generate suggested variations for a concept anchor
 */
function getSuggestedVariations(anchor: string): string[] {
    const normalized = anchor.toLowerCase().trim();

    // Check direct match
    if (CONCEPT_VARIATIONS[normalized]) {
        return CONCEPT_VARIATIONS[normalized];
    }

    // Check partial matches
    for (const [key, variations] of Object.entries(CONCEPT_VARIATIONS)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return variations;
        }
    }

    // Generate basic variations if no match
    return [
        `${anchor} research`,
        `${anchor} study`,
        `${anchor} intervention`,
        `${anchor} outcomes`,
    ];
}

/**
 * Build field-aware query generation prompt with optional concept anchor
 */
export function buildQueryGenerationPrompt(
    researchContext: string,
    researchField: string | null,
    boostKeywords: string[],
    conceptAnchor: string | null = null,
    selectedVariations: string[] = []
): { systemPrompt: string; userPrompt: string; suggestedVariations: string[] } {
    const fieldGuidance = FIELD_QUERY_GUIDANCE[researchField || ''] || {
        tips: 'Generate queries appropriate for your research domain.',
        sources: 'multiple academic databases'
    };

    // Generate suggested variations for the concept anchor
    const suggestedVariations = conceptAnchor ? getSuggestedVariations(conceptAnchor) : [];

    let systemPrompt = QUERY_GENERATION_SYSTEM_PROMPT;

    // Add concept anchor enforcement to system prompt if provided
    if (conceptAnchor) {
        const allowedTerms = [conceptAnchor, ...selectedVariations];
        systemPrompt += `

## 🔒 MANDATORY CONCEPT ANCHOR

**CRITICAL REQUIREMENT:** Every query you generate MUST include at least one of these terms:
${allowedTerms.map(t => `- "${t}"`).join('\n')}

This is NON-NEGOTIABLE. If a query doesn't include one of these anchor terms, it is INVALID.

The anchor ensures all search results relate to the core concept the researcher cares about.`;
    }

    systemPrompt += `

${QUERY_GENERATION_FEW_SHOT}`;

    let userPrompt = `## YOUR TASK

Research Context:
${researchContext}

Research Field: ${researchField || 'General Research'}

### FIELD-SPECIFIC GUIDANCE
${fieldGuidance.tips}

Primary databases: ${fieldGuidance.sources}`;

    if (conceptAnchor) {
        const allowedTerms = [conceptAnchor, ...selectedVariations];
        userPrompt += `

### 🔒 CONCEPT ANCHOR REQUIREMENT
Each query MUST contain one of: ${allowedTerms.map(t => `"${t}"`).join(' OR ')}`;
    }

    if (boostKeywords.length > 0) {
        userPrompt += `

### RECOMMENDED TERMINOLOGY FOR THIS FIELD
Consider incorporating these terms where relevant:
${boostKeywords.slice(0, 8).join(', ')}`;
    }

    userPrompt += `

Generate 4 diverse, high-quality search queries. Output valid JSON only.`;

    return { systemPrompt, userPrompt, suggestedVariations };
}

// ============================================================================
// QUICK FILTER PROMPT (DeepSeek) - Intelligent pre-filtering
// Optimized by prompt-engineer agent with XML structure for DeepSeek
// ============================================================================

export const QUICK_FILTER_SYSTEM_PROMPT = `<role>
You are an expert research librarian with 15+ years of experience in systematic review screening. Your specialty is rapid triage of academic articles to identify obvious mismatches before detailed evaluation.
</role>

<task>
For each article, make a binary decision: KEEP (potentially relevant) or SKIP (clearly irrelevant).
Your goal is to REMOVE OBVIOUS MISMATCHES while being INCLUSIVE on borderline cases.
</task>

<skip_criteria>
SKIP an article ONLY if it clearly fails one of these:

1. FIELD MISMATCH: Completely unrelated academic discipline
   - Psychology research → semiconductor physics article = SKIP
   - Psychology research → neuroscience article = KEEP (related field)

2. POPULATION MISMATCH: Fundamental subject incompatibility
   - Human studies needed → animal/cell research = SKIP
   - Adults needed → exclusively pediatric = SKIP
   - Adults needed → adolescents included = KEEP (overlapping)

3. TOPIC MISMATCH: Fundamentally different concepts despite keyword overlap
   - "Anxiety disorders" research → "anxiety" in machine learning context = SKIP
   - "CBT for anxiety" research → "mindfulness for anxiety" = KEEP (related intervention)

4. NON-RESEARCH CONTENT: Not actual research
   - Editorials, commentaries, book reviews, errata, retractions = SKIP
   - Protocols, conference papers, preprints = KEEP (still research)

5. METHODOLOGY TYPE MISMATCH: Incompatible research paradigm
   - Empirical studies needed → pure philosophical/theoretical = SKIP
   - Quantitative needed → qualitative = KEEP (let scorer evaluate)
</skip_criteria>

<keep_bias>
When uncertain, ALWAYS choose KEEP. Reasons:
- False negatives (missing relevant articles) are MORE COSTLY than false positives
- The detailed scorer will handle nuanced evaluation
- Your job is to remove OBVIOUS noise, not make fine distinctions
- Target skip rate: 20-40% (if you're skipping more, you're too aggressive)
</keep_bias>

<output_format>
Return ONLY valid JSON. No explanations, no preamble.
Format: {"0": "KEEP", "1": "SKIP", "2": "KEEP", ...}
Include a decision for EVERY article ID from 0 to N-1.
</output_format>`;

// ============================================================================
// GPT-4o-mini SCORING PROMPT - Detailed relevancy assessment
// Optimized by prompt-engineer agent with weighted dimensions & anti-clustering
// ============================================================================

export const GPT_SCORING_SYSTEM_PROMPT = `You are a senior research librarian and systematic review specialist with 20+ years of experience. Your task is to critically evaluate how well each article matches the user's research context.

## CORE IDENTITY
You are DISCRIMINATING and PRECISE. Your scores must reflect ACTUAL relevance, not keyword overlap.
- A score of 70+ means "I would recommend this to the researcher"
- A score of 50-69 means "Potentially useful background reading"
- A score below 50 means "Not directly applicable"

## WEIGHTED EVALUATION FRAMEWORK (100 points total)

### DIMENSION 1: TOPIC & CONSTRUCT MATCH (35 points) — MOST IMPORTANT
Does the article address the SPECIFIC topic, intervention, or phenomenon the user is researching?

| Points | Criteria |
|--------|----------|
| 30-35 | Directly addresses the exact topic/intervention |
| 22-29 | Closely related topic with clear conceptual links |
| 14-21 | Broader category that includes the topic |
| 7-13 | Mentions topic peripherally or as minor component |
| 0-6 | Does not meaningfully address the topic |

### DIMENSION 2: POPULATION & CONTEXT MATCH (30 points) — VERY IMPORTANT
Does the study population and context align with the user's needs?

| Points | Criteria |
|--------|----------|
| 26-30 | Exact population and context match |
| 19-25 | Substantially overlapping population |
| 12-18 | Partially overlapping, some generalizability |
| 5-11 | Different population, limited transferability |
| 0-4 | Incompatible population (wrong species, age, condition) |

### DIMENSION 3: METHODOLOGY ALIGNMENT (20 points)
Does the study design match what the research question requires?

| Points | Criteria |
|--------|----------|
| 17-20 | Methodology directly applicable |
| 12-16 | Compatible methodology, minor adaptations needed |
| 7-11 | Related methodology with significant differences |
| 3-6 | Incompatible methodology for stated purpose |
| 0-2 | No methodological relevance |

### DIMENSION 4: FIELD & DOMAIN (15 points)
Is this article from the correct academic discipline?

| Points | Criteria |
|--------|----------|
| 13-15 | Exact field match |
| 9-12 | Related field with shared frameworks |
| 5-8 | Adjacent field, indirect relevance |
| 1-4 | Different field with minimal overlap |
| 0 | Completely unrelated discipline |

## AUTOMATIC PENALTIES (apply after dimension scoring)
These penalties reflect fundamental mismatches that reduce practical utility:
- Animal model when human research needed: -20 points
- Protocol/proposal without results: -15 points
- Age group mismatch (pediatric vs adult or vice versa): -12 points
- Review/meta-analysis when primary research needed: -10 points
- Case study when population-level data needed: -8 points
- In vitro/cell culture when organism-level needed: -15 points

## CRITICAL ANTI-CLUSTERING RULES
Your scores MUST use the full range. Check yourself:
- If most scores are 50-70, you're being too conservative → use lower scores for weak matches
- If most scores are 40-60, you're clustering in the middle → identify truly excellent and truly poor matches
- Scores of 85+ should be RARE (< 10% of articles)
- Scores below 30 should be COMMON for clearly weak matches

## REASONING REQUIREMENTS
Your reason MUST:
1. Reference specific dimension scores or penalties applied
2. Cite concrete evidence from the title/abstract
3. Justify why THIS specific score (not just "moderate relevance")

## OUTPUT FORMAT
Return ONLY valid JSON:
{
  "0": {"score": 75, "reason": "Topic match (32/35): directly addresses CBT for anxiety. Population (24/30): adults with GAD. Method (16/20): RCT design. Field (14/15): clinical psychology. Strong overall fit."},
  "1": {"score": 42, "reason": "..."},
  ...
}`;

export const GPT_SCORING_FEW_SHOT = `## CALIBRATION EXAMPLES — Study these score distributions carefully

Research Context: "Cognitive behavioral therapy effectiveness for generalized anxiety disorder in adults"

<example_high_score>
ARTICLE: "A randomized controlled trial of CBT vs waitlist for GAD in adults aged 25-55"
SCORE: 94
REASON: "Topic (35/35): exact CBT + GAD match. Population (29/30): adults with clinical GAD, minor age range limitation. Method (20/20): RCT gold standard. Field (15/15): clinical psychology. Near-perfect alignment across all dimensions."
</example_high_score>

<example_strong_score>
ARTICLE: "Group-based CBT for anxiety disorders: A multi-site effectiveness trial in primary care"
SCORE: 78
REASON: "Topic (28/35): CBT for anxiety but mixed disorders, not GAD-specific. Population (26/30): adults in clinical settings. Method (18/20): effectiveness trial is relevant. Field (15/15): clinical psychology. Strong but not specific to GAD."
</example_strong_score>

<example_moderate_score>
ARTICLE: "Meta-analysis of psychological interventions for anxiety disorders across the lifespan"
SCORE: 58
REASON: "Topic (24/35): includes CBT but broad coverage. Population (18/30): lifespan = not adult-specific. Method (12/20): meta-analysis penalty (-10) when primary research preferred. Field (14/15): psychology. Useful background but not directly applicable."
</example_moderate_score>

<example_weak_score>
ARTICLE: "Mindfulness-based stress reduction for anxiety symptoms in college students"
SCORE: 36
REASON: "Topic (14/35): anxiety-related but MBSR, not CBT. Population (12/30): subclinical symptoms in young adults, not GAD diagnosis. Method (8/20): different intervention paradigm. Field (12/15): psychology. Tangentially related only."
</example_weak_score>

<example_poor_score>
ARTICLE: "Effects of anxiolytic compounds on fear extinction in rodent models"
SCORE: 11
REASON: "Topic (8/35): anxiety-related but pharmacological, not psychological. Population (0/30): animal model, -20 penalty applied. Method (3/20): basic neuroscience, not clinical. Field (10/15): neuroscience, not clinical psychology. Minimal relevance."
</example_poor_score>

<example_very_poor_score>
ARTICLE: "Protocol for a randomized trial of CBT-based app for GAD"
SCORE: 24
REASON: "Topic (30/35): perfect topic match. Population (25/30): adults with GAD. Method (0/20): protocol penalty (-15), no results. Field (14/15): clinical psychology. Would be excellent when published, but currently unusable for evidence synthesis."
</example_very_poor_score>

<example_methodology_mismatch>
ARTICLE: "Qualitative exploration of therapist experiences delivering CBT for anxiety"
SCORE: 32
REASON: "Topic (22/35): CBT + anxiety match. Population (8/30): therapist perspectives, not patient outcomes. Method (2/20): qualitative when effectiveness data needed. Field (14/15): clinical psychology. Interesting but wrong methodology for effectiveness question."
</example_methodology_mismatch>

<example_adjacent_field>
ARTICLE: "Neural correlates of anxiety reduction following psychological intervention: An fMRI study"
SCORE: 48
REASON: "Topic (18/35): psychological intervention for anxiety, may include CBT. Population (20/30): adults with anxiety. Method (10/20): neuroimaging, not clinical outcomes. Field (8/15): cognitive neuroscience, not clinical psychology. Mechanistic study, not effectiveness."
</example_adjacent_field>`;

// ============================================================================
// SCORER AGENT PROMPT (Designed by prompt-engineer agent)
// ============================================================================

export const SCORER_SYSTEM_PROMPT = `You are an expert academic research librarian and systematic review specialist with 20+ years of experience evaluating research literature for relevance and quality. Your role is to critically assess whether research articles match a user's specific research context.

CRITICAL PRINCIPLE: You are a DISCRIMINATING evaluator. Most papers in a general search will NOT be highly relevant to a specific research question. Your scores must reflect this reality. A score above 70 indicates genuinely strong relevance—this should be uncommon, not the default.

## YOUR EVALUATION FRAMEWORK

You must assess each article across FOUR mandatory dimensions:

### DIMENSION 1: FIELD AND DOMAIN ALIGNMENT (0-25 points)
- Is this article from the correct academic discipline?
- Does it address the core domain of the research context?
- Is the theoretical framework compatible with the user's field?

Scoring Guide:
- 22-25: Exact field match, directly addresses the domain
- 15-21: Related field, tangentially addresses domain
- 8-14: Adjacent field, indirect relevance
- 1-7: Different field with minimal conceptual overlap
- 0: Completely unrelated field

### DIMENSION 2: METHODOLOGY ALIGNMENT (0-25 points)
- Does the study design match what the research context implies or requires?
- Is this primary research when primary research is needed?
- Is the methodological approach appropriate for the research question?

Scoring Guide:
- 22-25: Methodology directly applicable to research context
- 15-21: Compatible methodology with minor adaptations needed
- 8-14: Related methodology but significant differences
- 1-7: Incompatible methodology for the stated purpose
- 0: No methodological relevance (e.g., editorial, commentary)

AUTOMATIC PENALTIES:
- Review/meta-analysis when primary research needed: -10 points
- Case study when population-level data needed: -8 points
- Qualitative when quantitative required (or vice versa): -5 points
- Protocol/proposal without results: -15 points

### DIMENSION 3: POPULATION AND CONTEXT MATCH (0-25 points)
- Does the study population match the target population?
- Is the clinical/research context aligned?
- Are the inclusion/exclusion criteria compatible?

Scoring Guide:
- 22-25: Exact population and context match
- 15-21: Substantially overlapping population, similar context
- 8-14: Partially overlapping population, related context
- 1-7: Different population with possible generalizability
- 0: Completely different population, no transferability

AUTOMATIC PENALTIES:
- Age group mismatch (e.g., pediatric vs adult): -12 points
- Species mismatch (e.g., animal model vs human): -20 points
- Clinical vs healthy population mismatch: -10 points
- Acute vs chronic condition mismatch: -8 points

### DIMENSION 4: TOPIC AND CONSTRUCT SPECIFICITY (0-25 points)
- Does the article address the specific topic, intervention, or phenomenon?
- Are the key constructs and variables aligned?
- Is the research question conceptually compatible?

Scoring Guide:
- 22-25: Directly addresses the specific topic/intervention/construct
- 15-21: Addresses closely related topic with clear conceptual links
- 8-14: Addresses broader category containing the topic
- 1-7: Mentions topic peripherally or as minor component
- 0: Does not address the topic or related constructs

## SCORING INTERPRETATION RUBRIC

| Score Range | Interpretation | Expected Frequency |
|-------------|----------------|-------------------|
| 90-100 | EXCELLENT: Near-perfect match across all dimensions | Rare (<5% of articles) |
| 75-89 | STRONG: High relevance with minor gaps in one dimension | Uncommon (10-15%) |
| 50-74 | MODERATE: Partial relevance. Related but not directly applicable | Common (25-35%) |
| 25-49 | WEAK: Limited relevance. Different focus but shares some territory | Common (25-35%) |
| 1-24 | POOR: Minimal relevance. Superficial keyword match only | Common (20-30%) |
| 0 | IRRELEVANT: No meaningful connection to research context | Variable |

## CHAIN-OF-THOUGHT REASONING PROCESS

For each article, follow this reasoning sequence:

STEP 1 - UNDERSTAND THE RESEARCH CONTEXT
- What is the user actually looking for?
- What field, methodology, population, and topic are implied?

STEP 2 - EXTRACT ARTICLE CHARACTERISTICS
- What field is this article from?
- What methodology was used?
- What population was studied?
- What specific topic/intervention/construct was examined?

STEP 3 - DIMENSION-BY-DIMENSION ASSESSMENT
- Score each of the four dimensions independently
- Apply automatic penalties where applicable

STEP 4 - CALCULATE AND CALIBRATE
- Sum the dimension scores
- Apply any cross-cutting penalties
- Ask yourself "Is this score appropriately discriminating?"

STEP 5 - SYNTHESIZE REASONING
- Write a concise justification that explains the score
- Highlight the key factors that determined the score

## OUTPUT FORMAT

You MUST respond with valid JSON. For each article ID, provide:

{
  "0": {
    "score": <integer 0-100>,
    "confidence": <float 0.0-1.0>,
    "reasoning": "<2-3 sentence justification>"
  }
}

Do not include any text outside the JSON object.`;

export const SCORER_FEW_SHOT_EXAMPLE = `EXAMPLE OUTPUT:
{
  "0": {
    "score": 92,
    "confidence": 0.95,
    "reasoning": "Directly addresses CBT for adult anxiety using RCT design with matching population (adults 25-65 with GAD). Near-perfect alignment across all four dimensions with rigorous methodology."
  },
  "1": {
    "score": 38,
    "confidence": 0.85,
    "reasoning": "MBSR rather than CBT (different intervention), university students with subclinical symptoms (population mismatch), pilot study without control (methodology limitation). Tangentially related only."
  },
  "2": {
    "score": 12,
    "confidence": 0.90,
    "reasoning": "Rodent neuroscience study using optogenetics. Animal model penalty (-20), no clinical translation, methodology completely different. Basic science with no direct applicability."
  },
  "3": {
    "score": 62,
    "confidence": 0.75,
    "reasoning": "Meta-analysis of CBT for anxiety - topic match but review paper penalty (-10). Lifespan population rather than adults specifically. Useful for background but not primary research."
  }
}`;

// ============================================================================
// CRITIC AGENT PROMPT (Designed by prompt-engineer agent)
// ============================================================================

export const CRITIC_SYSTEM_PROMPT = `You are CRITIC, a senior methodologist and peer reviewer with 20+ years of experience evaluating research relevance. You have served on editorial boards for top-tier journals and have a reputation for rigorous but fair assessment.

Your role: CHALLENGE and VALIDATE scores assigned by a Scorer agent. You review high-scoring articles to catch errors, prevent false positives, and ensure scoring accuracy.

## CORE PRINCIPLES
1. SKEPTICAL BY DEFAULT: Assume scores may be inflated until proven otherwise
2. EVIDENCE-BASED: Every critique must cite specific textual evidence
3. HARSH BUT FAIR: Protect users from irrelevant results, but acknowledge genuine relevance
4. METHODOLOGICAL RIGOR: Surface mismatches the Scorer may have missed

## CRITICAL EVALUATION FRAMEWORK

### STEP 1: Deconstruct the Scorer's Reasoning
- What specific claims did the Scorer make about relevance?
- What evidence did they cite from the article?
- What did they FAIL to consider?

### STEP 2: Identify Red Flags (Score Inflation Indicators)

CHECK FOR THESE COMMON INFLATION PATTERNS:

**A. KEYWORD MATCHING WITHOUT CONCEPTUAL ALIGNMENT**
Article contains query terms but addresses fundamentally different questions.
- Penalty: -25 to -40 points

**B. METHODOLOGY MISMATCH**
Article's methods cannot answer the user's implicit research question.
- Example: User needs intervention studies, article is cross-sectional survey
- Penalty: -20 to -35 points

**C. POPULATION/CONTEXT MISMATCH**
Study population or context differs significantly from user's needs.
- Example: Query about elderly, article studies pediatric population
- Penalty: -15 to -30 points

**D. FIELD/DISCIPLINE MISMATCH**
Article is from adjacent field with different frameworks or definitions.
- Penalty: -15 to -25 points

**E. PERIPHERAL RELEVANCE INFLATION**
Article tangentially mentions query topic but it is not the focus.
- Example: Query topic appears only in discussion as future direction
- Penalty: -30 to -50 points

**F. REVIEW PAPER WHEN PRIMARY NEEDED**
Scorer rated review/meta-analysis highly when original research required.
- Penalty: -10 to -20 points

### STEP 3: Check for Under-Scoring (Less Common)

INCREASE scores when:
- Scorer missed methodological strengths (+10 to +20)
- Article has high generalizability Scorer overlooked (+10 to +15)
- Scorer penalized unfairly for superficial reasons (+15 to +25)
- Article is seminal/foundational work directly relevant (+10 to +20)

### STEP 4: Calculate Adjusted Score

Apply penalties based on severity:
- MINOR issues: Adjust by 10-20 points
- MODERATE issues: Adjust by 20-35 points
- SEVERE issues: Adjust by 35-50 points
- MULTIPLE issues: Cumulative but cap at -50 total

FLOOR: No score below 5
CEILING: No score above 100

## OUTPUT FORMAT

For each article, provide your assessment in this JSON structure:

{
  "0": {
    "originalScore": <from Scorer>,
    "adjustedScore": <your adjusted score>,
    "action": "REDUCED" | "INCREASED" | "KEPT",
    "critique": "<1-2 sentence explanation of adjustment>",
    "confidence": <float 0.0-1.0>
  }
}

Do not include any text outside the JSON object.

## META-REMINDER
You are the last line of defense against irrelevant results. A researcher trusting this platform will waste hours reading articles you let through incorrectly. Your harshness serves the user. But equally: penalizing genuinely relevant articles damages trust. Calibrate carefully.`;

export const CRITIC_FEW_SHOT_EXAMPLE = `EXAMPLE CRITIQUE:
{
  "0": {
    "originalScore": 82,
    "adjustedScore": 35,
    "action": "REDUCED",
    "critique": "KEYWORD MATCHING error. Article discusses CRISPR but for agricultural crops, not human gene therapy. Zero clinical relevance despite sharing technology keyword.",
    "confidence": 0.95
  },
  "1": {
    "originalScore": 78,
    "adjustedScore": 52,
    "action": "REDUCED",
    "critique": "METHODOLOGY MISMATCH. User requested RCT evidence; article is qualitative interview study. Cannot answer effectiveness questions despite topic alignment.",
    "confidence": 0.90
  },
  "2": {
    "originalScore": 94,
    "adjustedScore": 94,
    "action": "KEPT",
    "critique": "Valid high score. Seminal paper directly addressing query with exact methodology and population match. No inflation detected.",
    "confidence": 0.95
  },
  "3": {
    "originalScore": 61,
    "adjustedScore": 79,
    "action": "INCREASED",
    "critique": "UNDER-SCORED. Scorer misunderstood 'prodromal' as different from 'early detection' - they are synonymous. Longitudinal design is strength, not limitation.",
    "confidence": 0.85
  },
  "4": {
    "originalScore": 71,
    "adjustedScore": 38,
    "action": "REDUCED",
    "critique": "PERIPHERAL RELEVANCE. ML for DDI mentioned in 2 of 24 pages. Article focuses on traditional PK modeling. Query topic is not the primary focus.",
    "confidence": 0.90
  }
}`;

// ============================================================================
// LEGACY PROMPTS (kept for backwards compatibility)
// ============================================================================

export const RESEARCH_ANALYSIS_SYSTEM_PROMPT = `You are a senior research librarian and systematic review specialist. Your task is to analyze research inputs and generate optimized search queries for academic databases.

Given the user's research context, example papers, and/or DOI references, you must:
1. Synthesize a clear research scope summary
2. Generate exactly 3 targeted search queries
3. Identify hallucination filter criteria
4. Determine the primary methodology
5. Extract key terms

Use established frameworks (PICO, SPIDER, PICOC) where applicable.

OUTPUT FORMAT (JSON only):
{
  "summary": "2-3 sentence synthesis of research scope",
  "searchQueries": ["query1", "query2", "query3"],
  "hallucinationFilter": ["criterion1", "criterion2", "criterion3"],
  "methodology": "quantitative|qualitative|mixed|theoretical|meta-analysis|systematic-review",
  "keyTerms": ["term1", "term2", ...]
}`;

export const ANALYSIS_FEW_SHOT_EXAMPLE = `EXAMPLE OUTPUT:
{
  "summary": "Research focuses on transformer-based neural machine translation for low-resource languages, with emphasis on transfer learning techniques and attention mechanisms.",
  "searchQueries": [
    "transformer neural machine translation low-resource languages",
    "transfer learning NMT multilingual models",
    "attention mechanism cross-lingual translation"
  ],
  "hallucinationFilter": [
    "Must involve neural/deep learning approaches",
    "Must address translation or cross-lingual tasks",
    "Must discuss low-resource or multilingual scenarios"
  ],
  "methodology": "quantitative",
  "keyTerms": ["transformer", "neural machine translation", "low-resource", "transfer learning", "attention mechanism", "multilingual", "cross-lingual"]
}`;

export const RELEVANCY_SCORING_SYSTEM_PROMPT = SCORER_SYSTEM_PROMPT;

export const SCORING_FEW_SHOT_EXAMPLE = SCORER_FEW_SHOT_EXAMPLE;

// ============================================================================
// PROMPT BUILDER FUNCTIONS
// ============================================================================

export interface AnalysisWeights {
    context: number;
    pdfs: number;
    dois: number;
}

export interface PdfDocument {
    name: string;
    content: string;
}

export interface DoiDocument {
    name: string;
    content: string;
}

export interface ArticleCandidate {
    id: string;
    title: string;
    summary: string;
}

/**
 * Builds the complete analysis prompt with hierarchical input weighting.
 */
export function buildAnalysisPrompt(
    researchContext: string | null,
    pdfDocuments: PdfDocument[],
    doiDocuments: DoiDocument[],
    weights: AnalysisWeights,
    buzzwords?: string
): { systemPrompt: string; userPrompt: string } {
    const hasContext = !!researchContext && researchContext.trim().length > 0;
    const hasPdfs = pdfDocuments.length > 0;
    const hasDois = doiDocuments.length > 0;

    const systemPrompt = `${RESEARCH_ANALYSIS_SYSTEM_PROMPT}

INPUT HIERARCHY FOR THIS REQUEST:
${hasContext ? `- Research Context: ${weights.context}% weight (PRIMARY)` : ""}
${hasPdfs ? `- PDF Examples: ${weights.pdfs}% weight` : ""}
${hasDois ? `- DOI References: ${weights.dois}% weight` : ""}

${ANALYSIS_FEW_SHOT_EXAMPLE}`;

    let userPrompt = "HIERARCHICAL INPUT ANALYSIS\n===========================\n\n";

    if (hasContext) {
        userPrompt += `[WEIGHT: ${weights.context}%] PRIMARY RESEARCH CONTEXT\n`;
        userPrompt += "------------------------------------------------------\n";
        userPrompt += `${researchContext}\n\n`;
    }

    if (hasPdfs) {
        userPrompt += `[WEIGHT: ${weights.pdfs}%] EXAMPLE RESEARCH PAPERS (PDFs)\n`;
        userPrompt += "-------------------------------------------------------\n";
        pdfDocuments.forEach((doc, i) => {
            userPrompt += `--- Document ${i + 1}: ${doc.name} ---\n${doc.content}\n\n`;
        });
    }

    if (hasDois) {
        userPrompt += `[WEIGHT: ${weights.dois}%] REFERENCE ARTICLES (DOI Metadata)\n`;
        userPrompt += "----------------------------------------------------------\n";
        doiDocuments.forEach((doc, i) => {
            userPrompt += `--- Reference ${i + 1}: ${doc.name} ---\n${doc.content}\n\n`;
        });
    }

    if (buzzwords) {
        userPrompt += `MANDATORY KEYWORD FILTERS: ${buzzwords}\n`;
        userPrompt += "(All search queries MUST include at least one of these terms)\n\n";
    }

    userPrompt += "Generate the analysis JSON now.";

    return { systemPrompt, userPrompt };
}

/**
 * Builds the relevancy scoring prompt for candidate articles.
 * Uses the new agent-designed 4-dimension rubric with chain-of-thought.
 */
export function buildScoringPrompt(
    scopeSummary: string,
    buzzwords: string | null,
    candidates: ArticleCandidate[]
): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `${SCORER_SYSTEM_PROMPT}

${SCORER_FEW_SHOT_EXAMPLE}`;

    let userPrompt = "RESEARCH CONTEXT FOR SCORING\n=============================\n";
    userPrompt += `${scopeSummary}\n\n`;

    if (buzzwords) {
        userPrompt += `REQUIRED KEYWORDS: ${buzzwords}\n`;
        userPrompt += "Papers must address these concepts for high scores.\n\n";
    }

    userPrompt += "CANDIDATE ARTICLES TO SCORE\n===========================\n";
    candidates.forEach((candidate, i) => {
        // Truncate abstract to 400 chars for token efficiency (AI-engineer recommendation)
        const truncatedSummary = candidate.summary.length > 400
            ? candidate.summary.slice(0, 400) + "..."
            : candidate.summary;
        userPrompt += `ID: ${i}\nTitle: ${candidate.title}\nAbstract: ${truncatedSummary}\n\n`;
    });

    userPrompt += "Score each article using the 4-dimension framework. Return valid JSON only.";

    return { systemPrompt, userPrompt };
}

/**
 * Builds the critic prompt for reviewing and adjusting scores.
 * Uses the new agent-designed adversarial review framework.
 */
export function buildCriticPrompt(
    scopeSummary: string,
    candidates: ArticleCandidate[],
    initialScores: Record<string, { score: number; reasoning: string; confidence?: number }>
): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `${CRITIC_SYSTEM_PROMPT}

${CRITIC_FEW_SHOT_EXAMPLE}`;

    let userPrompt = "RESEARCH CONTEXT\n================\n";
    userPrompt += `${scopeSummary}\n\n`;

    userPrompt += "SCORES TO REVIEW\n================\n";
    userPrompt += "Review these scores critically. Challenge any that seem inflated or poorly justified.\n\n";

    candidates.forEach((candidate, i) => {
        const scoreData = initialScores[i.toString()] || { score: 0, reasoning: "No score" };
        const truncatedSummary = candidate.summary.length > 300
            ? candidate.summary.slice(0, 300) + "..."
            : candidate.summary;

        userPrompt += `--- Article ${i} ---\n`;
        userPrompt += `Title: ${candidate.title}\n`;
        userPrompt += `Abstract: ${truncatedSummary}\n`;
        userPrompt += `Scorer's Score: ${scoreData.score}\n`;
        userPrompt += `Scorer's Reasoning: ${scoreData.reasoning}\n`;
        if (scoreData.confidence !== undefined) {
            userPrompt += `Scorer's Confidence: ${scoreData.confidence}\n`;
        }
        userPrompt += "\n";
    });

    userPrompt += "Critically review each score. Output your adjustments as valid JSON.";

    return { systemPrompt, userPrompt };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates and normalizes scorer output with confidence scores.
 */
export function validateScoringOutput(
    output: unknown,
    expectedCount: number
): {
    valid: boolean;
    data: Record<string, { score: number; reasoning: string; confidence: number }> | null;
    errors: string[];
} {
    const errors: string[] = [];

    if (!output || typeof output !== "object") {
        return { valid: false, data: null, errors: ["Output is not an object"] };
    }

    const obj = output as Record<string, unknown>;
    const normalized: Record<string, { score: number; reasoning: string; confidence: number }> = {};

    for (let i = 0; i < expectedCount; i++) {
        const key = i.toString();
        const entry = obj[key] as { score?: number; reasoning?: string; confidence?: number } | undefined;

        if (!entry) {
            // Provide default for missing entries
            normalized[key] = { score: 25, reasoning: "No score generated", confidence: 0.1 };
            continue;
        }

        // Validate and clamp score
        let score = typeof entry.score === "number" ? entry.score : 25;
        score = Math.max(0, Math.min(100, Math.round(score)));

        // Extract reasoning
        const reasoning = typeof entry.reasoning === "string"
            ? entry.reasoning.slice(0, 500)
            : "No reasoning provided";

        // Extract confidence (default 0.7 if not provided)
        let confidence = typeof entry.confidence === "number" ? entry.confidence : 0.7;
        confidence = Math.max(0, Math.min(1, confidence));

        normalized[key] = { score, reasoning, confidence };
    }

    return { valid: true, data: normalized, errors };
}

/**
 * Validates and normalizes critic output.
 */
export function validateCriticOutput(
    output: unknown,
    expectedCount: number
): {
    valid: boolean;
    data: Record<string, { originalScore: number; adjustedScore: number; critique: string; action: string; confidence: number }> | null;
    errors: string[];
} {
    const errors: string[] = [];

    if (!output || typeof output !== "object") {
        return { valid: false, data: null, errors: ["Output is not an object"] };
    }

    const obj = output as Record<string, unknown>;
    const normalized: Record<string, { originalScore: number; adjustedScore: number; critique: string; action: string; confidence: number }> = {};

    for (let i = 0; i < expectedCount; i++) {
        const key = i.toString();
        const entry = obj[key] as {
            originalScore?: number;
            adjustedScore?: number;
            critique?: string;
            action?: string;
            confidence?: number;
        } | undefined;

        if (!entry) {
            normalized[key] = {
                originalScore: 0,
                adjustedScore: 0,
                critique: "No critique provided",
                action: "KEPT",
                confidence: 0.5
            };
            continue;
        }

        // Validate and clamp adjusted score
        let adjustedScore = typeof entry.adjustedScore === "number"
            ? entry.adjustedScore
            : (entry.originalScore || 0);
        adjustedScore = Math.max(5, Math.min(100, Math.round(adjustedScore)));

        const originalScore = typeof entry.originalScore === "number" ? entry.originalScore : 0;
        const critique = typeof entry.critique === "string" ? entry.critique.slice(0, 300) : "No critique";
        const action = ["REDUCED", "INCREASED", "KEPT"].includes(entry.action || "") ? entry.action! : "KEPT";
        let confidence = typeof entry.confidence === "number" ? entry.confidence : 0.8;
        confidence = Math.max(0, Math.min(1, confidence));

        normalized[key] = { originalScore, adjustedScore, critique, action, confidence };
    }

    return { valid: true, data: normalized, errors };
}

/**
 * Validates and normalizes analysis output.
 */
export function validateAnalysisOutput(output: unknown): {
    valid: boolean;
    data: {
        summary: string;
        searchQueries: string[];
        hallucinationFilter: string[];
        methodology: string;
        keyTerms: string[];
    } | null;
    errors: string[];
} {
    const errors: string[] = [];

    if (!output || typeof output !== "object") {
        return { valid: false, data: null, errors: ["Output is not an object"] };
    }

    const obj = output as Record<string, unknown>;

    if (typeof obj.summary !== "string" || obj.summary.length < 20) {
        errors.push("summary must be a string of at least 20 characters");
    }

    if (!Array.isArray(obj.searchQueries) || obj.searchQueries.length !== 3) {
        errors.push("searchQueries must be an array of exactly 3 items");
    }

    if (!Array.isArray(obj.hallucinationFilter) || obj.hallucinationFilter.length !== 3) {
        errors.push("hallucinationFilter must be an array of exactly 3 items");
    }

    const validMethodologies = ["quantitative", "qualitative", "mixed", "theoretical", "meta-analysis", "systematic-review"];
    if (obj.methodology && !validMethodologies.includes(obj.methodology as string)) {
        obj.methodology = "mixed";
    }

    if (obj.keyTerms && (!Array.isArray(obj.keyTerms) || obj.keyTerms.length < 3)) {
        errors.push("keyTerms should be an array of at least 3 items");
    }

    if (errors.length > 0) {
        return { valid: false, data: null, errors };
    }

    return {
        valid: true,
        data: {
            summary: obj.summary as string,
            searchQueries: obj.searchQueries as string[],
            hallucinationFilter: obj.hallucinationFilter as string[],
            methodology: (obj.methodology as string) || "mixed",
            keyTerms: (obj.keyTerms as string[]) || [],
        },
        errors: [],
    };
}

// ============================================================================
// INTELLIGENT ROUTING (AI-engineer recommendation)
// ============================================================================

/**
 * Determines which articles should be sent to Critic for review.
 * Uses intelligent routing to save tokens while maintaining quality.
 */
export function selectArticlesForCriticReview(
    scores: Record<string, { score: number; confidence: number }>,
    maxReviewCount: number = 25
): string[] {
    const entries = Object.entries(scores);

    // Routing criteria (AI-engineer recommendation):
    // 1. Top N by score (high-stakes decisions)
    // 2. Low confidence < 0.6 (uncertainty signals)
    // 3. Near boundary (45-55 range - borderline cases)

    const candidates: { id: string; priority: number }[] = [];

    entries.forEach(([id, data]) => {
        let priority = 0;

        // High scores get highest priority (potential false positives)
        if (data.score >= 70) priority += 100;
        else if (data.score >= 50) priority += 50;

        // Low confidence increases priority
        if (data.confidence < 0.6) priority += 40;
        else if (data.confidence < 0.75) priority += 20;

        // Boundary scores (45-55) get extra priority
        if (data.score >= 45 && data.score <= 55) priority += 30;

        // Very high scores are critical to verify
        if (data.score >= 85) priority += 50;

        candidates.push({ id, priority });
    });

    // Sort by priority descending and take top N
    return candidates
        .sort((a, b) => b.priority - a.priority)
        .slice(0, maxReviewCount)
        .map(c => c.id);
}

/**
 * Reconciles Scorer and Critic scores using confidence-weighted logic.
 * Based on AI-engineer's reconciliation framework.
 */
export function reconcileScores(
    scorerScore: number,
    scorerConfidence: number,
    criticScore: number,
    criticConfidence: number
): { finalScore: number; requiresHumanReview: boolean; reconciliationNote: string } {
    const disagreement = Math.abs(scorerScore - criticScore);

    // No/Minor disagreement (0-15 points): Use scorer's score
    if (disagreement <= 15) {
        return {
            finalScore: scorerScore,
            requiresHumanReview: false,
            reconciliationNote: "Minor disagreement, using Scorer score"
        };
    }

    // Moderate disagreement (16-25 points): Confidence-weighted average
    if (disagreement <= 25) {
        const totalConfidence = scorerConfidence + criticConfidence;
        const weightedScore = (scorerScore * scorerConfidence + criticScore * criticConfidence) / totalConfidence;
        return {
            finalScore: Math.round(weightedScore),
            requiresHumanReview: false,
            reconciliationNote: `Moderate disagreement, weighted average (Scorer: ${scorerConfidence.toFixed(2)}, Critic: ${criticConfidence.toFixed(2)})`
        };
    }

    // Severe disagreement (26-40 points): Use conservative (lower) score + flag
    if (disagreement <= 40) {
        const conservativeScore = Math.min(scorerScore, criticScore);
        return {
            finalScore: conservativeScore,
            requiresHumanReview: false,
            reconciliationNote: `Severe disagreement (${disagreement} points), using conservative score`
        };
    }

    // Extreme disagreement (>40 points): Flag for human review
    return {
        finalScore: Math.min(scorerScore, criticScore),
        requiresHumanReview: true,
        reconciliationNote: `Extreme disagreement (${disagreement} points), requires human review`
    };
}

// ============================================================================
// NEW DUAL-LLM ARCHITECTURE FUNCTIONS
// ============================================================================

/**
 * Builds the quick filter prompt for DeepSeek.
 * More detailed to make better KEEP/SKIP decisions.
 */
export function buildQuickFilterPrompt(
    scopeSummary: string,
    candidates: ArticleCandidate[]
): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = QUICK_FILTER_SYSTEM_PROMPT;

    // Build user prompt with full research context and substantial abstract excerpts
    let userPrompt = `## RESEARCH CONTEXT\n${scopeSummary}\n\n## ARTICLES TO FILTER\n\n`;
    candidates.forEach((c, i) => {
        // Include more abstract text (400 chars) for better decisions
        const abstractExcerpt = c.summary.slice(0, 400).replace(/\n/g, ' ').trim();
        userPrompt += `[${i}] **${c.title}**\n${abstractExcerpt}${c.summary.length > 400 ? '...' : ''}\n\n`;
    });
    userPrompt += "## TASK\nFor each article ID, output KEEP or SKIP as JSON.";

    return { systemPrompt, userPrompt };
}

// ============================================================================
// STEP 4: Dynamic Calibration Anchors
// ============================================================================

export interface CalibrationAnchors {
    high: { title: string; summary: string; overlap: number };
    medium: { title: string; summary: string; overlap: number };
    low: { title: string; summary: string; overlap: number };
}

/**
 * Picks HIGH/MEDIUM/LOW anchor articles by keyword overlap with scopeSummary.
 * Returns null if fewer than 6 candidates (not enough diversity).
 */
export function selectCalibrationAnchors(
    scopeSummary: string,
    candidates: ArticleCandidate[]
): CalibrationAnchors | null {
    if (candidates.length < 6) return null;

    const scopeTokens = tokenizeForRelevancy(scopeSummary);

    // Score each candidate by Jaccard overlap with scope
    const scored = candidates.map(c => {
        const combined = `${c.title} ${c.summary}`;
        const tokens = tokenizeForRelevancy(combined);
        const overlap = jaccardSimilarity(tokens, scopeTokens);
        return { ...c, overlap };
    }).sort((a, b) => b.overlap - a.overlap);

    // Pick from top, middle, and bottom thirds
    const topIdx = 0;
    const midIdx = Math.floor(scored.length / 2);
    const lowIdx = scored.length - 1;

    return {
        high: { title: scored[topIdx].title, summary: scored[topIdx].summary.slice(0, 200), overlap: scored[topIdx].overlap },
        medium: { title: scored[midIdx].title, summary: scored[midIdx].summary.slice(0, 200), overlap: scored[midIdx].overlap },
        low: { title: scored[lowIdx].title, summary: scored[lowIdx].summary.slice(0, 200), overlap: scored[lowIdx].overlap },
    };
}

/**
 * Builds the GPT-4o-mini scoring prompt for detailed relevancy assessment.
 * Uses comprehensive context for accurate scoring.
 * Optionally includes dynamic calibration anchors from actual candidates.
 */
export function buildGPTScoringPrompt(
    scopeSummary: string,
    buzzwords: string | null,
    candidates: ArticleCandidate[],
    anchorArticles?: CalibrationAnchors | null
): { systemPrompt: string; userPrompt: string } {
    let systemPrompt = GPT_SCORING_SYSTEM_PROMPT + "\n\n";

    if (anchorArticles) {
        // Dynamic calibration from actual candidates
        systemPrompt += `## CALIBRATION ANCHORS (from this batch)\n\n`;
        systemPrompt += `<calibration_high>\nARTICLE: "${anchorArticles.high.title}"\nEXPECTED RANGE: 75-95 (high keyword overlap with research context)\n</calibration_high>\n\n`;
        systemPrompt += `<calibration_medium>\nARTICLE: "${anchorArticles.medium.title}"\nEXPECTED RANGE: 40-65 (moderate keyword overlap with research context)\n</calibration_medium>\n\n`;
        systemPrompt += `<calibration_low>\nARTICLE: "${anchorArticles.low.title}"\nEXPECTED RANGE: 10-35 (low keyword overlap with research context)\n</calibration_low>\n\n`;
        systemPrompt += `Use these anchors to calibrate your scoring scale for THIS specific research context. The static examples below are secondary.\n\n`;
    }

    systemPrompt += GPT_SCORING_FEW_SHOT;

    let userPrompt = "## RESEARCH CONTEXT TO MATCH AGAINST\n\n";
    userPrompt += scopeSummary + "\n\n";

    if (buzzwords) {
        userPrompt += `## KEY TERMS & CONCEPTS\n${buzzwords}\n\n`;
    }

    userPrompt += "## ARTICLES TO SCORE\n\n";
    userPrompt += "Evaluate each article using the 4-dimension framework. Be discriminating - most articles should score 30-60.\n\n";

    candidates.forEach((c, i) => {
        // Include more abstract text (500 chars) for better scoring
        const abstractText = c.summary.length > 500
            ? c.summary.slice(0, 500) + "..."
            : c.summary;
        userPrompt += `### ARTICLE ${i}\n`;
        userPrompt += `**Title:** ${c.title}\n`;
        userPrompt += `**Abstract:** ${abstractText}\n\n`;
    });

    userPrompt += "## OUTPUT\nScore each article (0-100) with a specific reason. Output valid JSON only.";

    return { systemPrompt, userPrompt };
}

/**
 * Validates quick filter output.
 */
export function validateFilterOutput(
    output: unknown,
    expectedCount: number
): { valid: boolean; kept: number[]; skipped: number[] } {
    if (!output || typeof output !== "object") {
        // If invalid, keep all (fail-safe)
        return {
            valid: false,
            kept: Array.from({ length: expectedCount }, (_, i) => i),
            skipped: []
        };
    }

    const obj = output as Record<string, string>;
    const kept: number[] = [];
    const skipped: number[] = [];

    for (let i = 0; i < expectedCount; i++) {
        const key = i.toString();
        const value = (obj[key] || "KEEP").toUpperCase();
        if (value === "SKIP") {
            skipped.push(i);
        } else {
            kept.push(i);
        }
    }

    return { valid: true, kept, skipped };
}

/**
 * Validates GPT scoring output.
 */
export function validateGPTScoringOutput(
    output: unknown,
    expectedCount: number
): {
    valid: boolean;
    data: Record<string, { score: number; reason: string }> | null;
} {
    if (!output || typeof output !== "object") {
        return { valid: false, data: null };
    }

    const obj = output as Record<string, unknown>;
    const normalized: Record<string, { score: number; reason: string }> = {};

    for (let i = 0; i < expectedCount; i++) {
        const key = i.toString();
        const entry = obj[key] as { score?: number; reason?: string } | undefined;

        if (!entry) {
            normalized[key] = { score: 30, reason: "No score generated" };
            continue;
        }

        let score = typeof entry.score === "number" ? entry.score : 30;
        score = Math.max(0, Math.min(100, Math.round(score)));
        const reason = typeof entry.reason === "string"
            ? entry.reason.slice(0, 200)
            : "No reason provided";

        normalized[key] = { score, reason };
    }

    return { valid: true, data: normalized };
}
