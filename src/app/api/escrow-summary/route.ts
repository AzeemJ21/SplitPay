import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { CACHE_CONTROL_LIST } from "@/lib/api-cache-headers";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";
import Project from "@/models/Project";

/** Aggregates escrow held on milestones for projects the user participates in. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;

    const projects = await Project.find({
      $or: [{ clientId: userId }, { freelancerId: userId }],
    })
      .select("_id")
      .lean();
    const projectIds = projects.map((p) => p._id);
    if (!projectIds.length) {
      return NextResponse.json(
        {
          data: { totalEscrow: 0, currency: "USD" },
        },
        { headers: { "Cache-Control": CACHE_CONTROL_LIST } },
      );
    }

    const milestones = await Milestone.find({
      projectId: { $in: projectIds },
      status: { $in: ["funded", "in_progress", "submitted", "approved"] },
    })
      .select("escrowAmount")
      .lean();

    const totalEscrow = milestones.reduce((sum, m) => sum + (m.escrowAmount ?? 0), 0);

    return NextResponse.json(
      {
        data: {
          totalEscrow,
          currency: "USD",
        },
      },
      { headers: { "Cache-Control": CACHE_CONTROL_LIST } },
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
