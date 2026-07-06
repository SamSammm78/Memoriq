import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { sendNotification } from '@/lib/push';

const KV_KEY = 'memoriq:progression';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const progression = await kv.get<any>(KV_KEY);
    const subscription = progression?.push_subscription;

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active push subscription found.' },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const payload = JSON.stringify({
      title: 'Memoriq',
      body: 'Notification de test reçue. Les rappels fonctionnent sur cet appareil.',
      url: '/'
    });

    const result = await sendNotification(subscription, payload);

    if (!result.success && result.expired) {
      await kv.set(KV_KEY, {
        ...progression,
        push_subscription: null
      });

      return NextResponse.json(
        { error: 'Push subscription expired.', expired: true },
        { status: 410, headers: NO_STORE_HEADERS }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Web push delivery failed.',
          result
        },
        { status: result.statusCode || 500, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json({ success: true, result }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
