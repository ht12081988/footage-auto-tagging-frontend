"use client";

import { API_BASE_URL } from "@/config";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Layout from "@/components/Layout";

export default function ArchivesPage() {
    const [videos, setVideos] = useState<any[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [videoToDelete, setVideoToDelete] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    const loadVideos = () => {
        const opStr = localStorage.getItem("sentinel_operator");
        if (!opStr) return;
        const operator = JSON.parse(opStr);
        fetch(`${API_BASE_URL}/videos?operator_id=${operator.id}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setVideos(data);
                } else {
                    setVideos([]);
                }
            })
            .catch(err => console.error(err));
    };

    const confirmDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setVideoToDelete(id);
    };

    const executeDelete = async () => {
        if (!videoToDelete) return;
        const opStr = localStorage.getItem("sentinel_operator");
        const operatorId = opStr ? JSON.parse(opStr).id : null;
        try {
            await fetch(`${API_BASE_URL}/videos/${videoToDelete}?operator_id=${operatorId}`, { method: 'DELETE' });
            setVideoToDelete(null);
            loadVideos();
        } catch (err) {
            console.error("Failed to delete video:", err);
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
        const interval = setInterval(loadVideos, 5000);
        return () => clearInterval(interval);
    }, [router]);



    return (
        <Layout activePage="archives">
            <div className="px-4 md:px-margin-desktop pb-20">
                {/* Archive Header & Filters */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-[24px] font-bold text-on-surface mb-2 leading-tight">Video Archive</h1>
                        <p className="text-on-surface-variant text-[12px] max-w-2xl">Access historically logged surveillance data processed by Vigilant.ai. Filter by temporal data or specific biometric and object detection events.</p>
                    </div>
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${isFilterOpen ? 'bg-primary/20 text-primary border-primary/30' : 'bg-surface-variant/30 text-on-surface-variant border-outline-variant/30 hover:text-on-surface'}`}
                    >
                        <span className="material-symbols-outlined">filter_list</span>
                        <span className="font-bold text-sm">Filter</span>
                    </button>
                </div>

                {/* Filter Panel */}
                {isFilterOpen && (
                    <section className="p-3 md:p-panel-padding rounded-xl mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 items-end" style={{ background: "rgba(19, 27, 46, 0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                        <div className="flex flex-col gap-2">
                            <label className="font-label-caps text-label-caps text-primary opacity-80 px-1 text-[11px] font-bold tracking-wider">FROM DATE</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">calendar_today</span>
                                <input className="w-full bg-surface-container-high border-b border-outline-variant/30 rounded px-10 py-2 text-body-sm focus:border-primary transition-colors text-white" type="date" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="font-label-caps text-label-caps text-primary opacity-80 px-1 text-[11px] font-bold tracking-wider">TO DATE</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">calendar_today</span>
                                <input className="w-full bg-surface-container-high border-b border-outline-variant/30 rounded px-10 py-2 text-body-sm focus:border-primary transition-colors text-white" type="date" />
                            </div>
                        </div>
                        <div>
                            <button className="w-full h-[40px] bg-primary-container text-on-primary-container font-bold rounded flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-sm">
                                <span className="material-symbols-outlined">tune</span>
                                Apply Filters
                            </button>
                        </div>
                    </section>
                )}



                {/* Video Archive Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

                    {videos.map(video => (
                        <div key={video.id} className="group rounded-xl overflow-hidden hover:border-primary/40 transition-all duration-300 cursor-pointer" onClick={() => router.push(`/video/${video.id}`)} style={{ background: "rgba(19, 27, 46, 0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                            <div className="relative h-48 overflow-hidden bg-surface-container flex items-center justify-center border-b border-outline-variant/30">
                                {video.status === 'processing' || video.status === 'uploading' ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                        <div className="w-12 h-12 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin"></div>
                                        <span className="font-label-caps text-[11px] text-secondary tracking-widest uppercase">{video.status}...</span>
                                    </div>
                                ) : (
                                    <>
                                        <video
                                            className="absolute inset-0 w-full h-full object-cover opacity-80"
                                            src={video.filepath.startsWith('http') ? video.filepath : `${API_BASE_URL}/uploads/${video.filepath.split('\\').pop() || video.filepath.split('/').pop()}`}
                                            preload="metadata"
                                            muted
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-surface-container/90 via-surface-container/20 to-transparent z-10 pointer-events-none"></div>

                                        <div className="absolute top-3 left-3 flex gap-2 z-20">
                                            <span className="bg-primary/20 backdrop-blur-md text-primary text-[10px] font-bold px-2 py-1 rounded border border-primary/30 flex items-center gap-1">
                                                <span className="w-1 h-1 rounded-full bg-primary animate-pulse"></span>
                                                MP4
                                            </span>
                                        </div>

                                        <button
                                            onClick={(e) => confirmDelete(e, video.id)}
                                            className="absolute top-3 right-3 text-white/50 hover:text-error bg-black/40 hover:bg-black/80 rounded p-1.5 transition-all z-40 opacity-0 group-hover:opacity-100 flex items-center justify-center border border-transparent hover:border-error/30"
                                            title="Delete Video"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>

                                        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[11px] px-2 py-1 rounded font-mono z-20">
                                            {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toFixed(0).padStart(2, '0')}` : '00:00'}
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 z-30">
                                            <span className="material-symbols-outlined text-white text-5xl hover:scale-110 transition-transform">play_circle</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-[16px] text-on-surface truncate pr-2">{video.filename}</h3>
                                    {video.status === 'completed' && (
                                        <div className="flex items-center gap-2 bg-tertiary/10 px-2 py-0.5 rounded-full border border-tertiary/20 whitespace-nowrap">
                                            <div className="w-2 h-2 rounded-full bg-tertiary"></div>
                                            <span className="text-[10px] font-bold text-tertiary uppercase">Complete</span>
                                        </div>
                                    )}
                                    {video.status === 'processing' && (
                                        <div className="flex items-center gap-2 bg-secondary/10 px-2 py-0.5 rounded-full border border-secondary/20 whitespace-nowrap">
                                            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
                                            <span className="text-[10px] font-bold text-secondary uppercase">Processing</span>
                                        </div>
                                    )}
                                    {video.status === 'cancelled' && (
                                        <div className="flex items-center gap-2 bg-surface-variant/40 px-2 py-0.5 rounded-full border border-outline-variant/30 whitespace-nowrap">
                                            <div className="w-2 h-2 rounded-full bg-on-surface-variant/50"></div>
                                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Cancelled</span>
                                        </div>
                                    )}
                                    {video.status === 'failed' && (
                                        <div className="flex items-center gap-2 bg-error/10 px-2 py-0.5 rounded-full border border-error/20 whitespace-nowrap">
                                            <div className="w-2 h-2 rounded-full bg-error"></div>
                                            <span className="text-[10px] font-bold text-error uppercase">Failed</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-4 text-on-surface-variant text-[14px] mb-4">
                                    <div className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">schedule</span>
                                        <span>{new Date(video.created_at).toLocaleDateString()} {new Date(video.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">storage</span>
                                        <span>AI Video</span>
                                    </div>
                                </div>

                                {video.status === 'completed' && (
                                    <div className="border-t border-outline-variant/10 pt-4 flex flex-wrap gap-2">
                                        <span className="text-[11px] font-bold bg-surface-variant/50 px-2 py-1 rounded flex items-center gap-1 text-on-surface">
                                            <span className="material-symbols-outlined text-[14px]">sell</span>
                                            {video.detections?.length || 0} TAGS DETECTED
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}



                </div>

                {/* Pagination / Status Footer */}
                <footer className="mt-12 flex flex-col md:flex-row justify-between items-center gap-4 text-on-surface-variant text-[14px] pb-8">
                    <div className="flex items-center gap-4">
                        <span>Showing {videos.length} archives</span>
                    </div>

                </footer>
            </div>

            {/* Custom Delete Confirmation Modal */}
            {videoToDelete && (
                <div className="fixed inset-0 z-[60] bg-[#060a14]/40 backdrop-blur-sm flex items-center justify-center px-4">
                    <div className="bg-surface-container border border-primary/20 rounded-xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.2)]">
                                <span className="material-symbols-outlined text-primary text-[24px]">delete</span>
                            </div>
                            <div>
                                <h3 className="text-[18px] font-bold text-white leading-tight">Delete Surveillance Record?</h3>
                                <p className="text-on-surface-variant text-[13px] mt-1">This action cannot be undone.</p>
                            </div>
                        </div>
                        <div className="bg-surface-container-low/50 p-4 rounded-lg border border-primary/10 mb-6">
                            <p className="text-[13px] text-on-surface">
                                This will permanently erase the raw <strong className="text-white">.mp4 video file</strong> and securely wipe all associated <strong className="text-white">AI detection logs</strong> from the Sentinel database.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setVideoToDelete(null)}
                                className="px-4 py-2 rounded-lg font-bold text-[13px] text-on-surface-variant hover:text-white hover:bg-surface-variant/30 transition-colors border border-transparent"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeDelete}
                                className="px-4 py-2 rounded-lg font-bold text-[13px] bg-primary text-on-primary shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)] hover:shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.5)] hover:bg-primary/90 transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                                CONFIRM DELETE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
