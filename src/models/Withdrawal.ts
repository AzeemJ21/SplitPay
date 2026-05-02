import mongoose, { Document, Model, Schema, Types } from "mongoose";

/** FYP prototype — simulated payouts only; no real money movement. */
export type WithdrawalMethod = "paypal" | "stripe" | "bank_transfer";
export type WithdrawalStatus = "pending" | "completed" | "failed";

export interface IWithdrawal extends Document {
  userId: Types.ObjectId;
  amount: number;
  method: WithdrawalMethod;
  status: WithdrawalStatus;
  paypalEmail?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  stripeAccountId?: string;
  processedAt?: Date;
  failureReason?: string;
  transactionRef: string;
  createdAt: Date;
}

const WithdrawalSchema = new Schema<IWithdrawal>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  method: {
    type: String,
    enum: ["paypal", "stripe", "bank_transfer"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  paypalEmail: { type: String },
  bankName: { type: String },
  accountNumber: { type: String },
  accountName: { type: String },
  stripeAccountId: { type: String },
  processedAt: { type: Date },
  failureReason: { type: String },
  transactionRef: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

WithdrawalSchema.index({ userId: 1, createdAt: -1 });

const Withdrawal: Model<IWithdrawal> =
  mongoose.models.Withdrawal || mongoose.model<IWithdrawal>("Withdrawal", WithdrawalSchema);
export default Withdrawal;
