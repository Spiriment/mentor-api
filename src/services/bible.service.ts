import axios from 'axios';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

// Supported languages: English (eng), German (deu), Dutch (nld)
export type BibleLanguage = 'eng' | 'deu' | 'nld';

// Book name mapping between bible-api.com format and Bible Brain format
const BOOK_NAME_MAP: Record<string, string> = {
  // Common books
  'Genesis': 'GEN',
  'Exodus': 'EXO',
  'Leviticus': 'LEV',
  'Numbers': 'NUM',
  'Deuteronomy': 'DEU',
  'Joshua': 'JOS',
  'Judges': 'JDG',
  'Ruth': 'RUT',
  '1 Samuel': '1SA',
  '2 Samuel': '2SA',
  '1 Kings': '1KI',
  '2 Kings': '2KI',
  '1 Chronicles': '1CH',
  '2 Chronicles': '2CH',
  'Ezra': 'EZR',
  'Nehemiah': 'NEH',
  'Esther': 'EST',
  'Job': 'JOB',
  'Psalms': 'PSA',
  'Proverbs': 'PRO',
  'Ecclesiastes': 'ECC',
  'Song of Solomon': 'SNG',
  'Isaiah': 'ISA',
  'Jeremiah': 'JER',
  'Lamentations': 'LAM',
  'Ezekiel': 'EZK',
  'Daniel': 'DAN',
  'Hosea': 'HOS',
  'Joel': 'JOL',
  'Amos': 'AMO',
  'Obadiah': 'OBA',
  'Jonah': 'JON',
  'Micah': 'MIC',
  'Nahum': 'NAM',
  'Habakkuk': 'HAB',
  'Zephaniah': 'ZEP',
  'Haggai': 'HAG',
  'Zechariah': 'ZEC',
  'Malachi': 'MAL',
  'Matthew': 'MAT',
  'Mark': 'MRK',
  'Luke': 'LUK',
  'John': 'JHN',
  'Acts': 'ACT',
  'Romans': 'ROM',
  '1 Corinthians': '1CO',
  '2 Corinthians': '2CO',
  'Galatians': 'GAL',
  'Ephesians': 'EPH',
  'Philippians': 'PHP',
  'Colossians': 'COL',
  '1 Thessalonians': '1TH',
  '2 Thessalonians': '2TH',
  '1 Timothy': '1TI',
  '2 Timothy': '2TI',
  'Titus': 'TIT',
  'Philemon': 'PHM',
  'Hebrews': 'HEB',
  'James': 'JAS',
  '1 Peter': '1PE',
  '2 Peter': '2PE',
  '1 John': '1JN',
  '2 John': '2JN',
  '3 John': '3JN',
  'Jude': 'JUD',
  'Revelation': 'REV',
};

// Reverse mapping for Bible Brain -> bible-api.com
const REVERSE_BOOK_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(BOOK_NAME_MAP).map(([key, value]) => [value, key])
);

export class BibleService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;
  private bibleBrainApiKey: string;
  private bibleBrainBaseUrl = 'https://4.dbt.io';

  constructor(options?: {
    maxEntries?: number;
    defaultTtlMs?: number;
    bibleBrainApiKey?: string;
  }) {
    this.maxEntries = options?.maxEntries ?? 1000;
    this.defaultTtlMs = options?.defaultTtlMs ?? 24 * 60 * 60 * 1000; // 24h
    this.bibleBrainApiKey =
      options?.bibleBrainApiKey ||
      process.env.BIBLE_BRAIN_API_KEY ||
      '6aa97969-97d4-4b7b-a3df-0a70f043056c';
  }

  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private setCache<T>(key: string, value: T, ttlMs?: number) {
    if (this.cache.size >= this.maxEntries) {
      // simple LRU-ish eviction: delete first inserted key
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  /**
   * Get Bible Brain Bible ID for a language
   * Default Bible versions:
   * - English: ASV (American Standard Version) or KJV
   * - German: Luther 2017
   * - Dutch: NBV (Nieuwe Bijbelvertaling)
   */
  private async getBibleBrainBibleId(
    language: BibleLanguage = 'eng'
  ): Promise<string> {
    const cacheKey = `bible_id:${language}`;
    const cached = this.getCache<string>(cacheKey);
    if (cached) return cached;

    try {
      // Get available Bibles for the language
      const response = await axios.get(
        `${this.bibleBrainBaseUrl}/library/language`,
        {
          params: {
            key: this.bibleBrainApiKey,
            language_code: language,
            v: 4,
          },
        }
      );

      // Prefer specific Bible versions
      const preferredBibles: Record<BibleLanguage, string[]> = {
        eng: ['ASV', 'KJV', 'WEB'], // English
        deu: ['LUTH', 'ELB'], // German - Luther, Elberfelder
        nld: ['NBV', 'NBG'], // Dutch - Nieuwe Bijbelvertaling, NBG
      };

      const bibles = response.data?.data || [];
      const preferred = preferredBibles[language] || [];

      // Find preferred Bible or use first available
      let bibleId = bibles.find((b: any) =>
        preferred.some((p) => b.id?.includes(p))
      )?.id;

      if (!bibleId && bibles.length > 0) {
        bibleId = bibles[0].id;
      }

      if (bibleId) {
        this.setCache(cacheKey, bibleId, 7 * 24 * 60 * 60 * 1000); // Cache for 7 days
        return bibleId;
      }

      throw new Error(`No Bible found for language: ${language}`);
    } catch (error) {
      console.error(`Error getting Bible ID for ${language}:`, error);
      // Fallback to default IDs
      const fallbackIds: Record<BibleLanguage, string> = {
        eng: 'ENGASV', // Fallback
        deu: 'DEULUT', // Fallback
        nld: 'NLDNBV', // Fallback
      };
      return fallbackIds[language] || 'ENGASV';
    }
  }

  /**
   * Fetch chapter from Bible Brain API
   * Note: Bible Brain API structure may need adjustment based on actual API response
   * This implementation attempts to use the DBP4 API structure
   */
  private async getChapterFromBibleBrain(
    book: string,
    chapter: number,
    language: BibleLanguage = 'eng'
  ) {
    try {
      const bibleId = await this.getBibleBrainBibleId(language);
      const bookCode = BOOK_NAME_MAP[book] || book.toUpperCase().substring(0, 3);

      // Try to get Bible books - API structure may vary
      // Option 1: Try /library/book endpoint
      let books: any[] = [];
      try {
        const booksResponse = await axios.get(
          `${this.bibleBrainBaseUrl}/library/book`,
          {
            params: {
              key: this.bibleBrainApiKey,
              dam_id: bibleId,
              v: 4,
            },
          }
        );
        books = booksResponse.data?.data || booksResponse.data || [];
      } catch (error) {
        console.warn('Error fetching books, trying alternative endpoint:', error);
        // Try alternative endpoint structure
        try {
          const altResponse = await axios.get(
            `${this.bibleBrainBaseUrl}/bibles/${bibleId}/books`,
            {
              params: {
                key: this.bibleBrainApiKey,
                v: 4,
              },
            }
          );
          books = altResponse.data?.data || altResponse.data || [];
        } catch (altError) {
          console.error('Alternative book endpoint also failed:', altError);
        }
      }

      const bookData = books.find(
        (b: any) =>
          b.book_code === bookCode ||
          b.code === bookCode ||
          b.abbr === bookCode ||
          b.name?.toLowerCase().includes(book.toLowerCase())
      );

      if (!bookData) {
        throw new Error(`Book not found: ${book} (code: ${bookCode})`);
      }

      const bookId = bookData.book_id || bookData.id || bookData.num;

      // Get verses for the chapter
      // Try multiple possible endpoint structures
      let verses: any[] = [];
      try {
        const versesResponse = await axios.get(
          `${this.bibleBrainBaseUrl}/library/verse`,
          {
            params: {
              key: this.bibleBrainApiKey,
              dam_id: bibleId,
              book_id: bookId,
              chapter_id: chapter.toString(),
              v: 4,
            },
          }
        );
        verses = versesResponse.data?.data || versesResponse.data || [];
      } catch (error) {
        console.warn('Error fetching verses, trying alternative endpoint:', error);
        // Try alternative structure
        try {
          const altResponse = await axios.get(
            `${this.bibleBrainBaseUrl}/bibles/${bibleId}/books/${bookId}/chapters/${chapter}/verses`,
            {
              params: {
                key: this.bibleBrainApiKey,
                v: 4,
              },
            }
          );
          verses = altResponse.data?.data || altResponse.data || [];
        } catch (altError) {
          console.error('Alternative verse endpoint also failed:', altError);
          throw altError;
        }
      }

      // Format response similar to bible-api.com format for consistency
      const formattedVerses = verses.map((verse: any, index: number) => {
        const verseNum = verse.verse_id || verse.id || verse.verse || (index + 1);
        const verseText = verse.verse_text || verse.text || verse.content || '';
        return {
          book_id: bookId,
          book_name: book,
          chapter: chapter,
          verse: verseNum,
          text: verseText,
        };
      });

      return {
        reference: `${book} ${chapter}`,
        verses: formattedVerses,
        text: formattedVerses.map((v: any) => `${v.verse} ${v.text}`).join(' '),
        translation: bibleId,
        translation_name: bibleId,
        translation_note: `Bible Brain - ${language.toUpperCase()}`,
      };
    } catch (error: any) {
      console.error('Error fetching from Bible Brain:', error);
      throw new Error(`Bible Brain API error: ${error.message}`);
    }
  }

  /**
   * Fetch chapter from bible-api.com (fallback)
   */
  private async getChapterFromBibleApi(book: string, chapter: number) {
    const url = `https://bible-api.com/${encodeURIComponent(book)}+${chapter}`;
    const { data } = await axios.get(url);
    return data;
  }

  /**
   * Fetch a chapter with language support and fallback
   */
  async getChapter(
    book: string,
    chapter: number,
    language: BibleLanguage = 'eng'
  ) {
    const key = `chapter:${book}:${chapter}:${language}`;
    const cached = this.getCache<any>(key);
    if (cached) return cached;

    // Try Bible Brain first (supports multiple languages)
    if (language !== 'eng' || this.bibleBrainApiKey) {
      try {
        const data = await this.getChapterFromBibleBrain(book, chapter, language);
        this.setCache(key, data, this.defaultTtlMs);
        return data;
      } catch (error) {
        console.warn('Bible Brain failed, trying bible-api.com:', error);
        // Fall through to bible-api.com
      }
    }

    // Fallback to bible-api.com (English only)
    try {
      const data = await this.getChapterFromBibleApi(book, chapter);
      this.setCache(key, data, this.defaultTtlMs);
      return data;
    } catch (error) {
      console.error('Both Bible APIs failed:', error);
      throw new Error(
        `Failed to fetch chapter: ${book} ${chapter} in ${language}`
      );
    }
  }

  /**
   * Fetch a passage by reference string with language support
   */
  async getPassage(
    reference: string,
    language: BibleLanguage = 'eng'
  ) {
    const key = `passage:${reference}:${language}`;
    const cached = this.getCache<any>(key);
    if (cached) return cached;

    // Try Bible Brain first
    if (language !== 'eng' || this.bibleBrainApiKey) {
      try {
        // Parse reference (e.g., "John 3:16-18")
        const match = reference.match(/(\w+)\s+(\d+):(\d+)(?:-(\d+))?/);
        if (match) {
          const [, book, chapter, startVerse, endVerse] = match;
          const chapterData = await this.getChapterFromBibleBrain(
            book,
            parseInt(chapter),
            language
          );

          // Filter verses
          const start = parseInt(startVerse);
          const end = endVerse ? parseInt(endVerse) : start;
          const filteredVerses = chapterData.verses.filter(
            (v: any) => v.verse >= start && v.verse <= end
          );

          return {
            reference,
            verses: filteredVerses,
            text: filteredVerses.map((v: any) => `${v.verse} ${v.text}`).join(' '),
            translation: chapterData.translation,
            translation_name: chapterData.translation_name,
          };
        }
      } catch (error) {
        console.warn('Bible Brain failed for passage, trying bible-api.com:', error);
      }
    }

    // Fallback to bible-api.com
    try {
      const url = `https://bible-api.com/${encodeURIComponent(reference)}`;
      const { data } = await axios.get(url);
      this.setCache(key, data, 60 * 60 * 1000); // 1h
      return data;
    } catch (error) {
      console.error('Both Bible APIs failed for passage:', error);
      throw new Error(`Failed to fetch passage: ${reference} in ${language}`);
    }
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): BibleLanguage[] {
    return ['eng', 'deu', 'nld'];
  }

  /**
   * Get language name
   */
  getLanguageName(language: BibleLanguage): string {
    const names: Record<BibleLanguage, string> = {
      eng: 'English',
      deu: 'Deutsch (German)',
      nld: 'Nederlands (Dutch)',
    };
    return names[language] || language;
  }
}
