import { NextResponse } from "next/server";

export async function POST(request: Request) {
    // 1. フロント（ボタン）から送られてきたデータを受け取る
    // ★ ここに googleToken を追加したで！
    const { eventTitle, selectedDate, guestEmails, googleToken } = await request.json();

    // 2. 鍵（トークン）が届いているかチェック
    if (!googleToken) {
        return NextResponse.json({ error: "Google連携が必要です。もう一度ボタンを押してください。" }, { status: 401 });
    }

    // 3. Google Calendar API を叩く
    const googleRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${googleToken}`, // ★ ここで受け取った鍵を使う！
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            summary: eventTitle,
            description: "スマート調整より自動登録されました。",
            start: { date: selectedDate },
            end: { date: selectedDate },
            // ゲストのメアド配列をGoogleの指定フォーマットに変換
            attendees: guestEmails.map((email: string) => ({ email })),
        }),
    });

    const data = await googleRes.json();

    // Google側でエラーが起きたらそれを返す
    if (!googleRes.ok) return NextResponse.json({ error: data.error.message }, { status: 500 });

    // 成功したらOKを返す
    return NextResponse.json({ success: true, eventUrl: data.htmlLink });
}