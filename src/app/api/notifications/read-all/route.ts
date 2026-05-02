import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Notification from "@/models/Notification";

export async function PUT() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();

    const result = await Notification.updateMany(
      { userId: session.user.id, read: false },
      { $set: { read: true } },
    );

    return NextResponse.json({
      data: { modifiedCount: result.modifiedCount },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
