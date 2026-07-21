import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { ReportError, submitReport } from '../services/report.service';
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
