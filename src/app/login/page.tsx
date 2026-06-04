"use client";

import { API_BASE_URL } from "@/config";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [time, setTime] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Live clock — runs only on client to avoid hydration mismatch
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            const h = now.getHours().toString().padStart(2, "0");
            const m = now.getMinutes().toString().padStart(2, "0");
            const s = now.getSeconds().toString().padStart(2, "0");
            setTime(`SYS_TIME: ${h}:${m}:${s}`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            let data;
            const text = await res.text();
            try {
                data = JSON.parse(text);
            } catch (e) {
                // If the response is not valid JSON, throw a clearer error
                throw new Error(res.ok ? "Invalid JSON from server" : `Server error (${res.status}): ${text.substring(0, 50)}...`);
            }

            if (!res.ok) {
                throw new Error(data.detail || "Authentication failed.");
            }

            localStorage.setItem("sentinel_auth", "true");
            localStorage.setItem("sentinel_operator", JSON.stringify(data.operator));
            router.push("/");
        } catch (err: any) {
            setError(err.message || "Connection failed. Is the backend running?");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.sentinelPage}>
            {/* Left visual panel */}
            <aside className={styles.leftPanel}>
                <img
                    src="/Vigilant.png"
                    alt="Sentinel AI Server Infrastructure"
                />


            </aside>

            {/* Right login panel */}
            <main className={styles.rightPanel}>
                <div className={styles.rightBgBlur} />
                <div className={styles.rightGrid} />

                <div className={styles.loginContainer}>
                    <div className={styles.glassPanel}>
                        <div className={styles.scanLine} />

                        {/* Corner brackets */}
                        <div className={`${styles.cornerBracket} ${styles.cornerTL}`} />
                        <div className={`${styles.cornerBracket} ${styles.cornerTR}`} />
                        <div className={`${styles.cornerBracket} ${styles.cornerBL}`} />
                        <div className={`${styles.cornerBracket} ${styles.cornerBR}`} />

                        <header>
                            <h1 className={styles.panelTitle}>OPERATOR LOGIN</h1>
                            <p className={styles.panelSubtitle}>Enter your credentials to access the secure node.</p>
                        </header>

                        <form onSubmit={handleSubmit}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="email">
                                    <span className="material-symbols-outlined">alternate_email</span>
                                    EMAIL ADDRESS
                                </label>
                                <input
                                    id="email"
                                    className={styles.loginInput}
                                    type="email"
                                    placeholder="operator@sentinel.sys"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="password">
                                    <span className="material-symbols-outlined">lock</span>
                                    PASSWORD
                                </label>
                                <input
                                    id="password"
                                    className={styles.loginInput}
                                    type="password"
                                    placeholder="••••••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <button type="submit" className={styles.signInBtn} disabled={loading}>
                                {loading ? (
                                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "13px" }}>
                                        AUTHENTICATING...
                                    </span>
                                ) : (
                                    <>
                                        <span>SIGN IN</span>
                                        <span className="material-symbols-outlined">arrow_forward</span>
                                    </>
                                )}
                            </button>

                            {error && <div className={styles.errorMsg}>⚠ {error}</div>}
                        </form>

                        <div className={styles.demoHint}>
                            <p>DEMO CREDENTIALS</p>
                            <p><span>admin@sentinel.sys</span> / <span>sentinel123</span></p>
                        </div>
                    </div>
                </div>


            </main>
        </div>
    );
}
