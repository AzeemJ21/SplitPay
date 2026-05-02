import { randomBytes } from "crypto";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export const monthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function generateApiKey(): string {
  return `sp_live_${randomBytes(24).toString("hex")}`;
}

export function maskApiKey(key: string): string {
  if (key.length <= 12) return "sp_live_••••••••";
  const last4 = key.slice(-4);
  return `sp_live_${"•".repeat(8)}${last4}`;
}

/** Ensures apiKey exists and monthly counter is reset when the calendar month changes. */
export async function ensureUserApiKey(userId: string): Promise<{ apiKey: string }> {
  await connectDB();
  const user = await User.findById(userId).select("apiKey apiUsageBillingMonth apiCallsThisMonth").lean();
  if (!user) throw new Error("user_not_found");

  const month = monthKey();
  let key = user.apiKey as string | undefined;

  if (!key) {
    key = generateApiKey();
    await User.findByIdAndUpdate(userId, {
      $set: { apiKey: key, apiUsageBillingMonth: month, apiCallsThisMonth: 0 },
    });
    return { apiKey: key };
  }

  if (user.apiUsageBillingMonth !== month) {
    await User.findByIdAndUpdate(userId, {
      $set: { apiUsageBillingMonth: month, apiCallsThisMonth: 0 },
    });
  }

  return { apiKey: key };
}

export async function incrementMerchantApiUsage(merchantUserId: string) {
  await connectDB();
  const month = monthKey();
  const u = await User.findById(merchantUserId).select("apiUsageBillingMonth apiCallsThisMonth");
  if (!u) return;
  if (u.apiUsageBillingMonth !== month) {
    u.apiUsageBillingMonth = month;
    u.apiCallsThisMonth = 1;
  } else {
    u.apiCallsThisMonth = (u.apiCallsThisMonth ?? 0) + 1;
  }
  await u.save();
}
