import { NextRequest, NextResponse } from "next/server";

type Participant = {
    name: string;
    station?: string;
    pass_route?: string;
};

type Filters = {
    budget?: "none" | "low" | "mid" | "high";
    environment?: "none" | "indoor" | "outdoor";
    kind?: "none" | "meal" | "cafe" | "drink" | "park" | "activity";
    needs?: string[];
};

function normalizeText(value?: string) {
    return (value || "").trim().replace(/\s+/g, " ");
}

function parsePassRoute(route?: string) {
    const raw = normalizeText(route);
    if (!raw) {
        return { from: "", to: "" };
    }

    const parts = raw.split(/[〜~\-－→]/).map((s) => s.trim()).filter(Boolean);

    return {
        from: parts[0] || "",
        to: parts[1] || "",
    };
}

function kindLabel(kind?: Filters["kind"]) {
    switch (kind) {
        case "meal":
            return "ごはん向き";
        case "cafe":
            return "カフェ向き";
        case "drink":
            return "飲み向き";
        case "park":
            return "公園 / 散歩向き";
        case "activity":
            return "遊び / 体験向き";
        default:
            return "バランス型";
    }
}

function environmentLabel(environment?: Filters["environment"]) {
    switch (environment) {
        case "indoor":
            return "屋内寄り";
        case "outdoor":
            return "屋外寄り";
        default:
            return "環境指定なし";
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const participants = (body?.participants || []) as Participant[];
        const filters = (body?.filters || {}) as Filters;

        if (!Array.isArray(participants) || participants.length === 0) {
            return NextResponse.json(
                { error: "参加者情報がありません。" },
                { status: 400 }
            );
        }

        const candidateMap = new Map<
            string,
            {
                timeScore: number;
                costScore: number;
                supportCount: number;
                routeMatchCount: number;
            }
        >();

        const participantCount = participants.length;

        for (const p of participants) {
            const station = normalizeText(p.station);
            const route = parsePassRoute(p.pass_route);
            const seenForSupport = new Set<string>();

            const addScore = (
                candidate: string,
                timeScoreDelta: number,
                costScoreDelta: number,
                isRouteMatch: boolean
            ) => {
                const key = normalizeText(candidate);
                if (!key) return;

                const current = candidateMap.get(key) || {
                    timeScore: 0,
                    costScore: 0,
                    supportCount: 0,
                    routeMatchCount: 0,
                };

                current.timeScore += timeScoreDelta;
                current.costScore += costScoreDelta;

                if (!seenForSupport.has(key)) {
                    current.supportCount += 1;
                    seenForSupport.add(key);
                }

                if (isRouteMatch) {
                    current.routeMatchCount += 1;
                }

                candidateMap.set(key, current);
            };

            if (station) {
                addScore(station, 5, 2, false);
            }

            if (route.from) {
                addScore(route.from, 3, 5, true);
            }

            if (route.to) {
                addScore(route.to, 3, 5, true);
            }
        }

        const candidates = Array.from(candidateMap.entries())
            .map(([areaName, score]) => {
                const overallScore = score.timeScore + score.costScore + score.supportCount * 2;

                const badges = [
                    score.routeMatchCount >= Math.max(1, Math.floor(participantCount / 2))
                        ? "定期区間を活かしやすい"
                        : "全体バランス重視",
                    score.timeScore >= score.costScore ? "時間重視寄り" : "料金重視寄り",
                    kindLabel(filters.kind),
                    environmentLabel(filters.environment),
                ];

                const reasonParts: string[] = [];

                if (score.supportCount >= 2) {
                    reasonParts.push("複数人の入力に共通して出てきた候補です");
                } else {
                    reasonParts.push("参加予定者の入力情報から候補に上がったエリアです");
                }

                if (score.routeMatchCount > 0) {
                    reasonParts.push("定期区間の端点としても一致しやすいです");
                }

                if (filters.needs?.includes("childFriendly")) {
                    reasonParts.push("子連れ向きの場所探しにも広げやすい想定です");
                }

                if (filters.needs?.includes("rainFriendly") && filters.environment !== "outdoor") {
                    reasonParts.push("雨の日でも選択肢を持ちやすい前提で使えます");
                }

                return {
                    areaKey: areaName,
                    areaName: `${areaName}周辺`,
                    badges: Array.from(new Set(badges)),
                    reason: reasonParts.join("。"),
                    scoreLabel: `参加者の交通情報をもとに、時間・料金・共通度を合わせて候補化しています`,
                    overallScore,
                };
            })
            .sort((a, b) => b.overallScore - a.overallScore)
            .slice(0, 3)
            .map(({ overallScore, ...rest }) => rest);

        return NextResponse.json({
            areas: candidates,
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: "エリア候補の提案に失敗しました。" },
            { status: 500 }
        );
    }
}