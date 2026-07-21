import { Types } from 'mongoose';
import { LocationStatus } from '../constants';
import { Location, Report } from '../models';

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
