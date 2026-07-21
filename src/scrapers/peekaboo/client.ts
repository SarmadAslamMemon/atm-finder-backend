import axios from 'axios';
import { env } from '../../config/env';
import { ProviderSlug } from '../../constants';
import { PeekabooPublicBankConfig } from './publicClient';
import {
  PeekabooApiResponse,
  PeekabooBankConfig,
  PeekabooBranch,
  PeekabooRequestBody,
} from './types';

const DEFAULT_PEEKABOO_URL =
  'https://secure-sdk.peekaboo.guru/kbprosamdmnioblcruahnhdcjhs_ahajlhljlgjhaskjgl5';

function resolveApiUrl(): string {
  return env.PEEKABOO_API_URL ?? env.UBL_PEEKABOO_URL ?? DEFAULT_PEEKABOO_URL;
}

export function getUblPeekabooConfig(): PeekabooBankConfig {
  if (!env.UBL_OWNER_KEY) {
    throw new Error('UBL_OWNER_KEY must be set in .env');
  }

  return {
    providerSlug: 'ubl',
    merchantName: env.UBL_MERCHANT_NAME,
    apiUrl: resolveApiUrl(),
    ownerKey: env.UBL_OWNER_KEY,
    origin: 'https://ubl-web.peekaboo.guru',
    referer: 'https://ubl-web.peekaboo.guru/',
    categoryFilter: [98],
    pageSize: 250,
    defaultLat: '0',
    defaultLng: '0',
  };
}

export function getAlfalahPeekabooConfig(): PeekabooBankConfig {
  if (!env.ALFALAH_OWNER_KEY) {
    throw new Error('ALFALAH_OWNER_KEY must be set in .env');
  }

  return {
    providerSlug: 'alfalah',
    merchantName: env.ALFALAH_MERCHANT_NAME,
    apiUrl: resolveApiUrl(),
    ownerKey: env.ALFALAH_OWNER_KEY,
    origin: 'https://alfalah-web-locator.peekaboo.guru',
    referer: 'https://alfalah-web-locator.peekaboo.guru/',
    categoryFilter: [168],
    pageSize: 1000,
    defaultLat: env.ALFALAH_DEFAULT_LAT,
    defaultLng: env.ALFALAH_DEFAULT_LNG,
    bearerToken: env.ALFALAH_BEARER_TOKEN,
  };
}

export function getAlliedPeekabooConfig(): PeekabooBankConfig {
  if (!env.ALLIED_OWNER_KEY) {
    throw new Error('ALLIED_OWNER_KEY must be set in .env');
  }

  return {
    providerSlug: 'allied',
    merchantName: env.ALLIED_MERCHANT_NAME,
    apiUrl: resolveApiUrl(),
    ownerKey: env.ALLIED_OWNER_KEY,
    origin: 'https://allied-web.peekaboo.guru',
    referer: 'https://allied-web.peekaboo.guru/',
    categoryFilter: [168],
    pageSize: 1000,
    defaultLat: '0',
    defaultLng: '0',
    bearerToken: env.ALLIED_BEARER_TOKEN,
  };
}

export function getPeekabooPublicConfig(
  providerSlug: string,
  merchantName: string,
  entityId: number,
  entitySlug: string
): PeekabooPublicBankConfig {
  if (!env.PEEKABOO_PUBLIC_BEARER_TOKEN) {
    throw new Error('PEEKABOO_PUBLIC_BEARER_TOKEN must be set in .env');
  }

  return {
    providerSlug,
    merchantName,
    entityId,
    entityName: merchantName,
    bearerToken: env.PEEKABOO_PUBLIC_BEARER_TOKEN,
    amenityIds: [98],
    pageSize: 250,
    defaultLat: 24.861462,
    defaultLng: 67.009939,
    referer: `https://peekaboo.guru/karachi/detail/${entityId}/${entitySlug}/branches`,
  };
}

export function getMeezanPeekabooPublicConfig(): PeekabooPublicBankConfig {
  return getPeekabooPublicConfig('meezan', env.MEEZAN_MERCHANT_NAME, env.MEEZAN_ENTITY_ID, 'meezan-bank');
}

export function getAlHabibPeekabooPublicConfig(): PeekabooPublicBankConfig {
  return getPeekabooPublicConfig('alhabib', env.ALHABIB_MERCHANT_NAME, env.ALHABIB_ENTITY_ID, 'bank-al-habib');
}

export function getPeekabooConfig(slug: ProviderSlug): PeekabooBankConfig {
  if (slug === 'ubl') return getUblPeekabooConfig();
  if (slug === 'alfalah') return getAlfalahPeekabooConfig();
  if (slug === 'allied') return getAlliedPeekabooConfig();
  throw new Error(`No Peekaboo config for provider: ${slug}`);
}

export function buildPeekabooRequest(
  config: PeekabooBankConfig,
  city: string,
  offset: number
): PeekabooRequestBody {
  return {
    fksyd: city,
    n4ja3s: 'Pakistan',
    js6nwf: config.defaultLat,
    pan3ba: config.defaultLng,
    mstoaw: 'en',
    kisu87: 'me',
    matsw: config.merchantName,
    mnakls: String(config.pageSize),
    opmsta: String(offset),
    makthya: 'alphabetical',
    '9msh': 'asc',
    klaosw: false,
    '7WdpTO': config.categoryFilter,
  };
}

export async function fetchPeekabooBranches(
  config: PeekabooBankConfig,
  city: string,
  offset = 0
): Promise<PeekabooApiResponse> {
  const headers: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json',
    medium: 'IFRAME',
    origin: config.origin,
    referer: config.referer,
    ownerkey: config.ownerKey,
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  };

  if (config.bearerToken) {
    headers.authorization = `Bearer ${config.bearerToken}`;
  }

  const { data } = await axios.post<PeekabooApiResponse | { msg?: string }>(
    config.apiUrl,
    buildPeekabooRequest(config, city, offset),
    { headers, timeout: 60_000 }
  );

  if (!data || typeof data !== 'object' || !('branches' in data)) {
    console.error(
      `  [${config.providerSlug}] Peekaboo returned no branches field for ${city} — likely an auth/config error. Response:`,
      JSON.stringify(data).slice(0, 500)
    );
    return { id: 0, name: config.merchantName, totalBranches: 0, branches: [] };
  }

  return data;
}

export async function fetchAllPeekabooBranchesForCity(
  config: PeekabooBankConfig,
  city: string
): Promise<PeekabooBranch[]> {
  const branches: PeekabooBranch[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const response = await fetchPeekabooBranches(config, city, offset);
    const page = response.branches ?? [];
    total = response.totalBranches ?? page.length;
    branches.push(...page);
    offset += config.pageSize;

    if (page.length === 0) break;
  }

  return branches;
}
