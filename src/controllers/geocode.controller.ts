import { Request, Response } from 'express';
import { z } from 'zod';
import * as geocodeService from '../services/geocode.service';
import { asyncHandler } from '../utils/asyncHandler';

const reverseGeocodeSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const getReverseGeocode = asyncHandler(async (req: Request, res: Response) => {
  const params = reverseGeocodeSchema.parse(req.query);
  const result = await geocodeService.reverseGeocode(params.lat, params.lng);

  if (!result) {
    res.status(404).json({ message: 'No place found for these coordinates' });
    return;
  }

  res.json({ data: result });
});
