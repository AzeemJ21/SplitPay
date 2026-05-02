import { randomInt } from "crypto";
import { connectDB } from "@/lib/mongoose";
import VirtualCard from "@/models/VirtualCard";

/** 16-digit numeric string for demo virtual cards */
export function generateVirtualCardNumber(): string {
  let s = "";
  for (let i = 0; i < 16; i++) {
    s += randomInt(0, 10).toString();
  }
  return s;
}

export function maskCardNumberLast4(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  const last4 = digits.slice(-4).padStart(4, "0");
  return `•••• •••• •••• ${last4}`;
}

export async function ensureVirtualCardForUser(userId: string) {
  await connectDB();
  let doc = await VirtualCard.findOne({ userId }).lean();
  if (!doc) {
    const created = await VirtualCard.create({
      userId,
      balance: 0,
      currency: "USD",
      cardNumber: generateVirtualCardNumber(),
      expiryMonth: 12,
      expiryYear: new Date().getFullYear() + 3,
    });
    doc = created.toObject();
  }
  return doc;
}
