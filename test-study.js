/*
 Run with:
   BASE_URL=http://localhost:4000/api AUTH_TOKEN=eyJ... node test-study.js
*/

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:6802/api';
let AUTH_TOKEN = process.env.AUTH_TOKEN;
const TEST_EMAIL = process.env.TEST_EMAIL; // required if AUTH_TOKEN not set
const TEST_OTP = process.env.TEST_OTP; // required if AUTH_TOKEN not set

const api = axios.create({
  baseURL: BASE_URL,
  headers: AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {},
  timeout: 20000,
});

function logStep(name) {
  console.log(`\n=== ${name} ===`);
}

async function main() {
  try {
    // Bootstrap token if not provided
    if (!AUTH_TOKEN) {
      if (!TEST_EMAIL || !TEST_OTP) {
        console.error(
          'Provide TEST_EMAIL and TEST_OTP env vars to bootstrap auth, or set AUTH_TOKEN.'
        );
        process.exit(1);
      }
      // Skip registration if we already have an OTP - just verify it
      logStep('POST /auth/verify-otp');
      const verify = await api.post('/auth/verify-otp', {
        email: TEST_EMAIL,
        otp: TEST_OTP,
      });
      // Token may be at verify.data.data.accessToken or at top-level depending on implementation
      AUTH_TOKEN =
        verify.data?.data?.accessToken ||
        verify.data?.token ||
        verify.data?.data?.token;
      if (!AUTH_TOKEN) {
        throw new Error('Failed to obtain token from verify-otp response');
      }
      api.defaults.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
      console.log('Authenticated as', TEST_EMAIL);
    }

    // 1) Sanity check current user
    logStep('GET /auth/me');
    const me = await api.get('/auth/me');
    console.log(
      'User:',
      me.data?.user?.email || me.data?.data?.user?.email || 'unknown'
    );

    // 2) Get study progress (may be null)
    logStep('GET /study/progress');
    const progressInitial = await api.get('/study/progress');
    console.log('Initial progress:', progressInitial.data?.data || null);

    // 3) Upsert study progress
    const upsertBody = {
      pathId: 'accountability',
      currentBookIndex: 0,
      currentChapterIndex: 0,
      completedChapters: [],
      currentDay: 1,
      totalDays: 12,
      lastStudiedAt: new Date().toISOString(),
    };
    logStep('PUT /study/progress');
    const progressUpdated = await api.put('/study/progress', upsertBody);
    console.log('Progress updated:', progressUpdated.data?.data?.pathId);

    // 4) Verify progress
    logStep('GET /study/progress (verify)');
    const progressVerify = await api.get('/study/progress');
    if (
      !progressVerify.data?.data ||
      progressVerify.data.data.pathId !== upsertBody.pathId
    ) {
      throw new Error('Progress verification failed');
    }
    console.log('Progress verified:', progressVerify.data.data.pathId);

    // 5) Post a study session
    const sessionBody = {
      pathId: upsertBody.pathId,
      book: 'Romans',
      chapter: 5,
      verses: [],
      reflection: 'Grace and peace through our Lord Jesus Christ.',
      duration: 12,
      completedAt: new Date().toISOString(),
    };
    logStep('POST /study/sessions');
    const sessionCreate = await api.post('/study/sessions', sessionBody);
    console.log(
      'Session created id:',
      sessionCreate.data?.data?.id || '(db generated)'
    );

    // 6) List sessions
    logStep('GET /study/sessions');
    const sessions = await api.get('/study/sessions');
    console.log('Sessions count:', (sessions.data?.data || []).length);

    // 7) Post a reflection
    const reflectionBody = {
      pathId: upsertBody.pathId,
      book: 'Romans',
      chapter: 5,
      verse: 1,
      content: 'We have peace with God through faith – personal takeaway.',
    };
    logStep('POST /study/reflections');
    const reflectionCreate = await api.post(
      '/study/reflections',
      reflectionBody
    );
    console.log(
      'Reflection created id:',
      reflectionCreate.data?.data?.id || '(db generated)'
    );

    // 8) List reflections
    logStep('GET /study/reflections');
    const reflections = await api.get('/study/reflections');
    const list = reflections.data?.data || [];
    console.log('Reflections count:', list.length);
    const found = list.find(
      (r) => r.book === 'Romans' && r.chapter === 5 && r.verse === 1
    );
    if (!found) {
      throw new Error('Reflection not found in list');
    }
    console.log('Reflection verified for Romans 5:1');

    console.log('\nAll study tests completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error(
      '\nTest failed:',
      error.response?.data || error.message || error
    );
    process.exit(1);
  }
}

main();
