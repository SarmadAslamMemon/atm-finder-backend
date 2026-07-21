import { Schema, model, Document, Types } from 'mongoose';

export interface IUserPreference extends Document {
  userId: Types.ObjectId;
  defaultCity?: string;
  defaultRadius: string;
  notificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userPreferenceSchema = new Schema<IUserPreference>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    defaultCity: { type: String, trim: true },
    defaultRadius: { type: String, default: '3km', trim: true },
    notificationsEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const UserPreference = model<IUserPreference>('UserPreference', userPreferenceSchema);
