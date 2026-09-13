import { Browser, BrowserContext, chromium, Page } from 'playwright';
import { env } from '../../config/env';
import { HblLocationType } from '../shared/cities';
import { extractHblLocations, HblRawLocation } from './normalize';

const BRANCH_LOCATOR_URL = 'https://www.hbl.com/branch-locator';
const API_PATH = '/branch-locator/get_locations_by_city';

export interface HblBrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

function parseCookieHeader(cookieHeader: string): Array<{ name: string; value: string; domain: string; path: string }> {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...rest] = part.split('=');
      return {
        name: name.trim(),
        value: rest.join('=').trim(),
        domain: '.hbl.com',
        path: '/',
      };
    });
}

export async function createHblSession(): Promise<HblBrowserSession> {
  const headless = env.HBL_HEADLESS;

  const browser = await chromium.launch({
    headless,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    locale: 'en-US',
  });

  if (env.HBL_COOKIES) {
    await context.addCookies(parseCookieHeader(env.HBL_COOKIES));
  }

  const page = await context.newPage();

  await page.goto(BRANCH_LOCATOR_URL, { waitUntil: 'domcontentloaded', timeout: env.HBL_PAGE_TIMEOUT_MS });
  await waitForLocatorReady(page);

  return {
    browser,
    context,
    page,
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}

async function waitForLocatorReady(page: Page): Promise<void> {
  try {
    await page.waitForSelector('#city_select', { timeout: env.HBL_PAGE_TIMEOUT_MS });
    await page.waitForTimeout(2000);
  } catch {
    throw new Error(
      'HBL branch locator did not load. Try HBL_HEADLESS=false, refresh cookies (HBL_COOKIES), or run from a residential network.'
    );
  }
}

async function getCsrfToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies('https://www.hbl.com');
  const token = cookies.find((cookie) => cookie.name === 'exp_csrf_token')?.value;
  if (token) return token;

  const fromDom = (await page.evaluate(
    `document.cookie.match(/exp_csrf_token=([^;]+)/)?.[1] ?? ''`
  )) as string;

  if (fromDom) return fromDom;
  throw new Error('Unable to read HBL CSRF token (exp_csrf_token)');
}

export async function fetchHblLocations(
  page: Page,
  city: string,
  type: HblLocationType
): Promise<HblRawLocation[]> {
  return fetchHblLocationsViaEvaluate(page, city, type);
}

async function fetchHblLocationsViaEvaluate(
  page: Page,
  city: string,
  type: HblLocationType
): Promise<HblRawLocation[]> {
  const csrf = await getCsrfToken(page);
  const result = await page.evaluate(
    async ({ apiPath, csrfToken, cityName, locationType }) => {
      const body = new URLSearchParams({
        XID: csrfToken,
        city: cityName,
        type: locationType,
      });

      const response = await fetch(apiPath, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest',
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`HBL fetch failed with status ${response.status}`);
      }

      return response.json();
    },
    { apiPath: API_PATH, csrfToken: csrf, cityName: city, locationType: type }
  );

  return extractHblLocations(result);
}
