import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const { eventTitle, selectedDate, guestEmails, googleToken, eventId } = await request.json(); // ★eventIdを追加

    if (!googleToken) {
        return NextResponse.json({ error: "Google連携が必要です" }, { status: 401 });
    }

    // 1. Google Calendar API を叩く
    const googleRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            summary: `${eventTitle}`,
            description: `「にってい（nittei）」で調整した以下の日程で確定しました。\n日程: ${selectedDate}\n\n※このメールは日程確定の自動通知です。`,
            start: { date: selectedDate },
            end: { date: selectedDate },
            attendees: guestEmails.map((email: string) => ({ email })),
        }),
    });

    const data = await googleRes.json();
    if (!googleRes.ok) return NextResponse.json({ error: data.error.message }, { status: 500 });

    // 2. ★成功したら、Supabaseに「確定日」と「Google予定ID」を書き込む
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value },
            },
        }
    );

    const { error: updateError } = await supabase
        .from('events')
        .update({
            confirmed_date: selectedDate,
            google_event_id: data.id
        })
        .eq('id', eventId);

    if (updateError) {
        return NextResponse.json({ error: "DBの更新に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}