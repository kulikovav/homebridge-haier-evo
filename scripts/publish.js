#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

class Publisher {
  constructor() {
    this.packagePath = path.join(__dirname, '..');
    this.packageJsonPath = path.join(this.packagePath, 'package.json');
    this.packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    this.currentVersion = this.packageJson.version;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runCommand(command, options = {}) {
    try {
      const result = execSync(command, {
        cwd: this.packagePath,
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options
      });
      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkPrerequisites() {
    this.log('Checking prerequisites...');

    // Check if we're in a git repository
    const gitCheck = await this.runCommand('git status', { silent: true });
    if (!gitCheck.success) {
      this.log('❌ Not in a git repository. Please initialize git first.', 'error');
      return false;
    }

    // Check if there are uncommitted changes
    const gitStatus = await this.runCommand('git status --porcelain', { silent: true });
    if (gitStatus.success && gitStatus.output.trim()) {
      this.log('⚠️  There are uncommitted changes. Please commit or stash them first.', 'warning');
      console.log('Uncommitted changes:');
      console.log(gitStatus.output);
      return false;
    }

    // Check if we're logged into npm
    const npmWhoami = await this.runCommand('npm whoami', { silent: true });
    if (!npmWhoami.success) {
      this.log('❌ Not logged into npm. Please run "npm login" first.', 'error');
      return false;
    }

    this.log(`✅ Logged into npm as: ${npmWhoami.output.trim()}`);
    return true;
  }

  async runTests() {
    this.log('Running tests and quality checks...');

    // Install dependencies if needed
    if (!fs.existsSync(path.join(this.packagePath, 'node_modules'))) {
      this.log('Installing dependencies...');
      const installResult = await this.runCommand('npm ci');
      if (!installResult.success) {
        this.log('❌ Failed to install dependencies', 'error');
        return false;
      }
    }

    // Run linting
    this.log('Running ESLint...');
    const lintResult = await this.runCommand('npm run lint');
    if (!lintResult.success) {
      this.log('❌ ESLint failed. Please fix the issues first.', 'error');
      return false;
    }

    // Run build
    this.log('Building project...');
    const buildResult = await this.runCommand('npm run build');
    if (!buildResult.success) {
      this.log('❌ Build failed. Please fix the issues first.', 'error');
      return false;
    }

    // Check if dist directory exists and has content
    const distPath = path.join(this.packagePath, 'dist');
    if (!fs.existsSync(distPath) || !fs.readdirSync(distPath).length) {
      this.log('❌ Build output directory is empty or missing.', 'error');
      return false;
    }

    this.log('✅ All tests passed!');
    return true;
  }

  async checkPackageContents() {
    this.log('Checking package contents...');

    // Check what will be published
    const packResult = await this.runCommand('npm pack --dry-run', { silent: true });
    if (!packResult.success) {
      this.log('❌ Failed to check package contents', 'error');
      return false;
    }

    // Extract package name from output
          const packageMatch = packResult.output.match(/homebridge-haier-evo-(\d+\.\d+\.\d+)\.tgz/);
    if (!packageMatch) {
      this.log('❌ Could not determine package name from npm pack output', 'error');
      return false;
    }

    const packageName = packageMatch[0];
    this.log(`Package to be published: ${packageName}`);

    // Show package contents
    const contentsResult = await this.runCommand(`tar -tzf ${packageName}`, { silent: true });
    if (contentsResult.success) {
      this.log('Package contents:');
      console.log(contentsResult.output);
    }

    // Clean up the test package
    if (fs.existsSync(packageName)) {
      fs.unlinkSync(packageName);
    }

    return true;
  }

  async updateVersion(versionType) {
    this.log(`Updating version (${versionType})...`);

    const versionResult = await this.runCommand(`npm version ${versionType}`);
    if (!versionResult.success) {
      this.log('❌ Failed to update version', 'error');
      return false;
    }

    // Read updated package.json
    this.packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    const newVersion = this.packageJson.version;

    this.log(`✅ Version updated from ${this.currentVersion} to ${newVersion}`);
    return newVersion;
  }

  async publish() {
    this.log('Publishing to npm...');

    const publishResult = await this.runCommand('npm publish');
    if (!publishResult.success) {
      this.log('❌ Failed to publish to npm', 'error');
      return false;
    }

    this.log('✅ Successfully published to npm!');
    return true;
  }

  async createGitTag(version) {
    this.log('Creating git tag...');

    const tagResult = await this.runCommand(`git tag v${version}`);
    if (!tagResult.success) {
      this.log('❌ Failed to create git tag', 'error');
      return false;
    }

    this.log('✅ Git tag created successfully');
    return true;
  }

  async pushToRemote() {
    this.log('Pushing changes to remote repository...');

    const pushResult = await this.runCommand('git push origin main');
    if (!pushResult.success) {
      this.log('❌ Failed to push to remote repository', 'error');
      return false;
    }

    const pushTagResult = await this.runCommand('git push origin --tags');
    if (!pushTagResult.success) {
      this.log('❌ Failed to push tags to remote repository', 'error');
      return false;
    }

    this.log('✅ Changes pushed to remote repository');
    return true;
  }

  async showPostPublishInfo(version) {
    this.log('🎉 Publication completed successfully!');
    console.log('\nNext steps:');
    console.log(`1. Verify publication at: https://www.npmjs.com/package/homebridge-haier-evo`);
    console.log(`2. Test installation: npm install -g homebridge-haier-evo@${version}`);
    console.log('3. Monitor for any installation issues');
    console.log('4. Respond to user feedback and questions');
    console.log('\nPackage information:');
    console.log(`- Name: homebridge-haier-evo`);
    console.log(`- Version: ${version}`);
    console.log(`- NPM: https://www.npmjs.com/package/homebridge-haier-evo`);
  }

  async run() {
    try {
      this.log('🚀 Starting Homebridge Plugin Publishing Process');
      console.log('');

      // Check prerequisites
      if (!(await this.checkPrerequisites())) {
        process.exit(1);
      }

      // Run tests
      if (!(await this.runTests())) {
        process.exit(1);
      }

      // Check package contents
      if (!(await this.checkPackageContents())) {
        process.exit(1);
      }

      // Ask for version type
      console.log('\nVersion types:');
      console.log('1. patch - Bug fixes (1.0.0 → 1.0.1)');
      console.log('2. minor - New features (1.0.0 → 1.1.0)');
      console.log('3. major - Breaking changes (1.0.0 → 2.0.0)');

      const versionType = await question('\nSelect version type (1/2/3): ');
      let npmVersionType;

      switch (versionType.trim()) {
        case '1': npmVersionType = 'patch'; break;
        case '2': npmVersionType = 'minor'; break;
        case '3': npmVersionType = 'major'; break;
        default:
          this.log('❌ Invalid version type selected', 'error');
          process.exit(1);
      }

      // Confirm before proceeding
      const confirm = await question(`\nReady to publish version ${npmVersionType}? (y/N): `);
      if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
        this.log('Publication cancelled by user');
        process.exit(0);
      }

      // Update version
      const newVersion = await this.updateVersion(npmVersionType);
      if (!newVersion) {
        process.exit(1);
      }

      // Publish to npm
      if (!(await this.publish())) {
        process.exit(1);
      }

      // Create git tag
      if (!(await this.createGitTag(newVersion))) {
        process.exit(1);
      }

      // Push to remote
      if (!(await this.pushToRemote())) {
        process.exit(1);
      }

      // Show completion info
      await this.showPostPublishInfo(newVersion);

    } catch (error) {
      this.log(`❌ Unexpected error: ${error.message}`, 'error');
      process.exit(1);
    } finally {
      rl.close();
    }
  }
}

// Run the publisher
if (require.main === module) {
  const publisher = new Publisher();
  publisher.run();
}

module.exports = Publisher;
