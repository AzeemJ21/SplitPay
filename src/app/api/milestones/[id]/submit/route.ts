import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";
import Notification from "@/models/Notification";
import Project from "@/models/Project";
import { ESCROW_AUTO_RELEASE_MS } from "@/lib/milestone-escrow";

const submitSchema = z.object({
  deliveryNotes: z.string().min(20),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;
    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const parsed = submitSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const milestone = await Milestone.findById(params.id).lean();
    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const project = await Project.findOne({
      _id: milestone.projectId,
      freelancerId: userId,
    }).lean();
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (milestone.status !== "funded" && milestone.status !== "in_progress") {
      return NextResponse.json({ error: "Milestone cannot be submitted in current state." }, { status: 400 });
    }

    const now = new Date();
    const autoReleaseAt = new Date(now.getTime() + ESCROW_AUTO_RELEASE_MS);

    const updated = await Milestone.findByIdAndUpdate(
      milestone._id,
      {
        status: "submitted",
        submittedAt: now,
        deliveryNotes: parsed.data.deliveryNotes.trim(),
        autoReleaseAt,
      },
      { new: true },
    ).lean();

    const clientId = project.clientId.toString();
    await Notification.create({
      userId: clientId,
      type: "work_submitted",
      title: "Work submitted",
      message: `Work submitted for milestone '${milestone.title}' — review and approve`,
      read: false,
      relatedId: milestone.projectId,
    });

    return NextResponse.json({
      data: {
        ...updated,
        id: updated?._id.toString(),
        dueDate: updated?.dueDate instanceof Date ? updated.dueDate.toISOString() : updated?.dueDate,
        autoReleaseAt:
          updated?.autoReleaseAt instanceof Date
            ? updated.autoReleaseAt.toISOString()
            : updated?.autoReleaseAt,
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
