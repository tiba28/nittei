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
            .from("answers")
            .select("user_name")
            .eq("event_id", id)
            .order("user_name", { ascending: true });

        if (error) {
            console.error(error);
            return NextResponse.json([], { status: 200 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error(error);
        return NextResponse.json([], { status: 200 });
    }
}