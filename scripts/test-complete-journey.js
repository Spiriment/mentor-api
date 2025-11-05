#!/usr/bin/env node

/**
 * Complete User Journey Test Suite
 *
 * This file tests the complete user journey from registration to role-specific onboarding.
 * Run with: node test-complete-journey.js
 */

const BASE_URL = 'http://localhost:6802/api';
let testEmail = `test${Date.now()}@example.com`;
let userId = '';
let accessToken = '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  log(`\n🧪 Testing: ${testName}`, 'cyan');
  log('='.repeat(50), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    return {
      success: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: { error: error.message },
    };
  }
}

async function testEmailRegistration() {
  logTest('Email Registration');

  const result = await makeRequest(`${BASE_URL}/auth/email-registration`, {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
    }),
  });

  if (result.success) {
    logSuccess('Email registration successful');
    logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);
    return true;
  } else {
    logError(`Email registration failed: ${result.status}`);
    logError(`Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

async function testOTPVerification() {
  logTest('OTP Verification');

  // For testing, we'll use a hardcoded OTP since we're logging it to console
  const otp = '123456'; // This should be replaced with actual OTP from server console

  logInfo(`Using OTP: ${otp}`);
  logInfo('Note: Check server console for actual OTP if this fails');

  const result = await makeRequest(`${BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      otp: otp,
    }),
  });

  if (result.success) {
    logSuccess('OTP verification successful');
    logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);
    return true;
  } else {
    logError(`OTP verification failed: ${result.status}`);
    logError(`Error: ${JSON.stringify(result.data, null, 2)}`);
    logInfo('💡 Check server console for the actual OTP code');
    return false;
  }
}

async function testProfileUpdate() {
  logTest('Profile Update');

  const profileData = {
    email: testEmail,
    firstName: 'John',
    lastName: 'Doe',
    gender: 'male',
    country: 'United States',
    countryCode: 'US',
    birthday: '1990-01-15',
  };

  const result = await makeRequest(`${BASE_URL}/auth/update-profile`, {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });

  if (result.success) {
    logSuccess('Profile update successful');
    logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);
    return true;
  } else {
    logError(`Profile update failed: ${result.status}`);
    logError(`Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

async function testRoleSelection() {
  logTest('Role Selection (Mentee)');

  const roleData = {
    email: testEmail,
    role: 'mentee',
  };

  const result = await makeRequest(`${BASE_URL}/auth/select-role`, {
    method: 'POST',
    body: JSON.stringify(roleData),
  });

  if (result.success) {
    logSuccess('Role selection successful');
    logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);

    // Extract user ID and token for future use
    if (result.data.data && result.data.data.accessToken) {
      accessToken = result.data.data.accessToken;
      userId = result.data.data.user.id;
      logInfo(`User ID: ${userId}`);
      logInfo(`Access Token: ${accessToken.substring(0, 20)}...`);
    }

    return true;
  } else {
    logError(`Role selection failed: ${result.status}`);
    logError(`Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

async function testMenteeOnboarding() {
  logTest('Mentee Onboarding Steps');

  if (!userId) {
    logError('User ID not available. Please complete role selection first.');
    return false;
  }

  const onboardingSteps = [
    {
      name: 'Bible Reading Frequency',
      endpoint: `/api/mentee-profiles/${userId}/bible-reading-frequency`,
      data: { bibleReadingFrequency: 'daily' },
    },
    {
      name: 'Scripture Confidence',
      endpoint: `/api/mentee-profiles/${userId}/scripture-confidence`,
      data: { scriptureConfidence: 'intermediate' },
    },
    {
      name: 'Current Mentorship',
      endpoint: `/api/mentee-profiles/${userId}/current-mentorship`,
      data: { currentMentorship: 'no' },
    },
    {
      name: 'Spiritual Growth Areas',
      endpoint: `/api/mentee-profiles/${userId}/spiritual-growth-areas`,
      data: { spiritualGrowthAreas: ['prayer', 'bible_study', 'worship'] },
    },
    {
      name: 'Christian Experience',
      endpoint: `/api/mentee-profiles/${userId}/christian-experience`,
      data: { christianExperience: '2-5 years' },
    },
    {
      name: 'Bible Topics',
      endpoint: `/api/mentee-profiles/${userId}/bible-topics`,
      data: { bibleTopics: ['old_testament', 'new_testament', 'prophecy'] },
    },
    {
      name: 'Learning Preference',
      endpoint: `/api/mentee-profiles/${userId}/learning-preference`,
      data: { learningPreference: 'in_depth_bible_study' },
    },
    {
      name: 'Mentorship Format',
      endpoint: `/api/mentee-profiles/${userId}/mentorship-format`,
      data: { mentorshipFormat: ['one_on_one_calls', 'messaging_chat'] },
    },
    {
      name: 'Availability',
      endpoint: `/api/mentee-profiles/${userId}/availability`,
      data: { availability: ['weekday_evenings', 'weekend_mornings'] },
    },
    {
      name: 'Mentor Expectations',
      endpoint: `/api/mentee-profiles/${userId}/mentor-expectations`,
      data: {
        mentorExpectations: [
          'spiritual_guidance',
          'bible_teaching',
          'prayer_support',
        ],
      },
    },
    {
      name: 'Spiritual Goals',
      endpoint: `/api/mentee-profiles/${userId}/spiritual-goals`,
      data: {
        spiritualGoals: ['deeper_faith', 'bible_knowledge', 'prayer_life'],
      },
    },
    {
      name: 'Profile Image',
      endpoint: `/api/mentee-profiles/${userId}/profile-image`,
      data: { profileImage: 'https://example.com/profile.jpg' },
    },
  ];

  let successCount = 0;

  for (const step of onboardingSteps) {
    logInfo(`Testing: ${step.name}`);

    const result = await makeRequest(`${BASE_URL}${step.endpoint}`, {
      method: 'PUT',
      body: JSON.stringify(step.data),
    });

    if (result.success) {
      logSuccess(`${step.name} updated successfully`);
      successCount++;
    } else {
      logError(`${step.name} failed: ${result.status}`);
      logError(`Error: ${JSON.stringify(result.data, null, 2)}`);
    }
  }

  logInfo(
    `Mentee onboarding: ${successCount}/${onboardingSteps.length} steps completed`
  );
  return successCount === onboardingSteps.length;
}

async function testMenteeProfileRetrieval() {
  logTest('Mentee Profile Retrieval');

  if (!userId) {
    logError('User ID not available');
    return false;
  }

  const result = await makeRequest(`${BASE_URL}/api/mentee-profiles/${userId}`);

  if (result.success) {
    logSuccess('Mentee profile retrieved successfully');
    logInfo(`Profile data: ${JSON.stringify(result.data, null, 2)}`);
    return true;
  } else {
    logError(`Profile retrieval failed: ${result.status}`);
    logError(`Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

async function testOnboardingProgress() {
  logTest('Onboarding Progress');

  if (!userId) {
    logError('User ID not available');
    return false;
  }

  const result = await makeRequest(
    `${BASE_URL}/api/mentee-profiles/${userId}/onboarding-progress`
  );

  if (result.success) {
    logSuccess('Onboarding progress retrieved successfully');
    logInfo(`Progress: ${JSON.stringify(result.data, null, 2)}`);
    return true;
  } else {
    logError(`Progress retrieval failed: ${result.status}`);
    logError(`Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

async function runCompleteJourneyTest() {
  log('🚀 Starting Complete User Journey Test', 'bright');
  log('='.repeat(60), 'bright');
  log(`📧 Using email: ${testEmail}`, 'yellow');

  const results = {
    emailRegistration: false,
    otpVerification: false,
    profileUpdate: false,
    roleSelection: false,
    menteeOnboarding: false,
    profileRetrieval: false,
    onboardingProgress: false,
  };

  // Step 1: Email Registration
  results.emailRegistration = await testEmailRegistration();
  if (!results.emailRegistration) {
    logError('Email registration failed. Stopping test.');
    return;
  }

  // Step 2: Wait for OTP
  logInfo('Waiting 3 seconds for OTP generation...');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Step 3: OTP Verification
  results.otpVerification = await testOTPVerification();
  if (!results.otpVerification) {
    logError('OTP verification failed. Please check server console for OTP.');
    logInfo('Continuing with mock data for testing...');
    // For testing purposes, we'll continue with mock data
    userId = 'test-user-id-' + Date.now();
  }

  // Step 4: Profile Update
  results.profileUpdate = await testProfileUpdate();
  if (!results.profileUpdate) {
    logError('Profile update failed. Stopping test.');
    return;
  }

  // Step 5: Role Selection
  results.roleSelection = await testRoleSelection();
  if (!results.roleSelection) {
    logError('Role selection failed. Stopping test.');
    return;
  }

  // Step 6: Mentee Onboarding
  results.menteeOnboarding = await testMenteeOnboarding();

  // Step 7: Profile Retrieval
  results.profileRetrieval = await testMenteeProfileRetrieval();

  // Step 8: Onboarding Progress
  results.onboardingProgress = await testOnboardingProgress();

  // Summary
  log('\n📊 Complete Journey Test Results', 'bright');
  log('='.repeat(60), 'bright');

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? 'green' : 'red';
    log(`${test.padEnd(25)}: ${status}`, color);
  });

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;

  log(
    `\nOverall: ${passedTests}/${totalTests} tests passed`,
    passedTests === totalTests ? 'green' : 'yellow'
  );

  if (passedTests === totalTests) {
    log('\n🎉 Complete user journey test successful!', 'green');
    log('The backend is ready for frontend integration!', 'green');
  } else {
    log('\n⚠️  Some tests failed. Check the errors above.', 'yellow');
  }
}

// Run the complete journey test
runCompleteJourneyTest().catch(console.error);
