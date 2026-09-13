import { Types } from 'mongoose';
import { LocationStatus } from '../constants';
import { Location, Report } from '../models';
import { calculateDistanceKm } from '../utils';

const REPORTABLE_STATUS: LocationStatus[] = ['cash_available', 'no_cash', 'offline'];

export class ReportError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function submitReport(input: {
  userId: string;
  locationId: string;
  status: LocationStatus;
  note?: string;
}) {
  if (!Types.ObjectId.isValid(input.locationId)) {
    throw new ReportError('Invalid location id', 400);
  }

  if (!REPORTABLE_STATUS.includes(input.status)) {
    throw new ReportError('Invalid report status', 400);
  }

  const location = await Location.findOne({ _id: input.locationId, isActive: true });
  if (!location) {
    throw new ReportError('Location not found', 404);
  }

  const report = await Report.create({
    userId: input.userId,
    locationId: input.locationId,
    status: input.status,
    note: input.note?.trim(),
  });

  location.status = input.status;
  location.lastReportedAt = new Date();
  await location.save();

  const reportCount = await Report.countDocuments({ locationId: input.locationId });

  return {
    success: true,
    message: 'Report submitted',
    data: {
      id: String(report._id),
      locationId: input.locationId,
      status: report.status,
      note: report.note,
      createdAt: report.createdAt,
      reportCount,
    },
  };
}

export async function getLocationReportCount(locationId: string): Promise<number> {
  if (!Types.ObjectId.isValid(locationId)) return 0;
  return Report.countDocuments({ locationId });
}

export async function submitAtmReport(input: {
  userId?: string;
  locationId: string;
  status: LocationStatus;
  latitude: number;
  longitude: number;
  note?: string;
}) {
  if (!Types.ObjectId.isValid(input.locationId)) {
    throw new ReportError('Invalid ATM id', 400);
  }

  const location = await Location.findOne({ _id: input.locationId, isActive: true });
  if (!location) {
    throw new ReportError('ATM not found', 404);
  }

  // 1. Distance verification
  const distanceKm = calculateDistanceKm(
    input.latitude,
    input.longitude,
    location.lat,
    location.lng
  );
  const distanceMeters = distanceKm * 1000;
  if (distanceMeters > 500) {
    throw new ReportError(
      `Verification failed: You must be within 500 meters of the ATM to submit a report (current distance: ${Math.round(distanceMeters)}m)`,
      400
    );
  }

  // 2. Create the report
  const report = await Report.create({
    userId: input.userId ? new Types.ObjectId(input.userId) : undefined,
    locationId: input.locationId,
    status: input.status,
    note: input.note?.trim(),
  });

  // 3. Update the ATM status
  location.status = input.status;
  location.lastReportedAt = new Date();
  await location.save();

  // 4. Calculate total report count
  const totalReportCount = await Report.countDocuments({ locationId: input.locationId });

  // 5. Calculate confidence score based on recent reports in the last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentReports = await Report.find({
    locationId: input.locationId,
    createdAt: { $gte: oneDayAgo },
  }).lean();

  const matchingCount = recentReports.filter((r) => r.status === input.status).length;
  const totalCount = recentReports.length;

  let confidenceScore = 1.0;
  if (totalCount > 0) {
    const baseRatio = matchingCount / totalCount;
    const maxConfidence = totalCount === 1 ? 0.85 : totalCount === 2 ? 0.90 : 0.95;
    confidenceScore = baseRatio * maxConfidence;
    confidenceScore = Math.round(confidenceScore * 100) / 100;
  }

  return {
    atmId: input.locationId,
    updatedStatus: input.status,
    totalReportCount,
    confidenceScore,
  };
}
