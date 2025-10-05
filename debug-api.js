#!/usr/bin/env node

/**
 * Simple API Debug Script
 */

const BASE_URL = 'http://localhost:6802/api/auth/mentor-app';

async function debugAPI() {
  console.log('🔍 Debugging Mentor App API...\n');

  try {
    // Test 1: Check if server is running
    console.log('1. Testing server health...');
    const healthResponse = await fetch('http://localhost:6802/');
    console.log(`   Status: ${healthResponse.status}`);
    const healthData = await healthResponse.text();
    console.log(`   Response: ${healthData.substring(0, 100)}...\n`);

    // Test 2: Test email registration
    console.log('2. Testing email registration...');
    const emailResponse = await fetch(`${BASE_URL}/email-registration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
      }),
    });

    console.log(`   Status: ${emailResponse.status}`);
    const emailData = await emailResponse.json();
    console.log(`   Response:`, JSON.stringify(emailData, null, 2));

    // Test 3: Check if routes are properly registered
    console.log('\n3. Testing route registration...');
    const routesResponse = await fetch('http://localhost:6802/api/');
    console.log(`   Status: ${routesResponse.status}`);
    const routesData = await routesResponse.text();
    console.log(`   Response: ${routesData.substring(0, 200)}...\n`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugAPI();
