import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Message from "@/models/Message";
import Project from "@/models/Project";

const postSchema = z.object({
  content: z.string().max(2000),
  type: z.enum(["text", "image", "file", "voice"]).optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  fileMimeType: z.string().optional(),
});

async function requireProjectMember(projectId: string, userId: string) {
  if (!Types.ObjectId.isValid(projectId)) {
    return { error: "Project not found" as const, status: 404 as const, project: null };
  }
  const project = await Project.findOne({
    _id: projectId,
    $or: [{ clientId: userId }, { freelancerId: userId }],
  }).lean();
  if (!project) {
    return { error: "Forbidden" as const, status: 403 as const, project: null };
  }
  return { error: null, status: null, project };
}

function serializeMessage(m: Record<string, unknown>) {
  const raw = m.senderId as
    | Types.ObjectId
    | { _id: Types.ObjectId; name?: string; splitCode?: string }
    | string
    | undefined;
  let senderIdStr: string;
  let senderName = "User";
  let senderCode = "";
  if (raw && typeof raw === "object" && "_id" in raw) {
    const u = raw as { _id: Types.ObjectId; name?: string; splitCode?: string };
    senderIdStr = u._id.toString();
    senderName = u.name ?? "User";
    senderCode = u.splitCode ?? "";
  } else {
    senderIdStr = String(raw ?? "");
  }

  return {
    id: String(m._id),
    projectId: String(m.projectId),
    senderId: senderIdStr,
    sender: { name: senderName, splitCode: senderCode },
    content: m.content as string,
    type: m.type as string,
    fileUrl: m.fileUrl as string | undefined,
    fileName: m.fileName as string | undefined,
    fileMimeType: m.fileMimeType as string | undefined,
    createdAt:
      m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date(m.createdAt as string).toISOString(),
    read: (m.read as Types.ObjectId[])?.map((id) => id.toString()) ?? [],
  };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();

    const { project, error, status } = await requireProjectMember(params.id, session.user.id);
    if (!project || error) {
      return NextResponse.json({ error: error ?? "Not found" }, { status: status ?? 404 });
    }

    const url = new URL(request.url);
    const afterRaw = url.searchParams.get("after");
    const beforeRaw = url.searchParams.get("before");

    const pid = new Types.ObjectId(params.id);

    if (afterRaw) {
      const after = new Date(afterRaw);
      if (Number.isNaN(after.getTime())) {
        return NextResponse.json({ error: "Invalid after date" }, { status: 400 });
      }
      const rows = await Message.find({ projectId: pid, createdAt: { $gt: after } })
        .sort({ createdAt: 1 })
        .limit(100)
        .populate("senderId", "name splitCode")
        .lean();
      const data = rows.map((row) => serializeMessage(row as unknown as Record<string, unknown>));
      return NextResponse.json({ data });
    }

    if (beforeRaw) {
      const before = new Date(beforeRaw);
      if (Number.isNaN(before.getTime())) {
        return NextResponse.json({ error: "Invalid before date" }, { status: 400 });
      }
      const rows = await Message.find({ projectId: pid, createdAt: { $lt: before } })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("senderId", "name splitCode")
        .lean();
      const chronological = rows.reverse();
      const data = chronological.map((row) => serializeMessage(row as unknown as Record<string, unknown>));
      return NextResponse.json({ data });
    }

    const rows = await Message.find({ projectId: pid })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("senderId", "name splitCode")
      .lean();
    const chronological = rows.reverse();
    const data = chronological.map((row) => serializeMessage(row as unknown as Record<string, unknown>));
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();

    const { project, error, status } = await requireProjectMember(params.id, session.user.id);
    if (!project || error) {
      return NextResponse.json({ error: error ?? "Not found" }, { status: status ?? 404 });
    }

    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const t = parsed.data.type ?? "text";
    let content = parsed.data.content.trim();
    if (t === "text" && content.length < 1) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }
    if ((t === "image" || t === "voice") && !parsed.data.fileUrl?.trim()) {
      return NextResponse.json({ error: "Attachment required" }, { status: 400 });
    }
    if (t === "image" && !content) content = "Photo";
    if (t === "voice" && !content) content = "Voice message";

    const doc = await Message.create({
      projectId: params.id,
      senderId: session.user.id,
      content,
      type: t,
      fileUrl: parsed.data.fileUrl?.trim(),
      fileName: parsed.data.fileName?.trim(),
      fileMimeType: parsed.data.fileMimeType?.trim(),
      read: [],
    });

    const populated = await Message.findById(doc._id).populate("senderId", "name splitCode").lean();
    if (!populated) {
      return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
    }

    return NextResponse.json(
      { data: serializeMessage(populated as unknown as Record<string, unknown>) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
