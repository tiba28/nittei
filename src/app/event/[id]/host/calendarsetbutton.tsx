'use client'

import { createClient } from '@supabase/supabase-js'
import { useState } from 'react'

interface Props {
    eventId: string;
    eventTitle: string;
    selectedDate: string;
    guestEmails: string[]; // APIから取得したメールアドレスの配列を渡す
    onSuccess?: (emails: string[]) => void;
}

export default function CalendarSetButton({ eventTitle, selectedDate, guestEmails, eventId, onSuccess }: Props) {
    const [loading, setLoading] = useState(false)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const handleAction = async () => {
        setLoading(true)

        // 1. セッションチェック
        const { data: { session } } = await supabase.auth.getSession()

        const token = session?.provider_token;

        // ログインしていない、またはGoogleの鍵がない場合はログイン画面へ
        if (!session || !session.provider_token) {
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    scopes: 'https://www.googleapis.com/auth/calendar.events',
                    queryParams: { access_type: 'offline', prompt: 'consent' },
                    redirectTo: window.location.href, // ログイン後、今のページに戻る
                },
            })
            return
        }

        // 2. 登録APIの呼び出し
        try {
            const res = await fetch('/api/calendar/create-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventTitle, selectedDate, guestEmails, googleToken: token, eventId }),
            })

            if (res.ok) {
                const data = await res.json();
                alert('Googleカレンダーへの登録が完了しました！');
                if (onSuccess) onSuccess(guestEmails); // 成功したリストを親に渡す
            } else {
                const err = await res.json()
                alert('エラーが発生しました: ' + err.error)
            }
        } catch (e) {
            alert('通信エラーが発生しました')
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            onClick={handleAction}
            disabled={loading || !selectedDate}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all ${loading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
                }`}
        >
            {loading ? '処理中...' : 'Googleカレンダーに登録して確定する'}
        </button>
    )
}