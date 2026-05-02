import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

function storeCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.STORE_URL || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: storeCorsHeaders() });
}

/**
 * Public endpoint for the SplitPay Store to verify a 4-digit SplitPay code.
 * Does not return email, password hash, or other sensitive fields.
 */
export async function GET(request: Request) {
  const headers = storeCorsHeaders();
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code")?.trim();
    if (!code || !/^\d{4}$/.test(code)) {
      return NextResponse.json({ valid: false }, { status: 200, headers });
    }

    await connectDB();
    const user = await User.findOne({ splitCode: code }).select("name").lean();
    if (!user) {
      return NextResponse.json({ valid: false }, { status: 200, headers });
    }

    return NextResponse.json(
      { valid: true, name: user.name, userId: user._id.toString() },
      { status: 200, headers },
    );
  } catch (e) {
    console.error("[verify-code]", e);
    return NextResponse.json({ valid: false }, { status: 500, headers });
  }
}
