import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .refine(
      (uri) => !uri.startsWith('mongodb+srv://') || uri.includes('@'),
      'mongodb+srv URI must include @ between credentials and host. Example: mongodb+srv://user:pass@cluster.mongodb.net/dbname'
    ),
  MONGODB_URI_DIRECT: z.string().optional(),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  PEEKABOO_API_URL: z.string().url().optional(),
  UBL_PEEKABOO_URL: z.string().url().optional(),
  UBL_OWNER_KEY: z.string().optional(),
  UBL_MERCHANT_NAME: z.string().default('United Bank Limited (UBL)'),

  ALFALAH_OWNER_KEY: z.string().optional(),
  ALFALAH_BEARER_TOKEN: z.string().optional(),
  ALFALAH_MERCHANT_NAME: z.string().default('Bank Alfalah'),
  ALFALAH_DEFAULT_LAT: z.string().default('24.861462'),
  ALFALAH_DEFAULT_LNG: z.string().default('67.009939'),

  ALLIED_OWNER_KEY: z.string().optional(),
  ALLIED_BEARER_TOKEN: z.string().optional(),
  ALLIED_MERCHANT_NAME: z.string().default('Allied Bank'),

  PEEKABOO_PUBLIC_BEARER_TOKEN: z.string().optional(),
  MEEZAN_MERCHANT_NAME: z.string().default('Meezan Bank'),
  MEEZAN_ENTITY_ID: z.coerce.number().default(45),
  ALHABIB_MERCHANT_NAME: z.string().default('Bank AL Habib'),
  ALHABIB_ENTITY_ID: z.coerce.number().default(46),

  HBL_BRANCH_LOCATOR_URL: z
    .string()
    .url()
    .default('https://www.hbl.com/branch-locator/get_locations_by_city'),
  HBL_HEADLESS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  HBL_COOKIES: z.string().optional(),
  HBL_PAGE_TIMEOUT_MS: z.coerce.number().default(120_000),
  HBL_REQUEST_TIMEOUT_MS: z.coerce.number().default(60_000),

  MCB_BRANCH_LOCATOR_URL: z
    .string()
    .url()
    .default('https://www.mcb.com.pk/branch-locator/branch-locator'),
  MCB_HEADLESS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  MCB_PAGE_TIMEOUT_MS: z.coerce.number().default(120_000),
  MCB_REQUEST_TIMEOUT_MS: z.coerce.number().default(60_000),

  SCRAPE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
