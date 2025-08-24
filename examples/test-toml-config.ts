#!/usr/bin/env node

/**
 * Test script to verify TOML configuration reading
 */

import { getCrunchyConeAPIURL, getCrunchyConeProjectID } from '../src/auth';
import * as fs from 'fs';
import * as path from 'path';

async function createTestTomlFile() {
  const testTomlContent = `# Test CrunchyCone Configuration
environment = "dev"

[project]
id = "test-project-123"
`;

  const tomlPath = path.join(process.cwd(), 'crunchycone.toml');
  fs.writeFileSync(tomlPath, testTomlContent);
  console.log(`✅ Created test crunchycone.toml file at: ${tomlPath}`);
  return tomlPath;
}

function cleanupTestFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`🧹 Cleaned up test file: ${filePath}`);
  }
}

async function testTomlConfiguration() {
  console.log('🧪 Testing CrunchyCone TOML Configuration');
  console.log('=' * 50);

  let testTomlPath: string | null = null;

  try {
    // Create a test TOML file
    testTomlPath = await createTestTomlFile();

    // Test API URL resolution
    console.log('\n📡 Testing API URL resolution:');
    const apiUrl = getCrunchyConeAPIURL();
    console.log(`   Resolved API URL: ${apiUrl}`);
    
    if (apiUrl === 'https://api.crunchycone.dev') {
      console.log('   ✅ Correctly resolved to dev environment');
    } else {
      console.log('   ❌ Expected dev environment URL');
    }

    // Test Project ID resolution
    console.log('\n🆔 Testing Project ID resolution:');
    const projectId = getCrunchyConeProjectID();
    console.log(`   Resolved Project ID: ${projectId || '(none)'}`);
    
    if (projectId === 'test-project-123') {
      console.log('   ✅ Correctly resolved project ID from TOML');
    } else {
      console.log('   ❌ Expected test-project-123');
    }

    // Test with environment variables override
    console.log('\n🔀 Testing environment variable override:');
    process.env.CRUNCHYCONE_API_URL = 'https://custom.api.url';
    process.env.CRUNCHYCONE_PROJECT_ID = 'env-project-456';

    const overriddenUrl = getCrunchyConeAPIURL();
    const overriddenProjectId = getCrunchyConeProjectID();
    
    console.log(`   API URL with env override: ${overriddenUrl}`);
    console.log(`   Project ID with env override: ${overriddenProjectId}`);
    
    if (overriddenUrl === 'https://custom.api.url') {
      console.log('   ✅ Environment variable correctly overrides TOML');
    } else {
      console.log('   ❌ Environment variable should override TOML');
    }

    // Clean up environment variables
    delete process.env.CRUNCHYCONE_API_URL;
    delete process.env.CRUNCHYCONE_PROJECT_ID;

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up test file
    if (testTomlPath) {
      cleanupTestFile(testTomlPath);
    }
  }

  console.log('\n🎉 Test completed!');
}

if (require.main === module) {
  testTomlConfiguration();
}