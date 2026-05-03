import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongoose";
import Notification from "@/models/Notification";
import Transaction from "@/models/Transaction";
import User from "@/models/User";

const bodySchema = z.object({
  splitCode: z.string().regex(/^\d{4}$/),
  amount: z.number().positive(),
  card1Amount: z.number().nonnegative().optional(),
  card2Amount: z.number().nonnegative().optional(),
  orderId: z.string().min(1).optional(),
});

function storeCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.STORE_URL || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Demo-Store-Secret",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: storeCorsHeaders() });
}

/**
 * Demo-only: records a completed split_payment + notification for the customer
 * when the storefront completes a simulated checkout. No payment gateway.
 */
export async function POST(request: Request) {
  const headers = storeCorsHeaders();
  const expected = process.env.DEMO_STORE_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "DEMO_DISABLED", message: "Set DEMO_STORE_SECRET on the dashboard to accept demo store purchases." },
      { status: 503, headers },
    );
  }

  const provided = request.headers.get("x-demo-store-secret")?.trim();
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400, headers },
    );
  }

  const { splitCode, amount, orderId } = parsed.data;
  const card1Amount = parsed.data.card1Amount ?? 0;
  const card2Amount = parsed.data.card2Amount ?? 0;

  try {
    await connectDB();
    const customer = await User.findOne({ splitCode }).lean();
    if (!customer) {
      return NextResponse.json({ error: "Invalid split code" }, { status: 404, headers });
    }

    const customerOid = customer._id as Types.ObjectId;

    if (orderId) {
      const existing = await Transaction.findOne({
        userId: customerOid,
        merchantId: orderId,
      })
        .select("_id")
        .lean();
      if (existing) {
        return NextResponse.json(
          { data: { success: true, duplicate: true, transactionId: existing._id.toString() } },
          { status: 200, headers },
        );
      }
    }

    const tx = await Transaction.create({
      userId: customerOid,
      splitCode: customer.splitCode,
      amount,
      card1Amount,
      card2Amount,
      type: "split_payment",
      status: "completed",
      date: new Date(),
      merchantId: orderId,
      note: "Demo store checkout (simulated). Shown for demonstration — no real funds or cards were charged.",
    });

    const amt = amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
    const orderPart = orderId ? ` Ref: ${orderId}.` : "";
    await Notification.create({
      userId: customerOid,
      type: "payment_released",
      title: "Store purchase (demo)",
      message: `Your SplitPay store checkout for ${amt} was recorded.${orderPart} Open Transactions for details.`,
      read: false,
      relatedId: tx._id,
    });

    return NextResponse.json(
      { data: { success: true, transactionId: tx.transactionId, id: tx._id.toString() } },
      { status: 201, headers },
    );
  } catch (e) {
    console.error("[demo/store-purchase]", e);
    return NextResponse.json({ error: "Failed to record demo purchase" }, { status: 500, headers });
  }
}
