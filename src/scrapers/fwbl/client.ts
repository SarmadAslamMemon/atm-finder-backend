import axios from 'axios';
import { FwblApiResponse } from './types';

const FWBL_OBJECTS_URL = 'https://fwbl.com.pk/wp-json/mapsvg/v1/objects/objects_1';

export async function fetchFwblLocations(): Promise<FwblApiResponse> {
  const { data } = await axios.get<FwblApiResponse>(FWBL_OBJECTS_URL, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
      accept: 'application/json',
    },
    timeout: 60_000,
  });

  return data;
}
