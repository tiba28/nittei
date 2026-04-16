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

    const { error: dbError } = await supabase
        .from('events')
        .update({
            confirmed_date: selectedDate, // リクエストで受け取っている確定日程
            google_event_id: data.id      // GoogleAPIから返ってきたID
        })
        .eq('id', eventId);               // 対象のイベントID

    if (dbError) {
        console.error("Supabaseの更新に失敗しました:", dbError);
        // 致命的なエラーではないので、カレンダー登録自体は成功として返すか、エラーを返すかは任意です
    }

    // 最後に成功レスポンスを返す（既存の return NextResponse.json({...}) などに繋げる ）
    return NextResponse.json({ success: true, event: data });


    return NextResponse.json({ success: true });
}