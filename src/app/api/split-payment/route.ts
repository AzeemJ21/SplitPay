import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { incrementMerchantApiUsage } from "@/lib/api-key";
import { connectDB } from "@/lib/mongoose";
import { processCardCharge, processCardRefund } from "@/lib/payment-gateway";
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
    const customerOid = customer._id as Types.ObjectId;

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

    const priorCompletedSplits = await Transaction.countDocuments({
      userId: customerOid,
      type: "split_payment",
      status: "completed",
    });
    const isFirstSplitPayment = priorCompletedSplits === 0;
    const cardChargeOpts = { forceSuccess: isFirstSplitPayment };

    const card1Details = {
      number: payload.card1.number.replace(/\s/g, ""),
      expiry: payload.card1.expiry,
      cvv: payload.card1.cvv,
    };
    const card2Details = {
      number: payload.card2.number.replace(/\s/g, ""),
      expiry: payload.card2.expiry,
      cvv: payload.card2.cvv,
    };

    const c1Res = await processCardCharge(card1Details, payload.card1.amount, cardChargeOpts);
    if (!c1Res.success) {
      const now = new Date();
      await Transaction.create({
        userId: customerOid,
        splitCode: customer.splitCode,
        amount: payload.totalAmount,
        card1Amount: payload.card1.amount,
        card2Amount: payload.card2.amount,
        type: "failed_payment",
        status: "failed",
        date: now,
        merchantId: payload.merchantId,
        note: "Card 1 declined at checkout (split pay)",
      });
      await Notification.create({
        userId: customerOid,
        type: "payment_failed",
        title: "Split payment failed",
        message: "Card 1 was declined — no charges completed.",
        read: false,
      });
      return NextResponse.json(
        { error: "CARD1_DECLINED", message: "Card 1 charge failed" },
        { status: 402, headers: storeCorsHeaders() },
      );
    }

    const c2Res = await processCardCharge(card2Details, payload.card2.amount, cardChargeOpts);
    if (!c2Res.success) {
      const revRes = await processCardRefund(card1Details, payload.card1.amount);
      const now = new Date();

      await Transaction.create({
        userId: customerOid,
        splitCode: customer.splitCode,
        amount: payload.card1.amount,
        card1Amount: payload.card1.amount,
        card2Amount: 0,
        type: "charge_reversal",
        status: revRes.success ? "completed" : "failed",
        date: now,
        merchantId: payload.merchantId,
        note: revRes.success
          ? `Rolled back successful card 1 charge (${c1Res.transactionId}) after card 2 declined. Reversal ref ${revRes.transactionId}.`
          : `CRITICAL: Card 2 declined and card 1 reversal FAILED (${revRes.transactionId}).`,
      });

      const failedTx = await Transaction.create({
        userId: customerOid,
        splitCode: customer.splitCode,
        amount: payload.totalAmount,
        card1Amount: payload.card1.amount,
        card2Amount: payload.card2.amount,
        type: "failed_payment",
        status: "failed",
        date: now,
        merchantId: payload.merchantId,
        note: revRes.success
          ? "Split checkout failed — card 2 declined; card 1 charge reversed."
          : "Split checkout failed — card 2 declined; card 1 reversal incomplete.",
      });

      await Notification.create({
        userId: customerOid,
        type: "payment_failed",
        title: "Split payment failed",
        message: revRes.success
          ? "Payment failed — card 2 declined. Card 1 has been rolled back."
          : "Payment failed — card 2 declined and card 1 rollback failed. Contact support.",
        read: false,
        relatedId: failedTx._id,
      });

      return NextResponse.json(
        {
          error: "CARD2_DECLINED",
          message: revRes.success
            ? "Payment failed — card 2 declined. Card 1 has been refunded."
            : "Payment failed — card 2 declined and card 1 rollback failed.",
        },
        { status: 402, headers: storeCorsHeaders() },
      );
    }

    await ensureVirtualCardForUser(customerId);
    const vc = await VirtualCard.findOne({ userId: customerOid });
    if (!vc) {
      return NextResponse.json({ error: "Virtual card missing" }, { status: 500, headers: storeCorsHeaders() });
    }

    const now = new Date();
    vc.balance += payload.totalAmount;
    await vc.save();

    const splitTxDoc = await Transaction.create({
      userId: customerOid,
      splitCode: customer.splitCode,
      amount: payload.totalAmount,
      card1Amount: payload.card1.amount,
      card2Amount: payload.card2.amount,
      type: "split_payment",
      status: "completed",
      date: now,
      merchantId: payload.merchantId,
      note: "Store split-pay: both cards captured; full amount credited to virtual card pending merchant settlement.",
    });

    const payout = await processCardCharge(
      { number: vc.cardNumber.replace(/\s/g, "") },
      payload.totalAmount,
    );

    if (!payout.success) {
      vc.balance -= payload.totalAmount;
      await vc.save();

      await Transaction.findByIdAndUpdate(splitTxDoc._id, {
        status: "failed",
        note:
          "Split pay invalidated: merchant payout simulation failed after virtual card credit — balance restored on card.",
      });

      await Transaction.create({
        userId: customerOid,
        splitCode: customer.splitCode,
        amount: payload.totalAmount,
        card1Amount: 0,
        card2Amount: 0,
        type: "refund",
        status: "completed",
        date: new Date(),
        merchantId: payload.merchantId,
        note: "Virtual card credit reversed after unsuccessful merchant payout simulation.",
      });

      await Transaction.create({
        userId: customerOid,
        splitCode: customer.splitCode,
        amount: payload.totalAmount,
        card1Amount: 0,
        card2Amount: 0,
        type: "merchant_payout",
        status: "failed",
        date: new Date(),
        merchantId: payload.merchantId,
        note: `Simulated merchant payout failed (${payout.transactionId}).`,
      });

      await Notification.create({
        userId: customerOid,
        type: "payment_failed",
        title: "Split payment settlement failed",
        message:
          "Both cards were charged and your virtual card was credited, but merchant payout failed. Your balance was restored.",
        read: false,
        relatedId: splitTxDoc._id,
      });

      return NextResponse.json(
        { error: "PAYOUT_FAILED", message: "Merchant payout could not be completed; funds were not debited." },
        { status: 500, headers: storeCorsHeaders() },
      );
    }

    vc.balance -= payload.totalAmount;
    await vc.save();

    await Transaction.create({
      userId: customerOid,
      splitCode: customer.splitCode,
      amount: payload.totalAmount,
      card1Amount: 0,
      card2Amount: 0,
      type: "merchant_payout",
      status: "completed",
      date: new Date(),
      merchantId: payload.merchantId,
      note: `Merchant settlement from virtual card (${payout.transactionId}).`,
    });

    await Notification.create({
      userId: customerOid,
      type: "payment_released",
      title: "Payment sent to merchant",
      message: `Payment of $${payload.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} processed and transferred to merchant`,
      read: false,
      relatedId: splitTxDoc._id,
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
