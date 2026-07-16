export interface AyahRef {
  surah: number;
  ayah: number;
}

export interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
  translation: string;
  transliteration: string;
}

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  ayahs: Ayah[];
}

export interface QuranData {
  surahs: Surah[];
}

export type VerseStatus = 'acquis' | 'a_reviser';

export interface SurahProgress {
  name: string;
  verses: Record<string, VerseStatus>;
}

export type ProgressionBySurah = Record<string, SurahProgress>;

export interface Progression {
  current_memorizing: AyahRef;
  learned_ayahs: AyahRef[];
  progression: ProgressionBySurah;
  streak: number;
  last_active_date: string;
  notification_time: string;
  push_subscription: PushSubscriptionJSON | null;
  revised_today?: AyahRef[];
}

export function migrateProgressionBySurah(
  progression: Progression,
  quran?: QuranData
): Progression {
  const structured: ProgressionBySurah = {};

  for (const [surahNumber, surahProgress] of Object.entries(progression.progression || {})) {
    const verses = Object.fromEntries(
      Object.entries(surahProgress?.verses || {}).filter(
        (entry): entry is [string, VerseStatus] => entry[1] === 'acquis' || entry[1] === 'a_reviser'
      )
    );

    if (Object.keys(verses).length > 0) {
      structured[surahNumber] = {
        name: surahProgress.name || `Sourate ${surahNumber}`,
        verses
      };
    }
  }

  for (const learned of progression.learned_ayahs || []) {
    const surahKey = String(learned.surah);
    const surahName = quran?.surahs.find((surah) => surah.number === learned.surah)?.englishName;
    const current = structured[surahKey] || {
      name: surahName || `Sourate ${surahKey}`,
      verses: {}
    };

    structured[surahKey] = {
      name: surahName || current.name,
      verses: {
        ...current.verses,
        [String(learned.ayah)]: current.verses[String(learned.ayah)] || 'acquis'
      }
    };
  }

  return {
    ...progression,
    progression: structured
  };
}

export function updateVerseStatus(
  progression: Progression,
  surahNumber: number,
  surahName: string,
  ayahNumber: number,
  status: VerseStatus
): Progression {
  const normalized = migrateProgressionBySurah(progression);
  const surahKey = String(surahNumber);
  const current = normalized.progression[surahKey] || { name: surahName, verses: {} };

  return {
    ...normalized,
    progression: {
      ...normalized.progression,
      [surahKey]: {
        name: surahName || current.name,
        verses: {
          ...current.verses,
          [String(ayahNumber)]: status
        }
      }
    }
  };
}

export function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPreviousDateString(date = new Date()) {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return getDateString(previous);
}

export function calculateNextStreak(
  progression: Pick<Progression, 'last_active_date' | 'streak'>,
  today = getDateString(),
  yesterday = getPreviousDateString()
) {
  if (progression.last_active_date === '') {
    return 1;
  }

  if (progression.last_active_date === yesterday) {
    return progression.streak + 1;
  }

  if (progression.last_active_date !== today) {
    return 1;
  }

  return progression.streak;
}

export function normalizeProgressionForToday(
  progression: Progression,
  today = getDateString(),
  yesterday = getPreviousDateString()
): Progression {
  if (progression.last_active_date === '') {
    return {
      ...progression,
      streak: 0,
      revised_today: progression.revised_today || []
    };
  }

  if (progression.last_active_date === today || progression.last_active_date === yesterday) {
    return {
      ...progression,
      streak: progression.streak || 0,
      revised_today: progression.revised_today || []
    };
  }

  return {
    ...progression,
    streak: 0,
    revised_today: []
  };
}

export function findAdjacentAyah(
  quran: QuranData,
  selectedSurahIndex: number,
  selectedAyahIndex: number,
  direction: 'next' | 'prev'
) {
  const currentSurah = quran.surahs[selectedSurahIndex];
  if (!currentSurah) {
    return null;
  }

  if (direction === 'next') {
    if (selectedAyahIndex < currentSurah.ayahs.length - 1) {
      return { surahIndex: selectedSurahIndex, ayahIndex: selectedAyahIndex + 1 };
    }

    if (selectedSurahIndex < quran.surahs.length - 1) {
      return { surahIndex: selectedSurahIndex + 1, ayahIndex: 0 };
    }

    return null;
  }

  if (selectedAyahIndex > 0) {
    return { surahIndex: selectedSurahIndex, ayahIndex: selectedAyahIndex - 1 };
  }

  if (selectedSurahIndex > 0) {
    const previousSurahIndex = selectedSurahIndex - 1;
    return {
      surahIndex: previousSurahIndex,
      ayahIndex: quran.surahs[previousSurahIndex].ayahs.length - 1
    };
  }

  return null;
}

export function getNextMemorizationTarget(quran: QuranData, currentSurah: Surah, currentAyah: Ayah): AyahRef {
  if (currentAyah.numberInSurah < currentSurah.ayahs.length) {
    return {
      surah: currentSurah.number,
      ayah: currentAyah.numberInSurah + 1
    };
  }

  if (currentSurah.number < quran.surahs.length) {
    return {
      surah: currentSurah.number + 1,
      ayah: 1
    };
  }

  return {
    surah: currentSurah.number,
    ayah: currentSurah.ayahs.length
  };
}

export function markAyahAsLearned(
  progression: Progression,
  quran: QuranData,
  currentSurah: Surah,
  currentAyah: Ayah,
  today = getDateString(),
  yesterday = getPreviousDateString()
): Progression {
  const alreadyLearned = progression.learned_ayahs.some(
    (ayah) => ayah.surah === currentSurah.number && ayah.ayah === currentAyah.numberInSurah
  );

  const learnedAyahs = alreadyLearned
    ? progression.learned_ayahs
    : [
        ...progression.learned_ayahs,
        { surah: currentSurah.number, ayah: currentAyah.numberInSurah }
      ];

  return updateVerseStatus({
    ...progression,
    learned_ayahs: learnedAyahs,
    current_memorizing: getNextMemorizationTarget(quran, currentSurah, currentAyah),
    streak: calculateNextStreak(progression, today, yesterday),
    last_active_date: today
  }, currentSurah.number, currentSurah.englishName, currentAyah.numberInSurah, 'acquis');
}

export function toggleRevisedAyahForToday(
  progression: Progression,
  ayahRef: AyahRef,
  today = getDateString(),
  yesterday = getPreviousDateString()
): Progression {
  const currentRevisions = progression.revised_today || [];
  const alreadyRevised = currentRevisions.some(
    (revision) => revision.surah === ayahRef.surah && revision.ayah === ayahRef.ayah
  );

  const revisedToday = alreadyRevised
    ? currentRevisions.filter(
        (revision) => !(revision.surah === ayahRef.surah && revision.ayah === ayahRef.ayah)
      )
    : [...currentRevisions, ayahRef];

  return {
    ...progression,
    revised_today: revisedToday,
    streak: calculateNextStreak(progression, today, yesterday),
    last_active_date: today
  };
}
