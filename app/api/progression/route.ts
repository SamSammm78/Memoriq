import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';

const KV_KEY = 'memoriq:progression';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export const dynamic = 'force-dynamic';

const DEFAULT_PROGRESSION = {
  current_memorizing: { surah: 1, ayah: 1 },
  learned_ayahs: [],
  streak: 0,
  last_active_date: '',
  notification_time: '13:00',
  push_subscription: null
};

export async function GET() {
  try {
    let data = await kv.get<any>(KV_KEY);
    if (!data) {
      data = DEFAULT_PROGRESSION;
      await kv.set(KV_KEY, data);
    }
    return NextResponse.json(data, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Error fetching progression:', error);
    return NextResponse.json({ error: 'Failed to fetch progression' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Simple verification
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Merge with current data to avoid overwriting push_subscription if not sent
    const currentData = await kv.get<any>(KV_KEY) || DEFAULT_PROGRESSION;
    
    const updatedData = {
      ...currentData,
      ...body,
      // Make sure we keep the subscription unless it is explicitly cleared
      push_subscription: body.push_subscription !== undefined ? body.push_subscription : currentData.push_subscription
    };

    await kv.set(KV_KEY, updatedData);
    return NextResponse.json({ success: true, data: updatedData }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Error saving progression:', error);
    return NextResponse.json({ error: 'Failed to save progression' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
