"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type EventRow = {
    id: string;
    title: string;
    deadline?: string;
    candidate_dates?: string[];
    plan_description?: string;
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
            ⏳ 回答締切まで：{timeLeft}
        </div>
    );
};

function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return `${d.getMonth() + 1}/${d.getDate()}`;
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

    const [isSubmitted, setIsSubmitted] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [pass, setPass] = useState("");


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

    const answerNames = useMemo(() => {
        const currentNormalizedName = normalizeName(userName);
        return answers
            .map((a) => a.user_name)
            .filter(Boolean)
            .filter((name) => normalizeName(name) !== currentNormalizedName);
    }, [answers, userName]);

    if (!event) {
        return <div style={{ padding: "40px", textAlign: "center" }}>読み込み中...</div>;
    }

    const isExpired = event.deadline
        ? new Date().getTime() > new Date(event.deadline).setHours(23, 59, 50, 0)
        : false;

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
        setIsSubmitted(true);
        setPageError("");
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

    return (
        <main
            style={{
                padding: "20px",
                maxWidth: "500px",
                margin: "0 auto",
                fontFamily: "sans-serif",
                backgroundColor: "white",
                color: "black",
                minHeight: "100vh",
            }}
        >
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

            {pageError && (
                <div
                    style={{
                        marginBottom: "16px",
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
                <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "20px" }}>
                    <section style={{ display: "flex", gap: "10px" }}>
                        <div style={{ flex: 2 }}>
                            <label style={{ fontWeight: "bold", fontSize: "14px" }}>名前</label>
                            <input
                                type="text"
                                disabled={isExpired}
                                placeholder="例: 山田太郎"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    borderRadius: "10px",
                                    border: "1px solid #ccc",
                                    marginTop: "5px",
                                }}
                            />
                            <div style={{ fontSize: "12px", color: "#666", marginTop: "6px", lineHeight: 1.6 }}>
                                ・フルネーム推奨です
                                <br />
                                ・ひらがな / カタカナ / 漢字 / 英字で入力してください
                                <br />
                                ・スペースや記号は使えません
                                <br />
                                ・英字は内部で小文字として扱います
                            </div>
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
                    </section>

                    <section>
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
                                                backgroundColor: selections[d] === "ok" ? "#000" : "white",
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
                                                backgroundColor: selections[d] === "ng" ? "#eee" : "white",
                                                color: "black",
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
                            border: "2px solid #e6fffa",
                            padding: "15px",
                            borderRadius: "12px",
                            backgroundColor: "#f0fff4",
                        }}
                    >
                        <p
                            style={{
                                fontWeight: "bold",
                                fontSize: "13px",
                                marginBottom: "10px",
                                color: "#2c7a7b",
                            }}
                        >
                            🚃 交通の忖度（集まりやすい場所の計算に使用,機能停止中）
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
                            border: "2px solid #f0f0f0",
                            padding: "15px",
                            borderRadius: "12px",
                            opacity: isExpired ? 0.6 : 1,
                        }}
                    >
                        <p style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "10px" }}>
                            🕵️ 裏条件（匿名 / ホストも確認不可能）
                        </p>

                        <div style={{ marginBottom: "14px" }}>
                            <div style={{ fontSize: "12px", marginBottom: "8px", color: "#555" }}>
                                この人たちが来るなら行く（選択）
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                {answerNames.map((name) => (
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
                                {answerNames.map((name) => (
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

                    <section>
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

                    <section>
                        <label style={{ fontWeight: "bold", fontSize: "14px" }}>やりたいこと案・メモ</label>
                        <textarea
                            disabled={isExpired}
                            placeholder="例：焼肉がいいです！"
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

                    <button
                        type="button"
                        onClick={submit}
                        disabled={isExpired}
                        style={{
                            padding: "20px",
                            backgroundColor: isExpired ? "#ccc" : "#000",
                            color: "white",
                            borderRadius: "12px",
                            fontWeight: "bold",
                            border: "none",
                            cursor: isExpired ? "not-allowed" : "pointer",
                            fontSize: "16px",
                        }}
                    >
                        {isExpired ? "回答締切となりました" : "回答を送信する"}
                    </button>
                </div>
            ) : (
                <div style={{ textAlign: "center", padding: "60px" }}>
                    <h2 style={{ color: "#28a745" }}>✅ 送信完了！</h2>
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

            <footer style={{ marginTop: "50px", textAlign: "center", paddingBottom: "40px" }}>
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
        </main>
    );
}