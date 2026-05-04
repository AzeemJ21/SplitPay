import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";
import Notification from "@/models/Notification";
import Project from "@/models/Project";
import Transaction from "@/models/Transaction";
import { ensureVirtualCardForUser } from "@/lib/virtual-card-utils";
import User from "@/models/User";
import VirtualCard from "@/models/VirtualCard";

export const ESCROW_AUTO_RELEASE_MS = 5 * 24 * 60 * 60 * 1000;

const TERMINAL = new Set(["approved", "released"]);

export async function syncProjectCompletion(projectId: Types.ObjectId | string) {
  await connectDB();
  const pid = typeof projectId === "string" ? projectId : projectId.toString();
  const milestones = await Milestone.find({ projectId: pid }).select("status").lean();
  if (!milestones.length) return;
  const allDone = milestones.every((m) => TERMINAL.has(m.status as string));
  if (allDone) {
    await Project.findByIdAndUpdate(pid, { status: "completed" });
  }
}

type LeanMilestone = {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  title: string;
  amount: number;
  escrowAmount: number;
  status: string;
  dueDate?: Date;
  autoReleaseAt?: Date;
};

export type ReleaseEscrowOptions = {
  /** Client may release while funded or in progress without waiting for work submission (demo / expedited). */
  instant?: boolean;
};

const INSTANT_RELEASE_STATUSES = new Set(["funded", "in_progress", "submitted"]);

/**
 * Releases escrow for a milestone (normally `submitted` after freelancer delivers).
 * With `{ instant: true }`, client may release from `funded`, `in_progress`, or `submitted`.
 */
export async function releaseEscrowForMilestone(
  milestoneId: string,
  options?: ReleaseEscrowOptions,
): Promise<LeanMilestone> {
  await connectDB();
  if (!Types.ObjectId.isValid(milestoneId)) {
    throw Object.assign(new Error("invalid_milestone_id"), { code: "invalid_milestone_id" });
  }

  const milestone = await Milestone.findById(milestoneId).lean();
  if (!milestone) {
    throw Object.assign(new Error("not_found"), { code: "not_found" });
  }
  const instant = options?.instant === true;
  const ok =
    milestone.status === "submitted" ||
    (instant && INSTANT_RELEASE_STATUSES.has(milestone.status as string));
  if (!ok) {
    throw Object.assign(new Error("invalid_status"), { code: "invalid_status" });
  }

  const releaseAmount = milestone.escrowAmount || milestone.amount;
  if (releaseAmount <= 0) {
    throw Object.assign(new Error("nothing_to_release"), { code: "nothing_to_release" });
  }

  const project = await Project.findById(milestone.projectId).lean();
  if (!project || !project.freelancerId) {
    throw Object.assign(new Error("project_not_found"), { code: "project_not_found" });
  }

  const freelancerId = project.freelancerId.toString();
  const freelancerOid = new Types.ObjectId(freelancerId);
  const freelancer = await User.findById(freelancerId).select("splitCode").lean();
  const splitCode = freelancer?.splitCode ?? "0000";

  await ensureVirtualCardForUser(freelancerId);
  // Match VirtualCard by string userId (same as ensureVirtualCardForUser / dashboard-stats); verify update.
  const vcUpdated = await VirtualCard.findOneAndUpdate(
    { userId: freelancerId },
    { $inc: { balance: releaseAmount } },
    { new: true },
  ).lean();
  if (!vcUpdated) {
    throw Object.assign(new Error("virtual_card_update_failed"), { code: "virtual_card_update_failed" });
  }

  const now = new Date();
  await Milestone.findByIdAndUpdate(milestone._id, {
    status: "released",
    escrowAmount: 0,
    releasedAt: now,
    approvedAt: now,
  });

  const releaseNote = instant
    ? "Instant escrow release (client). Funds credited to freelancer virtual card."
    : "Escrow milestone approved and released to freelancer virtual card balance.";

  await Transaction.create({
    userId: freelancerOid,
    splitCode,
    amount: releaseAmount,
    card1Amount: 0,
    card2Amount: 0,
    type: "escrow_release",
    status: "completed",
    date: now,
    note: releaseNote,
  });

  await Notification.create({
    userId: freelancerOid,
    type: "payment_released",
    title: "Escrow payment released",
    message: `Payment of $${releaseAmount.toLocaleString("en-US")} released for milestone '${milestone.title}'`,
    read: false,
    relatedId: milestone.projectId,
  });

  await syncProjectCompletion(milestone.projectId);

  const updated = await Milestone.findById(milestone._id).lean();
  if (!updated) {
    throw Object.assign(new Error("update_failed"), { code: "update_failed" });
  }
  return updated as LeanMilestone;
}

export async function tryReleaseEscrowForMilestone(milestoneId: string): Promise<boolean> {
  try {
    await releaseEscrowForMilestone(milestoneId, undefined);
    return true;
  } catch {
    return false;
  }
}
