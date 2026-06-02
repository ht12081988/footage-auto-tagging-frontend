"use client";

import { API_BASE_URL } from "@/config";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Layout from "@/components/Layout";

export default function VideoDetailPage({ params }: { params: { id: string } }) {
    const [video, setVideo] = useState<any>(null);
    const [detections, setDetections] = useState<any[]>([]);
    const [plates, setPlates] = useState<any[]>([]);
    const [captions, setCaptions] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<"objects" | "plates" | "semantic">("objects");
    const [selectedDetectionId, setSelectedDetectionId] = useState<number | null>(null);
    const [selectedPlateId, setSelectedPlateId] = useState<number | null>(null);
    const [selectedCaptionId, setSelectedCaptionId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterQuery, setFilterQuery] = useState("");
    const [currentTime, setCurrentTime] = useState(0);
    const [videoSize, setVideoSize] = useState({ width: 16, height: 9 });
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showOverlays, setShowOverlays] = useState(true);
    
    // Reprocess state
    const [showReprocess, setShowReprocess] = useState(false);
    const [reprocessTags, setReprocessTags] = useState(false);
    const [reprocessOCR, setReprocessOCR] = useState(false);
    const [reprocessSemantic, setReprocessSemantic] = useState(false);
    const [isReprocessing, setIsReprocessing] = useState(false);

    const [progressPct, setProgressPct] = useState(0);

    // Waveform Hover Tooltip State
    const [hoveredBucket, setHoveredBucket] = useState<any | null>(null);
    const [tooltipX, setTooltipX] = useState<number>(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const tParam = searchParams.get('t');

    const handleCancelProcessing = async () => {
        const confirmed = window.confirm("Are you sure you want to cancel the neural mapping/processing for this video feed?");
        if (confirmed) {
            try {
                const res = await fetch(`${API_BASE_URL}/videos/${params.id}/cancel`, {
                    method: "POST"
                });
                if (res.ok) {
                    setVideo((prev: any) => prev ? { ...prev, status: "cancelled" } : null);
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


    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => console.log(err));
        } else {
            document.exitFullscreen();
        }
    };

    // 1. Fetch Video Metadata, Detections, Plates, and Captions
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        let isDone = false;

        const opStr = typeof window !== "undefined" ? localStorage.getItem("sentinel_operator") : null;
        const operatorId: number | null = opStr ? JSON.parse(opStr).id : null;

        if (operatorId === null) {
            router.push("/login");
            return;
        }

        const fetchData = async () => {
            if (isDone) return;
            
            try {
                const vidRes = await fetch(`${API_BASE_URL}/videos/${params.id}?operator_id=${operatorId}`);
                if (!vidRes.ok) {
                    setLoading(false);
                    return; // Access denied or not found
                }
                const vidData = await vidRes.json();
                setVideo(vidData);
                
                if (vidData.status === 'processing') {
                    try {
                        const progRes = await fetch(`${API_BASE_URL}/videos/${params.id}/progress`);
                        const progData = await progRes.json();
                        setProgressPct(progData.progress_pct ?? 0);
                    } catch {}
                }
                
                if (vidData.status === 'completed') {
                    isDone = true;
                    if (interval) clearInterval(interval);
                    
                    const [detRes, plateRes, captionRes] = await Promise.all([
                        fetch(`${API_BASE_URL}/videos/${params.id}/detections?operator_id=${operatorId}`),
                        fetch(`${API_BASE_URL}/videos/${params.id}/plates?operator_id=${operatorId}`),
                        fetch(`${API_BASE_URL}/videos/${params.id}/captions?operator_id=${operatorId}`)
                    ]);
                    
                    const [detData, plateData, captionData] = await Promise.all([
                        detRes.json(),
                        plateRes.json(),
                        captionRes.json()
                    ]);
                    
                    setDetections(detData);
                    setPlates(plateData);
                    setCaptions(captionData);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
        interval = setInterval(fetchData, 5000);
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [params.id, router]);

    // 2. Track & Handle `?t=` URL parameter updates (Omni-Search seeks)
    useEffect(() => {
        if (tParam && videoRef.current) {
            const timeVal = parseFloat(tParam);
            if (!isNaN(timeVal)) {
                videoRef.current.currentTime = timeVal;
                videoRef.current.pause();
            }
        }
    }, [tParam, loading]);

    // 3. Highlight corresponding side bar items based on parameter/time matches
    useEffect(() => {
        if (!tParam || loading || detections.length === 0) return;
        const targetTime = parseFloat(tParam);
        if (isNaN(targetTime)) return;
        
        const matchingPlate = plates.find(p => Math.abs(p.timestamp_sec - targetTime) < 0.5);
        if (matchingPlate) {
            setSelectedPlateId(matchingPlate.id);
            setActiveTab("plates");
            return;
        }

        const matchingCaption = captions.find(c => Math.abs(c.timestamp_sec - targetTime) < 0.5);
        if (matchingCaption) {
            setSelectedCaptionId(matchingCaption.id);
            setActiveTab("semantic");
            return;
        }

        const matchingDet = detections.find(d => Math.abs(d.timestamp_sec - targetTime) < 0.5);
        if (matchingDet) {
            setSelectedDetectionId(matchingDet.id);
            setActiveTab("objects");
            return;
        }
    }, [tParam, loading, detections, plates, captions]);

    const jumpToTime = (time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            videoRef.current.pause();
        }
    };

    const handleExportCSV = () => {
        if (!video) return;
        let csvContent = "";
        let fileName = "";
        
        if (activeTab === "objects") {
            csvContent = "Timestamp (s),Object Class,Confidence (%),Track ID\n" + 
                detections.map(d => `${d.timestamp_sec.toFixed(2)},${d.object_type},${(d.confidence * 100).toFixed(0)},${d.track_id !== null ? d.track_id : "N/A"}`).join("\n");
            fileName = `${video.filename.split('.')[0]}_detections.csv`;
        } else if (activeTab === "plates") {
            csvContent = "Timestamp (s),License Plate,Confidence (%)\n" + 
                plates.map(p => `${p.timestamp_sec.toFixed(2)},${p.plate_number},${(p.confidence * 100).toFixed(0)}`).join("\n");
            fileName = `${video.filename.split('.')[0]}_plates.csv`;
        } else if (activeTab === "semantic") {
            csvContent = "Timestamp (s),Semantic Caption\n" + 
                captions.map(c => `${c.timestamp_sec.toFixed(2)},"${(c.caption || "").replace(/"/g, '""')}"`).join("\n");
            fileName = `${video.filename.split('.')[0]}_semantic_tags.csv`;
        }
        
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleReprocess = async () => {
        if (!reprocessTags && !reprocessOCR && !reprocessSemantic) return;
        setIsReprocessing(true);
        const opStr = typeof window !== "undefined" ? localStorage.getItem("sentinel_operator") : null;
        const operatorId = opStr ? JSON.parse(opStr).id : null;
        const formData = new FormData();
        formData.append("process_tags", reprocessTags.toString());
        formData.append("process_ocr", reprocessOCR.toString());
        formData.append("process_semantic", reprocessSemantic.toString());
        if (operatorId !== null) formData.append("operator_id", operatorId.toString());

        try {
            await fetch(`${API_BASE_URL}/videos/${params.id}/reprocess`, {
                method: "POST",
                body: formData,
            });
            setShowReprocess(false);
            setLoading(true);
            setVideo(prev => prev ? { ...prev, status: "processing" } : null);
        } catch (err) {
            console.error(err);
        } finally {
            setIsReprocessing(false);
        }
    };

    const objectIcons: Record<string, string> = {
        person: 'person',
        car: 'directions_car',
        backpack: 'backpack',
        handbag: 'shopping_bag',
        bicycle: 'pedal_bike',
        cow: 'pets',
        'traffic light': 'traffic'
    };

    const objectColors: Record<string, string> = {
        person: 'text-[#4285F4]',
        car: 'text-[#EA4335]',
        backpack: 'text-[#FBBC05]',
        handbag: 'text-[#34A853]',
        bicycle: 'text-[#FF6D00]',
        cow: 'text-[#8E24AA]',
        'traffic light': 'text-[#00BFA5]'
    };

    const getFilteredItems = () => {
        const query = filterQuery.toLowerCase();
        if (activeTab === "objects") {
            return detections.filter(d => d.object_type.toLowerCase().includes(query));
        } else if (activeTab === "plates") {
            return plates.filter(p => p.plate_number.toLowerCase().includes(query));
        } else {
            return captions.filter(c => (c.caption || "").toLowerCase().includes(query));
        }
    };

    const filteredItems = getFilteredItems();

    // Tab theme configuration
    const tabTheme = {
        objects: {
            active: 'bg-[#4285F4]',
            hover: 'hover:bg-[#4285F4]/60',
            text: 'text-[#4285F4]',
            border: 'border-[#4285F4]/30',
            shadow: 'shadow-[0_0_12px_rgba(66,133,244,0.45)]'
        },
        plates: {
            active: 'bg-[#34A853]',
            hover: 'hover:bg-[#34A853]/60',
            text: 'text-[#34A853]',
            border: 'border-[#34A853]/30',
            shadow: 'shadow-[0_0_12px_rgba(52,168,83,0.45)]'
        },
        semantic: {
            active: 'bg-[#FBBC05]',
            hover: 'hover:bg-[#FBBC05]/60',
            text: 'text-[#FBBC05]',
            border: 'border-[#FBBC05]/30',
            shadow: 'shadow-[0_0_12px_rgba(251,188,5,0.45)]'
        }
    }[activeTab];

    // Generate chronologically grouped activity buckets for the timeline waveform
    const numBuckets = 72;
    const duration = video?.duration || 0;
    const bucketDuration = duration > 0 ? duration / numBuckets : 1;

    const buckets = Array.from({ length: numBuckets }, (_, i) => {
        const start = i * bucketDuration;
        const end = start + bucketDuration;
        
        let items: any[] = [];
        if (activeTab === "objects") {
            items = detections.filter(d => d.timestamp_sec >= start && d.timestamp_sec < end);
        } else if (activeTab === "plates") {
            items = plates.filter(p => p.timestamp_sec >= start && p.timestamp_sec < end);
        } else if (activeTab === "semantic") {
            items = captions.filter(c => c.timestamp_sec >= start && c.timestamp_sec < end);
        }
        
        return {
            index: i,
            startTime: start,
            endTime: end,
            count: items.length,
            items
        };
    });

    const maxCount = Math.max(...buckets.map(b => b.count), 1);

    if (loading && !video) {
        return (
            <Layout activePage="video" videoScope={null}>
                <div className="flex justify-center items-center py-40">
                    <div className="text-on-surface-variant flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                        Connecting to Surveillance Feed...
                    </div>
                </div>
            </Layout>
        );
    }

    if (!video) {
        return (
            <Layout activePage="video" videoScope={null}>
                <div className="flex justify-center items-center py-40">
                    <div className="text-error font-bold flex flex-col items-center gap-4">
                        <span className="material-symbols-outlined text-4xl">broken_image</span>
                        <span>Surveillance feed not found.</span>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout activePage="video" videoScope={video}>
            <div className="w-full px-4 md:px-margin-desktop pb-20">
                <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
                    
                    {/* Left Column: Video & Timeline */}
                    <div className="w-full lg:w-[896px] shrink-0 flex flex-col gap-6">
                        
                        {/* Video Player */}
                        <div ref={containerRef} className="relative bg-[#060a14] w-full aspect-video rounded-lg overflow-hidden border border-outline-variant/10 shadow-2xl flex items-center justify-center group">
                            
                            {/* Custom Top Control Bar */}
                            <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/85 via-black/40 to-transparent p-4 flex justify-between items-center transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                                {/* Left Side: Back & Metadata */}
                                <div className="flex items-center gap-4 pointer-events-auto">
                                    <button 
                                        onClick={() => router.push('/archives')}
                                        className="flex items-center gap-1.5 text-white/80 hover:text-white transition-all text-[11px] font-bold uppercase tracking-wider bg-black/55 backdrop-blur-md px-3 py-1.5 rounded border border-white/10 hover:border-primary/50"
                                    >
                                        <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                                        Archives
                                    </button>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-[14px] text-white drop-shadow-md select-none truncate max-w-[200px] md:max-w-md">
                                            {video.filename.split('.')[0]}
                                        </span>
                                        <span className="text-[9px] text-on-surface-variant/70 font-mono tracking-wide mt-0.5">
                                            {video.duration ? `${Math.floor(video.duration)}s` : 'Unknown'} • AI Synthesis Active
                                        </span>
                                    </div>
                                </div>

                                {/* Right Side: Actions (Overlays & Fullscreen) */}
                                <div className="flex items-center gap-2.5 pointer-events-auto">
                                    <button 
                                        onClick={() => setShowOverlays(!showOverlays)} 
                                        className={`p-1.5 bg-black/55 border rounded transition-all flex items-center justify-center ${showOverlays ? 'border-primary text-primary hover:border-primary/80' : 'border-white/10 text-white/80 hover:text-white hover:border-primary/50'}`}
                                        title={showOverlays ? "Hide AI Overlays" : "Show AI Overlays"}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">{showOverlays ? 'visibility' : 'visibility_off'}</span>
                                    </button>
                                    <button 
                                        onClick={toggleFullScreen} 
                                        className="p-1.5 bg-black/55 border border-white/10 hover:border-primary/50 rounded text-white/80 hover:text-white transition-all flex items-center justify-center"
                                        title="Toggle Fullscreen"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                                    </button>
                                </div>
                            </div>

                            <div className="relative w-full h-full flex items-center justify-center">
                                <video 
                                    ref={videoRef}
                                    controls 
                                    controlsList="nofullscreen"
                                    className="absolute inset-0 w-full h-full object-contain z-10"
                                    src={video.filepath.startsWith('http') ? video.filepath : `${API_BASE_URL}/uploads/${encodeURIComponent(video.filepath.split('\\').pop() || video.filepath.split('/').pop() || "")}`}
                                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                    onPlay={() => {
                                        setSelectedDetectionId(null);
                                        setSelectedPlateId(null);
                                        setSelectedCaptionId(null);
                                    }}
                                    onLoadedMetadata={(e) => {
                                        setVideoSize({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight });
                                    }}
                                >
                                    Your browser does not support the video tag.
                                </video>
                                
                                {/* Bounding Boxes / Polygons Overlay */}
                                {showOverlays && (
                                    <div className="absolute m-auto top-0 bottom-0 left-0 right-0 max-w-full max-h-full pointer-events-none z-20" style={{ aspectRatio: `${videoSize.width} / ${videoSize.height}` }}>
                                    
                                    {/* SVG Polygons for Segmented Detections */}
                                    <svg
                                        className="absolute inset-0 w-full h-full pointer-events-none z-10"
                                        viewBox="0 0 100 100"
                                        preserveAspectRatio="none"
                                    >
                                        {detections.filter(d => Math.abs(d.timestamp_sec - currentTime) < 0.25).map((det, i) => {
                                            if (!det.segmentation_json) return null;
                                            
                                            let points: [number, number][] = [];
                                            try {
                                                points = typeof det.segmentation_json === 'string' 
                                                    ? JSON.parse(det.segmentation_json) 
                                                    : det.segmentation_json;
                                            } catch (e) {}

                                            if (!points || points.length === 0) return null;

                                            const pointStr = points.map(([px, py]) => `${px * 100},${py * 100}`).join(" ");

                                            const isSelected = det.id === selectedDetectionId;
                                            const hasSelection = selectedDetectionId !== null;
                                            const isLowConf = det.confidence < 0.6;
                                            const colorHexMap: Record<string, string> = {
                                                person: '#4285F4',
                                                car: '#EA4335',
                                                backpack: '#FBBC05',
                                                handbag: '#34A853',
                                                bicycle: '#FF6D00',
                                                cow: '#8E24AA',
                                                'traffic light': '#00BFA5'
                                            };
                                            
                                            const baseColor = isLowConf ? '#ffb4ab' : (colorHexMap[det.object_type] || '#4cd6ff');
                                            const strokeColor = isSelected ? '#00E5FF' : baseColor;
                                            const strokeWidth = isSelected ? "4.5" : "2.5";
                                            const fillOpacity = isSelected ? "33" : "1A";
                                            const opacity = hasSelection && !isSelected ? "0.2" : "1";

                                            return (
                                                <g key={`seg-${i}`} style={{ opacity, transition: 'opacity 0.2s ease-in-out' }}>
                                                    <polygon
                                                        points={pointStr}
                                                        fill={`${strokeColor}${fillOpacity}`}
                                                        stroke={strokeColor}
                                                        strokeWidth={strokeWidth}
                                                        strokeLinejoin="round"
                                                        vectorEffect="non-scaling-stroke"
                                                        style={{
                                                            filter: isSelected 
                                                                ? `drop-shadow(0px 0px 8px ${strokeColor}) drop-shadow(0px 0px 15px ${strokeColor})` 
                                                                : `drop-shadow(0px 0px 4px ${strokeColor})`,
                                                            transition: 'all 0.1s linear'
                                                        }}
                                                    />
                                                </g>
                                            );
                                        })}
                                    </svg>

                                    {/* HTML labels for segmented detections */}
                                    {detections.filter(d => Math.abs(d.timestamp_sec - currentTime) < 0.25 && d.segmentation_json).map((det, i) => {
                                        let points: [number, number][] = [];
                                        try {
                                            points = typeof det.segmentation_json === 'string'
                                                ? JSON.parse(det.segmentation_json)
                                                : det.segmentation_json;
                                        } catch (e) {}

                                        if (!points || points.length === 0) return null;

                                        const xs = points.map(([px]) => px);
                                        const ys = points.map(([, py]) => py);
                                        const minX = Math.min(...xs);
                                        const maxX = Math.max(...xs);
                                        const minY = Math.min(...ys);
                                        const labelX = Math.min(Math.max(((minX + maxX) / 2) * 100, 7), 93);
                                        const labelY = Math.min(Math.max(minY * 100, 4), 96);
                                        const labelTransform = minY < 0.06 ? 'translate(-50%, 35%)' : 'translate(-50%, -125%)';
                                        
                                        const isSelected = det.id === selectedDetectionId;
                                        const hasSelection = selectedDetectionId !== null;
                                        const isLowConf = det.confidence < 0.6;
                                        const colorHexMap: Record<string, string> = {
                                            person: '#4285F4',
                                            car: '#EA4335',
                                            backpack: '#FBBC05',
                                            handbag: '#34A853',
                                            bicycle: '#FF6D00',
                                            cow: '#8E24AA',
                                            'traffic light': '#00BFA5'
                                        };
                                        const baseColor = isLowConf ? '#ffb4ab' : (colorHexMap[det.object_type] || '#4cd6ff');
                                        const strokeColor = isSelected ? '#00E5FF' : baseColor;
                                        const opacity = hasSelection && !isSelected ? 0.2 : 1;

                                        return (
                                            <div
                                                key={`seg-label-${i}`}
                                                className="absolute z-20 px-1.5 py-0.5 text-[9px] leading-none font-bold font-mono uppercase rounded border whitespace-nowrap bg-[#0b1326] text-white pointer-events-none transition-all duration-200"
                                                style={{
                                                    left: `${labelX}%`,
                                                    top: `${labelY}%`,
                                                    borderColor: strokeColor,
                                                    boxShadow: isSelected 
                                                        ? `0 0 15px ${strokeColor}` 
                                                        : `0 0 10px ${strokeColor}33`,
                                                    transform: labelTransform,
                                                    opacity,
                                                    scale: isSelected ? '1.1' : '1'
                                                }}
                                            >
                                                {det.object_type} {det.track_id !== null && `#${det.track_id}`} {(det.confidence * 100).toFixed(0)}%
                                            </div>
                                        );
                                    })}

                                    {/* Fallback Bounding Boxes */}
                                    {detections.filter(d => Math.abs(d.timestamp_sec - currentTime) < 0.25 && !d.segmentation_json).map((det, i) => {
                                        let box = null;
                                        try {
                                            if (det.bbox_json) {
                                                const parsed = typeof det.bbox_json === 'string' ? JSON.parse(det.bbox_json) : det.bbox_json;
                                                if (Array.isArray(parsed) && parsed.length >= 4) {
                                                    box = parsed;
                                                }
                                            }
                                        } catch (e) {}
                                        
                                        if (!box) return null;
                                        
                                        const isNormalized = box[2] <= 1.5;
                                        const left = isNormalized ? box[0] * 100 : (box[0] / 640) * 100;
                                        const top = isNormalized ? box[1] * 100 : (box[1] / 640) * 100;
                                        const width = isNormalized ? (box[2] - box[0]) * 100 : ((box[2] - box[0]) / 640) * 100;
                                        const height = isNormalized ? (box[3] - box[1]) * 100 : ((box[3] - box[1]) / 640) * 100;
                                        
                                        const isSelected = det.id === selectedDetectionId;
                                        const hasSelection = selectedDetectionId !== null;
                                        
                                        const opacity = hasSelection && !isSelected ? 0.2 : 1;
                                        const borderStyle = isSelected ? '4px solid #00E5FF' : '2px solid currentColor';

                                        return (
                                            <div 
                                                key={`det-fallback-${i}`} 
                                                className="absolute z-10 pointer-events-none transition-all duration-75" 
                                                style={{
                                                    left: `${left}%`, 
                                                    top: `${top}%`, 
                                                    width: `${width}%`, 
                                                    height: `${height}%`,
                                                    border: borderStyle,
                                                    backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)',
                                                    color: isSelected ? '#00E5FF' : undefined,
                                                    boxShadow: isSelected ? '0 0 20px #00E5FF' : undefined,
                                                    opacity
                                                }}
                                            >
                                                <div 
                                                    className="absolute -top-6 left-[-2px] px-2 py-0.5 text-[10px] font-bold font-mono uppercase border whitespace-nowrap"
                                                    style={{
                                                        backgroundColor: '#0b1326',
                                                        borderColor: isSelected ? '#00E5FF' : 'currentColor',
                                                        color: isSelected ? '#00E5FF' : undefined,
                                                        scale: isSelected ? '1.05' : '1'
                                                    }}
                                                >
                                                    {det.object_type} {det.track_id !== null && `#${det.track_id}`} {(det.confidence * 100).toFixed(0)}%
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Bounding Boxes for license plates */}
                                    {activeTab === "plates" && plates.filter(p => Math.abs(p.timestamp_sec - currentTime) < 0.25).map((plate, i) => {
                                        let box = null;
                                        try {
                                            if (plate.bbox_json) {
                                                const parsed = typeof plate.bbox_json === 'string' ? JSON.parse(plate.bbox_json) : plate.bbox_json;
                                                if (Array.isArray(parsed) && parsed.length >= 4) {
                                                    box = parsed;
                                                }
                                            }
                                        } catch (e) {}
                                        
                                        if (!box) return null;
                                        
                                        const isNormalized = box[2] <= 1.5;
                                        const left = isNormalized ? box[0] * 100 : (box[0] / 640) * 100;
                                        const top = isNormalized ? box[1] * 100 : (box[1] / 640) * 100;
                                        const width = isNormalized ? (box[2] - box[0]) * 100 : ((box[2] - box[0]) / 640) * 100;
                                        const height = isNormalized ? (box[3] - box[1]) * 100 : ((box[3] - box[1]) / 640) * 100;
                                        
                                        const isSelected = plate.id === selectedPlateId;
                                        const hasSelection = selectedPlateId !== null;
                                        
                                        const strokeColor = isSelected ? '#FFEA00' : '#34A853';
                                        const opacity = hasSelection && !isSelected ? 0.2 : 1;
                                        const borderStyle = isSelected ? '4px solid #FFEA00' : '2px solid #34A853';

                                        return (
                                            <div 
                                                key={`plate-overlay-${i}`} 
                                                className="absolute z-15 pointer-events-none transition-all duration-75" 
                                                style={{
                                                    left: `${left}%`, 
                                                    top: `${top}%`, 
                                                    width: `${width}%`, 
                                                    height: `${height}%`,
                                                    border: borderStyle,
                                                    backgroundColor: isSelected ? 'rgba(255, 234, 0, 0.15)' : 'rgba(52, 168, 83, 0.1)',
                                                    boxShadow: isSelected ? '0 0 25px #FFEA00' : undefined,
                                                    opacity
                                                }}
                                            >
                                                <div 
                                                    className="absolute -top-6 left-[-2px] px-2 py-0.5 text-[10px] font-bold font-mono uppercase border whitespace-nowrap shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                                    style={{
                                                        backgroundColor: '#0b1326',
                                                        borderColor: strokeColor,
                                                        color: strokeColor,
                                                        scale: isSelected ? '1.05' : '1'
                                                    }}
                                                >
                                                    PLATE: {plate.plate_number}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Waveform Timeline Section */}
                        <div className="relative pt-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-[11px] font-bold tracking-widest text-on-surface-variant uppercase">Intelligence Timeline</h3>
                                <span className={`text-[12px] font-bold ${tabTheme.text}`}>
                                    {activeTab === "objects" && `${detections.length} Objects`}
                                    {activeTab === "plates" && `${plates.length} Plates`}
                                    {activeTab === "semantic" && `${captions.length} Scenes`} Detected
                                </span>
                            </div>

                            <div 
                                className="relative h-16 bg-surface-container-low rounded border border-outline-variant/20 flex items-end px-2 pb-1.5 transition-all overflow-visible"
                                onMouseLeave={() => setHoveredBucket(null)}
                            >
                                {video && video.duration > 0 && buckets.map((bucket, idx) => {
                                    const heightPercent = (bucket.count / maxCount) * 100;
                                    const isPlaybackActive = currentTime >= bucket.startTime && currentTime < bucket.endTime;
                                    const hasActivity = bucket.count > 0;
                                    
                                    return (
                                        <div
                                            key={`waveform-bar-${idx}`}
                                            onClick={() => {
                                                jumpToTime(bucket.startTime);
                                                if (bucket.items.length > 0) {
                                                    if (activeTab === "objects") {
                                                        setSelectedDetectionId(bucket.items[0].id);
                                                    } else if (activeTab === "plates") {
                                                        setSelectedPlateId(bucket.items[0].id);
                                                    } else if (activeTab === "semantic") {
                                                        setSelectedCaptionId(bucket.items[0].id);
                                                    }
                                                }
                                            }}
                                            onMouseEnter={(e) => {
                                                setHoveredBucket(bucket);
                                                const timelineContainer = e.currentTarget.parentElement;
                                                if (timelineContainer) {
                                                    const containerRect = timelineContainer.getBoundingClientRect();
                                                    const itemRect = e.currentTarget.getBoundingClientRect();
                                                    const centerPos = itemRect.left - containerRect.left + (itemRect.width / 2);
                                                    
                                                    // Tooltip is 240px wide (w-60). Keep it fully inside container bounds.
                                                    let leftPos = centerPos - 120;
                                                    leftPos = Math.max(leftPos, 8);
                                                    leftPos = Math.min(leftPos, containerRect.width - 240 - 8);
                                                    setTooltipX(leftPos);
                                                }
                                            }}
                                            className="flex-1 mx-[1px] relative cursor-pointer group flex flex-col justify-end h-full animate-in fade-in duration-300"
                                        >
                                            <div
                                                className={`w-full rounded-t-sm transition-all duration-200 ${
                                                    isPlaybackActive 
                                                        ? `${tabTheme.active} ${tabTheme.shadow}` 
                                                        : hasActivity
                                                            ? `${tabTheme.active} opacity-60 ${tabTheme.hover}`
                                                            : 'bg-outline-variant/15 hover:bg-outline-variant/40'
                                                }`}
                                                style={{ height: `${hasActivity ? Math.max(heightPercent, 20) : 8}%` }}
                                            />
                                            {isPlaybackActive && (
                                                <div className={`absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${tabTheme.active} ${tabTheme.shadow}`} />
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Hover Tooltip */}
                                {hoveredBucket && (
                                    <div 
                                        className={`absolute z-50 bg-[#070b14]/95 backdrop-blur-md p-3 rounded-lg border ${tabTheme.border} shadow-2xl pointer-events-none text-xs w-60 transition-all duration-150 ease-out animate-in fade-in-50 zoom-in-95`}
                                        style={{ 
                                            left: `${tooltipX}px`, 
                                            bottom: '72px'
                                        }}
                                    >
                                        <div className={`font-mono font-bold mb-1.5 flex justify-between items-center ${tabTheme.text}`}>
                                            <span>
                                                {(() => {
                                                    const m = Math.floor(hoveredBucket.startTime / 60);
                                                    const s = Math.floor(hoveredBucket.startTime % 60);
                                                    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                                })()} - {(() => {
                                                    const m = Math.floor(hoveredBucket.endTime / 60);
                                                    const s = Math.floor(hoveredBucket.endTime % 60);
                                                    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                                })()}
                                            </span>
                                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-surface-container-high/50">
                                                {hoveredBucket.count} {hoveredBucket.count === 1 ? 'Event' : 'Events'}
                                            </span>
                                        </div>
                                        <div className="text-white/80 space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                                            {hoveredBucket.count === 0 ? (
                                                <div className="text-on-surface-variant/50 italic py-1">No neural alerts identified</div>
                                            ) : (
                                                hoveredBucket.items.slice(0, 3).map((item: any, idx: number) => (
                                                    <div key={`tooltip-item-${idx}`} className="flex items-start gap-1.5 leading-tight">
                                                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${tabTheme.active}`} />
                                                        <span className="truncate">
                                                            {activeTab === "objects" && (
                                                                <span className="capitalize">
                                                                    <strong>{item.object_type}</strong> ({(item.confidence * 100).toFixed(0)}%)
                                                                </span>
                                                            )}
                                                            {activeTab === "plates" && (
                                                                <span>
                                                                    Plate <strong>{item.plate_number}</strong> ({(item.confidence * 100).toFixed(0)}%)
                                                                </span>
                                                            )}
                                                            {activeTab === "semantic" && (
                                                                <span className="italic">
                                                                    "{item.caption || 'No caption'}"
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                            {hoveredBucket.count > 3 && (
                                                <div className="text-[10px] text-on-surface-variant/70 italic pl-3">
                                                    + {hoveredBucket.count - 3} more detections
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Detections Sidebar */}
                    <div className="flex-1 min-w-[380px] bg-surface-container-low/30 border border-outline-variant/10 rounded-xl flex flex-col h-[610px] overflow-hidden shadow-xl" style={{ background: "rgba(19, 27, 46, 0.4)", backdropFilter: "blur(8px)" }}>
                            <div className="p-5 pb-3">
                                <h3 className="text-[14px] font-bold text-on-surface mb-3 flex items-center justify-between relative">
                                    <span>Detection Insights</span>
                                    <div className="flex items-center gap-2">
                                        {/* Reprocess Dropdown Menu */}
                                        {showReprocess && (
                                            <div className="absolute top-10 right-0 z-50 bg-[#0c1224] rounded-lg border border-outline-variant/30 p-4 shadow-xl w-64 text-on-surface font-body-base">
                                                <h3 className="text-sm font-bold mb-3">Enhance Intelligence</h3>
                                                <div className="space-y-2 mb-4">
                                                    <label className="flex items-center gap-2 cursor-pointer text-[12px] font-bold">
                                                        <input type="checkbox" checked={reprocessTags} onChange={e => {setReprocessTags(e.target.checked); if(!e.target.checked) setReprocessOCR(false);}} className="accent-primary" />
                                                        Object tagging
                                                    </label>
                                                    <label className={`flex items-center gap-2 cursor-pointer text-[12px] font-bold ${!reprocessTags ? 'opacity-50' : ''}`}>
                                                        <input type="checkbox" checked={reprocessOCR} onChange={e => setReprocessOCR(e.target.checked)} disabled={!reprocessTags} className="accent-primary" />
                                                        Licence Plates
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-[12px] font-bold">
                                                        <input type="checkbox" checked={reprocessSemantic} onChange={e => setReprocessSemantic(e.target.checked)} className="accent-primary" />
                                                        Semantic Search
                                                    </label>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setShowReprocess(false)} className="flex-1 py-1.5 text-[11px] font-bold bg-surface hover:bg-surface-variant rounded">Cancel</button>
                                                    <button onClick={handleReprocess} disabled={isReprocessing} className="flex-1 py-1.5 text-[11px] font-bold bg-primary text-on-primary hover:bg-primary/90 rounded disabled:opacity-50">
                                                        {isReprocessing ? "Starting..." : "Start"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Enhance (Magic Button) */}
                                        <button 
                                            onClick={() => setShowReprocess(!showReprocess)} 
                                            className={`p-1.5 border ${showReprocess ? 'border-primary text-primary' : 'border-outline-variant/20 text-on-surface-variant'} rounded hover:bg-surface-container-highest hover:text-white transition-colors flex items-center justify-center`}
                                            title="Enhance Intelligence"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">magic_button</span>
                                        </button>

                                        {/* Export CSV */}
                                        <button 
                                            onClick={handleExportCSV}
                                            className="p-1.5 border border-outline-variant/20 rounded text-on-surface-variant hover:bg-surface-container-highest hover:text-white transition-colors flex items-center justify-center"
                                            title="Export CSV"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">download</span>
                                        </button>
                                    </div>
                                </h3>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">search</span>
                                    <input 
                                        type="text"
                                        placeholder={
                                            activeTab === "objects" 
                                                ? "Filter classes..." 
                                                : activeTab === "plates" 
                                                    ? "Search plates..." 
                                                    : "Search scenes..."
                                        } 
                                        value={filterQuery}
                                        onChange={(e) => setFilterQuery(e.target.value)}
                                        className="w-full bg-surface-container border border-outline-variant/20 rounded px-10 py-2.5 text-[13px] text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Tabs Navigation */}
                            <div className="flex border-b border-outline-variant/10 bg-surface-container-low/20 px-4 mb-3">
                                <button 
                                    onClick={() => { setActiveTab("objects"); setFilterQuery(""); }}
                                    className={`flex-grow py-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                                        activeTab === "objects" 
                                            ? "border-primary text-primary" 
                                            : "border-transparent text-on-surface-variant hover:text-on-surface"
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[15px]">sell</span>
                                    Objects ({detections.length})
                                </button>
                                <button 
                                    onClick={() => { setActiveTab("plates"); setFilterQuery(""); }}
                                    className={`flex-grow py-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                                        activeTab === "plates" 
                                            ? "border-[#34A853] text-[#34A853]" 
                                            : "border-transparent text-on-surface-variant hover:text-on-surface"
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[15px]">badge</span>
                                    Plates ({plates.length})
                                </button>
                                <button 
                                    onClick={() => { setActiveTab("semantic"); setFilterQuery(""); }}
                                    className={`flex-grow py-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                                        activeTab === "semantic" 
                                            ? "border-[#FBBC05] text-[#FBBC05]" 
                                            : "border-transparent text-on-surface-variant hover:text-on-surface"
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[15px]">description</span>
                                    Semantic ({captions.length})
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5 custom-scrollbar">
                                {(video.status === 'processing' || video.status === 'uploading') ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 bg-[#0b1326]/30 rounded-lg border border-primary/10">
                                        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                                            <span className="material-symbols-outlined text-[28px] text-primary animate-spin">smart_toy</span>
                                        </div>
                                        <h4 className="text-[15px] font-bold text-white mb-2 uppercase tracking-wider">
                                            {video.status === 'uploading' ? 'Ingesting Video Feed...' : 'AI Synthesis In Progress'}
                                        </h4>
                                        <p className="text-[12px] text-on-surface-variant max-w-[280px] mb-6 leading-relaxed">
                                            {video.status === 'uploading' 
                                                ? 'Transmitting surveillance data to cloud operator node...'
                                                : `Sentinel AI is mapping target objects, license plates, and generating semantic descriptions...`}
                                        </p>
                                        
                                        {video.status === 'processing' && (
                                            <div className="w-full max-w-[240px] mb-8">
                                                <div className="flex justify-between items-center text-[10px] font-mono text-primary font-bold mb-1.5">
                                                    <span>PROGRESS</span>
                                                    <span>{progressPct}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden border border-outline-variant/10">
                                                    <div 
                                                        className="h-full bg-primary rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(76,214,255,0.5)]"
                                                        style={{ width: `${progressPct}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleCancelProcessing}
                                            className="px-6 py-2.5 rounded-full font-bold text-[12px] bg-error/15 hover:bg-error/30 text-error border border-error/25 hover:border-error transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(234,67,53,0.1)] active:scale-95 cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                            CANCEL PROCESSING
                                        </button>
                                    </div>
                                ) : video.status === 'cancelled' ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 bg-[#0b1326]/20 rounded-lg border border-outline-variant/10">
                                        <div className="w-14 h-14 rounded-full bg-surface-variant/30 flex items-center justify-center mb-6">
                                            <span className="material-symbols-outlined text-[28px] text-on-surface-variant/70">cancel</span>
                                        </div>
                                        <h4 className="text-[15px] font-bold text-white mb-2 uppercase tracking-wider">
                                            Processing Cancelled
                                        </h4>
                                        <p className="text-[12px] text-on-surface-variant max-w-[280px] mb-6 leading-relaxed">
                                            This video's neural mapping was cancelled by an operator. No detection logs or plates are available for this session.
                                        </p>
                                        <button
                                            onClick={() => setShowReprocess(true)}
                                            className="px-6 py-2.5 rounded-full font-bold text-[12px] bg-primary text-on-primary hover:bg-primary/95 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)] active:scale-95 cursor-pointer animate-pulse"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">magic_button</span>
                                            REPROCESS VIDEO
                                        </button>
                                    </div>
                                ) : video.status === 'failed' ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 bg-error-container/5 rounded-lg border border-error/15">
                                        <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mb-6">
                                            <span className="material-symbols-outlined text-[28px] text-error">warning</span>
                                        </div>
                                        <h4 className="text-[15px] font-bold text-error mb-2 uppercase tracking-wider">
                                            Processing Failed
                                        </h4>
                                        <p className="text-[12px] text-on-surface-variant max-w-[280px] mb-6 leading-relaxed">
                                            An error occurred during neural map generation. Please verify the video codec or retry.
                                        </p>
                                        <button
                                            onClick={() => setShowReprocess(true)}
                                            className="px-6 py-2.5 rounded-full font-bold text-[12px] bg-primary text-on-primary hover:bg-primary/95 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)] active:scale-95 cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">magic_button</span>
                                            RETRY PROCESSING
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {activeTab === "objects" && filteredItems.map((det, i) => {
                                            const isLowConf = det.confidence < 0.6;
                                            const isActive = Math.abs(det.timestamp_sec - currentTime) < 0.25;
                                            const isSelected = det.id === selectedDetectionId;
                                            
                                            return (
                                                <div 
                                                    key={`det-${i}`} 
                                                    onClick={() => {
                                                        jumpToTime(det.timestamp_sec);
                                                        setSelectedDetectionId(det.id);
                                                    }}
                                                    className={`p-3.5 rounded-lg border cursor-pointer transition-all duration-300 ${
                                                        isSelected
                                                            ? 'bg-surface-container-highest border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.35)] scale-[1.01] text-white'
                                                            : isActive 
                                                                ? `bg-surface-container-highest border-primary/50 shadow-[0_0_10px_rgba(66,133,244,0.1)]` 
                                                                : 'bg-surface border-outline-variant/10 hover:border-outline-variant/30 hover:bg-surface-container'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`material-symbols-outlined text-[16px] ${isLowConf ? 'text-error' : objectColors[det.object_type] || 'text-primary'}`}>
                                                                {isLowConf ? 'warning' : (objectIcons[det.object_type] || 'sell')}
                                                            </span>
                                                            <span className={`font-bold text-[13px] capitalize ${isLowConf ? 'text-error' : 'text-on-surface'}`}>
                                                                {det.object_type}
                                                                {det.track_id !== null && (
                                                                    <span className="text-[10px] font-mono text-primary bg-primary/10 px-1 rounded ml-1">#{det.track_id.toString().padStart(2, '0')}</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                        <span className="font-bold text-[13px] text-on-surface">{(det.confidence * 100).toFixed(0)}%</span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center mt-2.5">
                                                        <span className="text-[11px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                                                            {Math.floor(det.timestamp_sec / 60).toString().padStart(2, '0')}:{(det.timestamp_sec % 60).toFixed(1).padStart(4, '0')}
                                                        </span>
                                                        <span className={`text-[8px] font-bold tracking-wider px-2 py-0.5 rounded uppercase border ${isLowConf ? 'text-error bg-error/10 border-error/20' : 'text-primary bg-primary/10 border-primary/20'}`}>
                                                            {isLowConf ? 'Manual Check' : 'Confidence High'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {activeTab === "plates" && filteredItems.map((plate, i) => {
                                            const isActive = Math.abs(plate.timestamp_sec - currentTime) < 0.25;
                                            const isSelected = plate.id === selectedPlateId;
                                            
                                            return (
                                                <div 
                                                    key={`plate-${i}`} 
                                                    onClick={() => {
                                                        jumpToTime(plate.timestamp_sec);
                                                        setSelectedPlateId(plate.id);
                                                    }}
                                                    className={`p-3.5 rounded-lg border cursor-pointer transition-all duration-300 ${
                                                        isSelected
                                                            ? 'bg-surface-container-highest border-[#FFEA00] shadow-[0_0_15px_rgba(255,234,0,0.35)] scale-[1.01] text-white'
                                                            : isActive 
                                                                ? `bg-surface-container-highest border-[#34A853]/50 shadow-[0_0_10px_rgba(52,168,83,0.1)]` 
                                                                : 'bg-surface border-outline-variant/10 hover:border-outline-variant/30 hover:bg-surface-container'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="material-symbols-outlined text-[16px] text-[#34A853]">badge</span>
                                                            <span className="font-mono font-bold text-[14px] text-on-surface tracking-wider">{plate.plate_number}</span>
                                                        </div>
                                                        <span className="font-bold text-[13px] text-[#34A853]">{(plate.confidence * 100).toFixed(0)}%</span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center mt-2.5">
                                                        <span className="text-[11px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                                                            {Math.floor(plate.timestamp_sec / 60).toString().padStart(2, '0')}:{(plate.timestamp_sec % 60).toFixed(1).padStart(4, '0')}
                                                        </span>
                                                        <span className="text-[8px] font-bold tracking-wider text-[#34A853] bg-[#34A853]/10 px-2 py-0.5 rounded uppercase border border-[#34A853]/20">
                                                            OCR Verified
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {activeTab === "semantic" && filteredItems.map((caption, i) => {
                                            const isActive = Math.abs(caption.timestamp_sec - currentTime) < 0.25;
                                            const isSelected = caption.id === selectedCaptionId;
                                            
                                            return (
                                                <div 
                                                    key={`caption-${i}`} 
                                                    onClick={() => {
                                                        jumpToTime(caption.timestamp_sec);
                                                        setSelectedCaptionId(caption.id);
                                                    }}
                                                    className={`p-3.5 rounded-lg border cursor-pointer transition-all duration-300 ${
                                                        isSelected
                                                            ? 'bg-surface-container-highest border-[#FBBC05] shadow-[0_0_15px_rgba(251,188,5,0.35)] scale-[1.01] text-white'
                                                            : isActive 
                                                                ? `bg-surface-container-highest border-[#FBBC05]/50 shadow-[0_0_10px_rgba(251,188,5,0.1)]` 
                                                                : 'bg-surface border-outline-variant/10 hover:border-outline-variant/30 hover:bg-surface-container'
                                                    }`}
                                                >
                                                    <p className="text-[13px] text-on-surface italic leading-snug">"{caption.caption || 'No caption generated'}"</p>
                                                    
                                                    <div className="flex justify-between items-center mt-3">
                                                        <span className="text-[11px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                                                            {Math.floor(caption.timestamp_sec / 60).toString().padStart(2, '0')}:{(caption.timestamp_sec % 60).toFixed(1).padStart(4, '0')}
                                                        </span>
                                                        <span className="text-[8px] font-bold tracking-wider text-[#FBBC05] bg-[#FBBC05]/10 px-2 py-0.5 rounded uppercase border border-[#FBBC05]/20">
                                                            SigLIP Frame
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        </div>
                </div>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                }
            `}</style>
        </Layout>
    );
}
