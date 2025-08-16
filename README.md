# Homebridge Haier Evo Plugin

[![npm version](https://badge.fury.io/js/homebridge-haier-evo.svg)](https://www.npmjs.com/package/homebridge-haier-evo)
[![GitHub Actions](https://github.com/haier-evo/homebridge-haier-evo/workflows/Node.js%20Package/badge.svg)](https://github.com/haier-evo/homebridge-haier-evo/actions)

A Homebridge plugin that integrates Haier Evo devices (air conditioners, refrigerators, etc.) with Apple HomeKit.

This plugin is adapted from the [Home Assistant Haier Evo integration](https://github.com/and7ey/haier_evo) to work with Homebridge.

## Features

- **Air Conditioners**: Full thermostat control with heating/cooling modes, temperature control, fan speed, and swing modes
- **Refrigerators**: Temperature control, eco mode, vacation mode, and other refrigerator-specific features
- **Real-time Updates**: WebSocket connection for instant status updates
- **Automatic Discovery**: Automatically discovers and adds all your Haier Evo devices
- **HomeKit Integration**: Native HomeKit support for all device features

## Supported Devices

- **Air Conditioners**: All Haier Evo compatible air conditioners
- **Refrigerators**: All Haier Evo compatible refrigerators
- **Other Devices**: Any device compatible with the Haier Evo app

## Compatibility

This plugin supports devices that work with the Haier Evo app in the following regions:

- 🇷🇺 Russia (RU)
- 🇰🇿 Kazakhstan (KZ)
- 🇧🇾 Belarus (BY)

## Installation

1. Install Homebridge if you haven't already.

2. Install this plugin using one of these methods:

   ```bash
   # Using Homebridge UI
   # Search for "homebridge-haier-evo" in the plugins tab

   # Using hb-service
   hb-service add homebridge-haier-evo

   # Using npm
   npm install -g homebridge-haier-evo
   ```

3. Add the platform to your Homebridge configuration file (`config.json`) or use the Homebridge UI to configure it:

   ```json
   {
     "platforms": [
       {
         "platform": "homebridge-haier-evo",
         "name": "Haier Evo",
         "email": "your-email@example.com",
         "password": "your-password",
         "region": "ru",
         "refreshInterval": 300,
         "debug": false
       }
     ]
   }
   ```

4. Restart Homebridge

## Configuration

### Basic Configuration

| Parameter | Required | Description | Default |
|-----------|----------|-------------|---------|
| `platform` | Yes | Must be `"HaierEvo"` | - |
| `name` | Yes | Platform name for Homebridge | - |
| `email` | Yes | Your Haier Evo account email | - |
| `password` | Yes | Your Haier Evo account password | - |
| `region` | Yes | Your region: `"ru"`, `"kz"`, or `"by"` | - |
| `refreshInterval` | No | Device refresh interval in seconds | `300` (5 minutes) |
| `debug` | No | Enable debug logging | `false` |

### API Optimization Options

You can optimize API requests to reduce server load and avoid rate limiting:

| Parameter | Required | Description | Default |
|-----------|----------|-------------|---------|
| `deviceCacheTTL` | No | Time in seconds to cache device list | `300` (5 minutes) |
| `requestRandomization` | No | Add randomization to requests to appear more natural | `true` |
| `minRequestDelay` | No | Minimum delay between requests in milliseconds | `100` |
| `maxRequestDelay` | No | Maximum delay between requests in milliseconds | `1000` |

### Device Filtering Options

You can control which devices are discovered and added to HomeKit using the following filtering options:

| Parameter | Required | Description | Default |
|-----------|----------|-------------|---------|
| `includeDevices` | No | Array of device IDs to include. If specified, only these devices will be added | All devices |
| `excludeDevices` | No | Array of device IDs to exclude | None |
| `includeDeviceTypes` | No | Array of device types to include (e.g., "AC", "REFRIGERATOR") | All types |
| `excludeDeviceTypes` | No | Array of device types to exclude | None |
| `includeNamePattern` | No | Regex pattern for device names to include | All names |
| `excludeNamePattern` | No | Regex pattern for device names to exclude | None |

#### Example Configuration with Filtering

```json
{
  "platform": "HaierEvo",
  "name": "Haier Evo",
  "email": "your-email@example.com",
  "password": "your-password",
  "region": "ru",
  "refreshInterval": 300,
  "debug": false,

  "deviceCacheTTL": 300,
  "requestRandomization": true,
  "minRequestDelay": 100,
  "maxRequestDelay": 1000,

  "includeDevices": ["device-id-1", "device-id-2"],
  "excludeDevices": ["device-id-3"],
  "includeDeviceTypes": ["air_conditioner"],
  "excludeDeviceTypes": ["refrigerator"],
  "includeNamePattern": "Living Room|Kitchen",
  "excludeNamePattern": "Basement"
}
```

## Device Types and HomeKit Services

### Air Conditioners

- **Primary Service**: Thermostat
  - Heating/Cooling modes (Heat, Cool, Auto, Off)
  - Temperature control (16°C - 30°C)
  - Current and target temperature
- **Additional Services**:
  - Fan (On/Off, Speed control)
  - Temperature Sensor
  - Light (if supported)

### Refrigerators

- **Primary Service**: Switch
  - Power On/Off
- **Additional Services**:
  - Temperature Sensor
  - Light (if supported)

## HomeKit Features

### Air Conditioners

- Control heating/cooling modes through the Home app
- Set target temperature with slider control
- View current temperature
- Control fan speed
- Turn device on/off
- Control built-in light (if supported)

### Refrigerators

- Turn device on/off
- View current temperature
- Control built-in light (if supported)

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify your email and password are correct
   - Ensure your account is active and not locked
   - Check if your region is supported

2. **Devices Not Appearing**
   - Check your internet connection
   - Verify the Haier Evo app can see your devices
   - Check if you've configured device filtering options that might be excluding your devices
   - Use `"debug": true` to see detailed logs about which devices are being filtered
   - Check Homebridge logs for error messages

3. **Commands Not Working**
   - Ensure the device is online in the Haier Evo app
   - Check if the device supports the specific feature
   - Restart Homebridge

### Debug Mode

Enable debug logging by setting `"debug": true` in your configuration:

```json
{
  "platform": "homebridge-haier-evo",
  "name": "Haier Evo",
  "email": "your-email@example.com",
  "password": "your-password",
  "region": "ru",
  "debug": true
}
```

### Logs

Check Homebridge logs for detailed information:

```bash
homebridge -D
```

## Development

### Building from Source

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

### Testing

This project includes several testing approaches:

#### Unit Tests

```bash
# Run unit tests
npm run test:unit
```

#### Standalone Tests

```bash
# Run device tests
node test-devices.js

# Run rate limiting tests
node test-rate-limiting.js
```

#### Comprehensive Test Runner

```bash
# Run all tests
node run-tests.js --all

# Run specific test types
node run-tests.js --devices
node run-tests.js --rate-limiting
```

> Note: Tests that require real API access have been disabled in this environment.

### GitHub Actions Workflows

This project uses GitHub Actions for automated testing, version management, and publishing to npm.

#### Test Workflows

1. **Standard Tests**: Runs on every push and pull request
   - Unit tests, device tests, and rate limiting tests
   - No real API access required

2. **Comprehensive Tests**: Manually triggered workflow
   - Can run device tests or rate limiting tests
   - No real API access required

#### Release Process

1. **Create a Release**:
   - Go to the Actions tab in the GitHub repository
   - Select the "Create Release" workflow
   - Click "Run workflow"
   - Choose the version bump type (patch, minor, major)
   - Click "Run workflow"

2. **Publishing to npm**:
   - After a release is created, the "Node.js Package" workflow automatically runs
   - It builds, tests, and publishes the package to npm
   - It also updates the CHANGELOG.md file

#### Manual Release Process

You can also use the included script for manual releases:

```bash
# Interactive release process
npm run release

# Quick release with specific version bump
npm run release:patch
npm run release:minor
npm run release:major
```

### Publishing to npm

This project is set up for automatic npm publishing through GitHub Actions:

1. When a GitHub Release is created, the package is automatically published to npm
2. When the "Node.js Package" workflow is manually triggered, the package is published to npm

#### Required GitHub Secrets

For the automated publishing to work, you need to set up the following GitHub secrets:

1. `NPM_TOKEN` - An npm access token with publish permissions
   - Go to your npm account settings
   - Create a new access token with "Automation" type
   - Add it as a repository secret in GitHub

#### Setting up GitHub Secrets

1. Go to your GitHub repository
2. Click on "Settings" > "Secrets and variables" > "Actions"
3. Click "New repository secret"
4. Add the NPM_TOKEN with your npm access token value

#### Manual Publishing

To publish manually:

1. Make sure you have an npm account and are logged in:
   ```bash
   npm login
   ```

2. Run the release script:
   ```bash
   npm run release
   ```

3. The script will:
   - Run tests
   - Bump the version
   - Update the changelog
   - Publish to npm
   - Create a git tag
   - Push changes to GitHub

### Project Structure

```
src/
├── accessories/          # HomeKit accessory implementations
│   └── haier-evo-accessory.ts
├── devices/             # Device-specific implementations
│   ├── base-device.ts
│   ├── haier-ac-device.ts
│   └── haier-refrigerator-device.ts
├── constants.ts         # API constants and mappings
├── device-factory.ts    # Device creation factory
├── haier-api.ts        # Haier API client
├── index.ts            # Plugin entry point
├── platform.ts         # Main platform class
├── settings.ts         # Plugin settings
└── types.ts            # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Original Home Assistant integration by [@and7ey](https://github.com/and7ey/haier_evo)
- Homebridge community for the excellent platform
- Haier for providing the Evo IoT platform

## Support

If you need help or have questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Search existing [issues](https://github.com/your-username/homebridge-haier-evo/issues)
3. Create a new issue with detailed information about your problem

## Changelog

### 1.1.0

- Added device filtering options to control which devices are discovered
- Improved logging for device status updates
- Fixed temperature validation issues

### 1.0.0

- Initial release
- Support for air conditioners and refrigerators
- Full HomeKit integration
- Real-time device updates
- Automatic device discovery
