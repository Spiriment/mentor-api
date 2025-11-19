# Bible Language Feature - API Calls Documentation

## Issue Summary
The Bible language feature is not working correctly. This document outlines all API calls being made for the language functionality.

---

## 1. Frontend to Backend API Calls

### 1.1 Get Available Languages
**Endpoint:** `GET /api/bible/languages`

**Request:**
- Method: `GET`
- URL: `http://10.160.91.33:6802/api/bible/languages`
- Headers: None (public endpoint)
- Body: None

**Expected Response:**
```json
{
  "success": true,
  "response": {
    "languages": [
      { "code": "eng", "name": "English" },
      { "code": "deu", "name": "German" },
      { "code": "nld", "name": "Dutch" }
    ]
  }
}
```

**Status:** ⚠️ **NOT CURRENTLY CALLED FROM FRONTEND** - The frontend has hardcoded languages instead of fetching from API.

---

### 1.2 Get Bible Chapter with Language
**Endpoint:** `GET /api/bible/:book/:chapter?lang={language}`

**Request:**
- Method: `GET`
- URL: `http://10.160.91.33:6802/api/bible/{book}/{chapter}?lang={language}`
- Example: `http://10.160.91.33:6802/api/bible/John/3?lang=deu`
- Headers: None (public endpoint)
- Query Parameters:
  - `lang`: Language code (`eng`, `deu`, or `nld`)
  - Defaults to `eng` if not provided or invalid

**Frontend Implementation:**
```typescript
// File: mentor-app/src/screens/shared/BibleReadingScreen.tsx (line 118)
const response = await api.get(`/bible/${encodeURIComponent(book)}/${chapter}`, {
  params: { lang: language },
});
```

**Expected Response:**
```json
{
  "success": true,
  "response": {
    "reference": "John 3",
    "verses": [
      {
        "verse": 1,
        "text": "Verse text here..."
      }
    ],
    "text": "Full chapter text...",
    "translation_name": "Luther 2017",
    "translation": "DEULUT"
  }
}
```

**Status:** ✅ Called from frontend, but may not be working correctly for non-English languages.

---

### 1.3 Get Bible Passage with Language
**Endpoint:** `GET /api/bible/passage?reference={reference}&lang={language}`

**Request:**
- Method: `GET`
- URL: `http://10.160.91.33:6802/api/bible/passage?reference={reference}&lang={language}`
- Example: `http://10.160.91.33:6802/api/bible/passage?reference=John%203:16&lang=deu`
- Headers: None (public endpoint)
- Query Parameters:
  - `reference`: Bible reference (e.g., "John 3:16-18")
  - `lang`: Language code (`eng`, `deu`, or `nld`) - optional, defaults to `eng`

**Frontend Implementation:**
```typescript
// File: mentor-app/src/services/authService.ts (line 623-627)
getPassage: async (reference: string): Promise<any> => {
  const response = await api.get(
    `/bible/passage?reference=${encodeURIComponent(reference)}`
  );
  return response.data;
}
```

**Note:** ⚠️ Frontend `getPassage` method does NOT include `lang` parameter - this is a bug!

**Expected Response:**
```json
{
  "success": true,
  "response": {
    "reference": "John 3:16",
    "verses": [...],
    "text": "...",
    "translation_name": "..."
  }
}
```

---

## 2. Backend to Bible Brain API Calls

The backend uses **Bible Brain (DBP4) API** as the primary source for multi-language Bible content.

**Base URL:** `https://4.dbt.io`

**API Key:** `6aa97969-97d4-4b7b-a3df-0a70f043056c` (currently hardcoded, should be in env: `BIBLE_BRAIN_API_KEY`)

---

### 2.1 Get Bible ID for Language
**Endpoint:** `GET https://4.dbt.io/library/language`

**Request:**
- Method: `GET`
- URL: `https://4.dbt.io/library/language`
- Query Parameters:
  - `key`: API key (`6aa97969-97d4-4b7b-a3df-0a70f043056c`)
  - `language_code`: Language code (`eng`, `deu`, `nld`)
  - `v`: API version (`4`)

**Example:**
```
GET https://4.dbt.io/library/language?key=6aa97969-97d4-4b7b-a3df-0a70f043056c&language_code=deu&v=4
```

**Backend Implementation:**
```typescript
// File: mentor-backend/src/services/bible.service.ts (line 145-154)
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
```

**Expected Response:**
```json
{
  "data": [
    {
      "id": "DEULUT",
      "name": "Luther 2017",
      "language_code": "deu",
      ...
    }
  ]
}
```

**Status:** ⚠️ **NEEDS VERIFICATION** - This call may be failing or returning incorrect data.

---

### 2.2 Get Bible Books
**Endpoint:** `GET https://4.dbt.io/library/book` (Primary)
**Alternative:** `GET https://4.dbt.io/bibles/{bibleId}/books`

**Request (Primary):**
- Method: `GET`
- URL: `https://4.dbt.io/library/book`
- Query Parameters:
  - `key`: API key
  - `dam_id`: Bible ID (e.g., `DEULUT`)
  - `v`: API version (`4`)

**Example:**
```
GET https://4.dbt.io/library/book?key=6aa97969-97d4-4b7b-a3df-0a70f043056c&dam_id=DEULUT&v=4
```

**Request (Alternative):**
- Method: `GET`
- URL: `https://4.dbt.io/bibles/{bibleId}/books`
- Query Parameters:
  - `key`: API key
  - `v`: API version (`4`)

**Backend Implementation:**
```typescript
// File: mentor-backend/src/services/bible.service.ts (line 211-220)
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
```

**Status:** ⚠️ **MAY BE FAILING** - Backend tries alternative endpoint if this fails.

---

### 2.3 Get Chapter Verses
**Endpoint:** `GET https://4.dbt.io/library/verse` (Primary)
**Alternative:** `GET https://4.dbt.io/bibles/{bibleId}/books/{bookId}/chapters/{chapter}/verses`

**Request (Primary):**
- Method: `GET`
- URL: `https://4.dbt.io/library/verse`
- Query Parameters:
  - `key`: API key
  - `dam_id`: Bible ID (e.g., `DEULUT`)
  - `book_id`: Book ID (numeric)
  - `chapter_id`: Chapter number (as string)
  - `v`: API version (`4`)

**Example:**
```
GET https://4.dbt.io/library/verse?key=6aa97969-97d4-4b7b-a3df-0a70f043056c&dam_id=DEULUT&book_id=43&chapter_id=3&v=4
```

**Request (Alternative):**
- Method: `GET`
- URL: `https://4.dbt.io/bibles/{bibleId}/books/{bookId}/chapters/{chapter}/verses`
- Query Parameters:
  - `key`: API key
  - `v`: API version (`4`)

**Backend Implementation:**
```typescript
// File: mentor-backend/src/services/bible.service.ts (line 259-270)
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
```

**Status:** ⚠️ **LIKELY FAILING** - This is the critical call that retrieves actual verse content.

---

## 3. Fallback Mechanism

If Bible Brain API fails, the backend falls back to **bible-api.com** (English only):

**Fallback Endpoint:** `https://bible-api.com/{book}%20{chapter}`

**Example:**
```
GET https://bible-api.com/John%203
```

**Status:** ✅ Works for English, but does NOT support German or Dutch.

---

## 4. Identified Issues

### Issue 1: Frontend Not Fetching Available Languages
- **Problem:** Frontend has hardcoded languages instead of calling `/api/bible/languages`
- **Location:** `mentor-app/src/screens/shared/BibleReadingScreen.tsx` (line 39-44)
- **Impact:** If backend adds new languages, frontend won't know about them

### Issue 2: Frontend `getPassage` Missing Language Parameter
- **Problem:** `authService.bible.getPassage()` doesn't accept or pass `lang` parameter
- **Location:** `mentor-app/src/services/authService.ts` (line 623-627)
- **Impact:** Passage requests always default to English

### Issue 3: Bible Brain API Endpoints May Be Incorrect
- **Problem:** The backend tries multiple endpoint structures, suggesting uncertainty about correct API format
- **Location:** `mentor-backend/src/services/bible.service.ts` (lines 198-290)
- **Impact:** API calls may be failing silently or returning errors

### Issue 4: No Error Logging for Bible Brain Failures
- **Problem:** Errors are caught but may not be properly logged or returned to frontend
- **Impact:** Difficult to debug why language switching isn't working

### Issue 5: API Key Hardcoded
- **Problem:** Bible Brain API key is hardcoded in service
- **Location:** `mentor-backend/src/services/bible.service.ts` (line 103)
- **Impact:** Security concern, but also means key can't be easily changed

---

## 5. Testing Checklist

To verify the language feature works:

1. **Test Get Languages Endpoint:**
   ```bash
   curl "http://10.160.91.33:6802/api/bible/languages"
   ```

2. **Test English Chapter (should use fallback):**
   ```bash
   curl "http://10.160.91.33:6802/api/bible/John/3?lang=eng"
   ```

3. **Test German Chapter (should use Bible Brain):**
   ```bash
   curl "http://10.160.91.33:6802/api/bible/John/3?lang=deu"
   ```

4. **Test Dutch Chapter (should use Bible Brain):**
   ```bash
   curl "http://10.160.91.33:6802/api/bible/John/3?lang=nld"
   ```

5. **Test Bible Brain API Directly:**
   ```bash
   curl "https://4.dbt.io/library/language?key=6aa97969-97d4-4b7b-a3df-0a70f043056c&language_code=deu&v=4"
   ```

---

## 6. Request/Response Examples

### Frontend Request (Working):
```
GET /api/bible/John/3?lang=deu
Host: 10.160.91.33:6802
```

### Backend Response (Expected):
```json
{
  "success": true,
  "response": {
    "reference": "John 3",
    "verses": [
      { "verse": 1, "text": "Es war aber ein Mensch..." },
      { "verse": 2, "text": "Dieser kam zu ihm..." }
    ],
    "translation_name": "Luther 2017",
    "translation": "DEULUT"
  }
}
```

### Backend to Bible Brain Request (May Be Failing):
```
GET /library/verse?key=6aa97969-97d4-4b7b-a3df-0a70f043056c&dam_id=DEULUT&book_id=43&chapter_id=3&v=4
Host: 4.dbt.io
```

---

## 7. Recommendations for Bible Brain API Provider

1. **Verify API Endpoint Structure:**
   - Confirm the correct endpoint format for DBP4 API
   - Verify parameter names (`dam_id` vs `bible_id`, `chapter_id` vs `chapter`, etc.)
   - Check if authentication method is correct (query param `key` vs headers)

2. **Test API Key Validity:**
   - Verify the API key `6aa97969-97d4-4b7b-a3df-0a70f043056c` is still active
   - Check if there are rate limits or usage restrictions

3. **Provide API Documentation:**
   - Share official DBP4 API documentation
   - Provide example working requests/responses
   - Clarify supported languages and Bible versions

4. **Check Response Format:**
   - Verify the actual response structure from Bible Brain API
   - Confirm field names in responses (e.g., `data.data` vs `data`)

---

## 8. Summary

**Total API Calls in Flow:**
1. Frontend → Backend: `GET /api/bible/{book}/{chapter}?lang={lang}`
2. Backend → Bible Brain: `GET /library/language` (to get Bible ID)
3. Backend → Bible Brain: `GET /library/book` (to get book ID)
4. Backend → Bible Brain: `GET /library/verse` (to get verses)

**Critical Path:**
- If step 2, 3, or 4 fails, the backend falls back to English-only bible-api.com
- This means German/Dutch requests silently fail and return English content

**Most Likely Issue:**
- Bible Brain API endpoints or parameters are incorrect
- API key may be invalid or expired
- Response parsing may be incorrect (expecting `data.data` but getting `data`)

