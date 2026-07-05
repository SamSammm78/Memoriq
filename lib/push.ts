import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
let privateKey = process.env.VAPID_PRIVATE_KEY || '';
const contactEmail = process.env.VAPID_EMAIL || 'mailto:salen@example.com';

const localVapidFile = path.join(process.cwd(), 'local-vapid-keys.json');

// Auto-generate VAPID keys for development if none are provided
if (!publicKey || !privateKey) {
  if (fs.existsSync(localVapidFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(localVapidFile, 'utf-8'));
      publicKey = saved.publicKey;
      privateKey = saved.privateKey;
      console.log('[Web Push Wrapper] Loaded local development VAPID keys.');
    } catch (e) {
      console.warn('Failed to parse local VAPID file, will regenerate:', e);
    }
  }

  if (!publicKey || !privateKey) {
    try {
      const generated = webpush.generateVAPIDKeys();
      publicKey = generated.publicKey;
      privateKey = generated.privateKey;
      fs.writeFileSync(localVapidFile, JSON.stringify(generated, null, 2), 'utf-8');
      console.log('[Web Push Wrapper] Generated and saved development VAPID keys to:', localVapidFile);
    } catch (e) {
      console.error('[Web Push Wrapper] Error generating development VAPID keys:', e);
    }
  }
}

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(contactEmail, publicKey, privateKey);
    console.log('[Web Push Wrapper] VAPID details set successfully.');
  } catch (error) {
    console.error('[Web Push Wrapper] Error setting VAPID details:', error);
  }
} else {
  console.warn('[Web Push Wrapper] VAPID keys are missing. Push notifications will be simulated.');
}

export async function sendNotification(subscription: any, payload: string) {
  if (!publicKey || !privateKey) {
    console.log('[Web Push Wrapper] (Simulated) Sending notification to:', subscription.endpoint);
    console.log('[Web Push Wrapper] Payload:', payload);
    return { success: true, simulated: true };
  }

  try {
    const res = await webpush.sendNotification(subscription, payload);
    return { success: true, statusCode: res.statusCode };
  } catch (error: any) {
    console.error('[Web Push Wrapper] Error sending notification:', error);
    
    // 410 Gone or 404 Not Found means the subscription is no longer valid
    if (error.statusCode === 410 || error.statusCode === 404) {
      return { success: false, expired: true, statusCode: error.statusCode };
    }
    
    throw error;
  }
}

export function getVapidPublicKey() {
  return publicKey;
}
