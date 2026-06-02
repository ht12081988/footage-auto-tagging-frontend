"use client";

import { API_BASE_URL } from "@/config";
import { useEffect, useState } from "react";
import Layout from "../../components/Layout";

interface TargetClass {
    id: int;
    name: string;
    is_enabled: boolean;
}

export default function Settings() {
    const [targets, setTargets] = useState<TargetClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [operatorModel, setOperatorModel] = useState("yolov8n.pt");

    useEffect(() => {
        fetchTargets();
        const opStr = localStorage.getItem("sentinel_operator");
        if (opStr) {
            try {
                const op = JSON.parse(opStr);
                if (op.ai_model) setOperatorModel(op.ai_model);
            } catch (e) { }
        }
    }, []);

    const fetchTargets = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/targets`);
            const data = await res.json();
            setTargets(data);
        } catch (error) {
            console.error("Error fetching targets:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleTarget = async (name: string, currentState: boolean) => {
        try {
            // Optimistic UI update
            setTargets(targets.map(t => t.name === name ? { ...t, is_enabled: !currentState } : t));

            await fetch(`${API_BASE_URL}/targets/${name}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_enabled: !currentState })
            });
        } catch (error) {
            console.error("Error toggling target:", error);
            // Revert on error
            fetchTargets();
        }
    };

    return (
        <Layout activePage="search">
            <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-display-md text-white font-bold mb-2">Detection Targets</h1>
                        <p className="text-on-surface-variant max-w-2xl text-[14px]">
                            Configure which object classes the Sentinel AI model actively monitors for in uploaded surveillance feeds. Classes disabled here will be ignored during video processing.
                        </p>
                    </div>
                    <div className="bg-surface-container-low border border-primary/20 px-4 py-3 rounded-lg flex flex-col items-start gap-1 min-w-[200px]">
                        <span className="text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Assigned Engine</span>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[18px]">memory</span>
                            <span className="font-mono text-[14px] text-white font-bold">{operatorModel}</span>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {targets.map((target) => (
                            <div
                                key={target.id}
                                onClick={() => toggleTarget(target.name, target.is_enabled)}
                                className={`p-4 rounded-lg border cursor-pointer transition-all flex flex-col justify-between h-[100px] select-none ${target.is_enabled
                                        ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.1)]'
                                        : 'bg-surface-container border-outline-variant/10 hover:border-outline-variant/30 opacity-70'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`material-symbols-outlined text-[20px] ${target.is_enabled ? 'text-primary' : 'text-on-surface-variant'}`}>
                                        {target.is_enabled ? 'visibility' : 'visibility_off'}
                                    </span>
                                    <div className={`w-8 h-4 rounded-full transition-colors relative ${target.is_enabled ? 'bg-primary' : 'bg-surface-variant'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${target.is_enabled ? 'right-0.5' : 'left-0.5'}`}></div>
                                    </div>
                                </div>
                                <span className={`font-bold text-[13px] capitalize truncate mt-2 ${target.is_enabled ? 'text-white' : 'text-on-surface-variant'}`}>
                                    {target.name}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}
