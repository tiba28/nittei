"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type EventRow = {
    id: string;
    title: string;
    deadline?: string;
    candidate_dates?: string[];
    plan_description?: string;
    guest_names?: string[];
    allow_custom_name?: boolean;
};

type AnswerNameRow = {
    user_name: string;
};

const CountdownTimer = ({ deadlineStr }: { deadlineStr: string }) => {
    const [timeLeft, setTimeLeft] = useState<string>("計算中...");

    useEffect(() => {
        if (!deadlineStr) return;

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const targetDate = new Date(deadlineStr);
            targetDate.setHours(23, 59, 50, 0);
            const target = targetDate.getTime();
            const distance = target - now;

            if (distance < 0) {
                setTimeLeft("受付終了");
                clearInterval(timer);
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            setTimeLeft(`${days}日 ${hours}時間 ${minutes}分 ${seconds}秒`);
        }, 1000);

        return () => clearInterval(timer);
    }, [deadlineStr]);

    return (
        <div
            style={{
                backgroundColor: "#fff5f5",
                padding: "12px",
                borderRadius: "12px",
                textAlign: "center",
                border: "1px solid #feb2b2",
                margin: "15px 0",
                color: "#c53030",
                fontWeight: "bold",
                fontSize: "14px",
            }}
        >
            回答締切まで：{timeLeft}
        </div>
    );
};

const JAPAN_HOLIDAYS = new Set([
    "2025-01-01", "2025-01-13", "2025-02-11", "2025-02-23", "2025-03-20",
    "2025-04-29", "2025-05-03", "2025-05-04", "2025-05-05", "2025-07-21",
    "2025-08-11", "2025-09-15", "2025-09-23", "2025-10-13", "2025-11-03",
    "2025-11-23", "2025-11-24",
    "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20",
    "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05", "2026-07-20",
    "2026-08-11", "2026-09-21", "2026-09-23", "2026-10-12", "2026-11-03",
    "2026-11-23",
]);

function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return <span>{dateStr}</span>;
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    const dayIndex = d.getDay();
    const isRed = dayIndex === 0 || dayIndex === 6 || JAPAN_HOLIDAYS.has(dateStr);
    const dayColor = isRed ? "#e53e3e" : "#999";
    return (
        <span>
            {d.getMonth() + 1}/{d.getDate()}
            <span style={{ fontSize: "12px", color: dayColor, marginLeft: "4px" }}>
                ({dayNames[dayIndex]})
            </span>
        </span>
    );
}

function normalizeName(name?: string) {
    return (name || "")
        .trim()
        .replace(/[ 　]/g, "")
        .toLowerCase();
}

function validateUserName(name: string) {
    const trimmed = name.trim();

    if (!trimmed) return "名前を入力してください。";
    if (/[ 　]/.test(trimmed)) return "名前にはスペースを入れずに入力してください。";
    if (!/^[ぁ-んァ-ヶー一-龠々a-zA-Z]+$/.test(trimmed)) {
        return "名前は、ひらがな・カタカナ・漢字・英字のみで入力してください。記号は使用できません。";
    }
    if (trimmed.length < 2) return "名前は2文字以上で入力してください。";

    return "";
}

function parsePassRoute(passRoute?: string) {
    if (!passRoute) return { from: "", to: "" };
    const parts = passRoute.split("〜");
    return {
        from: (parts[0] || "").trim(),
        to: (parts[1] || "").trim(),
    };
}

export default function GuestPage() {
    const params = useParams();

    const [event, setEvent] = useState<EventRow | null>(null);
    const [answers, setAnswers] = useState<AnswerNameRow[]>([]);

    const [userName, setUserName] = useState("");
    const [userPassCode, setUserPassCode] = useState("");
    const [emailGuest, setEmailGuest] = useState("");
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [withUsers, setWithUsers] = useState<string[]>([]);
    const [withoutUsers, setWithoutUsers] = useState<string[]>([]);
    const [withUsersText, setWithUsersText] = useState("");
    const [withoutUsersText, setWithoutUsersText] = useState("");
    const [suggestion, setSuggestion] = useState("");
    const [homeStation, setHomeStation] = useState("");
    const [passFrom, setPassFrom] = useState("");
    const [passTo, setPassTo] = useState("");

    const [selectedPresetName, setSelectedPresetName] = useState<string | null>(null);

    const [isSubmitted, setIsSubmitted] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [pass, setPass] = useState("");

    const [feedbackType, setFeedbackType] = useState<"bug" | "improvement" | "impression" | "other">("impression");
    const [feedbackText, setFeedbackText] = useState("");
    const [contactInfo, setContactInfo] = useState("");
    const [feedbackLoading, setFeedbackLoading] = useState(false);
    const [feedbackSuccess, setFeedbackSuccess] = useState(false);

    const [pageError, setPageError] = useState("");
    const [restoredInfoMessage, setRestoredInfoMessage] = useState("");
    const [restoredKey, setRestoredKey] = useState("");



    const passFromTouched = useRef(false);
    const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const eventId = Array.isArray(params.id) ? params.id[0] : params.id;

    const fetchAnswerNames = async () => {
        if (!eventId) return;
        const res = await fetch(`/api/events/${eventId}/answer-names`, { cache: "no-store" });
        const data = await res.json();
        setAnswers(Array.isArray(data) ? data : []);
    };

    const handleSubmitFeedback = async () => {
        if (!feedbackText.trim()) {
            alert("フィードバック内容を入力してください。");
            return;
        }
        setFeedbackLoading(true);
        try {
            const res = await fetch(`/api/events/${eventId}/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    feedback_type: feedbackType,
                    feedback_text: feedbackText.trim(),
                    contact_info: contactInfo.trim(),
                }),
            });

            if (res.ok) {
                setFeedbackSuccess(true);
            } else {
                alert("送信に失敗しました。");
            }
        } catch (error) {
            alert("通信エラーが発生しました。");
        } finally {
            setFeedbackLoading(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!eventId) return;

            const res = await fetch(`/api/events/${eventId}/public`, { cache: "no-store" });
            const data = await res.json();

            if (!res.ok) {
                setPageError("イベント情報の読み込みに失敗しました。");
                return;
            }

            setEvent(data);

            const init: Record<string, string> = {};
            (data.candidate_dates || []).forEach((d: string) => {
                init[d] = "ng";
            });
            setSelections(init);

            await fetchAnswerNames();
        };

        fetchData();
    }, [eventId]);

    useEffect(() => {
        if (!passFromTouched.current) {
            setPassFrom(homeStation);
        }
    }, [homeStation]);

    useEffect(() => {
        if (!eventId) return;

        const normalizedName = normalizeName(userName);
        const trimmedPass = userPassCode.trim();

        setRestoredInfoMessage("");

        if (!normalizedName || !trimmedPass) return;

        const currentKey = `${eventId}::${normalizedName}::${trimmedPass}`;
        if (restoredKey === currentKey) return;

        if (restoreTimerRef.current) {
            clearTimeout(restoreTimerRef.current);
        }

        restoreTimerRef.current = setTimeout(async () => {
            const res = await fetch(`/api/events/${eventId}/answer-restore`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_name: normalizedName,
                    pass_code: trimmedPass,
                }),
            });

            const data = await res.json();

            if (!data?.restored) return;

            setRestoredKey(currentKey);
            setHomeStation((prev) => prev || (data.home_station || ""));
            setSuggestion((prev) => prev || (data.guest_suggestion || ""));

            const route = parsePassRoute(data.pass_route);
            setPassFrom((prev) => prev || route.from || (data.home_station || ""));
            setPassTo((prev) => prev || route.to);

            setRestoredInfoMessage("前回入力した最寄り駅・定期区間・メモを反映しました。");
        }, 350);

        return () => {
            if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
        };
    }, [userName, userPassCode, eventId, restoredKey]);

    const answeredNamesSet = useMemo(() => {
        return new Set(answers.map((a) => normalizeName(a.user_name)).filter(Boolean));
    }, [answers]);

    const answerNames = useMemo(() => {
        const currentNormalizedName = normalizeName(userName);
        return answers
            .map((a) => a.user_name)
            .filter(Boolean)
            .filter((name) => normalizeName(name) !== currentNormalizedName);
    }, [answers, userName]);

    // 裏条件チップ用: ホスト設定名 + 回答済み名 を統合（重複除去、自分を除外）
    const conditionCandidateNames = useMemo(() => {
        const currentNormalized = normalizeName(userName);
        const seen = new Set<string>();
        const result: string[] = [];

        const push = (name: string) => {
            const n = normalizeName(name);
            if (!n || n === currentNormalized || seen.has(n)) return;
            seen.add(n);
            result.push(name);
        };

        (event?.guest_names ?? []).forEach(push);
        answerNames.forEach(push);

        return result.sort((a, b) => a.localeCompare(b, "ja"));
    }, [event?.guest_names, answerNames, userName]);

    if (!event) {
        return <div style={{ padding: "40px", textAlign: "center" }}>読み込み中...</div>;
    }

    const isExpired = event.deadline
        ? new Date().getTime() > new Date(event.deadline).setHours(23, 59, 50, 0)
        : false;

    const hasPreset = (event.guest_names ?? []).length > 0;
    const showFreeInput = !hasPreset || event.allow_custom_name !== false || selectedPresetName !== null;

    const submit = async () => {
        setPageError("");
        setRestoredInfoMessage("");

        if (isExpired) {
            setPageError("申し訳ありません。回答期限が過ぎているため送信できません。");
            return;
        }

        const nameValidationError = validateUserName(userName);
        if (nameValidationError) {
            setPageError(nameValidationError);
            return;
        }

        if (!userPassCode.trim()) {
            setPageError("修正用のパスコードを入力してください。");
            return;
        }

        if (userPassCode.trim().length < 4) {
            setPageError("修正用のパスコードは4文字以上で入力してください。");
            return;
        }

        if (!eventId) {
            setPageError("イベントIDが取得できませんでした。");
            return;
        }

        const res = await fetch(`/api/events/${eventId}/answer-upsert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_name: userName,
                pass_code: userPassCode.trim(),
                email_guest: emailGuest,
                selections,
                withUsers,
                withoutUsers,
                withUsersText,
                withoutUsersText,
                suggestion,
                homeStation,
                passFrom,
                passTo,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            setPageError(data?.error || "送信に失敗しました。");
            return;
        }

        await fetchAnswerNames();
        setPageError("");
        setIsSubmitted(true);

    };

    const toggleUser = (
        name: string,
        list: string[],
        setList: React.Dispatch<React.SetStateAction<string[]>>,
        otherList: string[],
        setOtherList: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
        const normalized = normalizeName(name);

        if (list.some((n) => normalizeName(n) === normalized)) {
            setList(list.filter((n) => normalizeName(n) !== normalized));
            return;
        }

        setList([...list, name]);

        if (otherList.some((n) => normalizeName(n) === normalized)) {
            setOtherList(otherList.filter((n) => normalizeName(n) !== normalized));
        }
    };

    // ▼ 修正前： if (isSubmitted) { ...
    // ▼ 修正後： if (isSubmitted && !feedbackSuccess) { ... に変更！

    if (isSubmitted && !feedbackSuccess) {
        return (
            <main className="max-w-md mx-auto p-6 font-sans">
                <div className="bg-white border rounded-xl p-6 shadow-sm text-center">
                    <div className="text-sm font-bold text-white bg-orange-500 rounded-lg px-4 py-2 mb-3 inline-block">
                        まだ完了していません！
                    </div>
                    <h1 className="text-xl font-bold text-gray-800 mb-2">アンケートに答えて回答を完了させてください</h1>
                    <p className="text-gray-500 text-sm mb-6">送信後にアンケートにお答えいただくと回答完了となります。</p>

                    <div className="text-left bg-gray-50 p-5 rounded-xl border">
                        <h2 className="font-bold text-gray-800 mb-2">アプリの感想・改善要望をお聞かせください</h2>
                        <p className="text-xs text-gray-500 mb-4">匿名日程調整「にってい」は現在β版です。より使いやすくするため、ぜひご意見をお願いします！</p>

                        <select
                            value={feedbackType}
                            onChange={(e) => setFeedbackType(e.target.value as any)}
                            className="w-full p-2 mb-3 border rounded-lg text-gray-800"
                        >
                            <option value="impression">使ってみた感想</option>
                            <option value="improvement">機能の改善要望</option>
                            <option value="bug">バグの報告</option>
                            <option value="other">その他</option>
                        </select>

                        <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="ここが使いやすかった、ここが分かりにくかった等"
                            className="w-full p-3 border rounded-lg h-24 mb-3 text-gray-800"
                        />

                        <button
                            onClick={handleSubmitFeedback}
                            disabled={feedbackLoading}
                            className={`w-full py-3 rounded-lg font-bold text-white transition-all ${feedbackLoading ? "bg-gray-400" : "bg-black hover:bg-gray-800"
                                }`}
                        >
                            {feedbackLoading ? "送信中..." : "フィードバックを送信する"}
                        </button>

                        {/* ▼ ここを追加：書かない人はスキップして元の完了画面へ行けるようにする */}
                    </div>
                </div>
            </main>
        );
    }


    return (
        <main
            style={{
                maxWidth: "500px",
                margin: "0 auto",
                fontFamily: "sans-serif",
                backgroundColor: "#f0efec",
                color: "black",
                minHeight: "100vh",
            }}
        >
            <div style={{ backgroundColor: "#111", padding: "14px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px", fontWeight: "800", color: "#fff", letterSpacing: "-0.03em" }}>nittei</span>
                <span style={{ width: "1px", height: "16px", backgroundColor: "#333", display: "inline-block" }} />
                <span style={{ fontSize: "11px", color: "#666", letterSpacing: "0.12em" }}>SCHEDULE TOOL</span>
            </div>
            <div style={{ padding: "20px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "10px" }}>
                {event.title}
            </h1>

            {event.plan_description && (
                <p
                    style={{
                        whiteSpace: "pre-wrap",
                        fontSize: "14px",
                        color: "#444",
                        backgroundColor: "#f9f9f9",
                        padding: "15px",
                        borderRadius: "10px",
                        marginBottom: "15px",
                    }}
                >
                    {event.plan_description}
                </p>
            )}

            <CountdownTimer deadlineStr={event.deadline || ""} />

            {isExpired && (
                <div
                    style={{
                        marginBottom: "18px",
                        padding: "14px",
                        borderRadius: "12px",
                        backgroundColor: "#f8f8f8",
                        border: "1px solid #ddd",
                        color: "#333",
                        lineHeight: 1.7,
                        fontSize: "14px",
                    }}
                >
                    <div style={{ fontWeight: "bold", marginBottom: "6px" }}>受付は終了しました</div>
                    <div>・回答締切済みです</div>
                    <div>・回答の修正はできません</div>
                    <div>・ホストの集計をお待ちください</div>
                </div>
            )}

            {restoredInfoMessage && (
                <div
                    style={{
                        marginBottom: "16px",
                        padding: "12px",
                        borderRadius: "10px",
                        backgroundColor: "#f0fff4",
                        border: "1px solid #9ae6b4",
                        color: "#276749",
                        fontSize: "14px",
                    }}
                >
                    {restoredInfoMessage}
                </div>
            )}

            {!isSubmitted ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>
                    <section style={{ backgroundColor: "white", borderRadius: "16px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #e8e8e8" }}>
                        {(event.guest_names ?? []).length > 0 && (() => {
                            const sorted = [...(event.guest_names ?? [])].sort((a, b) => a.localeCompare(b, "ja"));
                            const unanswered = sorted.filter(n => !answeredNamesSet.has(normalizeName(n)));
                            const answered = sorted.filter(n => answeredNamesSet.has(normalizeName(n)));
                            const renderChip = (name: string) => {
                                const isAnswered = answeredNamesSet.has(normalizeName(name));
                                const isSelected = selectedPresetName === name;
                                return (
                                    <button
                                        key={name}
                                        type="button"
                                        disabled={isExpired}
                                        onClick={() => {
                                            if (isSelected) {
                                                setSelectedPresetName(null);
                                                setUserName("");
                                            } else {
                                                setSelectedPresetName(name);
                                                setUserName(name);
                                            }
                                        }}
                                        style={{
                                            border: "1px solid #ddd",
                                            borderRadius: "999px",
                                            padding: "10px 16px",
                                            background: isSelected ? "#111" : isAnswered ? "#e8e8e8" : "#fff",
                                            color: isSelected ? "#fff" : "#333",
                                            cursor: isExpired ? "default" : "pointer",
                                            fontSize: "13px",
                                            fontWeight: isSelected ? "bold" : "normal",
                                        }}
                                    >
                                        {name}
                                    </button>
                                );
                            };
                            return (
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ fontWeight: "bold", fontSize: "14px" }}>あなたの名前を選んでください</label>
                                    {unanswered.length > 0 && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
                                            {unanswered.map(renderChip)}
                                        </div>
                                    )}
                                    {answered.length > 0 && (
                                        <div style={{ marginTop: "14px" }}>
                                            <div style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>回答済み</div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                                {answered.map(renderChip)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        <div style={{ display: "flex", gap: "10px" }}>
                            <div style={{ flex: 2 }}>
                                {!showFreeInput ? (
                                    <div style={{ fontSize: "13px", color: "#888", marginTop: "6px" }}>
                                        上のリストから名前を選んでください
                                    </div>
                                ) : (
                                    <>
                                        <label style={{ fontWeight: "bold", fontSize: "14px" }}>
                                            {hasPreset ? "または自分で入力" : "名前"}
                                        </label>
                                        <input
                                            type="text"
                                            disabled={isExpired || selectedPresetName !== null}
                                            placeholder={selectedPresetName !== null ? selectedPresetName : "例: 山田太郎"}
                                            value={selectedPresetName !== null ? selectedPresetName : userName}
                                            onChange={(e) => setUserName(e.target.value)}
                                            style={{
                                                width: "100%",
                                                padding: "12px",
                                                borderRadius: "10px",
                                                border: "1px solid #ccc",
                                                marginTop: "5px",
                                                backgroundColor: selectedPresetName !== null ? "#f5f5f5" : "white",
                                                color: selectedPresetName !== null ? "#888" : "black",
                                            }}
                                        />
                                        {selectedPresetName !== null ? (
                                            <div style={{ fontSize: "12px", color: "#888", marginTop: "6px" }}>
                                                上のチップをもう一度タップで選択解除できます
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: "12px", color: "#666", marginTop: "6px", lineHeight: 1.6 }}>
                                                ・フルネーム推奨です
                                                <br />
                                                ・ひらがな / カタカナ / 漢字 / 英字で入力してください
                                                <br />
                                                ・スペースや記号は使えません
                                                <br />
                                                ・英字は内部で小文字として扱います
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div style={{ flex: 1 }}>
                                <label style={{ fontWeight: "bold", fontSize: "14px" }}>認証パス</label>
                                <input
                                    type="password"
                                    disabled={isExpired}
                                    placeholder="4文字以上"
                                    value={userPassCode}
                                    onChange={(e) => setUserPassCode(e.target.value)}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        borderRadius: "10px",
                                        border: "1px solid #ccc",
                                        marginTop: "5px",
                                    }}
                                />
                                <div style={{ fontSize: "12px", color: "#666", marginTop: "6px", lineHeight: 1.6 }}>
                                    回答を修正するときに必要です
                                </div>
                            </div>
                        </div>
                    </section>

                    <section style={{ backgroundColor: "white", borderRadius: "16px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #e8e8e8" }}>
                        <label style={{ fontWeight: "bold", fontSize: "14px" }}>日程の回答</label>
                        <div
                            style={{
                                marginTop: "10px",
                                border: "1px solid #eee",
                                borderRadius: "10px",
                                overflow: "hidden",
                            }}
                        >
                            {(event.candidate_dates || []).map((d: string) => (
                                <div
                                    key={d}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "12px",
                                        borderBottom: "1px solid #eee",
                                    }}
                                >
                                    <span style={{ fontSize: "14px" }}>{formatDateLabel(d)}</span>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            type="button"
                                            onClick={() => !isExpired && setSelections({ ...selections, [d]: "ok" })}
                                            style={{
                                                width: "60px",
                                                padding: "8px",
                                                borderRadius: "8px",
                                                border: "1px solid #eee",
                                                backgroundColor: selections[d] === "ok" ? "#16a34a" : "white",
                                                color: selections[d] === "ok" ? "white" : "black",
                                                cursor: isExpired ? "default" : "pointer",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            ○
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => !isExpired && setSelections({ ...selections, [d]: "ng" })}
                                            style={{
                                                width: "60px",
                                                padding: "8px",
                                                borderRadius: "8px",
                                                border: "1px solid #eee",
                                                backgroundColor: selections[d] === "ng" ? "#f87171" : "white",
                                                color: selections[d] === "ng" ? "white" : "black",
                                                cursor: isExpired ? "default" : "pointer",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
                            ※ 日程の回答内容は自動復元されません
                        </div>
                    </section>

                    <section
                        style={{
                            backgroundColor: "white",
                            borderRadius: "16px",
                            padding: "20px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                            border: "1px solid #e8e8e8",
                            opacity: 0.8,
                        }}
                    >
                        <p
                            style={{
                                fontSize: "13px",
                                marginBottom: "10px",
                                color: "#555",
                            }}
                        >
                            <span style={{ fontWeight: "bold", color: "#444" }}>機能停止中</span>
                            {" — "}交通の忖度（集まりやすい場所の計算に使用）
                        </p>

                        <input
                            type="text"
                            disabled={isExpired}
                            placeholder="最寄り駅"
                            value={homeStation}
                            onChange={(e) => setHomeStation(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px",
                                borderRadius: "8px",
                                border: "1px solid #b2f5ea",
                                fontSize: "13px",
                                marginBottom: "10px",
                            }}
                        />


                    </section>

                    <section
                        style={{
                            backgroundColor: "white",
                            borderRadius: "16px",
                            padding: "20px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                            border: "1px solid #e8e8e8",
                            opacity: isExpired ? 0.6 : 1,
                        }}
                    >
                        <p style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "10px" }}>
                            裏条件（匿名 / ホストも確認不可能）
                        </p>

                        <div style={{ marginBottom: "14px" }}>
                            <div style={{ fontSize: "12px", marginBottom: "8px", color: "#555" }}>
                                この人たちが来るなら行く（選択）
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                {conditionCandidateNames.map((name) => (
                                    <button
                                        key={`with-${name}`}
                                        type="button"
                                        disabled={isExpired}
                                        onClick={() => toggleUser(name, withUsers, setWithUsers, withoutUsers, setWithoutUsers)}
                                        style={{
                                            border: "1px solid #ddd",
                                            borderRadius: "999px",
                                            padding: "8px 12px",
                                            background: withUsers.some((n) => normalizeName(n) === normalizeName(name))
                                                ? "#111"
                                                : "#fff",
                                            color: withUsers.some((n) => normalizeName(n) === normalizeName(name))
                                                ? "#fff"
                                                : "#111",
                                            cursor: isExpired ? "default" : "pointer",
                                            fontSize: "12px",
                                        }}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                disabled={isExpired}
                                placeholder="自由入力（カンマ区切り）"
                                value={withUsersText}
                                onChange={(e) => setWithUsersText(e.target.value)}
                                style={{
                                    width: "100%",
                                    marginTop: "10px",
                                    padding: "10px",
                                    borderRadius: "8px",
                                    border: "1px solid #eee",
                                    fontSize: "13px",
                                }}
                            />
                        </div>

                        <div>
                            <div style={{ fontSize: "12px", marginBottom: "8px", color: "#555" }}>
                                この人たちが来るなら行かない（選択）
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                {conditionCandidateNames.map((name) => (
                                    <button
                                        key={`without-${name}`}
                                        type="button"
                                        disabled={isExpired}
                                        onClick={() =>
                                            toggleUser(name, withoutUsers, setWithoutUsers, withUsers, setWithUsers)
                                        }
                                        style={{
                                            border: "1px solid #ddd",
                                            borderRadius: "999px",
                                            padding: "8px 12px",
                                            background: withoutUsers.some(
                                                (n) => normalizeName(n) === normalizeName(name)
                                            )
                                                ? "#111"
                                                : "#fff",
                                            color: withoutUsers.some((n) => normalizeName(n) === normalizeName(name))
                                                ? "#fff"
                                                : "#111",
                                            cursor: isExpired ? "default" : "pointer",
                                            fontSize: "12px",
                                        }}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                disabled={isExpired}
                                placeholder="自由入力（カンマ区切り）"
                                value={withoutUsersText}
                                onChange={(e) => setWithoutUsersText(e.target.value)}
                                style={{
                                    width: "100%",
                                    marginTop: "10px",
                                    padding: "10px",
                                    borderRadius: "8px",
                                    border: "1px solid #eee",
                                    fontSize: "13px",
                                }}
                            />
                        </div>

                        <div style={{ fontSize: "12px", color: "#666", marginTop: "8px", lineHeight: 1.6 }}>
                            ※ 裏条件の内容は自動復元されません
                        </div>
                    </section>

                    <section style={{ backgroundColor: "white", borderRadius: "16px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #e8e8e8" }}>
                        <label style={{ fontWeight: "bold", fontSize: "14px" }}>メールアドレス（カレンダー連携用）</label>
                        <input
                            type="email"
                            disabled={isExpired}
                            placeholder="例: guest@example.com"
                            value={emailGuest}
                            onChange={(e) => setEmailGuest(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: "10px",
                                border: "1px solid #ccc",
                                marginTop: "5px",
                            }}
                        />
                        <div style={{ fontSize: "12px", color: "#666", marginTop: "6px", lineHeight: 1.6 }}>
                            日程が確定した際、Googleカレンダーからの自動招待に使用されます（他の参加者には非公開です）。
                        </div>
                    </section>

                    <section style={{ backgroundColor: "white", borderRadius: "16px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #e8e8e8" }}>
                        <label style={{ fontWeight: "bold", fontSize: "14px" }}>やりたいこと案・メモ</label>
                        <textarea
                            disabled={isExpired}
                            placeholder="例：3日は2時から参加できます。"
                            value={suggestion}
                            onChange={(e) => setSuggestion(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: "10px",
                                border: "1px solid #ccc",
                                minHeight: "80px",
                                marginTop: "5px",
                                fontFamily: "inherit",
                            }}
                        />
                    </section>

                    {pageError && (
                        <div
                            style={{
                                padding: "12px",
                                borderRadius: "10px",
                                backgroundColor: "#fff5f5",
                                border: "1px solid #feb2b2",
                                color: "#c53030",
                                fontSize: "14px",
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            {pageError}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={submit}
                        disabled={isExpired}
                        style={{
                            padding: "16px",
                            backgroundColor: isExpired ? "#ccc" : "#111",
                            color: "white",
                            borderRadius: "12px",
                            fontWeight: "700",
                            border: "none",
                            cursor: isExpired ? "not-allowed" : "pointer",
                            fontSize: "15px",
                            letterSpacing: "0.05em",
                            boxShadow: isExpired ? "none" : "0 4px 12px rgba(0,0,0,0.2)",
                        }}
                    >
                        {isExpired ? "回答締切となりました" : "回答を送信する →"}
                    </button>
                </div>
            ) : (
                <div style={{ textAlign: "center", padding: "60px" }}>
                    <h2 style={{ color: "#28a745" }}>🎉 回答が完了しました！</h2>
                    <p style={{ marginTop: "10px", color: "#666", lineHeight: 1.8 }}>
                        ホストの集計をお待ちください。
                        <br />
                        必要があれば、同じ名前と認証パスで再入力できます。
                    </p>
                    {!isExpired && (
                        <button
                            type="button"
                            onClick={() => setIsSubmitted(false)}
                            style={{
                                marginTop: "20px",
                                background: "none",
                                border: "none",
                                color: "#0070f3",
                                cursor: "pointer",
                            }}
                        >
                            回答を修正する
                        </button>
                    )}
                </div>
            )}

            <div style={{ marginTop: "48px", borderRadius: "20px", overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }}>
                <div style={{ height: "3px", background: "linear-gradient(90deg, #444, #888, #444)" }} />
                <div style={{ background: "linear-gradient(145deg, #111 0%, #1c1c1c 100%)", padding: "32px 24px 28px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: "90px", fontWeight: "900", color: "rgba(255,255,255,0.05)", letterSpacing: "-0.05em", pointerEvents: "none", userSelect: "none", whiteSpace: "nowrap" }}>
                        nittei
                    </div>
                    <span style={{ display: "inline-block", fontSize: "10px", fontWeight: "700", color: "#777", letterSpacing: "0.2em", border: "1px solid #2a2a2a", padding: "4px 12px", borderRadius: "999px", marginBottom: "16px" }}>
                        SCHEDULE TOOL
                    </span>
                    <p style={{ fontSize: "36px", fontWeight: "800", letterSpacing: "-0.03em", color: "#fff", margin: "0 0 6px" }}>
                        nittei
                    </p>
                    <p style={{ fontSize: "12px", color: "#666", letterSpacing: "0.05em", margin: 0 }}>
                        本音で答えられる日程調整
                    </p>
                </div>
                <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #ddd, transparent)" }} />
                <div style={{ backgroundColor: "#fafafa", padding: "28px 24px", textAlign: "center" }}>
                    <p style={{ fontSize: "13px", color: "#555", lineHeight: 2, margin: "0 0 22px" }}>
                        このイベントはnitteiで作成されました。<br />
                        回答は参加者同士に公開されず、<strong style={{ color: "#111" }}>裏条件</strong>で<br />
                        本音を匿名で伝えることもできます。
                    </p>
                    <a href="/" style={{ display: "inline-block", backgroundColor: "#111", color: "#fff", fontSize: "13px", fontWeight: "700", padding: "14px 32px", borderRadius: "10px", textDecoration: "none", letterSpacing: "0.05em", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                        自分もイベントを作成する →
                    </a>
                </div>
            </div>

            <footer style={{ marginTop: "30px", textAlign: "center", paddingBottom: "40px" }}>
                <button
                    type="button"
                    onClick={() => setShowLogin(!showLogin)}
                    style={{
                        color: "#494747",
                        fontSize: "14px",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                    }}
                >
                    host Login
                </button>

                {showLogin && (
                    <div
                        style={{
                            marginTop: "15px",
                            padding: "15px",
                            border: "1px solid #eee",
                            borderRadius: "10px",
                        }}
                    >
                        <input
                            type="password"
                            value={pass}
                            onChange={(e) => setPass(e.target.value)}
                            placeholder="Pass"
                            style={{ padding: "8px", border: "1px solid #eee", borderRadius: "5px" }}
                        />
                        <button
                            type="button"
                            onClick={async () => {
                                if (!eventId) return;

                                const res = await fetch(`/api/events/${eventId}/host-login`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ password: pass }),
                                });

                                const data = await res.json();

                                if (!res.ok) {
                                    setPageError(data?.error || "ホスト用パスワードが違います。");
                                    return;
                                }

                                window.location.href = `/event/${eventId}/host`;
                            }}
                            style={{
                                marginLeft: "10px",
                                padding: "8px 15px",
                                backgroundColor: "#333",
                                color: "white",
                                border: "none",
                                borderRadius: "5px",
                                cursor: "pointer",
                            }}
                        >
                            Go
                        </button>
                    </div>
                )}
            </footer>
        </div>
        </main>
    );
}