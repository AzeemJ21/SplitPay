import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const NOTIFICATION_TYPES = [
  "project_assigned",
  "milestone_funded",
  "work_submitted",
  "payment_released",
  "payment_failed",
  "refund_initiated",
  "dispute_opened",
  "auto_release",
  /** FYP: simulated withdrawal lifecycle */
  "withdrawal_submitted",
  "withdrawal_completed",
  "withdrawal_failed",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  relatedId?: Types.ObjectId;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: [...NOTIFICATION_TYPES], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  relatedId: { type: Schema.Types.ObjectId },
});

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
export default Notification;
