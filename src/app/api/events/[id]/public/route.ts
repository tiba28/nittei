import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "../../../../lib/supabase/server";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = createServerSupabase();

        const { data, error } = await supabase
            .from("events")
            .select("id,title,deadline,candidate_dates,plan_description")
            .eq("id", id)
            .single();

        if (error || !data) {
            return NextResponse.json(
                { error: "イベントが見つかりません。" },
                { status: 404 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: "イベント情報の取得に失敗しました。" },
            { status: 500 }
        );
    }
}