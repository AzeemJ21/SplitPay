import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { CACHE_CONTROL_PRIVATE_NO_STORE } from "@/lib/api-cache-headers";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import { ensureVirtualCardForUser, maskCardNumberLast4 } from "@/lib/virtual-card-utils";
import Transaction from "@/models/Transaction";
import User from "@/models/User";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;
    const oid = new Types.ObjectId(userId);

    const [user, card] = await Promise.all([
      User.findById(userId).select("name").lean(),
      ensureVirtualCardForUser(userId),
    ]);

    if (!card?.cardNumber) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const [recvRow, paidRow] = await Promise.all([
      Transaction.aggregate<{ t: number }>([
        {
          $match: {
            userId: oid,
            status: "completed",
            type: { $in: ["escrow_release", "split_payment"] },
          },
        },
        { $group: { _id: null, t: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate<{ t: number }>([
        {
          $match: {
            userId: oid,
            status: "completed",
            type: "merchant_payout",
          },
        },
        { $group: { _id: null, t: { $sum: "$amount" } } },
      ]),
    ]);

    return NextResponse.json(
      {
        data: {
          card: {
            maskedNumber: maskCardNumberLast4(card.cardNumber),
            expiryMonth: card.expiryMonth,
            expiryYear: card.expiryYear,
            currency: card.currency,
            createdAt: card.createdAt,
          },
          balance: card.balance,
          totalReceived: recvRow[0]?.t ?? 0,
          totalPaidOut: paidRow[0]?.t ?? 0,
          holderName: user?.name ?? "Cardholder",
        },
      },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
