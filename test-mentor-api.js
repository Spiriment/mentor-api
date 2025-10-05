#!/usr/bin/env node

/**
 * Mentor App API Test Suite
 *
 * This file contains comprehensive tests for all mentor app API endpoints.
 * Run with: node test-mentor-api.js
 */

const BASE_URL = 'http://localhost:6802/api/auth';
let testEmail = `test${Date.now()}@example.com`;
let testOTP = '';

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

  const result = await makeRequest(`${BASE_URL}/email-registration`, {
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
  // In real testing, you'd get this from the server logs
  const otp = testOTP || '123456'; // Default fallback

  logInfo(`Using OTP: ${otp}`);

  const result = await makeRequest(`${BASE_URL}/verify-otp`, {
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

  const result = await makeRequest(`${BASE_URL}/update-profile`, {
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
  logTest('Role Selection');

  const roleData = {
    email: testEmail,
    role: 'mentee', // or 'mentor'
  };

  const result = await makeRequest(`${BASE_URL}/select-role`, {
    method: 'POST',
    body: JSON.stringify(roleData),
  });

  if (result.success) {
    logSuccess('Role selection successful');
    logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);

    // Extract tokens for future use
    if (result.data.data && result.data.data.accessToken) {
      logInfo(
        `Access Token: ${result.data.data.accessToken.substring(0, 20)}...`
      );
      logInfo(`User ID: ${result.data.data.user.id}`);
    }

    return true;
  } else {
    logError(`Role selection failed: ${result.status}`);
    logError(`Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

async function testMentorRoleSelection() {
  logTest('Mentor Role Selection');

  const roleData = {
    email: testEmail,
    role: 'mentor',
  };

  const result = await makeRequest(`${BASE_URL}/select-role`, {
    method: 'POST',
    body: JSON.stringify(roleData),
  });

  if (result.success) {
    logSuccess('Mentor role selection successful');
    logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);
    return true;
  } else {
    logError(`Mentor role selection failed: ${result.status}`);
    logError(`Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

async function testServerHealth() {
  logTest('Server Health Check');

  const result = await makeRequest('http://localhost:6802/', {
    method: 'GET',
  });

  if (result.success || result.status === 404) {
    logSuccess('Server is running and responding');
    return true;
  } else {
    logError(`Server health check failed: ${result.status}`);
    return false;
  }
}

async function runAllTests() {
  log('🚀 Starting Mentor App API Tests', 'bright');
  log('='.repeat(60), 'bright');

  const results = {
    serverHealth: false,
    emailRegistration: false,
    otpVerification: false,
    profileUpdate: false,
    roleSelection: false,
    mentorRoleSelection: false,
  };

  // Test 1: Server Health
  results.serverHealth = await testServerHealth();

  if (!results.serverHealth) {
    logError('Server is not running. Please start the server first.');
    logInfo('Run: npm run dev');
    return;
  }

  // Test 2: Email Registration
  results.emailRegistration = await testEmailRegistration();

  if (!results.emailRegistration) {
    logError('Email registration failed. Check server logs for OTP.');
    return;
  }

  // Wait a moment for OTP to be generated
  logInfo('Waiting 2 seconds for OTP generation...');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test 3: OTP Verification
  results.otpVerification = await testOTPVerification();

  if (!results.otpVerification) {
    logError(
      'OTP verification failed. Check the server console for the OTP code.'
    );
    logInfo('Look for: 🔐 OTP for test@example.com: XXXXXX');
    return;
  }

  // Test 4: Profile Update
  results.profileUpdate = await testProfileUpdate();

  if (!results.profileUpdate) {
    logError('Profile update failed.');
    return;
  }

  // Test 5: Role Selection (Mentee)
  results.roleSelection = await testRoleSelection();

  if (!results.roleSelection) {
    logError('Role selection failed.');
    return;
  }

  // Test 6: Role Selection (Mentor) - with different email
  testEmail = 'mentor@example.com';
  await testEmailRegistration();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await testOTPVerification();
  await testProfileUpdate();
  results.mentorRoleSelection = await testMentorRoleSelection();

  // Summary
  log('\n📊 Test Results Summary', 'bright');
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
}

// Helper function to test individual endpoints
async function testIndividual(testName) {
  log(`🧪 Running individual test: ${testName}`, 'cyan');

  switch (testName) {
    case 'health':
      await testServerHealth();
      break;
    case 'email':
      await testEmailRegistration();
      break;
    case 'otp':
      await testOTPVerification();
      break;
    case 'profile':
      await testProfileUpdate();
      break;
    case 'role':
      await testRoleSelection();
      break;
    case 'mentor':
      await testMentorRoleSelection();
      break;
    default:
      logError(`Unknown test: ${testName}`);
      logInfo('Available tests: health, email, otp, profile, role, mentor');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Run individual test
    await testIndividual(args[0]);
  } else {
    // Run all tests
    await runAllTests();
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logError(`Unhandled rejection: ${error.message}`);
  process.exit(1);
});

// Run the tests
main().catch(console.error);
