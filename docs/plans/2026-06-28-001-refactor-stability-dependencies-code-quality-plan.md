---
title: Refactor for stability, dependency updates, and code quality
type: refactor
date: 2026-06-28
depth: deep
---

# Refactor for Stability, Dependency Updates, and Code Quality

## Summary

Refactor the homebridge-haier-evo plugin across three dimensions: (1) harden runtime stability by fixing resource leaks, unhandled rejections, and race conditions; (2) update all dependencies to current versions while maintaining Homebridge plugin compatibility; (3) remove AI-generated code patterns (excessive console.log, verbose logging prefixes, redundant comments, `any` overuse) while preserving all existing functionality and Homebridge API compatibility.

The Homebridge 2.x ESM-only requirement is the dominant forcing function — it drives the module format migration, which in turn unlocks uuid v12+ and aligns with the TypeScript 6.x ecosystem direction.

## Problem Frame

The codebase has accumulated:
- **Stability debt**: WebSocket connection management has race conditions, timer cleanup is inconsistent, and async error handling is incomplete in several paths
- **Dependency staleness**: TypeScript 4.9, axios 1.6, ws 8.14, uuid 11, jest 29 — several versions behind with security and compatibility implications
- **Code quality issues**: ~50+ console.log callsites bypassing the Logger, verbose `[timestamp] [Haier Evo]` prefixes on every log line, excessive `any` types, redundant fallback logic, and AI-generated boilerplate comments

These issues compound: stale dependencies make the codebase harder to maintain, AI slop obscures real issues, and stability problems surface under production load.

## Requirements

- All existing Homebridge functionality must continue working (AC control, refrigerator monitoring, WebSocket updates, device discovery, filtering, batching)
- The plugin must be compatible with Homebridge 2.x (ESM-only, updated HAP types)
- No breaking changes to the user-facing configuration schema
- All existing tests must pass after refactoring
- Code must compile with strict TypeScript and pass ESLint

## Key Technical Decisions

**KTD-1: Homebridge 2.x ESM migration is mandatory.** Homebridge 2.x requires ESM (`"type": "module"` in package.json). This is not optional — it drives the uuid upgrade path (v12+ is ESM-only) and aligns with TypeScript 6.x direction. The migration requires: updating package.json to ESM, converting all `.ts` imports to ESM syntax, updating HAP type imports, and verifying no deprecated API usage remains.

**KTD-2: TypeScript upgrade path is 4.9 → 5.5, then 6.0 deferred.** TypeScript 5.5 is safe with explicit tsconfig settings (target, module, strict). TypeScript 6.0 adds deprecations but is opt-out compatible. Defer 6.0 to avoid introducing additional risk in this refactor.

**KTD-3: Dependency upgrade strategy is sequential, not parallel.** Safe drop-ins (axios, ws, dotenv, @typescript-eslint) upgrade first. ESM-dependent packages (uuid, jest) upgrade after ESM migration. Homebridge upgrade is last due to its breaking changes.

**KTD-4: console.log replacement scope is production paths only.** Replace console.log in production code paths with Logger calls. Keep debug-level console for development. This balances thoroughness with scope control.

## Scope Boundaries

### In Scope
- Runtime stability hardening (resource leaks, error handling, race conditions)
- Dependency version updates (TypeScript, axios, ws, uuid, jest, dotenv, @typescript-eslint, homebridge)
- AI-generated code pattern removal (console.log → Logger, verbose prefixes, redundant comments)
- ESM migration for Homebridge 2.x compatibility
- Test infrastructure updates to match new dependency versions
- CI/CD workflow updates

### Out of Scope
- New feature development
- API protocol changes or new device support
- Performance optimization beyond stability
- UI/UX changes
- Documentation updates (README, config schema) — deferred to follow-up

### Deferred to Follow-Up Work
- TypeScript 6.0 upgrade (deferred to avoid risk)
- README and documentation updates
- Additional test coverage for uncovered paths
- Performance profiling and optimization
- config.schema.json updates for new options (risk: stale schema if new config options are added, e.g., `allowSynchronousEvents` for ws 8.17+ workaround)

## Open Questions

**OQ-1: Homebridge 2.x HAP type changes.** The `Characteristic.Units`, `Characteristic.Formats`, `Characteristic.Perms` enums moved to `api.hap.Units`, `api.hap.Formats`, `api.hap.Perms`. Need to verify all usage sites and update imports. Also verify:
- `Logger` interface stability (used via `this.log.info`, `this.log.debug` — entire U5 depends on this)
- Removed deprecated APIs: `PlatformAccessory.reachable`, `.updateReachability()`, `.getServiceByUUIDAndSubType()`, `.configureCameraSource()`, `API.publishCameraAccessories()`
- Module-level `withPrefix`, `setDebugEnabled`, `setTimestampEnabled`, `forceColor` — use `Logger` static methods
- `HomebridgeConfig.mdns` — use `bridge.advertiser`
- Output dir change: `lib/` → `dist/` (already using `dist/`, so no impact)
- Construct a concrete checklist of all known Homebridge 2.x API changes and verify against current codebase

**OQ-2: WebSocket `allowSynchronousEvents` behavior.** ws 8.17.0+ defaults to `false`. The heartbeat pinger (line 1724 in haier-api.ts) and batch sender (line 2100) call `ws.send()` directly. If the server hasn't completed the handshake and `allowSynchronousEvents` is `false`, these calls could buffer or fail silently. Need to verify if explicit `{ allowSynchronousEvents: true }` is needed in the WebSocket constructor options.

**OQ-3: Jest 30 matcher changes.** Jest 30 removed matcher aliases (e.g., `toThrowError` → `toThrow`). Need to audit test files for deprecated matchers.

## System-Wide Impact

- **End users**: No functional changes expected. Improved stability and reliability.
- **Developers**: ESM module format changes build process. New dependency versions may surface type errors.
- **Operations**: CI/CD workflows need updates for new Node.js requirements (v22+ for Homebridge 2.x).
- **Package registry**: npm package will require Node 22+ minimum after Homebridge 2.x upgrade.

## Risks & Dependencies

### Risks

**R1: Homebridge 2.x API breaking changes (HIGH).** The ESM migration and HAP type changes may require significant code adjustments. Mitigation: thorough API audit before migration, incremental testing.

**R2: TypeScript 5.5 decorator strictness (MEDIUM).** TS 5.5+ is stricter about decorator syntax. May require parenthesizing some decorator expressions. Mitigation: test compilation after upgrade.

**R3: axios 1.8.0 absolute URL behavior change (LOW-MEDIUM).** axios 1.8.0 changed how absolute URLs interact with `baseURL`. The HaierAPI uses `baseURL` with relative paths (`API_DEVICE_CONFIG.replace('{mac}', mac)`), so this likely doesn't apply. Mitigation: verify no absolute URLs are passed to axios methods.

**R4: WebSocket connection race conditions (MEDIUM).** The current implementation has potential race conditions in connect/disconnect flows. Mitigation: add proper state management and cleanup.

**R5: Test infrastructure compatibility (LOW-MEDIUM).** Jest 30 and ts-jest 30.x have compatibility requirements. Mitigation: use matching versions, audit matcher changes.

**R6: Node.js version jump from >=14 to >=22 (HIGH).** Homebridge 2.x requires Node.js v22 or v24. This is a breaking change for all users on Node 14-20. Mitigation: communicate as breaking change, require major version bump, update `engines.node` in package.json.

### Dependencies

- **Homebridge 2.x** requires Node.js v22 or v24 (v18/v20 dropped)
- **uuid v12+** requires ESM and TypeScript 5.2+
- **Jest 30** requires TypeScript >=5.4 and Node.js 18+
- **TypeScript 5.5+** requires Node.js 18+

## Implementation Units

### U1. Stability Hardening

**Goal**: Fix resource leaks, unhandled rejections, and race conditions in WebSocket connection management, timer cleanup, and async error handling.

**Requirements**: R1, R2, R4 (stability)

**Dependencies**: None (foundational)

**Execution note**: Characterize current WebSocket lifecycle behavior with integration tests first, then refactor, then verify tests still pass. The existing test suite has only 4 unit test files that don't cover WebSocket lifecycle, command batching, or timer management.

**Files**:
- `src/haier-api.ts` (WebSocket management, timer cleanup, anti-pattern fixes)
- `src/platform.ts` (timer cleanup, error handling)
- `src/devices/base-device.ts` (event listener cleanup)

**Approach**:
- Add proper WebSocket connection state machine (connecting, connected, disconnecting, closed)
- Ensure all timers (refresh, heartbeat, reconnection) are cleared on destroy
- Add unhandled rejection handlers for async operations
- Fix race conditions in WebSocket connect/disconnect flows
- Add proper error handling in async event handlers
- Restructure `connectWebSocket()` to avoid the `new Promise(async (resolve, reject) => ...)` anti-pattern — synchronous throws before any `await` are lost
- Address race between `disconnect()` (clears `reconnectTimer`) and WebSocket `'close'` handler (calls `scheduleReconnect()`) — use a `closing` flag to prevent timer creation during shutdown
- Handle command batching during WebSocket disconnect: when batch timer fires but WS is disconnected, reject pending batch promises or queue for retry

**Test scenarios**:
- Happy path: WebSocket connects, sends heartbeat, receives messages, disconnects cleanly — assert all timers cleared, all event listeners removed
- Edge case: WebSocket fails to connect, retries with exponential backoff, eventually succeeds — assert no timer leaks across retry attempts
- Error path: WebSocket connection drops, reconnection timer fires, reconnects successfully — assert `reconnectTimer` is null after successful reconnect
- Error path: Token expires during WebSocket session, reconnects with new token — assert new token is used in reconnect URL
- Integration: After 10 rapid connect/disconnect cycles, assert `reconnectTimer === null`, `heartbeatTimer === null`, `statusRequestTimer === null`, `commandBatches.size === 0`, and registered event listener count on WebSocket is 0
- Edge case: Platform destroys while WebSocket is connecting — assert `closing` flag prevents timer creation, all resources cleaned up
- Edge case: Command batch timer fires during disconnect — assert pending batch promises are rejected with clear error, not left hanging

**Verification**: All existing tests pass. New integration tests for WebSocket lifecycle. Characterization tests verify behavior is preserved.

### U2. Safe Dependency Updates

**Goal**: Update dependencies that are safe drop-in upgrades: axios, ws, dotenv, @typescript-eslint.

**Requirements**: R2 (dependency updates)

**Dependencies**: None

**Files**:
- `package.json` (dependency versions, @types/* versions)
- `package-lock.json` (regenerated)

**Approach**:
- Update axios from 1.6.x to 1.18.x (safe drop-in)
- Update ws from 8.14.x to 8.21.x (safe drop-in, check `allowSynchronousEvents`)
- Update dotenv from 17.x to 17.4.x (safe drop-in, add `{ quiet: true }`)
- Update @typescript-eslint from 8.x to 8.61.x (safe within v8)
- Update eslint, globals, typescript-eslint to match
- Update @types/* packages to compatible versions (`@types/node: ^22.x`, `@types/uuid: ^12.x`, `@types/ws: ^8.5.x`)
- Regenerate package-lock.json
- Run lint and tests to verify

**Test scenarios**:
- Happy path: All dependencies install without conflicts
- Happy path: Lint passes with updated @typescript-eslint rules
- Happy path: ESLint flat config (`eslint.config.mts`) remains valid for new @typescript-eslint version
- Happy path: All existing tests pass
- Edge case: ws `allowSynchronousEvents` doesn't break any `.send()` calls

**Verification**: `npm run lint && npm run build && npm run test:unit` all pass.

### U3. TypeScript 5.5 Upgrade

**Goal**: Upgrade TypeScript from 4.9 to 5.5 with minimal code changes.

**Requirements**: R2 (dependency updates)

**Dependencies**: U2 (safe dependencies first)

**Files**:
- `package.json` (TypeScript version, @types/* versions)
- `tsconfig.json` (verify settings are explicit)
- `src/**/*.ts` (fix any type errors)

**Approach**:
- Update TypeScript to 5.5.x in package.json
- Update @types/* packages to compatible versions (`@types/node: ^22.x`, `@types/uuid: ^12.x`, `@types/ws: ^8.5.x`)
- Verify tsconfig.json has explicit `target`, `module`, `strict` settings
- Run `npm run build` and fix any type errors
- Address decorator strictness if needed (parenthesize decorator expressions)
- Run tests to verify

**Test scenarios**:
- Happy path: Project compiles without errors
- Happy path: All existing tests pass
- Edge case: Decorator syntax is compatible with TS 5.5+
- Edge case: All `@types/*` packages are compatible with new TypeScript version

**Verification**: `npm run build` succeeds. `npm run test:unit` passes.

### U4. ESM Migration for Homebridge 2.x

**Goal**: Migrate the plugin from CommonJS to ESM to support Homebridge 2.x.

**Requirements**: R1, R6 (Homebridge 2.x compatibility)

**Dependencies**: U3 (TypeScript 5.5 first)

**Files**:
- `package.json` (add `"type": "module"`, update Homebridge version, update `engines.node` to `>=22.12.0`)
- `src/index.ts` (update exports to ESM)
- `src/haier-api.ts` (convert 3 dynamic `require('fs')`, `require('path')`, `require('os')` calls at lines 259, 283, 284 to top-level `import` statements)
- `src/**/*.ts` (verify all imports are ESM-compatible, audit for any other dynamic `require()` usage)
- `tsconfig.json` (update `module` to `node16` or `esnext`, update `moduleResolution` to `node16` or `bundler` — current `"node"` is CJS-only and incompatible with ESM)
- `.npmignore` (verify ignores are correct for ESM)

**Approach**:
- Add `"type": "module"` to package.json
- Update `engines.node` from `>=14.0.0` to `>=22.12.0` (document as breaking change)
- Update Homebridge dependency to ^2.0.0 (consider moving from devDependencies to peerDependencies)
- Update all imports to use ESM syntax (`.js` extensions for relative imports)
- Convert dynamic `require()` calls in `src/haier-api.ts` to top-level `import` statements
- Update HAP type imports if needed (`api.hap.Units`, `api.hap.Formats`, `api.hap.Perms`)
- Verify no deprecated API usage (check for removed methods like `reachable`, `updateReachability`, `getServiceByUUIDAndSubType`, `publishCameraAccessories`)
- Update tsconfig.json `module` to `node16` or `esnext` and `moduleResolution` to `node16` or `bundler`
- Run build and tests
- Update CI/CD workflows for Node 22+

**Test scenarios**:
- Happy path: Project compiles with ESM
- Happy path: All existing tests pass
- Happy path: Plugin loads in Homebridge 2.x (integration test)
- Edge case: No deprecated API usage remains
- Edge case: All `@types/*` packages are compatible (`@types/node: ^22.x`, `@types/uuid: ^12.x`, `@types/ws: ^8.5.x`, `@types/jest: ^30.x`)
- Integration: Homebridge can discover and register accessories

**Verification**: `npm run build` succeeds. `npm run test:unit` passes. Plugin loads in Homebridge 2.x.

### U5. AI Slop Removal

**Goal**: Remove AI-generated code patterns: console.log → Logger, verbose prefixes, redundant comments, excessive `any` types.

**Requirements**: R3 (code quality)

**Dependencies**: U4 (ESM migration first, as it changes module system)

**Files**:
- `src/haier-api.ts` (console.log → Logger, remove verbose prefixes)
- `src/platform.ts` (console.log → Logger)
- `src/devices/base-device.ts` (console.log → Logger)
- `src/accessories/haier-evo-accessory.ts` (console.log → Logger)
- `src/**/*.ts` (review for redundant comments, excessive `any`)

**Approach**:
- Replace `console.log` calls with `this.log.info` or `this.log.debug` (depending on level)
- Remove `[timestamp] [Haier Evo]` prefix (Logger handles this)
- Remove verbose debug logging that just echoes input
- Replace `any` with proper types where feasible
- Remove redundant comments that just restate code
- Keep essential JSDoc for public APIs
- Run lint to verify

**Test scenarios**:
- Happy path: All console.log replaced with Logger calls
- Happy path: Lint passes with stricter rules
- Happy path: All existing tests pass
- Edge case: Debug logging still works when `debug: true` in config

**Verification**: `npm run lint` passes. No `console.log` in production code paths. All tests pass.

### U6. Test Infrastructure Updates

**Goal**: Update test infrastructure for new dependency versions: Jest 30, uuid v12+, ts-jest 30.x.

**Requirements**: R2 (dependency updates), R3 (code quality)

**Dependencies**: U4 (ESM migration)

**Files**:
- `package.json` (Jest, uuid, ts-jest versions)
- `jest.config.js` (rename to `jest.config.cjs` — after ESM migration, Node treats `.js` as ESM; Jest can load CJS config explicitly with `.cjs` extension)
- `tests/setup.ts` (update mocks if needed)
- `tests/unit/*.test.ts` (fix deprecated matchers)

**Approach**:
- Update Jest to 30.x
- Update uuid to v12+ (requires ESM, already done in U4)
- Update ts-jest to 30.x (Jest 30 requires ts-jest 30.x, not 29.x)
- Rename `jest.config.js` to `jest.config.cjs` to avoid ESM parsing
- Fix deprecated matcher aliases (e.g., `toThrowError` → `toThrow`, `toBeCalled` → `toHaveBeenCalled`)
- Update test mocks if needed for new dependency versions
- Run tests to verify

**Test scenarios**:
- Happy path: All tests pass with Jest 30 and ts-jest 30.x
- Happy path: uuid v12+ works with ESM
- Happy path: `jest.config.cjs` loads correctly
- Edge case: No deprecated matchers remain in test files
- Edge case: All `@types/*` packages are compatible with new dependency versions (`@types/node: ^22.x`, `@types/uuid: ^12.x`, `@types/ws: ^8.5.x`, `@types/jest: ^30.x`)

**Verification**: `npm run test:unit` passes. `npm run test:coverage` runs successfully.

### U7. CI/CD and Final Verification

**Goal**: Update CI/CD workflows and perform final verification.

**Requirements**: R1, R2, R3

**Dependencies**: U1-U6 (all refactoring complete)

**Files**:
- `.github/workflows/test.yml` (update Node.js version)
- `.github/workflows/npm-publish.yml` (update Node.js version)
- `.github/workflows/comprehensive-test.yml` (update Node.js version)
- `.github/workflows/release.yml` (update Node.js version)
- `env.example` (update if needed)
- `README.md` (update installation requirements)

**Approach**:
- Update Node.js version in all 4 CI workflows to 22.x (required by Homebridge 2.x)
- Update any other CI configuration as needed
- Update README with new requirements (Node 22+, Homebridge 2.x)
- Run full test suite in CI
- Perform final smoke test

**Test scenarios**:
- Happy path: CI workflows run successfully
- Happy path: Package publishes to npm
- Happy path: Plugin installs and loads in Homebridge 2.x
- Edge case: All documentation is up to date

**Verification**: CI passes. Package publishes successfully. Plugin works in Homebridge 2.x.

## Acceptance Examples

**AE1**: Plugin compiles with TypeScript 5.5 and strict mode, no type errors.

**AE2**: All 50+ console.log calls in production code replaced with Logger calls.

**AE3**: WebSocket connection handles connect/disconnect/reconnect cycles without leaking timers or event listeners.

**AE4**: Plugin loads in Homebridge 2.x (ESM) and registers accessories correctly.

**AE5**: All existing tests pass after refactoring.

**AE6**: New dependencies (axios 1.18, ws 8.21, uuid 12+, jest 30) install without conflicts.

## Documentation & Operational Notes

- **Node.js requirement**: Will change from v14+ to v22+ after Homebridge 2.x upgrade
- **Homebridge requirement**: Will change from ^1.3.0 to ^2.0.0
- **Breaking change**: ESM module format change may affect local development setups
- **Rollout**: Recommend gradual rollout with version bump (minor or major depending on Homebridge 2.x compatibility)

## Sources & Research

- Homebridge 2.x release notes and migration guide (ESM-only requirement)
- TypeScript 5.5 release notes (decorator strictness, removed options)
- axios 1.8.0 breaking changes (absolute URL handling)
- ws 8.17.0 breaking changes (`allowSynchronousEvents` default flip)
- uuid v12+ breaking changes (ESM-only, Node 20+ requirement)
- Jest 30 breaking changes (matcher aliases, Node.js 18+ requirement)
- @typescript-eslint v8 breaking changes (flat config, removed rules)
