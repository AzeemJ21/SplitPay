import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { CACHE_CONTROL_LIST } from "@/lib/api-cache-headers";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";
import Project from "@/models/Project";

const milestoneListQuery = z.object({
  status: z
    .enum(["pending", "funded", "in_progress", "submitted", "approved", "released"])
    .optional(),
  projectId: z.string().optional(),
  countOnly: z
    .enum(["1", "true", "0", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

const createMilestoneSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;

    const url = new URL(request.url);
    const parsed = milestoneListQuery.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      projectId: url.searchParams.get("projectId") ?? undefined,
      countOnly: url.searchParams.get("countOnly") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", issues: parsed.error.flatten() }, { status: 400 });
    }

    const projects = await Project.find({
      $or: [{ clientId: userId }, { freelancerId: userId }],
    }).lean();
    const projectIds = projects.map((project) => project._id);

    let allowedProjectIds = projectIds;
    if (parsed.data.projectId) {
      if (!Types.ObjectId.isValid(parsed.data.projectId)) {
        return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
      }
      const allowed = projectIds.some((id) => id.toString() === parsed.data.projectId);
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      allowedProjectIds = projectIds.filter((id) => id.toString() === parsed.data.projectId);
    }

    const milestoneFilter: Record<string, unknown> = { projectId: { $in: allowedProjectIds } };
    if (parsed.data.status) {
      milestoneFilter.status = parsed.data.status;
    }

    if (parsed.data.countOnly) {
      const total =
        allowedProjectIds.length > 0 ? await Milestone.countDocuments(milestoneFilter) : 0;
      return NextResponse.json(
        {
          data: [],
          meta: { total },
        },
        { headers: { "Cache-Control": CACHE_CONTROL_LIST } },
      );
    }

    const milestones =
      allowedProjectIds.length > 0
        ? await Milestone.find(milestoneFilter).sort({ dueDate: 1 }).lean()
        : [];
    const projectById = new Map(projects.map((project) => [project._id.toString(), project]));
    const normalizedMilestones = milestones.map((milestone) => {
      const raw = milestone as { dueDate?: Date; deadline?: Date };
      const due = raw.dueDate ?? raw.deadline;
      return {
        ...milestone,
        id: milestone._id.toString(),
        dueDate:
          due instanceof Date
            ? due.toISOString()
            : due
              ? new Date(due as string).toISOString()
              : undefined,
        autoReleaseAt:
          milestone.autoReleaseAt instanceof Date
            ? milestone.autoReleaseAt.toISOString()
            : milestone.autoReleaseAt
              ? new Date(milestone.autoReleaseAt).toISOString()
              : undefined,
        project: projectById.get(milestone.projectId.toString()) ?? null,
      };
    });

    return NextResponse.json(
      {
        data: normalizedMilestones,
        meta: {
          total: normalizedMilestones.length,
        },
      },
      { headers: { "Cache-Control": CACHE_CONTROL_LIST } },
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function parseDueDate(raw: string): Date | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(t);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;

    const parsed = createMilestoneSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const { projectId, title, amount, dueDate: dueRaw } = parsed.data;
    if (!Types.ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    }

    const project = await Project.findOne({ _id: projectId, clientId: userId }).lean();
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    const due = parseDueDate(dueRaw);
    if (!due) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }

    const milestone = await Milestone.create({
      projectId,
      title: title.trim(),
      amount,
      dueDate: due,
      status: "pending",
      escrowAmount: 0,
      deliveryNotes: "",
    });

    return NextResponse.json(
      {
        data: {
          ...milestone.toObject(),
          id: milestone._id.toString(),
          dueDate: (milestone.dueDate ?? due).toISOString(),
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
