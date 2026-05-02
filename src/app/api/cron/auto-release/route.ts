import { NextResponse } from "next/server";
import Milestone from "@/models/Milestone";
import { connectDB } from "@/lib/mongoose";
import { tryReleaseEscrowForMilestone } from "@/lib/milestone-escrow";

/**
 * GET — cron or manual test. Optionally protect with CRON_SECRET.
 */
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get("authorization");
      if (auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    await connectDB();
    const now = new Date();

    const due = await Milestone.find({
      status: "submitted",
      autoReleaseAt: { $lte: now },
    })
      .select("_id")
      .lean();

    let released = 0;
    for (const row of due) {
      const ok = await tryReleaseEscrowForMilestone(row._id.toString());
      if (ok) released += 1;
    }

    return NextResponse.json({ released });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
