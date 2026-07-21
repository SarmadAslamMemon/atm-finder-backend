import { Types } from 'mongoose';
import { LocationTypeCode } from '../constants';
import { City, Location, LocationType, Provider, Report } from '../models';

export interface NearbyQuery {
  lat: number;
  lng: number;
  radiusKm: number;
  limit: number;
  providerSlugs?: string[];
  typeCodes?: LocationTypeCode[];
}

export interface BboxQuery {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
  limit: number;
  providerSlugs?: string[];
  typeCodes?: LocationTypeCode[];
}

async function resolveProviderIds(slugs?: string[]): Promise<Types.ObjectId[] | undefined> {
  if (!slugs?.length) return undefined;
  const providers = await Provider.find({ slug: { $in: slugs } }).select('_id');
  return providers.map((p) => p._id);
}

async function resolveTypeIds(codes?: LocationTypeCode[]): Promise<Types.ObjectId[] | undefined> {
  if (!codes?.length) return undefined;
  const types = await LocationType.find({ code: { $in: codes } }).select('_id');
  return types.map((t) => t._id);
}

async function buildMatchFilter(providerSlugs?: string[], typeCodes?: LocationTypeCode[]) {
  const filter: Record<string, unknown> = { isActive: true };

  if (providerSlugs?.length) {
    const providerIds = await resolveProviderIds(providerSlugs);
    if (!providerIds?.length) return null;
    filter.providerId = { $in: providerIds };
  }

  if (typeCodes?.length) {
    const typeIds = await resolveTypeIds(typeCodes);
    if (!typeIds?.length) return null;
    filter.locationTypeId = { $in: typeIds };
  }

  return filter;
}

const locationListProjection = {
  name: 1,
  address: 1,
  lat: 1,
  lng: 1,
  phone: 1,
  amenities: 1,
  status: 1,
  isVerified: 1,
  lastReportedAt: 1,
  providerId: 1,
  cityId: 1,
  locationTypeId: 1,
};

function formatLocation(doc: Record<string, unknown>) {
  const provider = doc.provider as { slug?: string; name?: string; logo?: string } | null;
  const city = doc.city as { name?: string; region?: string } | null;
  const type = doc.locationType as { code?: string; label?: string } | null;

  return {
    id: String(doc._id),
    name: doc.name,
    address: doc.address,
    lat: doc.lat,
    lng: doc.lng,
    phone: doc.phone,
    amenities: doc.amenities,
    status: doc.status,
    isVerified: doc.isVerified,
    lastReportedAt: doc.lastReportedAt,
    reportCount: (doc.reportCount as number | undefined) ?? 0,
    distanceKm: doc.distanceMeters != null ? Math.round((doc.distanceMeters as number) / 100) / 10 : undefined,
    provider: provider
      ? { slug: provider.slug, name: provider.name, logo: provider.logo }
      : undefined,
    city: city ? { name: city.name, region: city.region } : undefined,
    type: type ? { code: type.code, label: type.label } : undefined,
  };
}

async function attachReportCounts(docs: Record<string, unknown>[]) {
  if (!docs.length) return docs;

  const locationIds = docs.map((d) => new Types.ObjectId(String(d._id)));
  const counts = await Report.aggregate([
    { $match: { locationId: { $in: locationIds } } },
    { $group: { _id: '$locationId', count: { $sum: 1 } } },
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count as number]));

  return docs.map((doc) => ({
    ...doc,
    reportCount: countMap[String(doc._id)] ?? 0,
  }));
}

async function populateLocations(docs: Record<string, unknown>[]) {
  const providerIds = [...new Set(docs.map((d) => String(d.providerId)))];
  const cityIds = [...new Set(docs.map((d) => String(d.cityId)))];
  const typeIds = [...new Set(docs.map((d) => String(d.locationTypeId)))];

  const [providers, cities, types] = await Promise.all([
    Provider.find({ _id: { $in: providerIds } }).lean(),
    City.find({ _id: { $in: cityIds } }).lean(),
    LocationType.find({ _id: { $in: typeIds } }).lean(),
  ]);

  const providerMap = Object.fromEntries(providers.map((p) => [String(p._id), p]));
  const cityMap = Object.fromEntries(cities.map((c) => [String(c._id), c]));
  const typeMap = Object.fromEntries(types.map((t) => [String(t._id), t]));

  return docs.map((doc) =>
    formatLocation({
      ...doc,
      provider: providerMap[String(doc.providerId)],
      city: cityMap[String(doc.cityId)],
      locationType: typeMap[String(doc.locationTypeId)],
    })
  );
}

export async function findNearby(query: NearbyQuery) {
  const match = await buildMatchFilter(query.providerSlugs, query.typeCodes);
  if (match === null) return { count: 0, data: [] };

  const results = await Location.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [query.lng, query.lat] },
        distanceField: 'distanceMeters',
        maxDistance: query.radiusKm * 1000,
        spherical: true,
        query: match,
      },
    },
    { $limit: query.limit },
    { $project: { ...locationListProjection, distanceMeters: 1 } },
  ]);

  const withCounts = await attachReportCounts(results);
  const populated = await populateLocations(withCounts);
  return { count: populated.length, data: populated };
}

export async function findInBbox(query: BboxQuery) {
  const match = await buildMatchFilter(query.providerSlugs, query.typeCodes);
  if (match === null) return { count: 0, data: [] };

  const results = await Location.find({
    ...match,
    location: {
      $geoWithin: {
        $box: [
          [query.swLng, query.swLat],
          [query.neLng, query.neLat],
        ],
      },
    },
  })
    .select(locationListProjection)
    .limit(query.limit)
    .lean();

  const withCounts = await attachReportCounts(results as unknown as Record<string, unknown>[]);
  const data = await populateLocations(withCounts);
  return { count: data.length, data };
}

export async function findById(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;

  const doc = await Location.findOne({ _id: id, isActive: true }).lean();
  if (!doc) return null;

  const [withCount] = await attachReportCounts([doc as unknown as Record<string, unknown>]);
  const [data] = await populateLocations([withCount]);
  return data;
}

export async function findByIds(ids: string[]) {
  const objectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
  if (!objectIds.length) return [];

  const results = await Location.find({ _id: { $in: objectIds }, isActive: true })
    .select(locationListProjection)
    .lean();

  const withCounts = await attachReportCounts(results as unknown as Record<string, unknown>[]);
  const populated = await populateLocations(withCounts);
  const byId = Object.fromEntries(populated.map((item) => [item.id, item]));

  return ids.map((id) => byId[id]).filter(Boolean);
}

export async function listProviders() {
  return Provider.find().sort({ name: 1 }).select('name slug logo').lean();
}

export async function listLocationTypes() {
  return LocationType.find().sort({ label: 1 }).select('code label').lean();
}

export async function listCities() {
  return City.find({ country: 'Pakistan' }).sort({ name: 1 }).select('name region centerLat centerLng').lean();
}
