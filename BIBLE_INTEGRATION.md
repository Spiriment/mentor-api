# Bible Brain (DBP4) Integration

## Overview
The Bible service has been enhanced to support multiple Bible APIs with multi-language support:
- **Primary**: Bible Brain (DBP4) API - supports English, German, and Dutch
- **Fallback**: bible-api.com - English only

## Supported Languages
- **English (eng)**: Default language
- **German (deu)**: Deutsch
- **Dutch (nld)**: Nederlands

## API Key Configuration
The Bible Brain API key is configured in the `BibleService` constructor. It can be set via:
1. Environment variable: `BIBLE_BRAIN_API_KEY`
2. Constructor option: `bibleBrainApiKey`
3. Default fallback: Hardcoded key (should be moved to env in production)

**Current API Key**: `6aa97969-97d4-4b7b-a3df-0a70f043056c`

## API Endpoints

### Get Available Languages
```
GET /api/bible/languages
```
Returns list of supported languages with their codes and names.

### Get Chapter
```
GET /api/bible/:book/:chapter?lang=eng|deu|nld
```
Example:
- `GET /api/bible/John/3?lang=eng` - English
- `GET /api/bible/John/3?lang=deu` - German
- `GET /api/bible/John/3?lang=nld` - Dutch

### Get Passage
```
GET /api/bible/passage?reference=John%203:16-18&lang=eng|deu|nld
```
Example:
- `GET /api/bible/passage?reference=John%203:16&lang=deu`

## How It Works

1. **Language Selection**: The API tries Bible Brain first if:
   - Language is not English (deu or nld), OR
   - Bible Brain API key is available

2. **Fallback Mechanism**: If Bible Brain fails, it automatically falls back to bible-api.com (English only)

3. **Caching**: All responses are cached for 24 hours to reduce API calls

4. **Book Name Mapping**: Book names are automatically mapped between bible-api.com format and Bible Brain format

## Bible Brain API Structure

The implementation attempts multiple endpoint structures to handle variations in the Bible Brain API:
- `/library/book` - Get books
- `/library/verse` - Get verses
- `/bibles/{bibleId}/books` - Alternative book endpoint
- `/bibles/{bibleId}/books/{bookId}/chapters/{chapter}/verses` - Alternative verse endpoint

**Note**: The actual Bible Brain API structure may need adjustment based on testing. The implementation includes fallback mechanisms and error handling.

## Testing

To test the integration:

1. **Test English (uses bible-api.com as fallback)**:
   ```bash
   curl "http://localhost:6802/api/bible/John/3?lang=eng"
   ```

2. **Test German (uses Bible Brain)**:
   ```bash
   curl "http://localhost:6802/api/bible/John/3?lang=deu"
   ```

3. **Test Dutch (uses Bible Brain)**:
   ```bash
   curl "http://localhost:6802/api/bible/John/3?lang=nld"
   ```

4. **Get Available Languages**:
   ```bash
   curl "http://localhost:6802/api/bible/languages"
   ```

## Next Steps

1. **Frontend Integration**: Add language selector to the Bible reading screen
2. **User Preference**: Store user's preferred Bible language in their profile
3. **API Testing**: Test Bible Brain API endpoints and adjust if needed
4. **Environment Variable**: Move API key to environment variable for security

## Bible Versions

The service automatically selects appropriate Bible versions:
- **English**: ASV (American Standard Version) or KJV
- **German**: Luther 2017 or Elberfelder
- **Dutch**: NBV (Nieuwe Bijbelvertaling) or NBG

If preferred versions are not available, it uses the first available Bible for that language.

