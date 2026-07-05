import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { sendNotification } from '@/lib/push';
import fs from 'fs';
import path from 'path';

const KV_KEY = 'memoriq:progression';

export async function GET(request: Request) {
  // Support Vercel CRON secret header security if configured
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const progression = await kv.get<any>(KV_KEY);
    if (!progression) {
      return NextResponse.json({ success: true, message: 'No progression data found.' });
    }

    const { current_memorizing, push_subscription } = progression;
    if (!push_subscription) {
      return NextResponse.json({ success: true, message: 'No active push subscription found.' });
    }

    const surahNum = current_memorizing?.surah || 1;
    const ayahNum = current_memorizing?.ayah || 1;

    // Load surah name dynamically from our offline dataset
    let surahName = 'Al-Fatihah';
    try {
      const quranPath = path.join(process.cwd(), 'public', 'data', 'quran.json');
      if (fs.existsSync(quranPath)) {
        const quranData = JSON.parse(fs.readFileSync(quranPath, 'utf-8'));
        const surah = quranData.surahs.find((s: any) => s.number === surahNum);
        if (surah) {
          // e.g. "Al-Fatiha"
          surahName = surah.englishName;
        }
      }
    } catch (e) {
      console.error('Error reading surah name for notification:', e);
    }

    const payload = JSON.stringify({
      title: 'Memoriq 📖',
      body: `C'est l'heure de votre session de mémorisation ! Verset à revoir : Sourate ${surahName}, Verset ${ayahNum}.`,
      url: '/'
    });

    const result = await sendNotification(push_subscription, payload);

    if (!result.success && result.expired) {
      // Clean up invalid/expired subscription
      progression.push_subscription = null;
      await kv.set(KV_KEY, progression);
      console.log('[Cron] Cleaned up expired/invalid subscription from KV.');
      return NextResponse.json({ success: true, message: 'Subscription expired and removed' });
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[Cron] daily-reminder error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
