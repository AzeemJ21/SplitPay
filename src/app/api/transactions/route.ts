import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { CACHE_CONTROL_LIST, CACHE_CONTROL_PRIVATE_NO_STORE } from "@/lib/api-cache-headers";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Transaction, { TRANSACTION_TYPES, TransactionType } from "@/models/Transaction";

const TX_ENUM = TRANSACTION_TYPES as unknown as [TransactionType, ...TransactionType[]];
const TX_SET = new Set<string>(TRANSACTION_TYPES);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(20),
  status: z.enum(["pending", "completed", "failed"]).optional(),
  type: z.union([z.enum(TX_ENUM), z.literal("virtual_card")]).optional(),
  /** Comma-separated transaction types (e.g. split_payment,escrow_release) */
  types: z.string().optional(),
  q: z.string().optional(),
  /** When `1`, allow large `limit` for CSV export (capped at 10000). */
  export: z.enum(["0", "1"]).optional(),
  /** Legacy: small preview lists */
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  splitCode: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userOid = new Types.ObjectId(session.user.id);

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? url.searchParams.get("pageSize") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      types: url.searchParams.get("types") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      export: url.searchParams.get("export") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      splitCode: url.searchParams.get("splitCode") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", issues: parsed.error.flatten() }, { status: 400 });
    }

    let page = parsed.data.page;
    let limit = parsed.data.limit;
    const { status, type, types: typesCsv, q, export: exportFlag, splitCode } = parsed.data;

    const exportMode = exportFlag === "1";
    if (exportMode) {
      page = 1;
      limit = 10000;
    } else {
      limit = Math.min(limit, 100);
    }

    const virtualCardTypes: TransactionType[] = [
      "split_payment",
      "merchant_payout",
      "refund",
      "escrow_release",
      "charge_reversal",
      "failed_payment",
      "withdrawal",
    ];

    const filter: Record<string, unknown> = { userId: userOid };

    const typesList = typesCsv
      ?.split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t): t is TransactionType => TX_SET.has(t));

    if (typesList && typesList.length > 0) {
      filter.type = typesList.length === 1 ? typesList[0] : { $in: typesList };
    } else if (type === "virtual_card") {
      filter.type = { $in: virtualCardTypes };
    } else if (type) {
      filter.type = type;
    }

    if (status) filter.status = status;
    if (splitCode) filter.splitCode = splitCode;

    const qTrim = q?.trim();
    if (qTrim) {
      filter.$or = [
        { transactionId: { $regex: qTrim, $options: "i" } },
        { splitCode: { $regex: qTrim, $options: "i" } },
      ];
    }

    const total = await Transaction.countDocuments(filter);
    const data = await Transaction.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json(
      {
        data: data.map((tx) => ({ ...tx, id: tx._id.toString() })),
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
