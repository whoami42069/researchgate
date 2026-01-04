# Project TL;DR: Research Discovery Platform

**Goal**: A Next.js application that helps researchers find relevant academic articles using AI-powered analysis. Users provide a **Research Context** (primary lens), optional **example PDFs**, and/or **DOIs** to discover articles from **multiple academic databases** with relevancy scoring.

## Tech Stack
- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4 (Professional light theme - academic aesthetic)
- **AI Logic**:
  - DeepSeek V3 API (`deepseek-chat`) - Bulk article scoring (cost-effective)
  - OpenAI GPT-4o-mini - Persona generation (quality output)
- **Data Sources**: Multi-source aggregation (7 sources):
  - **ArXiv API** - Preprints (CS, Physics, Math, etc.)
  - **OpenAlex API** - 240M+ works, all disciplines
  - **Semantic Scholar API** - 200M+ papers with AI TLDR summaries
  - **PubMed API** - 35M+ biomedical/clinical psychology articles
  - **Europe PMC API** - 33M+ publications (behavioral/health psychology)
  - **DOAJ API** - 21,000+ open access journals, 11M+ articles
  - **ERIC API** - 1.6M educational psychology records
- **External API**: CrossRef API (DOI metadata fetching)
- **Storage**: Browser `localStorage` (Saved articles library)
- **PDF Processing**: `unpdf` (Modern ESM-compatible PDF text extraction)

## Key Features (Updated)

### 1. Hierarchical Input System
Inputs are weighted by importance:
| Priority | Input | Weight (all 3) | Description |
|----------|-------|----------------|-------------|
| 1 (Primary) | Research Context | 50% | The main research scope/lens |
| 2 (Secondary) | Example PDFs | 35% | Up to 4 reference papers |
| 3 (Tertiary) | DOIs | 15% | Article metadata from CrossRef |

**Dynamic Weighting**:
- Context + PDFs: 60% / 40%
- Context + DOIs: 70% / 30%
- PDFs + DOIs: 65% / 35%
- Single input: 100%

### 2. Token Optimization
- **Max tokens**: 100,000 per DeepSeek call
- **PDF chunking**: 3,000 chars max per PDF (extracts Abstract, Intro, Conclusion, Methods)
- **Article limit**: 100 max from ArXiv
- **Smart truncation**: DOIs cut first, then PDFs, Context NEVER truncated

### 3. Research-Grade AI Prompts (Agent-Designed)
Located in `src/lib/prompts.ts` - designed by prompt-engineer and ai-engineer agents:

**Analysis Prompt** (`RESEARCH_ANALYSIS_SYSTEM_PROMPT`):
- Senior research librarian persona
- PICO/SPIDER/PICOC frameworks
- Generates 3 optimized search queries

**Scorer Agent Prompt** (`SCORER_SYSTEM_PROMPT`):
- 4-dimension rubric (Field, Methodology, Population, Topic) - 25 pts each
- Chain-of-thought reasoning (5-step process)
- Automatic penalties for mismatches
- Confidence scores (0.0-1.0) for each rating
- Few-shot examples with calibrated scores

**Critic Agent Prompt** (`CRITIC_SYSTEM_PROMPT`):
- Adversarial review framework
- 6 inflation pattern detection
- Can REDUCE, INCREASE, or KEEP scores
- Confidence-aware adjustments

**Helper Functions**:
- `buildScoringPrompt()` - Constructs Scorer input with truncated abstracts
- `buildCriticPrompt()` - Constructs Critic input with Scorer's reasoning
- `selectArticlesForCriticReview()` - Intelligent routing based on priority
- `reconcileScores()` - Confidence-weighted score reconciliation
- `validateScoringOutput()` / `validateCriticOutput()` - JSON validation

### 4. Scoring Rubric (Agent-Designed)
| Score | Level | Expected Frequency | Meaning |
|-------|-------|-------------------|---------|
| 90-100 | EXCELLENT | Rare (<5%) | Near-perfect match across all 4 dimensions |
| 75-89 | STRONG | Uncommon (10-15%) | High relevance with minor gaps in one dimension |
| 50-74 | MODERATE | Common (25-35%) | Partial relevance, related but not directly applicable |
| 25-49 | WEAK | Common (25-35%) | Limited relevance, different focus |
| 1-24 | POOR | Common (20-30%) | Minimal relevance, superficial keyword match only |
| 0 | IRRELEVANT | Variable | No meaningful connection |

**Key Principle**: Most papers should NOT score above 70. High scores are earned, not given.

## File Structure

```text
research-app/
├── .env.local                    # DEEPSEEK_API_KEY=sk-...
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main UI (Research Context, PDFs, DOIs, Results, Library)
│   │   ├── globals.css           # Professional light theme
│   │   ├── layout.tsx            # Root layout
│   │   └── api/
│   │       ├── analyze/route.ts  # POST: Hierarchical analysis with weights
│   │       ├── search/route.ts   # POST: Multi-source search + relevancy scoring
│   │       ├── fetch-doi/route.ts # POST: CrossRef DOI metadata fetcher
│   │       └── generate-persona/route.ts # POST: LLM-generated AIM persona
│   └── lib/
│       ├── prompts.ts            # Research-grade AI prompts & validators
│       ├── deepseek.ts           # DeepSeek client + token utilities
│       ├── arxiv.ts              # ArXiv API client
│       ├── sources/              # Multi-source API clients (7 sources)
│       │   ├── index.ts          # Exports all sources
│       │   ├── aggregator.ts     # Unified search aggregator with deduplication
│       │   ├── openalex.ts       # OpenAlex API (240M+ works)
│       │   ├── semantic-scholar.ts # Semantic Scholar API (TLDR summaries)
│       │   ├── pubmed.ts         # PubMed API (clinical/health psychology)
│       │   ├── psyarxiv.ts       # PsyArXiv preprints (OSF API)
│       │   ├── europe-pmc.ts     # Europe PMC API (behavioral/health psychology)
│       │   ├── doaj.ts           # DOAJ API (open access journals)
│       │   └── eric.ts           # ERIC API (educational psychology)
│       ├── pdf-loader.ts         # Smart PDF extraction (section-based)
│       └── utils.ts              # cn() utility
└── package.json
```

## API Endpoints

### POST /api/analyze
**Input** (FormData):
- `researchContext`: string (primary research scope)
- `files`: File[] (PDFs, max 4)
- `doiArticles`: JSON string (fetched DOI metadata)

**Output**:
```json
{
  "success": true,
  "data": {
    "summary": "Research scope synthesis...",
    "searchQueries": ["query1", "query2", "query3"],
    "hallucinationFilter": ["criterion1", "criterion2", "criterion3"],
    "methodology": "quantitative",
    "keyTerms": ["term1", "term2", ...]
  },
  "weights": { "context": 50, "pdfs": 35, "dois": 15 },
  "tokenEstimate": { "input": 1500, "output": 400, "total": 1900 }
}
```

### POST /api/search
**Input** (JSON):
- `queries`: string[] (from analyze)
- `scopeSummary`: string (from analyze)
- `buzzwords`: string (research context)
- `includePsychology`: boolean (optional, enables psychology-specific filters)

**Output**:
```json
{
  "success": true,
  "articles": [
    {
      "id": "unique-id",
      "doi": "10.1234/example.doi",
      "title": "Paper Title",
      "summary": "2-sentence summary for display...",
      "abstract": "Full abstract text...",
      "authors": ["Author 1", "Author 2"],
      "year": 2024,
      "source": "openalex",
      "link": "https://doi.org/10.1234/example.doi",
      "relevancyScore": 85,
      "relevancyReason": "Strong methodological match...",
      "debate": {
        "originalScore": 92,
        "finalScore": 85,
        "action": "REDUCED",
        "critique": "Methodology mismatch: cross-sectional when longitudinal needed.",
        "wasReviewed": true,
        "reconciliationNote": "Moderate disagreement, weighted average",
        "requiresHumanReview": false
      }
    }
  ],
  "tokenEstimate": {
    "scorer": { "input": 12000, "output": 2500 },
    "critic": { "input": 8000, "output": 2000 },
    "total": 24500
  },
  "metadata": {
    "totalCandidates": 85,
    "returnedArticles": 85,
    "maxArticlesLimit": 100,
    "sources": { "arxiv": 20, "openalex": 30, "semantic-scholar": 20, "pubmed": 15 }
  },
  "debate": {
    "enabled": true,
    "articlesReviewed": 25,
    "scoresReduced": 12,
    "scoresIncreased": 3,
    "scoresKept": 10,
    "humanReviewNeeded": 0,
    "intelligentRouting": true,
    "summary": "Intelligent routing selected 25 articles for Critic review: 12 reduced, 3 increased, 10 kept."
  }
}
```

### POST /api/fetch-doi
**Input** (JSON):
- `dois`: string[] (e.g., ["10.1234/abcd"])

**Output**:
```json
{
  "success": true,
  "articles": [
    { "doi": "10.1234/abcd", "title": "...", "abstract": "...", "authors": [...] }
  ]
}
```

### POST /api/generate-persona
**Input** (JSON):
- `summary`: string (research profile summary)
- `searchQueries`: string[] (generated search queries)
- `exclusionCriteria`: string[] (topics to exclude)
- `buzzwords`: string[] (domain keywords)
- `researchField`: string (selected research field)
- `researchContext`: string (user's research context)

**Output**:
```json
{
  "persona": "# AIM Persona: Research Assistant\n\n## A - PERSONA\n..."
}
```

**Purpose**: Uses DeepSeek LLM to generate a personalized AIM (Agent/Input/Mission) persona that can be copied and pasted into ChatGPT, Claude, or any other AI assistant for specialized research help.

## UI Components

### Search Tab
1. **Step 1 - Research Context** (blue badge, primary)
   - Large textarea for research scope
   - Character counter
   - Helper text

2. **Step 2 - Example Articles** (gray badge, secondary)
   - PDF drag-drop upload (max 4)
   - OR DOI input with chips
   - Fetch DOI Info button

3. **Results Panel** (sticky sidebar)
   - Active context summary
   - Research profile from AI
   - Generated search queries
   - Article cards with:
     - Relevancy score badge (color-coded)
     - Expandable abstracts
     - Save/Copy buttons

### Library Tab
- Saved articles with full metadata
- Remove functionality
- Persistent via localStorage

## Quick Start
```bash
cd research-app
npm install
# Set DEEPSEEK_API_KEY in .env.local
npm run dev
# Open http://localhost:3000
```

## Environment Variables
```
DEEPSEEK_API_KEY=sk-...  # For bulk article scoring
OPENAI_API_KEY=sk-...    # For persona generation (GPT-4o-mini)
```

## Key Design Decisions
1. **Research Context is PRIMARY** - not just keywords, it's the full research lens
2. **Hierarchical weighting** - Context > PDFs > DOIs
3. **Token efficiency** - Smart PDF chunking, never exceed 100k tokens
4. **Professional UI** - Academic aesthetic, not dark/gamer theme
5. **Discriminating scoring** - Most papers should NOT score above 70

## UI Button States
- **"Generate Research Profile"** - Initial state (idle)
- **"Analyzing examples..."** - Processing with spinner
- **"Regenerate Profile"** - After completion (can re-run)

## Recent Session Notes (Jan 2026)
- Switched from `pdf-parse` to `unpdf` for Next.js Turbopack compatibility
- Increased article limit from 40 to 100
- Fixed button state not updating after analysis
- Fixed `article.authors` handling (array vs string)
- Created research-grade prompts in `src/lib/prompts.ts`

### Multi-Source Expansion (Jan 2026)
- **Added 4 academic data sources**: ArXiv, OpenAlex, Semantic Scholar, PubMed
- **Psychology-specific filters**: MeSH terms, Fields of Study, Topic filters
- **Unified article format**: DOI, title, 2-sentence summary, source badge
- **Deduplication**: By DOI and normalized title matching
- **Source badges**: Color-coded (orange=ArXiv, blue=OpenAlex, purple=S2, green=PubMed)
- **Psychology coverage**: Clinical, social, cognitive, developmental, health psychology
- **Total coverage**: 500M+ articles across all sources

### Psychology Subject Filters
| Source | Filter Type | Example Terms |
|--------|------------|---------------|
| OpenAlex | Topics/Fields | Psychology, Clinical Psychology, Social Psychology |
| Semantic Scholar | Fields of Study | Psychology, Clinical Psychology, Health Psychology |
| PubMed | MeSH Terms | psychology[MESH], anxiety disorders[MESH], psychotherapy[MESH] |

### Output Format
Each article now includes:
- **DOI**: Clickable link to https://doi.org/{doi}
- **Title**: Article title with external link
- **Summary**: 2-sentence description (uses Semantic Scholar TLDR when available)
- **Source Badge**: Color-coded badge showing data source
- **Year**: Publication year
- **Authors**: First author + "et al."

### Multi-LLM Debate System (Jan 2026)
Implemented a 2-LLM "Scorer-Critic Pattern" with agent-designed prompts for rigorous relevancy scoring.

#### Agent-Designed Prompts (prompt-engineer + ai-engineer agents)

**Scorer Agent Prompt** - 4-Dimension Rubric:
| Dimension | Max Points | Assessment |
|-----------|-----------|------------|
| Field/Domain Alignment | 25 | Is the article from the correct discipline? |
| Methodology Alignment | 25 | Does the study design match requirements? |
| Population/Context Match | 25 | Does the study population align? |
| Topic/Construct Specificity | 25 | Does it address the specific topic? |

**Automatic Penalties**:
- Review/meta-analysis when primary research needed: -10 points
- Age group mismatch (pediatric vs adult): -12 points
- Species mismatch (animal vs human): -20 points
- Protocol without results: -15 points

**Critic Agent Prompt** - Adversarial Review Framework:
Checks for 6 inflation patterns:
1. Keyword matching without conceptual alignment (-25 to -40)
2. Methodology mismatch (-20 to -35)
3. Population/context mismatch (-15 to -30)
4. Field/discipline mismatch (-15 to -25)
5. Peripheral relevance inflation (-30 to -50)
6. Review paper when primary needed (-10 to -20)

#### Intelligent Routing (AI-engineer recommendation)
Articles are prioritized for Critic review based on:
- High scores (≥70): Potential false positives
- Low confidence (<0.6): Uncertainty signals
- Boundary cases (45-55): Borderline decisions
- Very high scores (≥85): Critical to verify

#### Confidence-Weighted Reconciliation
| Disagreement | Strategy | Flag |
|--------------|----------|------|
| Minor (0-15 pts) | Use Scorer score | None |
| Moderate (16-25 pts) | Weighted average | None |
| Severe (26-40 pts) | Use conservative | None |
| Extreme (>40 pts) | Use conservative | Human review |

**UI Shows**:
- Debate summary banner (X reduced, Y increased, Z kept)
- Score change indicator (↓ or ↑) on reviewed articles
- Original vs final score ("was 85" → now 62)
- Critic's reasoning in red/green box
- Human review flag for extreme disagreements

**Benefits**:
- Reduces false positives from keyword matching
- Catches methodology/population mismatches
- More rigorous scoring (most papers should score < 70)
- Transparent reasoning from both LLMs
- Intelligent token usage via priority-based routing
- Confidence-aware final score calculation

---

## Complete Session Changelog (Jan 2026)

### Phase 1: Multi-Source Expansion
**Files Created**:
- `src/lib/sources/openalex.ts` - OpenAlex API client (240M+ works)
- `src/lib/sources/semantic-scholar.ts` - Semantic Scholar API with TLDR summaries
- `src/lib/sources/pubmed.ts` - PubMed API with MeSH term filtering
- `src/lib/sources/psyarxiv.ts` - PsyArXiv preprints via OSF API
- `src/lib/sources/aggregator.ts` - Unified search with deduplication
- `src/lib/sources/index.ts` - Barrel exports

**Files Modified**:
- `src/app/api/search/route.ts` - Multi-source parallel search
- `src/app/page.tsx` - Source badges, DOI display, debate UI
- `src/lib/pdf-loader.ts` - Fixed `unpdf` array return type

**Features Added**:
- 4 academic data sources (ArXiv, OpenAlex, Semantic Scholar, PubMed)
- Psychology-specific filters (MeSH terms, Fields of Study)
- DOI + 2-sentence summary output format
- Color-coded source badges
- Deduplication by DOI and normalized title

### Phase 2: Multi-LLM Debate System
**Files Modified**:
- `src/lib/prompts.ts` - Complete rewrite with agent-designed prompts
- `src/app/api/search/route.ts` - 3-phase Scorer-Critic-Reconciliation flow

**Features Added**:
- Scorer Agent with 4-dimension rubric (100 points total)
- Critic Agent with adversarial review framework
- Confidence scores (0.0-1.0) for uncertainty quantification
- Debate UI showing score changes and critic reasoning

### Phase 3: Intelligent Orchestration (AI-engineer recommendations)
**Files Modified**:
- `src/lib/prompts.ts` - Added `selectArticlesForCriticReview()`, `reconcileScores()`
- `src/app/api/search/route.ts` - Intelligent routing + confidence-weighted reconciliation

**Features Added**:
- Priority-based article routing for Critic review:
  - High scores (≥70): Potential false positives
  - Low confidence (<0.6): Uncertainty signals
  - Boundary cases (45-55): Borderline decisions
  - Very high scores (≥85): Critical to verify
- Confidence-weighted score reconciliation:
  - Minor disagreement (≤15 pts): Use Scorer score
  - Moderate (16-25 pts): Weighted average
  - Severe (26-40 pts): Conservative score
  - Extreme (>40 pts): Conservative + human review flag
- Human review flagging for extreme disagreements
- Token efficiency via selective Critic review

### Technical Details
**API Changes**:
- `/api/search` response now includes:
  - `debate` object per article (originalScore, finalScore, action, critique, reconciliationNote, requiresHumanReview)
  - `tokenEstimate` with scorer/critic breakdown
  - `debate` summary with routing statistics
  - `intelligentRouting: true` flag

**Prompt Architecture**:
- `SCORER_SYSTEM_PROMPT`: 4-dimension rubric + chain-of-thought + penalties
- `CRITIC_SYSTEM_PROMPT`: Adversarial review + 6 inflation patterns
- `SCORER_FEW_SHOT_EXAMPLE`: Calibrated examples (92, 38, 12, 62)
- `CRITIC_FEW_SHOT_EXAMPLE`: Reduction/increase/keep examples

**Validation Functions**:
- `validateScoringOutput()`: Normalizes scorer JSON with confidence
- `validateCriticOutput()`: Normalizes critic JSON with actions
- `selectArticlesForCriticReview()`: Priority-based routing algorithm
- `reconcileScores()`: Confidence-weighted final score calculation

---

## Phase 4: Extended Database Coverage & UI Improvements (Jan 2026)

### New Academic Databases (3 additional sources)
Expanded from 4 to 7 academic data sources for better psychology coverage:

| Source | Records | Specialization | API |
|--------|---------|----------------|-----|
| **Europe PMC** | 33M+ | Behavioral/health psychology, neuroscience | Free, no auth |
| **DOAJ** | 11M+ | Open access psychology journals | Free, no auth |
| **ERIC** | 1.6M | Educational psychology, learning sciences | Free, no auth |

**Files Created**:
- `src/lib/sources/europe-pmc.ts` - Europe PMC API client
- `src/lib/sources/doaj.ts` - DOAJ API client
- `src/lib/sources/eric.ts` - ERIC API client

**Source Badges** (color-coded):
| Source | Badge Color |
|--------|-------------|
| ArXiv | Orange |
| OpenAlex | Blue |
| Semantic Scholar | Purple |
| PubMed | Green |
| Europe PMC | Teal |
| DOAJ | Amber |
| ERIC | Indigo |

### UI Improvements

#### Editable Research Profile
All generated profile sections are now editable:
- **Research Summary**: Edit the AI-generated scope summary
- **Search Queries**: Add, edit, or remove generated queries
- **Exclusion Criteria**: Customize what topics to exclude

#### Research Field Selector
Dropdown to specify research field for targeted searching:
- Health Psychology, Clinical Psychology, Social Psychology
- Cognitive Psychology, Developmental Psychology
- Neuroscience, Psychiatry, Behavioral Science
- Public Health, Medicine, Education
- Computer Science, Economics

#### Copy DOI Button
Added "Copy DOI" button next to "Copy Title" for quick DOI URL copying (`https://doi.org/{doi}`).

### AIM Persona Export Feature

**Purpose**: Generate a copy-pastable AI persona for use in ChatGPT, Claude, or any AI assistant.

**AIM Framework**:
- **A (Agent/Persona)**: Who the AI should act as - expertise, background, specialization
- **I (Input/Instructions)**: Context, guidelines, do's and don'ts, exclusion criteria
- **M (Mission)**: What the AI should accomplish, specific goals

**How It Works**:
1. Click "Export Persona" button in Research Profile section
2. LLM (DeepSeek) generates personalized persona based on:
   - Research summary
   - Search queries
   - Exclusion criteria
   - Domain keywords
   - Selected research field
3. Modal displays generated persona
4. Click "Copy to Clipboard" to copy
5. Paste into ChatGPT/Claude for specialized research assistance

**Files Modified**:
- `src/app/api/generate-persona/route.ts` - New API endpoint
- `src/app/page.tsx` - Export button, modal, loading states

### Bug Fixes
- Fixed PDF parsing: `unpdf` requires `Uint8Array` not `Buffer`
- Fixed JSON truncation: Increased max_tokens, added JSON repair logic
- Fixed TypeScript types for initialScores in search route

---

## Phase 5: Field-Specific Search & New Sources (Jan 2026)

### Field-Specific Search Configuration
Implemented intelligent database routing based on research field. Each field has its own source priorities, weights, and boost keywords.

**4 Field Clusters**:
| Cluster | Primary Sources | Fields |
|---------|----------------|--------|
| **Clinical/Medical** | PubMed, Europe PMC | Health Psychology, Clinical Psychology, Psychiatry, Neuroscience, Public Health, Medicine |
| **Cognitive/Behavioral** | OpenAlex, Semantic Scholar | Cognitive Psychology, Social Psychology, Developmental Psychology, Behavioral Science |
| **STEM** | ArXiv, Semantic Scholar | Computer Science, Economics |
| **Education** | ERIC (mandatory), OpenAlex | Education |
| **Business** | OpenAlex, Semantic Scholar, CrossRef, CORE | Marketing, Business, Management |

**Files Created**:
- `src/lib/field-config.ts` - Comprehensive field configuration with 16 research fields

**Configuration per Field**:
- `sources`: Ordered list of databases to query
- `sourceWeights`: Multiplier for relevancy scores (e.g., PubMed 2.0x for clinical fields)
- `maxResultsPerSource`: Variable limits per source
- `boostKeywords`: Field-specific terms added to queries
- `psychologyFilter`: Whether to enable psychology-specific filters

### New Data Sources (2 additional)

| Source | Records | Specialization | Badge Color |
|--------|---------|----------------|-------------|
| **CrossRef** | 145M+ | DOI metadata, business/interdisciplinary | Rose |
| **CORE** | 431M+ | Largest open access aggregator, all disciplines | Cyan |

**Files Created**:
- `src/lib/sources/crossref.ts` - CrossRef API client (free, no auth)
- `src/lib/sources/core.ts` - CORE API client (free, API key optional)

**Total Sources**: 9 academic databases
1. ArXiv (STEM preprints)
2. OpenAlex (general, 240M+)
3. Semantic Scholar (AI summaries)
4. PubMed (biomedical)
5. Europe PMC (European biomedical)
6. DOAJ (open access journals)
7. ERIC (education)
8. CrossRef (DOI metadata)
9. CORE (open access aggregator)

### Business Cluster (New Fields)

Added 3 new research fields for business/marketing research:

| Field | Boost Keywords |
|-------|---------------|
| **Marketing** | consumer behavior, brand management, digital marketing, customer experience, market research |
| **Business** | business strategy, corporate governance, entrepreneurship, competitive advantage, business model |
| **Management** | leadership, organizational behavior, HR management, change management, knowledge management |

### Source Weight Scoring
Relevancy scores are now adjusted by source reliability per field:
```
finalScore = rawScore × (0.5 + 0.5 × sourceWeight)
```

Example: A PubMed article with weight 2.0 gets score multiplied by 1.5 for clinical fields.

### Environment Variables
```
DEEPSEEK_API_KEY=sk-...     # For bulk article scoring
OPENAI_API_KEY=sk-...       # For persona generation (GPT-4o-mini)
CORE_API_KEY=...            # Optional: For higher CORE API limits (1000/day vs 100/day)
```

---

## Phase 6: Google Scholar Query Generator (Jan 2026)

### Feature Overview
Since Google Scholar has no API, we generate optimized search queries that users can copy-paste into Google Scholar.

**How It Works**:
1. Click **"Scholar Queries"** button (orange) in Research Profile section
2. LLM generates 3-5 optimized queries using Google Scholar syntax
3. Modal displays each query with:
   - The search string (ready to paste)
   - Purpose explanation
   - Usage tips
   - **Copy** button
   - **Open in Scholar** button (launches Google Scholar directly)

### Google Scholar Operators Supported
```
"exact phrase"     - Exact match
term1 OR term2     - Either term (uppercase OR)
-excludedterm      - Exclude term
intitle:"keyword"  - Title search
author:"lastname"  - Author search
source:"Journal"   - Publication search
after:2020         - Year filter
before:2024        - Year filter
```

### Query Strategy (5 Types)
1. **BROAD** - High recall, survey the field
2. **NARROW** - High precision, specific subtopic
3. **TEMPORAL** - Recent literature with year filter
4. **EXCLUSION** - Remove noise with -term
5. **METHODOLOGY** - Meta-analysis, systematic review

### Files Created
- `src/app/api/generate-scholar-queries/route.ts` - API endpoint with few-shot examples

### Safety Features (Agent-Reviewed)
- JSON parsing with try-catch and validation
- LLM response null checks
- 30-second fetch timeout
- Query length guidance (256 char limit)
- Malformed query filtering

### Example Output
```json
{
  "queries": [
    {
      "query": "\"consumer behavior\" \"social media advertising\" OR \"digital marketing\"",
      "purpose": "Broad search covering core topic with related terminology",
      "tips": "Good starting point to assess literature volume"
    },
    {
      "query": "\"brand engagement\" \"purchase intention\" after:2022",
      "purpose": "Recent literature on key buzzwords",
      "tips": "Post-pandemic research may show shifted behaviors"
    }
  ]
}
```

---

## Updated File Structure

```text
research-app/
├── .env.local                    # API keys (DeepSeek, OpenAI, CORE)
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main UI with Scholar Queries button
│   │   ├── globals.css           # Professional light theme
│   │   ├── layout.tsx            # Root layout
│   │   └── api/
│   │       ├── analyze/route.ts  # Hierarchical analysis
│   │       ├── search/route.ts   # Multi-source search + field config
│   │       ├── fetch-doi/route.ts # CrossRef DOI fetcher
│   │       ├── generate-persona/route.ts # AIM persona generation
│   │       └── generate-scholar-queries/route.ts # Google Scholar queries
│   └── lib/
│       ├── prompts.ts            # Research-grade AI prompts
│       ├── deepseek.ts           # DeepSeek client
│       ├── field-config.ts       # Field-specific search configuration
│       ├── arxiv.ts              # ArXiv API client
│       ├── sources/              # Multi-source API clients (9 sources)
│       │   ├── index.ts          # Exports all sources
│       │   ├── aggregator.ts     # Unified search with field routing
│       │   ├── openalex.ts       # OpenAlex API
│       │   ├── semantic-scholar.ts # Semantic Scholar API
│       │   ├── pubmed.ts         # PubMed API
│       │   ├── psyarxiv.ts       # PsyArXiv preprints
│       │   ├── europe-pmc.ts     # Europe PMC API
│       │   ├── doaj.ts           # DOAJ API
│       │   ├── eric.ts           # ERIC API
│       │   ├── crossref.ts       # CrossRef API (NEW)
│       │   └── core.ts           # CORE API (NEW)
│       ├── pdf-loader.ts         # PDF extraction
│       └── utils.ts              # Utilities
└── package.json
```

---

## Research Fields (16 Total)

| Field | Cluster | Primary Sources |
|-------|---------|-----------------|
| Health Psychology | Clinical/Medical | PubMed, Semantic Scholar, Europe PMC |
| Clinical Psychology | Clinical/Medical | PubMed, Europe PMC, Semantic Scholar |
| Psychiatry | Clinical/Medical | PubMed, Europe PMC, Semantic Scholar |
| Neuroscience | Clinical/Medical | PubMed, ArXiv, Semantic Scholar |
| Public Health | Clinical/Medical | PubMed, Europe PMC, OpenAlex |
| Medicine | Clinical/Medical | PubMed, Europe PMC, Semantic Scholar |
| Cognitive Psychology | Cognitive/Behavioral | Semantic Scholar, PubMed, OpenAlex |
| Social Psychology | Cognitive/Behavioral | OpenAlex, Semantic Scholar, PubMed |
| Developmental Psychology | Cognitive/Behavioral | OpenAlex, PubMed, ERIC |
| Behavioral Science | Cognitive/Behavioral | OpenAlex, PubMed, Semantic Scholar |
| Computer Science | STEM | ArXiv, Semantic Scholar, OpenAlex |
| Economics | STEM | OpenAlex, Semantic Scholar, DOAJ |
| Education | Education | ERIC, OpenAlex, Semantic Scholar |
| Marketing | Business | OpenAlex, Semantic Scholar, CrossRef, CORE |
| Business | Business | OpenAlex, Semantic Scholar, CrossRef, CORE |
| Management | Business | OpenAlex, Semantic Scholar, CrossRef, CORE |
