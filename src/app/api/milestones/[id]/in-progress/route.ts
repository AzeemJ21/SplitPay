import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";
import Project from "@/models/Project";

/** Freelancer marks funded milestone as in progress / actively working */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
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

    if (milestone.status !== "funded") {
      return NextResponse.json({ error: "Milestone must be funded first." }, { status: 400 });
    }

    const updated = await Milestone.findByIdAndUpdate(
      milestone._id,
      { status: "in_progress" },
      { new: true },
    ).lean();

    return NextResponse.json({
      data: {
        ...updated,
        id: updated?._id.toString(),
        dueDate: updated?.dueDate instanceof Date ? updated.dueDate.toISOString() : updated?.dueDate,
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
