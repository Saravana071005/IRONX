import { MongoClient } from 'mongodb';

export async function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    global._mongoClientPromise = client.connect().catch(err => {
      global._mongoClientPromise = null;
      throw err;
    });
  }
  return global._mongoClientPromise;
}

export async function getMongoDb(dbName = process.env.MONGODB_DB || 'opengym') {
  const client = await getMongoClient();
  if (!client) return null;
  return client.db(dbName);
}

export async function pingMongo() {
  if (!process.env.MONGODB_URI) return { connected: false, configured: false };
  try {
    const client = await getMongoClient();
    if (!client) return { connected: false, configured: true };
    await client.db('admin').command({ ping: 1 });
    return { connected: true, configured: true };
  } catch (err) {
    console.error('MongoDB Atlas ping failed:', err.message);
    return { connected: false, configured: true, error: err.message };
  }
}
