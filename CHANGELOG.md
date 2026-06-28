# Changelog

All notable changes to the homebridge-haier-evo plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2023-06-01

### Added

- Initial release
- Support for air conditioners and refrigerators
- WebSocket connection for real-time updates
- HomeKit integration for all device features

## [1.1.0] - 2023-07-15

### Added

- Device filtering options to control which devices are discovered
- Improved logging for device status updates
- Fixed temperature validation issues

## [1.1.8] - 2025-08-16

### Added

- Device list caching to reduce API calls
- Request randomization to avoid rate limiting
- Configurable API optimization options

### Changed

- Improved error handling for WebSocket updates
- Enhanced logging with timestamps and emojis
- Better handling of device status updates

### Fixed

- Initial device status update during plugin startup
- Trailing spaces in received data

## [1.1.9] - 2025-08-16

- Update CHANGELOG and README for versioning and repository ownership changes

## [1.2.0] - 2025-08-20
- Update CHANGELOG, README, and configuration files to include new token refresh and command batching options; add legal documentation.

## [1.2.1] - 2025-09-01
- Refactor BaseDevice to improve API client handling; add guards for event subscription and initial status fetch to prevent errors when API client is unavailable.
- Enhance refrigerator features with door status tracking and temperature event management;  fix commands proccessing after restart

## [1.2.2] - 2025-09-07
- Update configuration schema; enhance accessory management by adding service removal logic and updating platform accessories for better state handling.
- Refactor token refresh mechanism in HaierAPI to enable non-blocking background refresh; log errors during refresh process for better error handling.

## [1.3.0] - 2025-09-10
- Enhance configuration schema with increased request delay limits and improve model-based device handling in HaierAPI for better command processing.

## [1.3.1] - 2025-11-02
- Update HaierAPI to conditionally manage authentication headers based on request type.

## [1.3.2] - 2025-11-02
- Remove RATE_LIMITING.md documentation file, consolidating rate limiting and retry logic details into the main codebase for improved clarity and accessibility.

## [2.0.0] - 2026-06-28

### BREAKING CHANGES

- **ESM-only**: The plugin is now an ES Module (`"type": "module"`). Cannot be loaded via `require()`.
- **Node.js >=22.12.0 required**: Dropped support for Node.js 14-20. Homebridge 2.x requires Node.js 22 or 24.
- **Homebridge >=2.0.0 required**: Moved Homebridge to `peerDependencies: ^2.0.0`. Homebridge 1.x users must upgrade Homebridge first.
- **Import paths changed**: All relative imports now use `.js` extensions per ESM spec.

### Changed

- **Dependency updates**: axios 1.18, ws 8.21, dotenv 17.4, TypeScript 5.5, Jest 30, uuid 13, @typescript-eslint 8.62
- **Logging modernized**: Replaced all `console.log` calls with Homebridge Logger (`this.log.info`/`this.log.debug`)
- **Stability hardened**: Added WebSocket state machine, connection race condition fixes, timer cleanup
- **Status request debouncing**: Multiple rapid commands no longer fire redundant all-device status requests

### Fixed

- Resource leaks: All timers now properly cleaned up on disconnect/destroy
- Event listener accumulation on platform restart
- WebSocket disconnect race condition preventing clean shutdown

## [Unreleased]
