import { Schema, model, Document, Types } from 'mongoose';
import { LOCATION_STATUS, LocationStatus } from '../constants';

export interface IReport extends Document {
  userId?: Types.ObjectId;
  locationId: Types.ObjectId;
  status: LocationStatus;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    status: { type: String, enum: LOCATION_STATUS, required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

reportSchema.index({ locationId: 1, createdAt: -1 });

export const Report = model<IReport>('Report', reportSchema);
