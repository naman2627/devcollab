import mongoose from 'mongoose';

/**
 * Connect to MongoDB Atlas once at boot.
 *
 * WHY connect before listen: if the URI is wrong we want a loud crash at
 * startup, not a pile of requests timing out at runtime. Mongoose buffers
 * commands by default, which would hide a dead database behind slow requests,
 * so we fail fast instead.
 */
export default async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is missing. Copy .env.example to .env and fill it in.');
  }

  // Strict query: ignore filter keys that are not in the schema rather than
  // silently matching everything - a typo in a query should return nothing,
  // not the whole collection.
  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(uri, {
    // Give up on an unreachable cluster in 10s instead of the 30s default, so
    // a wrong IP allowlist surfaces quickly during a demo.
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`[db] connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}
