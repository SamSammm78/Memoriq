import fs from 'fs';
import path from 'path';

const ARABIC_URL = 'https://api.alquran.cloud/v1/quran/quran-uthmani';
const TRANSLATION_URL = 'https://api.alquran.cloud/v1/quran/fr.hamidullah';
const TRANSLITERATION_URL = 'https://api.alquran.cloud/v1/quran/en.transliteration';

async function fetchJson(url) {
  console.log(`Fetching: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.json();
}

async function main() {
  try {
    const startTime = Date.now();
    console.log('Starting compilation of Quran data...');

    // Fetch all three editions
    const [arabicRes, translationRes, transliterationRes] = await Promise.all([
      fetchJson(ARABIC_URL),
      fetchJson(TRANSLATION_URL),
      fetchJson(TRANSLITERATION_URL)
    ]);

    console.log('Successfully fetched all editions. Merging...');

    const arabicSurahs = arabicRes.data.surahs;
    const translationSurahs = translationRes.data.surahs;
    const transliterationSurahs = transliterationRes.data.surahs;

    const mergedSurahs = arabicSurahs.map((surah, surahIdx) => {
      const transSurah = translationSurahs[surahIdx];
      const translitSurah = transliterationSurahs[surahIdx];

      return {
        number: surah.number,
        name: surah.name,
        englishName: surah.englishName,
        englishNameTranslation: surah.englishNameTranslation,
        ayahs: surah.ayahs.map((ayah, ayahIdx) => {
          const transAyah = transSurah.ayahs[ayahIdx];
          const translitAyah = translitSurah.ayahs[ayahIdx];

          return {
            number: ayah.number,
            numberInSurah: ayah.numberInSurah,
            text: ayah.text,
            translation: transAyah.text,
            transliteration: translitAyah.text
          };
        })
      };
    });

    const outputData = {
      surahs: mergedSurahs
    };

    const outputDir = path.join(process.cwd(), 'public', 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'quran.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData));

    const stats = fs.statSync(outputPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`Success! Combined Quran data written to ${outputPath}`);
    console.log(`File size: ${sizeInMB} MB`);
    console.log(`Execution time: ${((Date.now() - startTime) / 1000).toFixed(2)} seconds`);
  } catch (error) {
    console.error('Error compiling Quran data:', error);
    process.exit(1);
  }
}

main();
