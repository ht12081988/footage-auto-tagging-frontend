"use client";

import { API_BASE_URL } from "@/config";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.name.endsWith(".mp4")) {
                setFile(droppedFile);
                setError("");
            } else {
                setError("Only MP4 files are supported.");
            }
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setError("");

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${API_BASE_URL}/upload`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Upload failed");
            }
            const data = await res.json();
            router.push(`/video/${data.id}`);
        } catch (err: any) {
            setError(err.message);
            setUploading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-white">Upload Footage</h1>
            
            <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center bg-slate-800/50 hover:bg-slate-800 transition flex flex-col items-center justify-center"
            >
                <div className="w-16 h-16 bg-blue-900/50 text-blue-400 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                </div>
                <h3 className="text-xl font-medium text-white mb-2">Drag and drop your video</h3>
                <p className="text-slate-400 mb-6">Support for single .mp4 file uploads (5-10 mins recommended)</p>
                
                <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden" 
                    accept="video/mp4" 
                    onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                            setFile(e.target.files[0]);
                            setError("");
                        }
                    }} 
                />
                <label htmlFor="file-upload" className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-md cursor-pointer transition shadow">
                    Browse Files
                </label>
            </div>

            {file && (
                <div className="mt-6 bg-slate-800 p-4 rounded-xl flex items-center justify-between border border-slate-700">
                    <div className="flex items-center space-x-4 overflow-hidden">
                        <div className="bg-blue-600 p-2 rounded text-white">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </div>
                        <div className="truncate pr-4">
                            <p className="text-white font-medium truncate">{file.name}</p>
                            <p className="text-slate-400 text-sm">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleUpload} 
                        disabled={uploading}
                        className={`px-6 py-2 rounded-md font-medium shadow transition whitespace-nowrap ${uploading ? 'bg-slate-600 text-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                    >
                        {uploading ? 'Uploading...' : 'Process Video'}
                    </button>
                </div>
            )}
            
            {error && <p className="mt-4 text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-900/50">{error}</p>}
        </div>
    );
}
