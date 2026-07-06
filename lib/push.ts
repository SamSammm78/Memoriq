import 'server-only';

import { list, put } from '@vercel/blob';
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

const VAPID_BLOB_PATH = 'memoriq/vapid-keys.json';
const localVapidFile = path.join(process.cwd(), 'local-vapid-keys.json');
const contactEmail = process.env.VAPID_EMAIL || 'mailto:salen@example.com';
const isVercelRuntime = process.env.VERCEL === '1';

type VapidKeys = {
  publicKey: string;
  privateKey: string;
};

let cachedKeys: VapidKeys | null = null;

function getEnvVapidKeys(): VapidKeys | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey };
}

async function readBlobVapidKeys(): Promise<VapidKeys | null> {
  const result = await list({ prefix: VAPID_BLOB_PATH, limit: 1 });
  const blob = result.blobs[0];

  if (!blob) {
    return null;
  }

  const response = await fetch(blob.url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch VAPID blob: ${response.status}`);
  }

  return (await response.json()) as VapidKeys;
}

async function writeBlobVapidKeys(keys: VapidKeys) {
  await put(VAPID_BLOB_PATH, JSON.stringify(keys), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true
  });
}

function readLocalVapidKeys(): VapidKeys | null {
  if (!fs.existsSync(localVapidFile)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(localVapidFile, 'utf-8')) as VapidKeys;
  } catch (error) {
    console.warn('Failed to parse local VAPID file, will regenerate:', error);
    return null;
  }
}

function writeLocalVapidKeys(keys: VapidKeys) {
  fs.writeFileSync(localVapidFile, JSON.stringify(keys, null, 2), 'utf-8');
}

async function getOrCreateVapidKeys(): Promise<VapidKeys> {
  if (cachedKeys) {
    return cachedKeys;
  }

  const envKeys = getEnvVapidKeys();
  if (envKeys) {
    cachedKeys = envKeys;
    return cachedKeys;
  }

  if (isVercelRuntime) {
    const blobKeys = await readBlobVapidKeys();
    if (blobKeys?.publicKey && blobKeys.privateKey) {
      cachedKeys = blobKeys;
      return cachedKeys;
    }

    const generated = webpush.generateVAPIDKeys();
    cachedKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey
    };
    await writeBlobVapidKeys(cachedKeys);
    return cachedKeys;
  }

  const localKeys = readLocalVapidKeys();
  if (localKeys?.publicKey && localKeys.privateKey) {
    cachedKeys = localKeys;
    return cachedKeys;
  }

  const generated = webpush.generateVAPIDKeys();
  cachedKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey
  };
  writeLocalVapidKeys(cachedKeys);
  return cachedKeys;
}

async function configureWebPush() {
  const keys = await getOrCreateVapidKeys();
  webpush.setVapidDetails(contactEmail, keys.publicKey, keys.privateKey);
  return keys;
}

export async function sendNotification(subscription: any, payload: string) {
  await configureWebPush();

  try {
    const res = await webpush.sendNotification(subscription, payload);
    return { success: true, statusCode: res.statusCode };
  } catch (error: any) {
    console.error('[Web Push Wrapper] Error sending notification:', error);

    if (error.statusCode === 410 || error.statusCode === 404) {
      return { success: false, expired: true, statusCode: error.statusCode };
    }

    return {
      success: false,
      statusCode: error.statusCode || 500,
      message: error.body || error.message || 'Unknown web push error'
    };
  }
}

export async function getVapidPublicKey() {
  const keys = await getOrCreateVapidKeys();
  return keys.publicKey;
}
