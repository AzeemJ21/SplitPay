import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { CACHE_CONTROL_LIST } from "@/lib/api-cache-headers";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import VirtualCard from "@/models/VirtualCard";
import User, { INotificationPrefs } from "@/models/User";

const putJsonSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
});

const defaultPrefs: INotificationPrefs = {
  emailProjectAssignment: true,
  emailMilestoneFunded: true,
  emailWorkSubmitted: true,
  emailPaymentReleased: true,
  emailPaymentFailed: true,
};

function mergePrefs(prefs: Partial<INotificationPrefs> | undefined | null): INotificationPrefs {
  return { ...defaultPrefs, ...prefs };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;

    const [user, vc] = await Promise.all([
      User.findById(userId).select("-passwordHash").lean(),
      VirtualCard.findOne({ userId }).select("balance").lean(),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const u = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      splitCode: user.splitCode,
      roles: user.roles,
      avatarUrl: (user as { avatarUrl?: string }).avatarUrl,
      virtualCardBalance: vc?.balance ?? 0,
      notificationPrefs: mergePrefs(
        (user as { notificationPrefs?: Partial<INotificationPrefs> }).notificationPrefs,
      ),
      createdAt: user.createdAt,
    };

    return NextResponse.json({ data: u }, { headers: { "Cache-Control": CACHE_CONTROL_LIST } });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const MAX_AVATAR_BYTES = 500 * 1024;

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;

    const contentType = request.headers.get("content-type") ?? "";

    let name: string | undefined;
    let email: string | undefined;
    let avatarDataUrl: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const n = form.get("name");
      const e = form.get("email");
      if (typeof n === "string" && n.trim()) name = n.trim();
      if (typeof e === "string" && e.trim()) email = e.trim().toLowerCase();
      const file = form.get("avatar");
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_AVATAR_BYTES) {
          return NextResponse.json({ error: "Image must be 500KB or smaller" }, { status: 400 });
        }
        const buf = Buffer.from(await file.arrayBuffer());
        const base64 = buf.toString("base64");
        const mime = file.type || "image/jpeg";
        avatarDataUrl = `data:${mime};base64,${base64}`;
      }
    } else {
      const body = await request.json();
      const parsed = putJsonSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
      }
      name = parsed.data.name;
      email = parsed.data.email;
    }

    if (!name && !email && !avatarDataUrl) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (email && email !== user.email) {
      const taken = await User.findOne({ email, _id: { $ne: userId } }).lean();
      if (taken) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      user.email = email;
    }

    if (name) {
      user.name = name;
    }

    if (avatarDataUrl) {
      user.avatarUrl = avatarDataUrl;
    }

    await user.save();

    const lean = await User.findById(userId).select("-passwordHash").lean();
    const vc = await VirtualCard.findOne({ userId }).select("balance").lean();
    if (!lean) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const u = {
      id: lean._id.toString(),
      name: lean.name,
      email: lean.email,
      splitCode: lean.splitCode,
      roles: lean.roles,
      avatarUrl: (lean as { avatarUrl?: string }).avatarUrl,
      virtualCardBalance: vc?.balance ?? 0,
      notificationPrefs: mergePrefs(
        (lean as { notificationPrefs?: Partial<INotificationPrefs> }).notificationPrefs,
      ),
      createdAt: lean.createdAt,
    };

    return NextResponse.json({ data: u });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
