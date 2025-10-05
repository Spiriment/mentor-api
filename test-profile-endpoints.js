#!/usr/bin/env node

/**
 * Profile Endpoints Test
 *
 * This script tests the new profile endpoints:
 * - GET /auth/me (get current user profile)
 * - PUT /auth/profile (update user profile)
 *
 * Run with: node test-profile-endpoints.js
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

let authToken = '';

async function testAuthenticationFlow() {
  logTest('Authentication Flow');

  try {
    // Step 1: Register with email
    const email = `test${Date.now()}@example.com`;
    logInfo(`Registering with email: ${email}`);

    const registerResponse = await fetch(
      `${BASE_URL}/auth/email-registration`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }
    );

    if (!registerResponse.ok) {
      const error = await registerResponse.json();
      logError(`Registration failed: ${JSON.stringify(error)}`);
      return false;
    }

    // Step 2: Verify OTP (we'll use a mock OTP for testing)
    logInfo('Verifying OTP...');
    const verifyResponse = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        otp: '123456', // This should be the actual OTP from server logs
      }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      logError(`OTP verification failed: ${JSON.stringify(error)}`);
      return false;
    }

    // Step 3: Update profile
    logInfo('Updating profile...');
    const profileResponse = await fetch(`${BASE_URL}/auth/update-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        firstName: 'Test',
        lastName: 'User',
        gender: 'male',
        country: 'United States',
        countryCode: 'US',
        birthday: '1990-01-01',
      }),
    });

    if (!profileResponse.ok) {
      const error = await profileResponse.json();
      logError(`Profile update failed: ${JSON.stringify(error)}`);
      return false;
    }

    // Step 4: Select role
    logInfo('Selecting role...');
    const roleResponse = await fetch(`${BASE_URL}/auth/select-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        role: 'mentee',
      }),
    });

    if (!roleResponse.ok) {
      const error = await roleResponse.json();
      logError(`Role selection failed: ${JSON.stringify(error)}`);
      return false;
    }

    const roleData = await roleResponse.json();
    authToken = roleData.data.accessToken;

    logSuccess('Authentication flow completed successfully');
    logInfo(`Auth token: ${authToken.substring(0, 20)}...`);

    return true;
  } catch (error) {
    logError(`Authentication flow error: ${error.message}`);
    return false;
  }
}

async function testGetCurrentUserProfile() {
  logTest('Get Current User Profile (GET /auth/me)');

  try {
    const response = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      logSuccess('Current user profile retrieved successfully');
      logInfo(`User ID: ${data.data.user.id}`);
      logInfo(`Email: ${data.data.user.email}`);
      logInfo(`Name: ${data.data.user.firstName} ${data.data.user.lastName}`);
      logInfo(`Role: ${data.data.user.role}`);
      logInfo(`Onboarding Complete: ${data.data.user.isOnboardingComplete}`);
      return true;
    } else {
      logError(`Failed to get current user profile: ${response.status}`);
      logError(`Error: ${JSON.stringify(data, null, 2)}`);
      return false;
    }
  } catch (error) {
    logError(`Error getting current user profile: ${error.message}`);
    return false;
  }
}

async function testUpdateUserProfile() {
  logTest('Update User Profile (PUT /auth/profile)');

  try {
    const updateData = {
      firstName: 'Updated',
      lastName: 'Name',
      gender: 'female',
      country: 'Canada',
      countryCode: 'CA',
    };

    const response = await fetch(`${BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    const data = await response.json();

    if (response.ok) {
      logSuccess('User profile updated successfully');
      logInfo(
        `Updated name: ${data.data.user.firstName} ${data.data.user.lastName}`
      );
      logInfo(`Updated gender: ${data.data.user.gender}`);
      logInfo(`Updated country: ${data.data.user.country}`);
      return true;
    } else {
      logError(`Failed to update user profile: ${response.status}`);
      logError(`Error: ${JSON.stringify(data, null, 2)}`);
      return false;
    }
  } catch (error) {
    logError(`Error updating user profile: ${error.message}`);
    return false;
  }
}

async function testUnauthorizedAccess() {
  logTest('Unauthorized Access (No Token)');

  try {
    const response = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      logSuccess('Unauthorized access properly blocked');
      return true;
    } else {
      logError(`Expected 401 Unauthorized, got ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Error testing unauthorized access: ${error.message}`);
    return false;
  }
}

async function testInvalidToken() {
  logTest('Invalid Token Access');

  try {
    const response = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid-token-here',
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      logSuccess('Invalid token properly rejected');
      return true;
    } else {
      logError(`Expected 401 Unauthorized, got ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Error testing invalid token: ${error.message}`);
    return false;
  }
}

async function runProfileEndpointTests() {
  log('🚀 Starting Profile Endpoints Test Suite', 'bright');
  log('='.repeat(60), 'bright');

  const results = {
    authenticationFlow: false,
    getCurrentUserProfile: false,
    updateUserProfile: false,
    unauthorizedAccess: false,
    invalidToken: false,
  };

  // Run tests in order
  results.authenticationFlow = await testAuthenticationFlow();

  if (results.authenticationFlow) {
    results.getCurrentUserProfile = await testGetCurrentUserProfile();
    results.updateUserProfile = await testUpdateUserProfile();
  }

  results.unauthorizedAccess = await testUnauthorizedAccess();
  results.invalidToken = await testInvalidToken();

  // Summary
  log('\n📊 Profile Endpoints Test Results', 'bright');
  log('='.repeat(60), 'bright');

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? 'green' : 'red';
    log(`${test.padEnd(30)}: ${status}`, color);
  });

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;

  log(
    `\nOverall: ${passedTests}/${totalTests} tests passed`,
    passedTests === totalTests ? 'green' : 'yellow'
  );

  if (passedTests === totalTests) {
    log('\n🎉 All profile endpoint tests passed!', 'green');
    log('Profile endpoints are ready for frontend integration!', 'green');
  } else {
    log('\n⚠️  Some tests failed. Check the errors above.', 'yellow');
  }

  return passedTests === totalTests;
}

// Run the tests
runProfileEndpointTests().catch(console.error);
