# Homebridge Haier Evo Plugin

[![npm version](https://badge.fury.io/js/homebridge-haier-evo.svg)](https://www.npmjs.com/package/homebridge-haier-evo)
[![GitHub Actions](https://github.com/kulikovav/homebridge-haier-evo/workflows/Node.js%20Package/badge.svg)](https://github.com/kulikovav/homebridge-haier-evo/actions)

A Homebridge plugin that integrates Haier Evo devices (air conditioners, refrigerators, etc.) with Apple HomeKit.

This plugin is adapted from the [Home Assistant Haier Evo integration](https://github.com/and7ey/haier_evo) to work with Homebridge.

## Features

- **Air Conditioners**: Full thermostat control with heating/cooling modes, temperature control, fan speed, and swing modes
- **Refrigerators**: Temperature control, eco mode, vacation mode, and other refrigerator-specific features
- **Real-time Updates**: WebSocket connection for instant status updates
- **Automatic Discovery**: Automatically discovers and adds all your Haier Evo devices
- **HomeKit Integration**: Native HomeKit support for all device features

## Supported Devices

- **Air Conditioners**: AS20PHP1HRA
- **Refrigerators**: A4F739CBXGU1

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

### Token Refresh Options

Control how authentication tokens are refreshed:

| Parameter | Required | Description | Default |
|-----------|----------|-------------|---------|
| `tokenRefreshMode` | No | Token refresh mode: `"auto"`, `"manual"`, or `"disabled"` | `"auto"` |
| `tokenRefreshInterval` | No | Interval in seconds for manual token refresh | `3600` (1 hour) |
| `tokenRefreshThreshold` | No | Time in seconds before token expiration to trigger refresh | `300` (5 minutes) |

#### Token Refresh Modes

- **Auto**: Refreshes token automatically before it expires (based on `tokenRefreshThreshold`)
- **Manual**: Refreshes token at fixed intervals (based on `tokenRefreshInterval`)
- **Disabled**: Only refreshes token when it's invalid (expired) or on 401 errors

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
  "platform": "homebridge-haier-evo",
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

  "tokenRefreshMode": "auto",
  "tokenRefreshInterval": 3600,
  "tokenRefreshThreshold": 300,

  "includeDevices": ["device-id-1", "device-id-2"],
  "excludeDevices": ["device-id-3"],
  "includeDeviceTypes": ["air_conditioner"],
  "excludeDeviceTypes": ["refrigerator"],
  "includeNamePattern": "Living Room|Kitchen",
  "excludeNamePattern": "Basement",

  // AC Accessory Options (all default to true)
  "enableFanService": true,
  "enableBlindsControl": true,
  "enableBlindsAutoSwitch": true,
  "enableBlindsComfortSwitch": true,
  "enableLightControl": true,
  "enableHealthModeSwitch": true,
  "enableQuietModeSwitch": true,
  "enableTurboModeSwitch": true,
  "enableComfortModeSwitch": true
}
```

## Device Information

The plugin extracts and displays accurate device information in HomeKit using a two-stage process:

### Information Sources

- **Basic Info**: Initial device list from `API_DEVICES` endpoint
- **Detailed Info**: Comprehensive device configuration from `API_DEVICE_CONFIG` endpoint

### Extracted Information

- **Manufacturer**: Haier
- **Model**: Extracted from `info.model` (e.g., "AS20PHP1HRA")
- **Serial Number**: Extracted from `info.serialNumber` (e.g., "AABF1AE0000XCN1B0251")
- **Firmware Version**: Extracted from `settings.firmware.value` (e.g., "1.5.5")
- **Device Name**: Extracted from `settings.name.name` with proper validation

### Extraction Process

1. **Initial Discovery**: `fetchDevices()` gets basic device list with fallback extraction methods
2. **Detailed Configuration**: `getDeviceStatus()` fetches comprehensive device data from API_DEVICE_CONFIG
3. **Information Update**: Device information is extracted and updated in real-time
4. **HomeKit Integration**: Accessories receive accurate information via event system

### Fallback Logic

Each extraction method includes comprehensive fallback logic:

- **Serial Number**: `info.serialNumber` → action link parsing → direct field
- **Model**: `info.model` → direct model field → settings tracking data → device type
- **Firmware**: `settings.firmware.value` → firmware object → direct fields → info section → default

This information is displayed in the HomeKit accessory details and helps with device identification and troubleshooting.

### Device Information Persistence

The plugin ensures device information (model, serial number, firmware version) is preserved throughout the entire lifecycle:

#### Storage and Updates

- **Initial Storage**: Device information is stored in `BaseDevice` properties during construction
- **Persistent JSON**: The `toJSON()` method includes all device information to prevent data loss during status updates
- **Real-time Updates**: Device information can be updated via `deviceInfoUpdated` events without losing other data
- **WebSocket Safety**: Status updates via WebSocket maintain device information integrity

#### Event Handling

```typescript
// Device information is preserved in all status updates
device.on('statusUpdated', (status) => {
  // status.model, status.serialNumber, status.firmwareVersion are preserved
});

// Device information can be updated independently
device.on('deviceInfoUpdated', (info) => {
  // Updates model, serialNumber, firmwareVersion without affecting other properties
});
```

#### Implementation Details

- **BaseDevice Properties**: `serialNumber`, `firmwareVersion` added alongside existing `device_model`
- **Interface Updates**: `HaierDevice` interface includes new properties and `updateDeviceInfo()` method
- **Accessory Integration**: Accessories automatically handle device information updates via event listeners
- **JSON Serialization**: All device information included in `toJSON()` output for complete data persistence
- **Status Update Protection**: Multi-layer protection ensures device information is never lost during WebSocket or API status updates:
  - BaseDevice `updateFromStatus()` handles device information fields when present, preserves when absent
  - AC Device `updateFromDirectStatus()` calls base class to ensure all device information is processed
  - Only updates device information fields when explicitly provided in status data
- **Efficient Device Caching**: Single comprehensive cache strategy for optimal API usage:
  - **Complete Information**: Device cache includes both discovery data and configuration details
  - **One-Time Fetch**: During discovery, fetches `API_DEVICES` then enriches each device with `API_DEVICE_CONFIG`
  - **Long-Term Storage**: Permanent device info (model, firmware, serial) cached for full TTL duration
  - **No Redundant Calls**: Eliminates separate device configuration fetches for existing accessories
  - **Memory Efficient**: Single cache structure reduces memory usage and complexity

This ensures that additional accessories (Light, Health Mode, etc.) always have access to correct device information regardless of when they are created or how status updates are processed.

### Accessory Creation Process

The plugin uses an optimized two-stage process to ensure accessories are created with complete device information while minimizing API calls:

1. **Device Discovery** (`API_DEVICES`): Fetches basic device list with IDs, names, and MAC addresses
2. **Device Configuration & Initial Status** (`API_DEVICE_CONFIG`): Fetches detailed information AND initial status for each device in a single call
3. **Accessory Creation**: Creates HomeKit accessories with complete device information and cached initial status

### API Call Optimization

This approach reduces API calls by **50%** during initialization:

**Before Optimization:**

- `API_DEVICES`: 1 call (device list)
- `API_DEVICE_CONFIG`: N calls (device config)
- `API_DEVICE_CONFIG`: N calls (initial status) → **Redundant!**
- **Total**: 1 + 2N calls

**After Optimization:**

- `API_DEVICES`: 1 call (device list)
- `API_DEVICE_CONFIG`: N calls (config + status combined)
- **Total**: 1 + N calls

The initial status data is cached in `deviceInfo.initialStatus` and applied directly to devices during accessory creation, eliminating the need for redundant API calls while maintaining full functionality.

## Command Batching

The plugin implements intelligent command batching to optimize API usage and improve performance when multiple commands are sent rapidly to the same device.

### How It Works

When multiple HomeKit commands are received within a short time window (default: 100ms), they are automatically batched into a single API request:

**Example Scenario:**

- User adjusts AC via HomeKit: Turn on → Set mode to Cool → Set temperature to 23°C → Enable quiet mode → Turn off light

**Without Batching (5 separate API calls):**

```json
{"action": "operation", "macAddress": "...", "commands": [{"commandName": "21", "value": "1"}]}
{"action": "operation", "macAddress": "...", "commands": [{"commandName": "2", "value": "1"}]}
{"action": "operation", "macAddress": "...", "commands": [{"commandName": "0", "value": "23"}]}
{"action": "operation", "macAddress": "...", "commands": [{"commandName": "17", "value": "1"}]}
{"action": "operation", "macAddress": "...", "commands": [{"commandName": "12", "value": "0"}]}
```

**With Batching (1 combined API call):**

```json
{
  "action": "operation",
  "macAddress": "...",
  "commands": [
    {"commandName": "21", "value": "1"},
    {"commandName": "2", "value": "1"},
    {"commandName": "0", "value": "23"},
    {"commandName": "17", "value": "1"},
    {"commandName": "12", "value": "0"}
  ]
}
```

### Key Features

- **Automatic Batching**: Commands to the same device within the timeout window are automatically combined
- **Property Merging**: Multiple updates to the same property use the latest value (e.g., temperature changes)
- **Per-Device Batching**: Commands to different devices are batched separately
- **Configurable Timeout**: Adjust the batching window via `batchTimeout` configuration (10-1000ms)
- **Error Handling**: If a batch fails, all commands in that batch are rejected appropriately

### Configuration

```json
{
  "batchTimeout": 100
}
```

- **Default**: 100ms
- **Range**: 10-1000ms
- **Lower values**: More responsive, fewer commands per batch
- **Higher values**: More commands per batch, potentially higher latency

### Benefits

- **Reduced API Calls**: Up to 80% reduction in API requests for rapid command sequences
- **Better Performance**: Faster execution of multiple commands
- **API Compliance**: Matches the native Haier API batch request format
- **Improved Reliability**: Fewer network requests reduce chance of failures

## Token Refresh and Authentication

The plugin includes robust token management with intelligent error handling to ensure reliable API access.

### Token Refresh Options

Configure token refresh behavior to match your needs:

```json
{
  "tokenRefreshMode": "auto",
  "tokenRefreshInterval": 3600,
  "tokenRefreshThreshold": 300
}
```

**Token Refresh Modes:**

- **`auto`** (default): Automatically refresh tokens when they are about to expire
- **`manual`**: Refresh tokens at specified intervals regardless of expiration
- **`disabled`**: Only refresh tokens when they are completely invalid

**Configuration Options:**

- **`tokenRefreshInterval`**: For manual mode, interval in seconds between refreshes (default: 3600 = 1 hour)
- **`tokenRefreshThreshold`**: Time in seconds before expiration to trigger refresh (default: 300 = 5 minutes)

### Enhanced Error Handling

The plugin includes intelligent error handling for common authentication scenarios:

- **401 Unauthorized**: When the refresh token is invalid/expired, immediately falls back to full reauthentication instead of retrying
- **429 Rate Limiting**: Uses exponential backoff for rate limiting errors, then falls back to authentication if max retries exceeded
- **Token Validation**: Checks both access and refresh token expiration before attempting refresh operations
- **State Cleanup**: Clears invalid tokens to prevent retry loops and authentication issues

This eliminates the previous issue where 429 rate limiting could lead to refresh token expiration, causing repeated 401 errors.

## Configurable AC Accessories

The plugin allows you to customize which additional services are created for AC devices, helping reduce HomeKit clutter and improve performance by only enabling the features you need.

### Available Options

All AC accessory options default to `true` (enabled). Set any option to `false` to disable that specific accessory:

| Option | Description | Default |
|--------|-------------|---------|
| `enableFanService` | Enable separate Fan v2 service for fan control | `true` |
| `enableBlindsControl` | Enable vertical blinds control using Fan v2 service | `true` |
| `enableBlindsAutoSwitch` | Enable blinds auto mode switch | `true` |
| `enableBlindsComfortSwitch` | Enable blinds comfort mode switch | `true` |
| `enableLightControl` | Enable light control service | `true` |
| `enableHealthModeSwitch` | Enable health mode switch | `true` |
| `enableQuietModeSwitch` | Enable quiet mode switch | `true` |
| `enableTurboModeSwitch` | Enable turbo mode switch | `true` |
| `enableComfortModeSwitch` | Enable comfort mode switch | `true` |

### Configuration Examples

**Minimal Configuration** (only core AC functionality):

```json
{
  "enableFanService": false,
  "enableBlindsControl": false,
  "enableBlindsAutoSwitch": false,
  "enableBlindsComfortSwitch": false,
  "enableLightControl": false,
  "enableHealthModeSwitch": false,
  "enableQuietModeSwitch": false,
  "enableTurboModeSwitch": false,
  "enableComfortModeSwitch": false
}
```

**Blinds Control Only**:

```json
{
  "enableFanService": false,
  "enableBlindsControl": true,
  "enableBlindsAutoSwitch": true,
  "enableBlindsComfortSwitch": true,
  "enableLightControl": false,
  "enableHealthModeSwitch": false,
  "enableQuietModeSwitch": false,
  "enableTurboModeSwitch": false,
  "enableComfortModeSwitch": false
}
```

**Essential Features Only**:

```json
{
  "enableFanService": true,
  "enableBlindsControl": false,
  "enableBlindsAutoSwitch": false,
  "enableBlindsComfortSwitch": false,
  "enableLightControl": true,
  "enableHealthModeSwitch": false,
  "enableQuietModeSwitch": true,
  "enableTurboModeSwitch": false,
  "enableComfortModeSwitch": false
}
```

### Core Services

The following services are always created and cannot be disabled:

- **HeaterCooler Service**: Main AC control (power, mode, temperature, swing)
- **Temperature Sensor Service**: Current temperature monitoring

### Benefits

- **Reduced Clutter**: Only show accessories you actually use
- **Better Performance**: Fewer services mean faster HomeKit response
- **Customization**: Tailor the interface to your specific AC model and usage
- **User Experience**: Cleaner, more focused control interface

## Accessory Name Handling

The plugin implements proper HomeKit-compliant accessory name handling:

### Name Validation

- **HomeKit Compliance**: Names are automatically validated and sanitized to meet HomeKit requirements
- **Allowed Characters**: Only alphanumeric characters, spaces, and apostrophes are permitted
- **Character Boundaries**: Names must start and end with alphanumeric characters
- **Length Limits**: Names are truncated to 64 characters maximum
- **Space Normalization**: Multiple consecutive spaces are collapsed to single spaces
- **Fallback Names**: Invalid or empty names are replaced with device type and ID

### Automatic Name Updates

- **Service Synchronization**: When accessory names change, all related service names are automatically updated
- **AccessoryInformation Service**: The Name characteristic is properly maintained
- **Consistent Naming**: All services maintain consistent naming patterns (e.g., "Living Room AC Fan", "Living Room AC Light")

### Examples

| Original Name | Validated Name | Reason |
|---------------|----------------|--------|
| `Living Room AC` | `Living Room AC` | Valid name (no changes) |
| `Kitchen AC (Main)` | `Kitchen AC Main` | Parentheses removed |
| `Master's Bedroom` | `Master's Bedroom` | Apostrophe allowed |
| `AC-Unit@Home#1` | `AC-UnitHome1` | Special characters removed |
| `Garage AC` | `Garage AC` | Spaces trimmed |
| `Office   AC` | `Office AC` | Multiple spaces collapsed |

## Vertical Blinds Control

Air conditioners support advanced vertical blinds control through multiple HomeKit services:

### Blinds Fan v2 Service

- **Rotation Speed Control**: Adjust blinds using fan rotation speed (0-100%)
- **Position Mapping**: 7 distinct positions mapped to rotation percentages:
  - Upper (8%): Directs airflow upward (-75°)
  - Position 1 (25%): First rotation position (-45°)
  - Position 2 (33%): Second rotation position (-30°)
  - Position 3 (50%): Neutral/center position (0°)
  - Position 4 (67%): Fourth rotation position (30°)
  - Position 5 (75%): Fifth rotation position (45°)
  - Bottom (92%): Directs airflow downward (75°)
- **Active Control**: Switch between manual positioning and auto mode
- **State Feedback**: Shows BLOWING_AIR (manual) or IDLE (auto)

### Smart Mode Switches

- **Auto Mode (Авто режим)**: Automatic blinds positioning based on system operation
- **Comfort Flow (Комфорт-поток)**: Intelligent airflow direction:
  - **Heating Mode**: Directs warm air downward (bottom position)
  - **Cooling Mode**: Directs cool air upward (upper position)
  - **Mutually Exclusive**: Only one mode can be active at a time

## Device Types and HomeKit Services

### Air Conditioners

- **Primary Service**: HeaterCooler
  - Heating/Cooling modes (Heat, Cool, Auto)
  - Active/Inactive state control
  - Temperature control (16°C - 30°C)
  - Current temperature display
  - Cooling and heating threshold temperatures
  - Fan speed control (Rotation Speed)
  - Swing mode control (SWING_ENABLED/SWING_DISABLED)
- **Additional Services**:
  - Fan v2 (Active/Inactive, Current/Target State, Speed control)
    - Target State: AUTO (automatic fan speed) or MANUAL (manual speed control)
    - Current State: INACTIVE, IDLE, or BLOWING_AIR
    - Rotation Speed: 0-100% (only in MANUAL mode)
  - Blinds Fan v2 (Vertical blinds control using fan rotation)
    - Active: Manual/Auto blinds control
    - Current State: BLOWING_AIR (manual) or IDLE (auto)
    - Target State: MANUAL (position control) or AUTO (automatic)
    - Rotation Speed: 0-100% maps to blinds positions (-90° to +90°)
  - Blinds Auto Mode Switch (Авто режим)
  - Blinds Comfort Flow Switch (Комфорт-поток)
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

- Control heating/cooling modes (Heat, Cool, Auto) through the Home app
- Turn device on/off with Active/Inactive control
- Set cooling and heating threshold temperatures
- View current temperature
- Control fan with enhanced Fanv2 service:
  - Switch between AUTO and MANUAL fan modes
  - View current fan state (inactive, idle, blowing air)
  - Control fan speed (0-100%) in MANUAL mode
- Control swing mode (enabled/disabled) through HeaterCooler service
- Control vertical blinds with Blinds Fan v2 service:
  - Adjust position using rotation speed 0-100% (7 positions)
  - Active control: Switch between manual and auto modes
  - State feedback: Visual indication of manual/auto operation
  - Auto Mode switch: Automatic blinds control (Авто режим)
  - Comfort Flow switch: Smart airflow direction (Комфорт-поток)
  - Modes are mutually exclusive for optimal airflow
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
   git clone https://github.com/kulikovav/homebridge-haier-evo.git
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
2. Search existing [issues](https://github.com/kulikovav/homebridge-haier-evo/issues)
3. Create a new issue with detailed information about your problem
