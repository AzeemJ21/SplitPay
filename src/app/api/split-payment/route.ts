import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { incrementMerchantApiUsage } from "@/lib/api-key";
import { connectDB } from "@/lib/mongoose";
import { processCardCharge } from "@/lib/payment-gateway";
import { ensureVirtualCardForUser } from "@/lib/virtual-card-utils";
import Notification from "@/models/Notification";
import Transaction from "@/models/Transaction";
import User from "@/models/User";
import VirtualCard from "@/models/VirtualCard";

const paySchema = z.object({
  splitCode: z.string().regex(/^\d{4}$/),
  totalAmount: z.number().positive(),
  card1: z.object({
    number: z.string().min(8),
    expiry: z.string().optional(),
    cvv: z.string().optional(),
    amount: z.number().nonnegative(),
  }),
  card2: z.object({
    number: z.string().min(8),
    expiry: z.string().optional(),
    cvv: z.string().optional(),
    amount: z.number().nonnegative(),
  }),
  merchantId: z.string().optional(),
});

function toCents(n: number) {
  return Math.round(n * 100);
}

function fromCents(c: number) {
  return c / 100;
}

function storeCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.STORE_URL || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: storeCorsHeaders() });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authHeader = request.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    await connectDB();

    let merchantUser: { _id: string; apiUsageLimit: number; apiCallsThisMonth: number } | null = null;
    if (bearer) {
      const m = await User.findOne({ apiKey: bearer })
        .select("apiUsageLimit apiCallsThisMonth")
        .lean();
      if (!m) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: storeCorsHeaders() });
      }
      const limit = m.apiUsageLimit ?? 10000;
      if ((m.apiCallsThisMonth ?? 0) >= limit) {
        return NextResponse.json(
          { error: "API_LIMIT", message: "Monthly API call limit reached" },
          { status: 429, headers: storeCorsHeaders() },
        );
      }
      merchantUser = { _id: m._id.toString(), apiUsageLimit: limit, apiCallsThisMonth: m.apiCallsThisMonth ?? 0 };
    }

    const body = await request.json();
    const parsed = paySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400, headers: storeCorsHeaders() },
      );
    }
    const payload = parsed.data;

    const c1 = toCents(payload.card1.amount);
    const c2 = toCents(payload.card2.amount);
    const totalC = toCents(payload.totalAmount);
    if (c1 + c2 < totalC) {
      return NextResponse.json(
        {
          error: "AMOUNT_MISMATCH",
          message: "Card amounts must equal total",
          missing: fromCents(totalC - c1 - c2),
        },
        { status: 400, headers: storeCorsHeaders() },
      );
    }
    if (c1 + c2 > totalC) {
      return NextResponse.json(
        {
          error: "AMOUNT_EXCEEDS",
          message: "Card amounts exceed total",
          excess: fromCents(c1 + c2 - totalC),
        },
        { status: 400, headers: storeCorsHeaders() },
      );
    }

    const customer = await User.findOne({ splitCode: payload.splitCode }).lean();
    if (!customer) {
      return NextResponse.json({ error: "Invalid split code" }, { status: 404, headers: storeCorsHeaders() });
    }
    const customerId = customer._id.toString();

    if (bearer) {
      // merchant call — allowed
    } else if (session?.user?.id === customerId) {
      // logged-in customer testing with their own code
    } else {
      return NextResponse.json(
        { error: "Unauthorized", message: "Use Authorization: Bearer or sign in with this split code" },
        { status: 401, headers: storeCorsHeaders() },
      );
    }

    const c1Res = await processCardCharge(
      {
        number: payload.card1.number.replace(/\s/g, ""),
        expiry: payload.card1.expiry,
        cvv: payload.card1.cvv,
      },
      payload.card1.amount,
    );
    if (!c1Res.success) {
      return NextResponse.json(
        { error: "CARD_DECLINED", message: "Card 1 charge failed" },
        { status: 402, headers: storeCorsHeaders() },
      );
    }

    const c2Res = await processCardCharge(
      {
        number: payload.card2.number.replace(/\s/g, ""),
        expiry: payload.card2.expiry,
        cvv: payload.card2.cvv,
      },
      payload.card2.amount,
    );

    if (!c2Res.success) {
      const refund = await processCardCharge(
        {
          number: payload.card1.number.replace(/\s/g, ""),
          expiry: payload.card1.expiry,
          cvv: payload.card1.cvv,
        },
        payload.card1.amount,
      );
      const now = new Date();
      await Transaction.create({
        userId: customerId,
        splitCode: customer.splitCode,
        amount: payload.card1.amount,
        card1Amount: payload.card1.amount,
        card2Amount: 0,
        type: "refund",
        status: refund.success ? "completed" : "failed",
        date: now,
        merchantId: payload.merchantId,
      });
      const failedTx = await Transaction.create({
        userId: customerId,
        splitCode: customer.splitCode,
        amount: payload.totalAmount,
        card1Amount: payload.card1.amount,
        card2Amount: payload.card2.amount,
        type: "failed_payment",
        status: "failed",
        date: now,
        merchantId: payload.merchantId,
        note: "Card 2 declined after card 1 succeeded",
      });
      await Notification.create({
        userId: customerId,
        type: "payment_failed",
        title: "Split payment failed",
        message: "Payment failed — card 2 declined. Card 1 has been refunded.",
        read: false,
        relatedId: failedTx._id,
      });
      return NextResponse.json(
        {
          error: "CARD2_DECLINED",
          message: "Payment failed — card 2 declined. Card 1 has been refunded.",
        },
        { status: 402, headers: storeCorsHeaders() },
      );
    }

    await ensureVirtualCardForUser(customerId);
    const vc = await VirtualCard.findOne({ userId: customer._id });
    if (!vc) {
      return NextResponse.json({ error: "Virtual card missing" }, { status: 500, headers: storeCorsHeaders() });
    }

    vc.balance += payload.totalAmount;
    await vc.save();

    const now = new Date();
    const splitTx = await Transaction.create({
      userId: customerId,
      splitCode: customer.splitCode,
      amount: payload.totalAmount,
      card1Amount: payload.card1.amount,
      card2Amount: payload.card2.amount,
      type: "split_payment",
      status: "completed",
      date: now,
      merchantId: payload.merchantId,
    });

    const payout = await processCardCharge({ number: vc.cardNumber }, payload.totalAmount);
    if (!payout.success) {
      vc.balance -= payload.totalAmount;
      await vc.save();
      return NextResponse.json(
        { error: "PAYOUT_FAILED", message: "Merchant payout could not be completed; funds were not debited." },
        { status: 500, headers: storeCorsHeaders() },
      );
    }

    vc.balance -= payload.totalAmount;
    await vc.save();

    await Transaction.create({
      userId: customerId,
      splitCode: customer.splitCode,
      amount: payload.totalAmount,
      card1Amount: 0,
      card2Amount: 0,
      type: "merchant_payout",
      status: "completed",
      date: new Date(),
      merchantId: payload.merchantId,
    });

    await Notification.create({
      userId: customerId,
      type: "payment_released",
      title: "Payment sent to merchant",
      message: `Payment of $${payload.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} processed and transferred to merchant`,
      read: false,
      relatedId: splitTx._id,
    });

    if (bearer && merchantUser) {
      await incrementMerchantApiUsage(merchantUser._id);
    }

    return NextResponse.json(
      {
        data: {
          success: true,
          splitCode: payload.splitCode,
          totalAmount: payload.totalAmount,
          gateway: {
            card1TransactionId: c1Res.transactionId,
            card2TransactionId: c2Res.transactionId,
            merchantPayoutTransactionId: payout.transactionId,
          },
        },
      },
      { status: 201, headers: storeCorsHeaders() },
    );
  } catch (e) {
    console.error("[split-payment]", e);
    return NextResponse.json(
      { error: "Failed to process split payment" },
      { status: 500, headers: storeCorsHeaders() },
    );
  }
}
