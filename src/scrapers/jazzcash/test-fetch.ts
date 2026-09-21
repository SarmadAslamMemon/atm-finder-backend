import axios from 'axios';

async function testJazzCash() {
  console.log('Testing JazzCash Agent Locator endpoint...');

  const session = axios.create({
    baseURL: 'https://www.jazzcash.com.pk',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  // Step 1: Hit main page to establish session & get cookies
  console.log('1. Loading agent locator page to get cookies...');
  const initRes = await session.get('/agent-locator');
  const cookies = initRes.headers['set-cookie'] || [];
  const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
  console.log(`Received ${cookies.length} session cookies.`);

  // Step 2: Query the agent search endpoint
  console.log('2. Querying agent locator API for "karachi"...');
  const searchRes = await session.get('/agent-locator/agent-locator-search', {
    params: {
      offset: 0,
      limit: 5,
      search: 'karachi',
    },
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://www.jazzcash.com.pk/agent-locator',
      'Cookie': cookieHeader,
    },
  });

  console.log('Response Status:', searchRes.status);
  console.log('Response Data Sample:');
  console.log(JSON.stringify(searchRes.data, null, 2).slice(0, 1500));
}

testJazzCash().catch((err) => {
  console.error('Test error:', err.response?.data || err.message);
});
