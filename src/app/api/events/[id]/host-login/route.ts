import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "../../../../lib/supabase/server";
import { getHostCookieName, signHostSession } from "../../../../lib/host-session";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const password = String(body?.password || "").trim();

        if (!password) {
            return NextResponse.json({ error: "パスワードを入力してください。" }, { status: 400 });
        }

        const supabase = createServerSupabase();

        const { data, error } = await supabase
            .from("events")
            .select("password")
            .eq("id", id)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: "イベントが見つかりません。" }, { status: 404 });
        }

        if (data.password !== password) {
            return NextResponse.json({ error: "パスワードが違います。" }, { status: 401 });
        }

        const token = signHostSession(id, password);
        const res = NextResponse.json({ ok: true });

        res.cookies.set({
            name: getHostCookieName(id),
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });

        return res;
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "ログインに失敗しました。" }, { status: 500 });
    }
}