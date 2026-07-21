import axios from 'axios';
import { PeekabooApiResponse, PeekabooBranch } from './types';

const PUBLIC_API_URL = 'https://peekaboo.guru/api/v6/entity/branch/_all';

export interface PeekabooPublicBankConfig {
  providerSlug: string;
  merchantName: string;
  entityId: number;
  entityName: string;
  bearerToken: string;
  amenityIds: number[];
  pageSize: number;
  defaultLat: number;
  defaultLng: number;
  referer: string;
}

export async function fetchPeekabooPublicBranches(
  config: PeekabooPublicBankConfig,
  city: string,
  offset = 0
): Promise<PeekabooApiResponse> {
  const headers: Record<string, string> = {
    accept: '*/*',
    'content-type': 'application/json',
    medium: 'WEB',
    origin: 'https://peekaboo.guru',
    referer: config.referer,
    authorization: `Bearer ${config.bearerToken}`,
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  };

  const body = {
    city,
    country: 'Pakistan',
    lat: config.defaultLat,
    long: config.defaultLng,
    language: 'en',
    entity: config.entityName,
    limit: config.pageSize,
    offset,
    sortType: 'alphabetical',
    sortOrder: 'asc',
    openNow: 'false',
    isOpenOnTop: 'false',
    amenityIds: config.amenityIds,
    entityId: config.entityId,
    entityName: config.entityName,
  };

  const { data } = await axios.post<PeekabooApiResponse | { msg?: string }>(PUBLIC_API_URL, body, {
    headers,
    timeout: 60_000,
  });

  if (!data || typeof data !== 'object' || !('branches' in data)) {
    console.error(
      `  [${config.providerSlug}] Peekaboo public API returned no branches field for ${city} — likely an auth/token error. Response:`,
      JSON.stringify(data).slice(0, 500)
    );
    return { id: config.entityId, name: config.merchantName, totalBranches: 0, branches: [] };
  }

  return data;
}

export async function fetchAllPeekabooPublicBranchesForCity(
  config: PeekabooPublicBankConfig,
  city: string
): Promise<PeekabooBranch[]> {
  const branches: PeekabooBranch[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const response = await fetchPeekabooPublicBranches(config, city, offset);
    const page = response.branches ?? [];
    total = response.totalBranches ?? page.length;
    branches.push(...page);
    offset += config.pageSize;

    if (page.length === 0) break;
  }

  return branches;
}
