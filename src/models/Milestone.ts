import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type MilestoneStatus =
  | "pending"
  | "funded"
  | "in_progress"
  | "submitted"
  | "approved"
  | "released";

export interface IMilestone extends Document {
  projectId: Types.ObjectId;
  title: string;
  amount: number;
  dueDate?: Date;
  status: MilestoneStatus;
  escrowAmount: number;
  deliveryNotes: string;
  fundedAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  releasedAt?: Date;
  autoReleaseAt?: Date;
}

const MilestoneSchema = new Schema<IMilestone>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date },
  status: {
    type: String,
    enum: ["pending", "funded", "in_progress", "submitted", "approved", "released"],
    default: "pending",
  },
  escrowAmount: { type: Number, default: 0 },
  deliveryNotes: { type: String, default: "" },
  fundedAt: { type: Date },
  submittedAt: { type: Date },
  approvedAt: { type: Date },
  releasedAt: { type: Date },
  autoReleaseAt: { type: Date },
});

const Milestone: Model<IMilestone> =
  mongoose.models.Milestone || mongoose.model<IMilestone>("Milestone", MilestoneSchema);
export default Milestone;
