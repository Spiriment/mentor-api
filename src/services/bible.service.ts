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

// Book code to numeric ID mapping (Bible Brain API uses numeric IDs 1-66)
const BOOK_CODE_TO_ID: Record<string, number> = {
  GEN: 1,
  EXO: 2,
  LEV: 3,
  NUM: 4,
  DEU: 5,
  JOS: 6,
  JDG: 7,
  RUT: 8,
  '1SA': 9,
  '2SA': 10,
  '1KI': 11,
  '2KI': 12,
  '1CH': 13,
  '2CH': 14,
  EZR: 15,
  NEH: 16,
  EST: 17,
  JOB: 18,
  PSA: 19,
  PRO: 20,
  ECC: 21,
  SNG: 22,
  ISA: 23,
  JER: 24,
  LAM: 25,
  EZK: 26,
  DAN: 27,
  HOS: 28,
  JOL: 29,
  AMO: 30,
  OBA: 31,
  JON: 32,
  MIC: 33,
  NAM: 34,
  HAB: 35,
  ZEP: 36,
  HAG: 37,
  ZEC: 38,
  MAL: 39,
  MAT: 40,
  MRK: 41,
  LUK: 42,
  JHN: 43,
  ACT: 44,
  ROM: 45,
  '1CO': 46,
  '2CO': 47,
  GAL: 48,
  EPH: 49,
  PHP: 50,
  COL: 51,
  '1TH': 52,
  '2TH': 53,
  '1TI': 54,
  '2TI': 55,
  TIT: 56,
  PHM: 57,
  HEB: 58,
  JAS: 59,
  '1PE': 60,
  '2PE': 61,
  '1JN': 62,
  '2JN': 63,
  '3JN': 64,
  JUD: 65,
  REV: 66,
};

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
   * Get Bible Brain Bible ID (dam_id) for a language along with the full response
   * Uses the correct DBP4 API v4 endpoint:
   * - GET /api/languages with language_code and v:4
   *
   * Default Bible versions:
   * - English: ASV (American Standard Version) or KJV
   * - German: Luther 2017 (DEULUT)
   * - Dutch: NBV (Nieuwe Bijbelvertaling)
   */
  private async getBibleBrainDamIdWithResponse(
    language: BibleLanguage = 'eng'
  ): Promise<{ damId: string; languageResponse: any }> {
    const cacheKey = `dam_id:${language}`;
    const cached = this.getCache<{ damId: string; languageResponse: any }>(
      cacheKey
    );
    if (cached) return cached;

    try {
      // Use the v4 API endpoint: GET /api/languages
      const response = await axios.get(
        `${this.bibleBrainBaseUrl}/api/languages`,
        {
          params: {
            key: this.bibleBrainApiKey,
            language_code: language, // Use lowercase: eng, deu, nld
            v: 4,
          },
        }
      );

      // Handle different response formats from Bible Brain API
      let languages: any[] = [];
      if (Array.isArray(response.data?.data)) {
        languages = response.data.data;
      } else if (Array.isArray(response.data)) {
        languages = response.data;
      } else if (
        response.data?.data &&
        typeof response.data.data === 'object'
      ) {
        languages = Object.values(response.data.data);
      }

      // Log response structure for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Bible Brain] /api/languages response for ${language}:`, {
          hasData: !!response.data,
          dataType: typeof response.data,
          isArray: Array.isArray(response.data),
          dataKeys: response.data ? Object.keys(response.data) : [],
          languagesCount: languages.length,
          firstLanguage: languages[0]
            ? {
                dam_id: languages[0].dam_id,
                id: languages[0].id,
                name: languages[0].name,
                abbreviation: languages[0].abbreviation,
              }
            : null,
        });
      }

      if (languages.length === 0) {
        console.warn(
          `No languages found for ${language}, response:`,
          JSON.stringify(response.data).substring(0, 500)
        );
      }

      // Log response structure for debugging (first time only)
      if (languages.length > 0 && !this.cache.has(`debug_logged:${language}`)) {
        const sample = languages[0];
        console.log(
          `[Bible Brain Debug] /api/languages response structure for ${language}:`,
          {
            totalItems: languages.length,
            sampleItem: {
              dam_id: sample.dam_id,
              id: sample.id,
              name: sample.name,
              abbreviation: sample.abbreviation,
              hasBibles: !!sample.bibles,
              hasFilesets: !!sample.filesets,
              biblesCount: Array.isArray(sample.bibles)
                ? sample.bibles.length
                : 0,
              filesetsCount: Array.isArray(sample.filesets)
                ? sample.filesets.length
                : 0,
              filesetsSample:
                Array.isArray(sample.filesets) && sample.filesets.length > 0
                  ? {
                      id: sample.filesets[0].id,
                      type: sample.filesets[0].type,
                      allKeys: Object.keys(sample.filesets[0]),
                    }
                  : null,
              allKeys: Object.keys(sample),
            },
          }
        );
        this.setCache(`debug_logged:${language}`, true, 60 * 60 * 1000); // Log once per hour
      }

      // The language response contains bibles and filesets arrays
      // We need to get the Bible ID (dam_id) from the bibles array
      const languageEntry = languages[0]; // Get the first language entry
      const languageId = languageEntry?.id || languageEntry?.glotto_id;

      let damId: string | null = null;
      let selectedBible: any = null;
      let bibles: any[] = [];

      // Check if language entry has bibles array
      if (
        languageEntry?.bibles &&
        Array.isArray(languageEntry.bibles) &&
        languageEntry.bibles.length > 0
      ) {
        bibles = languageEntry.bibles;
      } else if (languageId) {
        // If bibles array is empty or missing, try to fetch bibles directly using language ID
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `[Bible Brain] Bibles array empty for ${language}, fetching bibles directly with language_id: ${languageId}`
            );
          }

          // Try multiple parameter combinations
          const paramCombinations = [
            { language_id: languageId },
            { language_code: language },
            { iso: languageEntry?.iso || language },
            { language_id: languageId, language_code: language },
          ];

          for (const params of paramCombinations) {
            try {
              const biblesResponse = await axios.get(
                `${this.bibleBrainBaseUrl}/api/bibles`,
                {
                  params: {
                    key: this.bibleBrainApiKey,
                    ...params,
                    v: 4,
                  },
                }
              );

              // Handle different response formats
              let fetchedBibles: any[] = [];
              if (Array.isArray(biblesResponse.data?.data)) {
                fetchedBibles = biblesResponse.data.data;
              } else if (Array.isArray(biblesResponse.data)) {
                fetchedBibles = biblesResponse.data;
              } else if (
                biblesResponse.data?.data &&
                typeof biblesResponse.data.data === 'object'
              ) {
                fetchedBibles = Object.values(biblesResponse.data.data);
              }

              if (fetchedBibles.length > 0) {
                bibles = fetchedBibles;
                if (process.env.NODE_ENV === 'development') {
                  console.log(
                    `[Bible Brain] Fetched ${bibles.length} bibles for ${language} using params:`,
                    params
                  );
                  // Log the structure of the first Bible to understand the data format
                  if (bibles.length > 0) {
                    console.log(
                      `[Bible Brain] Sample Bible structure for ${language}:`,
                      {
                        keys: Object.keys(bibles[0]),
                        sample: {
                          id: bibles[0].id,
                          dam_id: bibles[0].dam_id,
                          abbreviation: bibles[0].abbreviation,
                          name: bibles[0].name,
                          allKeys: Object.keys(bibles[0]),
                        },
                      }
                    );
                  }
                }
                break; // Success, stop trying other combinations
              }
            } catch (paramError: any) {
              // Continue to next parameter combination
              if (process.env.NODE_ENV === 'development') {
                console.log(
                  `[Bible Brain] Failed with params ${JSON.stringify(params)}:`,
                  paramError.message
                );
              }
            }
          }

          if (bibles.length === 0) {
            console.warn(
              `[Bible Brain] Could not fetch bibles for ${language} with any parameter combination`
            );
          }
        } catch (biblesError: any) {
          console.warn(
            `[Bible Brain] Failed to fetch bibles for ${language}:`,
            biblesError.message
          );
        }
      }

      // Helper function to check if a Bible has text filesets
      const hasTextFilesets = (bible: any): boolean => {
        if (!bible?.filesets) return false;

        // Filesets can be in different formats:
        // 1. Object with keys like 'dbp-vid', 'dbp-prod', etc.
        // 2. Array of fileset objects
        let filesetArray: any[] = [];

        if (Array.isArray(bible.filesets)) {
          filesetArray = bible.filesets;
        } else if (typeof bible.filesets === 'object') {
          // Extract all filesets from the object (e.g., filesets['dbp-prod'])
          filesetArray = Object.values(bible.filesets).flat();
        }

        // Check if any fileset is a text fileset
        const hasText = filesetArray.some((f: any) => {
          const type = String(f?.type || '').toLowerCase();
          const id = String(f?.id || '').toUpperCase();
          // Text filesets have type 'text' or 'text_plain' or contain 'ET' in the ID
          return type === 'text' || type === 'text_plain' || type.includes('text') || id.includes('ET');
        });

        return hasText;
      };

      // Prefer specific Bible versions (without generic language codes)
      const preferredBibles: Record<BibleLanguage, string[]> = {
        eng: ['ASV', 'KJV', 'WEB'], // English
        deu: ['LUTH', 'ELB'], // German - Luther, Elberfelder
        nld: ['NBV', 'HSV'], // Dutch - Nieuwe Bijbelvertaling, Herziene Statenvertaling
      };

      const preferred = preferredBibles[language] || [];

      if (bibles.length > 0) {
        // Log all bibles for debugging
        if (process.env.NODE_ENV === 'development' || language === 'nld') {
          console.log(
            `[Bible Brain] Processing ${bibles.length} bibles for ${language}:`,
            bibles.map((b: any, index: number) => ({
              index,
              abbr: b.abbr,
              name: b.name,
              hasTextFilesets: hasTextFilesets(b),
            }))
          );
        }

        // Filter to only Bibles with text filesets
        const biblesWithText = bibles.filter(hasTextFilesets);

        if (process.env.NODE_ENV === 'development' || language === 'nld') {
          console.log(
            `[Bible Brain] Found ${biblesWithText.length} bibles with text filesets for ${language}:`,
            biblesWithText.map((b: any) => ({
              abbr: b.abbr,
              name: b.name,
            }))
          );
        }

        // Use filtered list if available, otherwise use all bibles as fallback
        const candidateBibles = biblesWithText.length > 0 ? biblesWithText : bibles;

        // Find preferred Bible from candidates
        // For Dutch, the Bible ID is in the 'abbr' field (e.g., 'NLDNBV', 'NLDHSV')
        selectedBible =
          candidateBibles.find((b: any) => {
            const abbrStr = String(
              b.abbr || b.abbreviation || ''
            ).toUpperCase();
            return preferred.some((p) => abbrStr.includes(p.toUpperCase()));
          }) ||
          // If no preferred found, use first candidate with text filesets
          candidateBibles[0];

        // For Dutch bibles, use 'abbr' as the dam_id (e.g., 'NLDNBV')
        // Also try other possible field names for other languages
        damId =
          selectedBible?.abbr || // Dutch uses 'abbr' field
          selectedBible?.dam_id ||
          selectedBible?.id ||
          selectedBible?.bible_id ||
          selectedBible?.damId;

        if (damId && typeof damId !== 'string') {
          damId = String(damId);
        }

        if (process.env.NODE_ENV === 'development' || language === 'nld') {
          console.log(`[Bible Brain] Selected Bible for ${language}:`, {
            name: selectedBible?.name,
            damId,
            abbr: selectedBible?.abbr, // Dutch uses 'abbr' field
            id: selectedBible?.id,
            bible_id: selectedBible?.bible_id,
            abbreviation: selectedBible?.abbreviation,
            hasFilesets: !!selectedBible?.filesets,
            filesetsKeys: selectedBible?.filesets
              ? Object.keys(selectedBible.filesets)
              : [],
            allKeys: selectedBible ? Object.keys(selectedBible) : [],
          });
        }

        // If still no damId found, log error with full details
        if (!damId && language === 'nld') {
          console.error(
            `[Bible Brain] CRITICAL: No dam_id found in any of ${bibles.length} bibles for Dutch!`,
            {
              bibles: bibles.map((b: any) => ({
                keys: Object.keys(b),
                id: b.id,
                dam_id: b.dam_id,
                bible_id: b.bible_id,
                name: b.name,
              })),
            }
          );
        }
      }

      // Fallback: if still no damId, use fallback Bible IDs (don't use language id as it's not a Bible ID)
      if (!damId) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `[Bible Brain] No Bible ID found in bibles array for ${language}, using fallback`
          );
        }
      }

      if (!damId) {
        console.error(
          `No Bible ID (dam_id) found for language: ${language}`,
          `Available items: ${languages.length}`,
          `Sample item keys:`,
          languages[0] ? Object.keys(languages[0]) : 'no items'
        );
        // Use fallback Bible IDs instead of throwing
        const fallbackIds: Record<BibleLanguage, string> = {
          eng: 'ENGASV',
          deu: 'DEULUT',
          nld: 'NLDNBV',
        };
        damId = fallbackIds[language] || 'ENGASV';
        console.warn(
          `[Bible Brain] Using fallback Bible ID for ${language}: ${damId}`
        );
      } else if (process.env.NODE_ENV === 'development') {
        console.log(`[Bible Brain] Found dam_id for ${language}: ${damId}`);
      }

      // If we fetched bibles separately, update the language response
      let languageResponse = languageEntry || languages[0];
      if (
        bibles.length > 0 &&
        (!languageResponse.bibles || languageResponse.bibles.length === 0)
      ) {
        languageResponse = { ...languageResponse, bibles };
      }

      // Also include the selected Bible's filesets in the language response
      // The Bible object has a 'filesets' property that contains the filesets
      if (selectedBible && selectedBible.filesets) {
        // Extract filesets from the Bible object
        // The structure can be: filesets: { 'dbp-prod': [text filesets], 'dbp-vid': [video filesets] }
        let bibleFilesets: any[] = [];

        if (Array.isArray(selectedBible.filesets)) {
          bibleFilesets = selectedBible.filesets;
        } else if (typeof selectedBible.filesets === 'object') {
          // Prioritize 'dbp-prod' key as it typically contains text filesets
          // Then check other keys like 'dbp-vid', etc.
          const priorityKeys = ['dbp-prod', 'dbp-text', 'text', 'dbp-vid'];

          for (const key of priorityKeys) {
            if (selectedBible.filesets[key] && Array.isArray(selectedBible.filesets[key])) {
              bibleFilesets = [...bibleFilesets, ...selectedBible.filesets[key]];
            }
          }

          // If no priority keys found, extract all arrays from the object
          if (bibleFilesets.length === 0) {
            bibleFilesets = Object.values(selectedBible.filesets).flat();
          }
        }

        if (bibleFilesets.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `[Bible Brain] Found ${bibleFilesets.length} filesets in Bible object for ${language}`
            );
            // Log fileset types to understand what we have
            const filesetTypes = bibleFilesets.map((f: any) => ({
              id: f.id,
              type: f.type,
            }));
            console.log(
              `[Bible Brain] Fileset types for ${language}:`,
              filesetTypes
            );
          }
          // Add filesets to language response
          if (
            !languageResponse.filesets ||
            !Array.isArray(languageResponse.filesets)
          ) {
            languageResponse.filesets = bibleFilesets;
          } else {
            // Merge with existing filesets (avoid duplicates)
            const existingIds = new Set(languageResponse.filesets.map((f: any) => f.id));
            const newFilesets = bibleFilesets.filter((f: any) => !existingIds.has(f.id));
            languageResponse.filesets = [
              ...languageResponse.filesets,
              ...newFilesets,
            ];
          }
        }
      }

      // Cache the dam_id for 7 days (even if it's a fallback)
      const result = { damId, languageResponse };
      this.setCache(cacheKey, result, 7 * 24 * 60 * 60 * 1000);
      return result;
    } catch (error) {
      console.error(`Error getting Bible ID (dam_id) for ${language}:`, error);
      // Fallback to default Bible IDs
      const fallbackIds: Record<BibleLanguage, string> = {
        eng: 'ENGASV', // English ASV
        deu: 'DEULUT', // German Luther
        nld: 'NLDNBV', // Dutch NBV
      };
      return {
        damId: fallbackIds[language] || 'ENGASV',
        languageResponse: null,
      };
    }
  }

  /**
   * Get Bible Brain Bible ID (dam_id) for a language (backward compatibility)
   */
  private async getBibleBrainDamId(
    language: BibleLanguage = 'eng'
  ): Promise<string> {
    const { damId } = await this.getBibleBrainDamIdWithResponse(language);
    return damId;
  }

  /**
   * Determine if a book is in the Old Testament or New Testament
   */
  private isOldTestament(bookCode: string): boolean {
    const newTestamentBooks = [
      'MAT',
      'MRK',
      'LUK',
      'JHN',
      'ACT',
      'ROM',
      '1CO',
      '2CO',
      'GAL',
      'EPH',
      'PHP',
      'COL',
      '1TH',
      '2TH',
      '1TI',
      '2TI',
      'TIT',
      'PHM',
      'HEB',
      'JAS',
      '1PE',
      '2PE',
      '1JN',
      '2JN',
      '3JN',
      'JUD',
      'REV',
    ];
    return !newTestamentBooks.includes(bookCode.toUpperCase());
  }

  /**
   * Get the fileset ID from the Bible Brain API response
   * The /api/languages response includes a filesets array - we should use that
   */
  private async getFilesetId(
    damId: string,
    language: BibleLanguage,
    isOldTestament: boolean,
    languageResponse?: any
  ): Promise<string> {
    const cacheKey = `fileset_id:${damId}:${isOldTestament ? 'OT' : 'NT'}`;
    const cached = this.getCache<string>(cacheKey);
    if (cached) return cached;

    try {
      // First, try to get fileset from the language response if provided
      if (
        languageResponse?.filesets &&
        Array.isArray(languageResponse.filesets)
      ) {
        console.log(
          `[Bible Brain] Found ${languageResponse.filesets.length} filesets in language response for ${language}`
        );

        // Look for text filesets
        // For Dutch, filesets might have different structure - check all possible fields
        const textFilesets = languageResponse.filesets.filter((f: any) => {
          const type = String(
            f.type || f.media_type || f.set_type_code || ''
          ).toLowerCase();
          const id = String(
            f.id || f.fileset_id || f.set_id || f.dam_id || ''
          ).toUpperCase();
          const setSize = String(
            f.set_size_code || f.set_size || ''
          ).toLowerCase();

          // Text filesets typically have type 'text' or contain 'ET' in the ID
          // Also accept if type is empty or undefined (might be text by default)
          // For Dutch, filesets might not have explicit type, so be more lenient
          const isText =
            type === 'text' ||
            type.includes('text') ||
            id.includes('ET') ||
            type === '' ||
            (!type && !setSize); // If no type/size info, assume it might be text

          if (process.env.NODE_ENV === 'development' || language === 'nld') {
            console.log(`[Bible Brain] Fileset check for ${language}:`, {
              id,
              type,
              setSize,
              isText,
              allKeys: Object.keys(f),
            });
          }

          return isText;
        });

        if (textFilesets.length > 0) {
          console.log(
            `[Bible Brain] Found ${textFilesets.length} text filesets for ${language}`
          );

          // Prefer NT or OT based on what we need
          const testament = isOldTestament ? 'O' : 'N';
          const preferredFileset =
            textFilesets.find((f: any) => {
              const id = String(
                f.id || f.fileset_id || f.set_id || f.code || ''
              ).toUpperCase();
              // Check if fileset ID contains the testament indicator
              return (
                id.includes(testament) ||
                id.includes('L12') ||
                id.includes('NT') ||
                id.includes('OT')
              );
            }) || textFilesets[0];

          const filesetId =
            preferredFileset.id ||
            preferredFileset.fileset_id ||
            preferredFileset.dam_id;
          if (filesetId) {
            console.log(
              `[Bible Brain] Using fileset ID: ${filesetId} for ${language} ${
                isOldTestament ? 'OT' : 'NT'
              }`
            );
            this.setCache(cacheKey, String(filesetId), 7 * 24 * 60 * 60 * 1000);
            return String(filesetId);
          }
        } else {
          console.warn(
            `[Bible Brain] No text filesets found in language response for ${language}`
          );
        }
      } else {
        console.warn(
          `[Bible Brain] No filesets array in language response for ${language}`
        );
      }

      // If no filesets in language response, try to fetch them directly using dam_id
      if (
        (!languageResponse?.filesets ||
          !Array.isArray(languageResponse.filesets) ||
          languageResponse.filesets.length === 0) &&
        damId
      ) {
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `[Bible Brain] Fetching filesets directly for ${language} using dam_id: ${damId}`
            );
          }
          // Try multiple parameter combinations for filesets
          const filesetParamCombinations = [
            { bible_id: damId, type: 'text' },
            { dam_id: damId, type: 'text' },
            { bible_id: damId },
            { dam_id: damId },
          ];

          let filesets: any[] = [];
          for (const params of filesetParamCombinations) {
            try {
              const filesetsResponse = await axios.get(
                `${this.bibleBrainBaseUrl}/api/bibles/filesets`,
                {
                  params: {
                    key: this.bibleBrainApiKey,
                    ...params,
                    v: 4,
                  },
                }
              );

              // Handle different response formats
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

              if (filesets.length > 0) {
                if (process.env.NODE_ENV === 'development') {
                  console.log(
                    `[Bible Brain] Fetched ${filesets.length} filesets for ${language} using params:`,
                    params
                  );
                }
                break; // Success, stop trying other combinations
              }
            } catch (paramError: any) {
              // Continue to next parameter combination
              if (process.env.NODE_ENV === 'development') {
                console.log(
                  `[Bible Brain] Filesets fetch failed with params ${JSON.stringify(
                    params
                  )}:`,
                  paramError.message
                );
              }
            }
          }

          if (filesets.length > 0) {
            if (process.env.NODE_ENV === 'development') {
              console.log(
                `[Bible Brain] Fetched ${filesets.length} filesets for ${language}`
              );
            }

            // Look for text filesets matching testament
            const testament = isOldTestament ? 'O' : 'N';
            const preferredFileset =
              filesets.find((f: any) => {
                const filesetId = String(f.id || f.fileset_id || '');
                const filesetType = String(
                  f.type || f.media_type || ''
                ).toLowerCase();
                const filesetSize = String(f.set_size || '').toLowerCase();

                // Prioritize text filesets
                if (filesetType === 'text' || filesetId.includes('ET')) {
                  // Prefer filesets matching testament
                  if (
                    isOldTestament &&
                    (filesetSize === 'ot' ||
                      filesetSize === 'all' ||
                      filesetId.includes('O'))
                  )
                    return true;
                  if (
                    !isOldTestament &&
                    (filesetSize === 'nt' ||
                      filesetSize === 'all' ||
                      filesetId.includes('N'))
                  )
                    return true;
                  // If no size info, still prefer text
                  if (!filesetSize) return true;
                }
                return false;
              }) ||
              filesets.find(
                (f: any) =>
                  String(f.type || f.media_type || '').toLowerCase() === 'text'
              ) ||
              filesets[0];

            const filesetId =
              preferredFileset?.id || preferredFileset?.fileset_id;
            if (filesetId) {
              if (process.env.NODE_ENV === 'development') {
                console.log(
                  `[Bible Brain] Using fetched fileset ID: ${filesetId} for ${language} ${
                    isOldTestament ? 'OT' : 'NT'
                  }`
                );
              }
              this.setCache(
                cacheKey,
                String(filesetId),
                7 * 24 * 60 * 60 * 1000
              );
              return String(filesetId);
            }
          }
        } catch (filesetsError: any) {
          console.warn(
            `[Bible Brain] Failed to fetch filesets for ${language}:`,
            filesetsError.message
          );
        }
      }

      // Last resort: Use the pattern from support message (only for German)
      if (language === 'deu') {
        const testament = isOldTestament ? 'O' : 'N';
        const constructedFilesetId = `DEUL12${testament}_ET`;
        console.warn(
          `[Bible Brain] Using constructed fileset ID for German: ${constructedFilesetId}`
        );
        this.setCache(cacheKey, constructedFilesetId, 7 * 24 * 60 * 60 * 1000);
        return constructedFilesetId;
      }

      // For other languages, return a placeholder that will trigger the fallback mechanism
      const languagePrefix: Record<BibleLanguage, string> = {
        eng: 'ENG',
        deu: 'DEU',
        nld: 'NLD',
      };
      const prefix = languagePrefix[language] || 'ENG';
      const testament = isOldTestament ? 'O' : 'N';
      const constructedFilesetId = `${prefix}L12${testament}_ET`;
      console.warn(
        `[Bible Brain] Using constructed fileset ID for ${language}: ${constructedFilesetId}`
      );
      return constructedFilesetId;
    } catch (error) {
      console.error(`Error getting fileset ID for ${language}:`, error);
      // Return a placeholder that will trigger the fallback mechanism
      const languagePrefix: Record<BibleLanguage, string> = {
        eng: 'ENG',
        deu: 'DEU',
        nld: 'NLD',
      };
      const prefix = languagePrefix[language] || 'ENG';
      const testament = isOldTestament ? 'O' : 'N';
      return `${prefix}L12${testament}_ET`;
    }
  }

  /**
   * Fetch chapter from Bible Brain API using DBP4 v4 endpoints
   * Uses correct API v4 structure:
   * 1. GET /api/languages to get Bible ID (dam_id)
   * 2. GET /api/bibles with dam_id to get books
   * 3. GET /api/bibles/filesets/{fileset_id}/{book_id}/{chapter_id} to get verses
   */
  private async getChapterFromBibleBrain(
    book: string,
    chapter: number,
    language: BibleLanguage = 'eng'
  ) {
    try {
      // Step 1: Get the Bible ID (dam_id) and language response for this language
      const { damId, languageResponse } =
        await this.getBibleBrainDamIdWithResponse(language);

      // Step 2: Get the book code (e.g., ROM, MAT, JHN)
      const bookCode =
        BOOK_NAME_MAP[book] || book.toUpperCase().substring(0, 3);

      // Step 3: For Bible Brain API v4, use the string book code
      // Different filesets may use different book ID systems (numeric vs string codes)
      // String codes (ROM, MAT, JHN) are more reliable across different filesets
      const bookId = bookCode;

      // Step 4: Determine if this is Old Testament or New Testament
      const isOT = this.isOldTestament(bookCode);

      // Step 5: Get the fileset ID based on language and testament
      let filesetId = await this.getFilesetId(
        damId,
        language,
        isOT,
        languageResponse
      );

      // Step 6: Get verses for the chapter using v4 endpoint
      // Try the fileset endpoint first
      let versesResponse;
      try {
        // GET /api/bibles/filesets/{fileset_id}/{book_id}/{chapter_id}?key=...&v=4
        versesResponse = await axios.get(
          `${this.bibleBrainBaseUrl}/api/bibles/filesets/${filesetId}/${bookId}/${chapter}`,
          {
            params: {
              key: this.bibleBrainApiKey,
              v: 4,
            },
          }
        );
      } catch (filesetError: any) {
        // If fileset endpoint fails, try using dam_id directly
        // Some Bibles might use dam_id instead of fileset_id
        if (filesetError.response?.status === 404) {
          console.warn(
            `Fileset ${filesetId} not found for ${language}, trying with dam_id ${damId} directly`
          );
          try {
            versesResponse = await axios.get(
              `${this.bibleBrainBaseUrl}/api/bibles/${damId}/books/${bookId}/chapters/${chapter}/verses`,
              {
                params: {
                  key: this.bibleBrainApiKey,
                  v: 4,
                },
              }
            );
            // Update filesetId to damId for response
            filesetId = damId;
          } catch (damIdError: any) {
            // If that also fails, try the /library/verse endpoint as a last resort
            console.warn(
              `Direct dam_id endpoint also failed for ${language}, trying /library/verse endpoint`
            );
            try {
              versesResponse = await axios.get(
                `${this.bibleBrainBaseUrl}/library/verse`,
                {
                  params: {
                    key: this.bibleBrainApiKey,
                    dam_id: damId,
                    book_id: bookId,
                    chapter_id: chapter.toString(),
                    v: 4,
                  },
                }
              );
              // Update filesetId to damId for response
              filesetId = damId;
            } catch (libraryError: any) {
              // If all endpoints fail, throw the original error
              console.error(
                `All Bible Brain endpoints failed for ${language}:`,
                {
                  filesetError: filesetError.message,
                  damIdError: damIdError.message,
                  libraryError: libraryError.message,
                }
              );
              throw filesetError;
            }
          }
        } else {
          throw filesetError;
        }
      }

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

      // Log verse structure for debugging (first verse only)
      if (verses.length > 0 && process.env.NODE_ENV === 'development') {
        console.log(
          `[Bible Brain] Sample verse structure for ${language} - ${book} ${chapter}:`,
          {
            totalVerses: verses.length,
            firstVerse: verses[0],
            firstVerseKeys: Object.keys(verses[0]),
            verse_id: verses[0].verse_id,
            verse: verses[0].verse,
            verse_num: verses[0].verse_num,
            verse_start: verses[0].verse_start,
            id: verses[0].id,
          }
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
      } catch (error: any) {
        console.error(`Bible Brain failed for ${language}, error:`, {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          url: error.config?.url,
        });
        // For non-English languages, don't fall back to English - throw the error
        if (language !== 'eng') {
          throw new Error(
            `Failed to fetch ${book} ${chapter} in ${language}: ${
              error.message || 'Unknown error'
            }`
          );
        }
        // For English, fall through to bible-api.com
        console.warn('Bible Brain failed for English, trying bible-api.com');
      }
    }

    // Fallback to bible-api.com (English only)
    if (language === 'eng') {
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
    } else {
      // For non-English languages, if we get here, Bible Brain failed and we shouldn't fall back
      throw new Error(
        `Failed to fetch chapter: ${book} ${chapter} in ${language}. Bible Brain API unavailable.`
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
