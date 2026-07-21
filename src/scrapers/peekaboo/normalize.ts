import { LocationTypeCode } from '../../constants';
import { ILocationAmenities } from '../../models';
import { LocationUpsertInput } from '../shared/upsert';
import { PeekabooBranch } from './types';

export function parsePeekabooAmenities(
  amenities?: PeekabooBranch['amenities']
): ILocationAmenities {
  const result: ILocationAmenities = {};
  if (!amenities) return result;

  for (const [key, amenity] of Object.entries(amenities)) {
    if (amenity?.value?.toLowerCase() !== 'yes') continue;

    const normalized = key.toLowerCase();
    if (normalized === 'atm') result.atm = true;
    if (normalized.includes('islamic')) result.islamic = true;
    if (normalized.includes('locker')) result.locker = true;
    if (normalized.includes('conventional')) result.conventional = true;
    if (normalized.includes('cdm')) result.cdm = true;
    if (normalized.includes('biometric')) result.biometric = true;
  }

  return result;
}

export function inferPeekabooLocationType(amenities: ILocationAmenities): LocationTypeCode {
  if (amenities.islamic) return 'isl';
  return 'brnch';
}

export function normalizePeekabooBranch(
  branch: PeekabooBranch,
  providerSlug: string
): LocationUpsertInput {
  const amenities = parsePeekabooAmenities(branch.amenities);

  return {
    providerSlug,
    cityName: branch.city,
    locationTypeCode: inferPeekabooLocationType(amenities),
    externalId: String(branch.id),
    name: branch.name.trim(),
    address: branch.address.trim(),
    lat: branch.latitude,
    lng: branch.longitude,
    phone: branch.contactNumber || undefined,
    amenities,
    isVerified: branch.isVerified === 1,
    rawData: branch as unknown as Record<string, unknown>,
  };
}
