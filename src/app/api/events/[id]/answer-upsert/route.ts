import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "../../../../lib/supabase/server";

function normalizeName(name?: string) {
    return (name || "").trim().replace(/[ 　]/g, "").toLowerCase();
}

function validateUserName(name: string) {
    const trimmed = name.trim();

    if (!trimmed) return "名前を入力してください。";
    if (/[ 　]/.test(trimmed)) return "名前にはスペースを入れずに入力してください。";
    if (!/^[ぁ-んァ-ヶー一-龠々a-zA-Z]+$/.test(trimmed)) {
        return "名前は、ひらがな・カタカナ・漢字・英字のみで入力してください。記号は使用できません。";
    }
    if (trimmed.length < 2) return "名前は2文字以上で入力してください。";

    return "";
}

function splitConditionNames(text: string): string[] {
    return text
        .split(",")
        .map((s) => normalizeName(s))
        .filter(Boolean);
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();

        const rawUserName = String(body?.user_name || "");
        const passCode = String(body?.pass_code || "").trim();
        const selections = body?.selections || {};
        const withUsers = Array.isArray(body?.withUsers) ? body.withUsers : [];
        const withoutUsers = Array.isArray(body?.withoutUsers) ? body.withoutUsers : [];
        const withUsersText = String(body?.withUsersText || "");
        const withoutUsersText = String(body?.withoutUsersText || "");
        const suggestion = String(body?.suggestion || "").trim();
        const homeStation = normalizeName(String(body?.homeStation || ""));
        const passFrom = normalizeName(String(body?.passFrom || ""));
        const passTo = normalizeName(String(body?.passTo || ""));
        const emailGuest = String(body?.email_guest || "").trim();

        const nameValidationError = validateUserName(rawUserName);
        if (nameValidationError) {
            return NextResponse.json({ error: nameValidationError }, { status: 400 });
        }

        if (!passCode) {
            return NextResponse.json({ error: "修正用のパスコードを入力してください。" }, { status: 400 });
        }

        if (passCode.length < 4) {
            return NextResponse.json({ error: "修正用のパスコードは4文字以上で入力してください。" }, { status: 400 });
        }

        const normalizedUserName = normalizeName(rawUserName);

        const manualWith = splitConditionNames(withUsersText);
        const manualWithout = splitConditionNames(withoutUsersText);
        const selectedWith = withUsers.map((name: string) => normalizeName(name));
        const selectedWithout = withoutUsers.map((name: string) => normalizeName(name));

        const mergedWith = Array.from(new Set([...selectedWith, ...manualWith]));
        const mergedWithout = Array.from(new Set([...selectedWithout, ...manualWithout])).filter(
            (name) => !mergedWith.includes(name)
        );

        const combinedConditions = `with:${mergedWith.join(",")}|without:${mergedWithout.join(",")}`;
        const passRoute = passFrom || passTo ? `${passFrom || ""}〜${passTo || ""}` : "";

        const supabase = createServerSupabase();

        const { data: eventData, error: eventError } = await supabase
            .from("events")
            .select("deadline")
            .eq("id", id)
            .single();

        if (eventError || !eventData) {
            return NextResponse.json({ error: "イベント情報の確認に失敗しました。" }, { status: 400 });
        }

        const isExpired = eventData.deadline
            ? new Date().getTime() > new Date(eventData.deadline).setHours(23, 59, 50, 0)
            : false;

        if (isExpired) {
            return NextResponse.json(
                { error: "申し訳ありません。回答期限が過ぎているため送信できません。" },
                { status: 400 }
            );
        }

        const { data: existing, error: existingError } = await supabase
            .from("answers")
            .select("pass_code")
            .eq("event_id", id)
            .eq("user_name", normalizedUserName)
            .maybeSingle();

        if (existingError) {
            console.error(existingError);
            return NextResponse.json({ error: "既存回答の確認に失敗しました。" }, { status: 500 });
        }

        if (existing && existing.pass_code !== passCode) {
            return NextResponse.json(
                {
                    error: "その名前は既に使用されています。修正する場合は、前回と同じパスコードを入力してください。",
                },
                { status: 400 }
            );
        }

        const { error } = await supabase.from("answers").upsert(
            [
                {
                    event_id: id,
                    user_name: normalizedUserName,
                    pass_code: passCode,
                    selections,
                    target_user_name: combinedConditions,
                    guest_suggestion: suggestion,
                    home_station: homeStation,
                    pass_route: passRoute,
                    email_guest: emailGuest,
                },
            ],
            { onConflict: "event_id,user_name" }
        );

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