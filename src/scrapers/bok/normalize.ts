import { LocationUpsertInput } from '../shared/upsert';

export interface BokRawLocation {
  lat: string;
  lng: string;
  name: string;
  code: string;
  province: string;
  city: string;
  phone: string;
  atmStatus: string;
}

const ROW_START_RE =
  /data-views-row-index="\d+" class="geolocation-location js-hide" id="[^"]*" data-lat="([^"]+)" data-lng="([^"]+)"/g;

function extractField(chunk: string, className: string): string {
  const re = new RegExp(`<div class="${className}"><strong>[^<]*<\\/strong>\\s*<span>([\\s\\S]*?)<\\/span><\\/div>`);
  const match = chunk.match(re);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

export function parseBokLocations(html: string): BokRawLocation[] {
  const starts: Array<{ index: number; lat: string; lng: string }> = [];
  for (const match of html.matchAll(ROW_START_RE)) {
    starts.push({ index: match.index ?? 0, lat: match[1], lng: match[2] });
  }

  const rows: BokRawLocation[] = [];

  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i].index;
    const end = i + 1 < starts.length ? starts[i + 1].index : html.length;
    const chunk = html.slice(start, end);

    rows.push({
      lat: starts[i].lat,
      lng: starts[i].lng,
      name: extractField(chunk, 'branch-name'),
      code: extractField(chunk, 'branch-code'),
      province: extractField(chunk, 'branch-province'),
      city: extractField(chunk, 'branch-city'),
      phone: extractField(chunk, 'branch-telephone'),
      atmStatus: extractField(chunk, 'branch-atm'),
    });
  }

  return rows;
}

export function normalizeBokLocation(raw: BokRawLocation): LocationUpsertInput | null {
  const lat = Number.parseFloat(raw.lat);
  const lng = Number.parseFloat(raw.lng);

  if (!raw.name || !raw.code || !raw.city) return null;

  return {
    providerSlug: 'bok',
    cityName: raw.city,
    locationTypeCode: 'brnch',
    externalId: raw.code,
    name: raw.name,
    address: [raw.name, raw.city, raw.province].filter(Boolean).join(', '),
    lat,
    lng,
    phone: raw.phone || undefined,
    amenities: { atm: raw.atmStatus.toLowerCase() === 'yes' },
    isVerified: true,
    rawData: raw as unknown as Record<string, unknown>,
  };
}
