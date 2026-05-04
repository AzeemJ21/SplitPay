import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";
import Project from "@/models/Project";
import { releaseEscrowForMilestone } from "@/lib/milestone-escrow";

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

    let instant = false;
    try {
      const raw = (await request.json()) as { instant?: unknown };
      if (raw && typeof raw === "object" && "instant" in raw) {
        instant = Boolean(raw.instant);
      }
    } catch {
      /* empty or non-JSON body */
    }

    const milestone = await Milestone.findById(params.id).lean();
    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const project = await Project.findOne({ _id: milestone.projectId, clientId: userId }).lean();
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const st = milestone.status as string;
    if (instant) {
      if (!["funded", "in_progress", "submitted"].includes(st)) {
        return NextResponse.json(
          { error: "Instant release is only available while escrow is funded, in progress, or submitted." },
          { status: 400 },
        );
      }
    } else if (st !== "submitted") {
      return NextResponse.json({ error: "Milestone is not awaiting approval." }, { status: 400 });
    }

    try {
      const released = await releaseEscrowForMilestone(params.id, { instant });
      return NextResponse.json({
        data: {
          ...released,
          id: released._id.toString(),
          dueDate:
            released.dueDate instanceof Date ? released.dueDate.toISOString() : released.dueDate,
          autoReleaseAt:
            released.autoReleaseAt instanceof Date
              ? released.autoReleaseAt.toISOString()
              : released.autoReleaseAt,
        },
      });
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      if (code === "invalid_status" || code === "nothing_to_release") {
        return NextResponse.json({ error: "Cannot release this milestone." }, { status: 400 });
      }
      return NextResponse.json({ error: "Release failed" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
