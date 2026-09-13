import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { ReportError, submitReport, submitAtmReport as submitAtmReportService } from '../services/report.service';
import { asyncHandler } from '../utils/asyncHandler';

const reportSchema = z.object({
  status: z.enum(['cash_available', 'no_cash', 'offline']),
  note: z.string().max(500).optional(),
});

export const createReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const body = reportSchema.parse(req.body);
    const result = await submitReport({
      userId: req.user!.userId,
      locationId: String(req.params.id),
      status: body.status,
      note: body.note,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ReportError) {
      res.status(err.status).json({ message: err.message, success: false });
      return;
    }
    throw err;
  }
});

const atmReportRequestSchema = z.object({
  status: z.enum(['WORKING', 'NO_CASH', 'OFFLINE', 'CLOSED']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  comment: z.string().max(500).optional(),
});

const STATUS_MAP = {
  WORKING: 'cash_available',
  NO_CASH: 'no_cash',
  OFFLINE: 'offline',
  CLOSED: 'closed',
} as const;

const STATUS_REVERSE_MAP = {
  cash_available: 'WORKING',
  no_cash: 'NO_CASH',
  offline: 'OFFLINE',
  closed: 'CLOSED',
  unknown: 'UNKNOWN',
} as const;

export const submitAtmReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const body = atmReportRequestSchema.parse(req.body);
    const atmId = String(req.params.atmId);

    const dbStatus = STATUS_MAP[body.status];

    const result = await submitAtmReportService({
      userId: req.user?.userId,
      locationId: atmId,
      status: dbStatus,
      latitude: body.latitude,
      longitude: body.longitude,
      note: body.comment,
    });

    res.status(201).json({
      success: true,
      message: 'Status report submitted successfully',
      data: {
        atmId: result.atmId,
        updatedStatus: STATUS_REVERSE_MAP[result.updatedStatus as keyof typeof STATUS_REVERSE_MAP] || 'UNKNOWN',
        totalReportCount: result.totalReportCount,
        lastUpdated: 'Just now',
        confidenceScore: result.confidenceScore,
      },
    });
  } catch (err) {
    if (err instanceof ReportError) {
      res.status(err.status).json({ message: err.message, success: false });
      return;
    }
    throw err;
  }
});
