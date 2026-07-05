import { kv as vercelKv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

// Check if Vercel KV config is present. If not, use local file fallback.
const isKvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const MOCK_FILE_PATH = path.join(process.cwd(), 'local-kv-store.json');

function readLocalStore(): Record<string, any> {
  if (!fs.existsSync(MOCK_FILE_PATH)) {
    return {};
  }
  try {
    const fileContent = fs.readFileSync(MOCK_FILE_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (e) {
    console.error('Failed to parse local KV store, resetting...', e);
    return {};
  }
}

function writeLocalStore(store: Record<string, any>) {
  try {
    fs.writeFileSync(MOCK_FILE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write local KV store:', e);
  }
}

export const kv = {
  get: async <T>(key: string): Promise<T | null> => {
    if (!isKvConfigured) {
      console.log(`[KV Wrapper] Using local file store (GET: ${key})`);
      const store = readLocalStore();
      return (store[key] as T) || null;
    }
    try {
      return await vercelKv.get<T>(key);
    } catch (error) {
      console.error('Vercel KV GET error, falling back to local file:', error);
      const store = readLocalStore();
      return (store[key] as T) || null;
    }
  },

  set: async (key: string, value: any): Promise<'OK'> => {
    if (!isKvConfigured) {
      console.log(`[KV Wrapper] Using local file store (SET: ${key})`);
      const store = readLocalStore();
      store[key] = value;
      writeLocalStore(store);
      return 'OK';
    }
    try {
      await vercelKv.set(key, value);
      return 'OK';
    } catch (error) {
      console.error('Vercel KV SET error, falling back to local file:', error);
      const store = readLocalStore();
      store[key] = value;
      writeLocalStore(store);
      return 'OK';
    }
  }
};
