import { MongoClient } from 'mongodb';

export async function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (!global._mongoClientPromise) {
    try {
      const client = new MongoClient(uri.trim(), {
        maxPoolSize: 20,
        minPoolSize: 1,
        maxIdleTimeMS: 60000,
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 5000,
      });
      global._mongoClientPromise = client.connect().catch(err => {
        global._mongoClientPromise = null;
        throw err;
      });
    } catch (err) {
      console.error('MongoDB client initialization error:', err.message);
      global._mongoClientPromise = null;
      return null;
    }
  }
  return global._mongoClientPromise;
}

export async function getMongoDb(dbName = (process.env.MONGODB_DB || 'opengym').trim()) {
  try {
    const client = await getMongoClient();
    if (!client) return null;
    return client.db(dbName);
  } catch (err) {
    console.error('Failed to get MongoDB database handle:', err.message);
    return null;
  }
}

export async function pingMongo() {
  if (!process.env.MONGODB_URI) return { connected: false, configured: false };
  try {
    const client = await getMongoClient();
    if (!client) return { connected: false, configured: true };
    const db = await getMongoDb();
    if (!db) return { connected: false, configured: true };
    await db.command({ ping: 1 });
    return { connected: true, configured: true };
  } catch (err) {
    console.error('MongoDB Atlas ping failed:', err.message);
    return { connected: false, configured: true, error: err.message };
  }
}
