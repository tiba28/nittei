import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "../../../lib/supabase/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const title = String(body?.title || "").trim();
        const description = String(body?.description || "").trim();
        const password = String(body?.password || "").trim();
        const deadline = String(body?.deadline || "").trim();
        const candidateDates = Array.isArray(body?.candidate_dates)
            ? body.candidate_dates.map((v: unknown) => String(v))
            : [];
        const guestNames = Array.isArray(body?.guest_names)
            ? body.guest_names.map((v: unknown) => String(v)).filter(Boolean)
            : [];
        const allowCustomName = body?.allow_custom_name !== false;

        if (!title || !password || !deadline || candidateDates.length === 0) {
            return NextResponse.json(
                { error: "入力が不足しています。" },
                { status: 400 }
            );
        }

        const supabase = createServerSupabase();

        const { data, error } = await supabase
            .from("events")
            .insert([
                {
                    title,
                    description: description || title,
                    plan_description: description || "",
                    password,
                    deadline,
                    candidate_dates: candidateDates,
                    guest_names: guestNames,
                    allow_custom_name: allowCustomName,
                },
            ])
            .select("id")
            .single();

        if (error || !data) {
            console.error(error);
            return NextResponse.json(
                { error: "イベント作成に失敗しました。" },
                { status: 500 }
            );
        }

        return NextResponse.json({ id: data.id });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: "イベント作成に失敗しました。" },
            { status: 500 }
        );
    }
}