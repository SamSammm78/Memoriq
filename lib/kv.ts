import 'server-only';

import { del, get, list, put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const isBlobConfigured = !!(
  process.env.BLOB_READ_WRITE_TOKEN ||
  (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
);

const LOCAL_STORE_PATH = path.join(process.cwd(), 'local-kv-store.json');
const BLOB_ROOT = process.env.MEMORIQ_BLOB_ROOT || 'memoriq';

type LocalStore = Record<string, unknown>;

function getBlobPrefix(key: string) {
  const cleanedKey = key
    .replace(/^memoriq:/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-');

  return `${BLOB_ROOT}/${cleanedKey}/`;
}

function readLocalStore(): LocalStore {
  if (!fs.existsSync(LOCAL_STORE_PATH)) {
    return {};
  }

  try {
    const fileContent = fs.readFileSync(LOCAL_STORE_PATH, 'utf-8');
    return JSON.parse(fileContent) as LocalStore;
  } catch (e) {
    console.error('Failed to parse local KV store, resetting...', e);
    return {};
  }
}

function writeLocalStore(store: LocalStore) {
  try {
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write local KV store:', e);
  }
}

async function readLatestBlob<T>(key: string): Promise<T | null> {
  const prefix = getBlobPrefix(key);
  const result = await list({ prefix, limit: 1000 });

  if (result.blobs.length === 0) {
    return null;
  }

  const latestBlob = result.blobs
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];

  const blob = await get(latestBlob.pathname, { access: 'public' });
  if (!blob || blob.statusCode !== 200) {
    return null;
  }

  return (await new Response(blob.stream).json()) as T;
}

async function writeSnapshotBlob(key: string, value: unknown) {
  const prefix = getBlobPrefix(key);
  const pathname = `${prefix}${Date.now()}-${randomUUID()}.json`;

  await put(pathname, JSON.stringify(value, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json'
  });

  const result = await list({ prefix, limit: 1000 });
  const staleBlobs = result.blobs
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
    .slice(5);

  if (staleBlobs.length > 0) {
    await del(staleBlobs.map((blob) => blob.pathname)).catch((error) => {
      console.warn('Failed to clean old Blob snapshots:', error);
    });
  }
}

export const kv = {
  get: async <T>(key: string): Promise<T | null> => {
    if (!isBlobConfigured) {
      console.log(`[Blob Store] Using local file store (GET: ${key})`);
      const store = readLocalStore();
      return (store[key] as T) || null;
    }

    try {
      return await readLatestBlob<T>(key);
    } catch (error) {
      console.error('Vercel Blob GET error, falling back to local file:', error);
      const store = readLocalStore();
      return (store[key] as T) || null;
    }
  },

  set: async (key: string, value: unknown): Promise<'OK'> => {
    if (!isBlobConfigured) {
      console.log(`[Blob Store] Using local file store (SET: ${key})`);
      const store = readLocalStore();
      store[key] = value;
      writeLocalStore(store);
      return 'OK';
    }

    try {
      await writeSnapshotBlob(key, value);
      return 'OK';
    } catch (error) {
      console.error('Vercel Blob SET error, falling back to local file:', error);
      const store = readLocalStore();
      store[key] = value;
      writeLocalStore(store);
      return 'OK';
    }
  }
};
