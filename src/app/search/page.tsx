"use client";

import { API_BASE_URL } from "@/config";
import { useState } from "react";
import Layout from "@/components/Layout";

type SearchMode = "semantic" | "tags";

interface SemanticResult {
    id: number;
    video_id: number;
    timestamp: number;
    caption: string;
    video_filename: string;
    video_filepath: string;
    confidence?: number;
}

interface TagResult {
    video_id: number;
    timestamp: number;
    confidence: number;
    object_type: string;
    video_filename: string;
}

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState<SearchMode>("semantic");
    const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
    const [tagResults, setTagResults] = useState<TagResult[]>([]);
    const [minConfidence, setMinConfidence] = useState(0);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setSearching(true);
        setHasSearched(true);
        setError(null);

        try {
            const opInfo = localStorage.getItem("sentinel_operator");
            if (!opInfo) return;
            const operator = JSON.parse(opInfo);

            if (mode === "semantic") {
                const res = await fetch(
                    `${API_BASE_URL}/search/semantic?query=${encodeURIComponent(query)}&operator_id=${operator.id}&limit=20&threshold=0.98`
                );
                if (!res.ok) {
                    const err = await res.json();
                    setError(err.detail || "Semantic search failed");
                    setSemanticResults([]);
                } else {
                    const data = await res.json();
                    setSemanticResults(data);
                }
            } else {
                const res = await fetch(
                    `${API_BASE_URL}/search?object=${encodeURIComponent(query)}&operator_id=${operator.id}`
                );
                if (!res.ok) {
                    const err = await res.json();
                    setError(err.detail || "Tag search failed");
                    setTagResults([]);
                } else {
                    const data = await res.json();
                    setTagResults(data);
                }
            }
        } catch (err) {
            console.error(err);
            setError("Network error: Could not reach the backend.");
        } finally {
            setSearching(false);
        }
    };

    const results = mode === "semantic" ? semanticResults.filter(r => (r.confidence !== undefined ? r.confidence * 100 >= minConfidence : true)) : tagResults;
    const resultCount = results.length;

    const formatTimestamp = (sec: number) =>
        new Date(sec * 1000).toISOString().substring(11, 19);

    return (
        <Layout activePage="search">
            <div className="px-4 md:px-margin-desktop pb-20">
                <header className="mb-10">
                    <h1 className="text-[24px] font-bold text-on-surface mb-2">Global Archives Search</h1>
                    <p className="text-on-surface-variant text-[12px] max-w-2xl">
                        Query the Vigilant.ai neural database for specific objects or anomalies across all historical surveillance data.
                    </p>
                </header>

                <div className="glass-panel rounded-xl p-6 mb-8 border border-outline-variant/30" style={{ background: "rgba(19, 27, 46, 0.6)", backdropFilter: "blur(12px)" }}>
                    {/* Mode toggle */}
                    <div className="flex gap-2 mb-5">
                        <button
                            onClick={() => { setMode("semantic"); setHasSearched(false); setError(null); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${mode === "semantic"
                                ? "bg-primary/20 border-primary/60 text-primary"
                                : "bg-transparent border-outline-variant/30 text-on-surface-variant hover:border-primary/30"
                                }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">psychology</span>
                            Semantic Search
                        </button>
                        <button
                            onClick={() => { setMode("tags"); setHasSearched(false); setError(null); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${mode === "tags"
                                ? "bg-primary/20 border-primary/60 text-primary"
                                : "bg-transparent border-outline-variant/30 text-on-surface-variant hover:border-primary/30"
                                }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">sell</span>
                            Object Tag Search
                        </button>
                    </div>

                    <p className="text-on-surface-variant text-[11px] mb-4 opacity-80">
                        {mode === "semantic"
                            ? "Describe a scene in natural language — SigLIP vector embeddings find visually matching frames."
                            : "Search by YOLO-detected object class name (e.g. person, car, backpack)."}
                    </p>

                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="font-label-caps text-label-caps text-primary opacity-80 px-1 mb-2 block">SEARCH QUERY</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={mode === "semantic" ? "e.g. a person wearing red jacket near a car..." : "e.g. person, car, backpack..."}
                                    className="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-10 py-3 text-body-sm focus:border-primary transition-colors text-white outline-none"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={searching || !query.trim()}
                            className="h-[48px] px-8 bg-primary-container text-on-primary-container font-bold rounded flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {searching ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">search</span>}
                            {searching ? "Searching..." : "Execute Query"}
                        </button>
                    </form>
                    {mode === "semantic" && (
                        <div className="mt-6 pt-5 bg-primary/5 -mx-6 -mb-6 p-6 rounded-b-xl flex flex-col sm:flex-row items-center gap-4 border-t border-primary/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="material-symbols-outlined text-[16px] text-primary animate-pulse">tune</span>
                                <span className="text-[11px] font-bold text-primary uppercase tracking-widest">Match Sensitivity Threshold:</span>
                            </div>
                            <div className="flex items-center gap-3 flex-1 w-full max-w-md">
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="95" 
                                    step="5"
                                    value={minConfidence} 
                                    onChange={(e) => setMinConfidence(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary border border-outline-variant/20 transition-all hover:brightness-110"
                                />
                                <span className="text-[11px] font-mono bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded shadow-[0_0_10px_rgba(255,255,255,0.05)] shrink-0 min-w-[70px] text-center font-bold">
                                    &gt;= {minConfidence}%
                                </span>
                            </div>
                            <p className="text-[10px] text-on-surface-variant italic sm:ml-auto">
                                Filter out looser visual matches dynamically.
                            </p>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-error/10 border border-error/30 rounded-xl text-error text-sm flex items-center gap-3">
                        <span className="material-symbols-outlined text-[20px]">error</span>
                        <span>{error}</span>
                    </div>
                )}

                {hasSearched && !error && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-[16px] font-bold text-on-surface">
                                {mode === "semantic" ? "Semantic Matches" : "Tag Matches"}
                            </h2>
                            <span className="font-mono text-[12px] px-2 py-0.5 bg-surface-variant rounded border border-outline-variant/20 text-on-surface">
                                {resultCount} FOUND
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {mode === "semantic"
                                 ? semanticResults
                                     .filter(r => (r.confidence !== undefined ? r.confidence * 100 >= minConfidence : true))
                                     .map((res) => (
                                     <a
                                         key={res.id}
                                         href={`/video/${res.video_id}`}
                                         className="glass-panel p-5 rounded-xl border border-outline-variant/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 hover:-translate-y-0.5 shadow-lg group cursor-pointer"
                                         style={{ background: "rgba(19, 27, 46, 0.6)", backdropFilter: "blur(12px)" }}
                                     >
                                         <div className="flex items-start justify-between gap-4">
                                             <div className="flex items-start gap-4 flex-1 min-w-0">
                                                 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20 group-hover:border-primary/50 group-hover:bg-primary/20 transition-all">
                                                     <span className="material-symbols-outlined text-primary text-[22px]">image_search</span>
                                                 </div>
                                                 <div className="flex-1 min-w-0 pt-0.5">
                                                     <h3 className="text-on-surface text-[14px] font-bold leading-snug line-clamp-2 mb-1.5 flex flex-wrap items-center gap-2">
                                                         <span className="text-white italic">"{res.caption || "No caption generated"}"</span>
                                                         {res.confidence !== undefined && (() => {
                                                             const confPct = res.confidence * 100;
                                                             let badgeClass = "bg-sky-500 text-slate-950 border-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.15)]";
                                                             if (confPct >= 80) {
                                                                 badgeClass = "bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]";
                                                             } else if (confPct >= 50) {
                                                                 badgeClass = "bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.15)]";
                                                             }
                                                             return (
                                                                 <span className={`text-[11px] border px-2.5 py-0.5 rounded-md font-mono font-bold tracking-wider leading-none flex-shrink-0 transition-all duration-200 ${badgeClass}`}>
                                                                     {confPct.toFixed(0)}% MATCH
                                                                 </span>
                                                             );
                                                         })()}
                                                     </h3>
                                                     <p className="text-on-surface-variant text-[11px] font-medium" title={res.video_filename}>{res.video_filename}</p>
                                                 </div>
                                             </div>
                                             <div className="text-primary font-mono bg-primary/10 border border-primary/25 px-3 py-1 rounded text-[12px] group-hover:bg-primary group-hover:text-on-primary transition-colors flex-shrink-0 font-bold">
                                                 {formatTimestamp(res.timestamp)}
                                             </div>
                                         </div>
                                     </a>
                                 ))
                                : tagResults.map((res, idx) => (
                                    <a
                                        key={idx}
                                        href={`/video/${res.video_id}`}
                                        className="glass-panel p-4 rounded-xl border border-outline-variant/20 hover:border-primary/50 transition-colors flex items-center justify-between group cursor-pointer"
                                        style={{ background: "rgba(19, 27, 46, 0.6)", backdropFilter: "blur(12px)" }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-primary text-[20px]">
                                                    {res.object_type === "person" ? "person" : res.object_type === "car" ? "directions_car" : "sell"}
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="text-on-surface font-bold text-[14px] flex items-center gap-2">
                                                    <span className="capitalize">{res.object_type}</span>
                                                    <span className="text-[10px] bg-tertiary/20 text-tertiary border border-tertiary/30 px-2 py-0.5 rounded-full font-mono">{(res.confidence * 100).toFixed(0)}% CONF</span>
                                                </h3>
                                                <p className="text-on-surface-variant text-[12px] mt-1 truncate max-w-[200px]" title={res.video_filename}>{res.video_filename}</p>
                                            </div>
                                        </div>
                                        <div className="text-primary font-mono bg-primary/10 border border-primary/20 px-3 py-1 rounded text-[12px] group-hover:bg-primary group-hover:text-on-primary transition-colors">
                                            {formatTimestamp(res.timestamp)}
                                        </div>
                                    </a>
                                ))}
                        </div>

                        {resultCount === 0 && !searching && (
                            <div className="text-center py-16 bg-surface-container-low/50 rounded-xl border border-outline-variant/30 border-dashed">
                                <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-4 opacity-50">search_off</span>
                                <p className="text-on-surface-variant font-body-base">
                                    {mode === "semantic"
                                        ? `No semantic matches found for "${query}". Try a lower threshold or rephrase the query.`
                                        : `No neural matches found for "${query}".`}
                                </p>
                                {mode === "semantic" && (
                                    <p className="text-on-surface-variant text-[11px] mt-2 opacity-60">
                                        Make sure videos were processed with "Semantic Embedding" enabled.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
}
