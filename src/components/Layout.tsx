"use client";

import { API_BASE_URL } from "@/config";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Layout({ children, activePage, videoScope }: { children: React.ReactNode, activePage?: 'upload' | 'archives' | 'search' | 'video', videoScope?: any }) {
    const [operator, setOperator] = useState<any>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [plateResults, setPlateResults] = useState<any[]>([]);
    const [semanticResults, setSemanticResults] = useState<any[]>([]);
    const [minConfidenceFilter, setMinConfidenceFilter] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isScopeCleared, setIsScopeCleared] = useState(false);

    // Reset scope cleared state if videoScope changes
    useEffect(() => {
        setIsScopeCleared(false);
    }, [videoScope]);

    const activeVideoScope = isScopeCleared ? null : videoScope;

    // Keep searchQuery synchronized with URL params ('q' or 'plate') when page changes
    useEffect(() => {
        const q = searchParams.get('q') || searchParams.get('plate') || "";
        setSearchQuery(q);
    }, [searchParams]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const opInfo = localStorage.getItem("sentinel_operator");
            if (opInfo) {
                setOperator(JSON.parse(opInfo));
            }
        }
    }, []);

    // Automatically collapse sidebar on video page for maximum screen space
    useEffect(() => {
        if (activePage === 'video') {
            setIsSidebarOpen(false);
        } else {
            setIsSidebarOpen(true);
        }
    }, [activePage]);

    // Debounced Omni-search
    useEffect(() => {
        if (searchQuery.trim().length < 1) {
            setPlateResults([]);
            setSemanticResults([]);
            setShowDropdown(false);
            return;
        }
        const timer = setTimeout(async () => {
            if (!operator) return;
            setIsSearching(true);
            try {
                const videoIdParam = activeVideoScope?.id ? `&video_id=${activeVideoScope.id}` : "";
                const [plateRes, semanticRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/plates/search?q=${encodeURIComponent(searchQuery)}&operator_id=${operator.id}&limit=4${videoIdParam}`),
                    fetch(`${API_BASE_URL}/search/semantic?query=${encodeURIComponent(searchQuery)}&operator_id=${operator.id}&limit=4${videoIdParam}`)
                ]);

                const plateData = plateRes.ok ? await plateRes.json() : [];
                const semanticData = semanticRes.ok ? await semanticRes.json() : [];

                setPlateResults(plateData);
                setSemanticResults(semanticData);
                setShowDropdown(true);
            } catch { }
            finally { setIsSearching(false); }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, activeVideoScope]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("sentinel_auth");
        localStorage.removeItem("sentinel_operator");
        router.push("/login");
    };

    const goToArchivesWithSearch = () => {
        setShowDropdown(false);
        router.push(`/archives?plate=${encodeURIComponent(searchQuery)}`);
    };

    return (
        <div className="bg-background text-on-surface font-body-base min-h-screen overflow-x-hidden selection:bg-primary/30">
            {/* TopAppBar */}
            <header className="bg-surface-container-low/85 backdrop-blur-xl text-primary font-headline-md text-[24px] border-b border-outline-variant/30 shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex justify-between items-center w-full px-margin-desktop h-16 z-50 fixed top-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="hidden md:flex p-2 rounded-full hover:bg-surface-variant/30 text-on-surface-variant hover:text-white transition-colors"
                        title="Toggle Sidebar"
                    >
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <div className="flex flex-col leading-none">
                        <span className="font-display-lg text-[22px] font-bold tracking-tight text-primary">Vigilant.ai</span>
                        <span className="text-[9px] text-tertiary-fixed-dim font-bold tracking-widest uppercase font-mono mt-1 opacity-90">Neural Tagging Active</span>
                    </div>
                </div>

                <div className="flex-1 max-w-xl mx-8 hidden md:flex" ref={searchRef}>
                    <div className="relative w-full group flex items-center bg-surface-container-lowest/50 border border-outline-variant/30 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all rounded-lg px-3 py-1.5 min-h-[40px]">
                        <span className="material-symbols-outlined text-on-surface-variant shrink-0 mr-2 select-none text-[20px]">
                            {isSearching ? 'progress_activity' : 'search'}
                        </span>

                        {activeVideoScope && (
                            <div className="flex items-center gap-1.5 bg-primary/15 text-primary border border-primary/30 rounded px-2 py-0.5 text-[11px] font-bold select-none shrink-0 mr-2 max-w-[200px] shadow-[0_0_8px_rgba(255,255,255,0.05)]">
                                <span className="material-symbols-outlined text-[13px]">movie</span>
                                <span className="truncate max-w-[120px]">{activeVideoScope.filename}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsScopeCleared(true);
                                    }}
                                    className="hover:text-white transition-colors flex items-center shrink-0 ml-0.5"
                                    title="Unlock search to all videos"
                                >
                                    <span className="material-symbols-outlined text-[13px] font-bold">close</span>
                                </button>
                            </div>
                        )}

                        <input
                            className="flex-1 bg-transparent border-0 outline-none ring-0 focus:outline-none focus:ring-0 text-body-sm text-on-surface placeholder:text-on-surface-variant/70 py-0.5 w-full"
                            placeholder={activeVideoScope ? "Search inside this video..." : "Omni-Search: Find plates (MH01) or describe scenes (Red car)..."}
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && searchQuery.trim() && goToArchivesWithSearch()}
                            onFocus={() => (plateResults.length > 0 || semanticResults.length > 0) && setShowDropdown(true)}
                        />

                        {/* Search Dropdown */}
                        {showDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container border border-outline-variant/30 rounded-lg shadow-2xl z-[100] overflow-hidden max-h-[80vh] overflow-y-auto custom-scrollbar">
                                 {plateResults.length === 0 && semanticResults.length === 0 ? (
                                     <div className="px-4 py-3 text-on-surface-variant text-[13px]">No matches found for "{searchQuery}"</div>
                                 ) : (
                                     <>
                                         {/* Sensitivity Filter slider */}
                                         {semanticResults.length > 0 && (
                                             <div className="px-5 py-3 bg-gradient-to-r from-primary/10 via-surface-variant/20 to-tertiary/5 border-b border-primary/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]">
                                                 <div className="flex items-center gap-2 shrink-0">
                                                     <span className="material-symbols-outlined text-[16px] text-primary animate-pulse">tune</span>
                                                     <span className="text-[11px] font-bold text-primary uppercase tracking-widest">Match Sensitivity:</span>
                                                 </div>
                                                 <div className="flex items-center gap-3 flex-1 justify-end w-full sm:w-auto">
                                                     <input 
                                                         type="range" 
                                                         min="0" 
                                                         max="95" 
                                                         step="5"
                                                         value={minConfidenceFilter} 
                                                         onChange={(e) => setMinConfidenceFilter(parseInt(e.target.value))}
                                                         className="w-full sm:w-36 h-1.5 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary border border-outline-variant/20 transition-all hover:brightness-110"
                                                         onClick={(e) => e.stopPropagation()}
                                                     />
                                                     <span className="text-[10px] font-mono text-primary bg-primary/15 border border-primary/30 px-2 py-0.5 rounded shadow-[0_0_10px_rgba(255,255,255,0.05)] shrink-0 min-w-[55px] text-center font-bold">
                                                         &gt;={minConfidenceFilter}%
                                                     </span>
                                                 </div>
                                             </div>
                                         )}

                                         {/* Plate Results */}
                                        {plateResults.length > 0 && (
                                            <div className="border-b border-outline-variant/10">
                                                <div className="bg-surface-variant/20 px-4 py-1.5 flex items-center gap-2 border-b border-outline-variant/5">
                                                    <span className="material-symbols-outlined text-[14px] text-primary">local_police</span>
                                                    <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Licence Plates</span>
                                                </div>
                                                {plateResults.map((r: any) => (
                                                    <div
                                                        key={`plate-${r.id}`}
                                                        onClick={() => { setShowDropdown(false); router.push(`/video/${r.video_id}?t=${r.timestamp_sec}&q=${encodeURIComponent(searchQuery)}`); }}
                                                        className="flex items-center justify-between px-5 py-3 hover:bg-surface-variant/40 cursor-pointer transition-all border-b border-outline-variant/5 last:border-0 gap-3"
                                                    >
                                                        <div className="w-[84px] h-[48px] bg-black rounded overflow-hidden shrink-0 relative flex items-center justify-center border border-outline-variant/20 shadow-sm">
                                                            {r.video_filepath ? (
                                                                <video
                                                                    src={r.video_filepath.startsWith('http') ? `${r.video_filepath}#t=${r.timestamp_sec}` : `${API_BASE_URL}/uploads/${r.video_filepath.split('\\').pop() || r.video_filepath.split('/').pop()}#t=${r.timestamp_sec}`}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">image</span>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-mono font-bold text-[13px] text-on-surface tracking-wider truncate">{r.plate_number}</p>
                                                            <p className="text-[11px] text-on-surface-variant truncate">{r.video_filename}</p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="font-mono text-[10px] text-primary">{Math.floor(r.timestamp_sec / 60).toString().padStart(2, '0')}:{(r.timestamp_sec % 60).toFixed(0).padStart(2, '0')}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                         {/* Semantic Results */}
                                         {semanticResults.filter(r => (r.confidence !== undefined ? r.confidence * 100 >= minConfidenceFilter : true)).length > 0 && (
                                             <div>
                                                 <div className="bg-surface-variant/20 px-4 py-1.5 flex items-center gap-2 border-b border-outline-variant/5">
                                                     <span className="material-symbols-outlined text-[14px] text-tertiary">temp_preferences_custom</span>
                                                     <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Visual AI Matches</span>
                                                 </div>
                                                 {semanticResults
                                                     .filter(r => (r.confidence !== undefined ? r.confidence * 100 >= minConfidenceFilter : true))
                                                     .map((r: any, idx: number) => (
                                                         <div
                                                             key={`sem-${idx}`}
                                                             onClick={() => { setShowDropdown(false); router.push(`/video/${r.video_id}?t=${r.timestamp}&q=${encodeURIComponent(searchQuery)}`); }}
                                                             className="flex items-center justify-between px-5 py-3.5 hover:bg-primary/5 hover:border-primary/30 border-b border-outline-variant/10 last:border-0 cursor-pointer transition-all duration-200 hover:translate-x-1 gap-4 group"
                                                         >
                                                             <div className="w-[84px] h-[48px] bg-black rounded overflow-hidden shrink-0 relative flex items-center justify-center border border-outline-variant/30 group-hover:border-primary/50 transition-colors shadow-md">
                                                                 {r.video_filepath ? (
                                                                     <video
                                                                         src={r.video_filepath.startsWith('http') ? `${r.video_filepath}#t=${r.timestamp}` : `${API_BASE_URL}/uploads/${r.video_filepath.split('\\').pop() || r.video_filepath.split('/').pop()}#t=${r.timestamp}`}
                                                                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                     />
                                                                 ) : (
                                                                     <span className="material-symbols-outlined text-[18px] text-on-surface-variant">image</span>
                                                                 )}
                                                             </div>
                                                             <div className="flex-1 min-w-0">
                                                                 <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                     <p className="text-[13px] text-white font-semibold italic line-clamp-1">"{r.caption}"</p>
                                                                     {r.confidence !== undefined && (() => {
                                                                         const confPct = r.confidence * 100;
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
                                                                 </div>
                                                                 <p className="text-[10px] text-on-surface-variant truncate font-medium">{r.video_filename}</p>
                                                             </div>
                                                             <div className="text-right shrink-0 flex flex-col justify-center items-end">
                                                                 <span className="font-mono text-[11px] text-tertiary font-bold bg-tertiary/10 border border-tertiary/20 px-2 py-0.5 rounded group-hover:bg-tertiary group-hover:text-on-tertiary transition-all duration-200">
                                                                     {Math.floor(r.timestamp / 60).toString().padStart(2, '0')}:{(r.timestamp % 60).toFixed(0).padStart(2, '0')}
                                                                 </span>
                                                             </div>
                                                         </div>
                                                     ))}
                                             </div>
                                         )}

                                         <button
                                             onClick={goToArchivesWithSearch}
                                             className="w-full text-center py-3 text-[12px] font-bold text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1 border-t border-outline-variant/10"
                                         >
                                             <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                             Filter Archives by "{searchQuery}"
                                         </button>
                                     </>
                                 )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <span className="material-symbols-outlined cursor-pointer active:scale-95 text-on-surface-variant hover:bg-surface-variant/30 transition-colors p-2 rounded-full hidden md:block">help</span>

                        <div className="flex items-center gap-3">
                            <span className="font-bold text-[14px] text-on-surface hidden md:block">
                                {operator?.full_name || "Operator"}
                            </span>
                            <div className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center overflow-hidden bg-primary-container/20">
                                <span className="material-symbols-outlined text-primary">person</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* SideNavBar */}
            <aside className={`bg-surface-container-low/80 backdrop-blur-lg text-primary font-body-base flex flex-col h-screen fixed left-0 top-0 pt-20 pb-margin-desktop z-40 border-r border-outline-variant/10 hidden md:flex transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full'}`}>
                <nav className="flex-1 px-4 space-y-2">
                    <a onClick={() => router.push('/')} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer select-none ${activePage === 'upload' ? 'bg-primary-container/20 text-primary border-r-4 border-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'}`}>
                        <span className="material-symbols-outlined">upload</span>
                        <span>Upload Feed</span>
                    </a>

                    <a onClick={() => router.push('/archives')} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer select-none ${activePage === 'archives' ? 'bg-primary-container/20 text-primary border-r-4 border-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'}`}>
                        <span className="material-symbols-outlined">folder_open</span>
                        <span>Archives</span>
                    </a>

                    <a onClick={() => router.push('/settings')} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer select-none ${activePage === 'search' ? 'bg-primary-container/20 text-primary border-r-4 border-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'}`}>
                        <span className="material-symbols-outlined">settings</span>
                        <span>Detection Targets</span>
                    </a>
                </nav>

                <div className="px-4 mt-auto">
                    <div className="flex flex-col gap-1">
                        <a onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 transition-all duration-200 cursor-pointer select-none text-error/80 hover:text-error">
                            <span className="material-symbols-outlined">logout</span>
                            <span className="font-body-base">Sign Out</span>
                        </a>
                    </div>
                </div>
            </aside>

            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-low/90 backdrop-blur-xl border-t border-outline-variant/20 flex items-center justify-around px-4 z-50">
                <button className={`flex flex-col items-center gap-1 ${activePage === 'upload' ? 'text-primary' : 'text-on-surface-variant'}`} onClick={() => router.push('/')}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: activePage === 'upload' ? "'FILL' 1" : "'FILL' 0" }}>upload</span>
                    <span className="text-[10px] font-bold uppercase">Upload</span>
                </button>
                <button className={`flex flex-col items-center gap-1 ${activePage === 'archives' ? 'text-primary' : 'text-on-surface-variant'}`} onClick={() => router.push('/archives')}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: activePage === 'archives' ? "'FILL' 1" : "'FILL' 0" }}>folder_open</span>
                    <span className="text-[10px] font-bold uppercase">Archive</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-on-surface-variant" onClick={handleLogout}>
                    <span className="material-symbols-outlined">logout</span>
                    <span className="text-[10px] font-bold uppercase">Account</span>
                </button>
            </nav>

            {/* Main Content Area */}
            <div className={`pt-24 pb-12 min-h-screen transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:ml-64' : 'md:ml-0'}`}>
                {children}
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(187, 201, 207, 0.2);
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
}
