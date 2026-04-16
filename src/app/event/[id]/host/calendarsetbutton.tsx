'use client'

import { createClient } from '@supabase/supabase-js'
import { useState } from 'react'

interface Props {
    eventId: string;
    eventTitle: string;
    selectedDate: string;
    guestEmails: string[];
    googleEventId?: string | null;
    onSuccess?: (emails: string[]) => void;
}

export default function CalendarSetButton({ eventTitle, selectedDate, guestEmails, eventId, googleEventId, onSuccess }: Props) {
    const [loading, setLoading] = useState(false)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const checkSessionAndToken = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || !session.provider_token) {
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    scopes: 'https://www.googleapis.com/auth/calendar.events',
                    queryParams: { access_type: 'offline', prompt: 'consent' },
                    redirectTo: window.location.href,
                },
            })
            return null;
        }
        return session.provider_token;
    }

    const handleCreate = async (e: React.MouseEvent) => {
        e.preventDefault();
        setLoading(true)
        try {
            const token = await checkSessionAndToken();
            if (!token) return;

            const res = await fetch('/api/calendar/create-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventTitle, selectedDate, guestEmails, googleToken: token, eventId }),
            })

            if (res.ok) {
                alert('Googleカレンダーへの登録が完了しました！');
                if (onSuccess) onSuccess(guestEmails);
                window.location.reload();
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

    const handleUpdate = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!googleEventId) return;
        if (!selectedDate) {
            alert("先に、変更したい新しい日程を画面から選択してください！");
            return;
        }

        setLoading(true);
        try {
            const token = await checkSessionAndToken();
            if (!token) return;

            const res = await fetch('/api/calendar/update-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, selectedDate, googleEventId, guestEmails, eventTitle, googleToken: token })
            });

            if (res.ok) {
                alert('カレンダーの日程を変更しました！');
                if (onSuccess) onSuccess(guestEmails);
                window.location.reload();
            } else {
                const err = await res.json();
                alert('変更に失敗しました: ' + (err.error || '不明なエラー'));
            }
        } catch (e) {
            alert('通信エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!googleEventId) return;
        if (!confirm('本当にカレンダーから予定を削除して未確定に戻しますか？')) return;

        setLoading(true);
        try {
            const token = await checkSessionAndToken();
            if (!token) return;

            const res = await fetch('/api/calendar/delete-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, googleEventId, googleToken: token })
            });

            if (res.ok) {
                alert('カレンダーから予定を削除しました');
                window.location.reload();
            } else {
                const err = await res.json();
                alert('削除に失敗しました: ' + (err.error || '不明なエラー'));
            }
        } catch (e) {
            alert('通信エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    if (googleEventId) {
        const isUpdateDisabled = loading || !selectedDate;
        return (
            <div className="flex gap-4">
                <button
                    type="button"
                    onClick={handleUpdate}
                    disabled={isUpdateDisabled}
                    className={`w-full py-3 rounded-xl font-bold text-white transition-all ${isUpdateDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-400 hover:bg-blue-500'
                        }`}
                >
                    {loading ? '処理中...' : '日程を変更する'}
                </button>
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className={`w-full py-3 rounded-xl font-bold text-white transition-all ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-400 hover:bg-red-500'
                        }`}
                >
                    {loading ? '処理中...' : 'カレンダーから削除する'}
                </button>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={handleCreate}
            disabled={loading || !selectedDate}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all ${loading || !selectedDate ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                }`}
        >
            {loading ? '処理中...' : 'Googleカレンダーに登録して確定する'}
        </button>
    )
}