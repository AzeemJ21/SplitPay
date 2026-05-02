import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Notification from "@/models/Notification";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit =
      limitRaw != null ? Math.min(Math.max(parseInt(limitRaw, 10) || 0, 1), 200) : undefined;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit ?? 100)
        .lean(),
      Notification.countDocuments({ userId, read: false }),
    ]);

    return NextResponse.json({
      data: notifications.map((n) => ({
        ...n,
        id: n._id.toString(),
        relatedId: n.relatedId?.toString(),
      })),
      unreadCount,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
