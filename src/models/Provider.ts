import { Schema, model, Document } from 'mongoose';

export interface IProvider extends Document {
  name: string;
  slug: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const providerSchema = new Schema<IProvider>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Provider = model<IProvider>('Provider', providerSchema);
