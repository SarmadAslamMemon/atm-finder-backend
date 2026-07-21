import { Types } from 'mongoose';
import { SavedLocation } from '../models';
import { findById, findByIds } from './location.service';

export class SavedLocationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function listSavedLocations(userId: string) {
  const saved = await SavedLocation.find({ userId }).sort({ createdAt: -1 }).lean();
  if (!saved.length) return { count: 0, data: [] };

  const ids = saved.map((item) => String(item.locationId));
  const locations = await findByIds(ids);
  const locationMap = Object.fromEntries(locations.map((location) => [location.id, location]));

  const data = saved
    .map((item) => {
      const location = locationMap[String(item.locationId)];
      if (!location) return null;
      return { savedAt: item.createdAt, location };
    })
    .filter(Boolean);

  return { count: data.length, data };
}

export async function addSavedLocation(userId: string, locationId: string) {
  if (!Types.ObjectId.isValid(locationId)) {
    throw new SavedLocationError('Invalid location id', 400);
  }

  const location = await findById(locationId);
  if (!location) {
    throw new SavedLocationError('Location not found', 404);
  }

  await SavedLocation.findOneAndUpdate(
    { userId, locationId },
    { userId, locationId },
    { upsert: true, new: true }
  );

  return { success: true, locationId };
}

export async function removeSavedLocation(userId: string, locationId: string) {
  if (!Types.ObjectId.isValid(locationId)) {
    throw new SavedLocationError('Invalid location id', 400);
  }

  const removed = await SavedLocation.findOneAndDelete({ userId, locationId });
  if (!removed) {
    throw new SavedLocationError('Saved location not found', 404);
  }

  return { success: true, locationId };
}

export async function listSavedLocationIds(userId: string): Promise<string[]> {
  const saved = await SavedLocation.find({ userId }).select('locationId').lean();
  return saved.map((item) => String(item.locationId));
}
