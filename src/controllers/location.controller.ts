import { Request, Response } from 'express';
import { z } from 'zod';
import { LOCATION_TYPE_CODES } from '../constants';
import * as locationService from '../services/location.service';
import { asyncHandler } from '../utils/asyncHandler';

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().min(0.1).max(50).default(3),
  limit: z.coerce.number().min(1).max(500).default(100),
  provider: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined)),
  type: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? (v.split(',').map((s) => s.trim()).filter(Boolean) as (typeof LOCATION_TYPE_CODES)[number][])
        : undefined
    ),
});

const bboxSchema = z.object({
  sw_lat: z.coerce.number().min(-90).max(90),
  sw_lng: z.coerce.number().min(-180).max(180),
  ne_lat: z.coerce.number().min(-90).max(90),
  ne_lng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().min(1).max(1000).default(500),
  provider: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined)),
  type: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? (v.split(',').map((s) => s.trim()).filter(Boolean) as (typeof LOCATION_TYPE_CODES)[number][])
        : undefined
    ),
});

export const getNearby = asyncHandler(async (req: Request, res: Response) => {
  const params = nearbySchema.parse(req.query);

  const result = await locationService.findNearby({
    lat: params.lat,
    lng: params.lng,
    radiusKm: params.radius_km,
    limit: params.limit,
    providerSlugs: params.provider,
    typeCodes: params.type,
  });

  res.json(result);
});

export const getInBbox = asyncHandler(async (req: Request, res: Response) => {
  const params = bboxSchema.parse(req.query);

  const result = await locationService.findInBbox({
    swLat: params.sw_lat,
    swLng: params.sw_lng,
    neLat: params.ne_lat,
    neLng: params.ne_lng,
    limit: params.limit,
    providerSlugs: params.provider,
    typeCodes: params.type,
  });

  res.json(result);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const location = await locationService.findById(String(req.params.id));

  if (!location) {
    res.status(404).json({ message: 'Location not found' });
    return;
  }

  res.json({ data: location });
});

export const listProviders = asyncHandler(async (_req: Request, res: Response) => {
  const data = await locationService.listProviders();
  res.json({ count: data.length, data });
});

export const listLocationTypes = asyncHandler(async (_req: Request, res: Response) => {
  const data = await locationService.listLocationTypes();
  res.json({ count: data.length, data });
});

export const listCities = asyncHandler(async (_req: Request, res: Response) => {
  const data = await locationService.listCities();
  res.json({ count: data.length, data });
});
