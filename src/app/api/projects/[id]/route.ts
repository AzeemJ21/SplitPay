import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { CACHE_CONTROL_LIST } from "@/lib/api-cache-headers";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";
import Project from "@/models/Project";

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  budget: z.number().positive().optional(),
  status: z.enum(["pending", "active", "completed"]).optional(),
  freelancerId: z.string().optional(),
  description: z.string().optional(),
});

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;
    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = await Project.findOne({
      _id: params.id,
      $or: [{ clientId: userId }, { freelancerId: userId }],
    })
      .populate("clientId", "name splitCode avatarUrl")
      .populate("freelancerId", "name splitCode avatarUrl")
      .lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const rawMilestones = await Milestone.find({ projectId: project._id })
      .sort({ dueDate: 1 })
      .lean();

    const milestones = rawMilestones.map((m) => ({
      id: m._id.toString(),
      projectId: m.projectId.toString(),
      title: m.title,
      amount: m.amount,
      dueDate: m.dueDate ? new Date(m.dueDate).toISOString() : undefined,
      status: m.status,
      escrowAmount: m.escrowAmount ?? 0,
    }));

    const cl = project.clientId as unknown;
    const fr = project.freelancerId as unknown;
    const clientName =
      cl && typeof cl === "object" && "name" in cl ? String((cl as { name?: string }).name ?? "") : "";
    const freelancerName =
      fr && typeof fr === "object" && "name" in fr ? String((fr as { name?: string }).name ?? "") : "";

    return NextResponse.json(
      {
        data: {
          ...project,
          id: project._id.toString(),
          clientDisplayName: clientName,
          freelancerDisplayName: freelancerName,
          milestones,
        },
      },
      { headers: { "Cache-Control": CACHE_CONTROL_LIST } },
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;
    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const parsed = updateProjectSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await Project.findOne({
      _id: params.id,
      $or: [{ clientId: userId }, { freelancerId: userId }],
    }).lean();
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updated = await Project.findByIdAndUpdate(params.id, parsed.data, { new: true }).lean();

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;
    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const existing = await Project.findOne({
      _id: params.id,
      $or: [{ clientId: userId }, { freelancerId: userId }],
    }).lean();
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await Milestone.deleteMany({ projectId: params.id });
    await Project.findByIdAndDelete(params.id);
    return NextResponse.json({ data: { id: params.id, deleted: true } });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
