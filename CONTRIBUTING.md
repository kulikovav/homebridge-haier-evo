# Contributing to Homebridge Haier Evo

Thank you for your interest in contributing to the Homebridge Haier Evo plugin! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with the following information:

1. A clear, descriptive title
2. Steps to reproduce the issue
3. Expected behavior
4. Actual behavior
5. Screenshots or logs (if applicable)
6. Your environment (Homebridge version, Node.js version, plugin version)

### Suggesting Features

Feature suggestions are welcome! Please create an issue with:

1. A clear, descriptive title
2. Detailed description of the feature
3. Why this feature would be useful
4. Any implementation ideas you have

### Pull Requests

1. Fork the repository
2. Create a new branch for your feature or bugfix
3. Make your changes
4. Run tests to ensure they pass
5. Submit a pull request

## Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/haier-evo/homebridge-haier-evo.git
   cd homebridge-haier-evo
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

4. Link for development:

   ```bash
   npm link
   ```

## Testing

We have several types of tests:

### Unit Tests

```bash
npm run test:unit
```

### Standalone Tests

```bash
# Device tests
node test-devices.js

# Rate limiting tests
node test-rate-limiting.js
```

### Comprehensive Test Runner

```bash
# Run all tests
node run-tests.js --all

# Run specific test types
node run-tests.js --devices
node run-tests.js --rate-limiting
```

## Code Style

- Follow the existing code style
- Use TypeScript for all new code
- Add JSDoc comments for public APIs
- Use meaningful variable and function names

## Commit Messages

- Use clear, descriptive commit messages
- Start with a verb in the present tense (e.g., "Add feature" not "Added feature")
- Reference issue numbers when applicable

## Release Process

### Automated Releases

Releases are managed through GitHub Actions:

1. Create a release through the "Create Release" workflow
2. Choose the version bump type (patch, minor, major)
3. The workflow will:
   - Bump the version
   - Update the changelog
   - Create a Git tag
   - Create a GitHub release
   - Publish to npm

### Manual Publishing

For maintainers with npm publishing rights:

1. Make sure you have npm access to the package

   ```bash
   npm owner ls homebridge-haier-evo
   ```

2. Ensure you're logged in to npm

   ```bash
   npm login
   ```

3. Run tests and build

   ```bash
   npm run test:unit
   npm run build
   ```

4. Use the release script

   ```bash
   npm run release
   # Or for specific version bumps:
   npm run release:patch
   npm run release:minor
   npm run release:major
   ```

### npm Package Requirements

The npm package must include:

- Compiled JavaScript files in the `dist/` directory
- `config.schema.json` for Homebridge UI configuration
- Proper metadata in `package.json`
- The package should NOT include source TypeScript files or test files

### GitHub Actions Configuration

For the automated publishing to work correctly:

1. **Required Secrets**:
   - `NPM_TOKEN`: An npm access token with publish permissions

2. **Required Permissions**:
   - The workflow needs `contents: write` permission to push commits and tags
   - The workflow needs `packages: write` permission to publish packages

3. **Troubleshooting**:
   - If you see "Permission denied" errors, check the repository settings:
     - Go to Settings > Actions > General
     - Under "Workflow permissions", ensure "Read and write permissions" is selected

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
