import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Dispute from "@/models/Dispute";
import Project from "@/models/Project";

const MAX_BYTES = 1_500_000;

async function assertMember(projectId: Types.ObjectId, userId: string) {
  return Project.findOne({
    _id: projectId,
    $or: [{ clientId: userId }, { freelancerId: userId }],
  }).lean();
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await connectDB();
    const userId = session.user.id;

    const dispute = await Dispute.findById(params.id).lean();
    if (!dispute) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const project = await assertMember(dispute.projectId as Types.ObjectId, userId);
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Expected file field" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max ~1.5MB)" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type && file.type.length > 0 ? file.type : "application/octet-stream";
    const b64 = buf.toString("base64");
    const dataUrl = `data:${mime};base64,${b64}`;

    const item = { url: dataUrl, name: file.name || "file", type: mime };

    const updated = await Dispute.findByIdAndUpdate(
      params.id,
      { $push: { evidence: item } },
      { new: true },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        evidence: updated.evidence,
        added: item,
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
