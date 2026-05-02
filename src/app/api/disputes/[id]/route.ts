import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { AI_AGENT_RESPONSE_DELAY_MS } from "@/lib/constants";
import { CACHE_CONTROL_LIST } from "@/lib/api-cache-headers";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Dispute from "@/models/Dispute";
import Project from "@/models/Project";

async function canViewDispute(userId: string, projectId: Types.ObjectId) {
  const p = await Project.findOne({
    _id: projectId,
    $or: [{ clientId: userId }, { freelancerId: userId }],
  })
    .select("title")
    .lean();
  return p;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
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
    const doc = await Dispute.findById(params.id)
      .populate("raisedBy", "name splitCode")
      .lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const project = await canViewDispute(userId, doc.projectId as Types.ObjectId);
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const raised = doc.raisedBy as unknown;
    let raisedByName = "";
    let raisedBySplit = "";
    let raisedById = "";
    if (raised && typeof raised === "object" && "_id" in raised) {
      const r = raised as { _id: Types.ObjectId; name?: string; splitCode?: string };
      raisedById = r._id.toString();
      raisedByName = String(r.name ?? "");
      raisedBySplit = String(r.splitCode ?? "");
    } else {
      raisedById = String(doc.raisedBy);
    }

    const createdAt = doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt);
    const aiUnlockAt = new Date(createdAt.getTime() + AI_AGENT_RESPONSE_DELAY_MS);

    return NextResponse.json(
      {
        data: {
          id: doc._id.toString(),
          projectId: doc.projectId.toString(),
          projectTitle: project.title,
          raisedById,
          raisedByName,
          raisedBySplitCode: raisedBySplit,
          title: doc.title,
          description: doc.description,
          type: doc.type ?? "milestone_dispute",
          evidence: doc.evidence ?? [],
          screenshots: doc.screenshots ?? [],
          attachments: doc.attachments ?? [],
          status: doc.status,
          resolution: doc.resolution,
          aiSummary: doc.aiSummary,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
          aiUnlockAt: aiUnlockAt.toISOString(),
          aiAgentReady: Date.now() >= aiUnlockAt.getTime(),
        },
      },
      { headers: { "Cache-Control": CACHE_CONTROL_LIST } },
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
