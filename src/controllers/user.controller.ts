import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import {
  addSavedLocation,
  listSavedLocationIds,
  listSavedLocations,
  removeSavedLocation,
  SavedLocationError,
} from '../services/savedLocation.service';
import { getUserPreferences, updateUserPreferences } from '../services/userPreference.service';
import { asyncHandler } from '../utils/asyncHandler';

export const getSavedLocations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await listSavedLocations(req.user!.userId);
  res.json(result);
});

export const getSavedLocationIds = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids = await listSavedLocationIds(req.user!.userId);
  res.json({ count: ids.length, data: ids });
});

export const saveLocation = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const result = await addSavedLocation(req.user!.userId, String(req.params.locationId));
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof SavedLocationError) {
      res.status(err.status).json({ message: err.message, success: false });
      return;
    }
    throw err;
  }
});

export const unsaveLocation = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const result = await removeSavedLocation(req.user!.userId, String(req.params.locationId));
    res.json(result);
  } catch (err) {
    if (err instanceof SavedLocationError) {
      res.status(err.status).json({ message: err.message, success: false });
      return;
    }
    throw err;
  }
});

export const getPreferences = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await getUserPreferences(req.user!.userId);
  res.json({ data });
});

const preferencesSchema = z.object({
  defaultCity: z.string().trim().nullable().optional(),
  defaultRadius: z.string().trim().optional(),
  notificationsEnabled: z.boolean().optional(),
});

export const updatePreferences = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = preferencesSchema.parse(req.body);
  const data = await updateUserPreferences(req.user!.userId, body);
  res.json({ data });
});
