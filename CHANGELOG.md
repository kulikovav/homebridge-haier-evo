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

## [2.1.0] - 2026-06-30
- fix: allow platform field in config schema
- docs: remove testing documentation files
- fix(ci): add null guard for API log property in BaseDevice constructor
- fix(review): apply findings #2, #3, #5 - async promise rejection, apiClient shim, DeviceStatus guard
- fix(review): invert excludeNamePattern regex logic (P0 bug)
- chore(deps): update dependencies (jiti, @types/node, uuid, globals)
- chore(lint): strengthen ESLint rules and fix all violations
- feat(validation): add Zod validation for API responses and improve error handling
- refactor(types): tighten TypeScript types and remove AI slop across codebase
- feat(config): add Zod validation for plugin configuration
- fix: align CI workflows with Node.js 24 engine requirement
- fix: resolve CI build failures from ESM migration
- fix: apply review fixes - CI indentation, CHANGELOG, performance, dead code
- refactor: ESM migration, dependency updates, stability hardening, AI slop removal
- fix: restore debug log guards and add WebSocket status request debounce
- refactor: bump version to 2.0.0 for ESM migration

## [2.1.1] - 2026-06-30
- chore: remove GitHub Actions release workflow

## [2.3.1] - 2026-08-08
- fix(ci): update npm publish workflow to include beta commits in changelog
- Fix changelog update in npm publish workflow
- Fix device config validation for extra API fields
- fix(ci): drop always-auth and bump gh-release to v3
- fix(ci): use .cjs standalone tests in beta publish workflow
- test: combine validation unit tests for auth and device parsers
- ci: use Node.js 24 for beta npm publish workflow
- ci: add workflow to publish npm packages with beta tag
- fix: batch power and setpoint with mode when AC is off
- fix(review): reuse HVAC/FAN constants and harden mapping tests
- fix: resolve HVAC mode changes failing with Error -1 for AS50HQJ1HRA-B and other unmapped AC models
- Redact sensitive fields in debug logs
- fix: Nullify ws in disconnect()
- refactor: remove unused removeDevice method from HaierAPI
- Refactor: Remove unused `getAccessory` method in `src/platform.ts`
- test: Add unit tests for `validateConfig` in `src/settings.ts`

## [Unreleased]
