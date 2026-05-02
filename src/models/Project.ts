import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IProject extends Document {
  clientId: Types.ObjectId;
  freelancerId: Types.ObjectId;
  title: string;
  description: string;
  budget: number;
  deadline?: Date;
  status: "pending" | "active" | "completed";
  createdAt: Date;
}

const ProjectSchema = new Schema<IProject>({
  clientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  freelancerId: { type: Schema.Types.ObjectId, ref: "User" },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  budget: { type: Number, required: true },
  deadline: { type: Date },
  status: { type: String, enum: ["pending", "active", "completed"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>("Project", ProjectSchema);
export default Project;
