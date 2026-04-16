"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import CalendarSetButton from './calendarsetbutton';

type AnswerRow = {
    user_name: string;
    selections?: Record<string, string>;
    target_user_name?: string;
    guest_suggestion?: string;
    email_guest?: string;
};

type DateSummaryItem = {
    rawDate: string;
    label: string;
    okCount: number;
    okUsers: string[];
    ngUsers: string[];
};

type PremiumFilterState = {
    kind: "meal" | "cafe" | "drink" | "park" | "activity";
    environment: "none" | "indoor" | "outdoor";
    needs: string[];
};

type FeedbackType = "bug" | "improvement" | "impression" | "other";

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

function uniqueNames(names: string[]) {
    const map = new Map<string, string>();
    for (const name of names) {
        const key = normalizeName(name);
        if (!key) continue;
        if (!map.has(key)) map.set(key, name);
    }
    return Array.from(map.values());
}

function parseConditions(target?: string) {
    const base = { with: [] as string[], without: [] as string[] };
    if (!target) return base;

    const withMatch = target.match(/(?:^|\|)with:([^|]*)/);
    const withoutMatch = target.match(/(?:^|\|)without:([^|]*)/);

    const withNames = (withMatch?.[1] || "")
        .split(",")
        .map((s) => normalizeName(s))
        .filter(Boolean);

    const withoutNames = (withoutMatch?.[1] || "")
        .split(",")
        .map((s) => normalizeName(s))
        .filter(Boolean);

    return {
        with: Array.from(new Set(withNames)),
        without: Array.from(new Set(withoutNames)).filter((name) => !withNames.includes(name)),
    };
}

function computeEffectiveStatus(date: string, answers: AnswerRow[]) {
    const normalizedNameToDisplayName = new Map<string, string>();
    const baseOkMap = new Map<string, boolean>();

    answers.forEach((a) => {
        const normalized = normalizeName(a.user_name);
        if (!normalized) return;
        normalizedNameToDisplayName.set(normalized, a.user_name);
        baseOkMap.set(normalized, a.selections?.[date] === "ok");
    });

    const effectiveMap = new Map(baseOkMap);

    let changed = true;
    let guard = 0;

    while (changed && guard < 20) {
        changed = false;
        guard += 1;

        for (const answer of answers) {
            const selfName = normalizeName(answer.user_name);
            if (!selfName) continue;

            const current = effectiveMap.get(selfName) === true;
            if (!current) continue;

            const { with: withUsers, without: withoutUsers } = parseConditions(answer.target_user_name);

            const withBlocked =
                withUsers.length > 0 &&
                withUsers.some((name) => effectiveMap.get(name) !== true);

            const withoutBlocked =
                withoutUsers.length > 0 &&
                withoutUsers.some((name) => effectiveMap.get(name) === true);

            if (withBlocked || withoutBlocked) {
                effectiveMap.set(selfName, false);
                changed = true;
            }
        }
    }

    const okUsers = Array.from(effectiveMap.entries())
        .filter(([, isOk]) => isOk === true)
        .map(([normalizedName]) => normalizedNameToDisplayName.get(normalizedName) || normalizedName);

    const ngUsers = Array.from(effectiveMap.entries())
        .filter(([, isOk]) => isOk !== true)
        .map(([normalizedName]) => normalizedNameToDisplayName.get(normalizedName) || normalizedName);

    return {
        okUsers: uniqueNames(okUsers),
        ngUsers: uniqueNames(ngUsers),
    };
}

function buildBasicMessageSet(eventTitle: string, selectedDate: string, selectedUsers: string[]) {
    const label = formatDateLabel(selectedDate);

    return {
        confirmMessage: `みなさま
日程調整のご回答ありがとうございました！

${eventTitle}は ${label} で進めさせていただければと思います。
ご参加予定の方は以下のみなさまです。
${selectedUsers.length > 0 ? `・${selectedUsers.join("\n・")}` : "・該当なし"}

当日はどうぞよろしくお願いいたします！`,
        sorryMessage: `みなさま
日程調整のご回答ありがとうございました！

今回は ${eventTitle} を ${label} で進めることになりました。
ご都合が合わなかった方もいらっしゃる中での調整となり申し訳ありません。

また別の機会にもぜひご一緒できればうれしいです。`,
        requestMessage: `みなさま
日程調整のご回答ありがとうございます！

現時点では ${eventTitle} の日程を ${label} で進める案が有力です。
もし難しい点や調整したい点があれば、お手数ですがご連絡いただけますと助かります。

どうぞよろしくお願いいたします。`,
        cancelMessage: `みなさま
日程調整のご回答ありがとうございました。

今回は全体の都合を踏まえ、${eventTitle} の開催は一旦見送ることにいたしました。
せっかくご回答いただいたのに申し訳ありません。

また改めて企画できればと思っておりますので、その際はぜひよろしくお願いいたします。`,
    };
}

function getMessageCardStyle(kind: "confirm" | "sorry" | "request" | "cancel") {
    switch (kind) {
        case "confirm":
            return { bg: "#edf7ff", border: "#b6ddff", textareaBg: "#ffffff" };
        case "sorry":
            return { bg: "#f4f4f5", border: "#cfcfd4", textareaBg: "#ffffff" };
        case "request":
            return { bg: "#fff9db", border: "#f4df82", textareaBg: "#ffffff" };
        case "cancel":
            return { bg: "#fff1f1", border: "#f2b8b8", textareaBg: "#ffffff" };
    }
}

export default function HostPage() {
    const params = useParams();
    const eventId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";

    const [event, setEvent] = useState<any>(null);
    const [answers, setAnswers] = useState<AnswerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [hostPass, setHostPass] = useState("");
    const [authenticated, setAuthenticated] = useState(false);

    const [selectedDateForMessage, setSelectedDateForMessage] = useState("");

    const [premiumFilters, setPremiumFilters] = useState<PremiumFilterState>({
        kind: "meal",
        environment: "none",
        needs: [],
    });

    const [regResults, setRegResults] = useState<string[]>([]);

    const [premiumInfoMessage, setPremiumInfoMessage] = useState("");
    const [interestLoading, setInterestLoading] = useState(false);

    const [feedbackType, setFeedbackType] = useState<FeedbackType>("improvement");
    const [feedbackText, setFeedbackText] = useState("");
    const [contactInfo, setContactInfo] = useState("");
    const [feedbackLoading, setFeedbackLoading] = useState(false);
    const [feedbackError, setFeedbackError] = useState("");
    const [feedbackSuccess, setFeedbackSuccess] = useState("");

    async function logUsage(actionType: string, actionDetail?: string) {
        if (!eventId) return;
        try {
            await fetch(`/api/events/${eventId}/log`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action_type: actionType,
                    action_detail: actionDetail || "",
                }),
            });
        } catch (error) {
            console.error("usage log error:", error);
        }
    }

    const fetchHostData = async () => {
        if (!eventId) return false;

        const res = await fetch(`/api/events/${eventId}/host-data`, {
            cache: "no-store",
        });

        if (res.status === 401) {
            setAuthenticated(false);
            setLoading(false);
            return false;
        }

        const data = await res.json();

        if (!res.ok) {
            setLoading(false);
            return false;
        }

        setEvent(data.event);
        setAnswers(data.answers || []);
        setAuthenticated(true);
        setLoading(false);
        return true;
    };

    useEffect(() => {
        fetchHostData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId]);

    useEffect(() => {
        if (!authenticated) return;
        logUsage("host_page_opened", "host page viewed");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authenticated]);

    const dateSummary: DateSummaryItem[] = useMemo(() => {
        if (!event?.candidate_dates) return [];

        return (event.candidate_dates as string[])
            .map((date: string) => {
                const { okUsers, ngUsers } = computeEffectiveStatus(date, answers);
                return {
                    rawDate: date,
                    label: formatDateLabel(date),
                    okCount: okUsers.length,
                    okUsers,
                    ngUsers,
                };
            })
            .sort((a, b) => {
                if (b.okCount !== a.okCount) return b.okCount - a.okCount;
                return new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime();
            });
    }, [event, answers]);

    useEffect(() => {
        if (!selectedDateForMessage && dateSummary.length > 0) {
            setSelectedDateForMessage(dateSummary[0].rawDate);
        }
    }, [dateSummary, selectedDateForMessage]);

    const selectedSummary = useMemo(() => {
        return dateSummary.find((d) => d.rawDate === selectedDateForMessage) || null;
    }, [dateSummary, selectedDateForMessage]);

    const basicMessageSet = useMemo(() => {
        if (!event || !selectedSummary) return null;
        return buildBasicMessageSet(event.title, selectedSummary.rawDate, selectedSummary.okUsers);
    }, [event, selectedSummary]);

    const handleLogin = async () => {
        if (!eventId) return;

        const res = await fetch(`/api/events/${eventId}/host-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: hostPass }),
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data?.error || "パスワードが違います");
            return;
        }

        await fetchHostData();
    };

    const toggleNeed = (value: string) => {
        setPremiumFilters((prev) => {
            const exists = prev.needs.includes(value);
            return {
                ...prev,
                needs: exists ? prev.needs.filter((v) => v !== value) : [...prev.needs, value],
            };
        });
    };

    const handleInterestClick = async () => {
        setPremiumInfoMessage("");
        setInterestLoading(true);

        try {
            await logUsage(
                "place_suggest_interest_clicked",
                JSON.stringify({
                    selectedDate: selectedSummary?.rawDate || "",
                    kind: premiumFilters.kind,
                    environment: premiumFilters.environment,
                    needs: premiumFilters.needs,
                    participantCount: selectedSummary?.okUsers.length || 0,
                })
            );

            setPremiumInfoMessage("ありがとうございます。場所決めサポートへの関心として記録しました。公開準備の参考にします。");
        } catch {
            setPremiumInfoMessage("反応の記録に失敗しました。時間をおいて再度お試しください。");
        } finally {
            setInterestLoading(false);
        }
    };

    const copyText = async (text: string, kind: string) => {
        try {
            await navigator.clipboard.writeText(text);
            await logUsage("message_copied", kind);
            alert("コピーしました");
        } catch {
            alert("コピーに失敗しました");
        }
    };

    const handleSubmitFeedback = async () => {
        setFeedbackError("");
        setFeedbackSuccess("");

        if (!eventId) {
            setFeedbackError("イベントIDが取得できませんでした。");
            return;
        }

        if (!feedbackText.trim()) {
            setFeedbackError("フィードバック内容を入力してください。");
            return;
        }

        try {
            setFeedbackLoading(true);

            const res = await fetch(`/api/events/${eventId}/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    feedback_type: feedbackType,
                    feedback_text: feedbackText.trim(),
                    contact_info: contactInfo.trim(),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.error || "failed");
            }

            await logUsage(
                "feedback_sent",
                JSON.stringify({
                    feedbackType,
                    hasContactInfo: !!contactInfo.trim(),
                })
            );

            setFeedbackSuccess("フィードバックを送信しました。ありがとうございます。");
            setFeedbackText("");
            setContactInfo("");
            setFeedbackType("improvement");
        } catch {
            setFeedbackError("フィードバック送信に失敗しました。時間をおいて再度お試しください。");
        } finally {
            setFeedbackLoading(false);
        }
    };

    if (loading) {
        return <div style={{ padding: "40px", textAlign: "center" }}>読み込み中...</div>;
    }

    if (!authenticated) {
        return (
            <main
                style={{
                    minHeight: "100vh",
                    background: "#fff",
                    color: "#111",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px",
                    fontFamily: "sans-serif",
                }}
            >
                <div
                    style={{
                        width: "100%",
                        maxWidth: "420px",
                        border: "1px solid #eee",
                        borderRadius: "16px",
                        padding: "24px",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
                    }}
                >
                    <h1 style={{ fontSize: "22px", marginBottom: "8px" }}>ホスト画面</h1>
                    <p style={{ color: "#666", fontSize: "14px", marginBottom: "16px" }}>
                        ホスト画面に入るにはパスワードを入力してください
                    </p>
                    <input
                        type="password"
                        value={hostPass}
                        onChange={(e) => setHostPass(e.target.value)}
                        placeholder="Host password"
                        style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "10px",
                            border: "1px solid #ccc",
                            marginBottom: "12px",
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleLogin}
                        style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "10px",
                            border: "none",
                            background: "#111",
                            color: "#fff",
                            fontWeight: "bold",
                            cursor: "pointer",
                        }}
                    >
                        ログイン
                    </button>
                </div>
            </main>
        );
    }
    // Googleに送る用のメアドリスト作成
    const targetGuestEmails = answers
        .filter(ans => {
            const isTarget = (selectedSummary?.okUsers || [])
                .map(n => normalizeName(n))
                .includes(normalizeName(ans.user_name));

            // 「ターゲットの参加者」かつ「@が含まれる有効そうなメアド」の人だけ抽出
            return isTarget && ans.email_guest && ans.email_guest.includes('@');
        })
        .map(ans => ans.email_guest as string);

    return (
        <main
            style={{
                maxWidth: "980px",
                margin: "0 auto",
                padding: "20px",
                fontFamily: "sans-serif",
                backgroundColor: "white",
                color: "black",
                minHeight: "100vh",
            }}


        >
            <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "8px" }}>
                {event.title}
            </h1>
            <p style={{ color: "#666", marginBottom: "24px" }}>回答数：{answers.length}名</p>

            <section
                style={{
                    border: "1px solid #eee",
                    borderRadius: "14px",
                    padding: "18px",
                    marginBottom: "24px",
                    background: "#fafafa",
                }}
            >
                <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "14px" }}>
                    📅 日程集計
                </h2>

                <div style={{ display: "grid", gap: "10px" }}>
                    {dateSummary.map((item) => (
                        <button
                            key={item.rawDate}
                            type="button"
                            onClick={() => {
                                setSelectedDateForMessage(item.rawDate);
                                setPremiumInfoMessage("");
                            }}
                            style={{
                                textAlign: "left",
                                border:
                                    selectedDateForMessage === item.rawDate ? "2px solid #111" : "1px solid #ddd",
                                borderRadius: "10px",
                                padding: "12px",
                                background: "#fff",
                                cursor: "pointer",
                            }}
                        >
                            <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
                                {item.label}　○ {item.okCount}名
                            </div>
                            <div style={{ fontSize: "13px", color: "#444" }}>
                                {item.okUsers.length ? item.okUsers.join("、") : "該当なし"}
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            {event.confirmed_date ? (
                // 🎉 確定済みの表示
                <div className="mt-8 p-6 border-2 border-green-500 rounded-2xl bg-green-50 text-center">
                    <h2 className="text-2xl font-bold text-green-700 mb-2">🎉 イベント確定済み</h2>
                    <p className="text-lg mb-4">
                        このイベントは <span className="font-bold underline">{formatDateLabel(event.confirmed_date)}</span> で確定しています。
                    </p>
                    <p className="text-sm text-gray-600 mb-6">
                        Googleカレンダーへの登録と、参加者への招待メール送信も完了しています。
                    </p>

                    <div className="max-w-md mx-auto mt-4">
                        <CalendarSetButton
                            eventId={eventId}
                            eventTitle={event?.title || "未取得"}
                            selectedDate={selectedDateForMessage}
                            guestEmails={targetGuestEmails}
                            googleEventId={event?.google_event_id} // ちゃんとIDを渡す！
                            onSuccess={(emails) => setRegResults(emails)}
                        />
                    </div>
                </div>
            ) : (
                // ⚙️ 未確定時（今までのUI）

                <div className="mt-8 shadow-sm p-4 border rounded-xl bg-white">
                    <h2 className="text-lg font-bold mb-4 border-b pb-2">カレンダー連携の確認</h2>

                    <div className="mb-6 bg-gray-50 p-4 rounded-md text-sm border">
                        <div className="mb-3">
                            <span className="font-semibold text-gray-700">📌 予定のタイトル:</span>
                            <p className="ml-4 mt-1 text-gray-900 font-medium">{event?.title || "未取得"}</p>
                        </div>
                        <div className="mb-3">
                            <span className="font-semibold text-gray-700">📅 確定する日程:</span>
                            {selectedDateForMessage ? (
                                <p className="ml-4 mt-1 text-blue-600 font-bold">{selectedDateForMessage}</p>
                            ) : (
                                <p className="ml-4 mt-1 text-red-500">※上部で日程を選択してください</p>
                            )}
                        </div>


                        {/* 👇 ここを「メールアドレス」から「参加者名」の表示に変更！ */}
                        <div>
                            <span className="font-semibold text-gray-700">👤 カレンダーに招待される参加者:</span>
                            {selectedDateForMessage ? (
                                <ul className="ml-4 mt-1 text-gray-900 font-medium list-disc list-inside">
                                    {(selectedSummary?.okUsers || []).length > 0 ? (
                                        selectedSummary?.okUsers.map((name) => {
                                            const guestData = answers.find(
                                                (ans) => normalizeName(ans.user_name) === normalizeName(name)
                                            );

                                            const email = guestData?.email_guest || "";
                                            const hasInput = email.length > 0;
                                            // 簡易的なメアドチェック（@が含まれているか）
                                            const isValidEmail = email.includes('@') && email.length > 3;
                                            const isSuccess = regResults.includes(email);

                                            return (
                                                <li key={name} className={hasInput ? "text-gray-900" : "text-gray-400"}>
                                                    {name}
                                                    {isSuccess ? (
                                                        <span className="ml-2 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                                            ✅ 登録完了
                                                        </span>
                                                    ) : hasInput ? (
                                                        <span className="ml-2 text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                                            招待可能
                                                        </span>
                                                    ) : (
                                                        <span className="ml-2 text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
                                                            未登録
                                                        </span>
                                                    )}
                                                </li>
                                            );
                                        })
                                    ) : (
                                        <li className="text-gray-500 list-none">参加予定のゲストはいません</li>
                                    )}
                                </ul>
                            ) : (
                                <p className="ml-4 mt-1 text-gray-500">※日程を選択すると表示されます</p>
                            )}
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">
                        上記の内容で、自分と参加者のGoogleカレンダーに予定を自動登録し、招待メールを送信します。
                    </p>

                    <div className={!selectedDateForMessage ? "opacity-50 pointer-events-none grayscale" : ""}>
                        <CalendarSetButton
                            eventId={eventId}
                            eventTitle={event?.title || "未取得"}
                            selectedDate={selectedDateForMessage}
                            guestEmails={targetGuestEmails}
                            googleEventId={event?.google_event_id}
                            onSuccess={(emails) => setRegResults(emails)}
                        />
                    </div>

                </div>

            )}

            <section
                style={{
                    border: "1px solid #eee",
                    borderRadius: "14px",
                    padding: "18px",
                    marginBottom: "24px",
                    background: "#fffdf8",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        alignItems: "center",
                        flexWrap: "wrap",
                        marginBottom: "14px",
                    }}
                >
                    <div>
                        <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "4px" }}>
                            📍 場所決めサポート
                        </h2>
                        <p style={{ color: "#666", fontSize: "13px" }}>
                            候補精度を改善中のため、現在は公開前の調整段階です
                        </p>
                    </div>
                    <div style={{ fontSize: "14px", color: "#444" }}>
                        対象日程：{selectedSummary ? selectedSummary.label : "未選択"}
                    </div>
                </div>

                <div
                    style={{
                        marginBottom: "16px",
                        padding: "12px",
                        borderRadius: "10px",
                        background: "#fff7e6",
                        border: "1px solid #f2d49b",
                        fontSize: "13px",
                        lineHeight: 1.8,
                        color: "#6b4f1d",
                    }}
                >
                    <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
                        β調整中 / 有料サービス開発中
                    </div>
                    <div>・現在、この機能はまだご利用いただけません</div>
                    <div>・候補精度や表示内容を改善してから公開予定です</div>
                    <div>・興味がある場合は下のボタンやフィードバックからご意見を残していただけると助かります</div>
                </div>

                <div style={{ display: "grid", gap: "14px", marginBottom: "18px", opacity: 0.72 }}>
                    <div>
                        <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "8px" }}>種類</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {[
                                { value: "meal", label: "ごはん" },
                                { value: "cafe", label: "カフェ" },
                                { value: "drink", label: "飲み会" },
                                { value: "park", label: "公園（屋外）" },
                                { value: "activity", label: "アクティビティ" },
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() =>
                                        setPremiumFilters((prev) => ({
                                            ...prev,
                                            kind: item.value as PremiumFilterState["kind"],
                                        }))
                                    }
                                    style={{
                                        border: "1px solid #ddd",
                                        borderRadius: "999px",
                                        padding: "8px 12px",
                                        background: premiumFilters.kind === item.value ? "#111" : "#fff",
                                        color: premiumFilters.kind === item.value ? "#fff" : "#111",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "8px" }}>屋内 / 屋外</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {[
                                { value: "none", label: "指定なし" },
                                { value: "indoor", label: "屋内寄り" },
                                { value: "outdoor", label: "屋外寄り" },
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() =>
                                        setPremiumFilters((prev) => ({
                                            ...prev,
                                            environment: item.value as PremiumFilterState["environment"],
                                        }))
                                    }
                                    style={{
                                        border: "1px solid #ddd",
                                        borderRadius: "999px",
                                        padding: "8px 12px",
                                        background: premiumFilters.environment === item.value ? "#111" : "#fff",
                                        color: premiumFilters.environment === item.value ? "#fff" : "#111",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "8px" }}>配慮したい条件</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {[
                                { value: "childFriendly", label: "子連れ向き" },
                                { value: "rainFriendly", label: "雨でも動きやすい" },
                                { value: "stayLong", label: "長居しやすい" },
                                { value: "quiet", label: "静かめ" },
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => toggleNeed(item.value)}
                                    style={{
                                        border: "1px solid #ddd",
                                        borderRadius: "999px",
                                        padding: "8px 12px",
                                        background: premiumFilters.needs.includes(item.value) ? "#111" : "#fff",
                                        color: premiumFilters.needs.includes(item.value) ? "#fff" : "#111",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
                    <button
                        type="button"
                        disabled
                        style={{
                            padding: "12px 18px",
                            borderRadius: "10px",
                            border: "none",
                            backgroundColor: "#b8b8b8",
                            color: "#fff",
                            fontWeight: "bold",
                            cursor: "not-allowed",
                        }}
                    >
                        場所候補を提案する（有料サービス開発中）
                    </button>

                    <button
                        type="button"
                        onClick={handleInterestClick}
                        disabled={interestLoading}
                        style={{
                            padding: "12px 18px",
                            borderRadius: "10px",
                            border: "1px solid #ddd",
                            backgroundColor: "#fff",
                            color: "#111",
                            fontWeight: "bold",
                            cursor: interestLoading ? "default" : "pointer",
                        }}
                    >
                        {interestLoading ? "記録中..." : "この機能に興味あり"}
                    </button>
                </div>

                {premiumInfoMessage && (
                    <div
                        style={{
                            marginBottom: "16px",
                            padding: "12px",
                            borderRadius: "10px",
                            backgroundColor: premiumInfoMessage.includes("失敗") ? "#fff5f5" : "#f0fff4",
                            border: premiumInfoMessage.includes("失敗")
                                ? "1px solid #feb2b2"
                                : "1px solid #9ae6b4",
                            color: premiumInfoMessage.includes("失敗") ? "#c53030" : "#276749",
                            fontSize: "14px",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {premiumInfoMessage}
                    </div>
                )}
            </section>

            <section
                style={{
                    border: "1px solid #eee",
                    borderRadius: "14px",
                    padding: "18px",
                    marginBottom: "24px",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        alignItems: "center",
                        flexWrap: "wrap",
                        marginBottom: "12px",
                    }}
                >
                    <div>
                        <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "4px" }}>
                            ✉️ 基本文面生成
                        </h2>
                        <p style={{ color: "#666", fontSize: "13px" }}>
                            日程を選ぶと4種類の文面を作成します
                        </p>
                    </div>
                    <div style={{ fontSize: "14px", color: "#444" }}>
                        対象日程：{selectedSummary ? selectedSummary.label : "未選択"}
                    </div>
                </div>

                {basicMessageSet && selectedSummary && (
                    <div style={{ display: "grid", gap: "14px" }}>
                        {[
                            {
                                title: "① よろしくお願いします の文",
                                text: basicMessageSet.confirmMessage,
                                kind: "confirm" as const,
                                logKind: "basic_confirm_message",
                            },
                            {
                                title: "② 日程が合わず申し訳ない の文",
                                text: basicMessageSet.sorryMessage,
                                kind: "sorry" as const,
                                logKind: "basic_sorry_message",
                                target: `送付対象：${selectedSummary.ngUsers.length ? selectedSummary.ngUsers.join("、") : "該当なし"}`,
                            },
                            {
                                title: "③ 日程調整のお願い の文",
                                text: basicMessageSet.requestMessage,
                                kind: "request" as const,
                                logKind: "basic_request_message",
                            },
                            {
                                title: "④ なくなった旨の文",
                                text: basicMessageSet.cancelMessage,
                                kind: "cancel" as const,
                                logKind: "basic_cancel_message",
                            },
                        ].map((item, idx) => {
                            const style = getMessageCardStyle(item.kind);
                            return (
                                <div
                                    key={idx}
                                    style={{
                                        border: `1px solid ${style.border}`,
                                        borderRadius: "12px",
                                        padding: "14px",
                                        background: style.bg,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: "12px",
                                            marginBottom: "6px",
                                        }}
                                    >
                                        <div style={{ fontWeight: "bold" }}>{item.title}</div>
                                        <button
                                            type="button"
                                            onClick={() => copyText(item.text, item.logKind)}
                                            style={{
                                                border: "none",
                                                background: "#111",
                                                color: "#fff",
                                                borderRadius: "8px",
                                                padding: "8px 12px",
                                                cursor: "pointer",
                                                fontSize: "12px",
                                            }}
                                        >
                                            コピー
                                        </button>
                                    </div>

                                    {item.target && (
                                        <div
                                            style={{
                                                fontSize: "12px",
                                                color: "#666",
                                                marginBottom: "10px",
                                                background: "#f7f7f7",
                                                borderRadius: "8px",
                                                padding: "8px 10px",
                                            }}
                                        >
                                            {item.target}
                                        </div>
                                    )}

                                    <textarea
                                        readOnly
                                        value={item.text}
                                        style={{
                                            width: "100%",
                                            minHeight: "130px",
                                            borderRadius: "10px",
                                            border: "1px solid #ddd",
                                            padding: "12px",
                                            fontFamily: "inherit",
                                            fontSize: "13px",
                                            resize: "vertical",
                                            background: style.textareaBg,
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section
                style={{
                    border: "1px solid #eee",
                    borderRadius: "14px",
                    padding: "18px",
                    marginBottom: "24px",
                    background: "#fafcff",
                }}
            >
                <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "10px" }}>
                    💬 β版フィードバック
                </h2>

                {feedbackError && <div style={{ color: "#c53030", marginBottom: 12 }}>{feedbackError}</div>}
                {feedbackSuccess && <div style={{ color: "#276749", marginBottom: 12 }}>{feedbackSuccess}</div>}

                <div style={{ display: "grid", gap: "12px" }}>
                    <select
                        value={feedbackType}
                        onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
                        style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ccc" }}
                    >
                        <option value="bug">bug</option>
                        <option value="improvement">improvement</option>
                        <option value="impression">impression</option>
                        <option value="other">other</option>
                    </select>

                    <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="改善点・感想など"
                        style={{
                            width: "100%",
                            minHeight: "120px",
                            padding: "12px",
                            borderRadius: "10px",
                            border: "1px solid #ccc",
                            fontFamily: "inherit",
                        }}
                    />

                    <input
                        type="text"
                        value={contactInfo}
                        onChange={(e) => setContactInfo(e.target.value)}
                        placeholder="連絡先（任意）"
                        style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ccc" }}
                    />

                    <button
                        type="button"
                        onClick={handleSubmitFeedback}
                        disabled={feedbackLoading}
                        style={{
                            padding: "12px 18px",
                            borderRadius: "10px",
                            border: "none",
                            background: feedbackLoading ? "#999" : "#111",
                            color: "#fff",
                            fontWeight: "bold",
                            cursor: "pointer",
                        }}
                    >
                        {feedbackLoading ? "送信中..." : "フィードバックを送信"}
                    </button>
                </div>
            </section>

            <section
                style={{
                    border: "1px solid #eee",
                    borderRadius: "14px",
                    padding: "18px",
                }}
            >
                <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "14px" }}>
                    👥 参加者一覧
                </h2>

                <div style={{ display: "grid", gap: "12px" }}>
                    {answers.map((a, idx) => (
                        <div
                            key={idx}
                            style={{
                                border: "1px solid #eee",
                                borderRadius: "10px",
                                padding: "12px",
                                background: "#fff",
                            }}
                        >
                            <div style={{ fontWeight: "bold", marginBottom: "8px" }}>{a.user_name}</div>
                            <div style={{ fontSize: "13px", color: "#444", marginBottom: "4px" }}>
                                メモ：{a.guest_suggestion || "なし"}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}