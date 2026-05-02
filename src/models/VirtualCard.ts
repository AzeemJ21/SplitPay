import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IVirtualCard extends Document {
  userId: Types.ObjectId;
  balance: number;
  currency: string;
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  createdAt: Date;
}

const VirtualCardSchema = new Schema<IVirtualCard>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: "USD" },
  cardNumber: { type: String, required: true },
  expiryMonth: { type: Number, required: true },
  expiryYear: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const VirtualCard: Model<IVirtualCard> =
  mongoose.models.VirtualCard || mongoose.model<IVirtualCard>("VirtualCard", VirtualCardSchema);
export default VirtualCard;
