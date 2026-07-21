import { Browser, BrowserContext, chromium, Page } from 'playwright';
import { env } from '../../config/env';
import { McbRawLocation } from './normalize';

const API_PATH = '/branch-locator/get_info_window_details';

export interface McbBrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

export async function createMcbSession(): Promise<McbBrowserSession> {
  const browser = await chromium.launch({
    headless: env.MCB_HEADLESS,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
  });

  const page = await context.newPage();
  await page.goto(env.MCB_BRANCH_LOCATOR_URL, {
    waitUntil: 'domcontentloaded',
    timeout: env.MCB_PAGE_TIMEOUT_MS,
  });
  await page.waitForTimeout(2000);

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

async function getCsrfToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const token = cookies.find((cookie) => cookie.name === 'exp_csrf_token')?.value;
  if (token) return token;
  throw new Error('Unable to read MCB CSRF token (exp_csrf_token)');
}

export async function fetchMcbLocations(page: Page): Promise<McbRawLocation[]> {
  const xid = await getCsrfToken(page);

  const result = await page.evaluate(
    async ({ apiPath, csrfToken }) => {
      const body = new URLSearchParams({ XID: csrfToken });
      const response = await fetch(apiPath, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest',
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`MCB fetch failed with status ${response.status}`);
      }

      return response.json();
    },
    { apiPath: API_PATH, csrfToken: xid }
  );

  const payload = result as { results?: McbRawLocation[] };
  return payload.results ?? [];
}
