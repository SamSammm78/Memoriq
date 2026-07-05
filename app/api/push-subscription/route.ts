import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { getVapidPublicKey } from '@/lib/push';

const KV_KEY = 'memoriq:progression';

export async function GET() {
  try {
    const publicKey = getVapidPublicKey();
    return NextResponse.json({ publicKey });
  } catch (error) {
    console.error('Error getting VAPID public key:', error);
    return NextResponse.json({ error: 'Failed to get public key' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subscription } = body;
    
    const currentData = await kv.get<any>(KV_KEY) || {
      current_memorizing: { surah: 1, ayah: 1 },
      learned_ayahs: [],
      streak: 0,
      last_active_date: '',
      notification_time: '13:00',
      push_subscription: null
    };

    currentData.push_subscription = subscription || null;
    await kv.set(KV_KEY, currentData);

    return NextResponse.json({ success: true, push_subscription: currentData.push_subscription });
  } catch (error) {
    console.error('Error saving subscription:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}
