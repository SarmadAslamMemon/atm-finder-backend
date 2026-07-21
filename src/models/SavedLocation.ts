import { Schema, model, Document, Types } from 'mongoose';

export interface ISavedLocation extends Document {
  userId: Types.ObjectId;
  locationId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const savedLocationSchema = new Schema<ISavedLocation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
  },
  { timestamps: true }
);

savedLocationSchema.index({ userId: 1, locationId: 1 }, { unique: true });

export const SavedLocation = model<ISavedLocation>('SavedLocation', savedLocationSchema);
