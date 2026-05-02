import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateApiKey, monthKey } from "@/lib/api-key";
import { connectDB } from "@/lib/mongoose";
import { generateVirtualCardNumber } from "@/lib/virtual-card-utils";
import User from "@/models/User";
import VirtualCard from "@/models/VirtualCard";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  splitCode: z.string().length(4).regex(/^\d{4}$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { name, email, password, splitCode } = parsed.data;
    await connectDB();

    const existingEmail = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existingEmail) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const existingCode = await User.findOne({ splitCode }).lean();
    if (existingCode) {
      return NextResponse.json({ error: "Split code already taken" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const d = new Date();
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      splitCode,
      roles: ["user"],
      apiKey: generateApiKey(),
      apiUsageBillingMonth: monthKey(),
      apiCallsThisMonth: 0,
    });

    await VirtualCard.create({
      userId: newUser._id,
      balance: 0,
      currency: "USD",
      cardNumber: generateVirtualCardNumber(),
      expiryMonth: 12,
      expiryYear: d.getFullYear() + 3,
    });

    return NextResponse.json(
      { success: true, message: "Account created successfully" },
      { status: 201 },
    );
  } catch (err) {
    console.error("[REGISTER ERROR]", err);

    if (mongoose.connection.readyState !== 1) {
      return NextResponse.json(
        {
          error:
            "Database is not connected. Set MONGODB_URI in .env.local (use your real password, not <PASSWORD>) and restart the dev server.",
        },
        { status: 503 },
      );
    }

    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      const key = (err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};
      if ("email" in key) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
      if ("splitCode" in key) {
        return NextResponse.json({ error: "Split code already taken" }, { status: 409 });
      }
      return NextResponse.json({ error: "Email or split code is already in use" }, { status: 409 });
    }

    if (err instanceof mongoose.Error.ValidationError) {
      const messages = Object.values(err.errors).map((e) => e.message);
      return NextResponse.json({ error: messages.join(" ") }, { status: 400 });
    }

    const message = err instanceof Error ? err.message : "";
    if (
      /authentication failed|bad auth|ENOTFOUND|querySrv|ECONNREFUSED|MongooseServerSelectionError/i.test(
        message,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Could not reach MongoDB. Check MONGODB_URI (network access in Atlas, correct password, and IP allowlist).",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
