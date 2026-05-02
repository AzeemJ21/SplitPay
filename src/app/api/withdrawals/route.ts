/**
 * FYP prototype — simulated withdrawals only.
 * Random completion/failure runs via setTimeout; in production use a job queue.
 * Note: In serverless deployments the delayed handler may not always finish — acceptable for demo.
 */

import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import { ensureVirtualCardForUser } from "@/lib/virtual-card-utils";
import Notification from "@/models/Notification";
import Transaction from "@/models/Transaction";
import User from "@/models/User";
import VirtualCard from "@/models/VirtualCard";
import Withdrawal from "@/models/Withdrawal";

const postSchema = z.discriminatedUnion("method", [
  z.object({
    amount: z.number().positive(),
    method: z.literal("paypal"),
    paypalEmail: z.string().email(),
  }),
  z.object({
    amount: z.number().positive(),
    method: z.literal("stripe"),
    stripeAccountId: z.string().min(1),
  }),
  z.object({
    amount: z.number().positive(),
    method: z.literal("bank_transfer"),
    bankName: z.string().min(1),
    accountNumber: z.string().min(1),
    accountName: z.string().min(1),
  }),
]);

function randomRefSuffix() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function serializeWithdrawal(w: {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  method: string;
  status: string;
  paypalEmail?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  stripeAccountId?: string;
  processedAt?: Date;
  failureReason?: string;
  transactionRef: string;
  createdAt: Date;
}) {
  return {
    id: w._id.toString(),
    userId: w.userId.toString(),
    amount: w.amount,
    method: w.method,
    status: w.status,
    paypalEmail: w.paypalEmail,
    bankName: w.bankName,
    accountNumber: w.accountNumber,
    accountName: w.accountName,
    stripeAccountId: w.stripeAccountId,
    processedAt: w.processedAt ? w.processedAt.toISOString() : undefined,
    failureReason: w.failureReason,
    transactionRef: w.transactionRef,
    createdAt: w.createdAt.toISOString(),
  };
}

/** FYP: simulated async settlement — 90% success after delay */
async function simulateWithdrawalProcessing(
  withdrawalId: string,
  userIdStr: string,
  amount: number,
  wdrRef: string,
) {
  await connectDB();
  const success = Math.random() > 0.1;
  const userOid = new Types.ObjectId(userIdStr);

  if (success) {
    await Withdrawal.findByIdAndUpdate(withdrawalId, {
      status: "completed",
      processedAt: new Date(),
    });
    await Transaction.findOneAndUpdate({ transactionRef: wdrRef }, { status: "completed" });
    await Notification.create({
      userId: userOid,
      type: "withdrawal_completed",
      title: "Withdrawal processed",
      message: `Your withdrawal of $${amount.toFixed(2)} has been processed successfully (simulated).`,
      read: false,
      relatedId: new Types.ObjectId(withdrawalId),
    });
  } else {
    await VirtualCard.findOneAndUpdate({ userId: userOid }, { $inc: { balance: amount } });
    await Withdrawal.findByIdAndUpdate(withdrawalId, {
      status: "failed",
      failureReason: "Simulated processing failure",
      processedAt: new Date(),
    });
    await Transaction.findOneAndUpdate({ transactionRef: wdrRef }, { status: "failed" });
    await Notification.create({
      userId: userOid,
      type: "withdrawal_failed",
      title: "Withdrawal failed",
      message: "Withdrawal failed — balance has been refunded (simulated).",
      read: false,
      relatedId: new Types.ObjectId(withdrawalId),
    });
  }
}

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;

    const url = new URL(request.url);
    const parsed = listQuery.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", issues: parsed.error.flatten() }, { status: 400 });
    }

    const { page, limit } = parsed.data;
    const filter = { userId };
    const total = await Withdrawal.countDocuments(filter);
    const rows = await Withdrawal.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      data: rows.map((w) => serializeWithdrawal(w as Parameters<typeof serializeWithdrawal>[0])),
      meta: { total, page, limit, totalPages },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;

    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const body = parsed.data;
    const amount = body.amount;

    const cardBefore = await ensureVirtualCardForUser(userId);
    const balance = cardBefore.balance ?? 0;
    if (balance < amount) {
      return NextResponse.json(
        { error: "INSUFFICIENT_BALANCE", available: balance },
        { status: 400 },
      );
    }

    const updatedCard = await VirtualCard.findOneAndUpdate(
      { userId, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true },
    ).lean();

    if (!updatedCard) {
      return NextResponse.json(
        { error: "INSUFFICIENT_BALANCE", available: balance },
        { status: 400 },
      );
    }

    const transactionRef = `WDR-${Date.now()}-${randomRefSuffix()}`;

    const userDoc = await User.findById(userId).select("splitCode").lean();
    const splitCode = userDoc?.splitCode ?? "0000";

    const withdrawalPayload: Record<string, unknown> = {
      userId,
      amount,
      method: body.method,
      status: "pending",
      transactionRef,
    };

    if (body.method === "paypal") {
      withdrawalPayload.paypalEmail = body.paypalEmail;
    } else if (body.method === "stripe") {
      withdrawalPayload.stripeAccountId = body.stripeAccountId;
    } else {
      withdrawalPayload.bankName = body.bankName;
      withdrawalPayload.accountNumber = body.accountNumber;
      withdrawalPayload.accountName = body.accountName;
    }

    const withdrawal = await Withdrawal.create(withdrawalPayload);

    await Transaction.create({
      userId,
      splitCode,
      amount,
      card1Amount: 0,
      card2Amount: 0,
      type: "withdrawal",
      status: "pending",
      date: new Date(),
      transactionRef,
      note: `Withdrawal ${transactionRef}`,
    });

    const methodLabel =
      body.method === "paypal" ? "PayPal" : body.method === "stripe" ? "Stripe" : "Bank transfer";

    await Notification.create({
      userId,
      type: "withdrawal_submitted",
      title: "Withdrawal requested",
      message: `Withdrawal of $${amount.toFixed(2)} via ${methodLabel} is being processed (simulated).`,
      read: false,
      relatedId: withdrawal._id,
    });

    const wId = withdrawal._id.toString();

    // FYP prototype: simulate processor delay — not suitable for production serverless without a queue
    setTimeout(() => {
      void simulateWithdrawalProcessing(wId, userId, amount, transactionRef);
    }, 5000);

    return NextResponse.json({
      success: true,
      withdrawal: serializeWithdrawal(withdrawal.toObject() as Parameters<typeof serializeWithdrawal>[0]),
      message: "Withdrawal request submitted",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
