export const LOCATION_STATUS = ['cash_available', 'no_cash', 'offline', 'unknown'] as const;
export type LocationStatus = (typeof LOCATION_STATUS)[number];

export const PROVIDER_SLUGS = [
  'hbl',
  'ubl',
  'alfalah',
  'mcb',
  'allied',
  'meezan',
  'alhabib',
  'faysal',
  'askari',
  'jsbank',
  'soneri',
  'bop',
  'nbp',
  'sindhbank',
  'dib',
  'bankislami',
  'albaraka',
  'habibmetro',
  'bok',
  'ztbl',
  'fwbl',
] as const;
export type ProviderSlug = (typeof PROVIDER_SLUGS)[number];

export const LOCATION_TYPE_CODES = ['atm', 'brnch', 'isl', 'agri'] as const;
export type LocationTypeCode = (typeof LOCATION_TYPE_CODES)[number];
