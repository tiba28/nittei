import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "../../../../lib/supabase/server";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();

        const actionType = String(body?.action_type || "").trim();
        const actionDetail = String(body?.action_detail || "").trim();

        if (!actionType) {
            return NextResponse.json({ error: "action_type is required" }, { status: 400 });
        }

        const supabase = createServerSupabase();

        const { error } = await supabase.from("beta_usage_logs").insert([
            {
                event_id: id,
                action_type: actionType,
                action_detail: actionDetail || null,
            },
        ]);

        if (error) {
            console.error(error);
            return NextResponse.json({ error: "failed" }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "failed" }, { status: 500 });
    }
}