import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr'; // ※環境に合わせて @supabase/auth-helpers-nextjs 等に変えてください

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { eventId, selectedDate, googleEventId, guestEmails, eventTitle } = body;

        // Supabaseクライアントの初期化とセッション取得
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

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.provider_token;

        if (!token) {
            return NextResponse.json({ error: 'Googleの認証トークンがありません' }, { status: 401 });
        }

        // 1. Googleカレンダーの予定を更新 (PATCH)
        const googleRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}?sendUpdates=all`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                summary: `【確定】${eventTitle}`,
                description: `「にってい（nittei）」で調整した以下の日程に変更されました。\n新しい日程: ${selectedDate}`,
                start: { date: selectedDate },
                end: { date: selectedDate },
                attendees: guestEmails.map((email: string) => ({ email })),
            }),
        });

        const data = await googleRes.json();
        if (!googleRes.ok) return NextResponse.json({ error: data.error.message }, { status: 500 });

        // 2. Supabaseの「確定日」を新しい日付で上書きする
        const { error: dbError } = await supabase
            .from('events')
            .update({
                confirmed_date: selectedDate
            })
            .eq('id', eventId);

        if (dbError) {
            console.error("Supabaseの更新に失敗しました:", dbError);
        }

        return NextResponse.json({ success: true, event: data });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
}