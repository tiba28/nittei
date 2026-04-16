import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { eventId, googleEventId, googleToken } = body;

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
        const token = googleToken || session?.provider_token;

        if (!token) {
            return NextResponse.json({ error: 'Googleの認証トークンがありません' }, { status: 401 });
        }

        // 1. Googleカレンダーの予定を削除 (DELETE)
        const googleRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}?sendUpdates=all`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });

        // DELETEリクエストは成功時に本文がない(204 No Content)ことが多いのでハンドリングを変えます
        if (!googleRes.ok) {
            const data = await googleRes.json();
            return NextResponse.json({ error: data.error.message }, { status: 500 });
        }

        // 2. Supabaseの「確定日」と「Google予定ID」をリセットする
        const { error: dbError } = await supabase
            .from('events')
            .update({
                confirmed_date: null,
                google_event_id: null
            })
            .eq('id', eventId);

        if (dbError) {
            console.error("Supabaseの更新に失敗しました:", dbError);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
}