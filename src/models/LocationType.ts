import { Schema, model, Document } from 'mongoose';
import { LOCATION_TYPE_CODES } from '../constants';

export interface ILocationType extends Document {
  code: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

const locationTypeSchema = new Schema<ILocationType>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      enum: LOCATION_TYPE_CODES,
    },
    label: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const LocationType = model<ILocationType>('LocationType', locationTypeSchema);
