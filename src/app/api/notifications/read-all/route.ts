import { NextResponse } from "next/server";
import { Types } from "mongoose";
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
    const userOid = new Types.ObjectId(session.user.id);

    const result = await Notification.updateMany(
      { userId: userOid, read: false },
      { $set: { read: true } },
    );

    return NextResponse.json({
      data: { modifiedCount: result.modifiedCount },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
