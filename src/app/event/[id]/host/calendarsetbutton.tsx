'use client'

// auth-helpersの代わりに、基本のsupabase-jsを使う
import { createClient } from '@supabase/supabase-js'

export default function CalendarSetButton() {

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const handleConnect = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                scopes: 'https://www.googleapis.com/auth/calendar.events',
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
                // ログイン後の戻り先                redirectTo: `${window.location.origin}/auth/callback`,
            },
        })
    }

    return (
        <button
            onClick={handleConnect}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
            Googleカレンダーと連携して日程を確定する
        </button>
    )
}