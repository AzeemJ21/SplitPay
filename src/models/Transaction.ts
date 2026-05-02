import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const TRANSACTION_TYPES = [
  "split_payment",
  "escrow_funding",
  "escrow_release",
  "merchant_payout",
  "refund",
  "failed_payment",
  /** FYP: simulated virtual-card withdrawal — not real banking */
  "withdrawal",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  splitCode: string;
  amount: number;
  card1Amount: number;
  card2Amount: number;
  type: TransactionType;
  status: "pending" | "completed" | "failed";
  transactionId?: string;
  date: Date;
  merchantId?: string;
  note?: string;
  /** Links to Withdrawal.transactionRef (e.g. WDR-...) — FYP prototype */
  transactionRef?: string;
}

const TransactionSchema = new Schema<ITransaction>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  splitCode: { type: String, required: true },
  amount: { type: Number, required: true },
  card1Amount: { type: Number, default: 0 },
  card2Amount: { type: Number, default: 0 },
  type: {
    type: String,
    enum: [...TRANSACTION_TYPES],
    required: true,
  },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
  transactionId: { type: String, unique: true, sparse: true },
  date: { type: Date, default: Date.now },
  merchantId: { type: String },
  note: { type: String },
  transactionRef: { type: String, sparse: true, index: true },
});

TransactionSchema.pre("save", function () {
  if (!this.transactionId) {
    this.transactionId =
      "TXN-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }
});

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction || mongoose.model<ITransaction>("Transaction", TransactionSchema);
export default Transaction;
