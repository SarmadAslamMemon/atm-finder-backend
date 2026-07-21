import { Schema, model, Document } from 'mongoose';

export interface ICity extends Document {
  name: string;
  region?: string;
  country: string;
  centerLat?: number;
  centerLng?: number;
  createdAt: Date;
  updatedAt: Date;
}

const citySchema = new Schema<ICity>(
  {
    name: { type: String, required: true, trim: true },
    region: { type: String, trim: true },
    country: { type: String, required: true, default: 'Pakistan', trim: true },
    centerLat: { type: Number },
    centerLng: { type: Number },
  },
  { timestamps: true }
);

citySchema.index({ name: 1, country: 1 }, { unique: true });

export const City = model<ICity>('City', citySchema);
