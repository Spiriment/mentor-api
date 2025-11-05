#!/usr/bin/env node

/**
 * Mentee Profile Endpoints Test
 *
 * This file tests the mentee profile endpoints with a mock user.
 * Run with: node test-mentee-endpoints.js
 */

const BASE_URL = 'http://localhost:6802/api';

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

async function testMenteeProfileEndpoints() {
  log('🚀 Testing Mentee Profile Endpoints', 'bright');
  log('='.repeat(60), 'bright');

  // Generate a valid UUID for testing
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  const tests = [
    {
      name: 'Get Non-existent Profile',
      method: 'GET',
      url: `/api/mentee-profiles/${testUserId}`,
      expectedStatus: 404,
    },
    {
      name: 'Get Onboarding Progress (Non-existent)',
      method: 'GET',
      url: `/api/mentee-profiles/${testUserId}/onboarding-progress`,
      expectedStatus: 200, // Should return default progress
    },
    {
      name: 'Update Bible Reading Frequency (Invalid User)',
      method: 'PUT',
      url: `/api/mentee-profiles/${testUserId}/bible-reading-frequency`,
      body: { bibleReadingFrequency: 'daily' },
      expectedStatus: 400, // Should fail because user doesn't exist in DB
    },
    {
      name: 'Update Scripture Confidence (Invalid User)',
      method: 'PUT',
      url: `/api/mentee-profiles/${testUserId}/scripture-confidence`,
      body: { scriptureConfidence: 'intermediate' },
      expectedStatus: 400,
    },
    {
      name: 'Update Current Mentorship (Invalid User)',
      method: 'PUT',
      url: `/api/mentee-profiles/${testUserId}/current-mentorship`,
      body: { currentMentorship: 'no' },
      expectedStatus: 400,
    },
    {
      name: 'Update Spiritual Growth Areas (Invalid User)',
      method: 'PUT',
      url: `/api/mentee-profiles/${testUserId}/spiritual-growth-areas`,
      body: { spiritualGrowthAreas: ['prayer', 'bible_study'] },
      expectedStatus: 400,
    },
    {
      name: 'Update Christian Experience (Invalid User)',
      method: 'PUT',
      url: `/api/mentee-profiles/${testUserId}/christian-experience`,
      body: { christianExperience: '2-5 years' },
      expectedStatus: 400,
    },
    {
      name: 'Update Bible Topics (Invalid User)',
      method: 'PUT',
      url: `/api/mentee-profiles/${testUserId}/bible-topics`,
      body: { bibleTopics: ['old_testament', 'new_testament'] },
      expectedStatus: 400,
    },
    {
      name: 'Update Learning Preference (Invalid User)',
      method: 'PUT',
      url: `/api/mentee-profiles/${testUserId}/learning-preference`,
      body: { learningPreference: 'in_depth_bible_study' },
      expectedStatus: 400,
    },
    {
      name: 'Update Mentorship Format (Invalid User)',
      method: 'PUT',
      url: `/api/mentee-profiles/${testUserId}/mentorship-format`,
      body: { mentorshipFormat: ['one_on_one_calls'] },
      expectedStatus: 400,
    },
    {
      name: 'Update Availability (Invalid User)',
      method: 'PUT',
      url: `/api/mentee-profiles/${testUserId}/availability`,
      body: { availability: ['weekday_evenings'] },
      expectedStatus: 400,
    },
    {
      name: 'Update Mentor Expectations (Invalid User)',
      method: 'PUT',
      url: `/api/mentee-profiles/${testUserId}/mentor-expectations`,
      body: { mentorExpectations: ['spiritual_guidance'] },
      expectedStatus: 400,
    },
    {
      name: 'Update Spiritual Goals (Invalid User)',
      method: 'PUT',
      url: `/api/mentee-profiles/${testUserId}/spiritual-goals`,
      body: { spiritualGoals: ['deeper_faith'] },
      expectedStatus: 400,
    },
    {
      name: 'Update Profile Image (Invalid User)',
      method: 'PUT',
      url: `/api/mentee-profiles/${testUserId}/profile-image`,
      body: { profileImage: 'https://example.com/profile.jpg' },
      expectedStatus: 400,
    },
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    logTest(test.name);

    const result = await makeRequest(`${BASE_URL}${test.url}`, {
      method: test.method,
      body: test.body ? JSON.stringify(test.body) : undefined,
    });

    const passed = result.status === test.expectedStatus;

    if (passed) {
      logSuccess(
        `${test.name} - Status ${result.status} (Expected ${test.expectedStatus})`
      );
      passedTests++;
    } else {
      logError(
        `${test.name} - Status ${result.status} (Expected ${test.expectedStatus})`
      );
      logError(`Response: ${JSON.stringify(result.data, null, 2)}`);
    }
  }

  // Summary
  log('\n📊 Test Results Summary', 'bright');
  log('='.repeat(60), 'bright');
  log(
    `Passed: ${passedTests}/${totalTests}`,
    passedTests === totalTests ? 'green' : 'yellow'
  );

  if (passedTests === totalTests) {
    log('\n🎉 All mentee profile endpoint tests passed!', 'green');
    log('The endpoints are working correctly with proper validation.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Check the errors above.', 'yellow');
  }

  // Test server health
  logTest('Server Health Check');
  const healthResult = await makeRequest(
    `${BASE_URL.replace('/api', '')}/health`
  );
  if (healthResult.success) {
    logSuccess('Server is running and healthy');
  } else {
    logError('Server health check failed');
  }
}

// Run the tests
testMenteeProfileEndpoints().catch(console.error);
