import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import quranData from '@/public/data/quran.json';
import {
  migrateProgressionBySurah,
  updateVerseStatus,
  type Progression,
  type QuranData,
  type VerseStatus
} from '@/lib/progression';

const KV_KEY = 'memoriq:progression';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export const dynamic = 'force-dynamic';

const DEFAULT_PROGRESSION = {
  current_memorizing: { surah: 1, ayah: 1 },
  learned_ayahs: [],
  progression: {},
  streak: 0,
  last_active_date: '',
  notification_time: '13:00',
  push_subscription: null
};

export async function GET() {
  try {
    let data = await kv.get<Progression>(KV_KEY);
    if (!data) {
      data = DEFAULT_PROGRESSION as Progression;
      await kv.set(KV_KEY, data);
    }
    const migratedData = migrateProgressionBySurah(data, quranData as QuranData);
    if (JSON.stringify(data.progression || {}) !== JSON.stringify(migratedData.progression)) {
      await kv.set(KV_KEY, migratedData);
    }
    data = migratedData;
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
    const currentData = await kv.get<Progression>(KV_KEY) || DEFAULT_PROGRESSION as Progression;
    
    const updatedData = migrateProgressionBySurah({
      ...currentData,
      ...body,
      // Make sure we keep the subscription unless it is explicitly cleared
      push_subscription: body.push_subscription !== undefined ? body.push_subscription : currentData.push_subscription
    }, quranData as QuranData);

    await kv.set(KV_KEY, updatedData);
    return NextResponse.json({ success: true, data: updatedData }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Error saving progression:', error);
    return NextResponse.json({ error: 'Failed to save progression' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      surah?: number;
      ayah?: number;
      name?: string;
      status?: VerseStatus;
    };

    if (
      !Number.isInteger(body.surah) ||
      !Number.isInteger(body.ayah) ||
      typeof body.name !== 'string' ||
      (body.status !== 'acquis' && body.status !== 'a_reviser')
    ) {
      return NextResponse.json({ error: 'Invalid verse status update' }, { status: 400 });
    }

    const currentData = await kv.get<Progression>(KV_KEY) || DEFAULT_PROGRESSION as Progression;
    const normalized = migrateProgressionBySurah(currentData, quranData as QuranData);
    const updatedData = updateVerseStatus(
      normalized,
      body.surah as number,
      body.name,
      body.ayah as number,
      body.status
    );

    await kv.set(KV_KEY, updatedData);
    return NextResponse.json({ success: true, data: updatedData }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Error updating verse status:', error);
    return NextResponse.json(
      { error: 'Failed to update verse status' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
