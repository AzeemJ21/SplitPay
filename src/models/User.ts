import mongoose, { Document, Model, Schema } from "mongoose";

export interface INotificationPrefs {
  emailProjectAssignment: boolean;
  emailMilestoneFunded: boolean;
  emailWorkSubmitted: boolean;
  emailPaymentReleased: boolean;
  emailPaymentFailed: boolean;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  splitCode: string;
  roles: string[];
  virtualCardBalance: number;
  /** External integration key (Bearer); optional until generated */
  apiKey?: string;
  apiUsageBillingMonth?: string;
  apiCallsThisMonth: number;
  apiUsageLimit: number;
  avatarUrl?: string;
  notificationPrefs?: INotificationPrefs;
  splitCodeChangedAt?: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  splitCode: { type: String, required: true, unique: true, minlength: 4, maxlength: 4 },
  roles: {
    type: [String],
    default: ["user"],
  },
  virtualCardBalance: { type: Number, default: 0 },
  apiKey: { type: String, unique: true, sparse: true },
  apiUsageBillingMonth: { type: String },
  apiCallsThisMonth: { type: Number, default: 0 },
  apiUsageLimit: { type: Number, default: 10000 },
  avatarUrl: { type: String },
  notificationPrefs: {
    emailProjectAssignment: { type: Boolean, default: true },
    emailMilestoneFunded: { type: Boolean, default: true },
    emailWorkSubmitted: { type: Boolean, default: true },
    emailPaymentReleased: { type: Boolean, default: true },
    emailPaymentFailed: { type: Boolean, default: true },
  },
  splitCodeChangedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export default User;
