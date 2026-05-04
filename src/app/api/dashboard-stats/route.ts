import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";

export const dynamic = "force-dynamic";
import { CACHE_CONTROL_PRIVATE_NO_STORE } from "@/lib/api-cache-headers";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import { ensureVirtualCardForUser } from "@/lib/virtual-card-utils";
import Milestone from "@/models/Milestone";
import Project from "@/models/Project";
import Transaction from "@/models/Transaction";
import VirtualCard from "@/models/VirtualCard";

/** Single round-trip for dashboard home stat cards (avoids stale CDN caches per-route). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const uid = session.user.id;
    const userOid = new Types.ObjectId(uid);

    const projectFilter = { $or: [{ clientId: uid }, { freelancerId: uid }] };
    /** New projects start as `pending` until work begins — count open work, not only enum `active`. */
    const openProjectsFilter = {
      ...projectFilter,
      status: { $in: ["pending", "active"] as const },
    };

    const [activeProjects, projectsForEscrow] = await Promise.all([
      Project.countDocuments(openProjectsFilter),
      Project.find(projectFilter).select("_id").lean(),
    ]);
    const projectIds = projectsForEscrow.map((p) => p._id);

    const [escrowMilestones, pendingMsCount, txVolume, splitPaySum, vc] = await Promise.all([
      projectIds.length
        ? Milestone.find({
            projectId: { $in: projectIds },
            status: { $in: ["funded", "in_progress", "submitted", "approved"] },
          })
            .select("escrowAmount")
            .lean()
        : Promise.resolve([]),
      projectIds.length
        ? Milestone.countDocuments({ projectId: { $in: projectIds }, status: "pending" })
        : Promise.resolve(0),
      Transaction.aggregate<{ v: number }>([
        {
          $match: {
            status: "completed",
            $or: [{ userId: userOid }, { userId: uid }],
          },
        },
        { $group: { _id: null, v: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate<{ v: number }>([
        {
          $match: {
            status: "completed",
            type: "split_payment",
            $or: [{ userId: userOid }, { userId: uid }],
          },
        },
        { $group: { _id: null, v: { $sum: "$amount" } } },
      ]),
      (async () => {
        await ensureVirtualCardForUser(uid);
        const oid = Types.ObjectId.isValid(uid) ? new Types.ObjectId(uid) : null;
        const q =
          oid != null ? { $or: [{ userId: uid }, { userId: oid }] } : { userId: uid };
        return VirtualCard.findOne(q).select("balance").lean();
      })(),
    ]);

    const totalEscrow = escrowMilestones.reduce((s, m) => s + (m.escrowAmount ?? 0), 0);
    const totalVolume = txVolume[0]?.v ?? 0;
    const fundedSplitPayVolume = splitPaySum[0]?.v ?? 0;

    return NextResponse.json(
      {
        data: {
          activeProjects,
          escrowTotal: totalEscrow,
          pendingMilestones: pendingMsCount,
          totalTransacted: totalVolume,
          walletBalance: vc?.balance ?? 0,
          fundedSplitPayVolume,
          currency: "USD",
        },
      },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
    );
  } catch (e) {
    console.error("[dashboard-stats]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
