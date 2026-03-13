import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Participant = {
    name?: string;
    station?: string;
    pass_route?: string;
};

type TimeSuggestItem = {
    station: string;
    avg_minutes: number;
};

type CostSuggestItem = {
    station: string;
    avg_cost_yen: number;
};

type SuggestResponse = {
    time_based: TimeSuggestItem[];
    cost_based: CostSuggestItem[];
};

function extractTextFromCandidate(candidate: any): string {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) return "";

    return parts
        .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim();
}

function parseRetrySeconds(message: string): number | null {
    const match = message.match(/Please retry in ([0-9.]+)s/i);
    if (!match) return null;
    const sec = Math.ceil(Number(match[1]));
    return Number.isFinite(sec) ? sec : null;
}

function parseLineResult(text: string) {
    const cleaned = text
        .replace(/```[\s\S]*?```/g, "")
        .replace(/^Here is.*$/gim, "")
        .replace(/^Result:.*$/gim, "")
        .trim();

    const line = cleaned.split("\n").find((l) => l.includes("|"))?.trim() || "";
    const [stationRaw, valueRaw] = line.split("|").map((s) => s.trim());

    if (!stationRaw || !valueRaw) {
        throw new Error("AIの返答を解析できませんでした");
    }

    const value = Number(valueRaw.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(value)) {
        throw new Error("AIの数値を解析できませんでした");
    }

    return {
        station: stationRaw,
        value: Math.round(value),
    };
}

async function runGemini({
    apiKey,
    prompt,
}: {
    apiKey: string;
    prompt: string;
}) {
    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    candidateCount: 1,
                    maxOutputTokens: 128,
                },
            }),
            cache: "no-store",
        }
    );

    const result = await response.json();

    if (!response.ok) {
        const detail = result?.error?.message || result?.message || "unknown error";
        const retryAfterSec = parseRetrySeconds(detail);
        const isQuotaError =
            response.status === 429 ||
            /quota/i.test(detail) ||
            /rate limit/i.test(detail) ||
            /exceeded your current quota/i.test(detail);

        if (isQuotaError) {
            const err: any = new Error(
                retryAfterSec
                    ? `しばらく待ってから再試行してください（約${retryAfterSec}秒後）`
                    : "しばらく待ってから再試行してください"
            );
            err.code = "quota_exceeded";
            err.retryAfterSec = retryAfterSec;
            throw err;
        }

        const err: any = new Error(detail);
        err.code = "api_error";
        throw err;
    }

    const candidate = result?.candidates?.[0];
    if (!candidate) {
        const err: any = new Error("candidates が空でした");
        err.code = "empty_candidates";
        throw err;
    }

    const text = extractTextFromCandidate(candidate);
    const finishReason = candidate?.finishReason;

    if (!text) {
        const err: any = new Error(
            finishReason ? `finishReason: ${finishReason}` : "parts.text が空でした"
        );
        err.code = "empty_text";
        throw err;
    }

    return text;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const participants = (body?.participants || []) as Participant[];

        if (!Array.isArray(participants) || participants.length === 0) {
            return NextResponse.json({ error: "参加者情報がありません" }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "APIキーが設定されていません" }, { status: 500 });
        }

        const cleanedParticipants = participants
            .map((p) => ({
                name: (p.name || "").trim(),
                station: (p.station || "").trim(),
                pass_route: (p.pass_route || "").trim(),
            }))
            .filter((p) => p.name || p.station || p.pass_route);

        if (cleanedParticipants.length === 0) {
            return NextResponse.json({ error: "有効な参加者情報がありません" }, { status: 400 });
        }

        const participantsInfo = cleanedParticipants
            .map(
                (p) =>
                    `- 名前: ${p.name || "参加者"}, 最寄り駅: ${p.station || "不明"}, 定期区間: ${p.pass_route || "なし"}`
            )
            .join("\n");

        const participantsInfoForTime = cleanedParticipants
            .map(
                (p) =>
                    `- 名前: ${p.name || "参加者"}, 最寄り駅: ${p.station || "不明"}`
            )
            .join("\n");

        const timePrompt = `
以下の参加者情報から、移動時間のバランスがよい集合駅を1つだけ選んでください。
時間の計算は必ず「最寄り駅」から考えてください。
定期区間は時間計算に使わないでください。

出力は必ず1行だけ、次の形式にしてください。

駅名|平均分数

説明文は禁止
前置き禁止
Markdown禁止
JSON禁止

参加者情報:
${participantsInfoForTime}
`.trim();

        const costPrompt = `
以下の参加者情報から、交通費のバランスがよい集合駅を1つだけ選んでください。
出力は必ず1行だけ、次の形式にしてください。

駅名|平均円数

説明文は禁止
前置き禁止
Markdown禁止
JSON禁止

参加者情報:
${participantsInfo}
    `.trim();

        const timeText = await runGemini({ apiKey, prompt: timePrompt });
        const costText = await runGemini({ apiKey, prompt: costPrompt });

        const timeParsed = parseLineResult(timeText);
        const costParsed = parseLineResult(costText);

        const responseJson: SuggestResponse = {
            time_based: [
                {
                    station: timeParsed.station,
                    avg_minutes: timeParsed.value,
                },
            ],
            cost_based: [
                {
                    station: costParsed.station,
                    avg_cost_yen: costParsed.value,
                },
            ],
        };

        return NextResponse.json(responseJson);
    } catch (error: any) {
        if (error?.code === "quota_exceeded") {
            return NextResponse.json(
                {
                    error: "AIの無料枠上限に達しています",
                    detail: error.message,
                    retryAfterSec: error.retryAfterSec ?? null,
                    errorType: "quota_exceeded",
                },
                { status: 429 }
            );
        }

        if (
            error?.code === "api_error" ||
            error?.code === "empty_candidates" ||
            error?.code === "empty_text"
        ) {
            return NextResponse.json(
                {
                    error: "AI APIの呼び出しに失敗しました",
                    detail: error.message,
                    errorType: error.code,
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                error: "AIの解析に失敗しました",
                detail: error?.message || "unknown error",
                errorType: "parse_error",
            },
            { status: 500 }
        );
    }
}