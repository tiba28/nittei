import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "../../../lib/supabase/server";

function formatDateKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const adminKey = String(body?.admin_key || "");

        if (!process.env.ADMIN_STATS_KEY || adminKey !== process.env.ADMIN_STATS_KEY) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const supabase = createServerSupabase();

        const { data: events, error: eventsError } = await supabase
            .from("events")
            .select("id,created_at,candidate_dates");

        if (eventsError) {
            console.error(eventsError);
            return NextResponse.json({ error: "failed" }, { status: 500 });
        }

        const { data: answers, error: answersError } = await supabase
            .from("answers")
            .select("event_id");

        if (answersError) {
            console.error(answersError);
            return NextResponse.json({ error: "failed" }, { status: 500 });
        }

        const totalEvents = events?.length || 0;

        const dailyCounts: Record<string, number> = {};
        const weeklyCounts: Record<string, number> = {};
        const answerCountMap = new Map<string, number>();

        for (const ans of answers || []) {
            const eventId = String(ans.event_id || "");
            if (!eventId) continue;
            answerCountMap.set(eventId, (answerCountMap.get(eventId) || 0) + 1);
        }

        let totalCandidateDates = 0;
        let totalAnswerCount = 0;

        for (const event of events || []) {
            const createdAt = new Date(event.created_at);
            const dayKey = formatDateKey(createdAt);
            const weekKey = formatDateKey(startOfWeek(createdAt));

            dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
            weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;

            const candidateDates = Array.isArray(event.candidate_dates) ? event.candidate_dates.length : 0;
            totalCandidateDates += candidateDates;
            totalAnswerCount += answerCountMap.get(event.id) || 0;
        }

        const averageAnswerCount = totalEvents > 0 ? totalAnswerCount / totalEvents : 0;
        const averageCandidateDateCount = totalEvents > 0 ? totalCandidateDates / totalEvents : 0;

        return NextResponse.json({
            totalEvents,
            dailyCounts,
            weeklyCounts,
            averageAnswerCount: Number(averageAnswerCount.toFixed(2)),
            averageCandidateDateCount: Number(averageCandidateDateCount.toFixed(2)),
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "failed" }, { status: 500 });
    }
}