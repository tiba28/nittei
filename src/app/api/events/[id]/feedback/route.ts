import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "../../../../lib/supabase/server";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();

        const feedbackType = String(body?.feedback_type || "").trim();
        const feedbackText = String(body?.feedback_text || "").trim();
        const contactInfo = String(body?.contact_info || "").trim();

        if (!feedbackType || !feedbackText) {
            return NextResponse.json({ error: "入力が不足しています。" }, { status: 400 });
        }

        const supabase = createServerSupabase();

        const { error } = await supabase.from("beta_feedbacks").insert([
            {
                event_id: id,
                feedback_type: feedbackType,
                feedback_text: feedbackText,
                contact_info: contactInfo || null,
            },
        ]);

        if (error) {
            console.error(error);
            return NextResponse.json({ error: "送信に失敗しました。" }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "送信に失敗しました。" }, { status: 500 });
    }
}