"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload, FileText, Search, Sparkles, X, Loader2, Hash, BookOpen,
  ChevronDown, ChevronUp, ExternalLink, BookmarkPlus, Bookmark,
  Copy, Check, Info, Pencil, Link2, Save, Share2, GraduationCap,
  Moon, Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/ThemeToggle";

// ============================================================================
// SOURCE COLOR MAP — consistent across app (Step 6H)
// ============================================================================
const SOURCE_COLORS: Record<string, string> = {
  pubmed: "bg-emerald-400",
  openalex: "bg-blue-400",
  "semantic-scholar": "bg-violet-400",
  arxiv: "bg-orange-400",
  "europe-pmc": "bg-teal-400",
  eric: "bg-indigo-400",
  crossref: "bg-rose-400",
  core: "bg-cyan-400",
  doaj: "bg-amber-400",
};

function sourceDotColor(source: string) {
  return SOURCE_COLORS[source] || "bg-slate-400";
}

function sourceLabel(source: string) {
  if (source === "semantic-scholar") return "S2";
  if (source === "europe-pmc") return "EPMC";
  return (source || "unknown").toUpperCase();
}

// ============================================================================
// SCORE BADGE (Step 6D)
// ============================================================================
function ScoreBadge({ score }: { score: number }) {
  const tier =
    score >= 85 ? "excellent" :
    score >= 50 ? "strong" :
    score >= 25 ? "moderate" : "weak";

  return (
    <div className={cn(
      "w-14 h-14 rounded-lg flex flex-col items-center justify-center font-mono-accent shrink-0 border",
      tier === "excellent" && "border-emerald-500/60 text-emerald-400 glow-green bg-emerald-500/10",
      tier === "strong" && "border-cyan-500/40 text-cyan-400 bg-cyan-500/10",
      tier === "moderate" && "border-amber-500/40 text-amber-500/70 bg-amber-500/10",
      tier === "weak" && "border-border text-muted-foreground bg-secondary",
    )}>
      <span className="text-xl font-bold leading-none">{score}</span>
      <span className="text-[9px] uppercase opacity-70 mt-0.5">
        {tier === "excellent" ? "EXCL" : tier === "strong" ? "HIGH" : tier === "moderate" ? "MED" : "LOW"}
      </span>
    </div>
  );
}

// ============================================================================
// SCORE DISTRIBUTION BAR (Step 6D)
// ============================================================================
function ScoreDistributionBar({ articles }: { articles: any[] }) {
  const dist = {
    excellent: articles.filter(a => a.relevancyScore >= 85).length,
    strong: articles.filter(a => a.relevancyScore >= 70 && a.relevancyScore < 85).length,
    moderate: articles.filter(a => a.relevancyScore >= 50 && a.relevancyScore < 70).length,
    weak: articles.filter(a => a.relevancyScore >= 25 && a.relevancyScore < 50).length,
    poor: articles.filter(a => a.relevancyScore < 25).length,
  };
  const total = articles.length || 1;
  const segments = [
    { key: "excellent", count: dist.excellent, color: "bg-emerald-500", label: "85+" },
    { key: "strong", count: dist.strong, color: "bg-cyan-500", label: "70-84" },
    { key: "moderate", count: dist.moderate, color: "bg-amber-500", label: "50-69" },
    { key: "weak", count: dist.weak, color: "bg-orange-500", label: "25-49" },
    { key: "poor", count: dist.poor, color: "bg-slate-500", label: "<25" },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
        {segments.map(s => s.count > 0 && (
          <div key={s.key} className={cn(s.color, "transition-all")} style={{ width: `${(s.count / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex gap-3 text-[10px] font-mono-accent text-muted-foreground">
        {segments.map(s => s.count > 0 && (
          <span key={s.key} className="flex items-center gap-1">
            <span className={cn("w-1.5 h-1.5 rounded-full", s.color)} />
            {s.label}: {s.count}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON LOADER (Step 6F)
// ============================================================================
function SkeletonCard() {
  return (
    <div className="p-4 rounded-lg bg-card border border-border animate-pulse">
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-lg skeleton-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded skeleton-shimmer" />
          <div className="h-3 w-1/2 rounded skeleton-shimmer" />
          <div className="h-3 w-full rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [researchContext, setResearchContext] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "analyzing" | "searching" | "complete">("idle");

  // DOI
  const [dois, setDois] = useState<string[]>([]);
  const [currentDoi, setCurrentDoi] = useState("");
  const [doiArticles, setDoiArticles] = useState<any[]>([]);
  const [isFetchingDoi, setIsFetchingDoi] = useState(false);

  // Expanded / copied
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedDoiId, setCopiedDoiId] = useState<string | null>(null);

  // Analysis
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchStatus, setSearchStatus] = useState<"idle" | "searching" | "complete">("idle");

  // Field
  const [researchField, setResearchField] = useState<string>("");

  // Concept anchor
  const [conceptAnchor, setConceptAnchor] = useState<string>("");
  const [anchorVariations, setAnchorVariations] = useState<string[]>([]);
  const [selectedVariations, setSelectedVariations] = useState<Set<string>>(new Set());

  // Editable profile
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingQueries, setEditingQueries] = useState(false);
  const [editingExclusion, setEditingExclusion] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [editedQueries, setEditedQueries] = useState<string[]>([]);
  const [editedExclusion, setEditedExclusion] = useState<string[]>([]);

  // Persona
  const [copiedPersona, setCopiedPersona] = useState(false);
  const [generatingPersona, setGeneratingPersona] = useState(false);
  const [generatedPersona, setGeneratedPersona] = useState<string | null>(null);
  const [showPersonaModal, setShowPersonaModal] = useState(false);

  // Scholar queries
  interface ScholarQuery { query: string; purpose: string; tips?: string; }
  const [generatingScholarQueries, setGeneratingScholarQueries] = useState(false);
  const [scholarQueries, setScholarQueries] = useState<ScholarQuery[]>([]);
  const [showScholarModal, setShowScholarModal] = useState(false);
  const [copiedScholarQuery, setCopiedScholarQuery] = useState<number | null>(null);

  // Library
  const [savedArticles, setSavedArticles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"search" | "library">("search");

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  // Research field options (grouped)
  const researchFieldGroups = [
    { label: "General", fields: [{ value: "", label: "All Fields" }] },
    { label: "Psychology", fields: [
      { value: "health-psychology", label: "Health Psychology" },
      { value: "clinical-psychology", label: "Clinical Psychology" },
      { value: "social-psychology", label: "Social Psychology" },
      { value: "cognitive-psychology", label: "Cognitive Psychology" },
      { value: "developmental-psychology", label: "Developmental Psychology" },
    ]},
    { label: "Clinical / Medical", fields: [
      { value: "neuroscience", label: "Neuroscience" },
      { value: "psychiatry", label: "Psychiatry" },
      { value: "behavioral-science", label: "Behavioral Science" },
      { value: "public-health", label: "Public Health" },
      { value: "medicine", label: "Medicine" },
    ]},
    { label: "Business", fields: [
      { value: "marketing", label: "Marketing" },
      { value: "business", label: "Business" },
      { value: "management", label: "Management" },
    ]},
    { label: "Other", fields: [
      { value: "education", label: "Education" },
      { value: "computer-science", label: "Computer Science" },
      { value: "economics", label: "Economics" },
    ]},
  ];

  const allFields = researchFieldGroups.flatMap(g => g.fields);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
    if (files.length + droppedFiles.length > 4) { alert("Maximum 4 example files allowed"); return; }
    setFiles(prev => [...prev, ...droppedFiles].slice(0, 4));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter(f => f.type === "application/pdf");
      if (files.length + selected.length > 4) { alert("Maximum 4 example files allowed"); return; }
      setFiles(prev => [...prev, ...selected].slice(0, 4));
    }
  };

  const removeFile = (index: number) => setFiles(files.filter((_, i) => i !== index));

  const addDoi = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && currentDoi.trim()) {
      e.preventDefault();
      if (dois.length >= 10) return;
      const doiValue = currentDoi.trim();
      if (!doiValue.includes("/")) { alert("Please enter a valid DOI (e.g., 10.1234/abcd)"); return; }
      if (!dois.includes(doiValue)) setDois([...dois, doiValue]);
      setCurrentDoi("");
    }
  };

  const removeDoi = (doi: string) => setDois(dois.filter(d => d !== doi));

  const fetchDoiInfo = async () => {
    if (dois.length === 0) { alert("Please add at least one DOI"); return; }
    setIsFetchingDoi(true);
    try {
      const res = await fetch("/api/fetch-doi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dois }) });
      if (!res.ok) throw new Error("Failed to fetch DOI information");
      const data = await res.json();
      setDoiArticles(data.articles || []);
    } catch (e) { console.error(e); alert("Error fetching DOI information."); }
    finally { setIsFetchingDoi(false); }
  };

  const copyDoiUrl = async (doi: string, id: string) => {
    try { await navigator.clipboard.writeText(`https://doi.org/${doi}`); setCopiedDoiId(id); setTimeout(() => setCopiedDoiId(null), 2000); }
    catch (err) { console.error('Failed to copy DOI:', err); }
  };

  // Persona
  const generatePersona = async () => {
    setGeneratingPersona(true);
    try {
      const response = await fetch("/api/generate-persona", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: editedSummary || analysisResult?.summary || "",
          searchQueries: editedQueries.length > 0 ? editedQueries : (analysisResult?.searchQueries || []),
          exclusionCriteria: editedExclusion.length > 0 ? editedExclusion : (analysisResult?.hallucinationFilter || []),
          buzzwords: analysisResult?.buzzwords || [],
          researchField: researchField ? allFields.find(f => f.value === researchField)?.label : "Academic Research",
          researchContext,
        }),
      });
      if (!response.ok) throw new Error("Failed to generate persona");
      const data = await response.json();
      setGeneratedPersona(data.persona);
      setShowPersonaModal(true);
    } catch (err) { console.error(err); alert("Error generating persona."); }
    finally { setGeneratingPersona(false); }
  };

  const copyPersona = async () => {
    if (!generatedPersona) return;
    try { await navigator.clipboard.writeText(generatedPersona); setCopiedPersona(true); setTimeout(() => setCopiedPersona(false), 2000); }
    catch { alert('Unable to copy.'); }
  };

  // Scholar queries
  const generateScholarQueries = async () => {
    setGeneratingScholarQueries(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch("/api/generate-scholar-queries", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({
          summary: editedSummary || analysisResult?.summary || "",
          searchQueries: editedQueries.length > 0 ? editedQueries : (analysisResult?.searchQueries || []),
          buzzwords: analysisResult?.buzzwords || [],
          exclusionCriteria: editedExclusion.length > 0 ? editedExclusion : (analysisResult?.hallucinationFilter || []),
          researchField: researchField ? allFields.find(f => f.value === researchField)?.label : "Academic Research",
        }),
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error("Server error");
      const data = await response.json();
      if (data.success && Array.isArray(data.data?.queries) && data.data.queries.length > 0) {
        const valid = data.data.queries.filter((q: ScholarQuery) => q.query && q.purpose);
        if (valid.length > 0) { setScholarQueries(valid); setShowScholarModal(true); }
        else throw new Error("No valid queries");
      } else throw new Error("Invalid response");
    } catch (err: any) {
      if (err?.name === 'AbortError') alert("Request timed out.");
      else alert(err?.message || "Error generating queries.");
    } finally { setGeneratingScholarQueries(false); }
  };

  const copyScholarQuery = async (query: string, index: number) => {
    try { await navigator.clipboard.writeText(query); setCopiedScholarQuery(index); setTimeout(() => setCopiedScholarQuery(null), 2000); }
    catch (err) { console.error(err); }
  };

  const openInScholar = (query: string) => {
    window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`, '_blank');
  };

  // Initialize editable fields
  useEffect(() => {
    if (analysisResult) {
      setEditedSummary(analysisResult.summary || "");
      setEditedQueries(analysisResult.searchQueries || []);
      setEditedExclusion(analysisResult.hallucinationFilter || []);
    }
  }, [analysisResult]);

  // Main analysis
  const startAnalysis = async () => {
    const hasRawDois = dois.length > 0;
    const hasPreFetchedDois = doiArticles.length > 0;
    const hasDois = hasRawDois || hasPreFetchedDois;
    if (!researchContext.trim() && files.length === 0 && !hasDois) { alert("Please provide a research context and/or example articles."); return; }
    if (!researchContext.trim() && (files.length > 0 || hasDois)) { alert("Please provide a research context."); return; }

    setStatus("analyzing");
    setAnalysisResult(null);
    setSearchResults([]);
    setSearchStatus("idle");

    const formData = new FormData();
    files.forEach(f => formData.append("files", f));
    formData.append("researchContext", researchContext.trim());
    formData.append("researchField", researchField || "general");
    if (conceptAnchor.trim()) {
      formData.append("conceptAnchor", conceptAnchor.trim());
      const variations = Array.from(selectedVariations);
      if (variations.length > 0) formData.append("anchorVariations", JSON.stringify(variations));
    }
    if (doiArticles.length > 0) formData.append("doiArticles", JSON.stringify(doiArticles));
    const preFetchedDoiSet = new Set(doiArticles.map(a => a.doi));
    const unfetchedDois = dois.filter(d => !preFetchedDoiSet.has(d));
    if (unfetchedDois.length > 0) formData.append("rawDois", JSON.stringify(unfetchedDois));

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setAnalysisResult(data.data);
      setStatus("complete");
      if (data.suggestedVariations && Array.isArray(data.suggestedVariations)) setAnchorVariations(data.suggestedVariations);
    } catch (e) { console.error(e); alert("Error analyzing files."); setStatus("idle"); }
  };

  const performSearch = async () => {
    if (!analysisResult) return;
    setSearchStatus("searching");
    try {
      const res = await fetch("/api/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: editedQueries.length > 0 ? editedQueries : analysisResult.searchQueries,
          scopeSummary: editedSummary || analysisResult.summary,
          buzzwords: researchContext.trim(),
          researchField: researchField || null,
          includePsychology: researchField.includes('psychology') || researchField === 'psychiatry'
        }),
      });
      const data = await res.json();
      setSearchResults(data.articles || []);
      setSearchStatus("complete");
    } catch (e) { console.error(e); alert("Search failed"); setSearchStatus("idle"); }
  };

  // Library persistence
  useEffect(() => {
    const saved = localStorage.getItem("research-app-library");
    if (saved) { try { setSavedArticles(JSON.parse(saved)); } catch {} }
  }, []);
  useEffect(() => { localStorage.setItem("research-app-library", JSON.stringify(savedArticles)); }, [savedArticles]);

  const toggleSaveArticle = (article: any) => {
    const isSaved = savedArticles.some(a => a.id === article.id);
    if (isSaved) {
      setSavedArticles(prev => prev.filter(a => a.id !== article.id));
      showToast("Removed from library");
    } else {
      setSavedArticles(prev => [{
        id: article.id, title: article.title, link: article.link || article.id,
        authors: article.authors, published: article.published, year: article.year,
        summary: article.summary, relevancyScore: article.relevancyScore,
        relevancyReason: article.relevancyReason, doi: article.doi || null,
        source: article.source || 'arxiv', savedAt: new Date().toISOString()
      }, ...prev]);
      showToast("Saved to library");
    }
  };

  const toggleExpandArticle = (id: string) => {
    const next = new Set(expandedArticles);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedArticles(next);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); showToast("Copied!"); }
    catch (err) { console.error(err); }
  };

  const estimatedTokens = files.length * 2000 + doiArticles.length * 1500 + researchContext.length * 2;

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <main className="min-h-screen bg-background">
      {/* HEADER BAR (Step 6F) */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold font-mono-accent tracking-tight text-foreground">
              RESEARCHME
            </h1>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-accent bg-primary/10 text-primary border border-primary/20">
              v2.0
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setActiveTab("library")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-mono-accent border transition-colors",
                activeTab === "library"
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>{savedArticles.length}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* TAB SYSTEM (Step 6F) */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          {(["search", "library"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-all relative font-mono-accent uppercase tracking-wider",
                activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "search" ? "Research" : "Library"}
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {activeTab === "search" ? (
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
            {/* LEFT COLUMN: INPUTS */}
            <div className="space-y-5">
              {/* STEP 1: Research Context */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border p-5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground font-bold text-xs font-mono-accent shrink-0">1</div>
                  <div className="flex-1">
                    <label className="text-sm font-semibold text-foreground block mb-0.5">Research Context</label>
                    <p className="text-xs text-muted-foreground">Describe your research scope — this is the lens for all evaluations.</p>
                  </div>
                </div>

                <textarea
                  value={researchContext}
                  onChange={(e) => setResearchContext(e.target.value)}
                  placeholder="Describe your research scope..."
                  rows={4}
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none text-sm font-mono-accent"
                />
                <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground font-mono-accent">
                  <span>Be specific about domain and objectives</span>
                  <span className={researchContext.length > 200 ? "text-primary" : ""}>{researchContext.length} chars</span>
                </div>

                {/* Field Selector */}
                <div className="mt-4 pt-4 border-t border-border">
                  <label className="text-xs font-medium text-muted-foreground block mb-2 font-mono-accent uppercase tracking-wider">Research Field</label>
                  <select
                    value={researchField}
                    onChange={(e) => setResearchField(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm"
                  >
                    {researchFieldGroups.map(group => (
                      <optgroup key={group.label} label={group.label}>
                        {group.fields.map(field => (
                          <option key={field.value} value={field.value}>{field.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Concept Anchor */}
                <div className="mt-4 pt-4 border-t border-border">
                  <label className="text-xs font-medium text-muted-foreground block mb-2 font-mono-accent uppercase tracking-wider">Concept Anchor</label>
                  <input
                    type="text"
                    value={conceptAnchor}
                    onChange={(e) => { setConceptAnchor(e.target.value); setAnchorVariations([]); setSelectedVariations(new Set()); }}
                    placeholder='"stress", "anxiety", "mindfulness"...'
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm font-mono-accent"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono-accent">Lock a core concept in all generated queries</p>

                  {conceptAnchor.trim().length > 2 && anchorVariations.length > 0 && (
                    <div className="mt-2 p-2.5 bg-primary/5 rounded-lg border border-primary/10">
                      <p className="text-[10px] font-mono-accent text-primary mb-1.5 uppercase tracking-wider">Variations</p>
                      <div className="flex flex-wrap gap-1.5">
                        {anchorVariations.map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setSelectedVariations(prev => {
                              const n = new Set(prev);
                              n.has(v) ? n.delete(v) : n.add(v);
                              return n;
                            })}
                            className={cn(
                              "px-2 py-0.5 text-[10px] rounded-full border font-mono-accent transition-all",
                              selectedVariations.has(v)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                            )}
                          >
                            {selectedVariations.has(v) ? "* " : ""}{v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* STEP 2: Example Articles */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-xl border border-border p-5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary text-foreground font-bold text-xs font-mono-accent shrink-0">2</div>
                  <div className="flex-1">
                    <label className="text-sm font-semibold text-foreground block mb-0.5">Example Articles</label>
                    <p className="text-xs text-muted-foreground">Upload PDFs or provide DOIs (max 4)</p>
                  </div>
                </div>

                {/* PDF Upload Zone */}
                <div
                  className={cn(
                    "relative group cursor-pointer border-2 border-dashed rounded-lg p-5 transition-all",
                    isDragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground",
                    files.length >= 4 && "opacity-50 cursor-not-allowed"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <input type="file" id="file-upload" className="hidden" multiple accept=".pdf" onChange={handleFileSelect} disabled={files.length >= 4} />
                  <div className="flex flex-col items-center text-center space-y-1">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <p className="text-xs font-mono-accent text-muted-foreground">
                      {isDragging ? "DROP FILES" : "Upload PDF files or drag here"}
                    </p>
                  </div>
                </div>

                {/* File Chips */}
                <AnimatePresence>
                  {files.length > 0 && (
                    <motion.div className="space-y-1.5 mt-3">
                      {files.map((file, i) => (
                        <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-secondary border border-border group hover:border-muted-foreground"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-xs text-foreground truncate font-mono-accent">{file.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono-accent">{(file.size / 1024).toFixed(0)}KB</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="p-1 hover:bg-destructive/10 rounded transition-colors">
                            <X className="w-3.5 h-3.5 text-muted-foreground group-hover:text-destructive" />
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Divider */}
                <div className="relative flex items-center justify-center py-3">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative px-3 bg-card"><span className="text-[10px] font-mono-accent text-muted-foreground uppercase">or DOI</span></div>
                </div>

                {/* DOI Input */}
                <div className="relative">
                  <input
                    type="text" value={currentDoi} onChange={(e) => setCurrentDoi(e.target.value)} onKeyDown={addDoi}
                    placeholder="10.1234/abcd + Enter"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 pl-8 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 text-xs font-mono-accent"
                    disabled={dois.length >= 10}
                  />
                  <Hash className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                </div>

                {/* DOI Chips */}
                {dois.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <AnimatePresence>
                      {dois.map(doi => (
                        <motion.span key={doi} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono-accent bg-primary/10 text-primary border border-primary/20"
                        >
                          {doi}
                          <button onClick={() => removeDoi(doi)} className="ml-1.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button>
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* Fetch DOIs */}
                {dois.length > 0 && doiArticles.length === 0 && (
                  <button onClick={fetchDoiInfo} disabled={isFetchingDoi}
                    className="mt-2 w-full py-2 rounded-lg border border-border bg-secondary hover:bg-muted text-muted-foreground text-xs font-mono-accent transition-colors disabled:opacity-50"
                  >
                    {isFetchingDoi ? (
                      <span className="flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />FETCHING...</span>
                    ) : "PREVIEW DOIS"}
                  </button>
                )}

                {/* Fetched DOI Preview */}
                {doiArticles.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5 mt-2">
                    {doiArticles.map((article, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground font-medium line-clamp-2">{article.title}</p>
                            {article.authors && <p className="text-[10px] text-muted-foreground mt-0.5">{article.authors}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>

              {/* CTA BUTTON */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <button
                  onClick={startAnalysis}
                  disabled={status === "analyzing" || !researchContext.trim()}
                  className="w-full py-3.5 rounded-xl bg-primary hover:brightness-110 text-primary-foreground font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed font-mono-accent uppercase tracking-wider"
                >
                  {status === "analyzing" ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />ANALYZING...</span>
                  ) : status === "complete" ? (
                    <span className="flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" />REGENERATE PROFILE</span>
                  ) : (
                    <span className="flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" />GENERATE RESEARCH PROFILE</span>
                  )}
                </button>
                <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground font-mono-accent">
                  <span>~{estimatedTokens.toLocaleString()} tokens</span>
                  <span>{files.length + doiArticles.length} example(s)</span>
                </div>
              </motion.div>
            </div>

            {/* RIGHT COLUMN: RESULTS */}
            <div className="lg:sticky lg:top-20 h-fit">
              <div className="bg-card rounded-xl border border-border p-5 min-h-[500px] flex flex-col">
                {/* IDLE STATE */}
                {status === "idle" && !analysisResult && (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-3">
                    <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                      <Search className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground text-sm">No analysis yet</p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono-accent">Complete steps 1-2 and generate</p>
                    </div>
                  </div>
                )}

                {/* LOADING STATE */}
                {status === "analyzing" && (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm font-mono-accent text-muted-foreground cursor-blink">ANALYZING</p>
                  </div>
                )}

                {(status === "complete" || analysisResult) && analysisResult && (
                  <div className="space-y-5 animate-in">
                    {/* Active Context */}
                    {researchContext && (
                      <div className="pb-3 border-b border-border">
                        <div className="flex items-start gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-[10px] font-mono-accent text-muted-foreground uppercase tracking-wider mb-0.5">Active Context</h4>
                            <p className="text-xs text-foreground leading-relaxed line-clamp-2">{researchContext}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Search Loading */}
                    {searchStatus === "searching" && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-mono-accent text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span className="cursor-blink">SEARCHING 9 DATABASES</span>
                        </div>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                      </div>
                    )}

                    {/* SEARCH RESULTS */}
                    {searchResults.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 font-mono-accent uppercase tracking-wider">
                            <Search className="w-4 h-4 text-primary" />
                            Results
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono-accent">{searchResults.length}</span>
                        </div>

                        <ScoreDistributionBar articles={searchResults} />

                        {/* Pipeline info */}
                        <div className="flex items-center gap-3 text-[10px] font-mono-accent text-muted-foreground py-1.5 px-2.5 rounded bg-secondary/50 border border-border">
                          <span className="text-primary">PRE-FILTER</span>
                          <span className="text-border">{">"}</span>
                          <span className="text-accent">DEEPSEEK</span>
                          <span className="text-border">{">"}</span>
                          <span className="text-emerald-400">GPT-4o-mini</span>
                        </div>

                        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
                          {searchResults.map((article) => {
                            const isSaved = savedArticles.some(a => a.id === article.id);
                            const isExpanded = expandedArticles.has(article.id);

                            return (
                              <motion.div
                                key={article.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-all hover:border-l-2 hover:border-l-primary"
                              >
                                <div className="flex gap-3">
                                  <ScoreBadge score={article.relevancyScore || 0} />

                                  <div className="flex-1 min-w-0">
                                    <a
                                      href={article.link || article.id}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-foreground hover:text-primary transition-colors text-sm inline-flex items-center gap-1 group/link"
                                    >
                                      <span className="line-clamp-2">{article.title}</span>
                                      <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                                    </a>

                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      {/* Source dot + label */}
                                      <span className="inline-flex items-center gap-1">
                                        <span className={cn("w-2 h-2 rounded-full", sourceDotColor(article.source))} />
                                        <span className="text-[10px] font-mono-accent text-muted-foreground">{sourceLabel(article.source)}</span>
                                      </span>
                                      <span className="text-[10px] text-border">|</span>
                                      <span className="text-[10px] text-muted-foreground font-mono-accent">{article.year || "N/A"}</span>
                                      {article.authors && article.authors.length > 0 && (
                                        <>
                                          <span className="text-[10px] text-border">|</span>
                                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                            {Array.isArray(article.authors) ? article.authors[0] : article.authors.split(',')[0]} et al.
                                          </span>
                                        </>
                                      )}
                                      {/* Score breakdown */}
                                      {article.scoring?.sourceBonus !== undefined && article.scoring.sourceBonus !== 0 && (
                                        <>
                                          <span className="text-[10px] text-border">|</span>
                                          <span className={cn(
                                            "text-[10px] font-mono-accent",
                                            article.scoring.sourceBonus > 0 ? "text-emerald-400" : "text-orange-400"
                                          )}>
                                            {article.scoring.sourceBonus > 0 ? "+" : ""}{article.scoring.sourceBonus} boost
                                          </span>
                                        </>
                                      )}
                                    </div>

                                    {article.doi && (
                                      <div className="mt-1 flex items-center gap-1">
                                        <span className="text-[10px] text-muted-foreground font-mono-accent">DOI:</span>
                                        <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer"
                                          className="text-[10px] text-accent hover:text-primary font-mono-accent truncate">{article.doi}</a>
                                      </div>
                                    )}

                                    {/* Relevancy reason */}
                                    {article.relevancyReason && (
                                      <div className="mt-2 p-2 rounded bg-secondary/50 border border-border">
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                          <span className="font-semibold text-primary">Why: </span>{article.relevancyReason}
                                        </p>
                                      </div>
                                    )}

                                    {/* Abstract */}
                                    {article.summary && (
                                      <div className="mt-2">
                                        <p className={cn("text-xs text-muted-foreground leading-relaxed", !isExpanded && "line-clamp-2")}>{article.summary}</p>
                                        <button onClick={() => toggleExpandArticle(article.id)}
                                          className="mt-1 text-[10px] font-mono-accent text-primary hover:text-accent flex items-center gap-0.5"
                                        >
                                          {isExpanded ? <>LESS <ChevronUp className="w-3 h-3" /></> : <>MORE <ChevronDown className="w-3 h-3" /></>}
                                        </button>
                                      </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
                                      <button onClick={() => toggleSaveArticle(article)}
                                        className={cn("flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono-accent transition-colors active:scale-[0.98]",
                                          isSaved ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"
                                        )}>
                                        {isSaved ? <><Bookmark className="w-3 h-3 fill-current" />SAVED</> : <><BookmarkPlus className="w-3 h-3" />SAVE</>}
                                      </button>
                                      <button onClick={() => copyToClipboard(article.title, article.id)}
                                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono-accent bg-secondary text-muted-foreground hover:text-foreground transition-colors active:scale-[0.98]">
                                        {copiedId === article.id ? <><Check className="w-3 h-3" />OK</> : <><Copy className="w-3 h-3" />COPY</>}
                                      </button>
                                      {article.doi && (
                                        <button onClick={() => copyDoiUrl(article.doi, `doi-${article.id}`)}
                                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono-accent bg-accent/10 text-accent hover:bg-accent/20 transition-colors active:scale-[0.98]">
                                          {copiedDoiId === `doi-${article.id}` ? <><Check className="w-3 h-3" />OK</> : <><Link2 className="w-3 h-3" />DOI</>}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* RESEARCH PROFILE */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-semibold text-foreground font-mono-accent uppercase tracking-wider">Profile</h3>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={generatePersona} disabled={generatingPersona}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono-accent text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                            {generatingPersona ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
                            PERSONA
                          </button>
                          <button onClick={generateScholarQueries} disabled={generatingScholarQueries}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50">
                            {generatingScholarQueries ? <Loader2 className="w-3 h-3 animate-spin" /> : <GraduationCap className="w-3 h-3" />}
                            SCHOLAR
                          </button>
                          <button onClick={() => setEditingSummary(!editingSummary)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono-accent text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                            {editingSummary ? <Save className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                            {editingSummary ? "SAVE" : "EDIT"}
                          </button>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                        {editingSummary ? (
                          <textarea value={editedSummary} onChange={(e) => setEditedSummary(e.target.value)} rows={4}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" />
                        ) : (
                          <p className="text-xs text-muted-foreground leading-relaxed">{editedSummary || analysisResult.summary}</p>
                        )}
                      </div>
                    </div>

                    {/* QUERIES */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-mono-accent text-muted-foreground uppercase tracking-wider">Search Queries</h4>
                        <button onClick={() => setEditingQueries(!editingQueries)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono-accent text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                          {editingQueries ? <Save className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                          {editingQueries ? "SAVE" : "EDIT"}
                        </button>
                      </div>
                      <div className="grid gap-1.5">
                        {(editingQueries ? editedQueries : (editedQueries.length > 0 ? editedQueries : analysisResult.searchQueries))?.map((q: string, i: number) => (
                          editingQueries ? (
                            <input key={i} type="text" value={q} onChange={(e) => { const n = [...editedQueries]; n[i] = e.target.value; setEditedQueries(n); }}
                              className="w-full px-3 py-1.5 rounded bg-background border border-border text-[11px] font-mono-accent text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                          ) : (
                            <div key={i} className="px-3 py-1.5 rounded bg-secondary border border-border text-[11px] font-mono-accent text-muted-foreground">{q}</div>
                          )
                        ))}
                        {editingQueries && (
                          <button onClick={() => setEditedQueries([...editedQueries, ""])}
                            className="px-3 py-1.5 rounded border-2 border-dashed border-border text-[10px] font-mono-accent text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                            + ADD QUERY
                          </button>
                        )}
                      </div>
                    </div>

                    {/* SEARCH BUTTON */}
                    {searchStatus === "idle" && (
                      <button onClick={performSearch}
                        className="w-full py-3 rounded-lg bg-accent hover:brightness-110 text-accent-foreground font-semibold text-sm transition-colors active:scale-[0.98] font-mono-accent uppercase tracking-wider">
                        <span className="flex items-center justify-center gap-2"><Search className="w-4 h-4" />SEARCH ACADEMIC ARTICLES</span>
                      </button>
                    )}

                    {/* EXCLUSION CRITERIA */}
                    {(editedExclusion.length > 0 || (analysisResult.hallucinationFilter && analysisResult.hallucinationFilter.length > 0)) && (
                      <div className="space-y-2 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-mono-accent text-muted-foreground uppercase tracking-wider">Exclusion Criteria</h4>
                          <button onClick={() => setEditingExclusion(!editingExclusion)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono-accent text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                            {editingExclusion ? <Save className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                            {editingExclusion ? "SAVE" : "EDIT"}
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {(editingExclusion ? editedExclusion : (editedExclusion.length > 0 ? editedExclusion : analysisResult.hallucinationFilter)).map((f: string, i: number) => (
                            editingExclusion ? (
                              <div key={i} className="flex items-center gap-1.5">
                                <input type="text" value={f} onChange={(e) => { const n = [...editedExclusion]; n[i] = e.target.value; setEditedExclusion(n); }}
                                  className="flex-1 px-3 py-1.5 rounded bg-background border border-destructive/30 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-destructive/50" />
                                <button onClick={() => setEditedExclusion(editedExclusion.filter((_, idx) => idx !== i))}
                                  className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded bg-destructive/5 border border-destructive/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1 shrink-0" />
                                <span className="flex-1">{f}</span>
                              </div>
                            )
                          ))}
                          {editingExclusion && (
                            <button onClick={() => setEditedExclusion([...editedExclusion, ""])}
                              className="w-full px-3 py-1.5 rounded border-2 border-dashed border-destructive/20 text-[10px] font-mono-accent text-destructive hover:border-destructive/50 transition-colors">
                              + ADD EXCLUSION
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* LIBRARY VIEW */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto">
            {savedArticles.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-xl border border-border">
                <div className="w-14 h-14 mx-auto mb-3 rounded-lg bg-secondary flex items-center justify-center">
                  <BookmarkPlus className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1 font-mono-accent">EMPTY LIBRARY</h3>
                <p className="text-xs text-muted-foreground">Save articles from search results</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-foreground font-mono-accent uppercase tracking-wider">Saved Articles</h2>
                  <span className="text-xs text-muted-foreground font-mono-accent">{savedArticles.length} article{savedArticles.length !== 1 ? 's' : ''}</span>
                </div>

                {savedArticles.map((article) => {
                  const isExpanded = expandedArticles.has(article.id);
                  return (
                    <motion.div key={article.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-card rounded-lg border border-border p-4 hover:border-primary/30 transition-all"
                    >
                      <div className="flex gap-3">
                        <ScoreBadge score={article.relevancyScore || 0} />
                        <div className="flex-1 min-w-0">
                          <a href={article.link} target="_blank" rel="noopener noreferrer"
                            className="font-medium text-foreground hover:text-primary transition-colors text-sm inline-flex items-center gap-1 group/link">
                            <span className="line-clamp-2">{article.title}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                          </a>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {article.source && (
                              <span className="inline-flex items-center gap-1">
                                <span className={cn("w-2 h-2 rounded-full", sourceDotColor(article.source))} />
                                <span className="text-[10px] font-mono-accent text-muted-foreground">{sourceLabel(article.source)}</span>
                              </span>
                            )}
                            <span className="text-[10px] text-border">|</span>
                            <span className="text-[10px] text-muted-foreground font-mono-accent">{article.year || "N/A"}</span>
                            <span className="text-[10px] text-border">|</span>
                            <span className="text-[10px] text-muted-foreground font-mono-accent">Saved {new Date(article.savedAt).toLocaleDateString()}</span>
                          </div>

                          {article.relevancyReason && (
                            <div className="mt-2 p-2 rounded bg-secondary/50 border border-border">
                              <p className="text-[11px] text-muted-foreground"><span className="font-semibold text-primary">Why: </span>{article.relevancyReason}</p>
                            </div>
                          )}

                          {article.summary && (
                            <div className="mt-2">
                              <p className={cn("text-xs text-muted-foreground leading-relaxed", !isExpanded && "line-clamp-2")}>{article.summary}</p>
                              <button onClick={() => toggleExpandArticle(article.id)}
                                className="mt-1 text-[10px] font-mono-accent text-primary hover:text-accent flex items-center gap-0.5">
                                {isExpanded ? <>LESS <ChevronUp className="w-3 h-3" /></> : <>MORE <ChevronDown className="w-3 h-3" /></>}
                              </button>
                            </div>
                          )}

                          {article.doi && (
                            <div className="mt-1 flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground font-mono-accent">DOI:</span>
                              <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-accent font-mono-accent">{article.doi}</a>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
                            <button onClick={() => copyToClipboard(article.title, article.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono-accent bg-secondary text-muted-foreground hover:text-foreground transition-colors active:scale-[0.98]">
                              {copiedId === article.id ? <><Check className="w-3 h-3" />OK</> : <><Copy className="w-3 h-3" />COPY</>}
                            </button>
                            {article.doi && (
                              <button onClick={() => copyDoiUrl(article.doi, `lib-doi-${article.id}`)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono-accent bg-accent/10 text-accent hover:bg-accent/20 transition-colors active:scale-[0.98]">
                                {copiedDoiId === `lib-doi-${article.id}` ? <><Check className="w-3 h-3" />OK</> : <><Link2 className="w-3 h-3" />DOI</>}
                              </button>
                            )}
                            <button onClick={() => toggleSaveArticle(article)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono-accent bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors active:scale-[0.98]">
                              <X className="w-3 h-3" />REMOVE
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* PERSONA MODAL */}
      <AnimatePresence>
        {showPersonaModal && generatedPersona && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPersonaModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card rounded-xl border border-border shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground font-mono-accent">AIM RESEARCH PERSONA</h3>
                </div>
                <button onClick={() => setShowPersonaModal(false)} className="p-1.5 rounded hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="p-5 overflow-y-auto max-h-[50vh]">
                <pre className="whitespace-pre-wrap text-xs text-foreground font-mono-accent bg-secondary rounded-lg p-4 border border-border leading-relaxed">{generatedPersona}</pre>
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground font-mono-accent">Copy and paste into any AI assistant</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowPersonaModal(false)} className="px-3 py-1.5 rounded text-xs font-mono-accent text-muted-foreground hover:bg-secondary">CLOSE</button>
                  <button onClick={copyPersona} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono-accent bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98]">
                    {copiedPersona ? <><Check className="w-3.5 h-3.5" />COPIED</> : <><Copy className="w-3.5 h-3.5" />COPY</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SCHOLAR QUERIES MODAL */}
      <AnimatePresence>
        {showScholarModal && scholarQueries.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowScholarModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card rounded-xl border border-border shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-semibold text-foreground font-mono-accent">GOOGLE SCHOLAR QUERIES</h3>
                </div>
                <button onClick={() => setShowScholarModal(false)} className="p-1.5 rounded hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="p-5 overflow-y-auto max-h-[50vh] space-y-3">
                {scholarQueries.map((item, index) => (
                  <div key={index} className="bg-secondary rounded-lg p-3 border border-border">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <code className="block text-xs text-foreground font-mono-accent bg-background rounded p-2 border border-border break-all">{item.query}</code>
                        <p className="mt-1.5 text-[11px] text-muted-foreground"><span className="font-medium">Purpose:</span> {item.purpose}</p>
                        {item.tips && <p className="mt-0.5 text-[10px] text-muted-foreground italic">Tip: {item.tips}</p>}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <button onClick={() => copyScholarQuery(item.query, index)}
                          className="p-1.5 rounded bg-background border border-border hover:bg-muted transition-colors" title="Copy">
                          {copiedScholarQuery === index ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                        <button onClick={() => openInScholar(item.query)}
                          className="p-1.5 rounded bg-background border border-border hover:bg-muted transition-colors" title="Open in Scholar">
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-border">
                <button onClick={() => setShowScholarModal(false)}
                  className="w-full py-2 rounded text-xs font-mono-accent text-muted-foreground hover:bg-secondary transition-colors">CLOSE</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg bg-card border border-primary/30 shadow-lg"
          >
            <p className="text-xs font-mono-accent text-primary">{toast}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
