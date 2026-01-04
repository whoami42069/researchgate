"use client";

import { useState, useEffect } from "react";
import { Upload, FileText, Search, Sparkles, X, Loader2, Hash, BookOpen, ChevronDown, ChevronUp, ExternalLink, BookmarkPlus, Bookmark, Copy, Check, Info, Pencil, Link2, Save, Share2, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [researchContext, setResearchContext] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "analyzing" | "searching" | "complete">("idle");

  // DOI input states
  const [dois, setDois] = useState<string[]>([]);
  const [currentDoi, setCurrentDoi] = useState("");
  const [doiArticles, setDoiArticles] = useState<any[]>([]);
  const [isFetchingDoi, setIsFetchingDoi] = useState(false);

  // Expanded article state
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
    if (files.length + droppedFiles.length > 4) {
      alert("Maximum 4 example files allowed");
      return;
    }
    setFiles(prev => [...prev, ...droppedFiles].slice(0, 4));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter(f => f.type === "application/pdf");
      if (files.length + selected.length > 4) {
        alert("Maximum 4 example files allowed");
        return;
      }
      setFiles(prev => [...prev, ...selected].slice(0, 4));
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // DOI input handlers
  const addDoi = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && currentDoi.trim()) {
      e.preventDefault();
      if (dois.length >= 10) return;
      const doiValue = currentDoi.trim();
      // Basic DOI validation
      if (!doiValue.includes("/")) {
        alert("Please enter a valid DOI (e.g., 10.1234/abcd)");
        return;
      }
      if (!dois.includes(doiValue)) {
        setDois([...dois, doiValue]);
      }
      setCurrentDoi("");
    }
  };

  const removeDoi = (doi: string) => {
    setDois(dois.filter(d => d !== doi));
  };

  const fetchDoiInfo = async () => {
    if (dois.length === 0) {
      alert("Please add at least one DOI");
      return;
    }

    setIsFetchingDoi(true);
    try {
      const res = await fetch("/api/fetch-doi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dois }),
      });

      if (!res.ok) throw new Error("Failed to fetch DOI information");

      const data = await res.json();
      setDoiArticles(data.articles || []);
    } catch (e) {
      console.error(e);
      alert("Error fetching DOI information. See console.");
    } finally {
      setIsFetchingDoi(false);
    }
  };

  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchStatus, setSearchStatus] = useState<"idle" | "searching" | "complete">("idle");

  // Research field selector
  const [researchField, setResearchField] = useState<string>("");

  // Concept Anchor - locks a core term in all generated queries
  const [conceptAnchor, setConceptAnchor] = useState<string>("");
  const [anchorVariations, setAnchorVariations] = useState<string[]>([]);
  const [selectedVariations, setSelectedVariations] = useState<Set<string>>(new Set());

  // Editable profile states
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingQueries, setEditingQueries] = useState(false);
  const [editingExclusion, setEditingExclusion] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [editedQueries, setEditedQueries] = useState<string[]>([]);
  const [editedExclusion, setEditedExclusion] = useState<string[]>([]);
  const [copiedDoiId, setCopiedDoiId] = useState<string | null>(null);

  // Research field options (grouped by cluster)
  const researchFields = [
    { value: "", label: "All Fields" },
    // Psychology Cluster
    { value: "health-psychology", label: "Health Psychology" },
    { value: "clinical-psychology", label: "Clinical Psychology" },
    { value: "social-psychology", label: "Social Psychology" },
    { value: "cognitive-psychology", label: "Cognitive Psychology" },
    { value: "developmental-psychology", label: "Developmental Psychology" },
    // Medical Cluster
    { value: "neuroscience", label: "Neuroscience" },
    { value: "psychiatry", label: "Psychiatry" },
    { value: "behavioral-science", label: "Behavioral Science" },
    { value: "public-health", label: "Public Health" },
    { value: "medicine", label: "Medicine" },
    // Business Cluster
    { value: "marketing", label: "Marketing" },
    { value: "business", label: "Business" },
    { value: "management", label: "Management" },
    // Other
    { value: "education", label: "Education" },
    { value: "computer-science", label: "Computer Science" },
    { value: "economics", label: "Economics" },
  ];

  // Copy DOI URL handler
  const copyDoiUrl = async (doi: string, id: string) => {
    try {
      await navigator.clipboard.writeText(`https://doi.org/${doi}`);
      setCopiedDoiId(id);
      setTimeout(() => setCopiedDoiId(null), 2000);
    } catch (err) {
      console.error('Failed to copy DOI:', err);
    }
  };

  // AIM Persona generation state
  const [copiedPersona, setCopiedPersona] = useState(false);
  const [generatingPersona, setGeneratingPersona] = useState(false);
  const [generatedPersona, setGeneratedPersona] = useState<string | null>(null);
  const [showPersonaModal, setShowPersonaModal] = useState(false);

  // Generate AIM Persona via LLM
  const generatePersona = async () => {
    setGeneratingPersona(true);
    try {
      const response = await fetch("/api/generate-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: editedSummary || analysisResult?.summary || "",
          searchQueries: editedQueries.length > 0 ? editedQueries : (analysisResult?.searchQueries || []),
          exclusionCriteria: editedExclusion.length > 0 ? editedExclusion : (analysisResult?.hallucinationFilter || []),
          buzzwords: analysisResult?.buzzwords || [],
          researchField: researchField ? researchFields.find(f => f.value === researchField)?.label : "Academic Research",
          researchContext: researchContext,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate persona");

      const data = await response.json();
      setGeneratedPersona(data.persona);
      setShowPersonaModal(true);
    } catch (err) {
      console.error('Failed to generate persona:', err);
      alert("Error generating persona. Please try again.");
    } finally {
      setGeneratingPersona(false);
    }
  };

  const copyPersona = async () => {
    if (!generatedPersona) return;

    // Try modern clipboard API first, then fallback for iOS
    const copyToClipboard = async (text: string): Promise<boolean> => {
      // Method 1: Modern Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (err) {
          console.log('Clipboard API failed, trying fallback...');
        }
      }

      // Method 2: Fallback for iOS and older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);

        // iOS specific: need to select with setSelectionRange
        textArea.focus();
        textArea.setSelectionRange(0, text.length);

        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      } catch (err) {
        console.error('Fallback copy failed:', err);
        return false;
      }
    };

    const success = await copyToClipboard(generatedPersona);
    if (success) {
      setCopiedPersona(true);
      setTimeout(() => setCopiedPersona(false), 2000);
    } else {
      alert('Unable to copy. Please select the text manually and copy.');
    }
  };

  // Google Scholar query generation state
  interface ScholarQuery {
    query: string;
    purpose: string;
    tips?: string;
  }
  const [generatingScholarQueries, setGeneratingScholarQueries] = useState(false);
  const [scholarQueries, setScholarQueries] = useState<ScholarQuery[]>([]);
  const [showScholarModal, setShowScholarModal] = useState(false);
  const [copiedScholarQuery, setCopiedScholarQuery] = useState<number | null>(null);

  // Generate Google Scholar queries
  const generateScholarQueries = async () => {
    setGeneratingScholarQueries(true);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch("/api/generate-scholar-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          summary: editedSummary || analysisResult?.summary || "",
          searchQueries: editedQueries.length > 0 ? editedQueries : (analysisResult?.searchQueries || []),
          buzzwords: analysisResult?.buzzwords || [],
          exclusionCriteria: editedExclusion.length > 0 ? editedExclusion : (analysisResult?.hallucinationFilter || []),
          researchField: researchField ? researchFields.find(f => f.value === researchField)?.label : "Academic Research",
        }),
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      // Validate response structure
      if (data.success && Array.isArray(data.data?.queries) && data.data.queries.length > 0) {
        // Filter to only valid queries with required fields
        const validQueries = data.data.queries.filter(
          (q: ScholarQuery) => q.query && q.purpose
        );
        if (validQueries.length > 0) {
          setScholarQueries(validQueries);
          setShowScholarModal(true);
        } else {
          throw new Error("No valid queries generated");
        }
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      console.error('Failed to generate Scholar queries:', err);
      if (err instanceof Error && err.name === 'AbortError') {
        alert("Request timed out. Please try again.");
      } else {
        alert(err instanceof Error ? err.message : "Error generating queries. Please try again.");
      }
    } finally {
      setGeneratingScholarQueries(false);
    }
  };

  const copyScholarQuery = async (query: string, index: number) => {
    try {
      await navigator.clipboard.writeText(query);
      setCopiedScholarQuery(index);
      setTimeout(() => setCopiedScholarQuery(null), 2000);
    } catch (err) {
      console.error('Failed to copy query:', err);
    }
  };

  const openInScholar = (query: string) => {
    const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  };

  // Initialize editable fields when analysis completes
  useEffect(() => {
    if (analysisResult) {
      setEditedSummary(analysisResult.summary || "");
      setEditedQueries(analysisResult.searchQueries || []);
      setEditedExclusion(analysisResult.hallucinationFilter || []);
    }
  }, [analysisResult]);

  const startAnalysis = async () => {
    // Check for any input: research context, files, pre-fetched DOIs, or raw DOIs
    const hasRawDois = dois.length > 0;
    const hasPreFetchedDois = doiArticles.length > 0;
    const hasDois = hasRawDois || hasPreFetchedDois;

    if (!researchContext.trim() && files.length === 0 && !hasDois) {
      alert("Please provide a research context and/or example articles (PDFs or DOIs).");
      return;
    }
    // Research context alone is valid (will search based on context)
    if (!researchContext.trim() && (files.length > 0 || hasDois)) {
      alert("Please provide a research context to guide the analysis.");
      return;
    }

    setStatus("analyzing");
    setAnalysisResult(null);
    setSearchResults([]);
    setSearchStatus("idle");

    const formData = new FormData();
    files.forEach(f => formData.append("files", f));
    formData.append("researchContext", researchContext.trim());
    formData.append("researchField", researchField || "general");

    // Include concept anchor if provided
    if (conceptAnchor.trim()) {
      formData.append("conceptAnchor", conceptAnchor.trim());
      // Include selected variations
      const variations = Array.from(selectedVariations);
      if (variations.length > 0) {
        formData.append("anchorVariations", JSON.stringify(variations));
      }
    }

    // Include pre-fetched DOI articles if available
    if (doiArticles.length > 0) {
      formData.append("doiArticles", JSON.stringify(doiArticles));
    }

    // Include raw DOIs for auto-fetching (if not already pre-fetched)
    // Only send DOIs that haven't been fetched yet
    const preFetchedDoiSet = new Set(doiArticles.map(a => a.doi));
    const unfetchedDois = dois.filter(d => !preFetchedDoiSet.has(d));
    if (unfetchedDois.length > 0) {
      formData.append("rawDois", JSON.stringify(unfetchedDois));
    }

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Analysis failed");

      const data = await res.json();
      setAnalysisResult(data.data);
      setStatus("complete");

      // Set suggested variations if returned from API
      if (data.suggestedVariations && Array.isArray(data.suggestedVariations)) {
        setAnchorVariations(data.suggestedVariations);
      }
    } catch (e) {
      console.error(e);
      alert("Error analyzing files. See console.");
      setStatus("idle");
    }
  };

  const performSearch = async () => {
    if (!analysisResult) return;

    setSearchStatus("searching");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    } catch (e) {
      console.error(e);
      alert("Search failed");
      setSearchStatus("idle");
    }
  };

  // State for Library
  const [savedArticles, setSavedArticles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"search" | "library">("search");

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("research-app-library");
    if (saved) {
      try {
        setSavedArticles(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load library", e);
      }
    }
  }, []);

  // Save to LocalStorage whenever library changes
  useEffect(() => {
    localStorage.setItem("research-app-library", JSON.stringify(savedArticles));
  }, [savedArticles]);

  const toggleSaveArticle = (article: any) => {
    const isSaved = savedArticles.some(a => a.id === article.id);
    if (isSaved) {
      setSavedArticles(prev => prev.filter(a => a.id !== article.id));
    } else {
      // Store only lightweight metadata
      const lightweightArticle = {
        id: article.id,
        title: article.title,
        link: article.link || article.id,
        authors: article.authors,
        published: article.published,
        year: article.year,
        summary: article.summary,
        relevancyScore: article.relevancyScore,
        relevancyReason: article.relevancyReason,
        doi: article.doi || null,
        source: article.source || 'arxiv',
        savedAt: new Date().toISOString()
      };
      setSavedArticles(prev => [lightweightArticle, ...prev]);
    }
  };

  const toggleExpandArticle = (id: string) => {
    const newExpanded = new Set(expandedArticles);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedArticles(newExpanded);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Token usage estimate
  const estimatedTokens = files.length * 2000 + doiArticles.length * 1500 + researchContext.length * 2;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Research Discovery Platform
              </h1>
              <p className="text-sm text-slate-600 mt-0.5">
                AI-powered academic article discovery with context-aware relevancy scoring
              </p>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-8 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("search")}
            className={cn(
              "px-6 py-3 text-sm font-medium transition-all relative",
              activeTab === "search"
                ? "text-blue-700"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Search & Analysis
            {activeTab === "search" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={cn(
              "px-6 py-3 text-sm font-medium transition-all relative flex items-center gap-2",
              activeTab === "library"
                ? "text-blue-700"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Saved Library
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
              {savedArticles.length}
            </span>
            {activeTab === "library" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        </div>

        {activeTab === "search" ? (
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8">
            {/* Left Column: Inputs */}
            <div className="space-y-6">
              {/* STEP 1: Research Context - PRIMARY INPUT */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <label className="text-lg font-semibold text-slate-900 block mb-1">
                      Research Context
                    </label>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Describe your research scope or domain. This is the lens through which all articles will be evaluated for relevancy.
                    </p>
                  </div>
                </div>

                <textarea
                  value={researchContext}
                  onChange={(e) => setResearchContext(e.target.value)}
                  placeholder="Example: Gender-based cognitive biases and heuristics in clinical decision making, focusing on diagnostic errors and treatment disparities in emergency medicine settings"
                  rows={5}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-base"
                />

                <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" />
                    <span>Be specific about your research domain and objectives</span>
                  </div>
                  <span className={cn(
                    researchContext.length > 200 ? "text-green-600" : "text-slate-400"
                  )}>
                    {researchContext.length} characters
                  </span>
                </div>

                {/* Research Field Selector */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <label className="text-sm font-medium text-slate-700 block mb-2">
                    Research Field (optional)
                  </label>
                  <select
                    value={researchField}
                    onChange={(e) => setResearchField(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {researchFields.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Selecting a field helps focus searches on relevant databases and filters
                  </p>
                </div>

                {/* Concept Anchor */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <label className="text-sm font-medium text-slate-700 block mb-2">
                    🔒 Concept Anchor (optional)
                  </label>
                  <input
                    type="text"
                    value={conceptAnchor}
                    onChange={(e) => {
                      setConceptAnchor(e.target.value);
                      setAnchorVariations([]);
                      setSelectedVariations(new Set());
                    }}
                    placeholder='e.g., "stress", "anxiety", "mindfulness"...'
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Lock a core concept — all search queries will include this term or its variations
                  </p>

                  {/* Variation suggestions - shown when anchor is entered */}
                  {conceptAnchor.trim().length > 2 && anchorVariations.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-xs font-medium text-blue-700 mb-2">Suggested variations:</p>
                      <div className="flex flex-wrap gap-2">
                        {anchorVariations.map((variation) => (
                          <button
                            key={variation}
                            type="button"
                            onClick={() => {
                              setSelectedVariations(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(variation)) {
                                  newSet.delete(variation);
                                } else {
                                  newSet.add(variation);
                                }
                                return newSet;
                              });
                            }}
                            className={cn(
                              "px-2.5 py-1 text-xs rounded-full border transition-all",
                              selectedVariations.has(variation)
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-blue-700 border-blue-200 hover:border-blue-400"
                            )}
                          >
                            {selectedVariations.has(variation) ? "✓ " : ""}{variation}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* STEP 2: Example Articles - SECONDARY INPUT */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-600 text-white font-bold text-sm shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <label className="text-base font-semibold text-slate-900 block mb-1">
                      Example Articles
                    </label>
                    <p className="text-sm text-slate-600">
                      Upload representative PDFs or provide DOIs (max 4 examples)
                    </p>
                  </div>
                </div>

                {/* File Upload */}
                <div
                  className={cn(
                    "relative group cursor-pointer border-2 border-dashed rounded-xl p-6 transition-all",
                    isDragging
                      ? "border-blue-500 bg-blue-50/50"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
                    files.length >= 4 && "opacity-50 cursor-not-allowed"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    multiple
                    accept=".pdf"
                    onChange={handleFileSelect}
                    disabled={files.length >= 4}
                  />
                  <div className="flex flex-col items-center justify-center text-center space-y-2">
                    <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-blue-50 transition-colors">
                      <Upload className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700 text-sm">Upload PDF files</p>
                      <p className="text-xs text-slate-500 mt-0.5">or drag and drop here</p>
                    </div>
                  </div>
                </div>

                {/* File List */}
                <AnimatePresence>
                  {files.length > 0 && (
                    <motion.div className="space-y-2 mt-4">
                      {files.map((file, i) => (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          key={i}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 group hover:bg-slate-100"
                        >
                          <div className="flex items-center space-x-3 overflow-hidden">
                            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="text-sm text-slate-700 truncate">{file.name}</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                            className="p-1 hover:bg-red-100 rounded-md transition-colors"
                          >
                            <X className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Divider */}
                <div className="relative flex items-center justify-center py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative px-3 bg-white">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">or</span>
                  </div>
                </div>

                {/* DOI Input */}
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={currentDoi}
                      onChange={(e) => setCurrentDoi(e.target.value)}
                      onKeyDown={addDoi}
                      placeholder="Enter DOI (e.g., 10.1234/abcd) and press Enter"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 pl-10 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      disabled={dois.length >= 10}
                    />
                    <Hash className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  </div>

                  {/* DOI Chips */}
                  <div className="flex flex-wrap gap-2">
                    <AnimatePresence>
                      {dois.map((doi) => (
                        <motion.span
                          key={doi}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                        >
                          {doi}
                          <button onClick={() => removeDoi(doi)} className="ml-2 hover:text-emerald-900">
                            <X className="w-3 h-3" />
                          </button>
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Optional: Preview DOI Button */}
                  {dois.length > 0 && doiArticles.length === 0 && (
                    <div className="space-y-2">
                      <button
                        onClick={fetchDoiInfo}
                        disabled={isFetchingDoi}
                        className="w-full py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isFetchingDoi ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Fetching preview...
                          </span>
                        ) : (
                          "Preview DOIs (Optional)"
                        )}
                      </button>
                      <p className="text-xs text-slate-400 text-center">
                        DOIs will be auto-fetched when you generate the profile
                      </p>
                    </div>
                  )}

                  {/* Fetched DOI Articles */}
                  {doiArticles.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-2"
                    >
                      {doiArticles.map((article, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-emerald-50 border border-emerald-200"
                        >
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-900 font-medium line-clamp-2">{article.title}</p>
                              {article.authors && (
                                <p className="text-xs text-slate-600 mt-1">{article.authors}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Analysis Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <button
                  onClick={startAnalysis}
                  disabled={status === "analyzing" || !researchContext.trim()}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-base transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {status === "analyzing" ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing examples...
                    </span>
                  ) : status === "complete" ? (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Regenerate Profile
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Generate Research Profile
                    </span>
                  )}
                </button>

                {/* Token estimate */}
                <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                  <span>Estimated tokens: ~{estimatedTokens.toLocaleString()}</span>
                  <span>{files.length + doiArticles.length} example(s) provided</span>
                </div>
              </motion.div>
            </div>

            {/* Right Column: Results */}
            <div className="lg:sticky lg:top-8 h-fit">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[600px] flex flex-col">
                {status === "idle" && !analysisResult && (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                      <Search className="w-10 h-10" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-slate-600">No analysis yet</p>
                      <p className="text-sm text-slate-400 mt-1">Complete steps 1-2 and click "Generate Research Profile"</p>
                    </div>
                  </div>
                )}

                {(status === "complete" || analysisResult) && analysisResult && (
                  <div className="space-y-6 animate-in fade-in">
                    {/* Research Context Summary (sticky) */}
                    {researchContext && (
                      <div className="sticky top-0 bg-white/95 backdrop-blur-sm pb-4 border-b border-slate-100 -mx-6 px-6 -mt-6 pt-6 z-10">
                        <div className="flex items-start gap-2">
                          <BookOpen className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Active Context</h4>
                            <p className="text-sm text-slate-700 leading-relaxed line-clamp-2">{researchContext}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Search Status */}
                    {searchStatus === "searching" && (
                      <div className="flex flex-col items-center justify-center p-8 space-y-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <p className="text-sm text-slate-600">Searching ArXiv, OpenAlex, Semantic Scholar, PubMed...</p>
                      </div>
                    )}

                    {/* SEARCH RESULTS - NOW ABOVE RESEARCH PROFILE */}
                    {searchResults.length > 0 && (
                      <div className="space-y-4 -mx-6 px-6 py-5 bg-gradient-to-b from-emerald-50/50 to-transparent border-y border-emerald-200">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Search className="w-5 h-5 text-emerald-600" />
                            Discovered Articles
                          </h3>
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold">{searchResults.length} results</span>
                        </div>

                        {/* Scoring Summary Banner */}
                        <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-emerald-50 border border-blue-200">
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-blue-700">DeepSeek Filter:</span>
                              <span className="text-slate-600">Quick relevance check</span>
                            </div>
                            <span className="text-slate-300">→</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-emerald-700">GPT-4o-mini:</span>
                              <span className="text-slate-600">Detailed scoring</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                          {searchResults.map((article) => {
                            const isSaved = savedArticles.some(a => a.id === article.id);
                            const isExpanded = expandedArticles.has(article.id);

                            return (
                              <motion.div
                                key={article.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group p-4 rounded-xl bg-white hover:shadow-md border border-slate-200 transition-all"
                              >
                                <div className="flex gap-3">
                                  {/* Relevancy Badge with Source Bonus */}
                                  <div className="shrink-0">
                                    <div className={cn(
                                      "w-16 h-16 rounded-lg flex flex-col items-center justify-center text-xs font-bold relative",
                                      article.relevancyScore >= 75
                                        ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300"
                                        : article.relevancyScore >= 50
                                        ? "bg-amber-100 text-amber-700 border-2 border-amber-300"
                                        : article.relevancyScore >= 25
                                        ? "bg-orange-100 text-orange-700 border-2 border-orange-300"
                                        : "bg-slate-100 text-slate-700 border-2 border-slate-300"
                                    )}>
                                      <span className="text-lg">{article.relevancyScore || 0}</span>
                                      {/* Show source bonus if exists */}
                                      {(article as any).scoring?.sourceBonus !== undefined && (article as any).scoring?.sourceBonus !== 0 ? (
                                        <span className={cn(
                                          "text-[8px] font-medium",
                                          (article as any).scoring.sourceBonus > 0 ? "text-emerald-600" : "text-orange-600"
                                        )}>
                                          {(article as any).scoring.sourceBonus > 0 ? "+" : ""}{(article as any).scoring.sourceBonus} src
                                        </span>
                                      ) : (
                                        <span className="text-[9px] opacity-70">
                                          {article.relevancyScore >= 75 ? "HIGH" :
                                           article.relevancyScore >= 50 ? "MED" :
                                           article.relevancyScore >= 25 ? "LOW" : "MIN"}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    {/* Title and metadata */}
                                    <div className="mb-2">
                                      <a
                                        href={article.link || article.id}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold text-slate-900 hover:text-blue-700 transition-colors inline-flex items-center gap-1.5 group/link"
                                      >
                                        <span className="line-clamp-2">{article.title}</span>
                                        <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                                      </a>
                                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        {/* Source Badge */}
                                        <span className={cn(
                                          "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border",
                                          article.source === 'arxiv' ? "bg-orange-50 text-orange-700 border-orange-200" :
                                          article.source === 'openalex' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                          article.source === 'semantic-scholar' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                          article.source === 'pubmed' ? "bg-green-50 text-green-700 border-green-200" :
                                          "bg-slate-50 text-slate-700 border-slate-200"
                                        )}>
                                          {article.source === 'semantic-scholar' ? 'S2' : article.source || 'ArXiv'}
                                        </span>
                                        <span className="text-xs text-slate-400">•</span>
                                        <span className="text-xs text-slate-500">{article.year || new Date(article.published).getFullYear()}</span>
                                        {article.authors && article.authors.length > 0 && (
                                          <>
                                            <span className="text-xs text-slate-400">•</span>
                                            <span className="text-xs text-slate-500 truncate">{Array.isArray(article.authors) ? article.authors[0] : article.authors.split(',')[0]} et al.</span>
                                          </>
                                        )}
                                      </div>
                                      {/* DOI Display */}
                                      {article.doi && (
                                        <div className="mt-1.5 flex items-center gap-1.5">
                                          <span className="text-[10px] text-slate-400 font-medium">DOI:</span>
                                          <a
                                            href={`https://doi.org/${article.doi}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:text-blue-800 font-mono truncate"
                                          >
                                            {article.doi}
                                          </a>
                                        </div>
                                      )}
                                    </div>

                                    {/* Relevancy reason from GPT-4o-mini */}
                                    {article.relevancyReason && (
                                      <div className="mb-3 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                                        <p className="text-xs text-slate-700 leading-relaxed">
                                          <span className="font-semibold text-emerald-700">Why: </span>
                                          {article.relevancyReason}
                                        </p>
                                      </div>
                                    )}

                                    {/* Abstract (expandable) */}
                                    {article.summary && (
                                      <div>
                                        <p className={cn(
                                          "text-sm text-slate-600 leading-relaxed",
                                          !isExpanded && "line-clamp-2"
                                        )}>
                                          {article.summary}
                                        </p>
                                        <button
                                          onClick={() => toggleExpandArticle(article.id)}
                                          className="mt-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                        >
                                          {isExpanded ? (
                                            <>Show less <ChevronUp className="w-3 h-3" /></>
                                          ) : (
                                            <>Show more <ChevronDown className="w-3 h-3" /></>
                                          )}
                                        </button>
                                      </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                                      <button
                                        onClick={() => toggleSaveArticle(article)}
                                        className={cn(
                                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                          isSaved
                                            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        )}
                                      >
                                        {isSaved ? (
                                          <>
                                            <Bookmark className="w-3.5 h-3.5 fill-current" />
                                            Saved
                                          </>
                                        ) : (
                                          <>
                                            <BookmarkPlus className="w-3.5 h-3.5" />
                                            Save
                                          </>
                                        )}
                                      </button>

                                      <button
                                        onClick={() => copyToClipboard(article.title, article.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                      >
                                        {copiedId === article.id ? (
                                          <>
                                            <Check className="w-3.5 h-3.5" />
                                            Copied
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3.5 h-3.5" />
                                            Copy Title
                                          </>
                                        )}
                                      </button>

                                      {/* Copy DOI Button */}
                                      {article.doi && (
                                        <button
                                          onClick={() => copyDoiUrl(article.doi, `doi-${article.id}`)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                        >
                                          {copiedDoiId === `doi-${article.id}` ? (
                                            <>
                                              <Check className="w-3.5 h-3.5" />
                                              Copied
                                            </>
                                          ) : (
                                            <>
                                              <Link2 className="w-3.5 h-3.5" />
                                              Copy DOI
                                            </>
                                          )}
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

                    {/* RESEARCH PROFILE - NOW BELOW SEARCH RESULTS */}
                    <div className="space-y-3 pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-blue-600" />
                          <h3 className="text-lg font-semibold text-slate-900">
                            Research Profile
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Export AIM Persona Button */}
                          <button
                            onClick={generatePersona}
                            disabled={generatingPersona}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Generate AIM Persona for ChatGPT/Claude"
                          >
                            {generatingPersona ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Share2 className="w-3.5 h-3.5" />
                            )}
                            {generatingPersona ? "Generating..." : "Export Persona"}
                          </button>
                          {/* Google Scholar Queries Button */}
                          <button
                            onClick={generateScholarQueries}
                            disabled={generatingScholarQueries}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Generate optimized Google Scholar search queries"
                          >
                            {generatingScholarQueries ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <GraduationCap className="w-3.5 h-3.5" />
                            )}
                            {generatingScholarQueries ? "Generating..." : "Scholar Queries"}
                          </button>
                          {/* Edit Button */}
                          <button
                            onClick={() => {
                              if (editingSummary) {
                                setEditingSummary(false);
                              } else {
                                setEditingSummary(true);
                              }
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            {editingSummary ? <Save className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                            {editingSummary ? "Save" : "Edit"}
                          </button>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                        {editingSummary ? (
                          <textarea
                            value={editedSummary}
                            onChange={(e) => setEditedSummary(e.target.value)}
                            rows={4}
                            className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        ) : (
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {editedSummary || analysisResult.summary}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Generated Queries - Editable */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-700">Search Queries Generated</h4>
                        <button
                          onClick={() => {
                            if (editingQueries) {
                              setEditingQueries(false);
                            } else {
                              setEditingQueries(true);
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          {editingQueries ? <Save className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                          {editingQueries ? "Save" : "Edit"}
                        </button>
                      </div>
                      <div className="grid gap-2">
                        {(editingQueries ? editedQueries : (editedQueries.length > 0 ? editedQueries : analysisResult.searchQueries))?.map((q: string, i: number) => (
                          editingQueries ? (
                            <input
                              key={i}
                              type="text"
                              value={q}
                              onChange={(e) => {
                                const newQueries = [...editedQueries];
                                newQueries[i] = e.target.value;
                                setEditedQueries(newQueries);
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div key={i} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
                              {q}
                            </div>
                          )
                        ))}
                        {editingQueries && (
                          <button
                            onClick={() => setEditedQueries([...editedQueries, ""])}
                            className="px-3 py-2 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                          >
                            + Add Query
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Search Action */}
                    {searchStatus === "idle" && (
                      <button
                        onClick={performSearch}
                        className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors shadow-sm"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <Search className="w-4 h-4" />
                          Search Academic Articles
                        </span>
                      </button>
                    )}

                    {/* Exclusion Criteria - Editable */}
                    {(editedExclusion.length > 0 || (analysisResult.hallucinationFilter && analysisResult.hallucinationFilter.length > 0)) && (
                      <div className="space-y-3 pt-4 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-700">Exclusion Criteria</h4>
                          <button
                            onClick={() => {
                              if (editingExclusion) {
                                setEditingExclusion(false);
                              } else {
                                setEditingExclusion(true);
                              }
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            {editingExclusion ? <Save className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                            {editingExclusion ? "Save" : "Edit"}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(editingExclusion ? editedExclusion : (editedExclusion.length > 0 ? editedExclusion : analysisResult.hallucinationFilter)).map((f: string, i: number) => (
                            editingExclusion ? (
                              <div key={i} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={f}
                                  onChange={(e) => {
                                    const newExclusion = [...editedExclusion];
                                    newExclusion[i] = e.target.value;
                                    setEditedExclusion(newExclusion);
                                  }}
                                  className="flex-1 px-3 py-2 rounded-lg bg-white border border-red-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-400"
                                />
                                <button
                                  onClick={() => {
                                    const newExclusion = editedExclusion.filter((_, idx) => idx !== i);
                                    setEditedExclusion(newExclusion);
                                  }}
                                  className="p-2 rounded-lg hover:bg-red-100 text-red-500"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div key={i} className="flex items-start gap-3 text-sm text-slate-600 p-3 rounded-lg bg-red-50 border border-red-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                <span className="flex-1">{f}</span>
                              </div>
                            )
                          ))}
                          {editingExclusion && (
                            <button
                              onClick={() => setEditedExclusion([...editedExclusion, ""])}
                              className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-red-200 text-xs text-red-500 hover:border-red-400 hover:text-red-600 transition-colors"
                            >
                              + Add Exclusion Criterion
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
          // Library View
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto"
          >
            {savedArticles.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <BookmarkPlus className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Your library is empty</h3>
                <p className="text-slate-600 text-sm">Save articles from your search results to build your research library</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">Saved Articles</h2>
                  <span className="text-sm text-slate-600">{savedArticles.length} article{savedArticles.length !== 1 ? 's' : ''}</span>
                </div>

                {savedArticles.map((article) => {
                  const isExpanded = expandedArticles.has(article.id);

                  return (
                    <motion.div
                      key={article.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex gap-4">
                        {/* Relevancy Badge */}
                        <div className="shrink-0">
                          <div className={cn(
                            "w-14 h-14 rounded-xl flex flex-col items-center justify-center text-sm font-bold",
                            article.relevancyScore > 75
                              ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300"
                              : article.relevancyScore > 50
                              ? "bg-amber-100 text-amber-700 border-2 border-amber-300"
                              : "bg-slate-100 text-slate-700 border-2 border-slate-300"
                          )}>
                            <span className="text-xl">{article.relevancyScore || 0}</span>
                            <span className="text-[10px] opacity-70">MATCH</span>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Title and metadata */}
                          <div className="mb-3">
                            <a
                              href={article.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xl font-semibold text-slate-900 hover:text-blue-700 transition-colors inline-flex items-center gap-2 group/link"
                            >
                              <span>{article.title}</span>
                              <ExternalLink className="w-4 h-4 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                            </a>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {/* Source Badge */}
                              {article.source && (
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border",
                                  article.source === 'arxiv' ? "bg-orange-50 text-orange-700 border-orange-200" :
                                  article.source === 'openalex' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                  article.source === 'semantic-scholar' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                  article.source === 'pubmed' ? "bg-green-50 text-green-700 border-green-200" :
                                  "bg-slate-50 text-slate-700 border-slate-200"
                                )}>
                                  {article.source === 'semantic-scholar' ? 'S2' : article.source}
                                </span>
                              )}
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-sm text-slate-500">Saved {new Date(article.savedAt).toLocaleDateString()}</span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-sm text-slate-500">{article.year || new Date(article.published).getFullYear()}</span>
                              {article.authors && (
                                <>
                                  <span className="text-xs text-slate-400">•</span>
                                  <span className="text-sm text-slate-500 truncate">{Array.isArray(article.authors) ? article.authors[0] : article.authors.split(',')[0]} et al.</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Relevancy reason */}
                          {article.relevancyReason && (
                            <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                              <p className="text-sm text-slate-700 italic leading-relaxed">
                                <span className="font-semibold text-blue-700">Why it matches: </span>
                                {article.relevancyReason}
                              </p>
                            </div>
                          )}

                          {/* Abstract */}
                          {article.summary && (
                            <div className="mb-3">
                              <p className={cn(
                                "text-sm text-slate-600 leading-relaxed",
                                !isExpanded && "line-clamp-3"
                              )}>
                                {article.summary}
                              </p>
                              <button
                                onClick={() => toggleExpandArticle(article.id)}
                                className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                              >
                                {isExpanded ? (
                                  <>Show less <ChevronUp className="w-3 h-3" /></>
                                ) : (
                                  <>Read full abstract <ChevronDown className="w-3 h-3" /></>
                                )}
                              </button>
                            </div>
                          )}

                          {/* DOI */}
                          {article.doi && (
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs text-slate-500 font-medium">DOI:</span>
                              <a
                                href={`https://doi.org/${article.doi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200 hover:border-blue-300 transition-colors"
                              >
                                {article.doi}
                              </a>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => copyToClipboard(article.title, article.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                              {copiedId === article.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy Title
                                </>
                              )}
                            </button>

                            {/* Copy DOI Button */}
                            {article.doi && (
                              <button
                                onClick={() => copyDoiUrl(article.doi, `lib-doi-${article.id}`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              >
                                {copiedDoiId === `lib-doi-${article.id}` ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Link2 className="w-3.5 h-3.5" />
                                    Copy DOI
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              onClick={() => toggleSaveArticle(article)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              Remove
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

      {/* AIM Persona Modal */}
      <AnimatePresence>
        {showPersonaModal && generatedPersona && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPersonaModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">AIM Research Persona</h3>
                    <p className="text-sm text-slate-500">Copy and paste into ChatGPT, Claude, or any AI assistant</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPersonaModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Modal Body - Persona Content */}
              <div className="p-6 overflow-y-auto max-h-[50vh]">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono bg-slate-50 rounded-xl p-4 border border-slate-200 leading-relaxed">
                  {generatedPersona}
                </pre>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-500">
                  Generated based on your research profile
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowPersonaModal(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={copyPersona}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    {copiedPersona ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy to Clipboard
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Scholar Queries Modal */}
      <AnimatePresence>
        {showScholarModal && scholarQueries.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowScholarModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-orange-50 to-amber-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Google Scholar Queries</h3>
                    <p className="text-sm text-slate-500">Optimized search queries for Google Scholar</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowScholarModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Modal Body - Query List */}
              <div className="p-6 overflow-y-auto max-h-[50vh] space-y-4">
                {scholarQueries.map((item, index) => (
                  <div key={index} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <code className="block text-sm text-slate-800 font-mono bg-white rounded-lg p-3 border border-slate-200 break-all">
                          {item.query}
                        </code>
                        <p className="mt-2 text-sm text-slate-600">
                          <span className="font-medium">Purpose:</span> {item.purpose}
                        </p>
                        {item.tips && (
                          <p className="mt-1 text-xs text-slate-500 italic">
                            Tip: {item.tips}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => copyScholarQuery(item.query, index)}
                          className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                          title="Copy query"
                        >
                          {copiedScholarQuery === index ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                        <button
                          onClick={() => openInScholar(item.query)}
                          className="p-2 rounded-lg bg-orange-100 hover:bg-orange-200 transition-colors"
                          title="Open in Google Scholar"
                        >
                          <ExternalLink className="w-4 h-4 text-orange-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-500">
                  Click the arrow to open directly in Google Scholar
                </p>
                <button
                  onClick={() => setShowScholarModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
