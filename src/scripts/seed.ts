import { connectDatabase, disconnectDatabase } from '../config/database';
import { City, LocationType, Provider } from '../models';
import { PAKISTAN_CITIES } from '../scrapers/shared/cities';

const LOCATION_TYPES = [
  { code: 'atm', label: 'ATM' },
  { code: 'brnch', label: 'Branch' },
  { code: 'isl', label: 'Islamic Banking' },
  { code: 'agri', label: 'Agri Branch' },
];

const PROVIDERS = [
  {
    name: 'Habib Bank Limited',
    slug: 'hbl',
    logo: 'https://d2liqplnt17rh6.cloudfront.net/logoImages/hblnewlogo_0df69171-bf78-412a-b12b-eed3e2ef43f6-225.jpeg',
  },
  {
    name: 'United Bank Limited',
    slug: 'ubl',
    logo: 'https://d2liqplnt17rh6.cloudfront.net/logoImages/4b819a00-27cd-4533-9c68-a50164989c46-393.jpeg',
  },
  {
    name: 'Bank Alfalah',
    slug: 'alfalah',
    logo: 'https://d2liqplnt17rh6.cloudfront.net/logoImages/ccc3625c-f9e8-456b-9e44-83e177a4d0d9-829.jpeg',
  },
  {
    name: 'MCB Bank Limited',
    slug: 'mcb',
    logo: 'https://d2liqplnt17rh6.cloudfront.net/logoImages/mcbislamiclogo_864c7f72-706a-4db4-9d65-bc3846520be6-748.jpeg',
  },
  {
    name: 'Meezan Bank',
    slug: 'meezan',
    logo: 'https://d2liqplnt17rh6.cloudfront.net/logoImages/logocopy1_d76a1008-3871-4032-9b94-96f4d7693797-229.jpeg',
  },
  {
    name: 'Allied Bank',
    slug: 'allied',
    logo: 'https://d2liqplnt17rh6.cloudfront.net/logoImages/960e7769-9ded-428d-89a7-b1d4776435ba-350.jpeg',
  },
  {
    name: 'Bank AL Habib',
    slug: 'alhabib',
    logo: 'https://d2liqplnt17rh6.cloudfront.net/logoImages/26bf5b92-38d4-42c2-adfd-634952fa22e6-626.jpeg',
  },
];

async function seed(): Promise<void> {
  await connectDatabase();

  for (const provider of PROVIDERS) {
    await Provider.findOneAndUpdate({ slug: provider.slug }, provider, { upsert: true, returnDocument: 'after' });
  }
  console.log('Providers seeded');

  for (const type of LOCATION_TYPES) {
    await LocationType.findOneAndUpdate({ code: type.code }, type, { upsert: true, returnDocument: 'after' });
  }
  console.log('Location types seeded');

  for (const city of PAKISTAN_CITIES) {
    await City.findOneAndUpdate(
      { name: city.name, country: 'Pakistan' },
      { ...city, country: 'Pakistan' },
      { upsert: true, returnDocument: 'after' }
    );
  }
  console.log('Cities seeded');

  await disconnectDatabase();
  console.log('Seed completed');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
