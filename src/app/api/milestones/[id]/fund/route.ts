import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";
import Notification from "@/models/Notification";
import Project from "@/models/Project";
import Transaction from "@/models/Transaction";
import User from "@/models/User";

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

    const project = await Project.findOne({ _id: milestone.projectId, clientId: userId }).lean();
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (milestone.status !== "pending") {
      return NextResponse.json({ error: "Milestone is not pending funding." }, { status: 400 });
    }

    const client = await User.findById(userId).select("splitCode").lean();
    const splitCode = client?.splitCode ?? "0000";
    const now = new Date();

    const updated = await Milestone.findByIdAndUpdate(
      milestone._id,
      {
        status: "funded",
        escrowAmount: milestone.amount,
        fundedAt: now,
      },
      { new: true },
    ).lean();

    await Transaction.create({
      userId: new Types.ObjectId(userId),
      splitCode,
      amount: milestone.amount,
      card1Amount: 0,
      card2Amount: 0,
      type: "escrow_funding",
      status: "completed",
      date: now,
    });

    const freelancerId = project.freelancerId?.toString();
    if (freelancerId) {
      await Notification.create({
        userId: new Types.ObjectId(freelancerId),
        type: "milestone_funded",
        title: "Milestone funded",
        message: `Milestone '${milestone.title}' has been funded and is ready to start`,
        read: false,
        relatedId: milestone.projectId,
      });
    }

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
