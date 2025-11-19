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
  Genesis: 'GEN',
  Exodus: 'EXO',
  Leviticus: 'LEV',
  Numbers: 'NUM',
  Deuteronomy: 'DEU',
  Joshua: 'JOS',
  Judges: 'JDG',
  Ruth: 'RUT',
  '1 Samuel': '1SA',
  '2 Samuel': '2SA',
  '1 Kings': '1KI',
  '2 Kings': '2KI',
  '1 Chronicles': '1CH',
  '2 Chronicles': '2CH',
  Ezra: 'EZR',
  Nehemiah: 'NEH',
  Esther: 'EST',
  Job: 'JOB',
  Psalms: 'PSA',
  Proverbs: 'PRO',
  Ecclesiastes: 'ECC',
  'Song of Solomon': 'SNG',
  Isaiah: 'ISA',
  Jeremiah: 'JER',
  Lamentations: 'LAM',
  Ezekiel: 'EZK',
  Daniel: 'DAN',
  Hosea: 'HOS',
  Joel: 'JOL',
  Amos: 'AMO',
  Obadiah: 'OBA',
  Jonah: 'JON',
  Micah: 'MIC',
  Nahum: 'NAM',
  Habakkuk: 'HAB',
  Zephaniah: 'ZEP',
  Haggai: 'HAG',
  Zechariah: 'ZEC',
  Malachi: 'MAL',
  Matthew: 'MAT',
  Mark: 'MRK',
  Luke: 'LUK',
  John: 'JHN',
  Acts: 'ACT',
  Romans: 'ROM',
  '1 Corinthians': '1CO',
  '2 Corinthians': '2CO',
  Galatians: 'GAL',
  Ephesians: 'EPH',
  Philippians: 'PHP',
  Colossians: 'COL',
  '1 Thessalonians': '1TH',
  '2 Thessalonians': '2TH',
  '1 Timothy': '1TI',
  '2 Timothy': '2TI',
  Titus: 'TIT',
  Philemon: 'PHM',
  Hebrews: 'HEB',
  James: 'JAS',
  '1 Peter': '1PE',
  '2 Peter': '2PE',
  '1 John': '1JN',
  '2 John': '2JN',
  '3 John': '3JN',
  Jude: 'JUD',
  Revelation: 'REV',
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
   * Get Bible Brain FilesetId for a language
   * Uses the correct DBP4 API endpoints:
   * - GET /api/bibles to get available Bibles
   * - GET /api/bibles/filesets to get text filesets
   *
   * Default Bible versions:
   * - English: ASV (American Standard Version) or KJV
   * - German: Luther 2017
   * - Dutch: NBV (Nieuwe Bijbelvertaling)
   */
  private async getBibleBrainFilesetId(
    language: BibleLanguage = 'eng'
  ): Promise<string> {
    const cacheKey = `fileset_id:${language}`;
    const cached = this.getCache<string>(cacheKey);
    if (cached) return cached;

    try {
      // Step 1: Get available Bibles using correct endpoint
      // Language code needs to be uppercase (ENG, DEU, NLD)
      const languageCode = language.toUpperCase();
      const response = await axios.get(`${this.bibleBrainBaseUrl}/api/bibles`, {
        params: {
          key: this.bibleBrainApiKey,
          language_family_code: languageCode,
        },
      });

      // Handle different response formats from Bible Brain API
      let bibles: any[] = [];
      if (Array.isArray(response.data?.data)) {
        bibles = response.data.data;
      } else if (Array.isArray(response.data)) {
        bibles = response.data;
      } else if (
        response.data?.data &&
        typeof response.data.data === 'object'
      ) {
        bibles = Object.values(response.data.data);
      }

      if (bibles.length === 0) {
        console.warn(
          `No bibles found for language ${language}, response:`,
          response.data
        );
      }

      // Prefer specific Bible versions
      const preferredBibles: Record<BibleLanguage, string[]> = {
        eng: ['ASV', 'KJV', 'WEB', 'ENG'], // English
        deu: ['LUTH', 'ELB', 'DEU'], // German - Luther, Elberfelder
        nld: ['NBV', 'NBG', 'NLD'], // Dutch - Nieuwe Bijbelvertaling, NBG
      };

      const preferred = preferredBibles[language] || [];

      // Find preferred Bible or use first available
      let bibleId = bibles.find((b: any) =>
        preferred.some(
          (p) =>
            b.id?.includes(p) ||
            b.abbreviation?.includes(p) ||
            b.name?.toUpperCase().includes(p) ||
            b.id?.toUpperCase().includes(p)
        )
      )?.id;

      if (!bibleId && bibles.length > 0) {
        bibleId = bibles[0].id;
      }

      if (!bibleId) {
        console.error(
          `No Bible found for language: ${language}, available bibles:`,
          bibles
        );
        throw new Error(`No Bible found for language: ${language}`);
      }

      // Step 2: Get filesets for this Bible to find text fileset
      const filesetsResponse = await axios.get(
        `${this.bibleBrainBaseUrl}/api/bibles/filesets`,
        {
          params: {
            key: this.bibleBrainApiKey,
            bible_id: bibleId,
            type: 'text', // We want text filesets
          },
        }
      );

      // Handle different response formats
      let filesets: any[] = [];
      if (Array.isArray(filesetsResponse.data?.data)) {
        filesets = filesetsResponse.data.data;
      } else if (Array.isArray(filesetsResponse.data)) {
        filesets = filesetsResponse.data;
      } else if (
        filesetsResponse.data?.data &&
        typeof filesetsResponse.data.data === 'object'
      ) {
        filesets = Object.values(filesetsResponse.data.data);
      }

      if (filesets.length === 0) {
        console.warn(
          `No filesets found for Bible ${bibleId}, response:`,
          filesetsResponse.data
        );
      }

      // Find a complete text fileset
      // Text filesets are usually 6 characters (LLLVVV format) or match the Bible ID pattern
      const textFileset = filesets.find((f: any) => {
        const filesetId = f.id || f.fileset_id || '';
        const filesetType = f.type || f.media_type || '';

        // Prefer text type filesets
        if (filesetType && filesetType.toLowerCase() === 'text') {
          return true;
        }

        // Text filesets are typically 6 characters (language code + version code)
        // Or they match the Bible ID pattern
        return (
          filesetId.length === 6 ||
          (filesetId.startsWith(bibleId.substring(0, 6)) &&
            filesetId.length <= 10) ||
          !filesetType ||
          filesetType.toLowerCase().includes('text')
        );
      });

      const filesetId =
        textFileset?.id ||
        textFileset?.fileset_id ||
        filesets[0]?.id ||
        filesets[0]?.fileset_id;

      if (filesetId) {
        this.setCache(cacheKey, filesetId, 7 * 24 * 60 * 60 * 1000); // Cache for 7 days
        return filesetId;
      }

      throw new Error(`No text fileset found for Bible: ${bibleId}`);
    } catch (error) {
      console.error(`Error getting FilesetId for ${language}:`, error);
      // Fallback to default FilesetIds (6-character text filesets)
      const fallbackIds: Record<BibleLanguage, string> = {
        eng: 'ENGASV', // English ASV text
        deu: 'DEULUT', // German Luther text
        nld: 'NLDNBV', // Dutch NBV text
      };
      return fallbackIds[language] || 'ENGASV';
    }
  }

  /**
   * Fetch chapter from Bible Brain API using DBP4 endpoints
   * Uses correct API structure:
   * - GET /api/text/verse with fileset_id, book_id, chapter_id
   */
  private async getChapterFromBibleBrain(
    book: string,
    chapter: number,
    language: BibleLanguage = 'eng'
  ) {
    try {
      // Get the filesetId for this language
      const filesetId = await this.getBibleBrainFilesetId(language);
      const bookCode =
        BOOK_NAME_MAP[book] || book.toUpperCase().substring(0, 3);

      // Get book information - need to find the book_id
      // First, try to get books from the fileset
      let bookId: string | number | null = null;

      try {
        // Try to get books for this fileset
        const booksResponse = await axios.get(
          `${this.bibleBrainBaseUrl}/api/bibles/books`,
          {
            params: {
              key: this.bibleBrainApiKey,
              fileset_id: filesetId,
            },
          }
        );

        const books = booksResponse.data?.data || booksResponse.data || [];

        // Find the book by code or name
        const bookData = books.find(
          (b: any) =>
            b.book_code === bookCode ||
            b.code === bookCode ||
            b.abbr === bookCode ||
            b.id === bookCode ||
            b.name?.toLowerCase() === book.toLowerCase() ||
            b.name?.toLowerCase().includes(book.toLowerCase())
        );

        if (bookData) {
          bookId =
            bookData.book_id ||
            bookData.id ||
            bookData.num ||
            bookData.book_code;
        }
      } catch (error) {
        console.warn(
          'Error fetching books, will try with book code directly:',
          error
        );
        // If we can't get books list, try using the book code as book_id
        bookId = bookCode;
      }

      if (!bookId) {
        throw new Error(`Book not found: ${book} (code: ${bookCode})`);
      }

      // Get verses for the chapter using the correct DBP4 endpoint
      // GET /api/text/verse?key=...&fileset_id=...&book_id=...&chapter_id=...&verse_start=1&verse_end=999
      const versesResponse = await axios.get(
        `${this.bibleBrainBaseUrl}/api/text/verse`,
        {
          params: {
            key: this.bibleBrainApiKey,
            fileset_id: filesetId,
            book_id: bookId,
            chapter_id: chapter.toString(),
            verse_start: 1,
            verse_end: 999, // Get all verses in the chapter
          },
        }
      );

      // Bible Brain API v4 returns data in different formats
      // Check both response.data.data (array) and response.data (object with data property)
      let verses: any[] = [];

      if (Array.isArray(versesResponse.data?.data)) {
        verses = versesResponse.data.data;
      } else if (Array.isArray(versesResponse.data)) {
        verses = versesResponse.data;
      } else if (
        versesResponse.data?.data &&
        typeof versesResponse.data.data === 'object'
      ) {
        // Sometimes it's an object with verses as properties
        verses = Object.values(versesResponse.data.data);
      } else if (versesResponse.data?.verses) {
        verses = Array.isArray(versesResponse.data.verses)
          ? versesResponse.data.verses
          : Object.values(versesResponse.data.verses);
      }

      if (!verses || verses.length === 0) {
        console.error('Bible Brain API response:', {
          status: versesResponse.status,
          statusText: versesResponse.statusText,
          data: versesResponse.data,
          dataKeys: versesResponse.data ? Object.keys(versesResponse.data) : [],
        });
        throw new Error(
          `No verses found for ${book} ${chapter}. API response format may have changed.`
        );
      }

      // Format response similar to bible-api.com format for consistency
      // Bible Brain API v4 may return verse data in different formats
      const formattedVerses = verses
        .map((verse: any) => {
          // Try multiple possible field names for verse number
          const verseNum =
            verse.verse_id ||
            verse.verse ||
            verse.verse_num ||
            verse.id ||
            (verse.verse_start ? parseInt(verse.verse_start) : null) ||
            0;

          // Try multiple possible field names for verse text
          const verseText =
            verse.verse_text ||
            verse.text ||
            verse.content ||
            verse.scripture_text ||
            verse.scripture ||
            '';

          return {
            book_id: bookId,
            book_name: book,
            chapter: chapter,
            verse: verseNum,
            text: verseText,
          };
        })
        .filter((v: any) => v.verse > 0 && v.text); // Filter out invalid verses

      // Sort verses by verse number
      formattedVerses.sort((a: any, b: any) => a.verse - b.verse);

      return {
        reference: `${book} ${chapter}`,
        verses: formattedVerses,
        text: formattedVerses.map((v: any) => `${v.verse} ${v.text}`).join(' '),
        translation: filesetId,
        translation_name: filesetId,
        translation_note: `Bible Brain - ${language.toUpperCase()}`,
      };
    } catch (error: any) {
      console.error('Error fetching from Bible Brain:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          params: error.config?.params,
        },
      });

      // Provide more helpful error message
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error(
          `Bible Brain API authentication failed. Please check your API key.`
        );
      } else if (error.response?.status === 404) {
        throw new Error(
          `Bible text not found for ${book} ${chapter} in ${language}. The fileset or book may not be available.`
        );
      } else if (error.response?.status >= 500) {
        throw new Error(
          `Bible Brain API server error. Please try again later.`
        );
      } else {
        throw new Error(
          `Bible Brain API error: ${error.message || 'Unknown error'}`
        );
      }
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
        const data = await this.getChapterFromBibleBrain(
          book,
          chapter,
          language
        );
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
  async getPassage(reference: string, language: BibleLanguage = 'eng') {
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
            text: filteredVerses
              .map((v: any) => `${v.verse} ${v.text}`)
              .join(' '),
            translation: chapterData.translation,
            translation_name: chapterData.translation_name,
          };
        }
      } catch (error) {
        console.warn(
          'Bible Brain failed for passage, trying bible-api.com:',
          error
        );
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
