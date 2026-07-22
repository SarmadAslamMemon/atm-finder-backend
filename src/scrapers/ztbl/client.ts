import axios from 'axios';

const ZTBL_LOCATOR_URL = 'https://ztbl.com.pk/branche-locator/';

export async function fetchZtblHtml(): Promise<string> {
  const { data } = await axios.get<string>(ZTBL_LOCATOR_URL, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    timeout: 60_000,
  });

  return data;
}
