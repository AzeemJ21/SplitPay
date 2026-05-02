import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";

const MAX_BYTES = 5 * 1024 * 1024;

async function requireProjectMember(projectId: string, userId: string) {
  if (!Types.ObjectId.isValid(projectId)) {
    return null;
  }
  return Project.findOne({
    _id: projectId,
    $or: [{ clientId: userId }, { freelancerId: userId }],
  })
    .select("_id")
    .lean();
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();

    const project = await requireProjectMember(params.id, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Expected file field" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mime = file.type && file.type.length > 0 ? file.type : "application/octet-stream";
    const dataUrl = `data:${mime};base64,${base64}`;

    return NextResponse.json({
      url: dataUrl,
      name: file.name || "attachment",
      mimeType: mime,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
