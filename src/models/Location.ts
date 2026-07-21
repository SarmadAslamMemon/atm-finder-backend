import { Schema, model, Document, Types } from 'mongoose';
import { LOCATION_STATUS, LocationStatus } from '../constants';

export interface ILocationAmenities {
  atm?: boolean;
  islamic?: boolean;
  locker?: boolean;
  conventional?: boolean;
  cdm?: boolean;
  biometric?: boolean;
  [key: string]: boolean | undefined;
}

export interface ILocation extends Document {
  providerId: Types.ObjectId;
  cityId: Types.ObjectId;
  locationTypeId: Types.ObjectId;
  externalId: string;
  name: string;
  address: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  lat: number;
  lng: number;
  phone?: string;
  amenities?: ILocationAmenities;
  isActive: boolean;
  isVerified: boolean;
  status: LocationStatus;
  lastReportedAt?: Date;
  rawData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<ILocation>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'City', required: true, index: true },
    locationTypeId: { type: Schema.Types.ObjectId, ref: 'LocationType', required: true, index: true },
    externalId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    phone: { type: String, trim: true },
    amenities: { type: Schema.Types.Mixed },
    isActive: { type: Boolean, default: true, index: true },
    isVerified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: LOCATION_STATUS,
      default: 'unknown',
    },
    lastReportedAt: { type: Date },
    rawData: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

locationSchema.index({ location: '2dsphere' });
locationSchema.index({ providerId: 1, externalId: 1 }, { unique: true });
locationSchema.index({ isActive: 1, providerId: 1, locationTypeId: 1 });

locationSchema.pre('validate', function () {
  if (this.lat != null && this.lng != null) {
    this.location = {
      type: 'Point',
      coordinates: [this.lng, this.lat],
    };
  }
});

export const Location = model<ILocation>('Location', locationSchema);
