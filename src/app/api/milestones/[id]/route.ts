import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";
import Project from "@/models/Project";

const updateMilestoneSchema = z.object({
  title: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().min(1).optional(),
  status: z
    .enum(["pending", "funded", "in_progress", "submitted", "approved", "released"])
    .optional(),
  escrowAmount: z.number().nonnegative().optional(),
  deliveryNotes: z.string().optional(),
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
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const milestone = await Milestone.findById(params.id).lean();
    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }
    const project = await Project.findById(milestone.projectId).lean();
    const authorized =
      project &&
      (project.clientId.toString() === userId || project.freelancerId?.toString() === userId);

    if (!authorized) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    return NextResponse.json({ data: { ...milestone, id: milestone._id.toString(), project } });
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
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const parsed = updateMilestoneSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await Milestone.findById(params.id).lean();
    if (!existing) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }
    const project = await Project.findById(existing.projectId).lean();
    const authorized =
      project &&
      (project.clientId.toString() === userId || project.freelancerId?.toString() === userId);
    if (!authorized) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const { dueDate: dueRaw, ...rest } = parsed.data;
    const patch: Record<string, unknown> = { ...rest };
    if (dueRaw) {
      const t = dueRaw.trim();
      const dt = /^\d{4}-\d{2}-\d{2}$/.test(t)
        ? (() => {
            const [y, m, d] = t.split("-").map(Number);
            return new Date(y, m - 1, d);
          })()
        : new Date(t);
      patch.dueDate = dt;
    }

    const updated = await Milestone.findByIdAndUpdate(params.id, patch, { new: true }).lean();

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
