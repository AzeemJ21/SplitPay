import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { CACHE_CONTROL_LIST } from "@/lib/api-cache-headers";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";
import Notification from "@/models/Notification";
import Project from "@/models/Project";
import User from "@/models/User";

const createProjectSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  budget: z.number().positive(),
  deadline: z.string().min(1),
  freelancerId: z.string().min(1),
});

const listQuerySchema = z.object({
  status: z.enum(["pending", "active", "completed"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  countOnly: z
    .enum(["1", "true", "0", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseDeadlineInput(raw: string): Date | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(trimmed);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

type LeanProjectDoc = {
  _id: Types.ObjectId;
  clientId: unknown;
  freelancerId: unknown;
  title: string;
  description?: string;
  budget: number;
  status: string;
  deadline?: Date;
  createdAt: Date;
};

function normalizeProjects(projects: LeanProjectDoc[], milestoneByProject: Map<string, unknown[]>) {
  return projects.map((project) => {
    const fr = project.freelancerId as unknown;
    const cl = project.clientId as unknown;
    const freelancerIdStr =
      fr && typeof fr === "object" && "_id" in fr
        ? String((fr as { _id: unknown })._id)
        : String(project.freelancerId ?? "");
    const clientIdStr =
      cl && typeof cl === "object" && "_id" in cl
        ? String((cl as { _id: unknown })._id)
        : String(project.clientId ?? "");
    const freelancerName =
      fr && typeof fr === "object" && "name" in fr ? String((fr as { name?: string }).name ?? "") : "";
    const clientName =
      cl && typeof cl === "object" && "name" in cl ? String((cl as { name?: string }).name ?? "") : "";

    const deadlineRaw = project.deadline;
    const deadlineIso =
      deadlineRaw instanceof Date && !Number.isNaN(deadlineRaw.getTime())
        ? deadlineRaw.toISOString()
        : undefined;

    return {
      ...project,
      id: project._id.toString(),
      clientId: clientIdStr,
      freelancerId: freelancerIdStr,
      clientDisplayName: clientName || undefined,
      freelancerDisplayName: freelancerName || undefined,
      deadline: deadlineIso,
      milestones: milestoneByProject.get(project._id.toString()) ?? [],
    };
  });
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;

    const url = new URL(request.url);
    const parsedQuery = listQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      countOnly: url.searchParams.get("countOnly") ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json({ error: "Invalid query", issues: parsedQuery.error.flatten() }, { status: 400 });
    }

    const { status, limit, countOnly } = parsedQuery.data;
    const effectiveLimit = countOnly ? undefined : limit ?? 20;

    const filter: Record<string, unknown> = {
      $or: [{ clientId: userId }, { freelancerId: userId }],
    };
    if (status) {
      filter.status = status;
    }

    if (countOnly) {
      const total = await Project.countDocuments(filter);
      return NextResponse.json(
        {
          data: [],
          meta: { total },
        },
        { headers: { "Cache-Control": CACHE_CONTROL_LIST } },
      );
    }

    let query = Project.find(filter).sort({ createdAt: -1 }).populate([
      { path: "freelancerId", select: "name email splitCode" },
      { path: "clientId", select: "name email splitCode" },
    ]);

    if (effectiveLimit != null) {
      query = query.limit(effectiveLimit);
    }

    const projects = (await query.lean()) as LeanProjectDoc[];
    const projectIds = projects.map((project) => project._id);
    const milestones = projectIds.length
      ? await Milestone.find({ projectId: { $in: projectIds } }).lean()
      : [];
    const milestoneByProject = new Map<string, typeof milestones>();
    for (const milestone of milestones) {
      const key = milestone.projectId.toString();
      const current = milestoneByProject.get(key) ?? [];
      current.push(milestone);
      milestoneByProject.set(key, current);
    }

    const normalizedProjects = normalizeProjects(projects, milestoneByProject);

    return NextResponse.json(
      {
        data: normalizedProjects,
        meta: {
          total: normalizedProjects.length,
        },
      },
      { headers: { "Cache-Control": CACHE_CONTROL_LIST } },
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;

    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;

    if (!Types.ObjectId.isValid(payload.freelancerId)) {
      return NextResponse.json({ error: "Invalid freelancer id" }, { status: 400 });
    }

    if (payload.freelancerId === userId) {
      return NextResponse.json({ error: "You cannot assign yourself as freelancer." }, { status: 400 });
    }

    const freelancerUser = await User.findById(payload.freelancerId).select("_id").lean();
    if (!freelancerUser) {
      return NextResponse.json({ error: "Freelancer not found." }, { status: 404 });
    }

    const deadlineDate = parseDeadlineInput(payload.deadline);
    if (!deadlineDate) {
      return NextResponse.json({ error: "Invalid deadline." }, { status: 400 });
    }

    const today = startOfDay(new Date());
    if (startOfDay(deadlineDate) < today) {
      return NextResponse.json({ error: "Deadline must be today or later." }, { status: 400 });
    }

    const project = await Project.create({
      title: payload.title.trim(),
      description: payload.description?.trim() ?? "",
      budget: payload.budget,
      deadline: deadlineDate,
      status: "pending",
      clientId: userId,
      freelancerId: payload.freelancerId,
    });

    await Notification.create({
      userId: payload.freelancerId,
      type: "project_assigned",
      title: "New project assignment",
      message: `You've been assigned to "${payload.title.trim()}"`,
      read: false,
      relatedId: project._id,
    });

    const populated = await Project.findById(project._id)
      .populate([
        { path: "freelancerId", select: "name email splitCode" },
        { path: "clientId", select: "name email splitCode" },
      ])
      .lean();

    if (!populated) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const milestoneByProject = new Map<string, unknown[]>([[populated._id.toString(), []]]);
    const [normalized] = normalizeProjects([populated as LeanProjectDoc], milestoneByProject);

    return NextResponse.json({ data: normalized }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
