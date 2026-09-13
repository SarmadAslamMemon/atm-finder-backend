import axios from 'axios';

async function testHblDirect(): Promise<void> {
  const pageUrl = 'https://www.hbl.com/branch-locator';
  const apiUrl = 'https://www.hbl.com/branch-locator/get_locations_by_city';

  console.log('Testing direct HTTP fetch to HBL...');

  const client = axios.create({
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    },
    withCredentials: true,
  });

  const pageRes = await client.get(pageUrl);
  const setCookie = pageRes.headers['set-cookie'] || [];
  const cookieHeader = Array.isArray(setCookie)
    ? setCookie.map((c) => c.split(';')[0]).join('; ')
    : '';

  console.log('Got HBL cookies:', cookieHeader);

  // Extract exp_csrf_token from cookie or html
  const csrfMatch =
    cookieHeader.match(/exp_csrf_token=([^;]+)/) ||
    pageRes.data.match(/name="XID"\s+value="([^"]+)"/) ||
    pageRes.data.match(/csrf_token["']?\s*[:=]\s*["']([^"']+)["']/);

  const csrfToken = csrfMatch ? csrfMatch[1] : '';
  console.log('Extracted CSRF token:', csrfToken);

  const body = new URLSearchParams({
    XID: csrfToken,
    city: 'Karachi',
    type: 'brnch',
  });

  const apiRes = await client.post(apiUrl, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: pageUrl,
      Origin: 'https://www.hbl.com',
      Cookie: cookieHeader,
    },
  });

  console.log('API Status:', apiRes.status);
  console.log('Sample Data Length:', Array.isArray(apiRes.data) ? apiRes.data.length : typeof apiRes.data);
  if (Array.isArray(apiRes.data) && apiRes.data.length > 0) {
    console.log('First Record:', apiRes.data[0]);
  }
}

testHblDirect().catch((err) => {
  console.error('Direct test failed:', err.message);
});
