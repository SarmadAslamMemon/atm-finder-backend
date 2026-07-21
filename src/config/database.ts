import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env';

// Windows/ISP DNS sometimes blocks SRV lookups used by mongodb+srv://
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);

  const uri = env.MONGODB_URI_DIRECT ?? env.MONGODB_URI;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15_000,
  });
  console.log('MongoDB connected');
}
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log('MongoDB disconnected');
}

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});
