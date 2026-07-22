export interface FwblObject {
  id: string;
  title: string;
  location: {
    address?: { formatted?: string };
    geoPoint: { lat: number; lng: number };
  };
  type: 'atm' | 'branch' | 'both';
  code: string;
  phone: string;
  city: string;
  city_text: string;
  address: string;
}

export interface FwblApiResponse {
  objects: FwblObject[] | false;
}
