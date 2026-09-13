import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env';

// Windows/ISP DNS sometimes blocks SRV lookups used by mongodb+srv://
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const MAX_CONNECT_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);

  const uri = env.MONGODB_URI_DIRECT ?? env.MONGODB_URI;
  

  for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {  //  1 == 5 
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15_000,
      });
      console.log('MongoDB connected');
      return;
    } catch (err) {
      const isLastAttempt = attempt === MAX_CONNECT_RETRIES;
      console.error(
        `MongoDB connection attempt ${attempt}/${MAX_CONNECT_RETRIES} failed:`,
        err instanceof Error ? err.message : err
      );
      if (isLastAttempt) throw err;
      const delay = RETRY_BASE_DELAY_MS * attempt;  /// 2000 * 3 = 6000
      console.log(`Retrying MongoDB connection in ${delay}ms...`);
      await sleep(delay);
    }
  }
}
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log('MongoDB disconnected');
}

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});
