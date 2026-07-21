import { Types } from 'mongoose';
import { LocationTypeCode } from '../../constants';
import { City, ICity, ILocation, ILocationAmenities, Location, LocationType, Provider } from '../../models';

export interface ScraperContext {
  providers: Map<string, Types.ObjectId>;
  locationTypes: Map<LocationTypeCode, Types.ObjectId>;
  cityCache: Map<string, Types.ObjectId>;
}

export interface LocationUpsertInput {
  providerSlug: string;
  cityName: string;
  locationTypeCode: LocationTypeCode;
  externalId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  amenities?: ILocationAmenities;
  isVerified?: boolean;
  rawData?: Record<string, unknown>;
}

export interface UpsertStats {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
}

function cityCacheKey(name: string): string {
  return name.trim().toLowerCase();
}

export async function createScraperContext(): Promise<ScraperContext> {
  const providerDocs = await Provider.find();
  const typeDocs = await LocationType.find();

  const providers = new Map(providerDocs.map((p) => [p.slug, p._id]));
  const locationTypes = new Map(
    typeDocs.map((t) => [t.code as LocationTypeCode, t._id])
  );

  return { providers, locationTypes, cityCache: new Map() };
}

export async function resolveCityId(
  ctx: ScraperContext,
  cityName: string
): Promise<Types.ObjectId> {
  const key = cityCacheKey(cityName);
  const cached = ctx.cityCache.get(key);
  if (cached) return cached;

  let city: ICity | null = await City.findOne({
    name: new RegExp(`^${escapeRegex(cityName.trim())}$`, 'i'),
    country: 'Pakistan',
  });

  if (!city) {
    city = await City.create({
      name: cityName.trim(),
      country: 'Pakistan',
    });
  }

  ctx.cityCache.set(key, city._id);
  return city._id;
}

export async function upsertLocation(
  ctx: ScraperContext,
  input: LocationUpsertInput
): Promise<'inserted' | 'updated' | 'skipped'> {
  const providerId = ctx.providers.get(input.providerSlug);
  const locationTypeId = ctx.locationTypes.get(input.locationTypeCode);

  if (!providerId || !locationTypeId) {
    throw new Error(`Missing provider or location type for ${input.providerSlug}/${input.locationTypeCode}`);
  }

  if (!isValidCoordinate(input.lat, input.lng)) {
    return 'skipped';
  }

  const cityId = await resolveCityId(ctx, input.cityName);

  const update: Partial<ILocation> = {
    providerId,
    cityId,
    locationTypeId,
    externalId: String(input.externalId),
    name: input.name.trim(),
    address: input.address.trim(),
    lat: input.lat,
    lng: input.lng,
    location: { type: 'Point', coordinates: [input.lng, input.lat] },
    phone: input.phone,
    amenities: input.amenities,
    isActive: true,
    isVerified: input.isVerified ?? true,
    rawData: input.rawData,
  };

  const existing = await Location.findOne({
    providerId,
    externalId: String(input.externalId),
  }).select('_id');

  await Location.findOneAndUpdate(
    { providerId, externalId: String(input.externalId) },
    { $set: update },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );

  return existing ? 'updated' : 'inserted';
}

export function createStats(): UpsertStats {
  return { inserted: 0, updated: 0, skipped: 0, failed: 0 };
}

export function recordUpsert(stats: UpsertStats, result: 'inserted' | 'updated' | 'skipped'): void {
  stats[result] += 1;
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
