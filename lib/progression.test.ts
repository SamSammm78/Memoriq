import { describe, expect, it } from 'vitest';
import {
  calculateNextStreak,
  findAdjacentAyah,
  markAyahAsLearned,
  normalizeProgressionForToday,
  toggleRevisedAyahForToday,
  type Progression,
  type QuranData
} from './progression';

const quran: QuranData = {
  surahs: [
    {
      number: 1,
      name: 'Al-Fatihah',
      englishName: 'Al-Fatihah',
      englishNameTranslation: 'The Opening',
      ayahs: [
        { number: 1, numberInSurah: 1, text: 'ayah 1', translation: '', transliteration: '' },
        { number: 2, numberInSurah: 2, text: 'ayah 2', translation: '', transliteration: '' }
      ]
    },
    {
      number: 2,
      name: 'Al-Baqarah',
      englishName: 'Al-Baqarah',
      englishNameTranslation: 'The Cow',
      ayahs: [
        { number: 3, numberInSurah: 1, text: 'ayah 1', translation: '', transliteration: '' },
        { number: 4, numberInSurah: 2, text: 'ayah 2', translation: '', transliteration: '' }
      ]
    }
  ]
};

const baseProgression: Progression = {
  current_memorizing: { surah: 1, ayah: 1 },
  learned_ayahs: [],
  streak: 0,
  last_active_date: '',
  notification_time: '13:00',
  push_subscription: null,
  revised_today: []
};

describe('progression rules', () => {
  it('marks the current ayah as learned and moves to the next ayah', () => {
    const updated = markAyahAsLearned(
      baseProgression,
      quran,
      quran.surahs[0],
      quran.surahs[0].ayahs[0],
      '2026-07-05',
      '2026-07-04'
    );

    expect(updated.learned_ayahs).toEqual([{ surah: 1, ayah: 1 }]);
    expect(updated.current_memorizing).toEqual({ surah: 1, ayah: 2 });
    expect(updated.streak).toBe(1);
    expect(updated.last_active_date).toBe('2026-07-05');
  });

  it('does not duplicate a learned ayah', () => {
    const updated = markAyahAsLearned(
      { ...baseProgression, learned_ayahs: [{ surah: 1, ayah: 1 }] },
      quran,
      quran.surahs[0],
      quran.surahs[0].ayahs[0],
      '2026-07-05',
      '2026-07-04'
    );

    expect(updated.learned_ayahs).toEqual([{ surah: 1, ayah: 1 }]);
  });

  it('increments, keeps, or resets the streak based on the last active date', () => {
    expect(calculateNextStreak({ streak: 2, last_active_date: '2026-07-04' }, '2026-07-05', '2026-07-04')).toBe(3);
    expect(calculateNextStreak({ streak: 2, last_active_date: '2026-07-05' }, '2026-07-05', '2026-07-04')).toBe(2);
    expect(calculateNextStreak({ streak: 8, last_active_date: '2026-07-02' }, '2026-07-05', '2026-07-04')).toBe(1);
    expect(calculateNextStreak({ streak: 0, last_active_date: '' }, '2026-07-05', '2026-07-04')).toBe(1);
  });

  it('moves to the first ayah of the next surah after the last ayah', () => {
    expect(findAdjacentAyah(quran, 0, 1, 'next')).toEqual({ surahIndex: 1, ayahIndex: 0 });
    expect(findAdjacentAyah(quran, 1, 0, 'prev')).toEqual({ surahIndex: 0, ayahIndex: 1 });
  });

  it('resets daily revisions and streak after a missed day', () => {
    const normalized = normalizeProgressionForToday(
      {
        ...baseProgression,
        streak: 5,
        last_active_date: '2026-07-02',
        revised_today: [{ surah: 1, ayah: 1 }]
      },
      '2026-07-05',
      '2026-07-04'
    );

    expect(normalized.streak).toBe(0);
    expect(normalized.revised_today).toEqual([]);
  });

  it('toggles a reviewed ayah and updates daily activity', () => {
    const revised = toggleRevisedAyahForToday(
      { ...baseProgression, streak: 3, last_active_date: '2026-07-04' },
      { surah: 1, ayah: 1 },
      '2026-07-05',
      '2026-07-04'
    );

    expect(revised.revised_today).toEqual([{ surah: 1, ayah: 1 }]);
    expect(revised.streak).toBe(4);
    expect(revised.last_active_date).toBe('2026-07-05');

    const unrevised = toggleRevisedAyahForToday(
      revised,
      { surah: 1, ayah: 1 },
      '2026-07-05',
      '2026-07-04'
    );

    expect(unrevised.revised_today).toEqual([]);
    expect(unrevised.streak).toBe(4);
  });
});
