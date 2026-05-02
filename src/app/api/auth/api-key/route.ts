import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateApiKey, maskApiKey, monthKey } from "@/lib/api-key";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;
    const month = monthKey();

    let user = await User.findById(userId).select(
      "apiKey apiUsageBillingMonth apiCallsThisMonth apiUsageLimit",
    );
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (user.apiUsageBillingMonth !== month) {
      user.apiUsageBillingMonth = month;
      user.apiCallsThisMonth = 0;
      await user.save();
    }

    if (!user.apiKey) {
      user.apiKey = generateApiKey();
      user.apiUsageBillingMonth = month;
      user.apiCallsThisMonth = 0;
      await user.save();
    }

    return NextResponse.json({
      data: {
        maskedKey: maskApiKey(user.apiKey),
        callsThisMonth: user.apiCallsThisMonth ?? 0,
        limit: user.apiUsageLimit ?? 10000,
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;
    const month = monthKey();

    const newKey = generateApiKey();
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          apiKey: newKey,
          apiUsageBillingMonth: month,
          apiCallsThisMonth: 0,
        },
      },
      { new: true },
    ).select("apiKey");

    if (!user?.apiKey) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        key: user.apiKey,
        message: "Store this key securely — it will not be shown again in full.",
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
