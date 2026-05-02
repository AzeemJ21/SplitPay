import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type MessageType = "text" | "image" | "file" | "voice";

export interface IMessage extends Document {
  projectId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  type: MessageType;
  fileUrl?: string;
  fileName?: string;
  fileMimeType?: string;
  createdAt: Date;
  read: Types.ObjectId[];
}

const MessageSchema = new Schema<IMessage>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true, maxlength: 2000 },
  type: { type: String, enum: ["text", "image", "file", "voice"], default: "text" },
  fileUrl: { type: String },
  fileName: { type: String },
  fileMimeType: { type: String },
  createdAt: { type: Date, default: Date.now },
  read: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

MessageSchema.index({ projectId: 1, createdAt: -1 });

const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
export default Message;
