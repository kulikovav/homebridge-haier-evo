#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Haier Evo
 *
 * This script provides a unified way to run all tests without Jest dependencies.
 * It can execute API integration tests, device tests, or both.
 */

const { spawn } = require('child_process');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  devices: {
    script: './test-devices.js',
    name: 'Device Tests',
    description: 'Device functionality and factory testing'
  },
  ratelimiting: {
    script: './test-rate-limiting.js',
    name: 'Rate Limiting Tests',
    description: 'Rate limiting functionality testing'
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper function to colorize text
function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

// Display help information
function showHelp() {
  console.log(colorize('cyan', '\n🚀 Haier Evo Test Runner'));
  console.log(colorize('cyan', '='.repeat(50)));
  console.log('\nUsage:');
  console.log('  node run-tests.js [options]');
  console.log('\nOptions:');
  console.log('  --devices          Run only device tests');
  console.log('  --rate-limiting    Run only rate limiting tests');
  console.log('  --all              Run all tests (default)');
  console.log('  --help             Show this help message');
  console.log('\nExamples:');
  console.log('  node run-tests.js --devices');
  console.log('  node run-tests.js --rate-limiting');
  console.log('  node run-tests.js --all');
  console.log('\nEnvironment Variables:');
  console.log('  DEBUG=1               Enable debug output');
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    devices: false,
    all: false,
    help: false
  };

  for (const arg of args) {
    switch (arg) {
      case '--devices':
        options.devices = true;
        break;
      case '--rate-limiting':
        options.ratelimiting = true;
        break;
      case '--all':
        options.all = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        console.log(colorize('yellow', `⚠️  Unknown option: ${arg}`));
        options.help = true;
        break;
    }
  }

  // Default to all if no specific option is selected
  if (!options.devices && !options.ratelimiting && !options.all) {
    options.all = true;
  }

  return options;
}

// Run a test script and return a promise
function runTestScript(scriptPath, testName) {
  return new Promise((resolve, reject) => {
    console.log(colorize('blue', `\n🧪 Starting ${testName}...`));
    console.log(colorize('blue', `📁 Script: ${scriptPath}`));
    console.log('-'.repeat(60));

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(colorize('green', `\n✅ ${testName} completed successfully`));
        resolve({ success: true, code });
      } else {
        console.log(colorize('red', `\n❌ ${testName} failed with exit code ${code}`));
        resolve({ success: false, code });
      }
    });

    child.on('error', (error) => {
      console.log(colorize('red', `\n💥 ${testName} failed to start: ${error.message}`));
      reject(error);
    });
  });
}

// Main test execution function
async function runTests(options) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    startTime: Date.now()
  };

  console.log(colorize('cyan', '\n🚀 Haier Evo Comprehensive Test Suite'));
  console.log(colorize('cyan', '='.repeat(60)));
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Real API tests are disabled by default
  process.env.RUN_REAL_API_TESTS = '0';
  console.log(colorize('yellow', '\n⚠️  Real API tests are permanently disabled in this environment.'));

  try {
    // Run device tests if requested
    if (options.devices || options.all) {
      results.total++;
      const deviceResult = await runTestScript(TEST_CONFIG.devices.script, TEST_CONFIG.devices.name);
      if (deviceResult.success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }

    // Run rate limiting tests if requested
    if (options.ratelimiting || options.all) {
      results.total++;
      const rateLimitingResult = await runTestScript(TEST_CONFIG.ratelimiting.script, TEST_CONFIG.ratelimiting.name);
      if (rateLimitingResult.success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }

  } catch (error) {
    console.error(colorize('red', '\n💥 Test execution failed:'), error.message);
    results.failed++;
  }

  // Print final summary
  const duration = Date.now() - results.startTime;

  console.log(colorize('cyan', '\n' + '='.repeat(60)));
  console.log(colorize('cyan', '📊 COMPREHENSIVE TEST SUMMARY'));
  console.log(colorize('cyan', '='.repeat(60)));
  console.log(`Total Test Suites: ${results.total}`);
  console.log(`Passed: ${results.passed} ${colorize('green', '✅')}`);
  console.log(`Failed: ${results.failed} ${colorize('red', '❌')}`);
  console.log(`Duration: ${duration}ms`);
  console.log(colorize('cyan', '='.repeat(60)));

  if (results.failed > 0) {
    console.log(colorize('red', '\n❌ Some test suites failed. Check the output above for details.'));
    process.exit(1);
  } else {
    console.log(colorize('green', '\n🎉 All test suites passed successfully!'));
    process.exit(0);
  }
}

// Main execution
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  try {
    await runTests(options);
  } catch (error) {
    console.error(colorize('red', '\n💥 Test runner failed:'), error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the main function
main();
