import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

const updateSplitCodeSchema = z.object({
  splitCode: z.string().regex(/^\d{4}$/),
});

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;

    const parsed = updateSplitCodeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const exists = await User.findOne({
      splitCode: parsed.data.splitCode,
      _id: { $ne: userId },
    })
      .select("_id")
      .lean();
    if (exists) {
      return NextResponse.json({ error: "Split code already in use" }, { status: 409 });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { splitCode: parsed.data.splitCode },
      { new: true },
    )
      .select("_id splitCode")
      .lean();

    return NextResponse.json({
      data: {
        id: user?._id.toString(),
        splitCode: user?.splitCode,
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
