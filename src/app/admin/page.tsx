"use client";

import { useState } from "react";

type StatsResponse = {
    totalEvents: number;
    dailyCounts: Record<string, number>;
    weeklyCounts: Record<string, number>;
    averageAnswerCount: number;
    averageCandidateDateCount: number;
};

export default function AdminStatsPage() {
    const [adminKey, setAdminKey] = useState("");
    const [stats, setStats] = useState<StatsResponse | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const fetchStats = async () => {
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/admin/stats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ admin_key: adminKey }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.error || "failed");
            }

            setStats(data);
        } catch (e: any) {
            setStats(null);
            setError(e?.message || "取得に失敗しました。");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
            <h1 style={{ fontSize: 28, fontWeight: "bold", marginBottom: 16 }}>管理用集計</h1>

            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                <input
                    type="password"
                    placeholder="ADMIN_STATS_KEY"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    style={{
                        flex: 1,
                        minWidth: 260,
                        padding: 12,
                        borderRadius: 10,
                        border: "1px solid #ccc",
                    }}
                />
                <button
                    type="button"
                    onClick={fetchStats}
                    disabled={loading}
                    style={{
                        padding: "12px 18px",
                        borderRadius: 10,
                        border: "none",
                        background: "#111",
                        color: "#fff",
                        fontWeight: "bold",
                        cursor: "pointer",
                    }}
                >
                    {loading ? "取得中..." : "集計を見る"}
                </button>
            </div>

            {error && <div style={{ color: "#c53030", marginBottom: 16 }}>{error}</div>}

            {stats && (
                <div style={{ display: "grid", gap: 16 }}>
                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
                        <div>総イベント作成数：{stats.totalEvents}</div>
                        <div>回答数の平均：{stats.averageAnswerCount}</div>
                        <div>候補日数の平均：{stats.averageCandidateDateCount}</div>
                    </div>

                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
                        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>日別作成数</h2>
                        <div style={{ display: "grid", gap: 6 }}>
                            {Object.entries(stats.dailyCounts)
                                .sort((a, b) => a[0].localeCompare(b[0]))
                                .map(([date, count]) => (
                                    <div key={date}>
                                        {date} : {count}
                                    </div>
                                ))}
                        </div>
                    </div>

                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
                        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>週別作成数</h2>
                        <div style={{ display: "grid", gap: 6 }}>
                            {Object.entries(stats.weeklyCounts)
                                .sort((a, b) => a[0].localeCompare(b[0]))
                                .map(([week, count]) => (
                                    <div key={week}>
                                        {week} 週 : {count}
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}