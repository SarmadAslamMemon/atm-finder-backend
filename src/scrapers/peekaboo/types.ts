export interface PeekabooAmenity {
  value?: string;
  image?: string;
}

export interface PeekabooBranch {
  id: number;
  name: string;
  city: string;
  country: string;
  address: string;
  latitude: number;
  longitude: number;
  everyDayTimngs?: Record<string, string>;
  amenities?: Record<string, PeekabooAmenity>;
  amenityCount?: number;
  locationId?: number;
  contactNumber?: string;
  branchOpenNow?: string;
  isVerified?: number;
}

export interface PeekabooApiResponse {
  id: number;
  name: string;
  totalBranches: number;
  branches: PeekabooBranch[];
}

export interface PeekabooRequestBody {
  fksyd: string;
  n4ja3s: string;
  js6nwf: string;
  pan3ba: string;
  mstoaw: string;
  kisu87: string;
  matsw: string;
  mnakls: string;
  opmsta: string;
  makthya: string;
  '9msh': string;
  klaosw: boolean;
  '7WdpTO': number[];
}

export interface PeekabooBankConfig {
  providerSlug: string;
  merchantName: string;
  apiUrl: string;
  ownerKey: string;
  origin: string;
  referer: string;
  categoryFilter: number[];
  pageSize: number;
  defaultLat: string;
  defaultLng: string;
  bearerToken?: string;
}
