import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type DisputeStatus = "open" | "under_review" | "resolved";

export type ComplaintType =
  | "payment_issue"
  | "fraud"
  | "milestone_dispute"
  | "chat_abuse"
  | "other";

export interface IEvidenceItem {
  url: string;
  name: string;
  type: string;
}

export interface IScreenshotItem {
  url: string;
  name: string;
}

export interface IAttachmentItem {
  url: string;
  name: string;
  mimeType: string;
}

export interface IDispute extends Document {
  projectId: Types.ObjectId;
  raisedBy: Types.ObjectId;
  title: string;
  description: string;
  type?: ComplaintType;
  evidence: IEvidenceItem[];
  screenshots: IScreenshotItem[];
  attachments: IAttachmentItem[];
  status: DisputeStatus;
  resolution?: string;
  aiSummary?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EvidenceSchema = new Schema<IEvidenceItem>(
  {
    url: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
  },
  { _id: false },
);

const ScreenshotSchema = new Schema<IScreenshotItem>(
  {
    url: { type: String, required: true },
    name: { type: String, required: true },
  },
  { _id: false },
);

const AttachmentSchema = new Schema<IAttachmentItem>(
  {
    url: { type: String, required: true },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
  },
  { _id: false },
);

const COMPLAINT_TYPES = [
  "payment_issue",
  "fraud",
  "milestone_dispute",
  "chat_abuse",
  "other",
] as const;

const DisputeSchema = new Schema<IDispute>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: COMPLAINT_TYPES,
      default: "milestone_dispute",
      index: true,
    },
    evidence: { type: [EvidenceSchema], default: [] },
    screenshots: { type: [ScreenshotSchema], default: [] },
    attachments: { type: [AttachmentSchema], default: [] },
    status: {
      type: String,
      enum: ["open", "under_review", "resolved"],
      default: "open",
    },
    resolution: { type: String },
    aiSummary: { type: String },
  },
  { timestamps: true },
);

DisputeSchema.index({ projectId: 1, createdAt: -1 });

const Dispute: Model<IDispute> =
  mongoose.models.Dispute || mongoose.model<IDispute>("Dispute", DisputeSchema);
export default Dispute;
