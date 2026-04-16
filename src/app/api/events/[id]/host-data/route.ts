import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "../../../../lib/supabase/server";
import { getHostCookieName, safeEquals, signHostSession } from "../../../../lib/host-session";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const cookieValue = req.cookies.get(getHostCookieName(id))?.value;

        if (!cookieValue) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const supabase = createServerSupabase();

        const { data: eventData, error: eventError } = await supabase
            .from("events")
            .select("id,title,candidate_dates,password,confirmed_date,google_event_id")
            .eq("id", id)
            .single();

        if (eventError || !eventData) {
            return NextResponse.json({ error: "not found" }, { status: 404 });
        }

        const expected = signHostSession(id, eventData.password);
        if (!safeEquals(cookieValue, expected)) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const { data: answers, error: answersError } = await supabase
            .from("answers")
            .select("user_name,selections,target_user_name,guest_suggestion,email_guest")
            .eq("event_id", id)
            .order("user_name", { ascending: true });

        if (answersError) {
            console.error(answersError);
            return NextResponse.json({ error: "failed" }, { status: 500 });
        }

        return NextResponse.json({
            event: {
                id: eventData.id,
                title: eventData.title,
                candidate_dates: eventData.candidate_dates,
                confirmed_date: eventData.confirmed_date,
                google_event_id: eventData.google_event_id,
            },
            answers: answers || [],
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "failed" }, { status: 500 });
    }
}