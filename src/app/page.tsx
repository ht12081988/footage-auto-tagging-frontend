"use client";

import { API_BASE_URL } from "@/config";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";

export default function Home() {
    const [videos, setVideos] = useState<any[]>([]);
    const [stagedFile, setStagedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    
    const [isDragOver, setIsDragOver] = useState(false);
    const [loading, setLoading] = useState(true);
    const [operatorModel, setOperatorModel] = useState("YOLOv8n");
    const [videoProgress, setVideoProgress] = useState<Record<number, number>>({});
    const [now, setNow] = useState(Date.now());
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Processing Options
    const [processTags, setProcessTags] = useState(true);
    const [processOCR, setProcessOCR] = useState(true);
    const [processSemantic, setProcessSemantic] = useState(true);
    
    const router = useRouter();

    const formatTime = (ms: number) => {
        if (ms < 0) ms = 0;
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const loadVideos = async () => {
        const opStr = localStorage.getItem("sentinel_operator");
        if (!opStr) {
            router.push("/login");
            return;
        }
        
        try {
            const operator = JSON.parse(opStr);
            if (operator.ai_model) setOperatorModel(operator.ai_model.split('.')[0].toUpperCase());
            
            const res = await fetch(`${API_BASE_URL}/videos?operator_id=${operator.id}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setVideos(data);
            } else {
                console.error("Failed to load videos: response is not an array", data);
                setVideos([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            const auth = localStorage.getItem("sentinel_auth");
            if (!auth) {
                router.push("/login");
                return;
            }
        }
        
        loadVideos();
        const timerInterval = setInterval(() => setNow(Date.now()), 1000);
        
        return () => {
            clearInterval(timerInterval);
        };
    }, [router]);

    // Only poll the video list if there are active (processing/uploading) videos
    useEffect(() => {
        const hasActiveVideos = videos.some(v => v.status === 'processing' || v.status === 'uploading');
        if (!hasActiveVideos) return;

        const interval = setInterval(loadVideos, 3000);
        return () => clearInterval(interval);
    }, [videos]);

    // Poll progress for any actively processing videos every 2 seconds
    useEffect(() => {
        const processingVideos = videos.filter(v => v.status === 'processing');
        if (processingVideos.length === 0) return;

        const pollProgress = async () => {
            const updates: Record<number, number> = {};
            await Promise.all(processingVideos.map(async (v) => {
                try {
                    const res = await fetch(`${API_BASE_URL}/videos/${v.id}/progress`);
                    const data = await res.json();
                    updates[v.id] = data.progress_pct ?? 0;
                } catch {}
            }));
            setVideoProgress(prev => ({ ...prev, ...updates }));
        };

        pollProgress();
        const progressInterval = setInterval(pollProgress, 2000);
        return () => clearInterval(progressInterval);
    }, [videos]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (selectedFile: File) => {
        if (selectedFile.name.endsWith(".mp4")) {
            setStagedFile(selectedFile);
            setError("");
        } else {
            setError("Only MP4 files are supported.");
        }
    };

    const handleUploadClick = async () => {
        if (!stagedFile) return;
        if (!processTags && !processOCR && !processSemantic) {
            setError("Please select at least one intelligence module to process this feed.");
            return;
        }

        setUploading(true);
        setError("");

        const formData = new FormData();
        formData.append("file", stagedFile);
        formData.append("process_tags", processTags.toString());
        formData.append("process_ocr", processOCR.toString());
        formData.append("process_semantic", processSemantic.toString());

        const opStr = localStorage.getItem("sentinel_operator");
        if (opStr) {
            const operator = JSON.parse(opStr);
            formData.append("operator_id", operator.id.toString());
        }

        try {
            const res = await fetch(`${API_BASE_URL}/upload`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Upload failed");
            }
            await res.json();
            setStagedFile(null);
            loadVideos();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const cancelProcessing = async (videoId: number) => {
        const confirmed = window.confirm("Are you sure you want to cancel the processing for this video feed?");
        if (confirmed) {
            try {
                const res = await fetch(`${API_BASE_URL}/videos/${videoId}/cancel`, {
                    method: "POST"
                });
                if (res.ok) {
                    loadVideos();
                } else {
                    const data = await res.json();
                    alert(data.detail || "Failed to cancel processing");
                }
            } catch (err) {
                console.error("Failed to cancel processing:", err);
                alert("An error occurred while requesting cancellation.");
            }
        }
    };

    return (
        <Layout activePage="upload">
            <div className="px-4 md:px-margin-desktop pb-20">
                <header className="mb-10">
                    <h1 className="text-[24px] font-bold text-on-surface mb-2">Ingest Visual Intelligence</h1>
                    <p className="text-on-surface-variant text-[12px] max-w-2xl">Integrate new surveillance data into the Vigilant.ai core. Supported formats: MP4.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Upload Zone */}
                        <section className="lg:col-span-7">
                            
                            {/* Processing Options - Moved Above Drag & Drop */}
                            <div className="mb-6 p-4 glass-panel rounded-xl border border-outline-variant/30 flex flex-wrap gap-x-8 gap-y-4 justify-center bg-surface-container-low/50">
                                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-on-surface hover:text-primary transition-colors">
                                    <input type="checkbox" checked={processTags} onChange={e => {setProcessTags(e.target.checked); if(!e.target.checked) setProcessOCR(false);}} className="w-4 h-4 accent-primary" />
                                    Object Tagging ({operatorModel})
                                </label>
                                <label className={`flex items-center gap-2 cursor-pointer text-sm font-bold transition-colors ${!processTags ? 'text-on-surface-variant opacity-50' : 'text-on-surface hover:text-primary'}`}>
                                    <input type="checkbox" checked={processOCR} onChange={e => setProcessOCR(e.target.checked)} className="w-4 h-4 accent-primary" disabled={!processTags} />
                                    Licence Plates (EasyOCR)
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-on-surface hover:text-primary transition-colors">
                                    <input type="checkbox" checked={processSemantic} onChange={e => setProcessSemantic(e.target.checked)} className="w-4 h-4 accent-primary" />
                                    Semantic Tags (BLIP)
                                </label>
                            </div>

                            <div 
                                className={`glass-panel rounded-xl h-[320px] flex flex-col items-center justify-center border-dashed border-2 transition-all group relative overflow-hidden ${isDragOver ? 'border-primary bg-primary-container/5 scale-[1.02]' : 'border-outline-variant/30'} ${!stagedFile && !uploading ? 'cursor-pointer hover:border-primary/50' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                style={{background: "rgba(19, 27, 46, 0.6)", backdropFilter: "blur(12px)"}}
                            >
                                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{backgroundImage: "radial-gradient(#a4e6ff 1px, transparent 1px)", backgroundSize: "20px 20px"}}></div>
                                
                                <div className="z-10 flex flex-col items-center text-center px-12">
                                    {!stagedFile && !uploading && (
                                        <>
                                            <div className="w-20 h-20 rounded-full bg-primary-container/10 border border-primary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined text-[40px] text-primary">cloud_upload</span>
                                            </div>
                                            <h2 className="text-[24px] font-bold text-on-surface mb-3">
                                                Drop raw feed here
                                            </h2>
                                            <p className="text-on-surface-variant mb-8 text-[14px]">
                                                Drag and drop MP4 surveillance files or browse your local directory to begin neural mapping.
                                            </p>
                                            <button className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(164,230,255,0.4)] active:scale-95 transition-all">
                                                <span className="material-symbols-outlined">attachment</span>
                                                Select MP4
                                            </button>
                                        </>
                                    )}

                                    {stagedFile && !uploading && (
                                        <>
                                            <div className="w-20 h-20 rounded-full bg-primary-container/20 border border-primary/40 flex items-center justify-center mb-6">
                                                <span className="material-symbols-outlined text-[40px] text-primary">video_file</span>
                                            </div>
                                            <h2 className="text-[20px] font-bold text-primary mb-2 max-w-full truncate px-4">
                                                {stagedFile.name}
                                            </h2>
                                            <p className="text-on-surface-variant mb-8 text-[14px]">
                                                {(stagedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Intelligence Extraction
                                            </p>
                                            
                                            <div className="flex gap-4">
                                                <button onClick={(e) => { e.stopPropagation(); setStagedFile(null); }} className="bg-surface-variant text-on-surface px-6 py-3 rounded-full font-bold hover:bg-surface-container-highest transition-colors">
                                                    Cancel
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleUploadClick(); }} className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(164,230,255,0.4)] active:scale-95 transition-all">
                                                    <span className="material-symbols-outlined">memory</span>
                                                    Start Processing
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {uploading && (
                                        <>
                                            <div className="w-20 h-20 rounded-full bg-primary-container/10 border border-primary/20 flex items-center justify-center mb-6">
                                                <span className="material-symbols-outlined text-[40px] text-primary animate-bounce">cloud_upload</span>
                                            </div>
                                            <h2 className="text-[24px] font-bold text-on-surface mb-3">
                                                Transmitting to Core...
                                            </h2>
                                            <p className="text-on-surface-variant text-[14px]">
                                                Please wait while the neural mapping initializes.
                                            </p>
                                        </>
                                    )}
                                </div>
                                
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="video/mp4" 
                                    ref={fileInputRef}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            handleFileSelect(e.target.files[0]);
                                        }
                                    }} 
                                />

                                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-primary/30"></div>
                                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-primary/30"></div>
                                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-primary/30"></div>
                                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-primary/30"></div>
                            </div>
                            
                            {error && <div className="mt-4 p-3 bg-error-container/20 border border-error/50 rounded-lg text-error text-sm">{error}</div>}

                            <div className="mt-6 flex flex-wrap items-center gap-4 text-[12px] font-mono text-on-surface-variant/60">
                                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">memory</span> Neural Tagging Active</span>
                            </div>
                        </section>

                        {/* Recent Uploads / Status */}
                        <section className="lg:col-span-5 space-y-6">
                            <div className="glass-panel rounded-xl p-3 md:p-4 overflow-hidden" style={{background: "rgba(19, 27, 46, 0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.1)"}}>
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <h3 className="text-[16px] font-bold">Recent Uploads</h3>
                                    <span className="font-mono text-[12px] px-2 py-0.5 bg-surface-variant rounded border border-outline-variant/20">
                                        {videos.filter(v => v.status === 'uploading' || v.status === 'processing').length} ACTIVE
                                    </span>
                                </div>
                                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                    
                                    {videos.length === 0 && (
                                        <div className="text-center p-6 border border-dashed border-outline-variant/20 rounded-lg">
                                            <p className="text-on-surface-variant/50 text-sm">No feeds in archive.</p>
                                        </div>
                                    )}

                                    {videos.map(video => {
                                        
                                        if (video.status === 'uploading') {
                                            return (
                                                <div key={video.id} className="bg-surface-container rounded-lg p-3 border border-outline-variant/10 relative group cursor-pointer" onClick={() => router.push('/video/' + video.id)}>
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-12 h-12 rounded bg-surface-variant flex items-center justify-center relative overflow-hidden">
                                                            <div className="absolute inset-0 bg-primary/20 animate-pulse"></div>
                                                            <span className="material-symbols-outlined text-primary">upload</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <h4 className="text-[14px] font-semibold truncate flex-grow">{video.filename}</h4>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className="font-mono text-[12px] text-primary font-bold">In Progress</span>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); cancelProcessing(video.id); }}
                                                                        className="flex items-center justify-center w-5 h-5 bg-error/15 hover:bg-error/30 text-error rounded border border-error/20 hover:border-error transition-colors"
                                                                        title="Cancel Processing"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="w-full h-1 bg-surface-variant rounded-full mt-2 overflow-hidden">
                                                                <div className="h-full bg-primary transition-all duration-500 w-1/2 shadow-[0_0_15px_rgba(76,214,255,0.3)]"></div>
                                                            </div>
                                                            <p className="font-mono text-[10px] text-on-surface-variant mt-2 uppercase tracking-widest">Uploading to Cloud Node</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (video.status === 'processing') {
                                            const pct = videoProgress[video.id] ?? 0;
                                            return (
                                                <div key={video.id} className="bg-surface-container rounded-lg p-3 border border-primary/20 relative shadow-[0_0_15px_rgba(76,214,255,0.15)] cursor-pointer" onClick={() => router.push('/video/' + video.id)}>
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-12 h-12 rounded bg-surface-variant flex items-center justify-center relative overflow-hidden">
                                                            <span className="material-symbols-outlined text-tertiary-fixed-dim opacity-50">smart_toy</span>
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <div className="w-8 h-8 rounded-full border-2 border-t-tertiary-fixed-dim border-transparent animate-spin"></div>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <h4 className="text-[14px] font-semibold truncate flex-grow">{video.filename}</h4>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <div className="flex items-center gap-1">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse"></div>
                                                                        <span className="font-mono text-[12px] text-tertiary-fixed-dim font-bold">ANALYZING</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); cancelProcessing(video.id); }}
                                                                        className="flex items-center justify-center w-5 h-5 bg-error/15 hover:bg-error/30 text-error rounded border border-error/20 hover:border-error transition-colors"
                                                                        title="Cancel Processing"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <div className="flex-1 h-1.5 bg-surface-variant rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full bg-tertiary-fixed-dim rounded-full shadow-[0_0_8px_rgba(76,214,255,0.5)] transition-all duration-700"
                                                                        style={{ width: `${pct}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="font-mono text-[11px] text-tertiary-fixed-dim font-bold tabular-nums w-8 text-right">{pct}%</span>
                                                            </div>
                                                            <div className="flex justify-between items-center mt-1.5">
                                                                <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">Processing AI tags: {operatorModel}</p>
                                                                <span className="font-mono text-[11px] text-tertiary-fixed-dim bg-tertiary-fixed-dim/10 px-1.5 py-0.5 rounded border border-tertiary-fixed-dim/20">
                                                                    {formatTime(now - new Date(video.created_at + 'Z').getTime())}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (video.status === 'cancelled') {
                                            return (
                                                <div key={video.id} className="bg-surface-container/50 rounded-lg p-3 border border-outline-variant/20 relative group hover:border-outline-variant/40 transition-colors">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-12 h-12 rounded bg-surface-variant/30 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-on-surface-variant/70">cancel</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start">
                                                                <h4 className="text-[14px] font-semibold truncate text-on-surface-variant/80">{video.filename}</h4>
                                                                <span className="font-mono text-[11px] text-on-surface-variant bg-surface-variant px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">CANCELLED</span>
                                                            </div>
                                                            <p className="text-[11px] text-on-surface-variant/60 mt-1.5">Processing cancelled by operator</p>
                                                            <div className="flex gap-4 mt-2">
                                                                <button className="text-[11px] text-on-surface-variant hover:text-white transition-colors font-bold uppercase" onClick={() => router.push('/video/' + video.id)}>Details</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (video.status === 'failed') {
                                            return (
                                                <div key={video.id} className="bg-error-container/10 rounded-lg p-3 border border-error/20">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-12 h-12 rounded bg-error/10 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-error">warning</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start">
                                                                <h4 className="text-[14px] font-semibold truncate text-error">{video.filename}</h4>
                                                                <span className="font-mono text-[12px] text-error font-bold">FAILED</span>
                                                            </div>
                                                            <p className="text-[12px] text-on-error-container mt-1">Processing error encountered</p>
                                                            <div className="flex gap-4 mt-2">
                                                                <button className="text-[11px] text-on-surface-variant hover:text-on-surface transition-colors font-bold uppercase" onClick={() => router.push('/video/' + video.id)}>Details</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // Completed
                                        return (
                                            <div key={video.id} className="bg-surface-container/50 rounded-lg p-3 border border-outline-variant/5 cursor-pointer hover:bg-surface-variant/30 transition-colors" onClick={() => router.push('/video/' + video.id)}>
                                                <div className="flex items-start gap-3">
                                                    <div className="w-12 h-12 rounded bg-surface-variant/30 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-tertiary-fixed-dim">check_circle</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="text-[14px] font-semibold truncate text-on-surface">{video.filename}</h4>
                                                            <span className="font-mono text-[12px] text-on-surface-variant">READY</span>
                                                        </div>
                                                        <div className="w-full h-1 bg-surface-variant/20 rounded-full mt-2">
                                                            <div className="h-full bg-tertiary-fixed-dim w-full opacity-50"></div>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-2">
                                                            <p className="font-mono text-[10px] text-on-surface-variant/60 uppercase tracking-widest">{video.duration.toFixed(1)}s • {video.detections?.length || 0} TAGS</p>
                                                            {video.processing_time_sec > 0 && (
                                                                <span className="font-mono text-[9px] text-on-surface-variant/50 uppercase tracking-widest">
                                                                    Processed in {formatTime(video.processing_time_sec * 1000)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button className="w-full mt-6 py-2 text-[11px] font-bold text-on-surface-variant hover:text-on-surface border-t border-outline-variant/10 transition-colors uppercase tracking-widest" onClick={() => router.push('/archives')}>View Full Archive History</button>
                            </div>
                        </section>
                    </div>
            </div>
        </Layout>
    );
}
