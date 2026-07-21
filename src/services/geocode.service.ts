import axios from 'axios';

export interface ReverseGeocodeResult {
  name: string;
  displayName: string;
  city?: string;
  region?: string;
  country?: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

interface NominatimAddress {
  amenity?: string;
  shop?: string;
  building?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: NominatimAddress;
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const { data } = await axios.get<NominatimResponse>(NOMINATIM_URL, {
    params: {
      lat,
      lon: lng,
      format: 'jsonv2',
      zoom: 16,
      addressdetails: 1,
    },
    headers: {
      'User-Agent': 'atm-finder-backend/1.0',
      'Accept-Language': 'en',
    },
    timeout: 10_000,
  });

  if (!data?.display_name) return null;

  const address = data.address ?? {};
  const name =
    address.amenity ||
    address.shop ||
    address.building ||
    address.road ||
    address.suburb ||
    address.neighbourhood ||
    data.display_name.split(',')[0].trim();

  return {
    name,
    displayName: data.display_name,
    city: address.city || address.town || address.village || address.county,
    region: address.state,
    country: address.country,
  };
}
