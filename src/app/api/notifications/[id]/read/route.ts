import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Notification from "@/models/Notification";

export async function PUT(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await connectDB();
    const userOid = new Types.ObjectId(session.user.id);

    const updated = await Notification.findOneAndUpdate(
      { _id: params.id, userId: userOid },
      { $set: { read: true } },
      { new: true },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: { id: updated._id.toString(), read: true },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
