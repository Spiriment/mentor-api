#!/usr/bin/env node

/**
 * File Upload Test Suite
 *
 * This file tests the file upload functionality for profile images and video introductions.
 * Run with: node test-file-upload.js
 */

const BASE_URL = 'http://localhost:6802/api';
const fs = require('fs');
const path = require('path');

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

// Create test files
function createTestFiles() {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const profileImagesDir = path.join(uploadsDir, 'profile-images');
  const videoIntroductionsDir = path.join(uploadsDir, 'video-introductions');

  // Create directories if they don't exist
  [uploadsDir, profileImagesDir, videoIntroductionsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Create a test image file (simple base64 encoded 1x1 pixel PNG)
  const testImageBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const testImagePath = path.join(profileImagesDir, 'test-image.png');
  fs.writeFileSync(testImagePath, Buffer.from(testImageBase64, 'base64'));

  // Create a test video file (minimal MP4 header)
  const testVideoPath = path.join(videoIntroductionsDir, 'test-video.mp4');
  const testVideoData = Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31,
  ]);
  fs.writeFileSync(testVideoPath, testVideoData);

  return { testImagePath, testVideoPath };
}

async function testProfileImageUpload() {
  logTest('Profile Image Upload');

  const { testImagePath } = createTestFiles();

  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('profileImage', fs.createReadStream(testImagePath));

    const response = await fetch(`${BASE_URL}/upload/profile-image`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    const data = await response.json();

    if (response.ok) {
      logSuccess('Profile image uploaded successfully');
      logInfo(`Response: ${JSON.stringify(data, null, 2)}`);
      return data.data.url;
    } else {
      logError(`Profile image upload failed: ${response.status}`);
      logError(`Error: ${JSON.stringify(data, null, 2)}`);
      return null;
    }
  } catch (error) {
    logError(`Profile image upload error: ${error.message}`);
    return null;
  }
}

async function testVideoIntroductionUpload() {
  logTest('Video Introduction Upload');

  const { testVideoPath } = createTestFiles();

  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('videoIntroduction', fs.createReadStream(testVideoPath));

    const response = await fetch(`${BASE_URL}/upload/video-introduction`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    const data = await response.json();

    if (response.ok) {
      logSuccess('Video introduction uploaded successfully');
      logInfo(`Response: ${JSON.stringify(data, null, 2)}`);
      return data.data.url;
    } else {
      logError(`Video introduction upload failed: ${response.status}`);
      logError(`Error: ${JSON.stringify(data, null, 2)}`);
      return null;
    }
  } catch (error) {
    logError(`Video introduction upload error: ${error.message}`);
    return null;
  }
}

async function testFileServing() {
  logTest('File Serving');

  try {
    // Test serving a profile image
    const imageResponse = await fetch(
      `${BASE_URL}/uploads/profile-images/test-image.png`
    );

    if (imageResponse.ok) {
      logSuccess('Profile image serving works');
    } else {
      logError(`Profile image serving failed: ${imageResponse.status}`);
    }

    // Test serving a video
    const videoResponse = await fetch(
      `${BASE_URL}/uploads/video-introductions/test-video.mp4`
    );

    if (videoResponse.ok) {
      logSuccess('Video serving works');
    } else {
      logError(`Video serving failed: ${videoResponse.status}`);
    }

    return imageResponse.ok && videoResponse.ok;
  } catch (error) {
    logError(`File serving error: ${error.message}`);
    return false;
  }
}

async function testInvalidFileUpload() {
  logTest('Invalid File Upload (Error Handling)');

  try {
    // Test uploading a text file as profile image
    const FormData = require('form-data');
    const form = new FormData();
    form.append(
      'profileImage',
      Buffer.from('This is not an image'),
      'test.txt'
    );

    const response = await fetch(`${BASE_URL}/upload/profile-image`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    const data = await response.json();

    if (
      !response.ok &&
      data.error &&
      data.error.code === 'INVALID_IMAGE_TYPE'
    ) {
      logSuccess('Invalid file type properly rejected');
      return true;
    } else {
      logError('Invalid file type was not properly rejected');
      logError(`Response: ${JSON.stringify(data, null, 2)}`);
      return false;
    }
  } catch (error) {
    logError(`Invalid file upload test error: ${error.message}`);
    return false;
  }
}

async function testFileSizeLimit() {
  logTest('File Size Limit');

  try {
    // Create a large file (51MB)
    const largeFile = Buffer.alloc(51 * 1024 * 1024); // 51MB
    const FormData = require('form-data');
    const form = new FormData();
    form.append('profileImage', largeFile, 'large-image.jpg');

    const response = await fetch(`${BASE_URL}/upload/profile-image`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    const data = await response.json();

    if (!response.ok && data.error && data.error.code === 'FILE_TOO_LARGE') {
      logSuccess('File size limit properly enforced');
      return true;
    } else {
      logError('File size limit was not properly enforced');
      logError(`Response: ${JSON.stringify(data, null, 2)}`);
      return false;
    }
  } catch (error) {
    logError(`File size limit test error: ${error.message}`);
    return false;
  }
}

async function testMenteeProfileWithImage() {
  logTest('Mentee Profile with Image URL');

  const testUserId = '550e8400-e29b-41d4-a716-446655440000';
  const imageUrl =
    'http://localhost:6802/uploads/profile-images/test-image.png';

  try {
    const response = await fetch(
      `${BASE_URL}/mentee-profiles/${testUserId}/profile-image`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          profileImage: imageUrl,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      logSuccess('Mentee profile image URL updated successfully');
      logInfo(`Response: ${JSON.stringify(data, null, 2)}`);
      return true;
    } else {
      logError(`Mentee profile image update failed: ${response.status}`);
      logError(`Error: ${JSON.stringify(data, null, 2)}`);
      return false;
    }
  } catch (error) {
    logError(`Mentee profile image update error: ${error.message}`);
    return false;
  }
}

async function testMentorProfileWithVideo() {
  logTest('Mentor Profile with Video URL');

  const testUserId = '550e8400-e29b-41d4-a716-446655440000';
  const videoUrl =
    'http://localhost:6802/uploads/video-introductions/test-video.mp4';

  try {
    const response = await fetch(
      `${BASE_URL}/mentor-profiles/${testUserId}/video-introduction`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          videoIntroduction: videoUrl,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      logSuccess('Mentor profile video URL updated successfully');
      logInfo(`Response: ${JSON.stringify(data, null, 2)}`);
      return true;
    } else {
      logError(`Mentor profile video update failed: ${response.status}`);
      logError(`Error: ${JSON.stringify(data, null, 2)}`);
      return false;
    }
  } catch (error) {
    logError(`Mentor profile video update error: ${error.message}`);
    return false;
  }
}

async function runFileUploadTests() {
  log('🚀 Starting File Upload Test Suite', 'bright');
  log('='.repeat(60), 'bright');

  const results = {
    profileImageUpload: false,
    videoIntroductionUpload: false,
    fileServing: false,
    invalidFileUpload: false,
    fileSizeLimit: false,
    menteeProfileWithImage: false,
    mentorProfileWithVideo: false,
  };

  // Run tests
  results.profileImageUpload = await testProfileImageUpload();
  results.videoIntroductionUpload = await testVideoIntroductionUpload();
  results.fileServing = await testFileServing();
  results.invalidFileUpload = await testInvalidFileUpload();
  results.fileSizeLimit = await testFileSizeLimit();
  results.menteeProfileWithImage = await testMenteeProfileWithImage();
  results.mentorProfileWithVideo = await testMentorProfileWithVideo();

  // Summary
  log('\n📊 File Upload Test Results', 'bright');
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
    log('\n🎉 All file upload tests passed!', 'green');
    log('File upload functionality is working correctly!', 'green');
  } else {
    log('\n⚠️  Some tests failed. Check the errors above.', 'yellow');
  }
}

// Run the tests
runFileUploadTests().catch(console.error);
