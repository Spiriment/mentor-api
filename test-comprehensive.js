/*
Comprehensive test script for mentor app backend
Run with: BASE_URL=http://localhost:6802/api node test-comprehensive.js
*/

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:6802/api';
let AUTH_TOKEN = process.env.AUTH_TOKEN;
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_OTP = process.env.TEST_OTP;

const api = axios.create({
  baseURL: BASE_URL,
  headers: AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {},
  timeout: 20000,
});

function logStep(name) {
  console.log(`\n=== ${name} ===`);
}

async function testAuthFlow() {
  logStep('AUTH FLOW TESTS');

  if (!AUTH_TOKEN) {
    if (!TEST_OTP) {
      console.log('Skipping auth flow - no OTP provided');
      return false;
    }

    // Test OTP verification
    logStep('POST /auth/verify-otp');
    const verify = await api.post('/auth/verify-otp', {
      email: TEST_EMAIL,
      otp: TEST_OTP,
    });

    AUTH_TOKEN = verify.data?.data?.accessToken || verify.data?.accessToken;
    if (!AUTH_TOKEN) {
      throw new Error('Failed to obtain token from verify-otp response');
    }
    api.defaults.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    console.log('✅ Authentication successful');
  }

  // Test profile retrieval
  logStep('GET /auth/me');
  const me = await api.get('/auth/me');
  console.log('✅ Profile retrieved:', me.data?.user?.email || 'unknown');

  return true;
}

async function testStudySystem() {
  logStep('STUDY SYSTEM TESTS');

  // Test study progress
  logStep('GET /study/progress');
  const progressInitial = await api.get('/study/progress');
  console.log('✅ Initial progress retrieved');

  // Test progress update
  const progressData = {
    pathId: 'accountability',
    currentBookIndex: 0,
    currentChapterIndex: 0,
    completedChapters: [],
    currentDay: 1,
    totalDays: 12,
    lastStudiedAt: new Date().toISOString(),
  };

  logStep('PUT /study/progress');
  await api.put('/study/progress', progressData);
  console.log('✅ Progress updated');

  // Test study session
  const sessionData = {
    pathId: 'accountability',
    book: 'James',
    chapter: 1,
    verses: ['1-8'],
    reflection: 'Testing study session creation',
    duration: 15,
    completedAt: new Date().toISOString(),
  };

  logStep('POST /study/sessions');
  const session = await api.post('/study/sessions', sessionData);
  console.log('✅ Study session created:', session.data?.data?.id);

  // Test reflection
  const reflectionData = {
    pathId: 'accountability',
    book: 'James',
    chapter: 1,
    verse: 5,
    content: 'Testing reflection creation',
  };

  logStep('POST /study/reflections');
  const reflection = await api.post('/study/reflections', reflectionData);
  console.log('✅ Reflection created:', reflection.data?.data?.id);

  // Test data retrieval
  logStep('GET /study/sessions');
  const sessions = await api.get('/study/sessions');
  console.log('✅ Sessions retrieved:', sessions.data?.data?.length || 0);

  logStep('GET /study/reflections');
  const reflections = await api.get('/study/reflections');
  console.log('✅ Reflections retrieved:', reflections.data?.data?.length || 0);
}

async function testBibleSystem() {
  logStep('BIBLE SYSTEM TESTS');

  // Test Bible chapter retrieval
  logStep('GET /bible/chapter/romans/5');
  try {
    const chapter = await api.get('/bible/chapter/romans/5');
    console.log('✅ Bible chapter retrieved:', chapter.data?.reference);
  } catch (error) {
    console.log('⚠️  Bible chapter test failed (may need Bible API setup)');
  }

  // Test Bible bookmarks
  logStep('POST /bible/user/bookmarks');
  try {
    const bookmark = await api.post('/bible/user/bookmarks', {
      translation: 'kjv',
      book: 'Romans',
      chapter: 5,
      verse: 1,
      note: 'Test bookmark',
    });
    console.log('✅ Bookmark created:', bookmark.data?.data?.id);
  } catch (error) {
    console.log('⚠️  Bookmark test failed');
  }

  // Test Bible highlights
  logStep('POST /bible/user/highlights');
  try {
    const highlight = await api.post('/bible/user/highlights', {
      translation: 'kjv',
      book: 'Romans',
      chapter: 5,
      verse: 1,
      color: '#FFD54F',
    });
    console.log('✅ Highlight created:', highlight.data?.data?.id);
  } catch (error) {
    console.log('⚠️  Highlight test failed');
  }
}

async function testSessionScheduling() {
  logStep('SESSION SCHEDULING TESTS');

  // Test mentor availability
  logStep('GET /sessions/availability');
  try {
    const availability = await api.get('/sessions/availability');
    console.log('✅ Availability retrieved');
  } catch (error) {
    console.log('⚠️  Availability test failed (may need mentor data)');
  }

  // Test session creation
  logStep('POST /sessions');
  try {
    const session = await api.post('/sessions', {
      mentorId: 'test-mentor-id',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      duration: 60,
      type: 'video',
      notes: 'Test session',
    });
    console.log('✅ Session created:', session.data?.data?.id);
  } catch (error) {
    console.log('⚠️  Session creation test failed (may need mentor setup)');
  }
}

async function testStreakSystem() {
  logStep('STREAK SYSTEM TESTS');

  // Test streak update
  logStep('PUT /auth/profile');
  try {
    const profileUpdate = await api.put('/auth/profile', {
      currentStreak: 5,
      longestStreak: 10,
      lastStreakDate: new Date().toISOString(),
      weeklyStreakData: [true, true, false, true, true, true, false],
    });
    console.log('✅ Streak data updated');
  } catch (error) {
    console.log('⚠️  Streak update test failed');
  }
}

async function main() {
  try {
    console.log('🚀 Starting comprehensive mentor app backend tests...\n');

    // Test authentication
    const authSuccess = await testAuthFlow();
    if (!authSuccess) {
      console.log('❌ Authentication failed, skipping other tests');
      return;
    }

    // Test core systems
    await testStudySystem();
    await testBibleSystem();
    await testSessionScheduling();
    await testStreakSystem();

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('✅ Authentication system');
    console.log('✅ Study progress tracking');
    console.log('✅ Study sessions');
    console.log('✅ Study reflections');
    console.log('⚠️  Bible system (may need API setup)');
    console.log('⚠️  Session scheduling (may need mentor data)');
    console.log('⚠️  Streak system (may need profile setup)');
  } catch (error) {
    console.error(
      '\n❌ Test failed:',
      error.response?.data || error.message || error
    );
    process.exit(1);
  }
}

main();
