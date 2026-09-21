import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  avatar?: string | null;
  isActive: boolean;
  googleId?: string;
  authProvider?: 'local' | 'google';
  otpCode?: string;
  otpExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    avatar: { type: String, default: null },
    isActive: { type: Boolean, default: false },
    googleId: { type: String, sparse: true },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    otpCode: { type: String },
    otpExpiresAt: { type: Date },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', userSchema);
