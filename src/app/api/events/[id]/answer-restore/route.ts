import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "../../../../lib/supabase/server";

function normalizeName(name?: string) {
    return (name || "").trim().replace(/[ 　]/g, "").toLowerCase();
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();

        const userName = normalizeName(String(body?.user_name || ""));
        const passCode = String(body?.pass_code || "").trim();

        if (!userName || !passCode) {
            return NextResponse.json({ restored: false });
        }

        const supabase = createServerSupabase();

        const { data, error } = await supabase
            .from("answers")
            .select("pass_code,guest_suggestion,home_station,pass_route")
            .eq("event_id", id)
            .eq("user_name", userName)
            .maybeSingle();

        if (error || !data || data.pass_code !== passCode) {
            return NextResponse.json({ restored: false });
        }

        return NextResponse.json({
            restored: true,
            guest_suggestion: data.guest_suggestion || "",
            home_station: data.home_station || "",
            pass_route: data.pass_route || "",
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ restored: false });
    }
}