import 'server-only';

import { list, put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

const PROGRESSION_BLOB_PATH = 'memoriq/progression.json';
const LOCAL_STORE_PATH = path.join(process.cwd(), 'local-kv-store.json');
const isVercelProductionRuntime = process.env.VERCEL === '1';

type LocalStore = Record<string, unknown>;

function canUseLocalFallback() {
  return !isVercelProductionRuntime;
}

function readLocalStore(): LocalStore {
  if (!fs.existsSync(LOCAL_STORE_PATH)) {
    return {};
  }

  try {
    const fileContent = fs.readFileSync(LOCAL_STORE_PATH, 'utf-8');
    return JSON.parse(fileContent) as LocalStore;
  } catch (e) {
    console.error('Failed to parse local progression store, resetting...', e);
    return {};
  }
}

function writeLocalStore(store: LocalStore) {
  try {
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write local progression store:', e);
  }
}

async function readBlob<T>(): Promise<T | null> {
  const result = await list({ prefix: PROGRESSION_BLOB_PATH, limit: 1 });
  const blob = result.blobs[0];

  if (!blob) {
    return null;
  }

  const response = await fetch(blob.url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch progression blob: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function writeBlob(value: unknown) {
  await put(PROGRESSION_BLOB_PATH, JSON.stringify(value), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true
  });
}

export const kv = {
  get: async <T>(key: string): Promise<T | null> => {
    if (!canUseLocalFallback()) {
      return readBlob<T>();
    }

    try {
      return await readBlob<T>();
    } catch {
      const store = readLocalStore();
      return (store[key] as T) || null;
    }
  },

  set: async (key: string, value: unknown): Promise<'OK'> => {
    if (!canUseLocalFallback()) {
      await writeBlob(value);
      return 'OK';
    }

    try {
      await writeBlob(value);
      return 'OK';
    } catch {
      const store = readLocalStore();
      store[key] = value;
      writeLocalStore(store);
      return 'OK';
    }
  }
};
