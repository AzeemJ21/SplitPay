import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { CACHE_CONTROL_LIST } from "@/lib/api-cache-headers";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Transaction from "@/models/Transaction";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = new Types.ObjectId(session.user.id);

    const base = { userId };

    const [volumeRow, totalCount, completedCount, failedCount] = await Promise.all([
      Transaction.aggregate<{ totalVolume: number }>([
        { $match: { ...base, status: "completed" } },
        { $group: { _id: null, totalVolume: { $sum: "$amount" } } },
      ]),
      Transaction.countDocuments(base),
      Transaction.countDocuments({ ...base, status: "completed" }),
      Transaction.countDocuments({ ...base, status: "failed" }),
    ]);

    const totalVolume = volumeRow[0]?.totalVolume ?? 0;

    return NextResponse.json(
      {
        data: {
          totalVolume,
          totalCount,
          completedCount,
          failedCount,
          currency: "USD",
        },
      },
      { headers: { "Cache-Control": CACHE_CONTROL_LIST } },
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
