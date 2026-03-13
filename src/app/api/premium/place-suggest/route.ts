import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
    return NextResponse.json(
        {
            error: "場所決めサポートは現在開発中です。公開までしばらくお待ちください。",
            code: "PREMIUM_PLACE_SUGGEST_DISABLED",
        },
        { status: 503 }
    );
}