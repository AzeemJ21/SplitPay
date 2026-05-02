import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { CACHE_CONTROL_LIST } from "@/lib/api-cache-headers";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Dispute, { type ComplaintType } from "@/models/Dispute";
import Notification from "@/models/Notification";
import Project from "@/models/Project";

const COMPLAINT_TYPES = [
  "payment_issue",
  "fraud",
  "milestone_dispute",
  "chat_abuse",
  "other",
] as const satisfies readonly ComplaintType[];

const screenshotSchema = z.object({
  url: z.string().min(1),
  name: z.string().min(1),
});

const attachmentSchema = z.object({
  url: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().min(1),
});

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(100),
  type: z.enum(COMPLAINT_TYPES),
  screenshots: z.array(screenshotSchema).optional(),
  attachments: z.array(attachmentSchema).max(3).optional(),
  additionalNotes: z.string().optional(),
});

const MAX_B64_CHARS = 2_500_000;

function mimeFromDataUrl(url: string): string {
  const m = /^data:([^;]+);/.exec(url);
  return m ? m[1] : "application/octet-stream";
}

function validatePayloadSize(screenshots: { url: string }[], attachments: { url: string }[]) {
  for (const s of screenshots) {
    if (s.url.length > MAX_B64_CHARS) return "Screenshot too large (max ~2.5MB encoded).";
  }
  for (const a of attachments) {
    if (a.url.length > MAX_B64_CHARS) return "Attachment too large (max ~2.5MB encoded).";
  }
  return null;
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
    const countOnly = url.searchParams.get("countOnly") === "1" || url.searchParams.get("countOnly") === "true";
    const openOnly =
      url.searchParams.get("openOnly") === "1" || url.searchParams.get("openOnly") === "true";

    const projects = await Project.find({
      $or: [{ clientId: userId }, { freelancerId: userId }],
    })
      .select("_id title")
      .lean();

    const projectIds = projects.map((p) => p._id);
    const projectTitleById = new Map(projects.map((p) => [p._id.toString(), p.title]));

    if (projectIds.length === 0) {
      const body = countOnly ? { data: [], meta: { total: 0, open: 0 } } : { data: [] };
      return NextResponse.json(body, { headers: { "Cache-Control": CACHE_CONTROL_LIST } });
    }

    if (countOnly) {
      const total = await Dispute.countDocuments({ projectId: { $in: projectIds } });
      const open = await Dispute.countDocuments({ projectId: { $in: projectIds }, status: "open" });
      return NextResponse.json(
        { data: [], meta: { total, open } },
        { headers: { "Cache-Control": CACHE_CONTROL_LIST } },
      );
    }

    const filter: Record<string, unknown> = { projectId: { $in: projectIds } };
    if (openOnly) {
      filter.status = "open";
    }

    const rows = await Dispute.find(filter).sort({ createdAt: -1 }).lean();

    const data = rows.map((d) => ({
      id: d._id.toString(),
      projectId: d.projectId.toString(),
      projectTitle: projectTitleById.get(d.projectId.toString()) ?? "Project",
      title: d.title,
      type: (d.type ?? "milestone_dispute") as ComplaintType,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    }));

    return NextResponse.json({ data }, { headers: { "Cache-Control": CACHE_CONTROL_LIST } });
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

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const { projectId, title, description, type, additionalNotes } = parsed.data;
    const screenshots = parsed.data.screenshots ?? [];
    const attachments = parsed.data.attachments ?? [];

    const sizeErr = validatePayloadSize(screenshots, attachments);
    if (sizeErr) {
      return NextResponse.json({ error: sizeErr }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    }

    const project = await Project.findOne({
      _id: projectId,
      $or: [{ clientId: userId }, { freelancerId: userId }],
    }).lean();

    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let fullDescription = description.trim();
    if (additionalNotes?.trim()) {
      fullDescription += `\n\n--- Additional notes ---\n${additionalNotes.trim()}`;
    }

    const evidenceFromScreenshots = screenshots.map((s) => ({
      url: s.url,
      name: s.name,
      type: mimeFromDataUrl(s.url),
    }));
    const evidenceFromAttachments = attachments.map((a) => ({
      url: a.url,
      name: a.name,
      type: a.mimeType,
    }));

    const doc = await Dispute.create({
      projectId,
      raisedBy: userId,
      title: title.trim(),
      description: fullDescription,
      type,
      screenshots,
      attachments,
      evidence: [...evidenceFromScreenshots, ...evidenceFromAttachments],
      status: "open",
    });

    const otherId =
      project.clientId.toString() === userId
        ? project.freelancerId?.toString()
        : project.clientId.toString();
    if (otherId) {
      await Notification.create({
        userId: otherId,
        type: "dispute_opened",
        title: "Dispute opened",
        message: `A dispute has been raised for project '${project.title}'`,
        read: false,
        relatedId: doc._id,
      });
    }

    return NextResponse.json(
      {
        data: {
          id: doc._id.toString(),
          projectId: doc.projectId.toString(),
          raisedBy: doc.raisedBy.toString(),
          title: doc.title,
          description: doc.description,
          type: doc.type,
          evidence: doc.evidence,
          screenshots: doc.screenshots,
          attachments: doc.attachments,
          status: doc.status,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
          reference: doc._id.toString().slice(-8).toUpperCase(),
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
