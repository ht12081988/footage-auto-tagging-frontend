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

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Authentication failed.");
            }

            const data = await res.json();
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
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBfT-HVT4dJgz3KEKJXaxD_R4UdnYDs9rryQYTIRw0kQeexd610wIGaqTelvx4FSVD7LcKTW53NCbAGz7kl-6jgHoZYdJeoQcqbd1Fqy-catnBmsoqDJJ1NuSt_X3lvj-MFediAbAVzXbzWtTsGPIFcnW4ZYgyZG7KCgGlDAMHZluCc0DTCm3KHruJtCzL9P5ag9EGZeN_dpKWStFiyihN2z8dq9SfmhoxW-kvuqWgukyL81zNpALRKuLjm5wC1Wy-WAWHirAUBVDNq"
                    alt="Sentinel AI Server Infrastructure"
                />
                <div className={styles.leftGradient} />
                <div className={styles.leftMeta}>
                    <p>DATA_LINK: ESTABLISHED</p>
                    <p>PACKET_LOSS: 0.000%</p>
                    <p>LATENCY: 12ms</p>
                </div>
                <div className={styles.leftBrand}>
                    <div className={styles.brandIconBox}>
                        <span className="material-symbols-outlined" style={{ color: "#a4e6ff", fontSize: "28px" }}>security</span>
                    </div>
                    <div className={styles.brandName}>SENTINEL AI</div>
                </div>
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

                <div className={styles.bottomMeta}>
                    <span>SENTINEL AI v1.0</span>
                    {/* time rendered client-side only to avoid hydration mismatch */}
                    <span suppressHydrationWarning>{time}</span>
                    <span>ENC: AES-256</span>
                </div>
            </main>
        </div>
    );
}
