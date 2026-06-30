import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'homebridge';
import {
  HaierEvoConfig,
  AuthResponse,
  DeviceInfo,
  DeviceStatus,
  HaierDevice,
  HaierAC,
  HaierRefrigerator,
  ModelAttributeConfig
} from './types.js';
import { ModelConfigService } from './models/model-config.js';
import {
  API_PATH,
  API_LOGIN,
  API_TOKEN_REFRESH,
  API_DEVICES,
  API_DEVICE_CONFIG,
  API_WEBSOCKET_STATUS,
  API_TIMEOUT
} from './constants.js';
import { parseAuthResponse, parseAuthToken, parseDeviceConfig } from './validation.js';

interface ApiErrorResponse {
  error?: unknown;
}

interface DeviceConfigResponse {
  info?: { model?: string; serialNumber?: string };
  settings?: { firmware?: { value?: string }; name?: { name?: string } };
  attributes?: unknown[];
  sensors?: { items?: unknown[] };
  temperature?: { value?: { name?: string } };
  power?: { value?: { name?: string } };
  [key: string]: unknown;
}

interface WebSocketMessage {
  event?: string;
  type?: string;
  macAddress?: string;
  payload?: unknown;
  trace?: string;
  errNo?: number;
  message?: string;
  errorMessage?: string;
  data?: unknown;
  [key: string]: unknown;
}

interface StatusUpdate {
  properties?: Record<string, unknown>;
  ts?: number;
  [key: string]: unknown;
}

export class HaierAPI extends EventEmitter {
  private log: Logger;
  private http: AxiosInstance;
  private ws: WebSocket | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpire: Date | null = null;
  private refreshExpire: Date | null = null;

  private deviceCache: DeviceInfo[] | null = null;
  private deviceCacheTimestamp: number = 0;
  private deviceCacheTTL: number = 300000; // 5 minutes by default
  private devices: Map<string, HaierDevice> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pendingStatusTimer: NodeJS.Timeout | null = null;
  private initialStatusTimer: NodeJS.Timeout | null = null;
  private pendingStatusRequest = false;
  private isConnected = false;
  private connectionEstablished = false;
  private closing = false;
  private wsState: 'connecting' | 'connected' | 'disconnecting' | 'closed' = 'closed';
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;

  // Token refresh tracking
  private refreshFailureCount: number = 0;
  private maxRefreshFailures: number = 3;
  private refreshInProgress: boolean = false;
  private refreshPromise: Promise<void> | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;

  // Rate limiting and retry configuration
  private rateLimitConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second base delay
    maxDelay: 30000, // 30 seconds max delay
    jitter: 0.1, // 10% jitter for distributed retries
    respectRetryAfter: true,
    queueRetries: true
  };

  // Rate limiting state
  private requestQueue: Array<{
    request: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
    retryCount: number;
    maxRetries: number;
  }> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private minRequestInterval = 100; // Minimum 100ms between requests

  // Command batching system
  private commandBatches: Map<string, {
    commands: Array<{propertyId: string, value: string | number | boolean}>;
    promises: Array<{resolve: () => void, reject: (error: unknown) => void}>;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private batchTimeout: number = 100; // 100ms timeout for batching
  private readonly modelConfig = ModelConfigService.getInstance();

  constructor(private config: HaierEvoConfig, log: Logger) {
    super();
    this.log = log;

    // Set device cache TTL from config if provided
    if (this.config.deviceCacheTTL !== undefined) {
      this.deviceCacheTTL = this.config.deviceCacheTTL * 1000; // Convert to milliseconds
    }

    // Set batch timeout from config if provided
    if (this.config.batchTimeout !== undefined) {
      this.setBatchTimeout(this.config.batchTimeout);
    }

    // Set default token refresh mode if not provided
    if (this.config.tokenRefreshMode === undefined) {
      this.config.tokenRefreshMode = 'auto';
    }

    // Set default token refresh threshold if not provided
    if (this.config.tokenRefreshThreshold === undefined) {
      this.config.tokenRefreshThreshold = 300; // 5 minutes by default
    }

    // Set default token refresh interval if not provided
    if (this.config.tokenRefreshInterval === undefined) {
      this.config.tokenRefreshInterval = 3600; // 1 hour by default
    }

    // Get or generate device ID
    if (!this.config.deviceId) {
      // Try to get stored device ID first
      const storedDeviceId = this.getStoredDeviceId();
      if (storedDeviceId) {
        this.config.deviceId = storedDeviceId;
        if (this.config.debug) {
          this.log.debug(`Using stored device ID: ${this.config.deviceId}`);
        }
      } else {
        // Generate new device ID
        this.config.deviceId = this.generateDeviceId();
        this.storeDeviceId(this.config.deviceId);
        if (this.config.debug) {
          this.log.debug(`Generated and stored new device ID: ${this.config.deviceId}`);
        }
      }
    }

    this.http = axios.create({
      baseURL: API_PATH,
      timeout: API_TIMEOUT * 1000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'evo-mobile',
        'Device-model': 'iPhone17,1',
        'Version': '4.35.0',
        'Time-zone': 'Europe/Moscow',
        'Platform': 'ios',
        'VersionCode': '13766',
        'Device-Id': this.config.deviceId,
        'GAID': 'D4232F12-7C00-46EB-83A9-4BC6C23B988A',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Charset': 'UTF-8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      }
    });

    // Add request interceptor for authentication
    this.http.interceptors.request.use(
      (config) => {
        // Ensure Device-Id header is always present
        if (config.headers) {
          config.headers['Device-Id'] = this.config.deviceId;
        }

        const requestUrl = (config.url || '').toLowerCase();
        const isAuthRequest =
          requestUrl.includes('/users/auth/sign-in') ||
          requestUrl.includes('/users/auth/refresh');

        if (isAuthRequest) {
          delete config.headers['X-Auth-Token'];
        } else if (this.accessToken) {
          config.headers['X-Auth-Token'] = this.accessToken;
        }

        // Debug logging for headers
        if (this.config.debug) {
          this.log.debug(`Request to ${config.url}:`);
          this.log.debug('Method:', config.method?.toUpperCase());
          this.log.debug('Headers:', {
            'Device-Id': config.headers['Device-Id'],
            'X-Auth-Token': config.headers['X-Auth-Token'] ? '***' : 'None',
            'User-Agent': config.headers['User-Agent'],
            'Accept': config.headers['Accept'],
            'Accept-Language': config.headers['Accept-Language'],
            'Content-Type': config.headers['Content-Type']
          });
          if (config.data) {
            this.log.debug('Request body:', JSON.stringify(config.data, null, 2));
          }
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for token refresh
    this.http.interceptors.response.use(
      (response) => {
        if (this.config.debug) {
          this.log.debug(`Response from ${response.config.url}:`);
          this.log.debug('Status:', response.status);
          this.log.debug('Status text:', response.statusText);
          this.log.debug('Response headers:', response.headers);
        }
        return response;
      },
      async (error) => {
        if (this.config.debug) {
          this.log.debug(`Response error from ${error.config?.url}:`);
          this.log.debug('Error status:', error.response?.status);
          this.log.debug('Error status text:', error.response?.statusText);
          this.log.debug('Error response headers:', error.response?.headers);
          if (error.response?.data) {
            this.log.debug('Error response data:', JSON.stringify(error.response.data, null, 2));
          }
        }

        // Handle 429 rate limiting errors - let the rate limiting wrapper handle these
        if (error.response?.status === 429) {
          if (this.config.debug) {
            this.log.debug('Rate limited (429) in interceptor. Passing to rate limiting handler.');
          }
          return Promise.reject(error);
        }

        // Skip token refresh for the refresh token endpoint itself to avoid infinite loops
        const isRefreshEndpoint = error.config?.url?.includes('/auth/refresh');

        if (error.response?.status === 401 && !isRefreshEndpoint) {
          if (this.config.debug) {
            this.log.debug('401 Unauthorized error, attempting token refresh');
          }

          try {
            // Use our robust token refresh mechanism
            await this.refreshAccessToken();

            // Retry the original request with the new token
            const originalRequest = error.config;
            originalRequest.headers['X-Auth-Token'] = this.accessToken;
            return this.http(originalRequest);
          } catch (refreshError) {
            if (this.config.debug) {
              this.log.debug('Token refresh failed in interceptor, rejecting request:', refreshError);
            }
            return Promise.reject(error);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private generateDeviceId(): string {
    // Generate a standard UUID v4 device identifier
    // This is the standard format used by mobile apps and APIs
    return uuidv4();
  }

  private getStoredDeviceId(): string | null {
    try {
      const homeDir = os.homedir();
      const configDir = path.join(homeDir, '.homebridge');
      const deviceIdFile = path.join(configDir, 'haier-evo-device-id.txt');

      if (fs.existsSync(deviceIdFile)) {
        const deviceId = fs.readFileSync(deviceIdFile, 'utf8').trim();
        if (deviceId && deviceId.length > 0) {
          return deviceId;
        }
      }
    } catch (error) {
      if (this.config.debug) {
        this.log.debug('Could not read stored device ID:', error instanceof Error ? error.message : String(error));
      }
    }
    return null;
  }

  private storeDeviceId(deviceId: string): void {
    try {
      const homeDir = os.homedir();
      const configDir = path.join(homeDir, '.homebridge');
      const deviceIdFile = path.join(configDir, 'haier-evo-device-id.txt');

      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(deviceIdFile, deviceId);
      if (this.config.debug) {
        this.log.debug(`Device ID stored to: ${deviceIdFile}`);
      }
    } catch (error) {
      if (this.config.debug) {
        this.log.debug('Could not store device ID:', error instanceof Error ? error.message : String(error));
      }
    }
  }

  async authenticate(): Promise<void> {
    try {
      if (this.config.debug) {
        this.log.debug(`Authenticating with region: ${this.config.region}`);
        this.log.debug(`Login endpoint: ${API_LOGIN.replace('{region}', this.config.region)}`);
      }

      const response: AxiosResponse<AuthResponse> = await this.executeWithRateLimit(() =>
        this.http.post(
          API_LOGIN.replace('{region}', this.config.region),
          {
            email: this.config.email,
            password: this.config.password
          }
        )
      );

      if (this.config.debug) {
        this.log.debug('Authentication response received - status:', response.status);
      }

      if (response.data.error) {
        throw new Error(`Authentication failed: ${JSON.stringify(response.data.error)}`);
      }

      const authData = parseAuthResponse(response.data);
      if (!authData?.data?.token) {
        throw new Error('Authentication failed: invalid token structure in response');
      }

      const token = authData.data.token;
      this.accessToken = token.accessToken;
      this.refreshToken = token.refreshToken;
      this.tokenExpire = new Date(token.expire);
      this.refreshExpire = new Date(token.refreshExpire);

      if (this.config.debug) {
      this.log.debug('Authentication successful:');
      this.log.debug('Access token length:', this.accessToken?.length || 0);
      this.log.debug('Refresh token length:', this.refreshToken?.length || 0);
      this.log.debug('Token expires:', this.tokenExpire?.toISOString());
      this.log.debug('Refresh expires:', this.refreshExpire?.toISOString());
      }

      this.emit('authenticated');

      // Set up token refresh based on configuration
      this.setupTokenRefresh();
    } catch (error) {
      if (this.config.debug) {
        this.log.debug('Authentication error:', error instanceof Error ? error.message : String(error));
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number; data?: unknown } };
          if (axiosError.response) {
            this.log.debug('Error response status:', axiosError.response.status);
            this.log.debug('Error response data:', JSON.stringify(axiosError.response.data, null, 2));
          }
        }
      }
      this.emit('error', `Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Sets up token refresh based on configuration
   */
  private setupTokenRefresh(): void {
    // Clear any existing timer
    this.clearTokenRefreshTimer();

    // Skip if token refresh is disabled
    if (this.config.tokenRefreshMode === 'disabled') {
      if (this.config.debug) {
        this.log.debug('Token refresh is disabled in configuration');
      }
      return;
    }

    if (this.config.tokenRefreshMode === 'manual') {
      // Set up timer based on fixed interval
      const interval = (this.config.tokenRefreshInterval || 3600) * 1000; // Convert to ms

      this.log.info(`Setting up manual token refresh every ${interval / 1000} seconds`);

      this.tokenRefreshTimer = setInterval(() => {
        this.log.info(`Performing scheduled manual token refresh`);
        this.refreshAccessToken().catch(error => {
          this.log.error(`Scheduled token refresh failed:`, error);
        });
      }, interval);

    } else if (this.config.tokenRefreshMode === 'auto') {
      // Set up timer based on token expiration
      if (this.tokenExpire) {
        const now = new Date();
        const timeUntilExpire = this.tokenExpire.getTime() - now.getTime();
        const threshold = (this.config.tokenRefreshThreshold || 300) * 1000; // Convert to ms
        const timeUntilRefresh = Math.max(timeUntilExpire - threshold, 0);

        this.log.info(`Token expires in ${timeUntilExpire / 1000} seconds, will refresh in ${timeUntilRefresh / 1000} seconds`);

        this.tokenRefreshTimer = setTimeout(() => {
          this.log.info(`Performing auto token refresh before expiration`);
          this.refreshAccessToken().catch(error => {
            this.log.error(`Auto token refresh failed:`, error);
          });
        }, timeUntilRefresh);
      }
    }
  }

  /**
   * Clears any existing token refresh timer
   */
  private clearTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  async refreshAccessToken(): Promise<void> {
    // If a refresh is already in progress, return the existing promise
    if (this.refreshInProgress && this.refreshPromise) {
      if (this.config.debug) {
        this.log.debug('Token refresh already in progress, waiting for completion');
      }
      return this.refreshPromise;
    }

    // No refresh token available, need to authenticate
    if (!this.refreshToken) {
      if (this.config.debug) {
        this.log.debug('No refresh token available, performing full authentication');
      }
      return this.authenticate();
    }

    // Start a new refresh operation
    this.refreshInProgress = true;
    this.refreshPromise = this._refreshAccessToken();

    try {
      await this.refreshPromise;

      // Set up next token refresh after successful refresh
      this.setupTokenRefresh();
    } finally {
      this.refreshInProgress = false;
      this.refreshPromise = null;
    }
  }

  private async _refreshAccessToken(): Promise<void> {
    try {
      if (this.config.debug) {
        this.log.debug('Refreshing access token...');
        this.log.debug(`Refresh endpoint: ${API_TOKEN_REFRESH.replace('{region}', this.config.region)}`);
        this.log.debug(`Current refresh failure count: ${this.refreshFailureCount}/${this.maxRefreshFailures}`);
      }

      // If we've exceeded the maximum number of refresh failures, perform a full authentication
      if (this.refreshFailureCount >= this.maxRefreshFailures) {
        if (this.config.debug) {
          this.log.debug(`Maximum refresh failures (${this.maxRefreshFailures}) reached, performing full authentication`);
        }
        this.refreshFailureCount = 0;
        return this.authenticate();
      }

      const response: AxiosResponse<AuthResponse> = await this.executeWithRateLimit(() =>
        this.http.post(
          API_TOKEN_REFRESH.replace('{region}', this.config.region),
          {
            refreshToken: this.refreshToken
          }
        )
      );

      if (this.config.debug) {
        this.log.debug('Token refresh response received - status:', response.status);
      }

      if (response.data.error) {
        this.refreshFailureCount++;
        this.emit('tokenRefreshFailed', `Token refresh failed: ${JSON.stringify(response.data.error)}`);
        throw new Error(`Token refresh failed: ${JSON.stringify(response.data.error)}`);
      }

      const refreshData = parseAuthResponse(response.data);
      if (!refreshData?.data?.token) {
        this.refreshFailureCount++;
        throw new Error('Token refresh failed: invalid token structure in response');
      }

      const token = refreshData.data.token;
      this.accessToken = token.accessToken;
      this.refreshToken = token.refreshToken;
      this.tokenExpire = new Date(token.expire);
      this.refreshExpire = new Date(token.refreshExpire);

      // Reset failure count on success
      this.refreshFailureCount = 0;

      if (this.config.debug) {
        this.log.debug('Token refresh successful:');
        this.log.debug('New access token length:', this.accessToken?.length || 0);
        this.log.debug('New token expires:', this.tokenExpire);
      }

      this.emit('tokenRefreshed');
    } catch (error: unknown) {
      this.refreshFailureCount++;

      if (this.config.debug) {
        this.log.debug(`Token refresh error (failure ${this.refreshFailureCount}/${this.maxRefreshFailures}):`, error instanceof Error ? error.message : String(error));
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number; data?: unknown } };
          if (axiosError.response) {
            this.log.debug('Error response status:', axiosError.response.status);
            this.log.debug('Error response data:', JSON.stringify(axiosError.response.data, null, 2));
          }
        }
      }

      const errResponse = (error && typeof error === 'object' && 'response' in error)
        ? (error as { response?: { status?: number } }).response
        : undefined;

      // Check if this is an authentication error (401) - refresh token is invalid/expired
      if (errResponse?.status === 401) {
        this.log.info('Refresh token invalid/expired (401), performing full reauthentication');
        this.emit('tokenRefreshFailed', 'Refresh token expired or invalid');

        // Clear invalid tokens
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpire = null;
        this.refreshExpire = null;

        // Reset failure count and immediately try full authentication
        this.refreshFailureCount = 0;
        return this.authenticate();
      }

      // Check if this is a rate limiting error (429)
      if (errResponse?.status === 429) {
        this.log.info('Token refresh rate limited (429), will retry with exponential backoff');
        this.emit('tokenRefreshFailed', 'Token refresh rate limited');

        // For rate limiting, we should retry with exponential backoff
        if (this.refreshFailureCount < this.maxRefreshFailures) {
          const backoffDelay = Math.min(1000 * Math.pow(2, this.refreshFailureCount), 30000);
          this.log.info(`Waiting ${backoffDelay}ms before retrying token refresh`);

          await this.delay(backoffDelay);
          return this._refreshAccessToken();
        } else {
          this.log.info('Maximum refresh failures reached after rate limiting, performing full authentication');
          this.refreshFailureCount = 0;
          return this.authenticate();
        }
      }

      // For other errors, emit and throw
      this.log.error('Token refresh failed with unexpected error:', error instanceof Error ? error.message : String(error));
      this.emit('error', `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async fetchDevices(): Promise<DeviceInfo[]> {
    const now = Date.now();

    // Check if we have a valid cache
    if (this.deviceCache && (now - this.deviceCacheTimestamp < this.deviceCacheTTL)) {
      this.log.info(`Using cached device list (age: ${Math.round((now - this.deviceCacheTimestamp) / 1000)}s, TTL: ${Math.round(this.deviceCacheTTL / 1000)}s)`);
      return this.deviceCache;
    }

    this.log.info('Device cache expired or not available, fetching fresh data');

    const endpoints = [
      API_DEVICES
    ];

    for (const endpoint of endpoints) {
      try {
        const url = endpoint.replace('{region}', this.config.region);

        // Add randomization to the URL to avoid caching on server side
        const randomParam = `&_=${now}_${Math.floor(Math.random() * 1000000)}`;
        const urlWithRandom = url + randomParam;

        this.log.debug(`Trying endpoint: ${urlWithRandom}`);

        // Add random delay before request (between 100ms and 1000ms)
        const randomDelay = Math.floor(Math.random() * 900) + 100;
        await this.delay(randomDelay);

        const response = await this.executeWithRateLimit(() => this.http.get(urlWithRandom));

        if (this.config.debug) {
          this.log.debug(`Response from ${url}: status=${response.status}, dataKeys=${response.data ? Object.keys(response.data).join(',') : 'No data'}`);
        }

        if (response.data.error) {
          this.log.debug(`Endpoint ${url} returned error:`, response.data.error);
          continue; // Try next endpoint
        }

        // Check if this response contains actual device data
        let devices: Record<string, unknown>[] = [];

        // Try different response structures
        if (Array.isArray(response.data.data)) {
          devices = response.data.data;
        } else if (Array.isArray(response.data.devices)) {
          devices = response.data.devices;
        } else if (Array.isArray(response.data.items)) {
          devices = response.data.items;
        } else if (Array.isArray(response.data.list)) {
          devices = response.data.list;
        } else if (Array.isArray(response.data.results)) {
          devices = response.data.results;
        } else if (response.data.data && typeof response.data.data === 'object') {
          // Check if data contains devices in nested structure
          const possibleDeviceKeys = ['devices', 'items', 'list', 'results'];
          for (const key of possibleDeviceKeys) {
            if (Array.isArray(response.data.data[key])) {
              devices = response.data.data[key];
              break;
            }
          }
        }

        // Special handling for UI presentation data (like from API_DEVICES endpoint)
        if (devices.length === 0 && response.data.data?.presentation?.layout?.scrollContainer) {
          devices = this.extractDevicesFromUIResponse(response.data.data);
        }

        // Validate that we found actual device data
        if (devices.length > 0 && this.isValidDeviceData(devices)) {
          this.log.debug(`Found ${devices.length} devices from endpoint: ${url}`);

          // Fetch complete device information for all devices and merge it
          this.log.info(`Fetching complete device information for ${devices.length} devices...`);
          const devicesWithCompleteInfo = await this.enrichDevicesWithCompleteInfo(devices);

          // Update cache with complete device information
          this.deviceCache = devicesWithCompleteInfo;
          this.deviceCacheTimestamp = now;

          return devicesWithCompleteInfo;
        } else {
          this.log.debug(`Endpoint ${url} returned data but no valid devices found`);
          continue; // Try next endpoint
        }

      } catch (error) {
        this.log.error(`Endpoint ${endpoint} failed:`, error instanceof Error ? error.message : String(error));

        // If we have a cache, use it even if expired
        if (this.deviceCache) {
          this.log.info(`Using cached device list due to fetch error (cache age: ${Math.round((now - this.deviceCacheTimestamp) / 1000)}s)`);
          return this.deviceCache;
        }

        continue; // Try next endpoint
      }
    }

    // If we get here, no endpoint returned valid device data
    this.log.debug('No valid device data found from any endpoint');

    // If we have a cache, use it even if expired as a fallback
    if (this.deviceCache) {
      this.log.info(`Using cached device list as fallback (cache age: ${Math.round((now - this.deviceCacheTimestamp) / 1000)}s)`);
      return this.deviceCache;
    }

    return [];
  }

  /**
   * Enriches basic device data with complete configuration information
   * @param devices Basic device data from API_DEVICES
   * @returns Devices with complete information including model, firmware, serial
   */
  private async enrichDevicesWithCompleteInfo(devices: Record<string, unknown>[]): Promise<DeviceInfo[]> {
    const enrichedDevices: DeviceInfo[] = [];

    for (const device of devices) {
      try {
        let enrichedDevice = { ...device } as unknown as DeviceInfo;

        const macAddress = device.mac || device.macAddress;

        if (macAddress) {
          this.log.info(`Fetching config for ${device.name || device.id} (${String(macAddress)})`);

          try {
            const deviceConfig = await this.getDeviceConfigForEnrichment(String(macAddress));

            enrichedDevice = {
              ...enrichedDevice,
              model: (deviceConfig.model as string) || enrichedDevice.model,
              serialNumber: (deviceConfig.serialNumber as string) || enrichedDevice.serialNumber,
              firmwareVersion: (deviceConfig.firmwareVersion as string) || enrichedDevice.firmwareVersion,
              name: (deviceConfig.deviceName as string) || enrichedDevice.name
            } as DeviceInfo;

            this.log.info(`Enriched ${device.name}: model=${enrichedDevice.model}, serial=${enrichedDevice.serialNumber}, firmware=${enrichedDevice.firmwareVersion}`);
          } catch (configError) {
            this.log.warn(`Failed to fetch config for ${device.name} (${String(macAddress)}):`, configError instanceof Error ? configError.message : String(configError));
          }
        } else {
          this.log.warn(`No MAC address for device ${device.name || device.id}, skipping config fetch`);
        }

        enrichedDevices.push(enrichedDevice);
      } catch (error) {
        this.log.error(`Error enriching device ${device.name || device.id}:`, error instanceof Error ? error.message : String(error));
        enrichedDevices.push({ ...device } as unknown as DeviceInfo);
      }
    }

    return enrichedDevices;
  }

  /**
   * Fetches device configuration without using the main getDeviceStatus cache
   * This is used during device discovery to build the complete cache
   */
   private async getDeviceConfigForEnrichment(mac: string): Promise<Record<string, unknown>> {
    try {
      await this.ensureValidToken();

      const response = await this.executeWithRateLimit(() =>
        this.http.get(
          API_DEVICE_CONFIG.replace('{mac}', mac)
        )
      );

      const trimmed = this.trimData(response.data) as Record<string, unknown>;

      if (trimmed.error) {
        throw new Error(`Failed to get device configuration: ${JSON.stringify(trimmed.error)}`);
      }

      const parsed = parseDeviceConfig(trimmed);
      const deviceConfig: Record<string, unknown> = {};

      if (parsed) {
        if (parsed.info?.model) {
          deviceConfig.model = parsed.info.model;
        }
        if (parsed.info?.serialNumber) {
          deviceConfig.serialNumber = parsed.info.serialNumber;
        }
        if (parsed.settings?.firmware?.value) {
          deviceConfig.firmwareVersion = parsed.settings.firmware.value;
        }
        if (parsed.settings?.name?.name) {
          deviceConfig.deviceName = parsed.settings.name.name.trim();
        }
      } else if (trimmed) {
        // Fallback: extract from unvalidated response
        const info = trimmed.info as Record<string, unknown> | undefined;
        if (info?.model) deviceConfig.model = info.model;
        if (info?.serialNumber) deviceConfig.serialNumber = info.serialNumber;
        const settings = trimmed.settings as Record<string, unknown> | undefined;
        if (settings?.firmware && typeof settings.firmware === 'object') {
          const fw = settings.firmware as Record<string, unknown>;
          if (fw?.value) deviceConfig.firmwareVersion = fw.value;
        }
        if (settings?.name && typeof settings.name === 'object') {
          const name = settings.name as Record<string, unknown>;
          if (typeof name?.name === 'string') deviceConfig.deviceName = name.name.trim();
        }
      }

      return deviceConfig;
    } catch (error) {
      this.log.error(`Device configuration error for ${mac}:`, error);
      throw error;
    }
  }

  /**
   * Utility function to recursively trim string values in objects and arrays
   * @param data The data to trim
   * @returns The trimmed data
   */
  private trimData(data: unknown): unknown {
    if (typeof data === 'string') {
      return data.trim();
    } else if (Array.isArray(data)) {
      return data.map(item => this.trimData(item));
    } else if (data !== null && typeof data === 'object') {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(data)) {
        result[key] = this.trimData((data as Record<string, unknown>)[key]);
      }
      return result;
    }
    return data;
  }

  private extractDevicesFromUIResponse(data: Record<string, unknown>): Record<string, unknown>[] {
    try {
      data = this.trimData(data) as Record<string, unknown>;

      this.log.debug('Extracting devices from UI response structure');

      const scrollContainer = (data as { presentation?: { layout?: { scrollContainer?: unknown[] } } }).presentation?.layout?.scrollContainer;
      if (!Array.isArray(scrollContainer)) {
        this.log.debug('No scrollContainer array found in UI response');
        return [];
      }

      // Look for the smartHomeSpacesV1 component
      for (const container of scrollContainer) {
        const c = container as Record<string, unknown>;
        if (c.component === 'smartHomeSpacesV1' && c.state) {
          try {
            // Parse the state JSON string
            const state = typeof c.state === 'string' ? JSON.parse(c.state) : c.state;

            this.log.debug('Found smartHomeSpacesV1 component, state keys:', Object.keys(state as Record<string, unknown>));

            // Extract devices from rooms
            const rooms = (state as { rooms?: { rooms?: unknown[] } }).rooms?.rooms;
            if (rooms && Array.isArray(rooms)) {
              const allDevices: Record<string, unknown>[] = [];

              for (const room of rooms) {
                const r = room as Record<string, unknown>;
                if (r.items && Array.isArray(r.items)) {
                  const roomDevices = r.items.map((item: unknown) => {
                    const it = item as Record<string, unknown>;
                    return {
                      id: it.macAddress || it.name,
                      name: it.name,
                      type: this.extractDeviceType(it),
                      model: this.extractDeviceModel(it),
                      mac: it.macAddress,
                      macAddress: it.macAddress,
                      serialNumber: this.extractSerialNumber(it),
                      firmwareVersion: this.extractFirmwareVersion(it),
                      room: r.name,
                      status: it.status || [],
                      attributes: it.attributes || [],
                      action: it.action
                    };
                  });

                  allDevices.push(...roomDevices);
                  this.log.debug(`Found ${roomDevices.length} devices in room "${r.name}"`);
                }
              }

              this.log.debug(`Total devices extracted from UI response: ${allDevices.length}`);
              return allDevices;
            }
          } catch (parseError) {
            this.log.debug('Failed to parse smartHomeSpacesV1 state:', parseError instanceof Error ? parseError.message : String(parseError));
            continue;
          }
        }
      }

      this.log.debug('No smartHomeSpacesV1 component found in UI response');
      return [];
    } catch (error) {
      this.log.debug('Error extracting devices from UI response:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  private extractDeviceType(item: Record<string, unknown>): string {
    const action = item.action as Record<string, unknown> | undefined;
    if (action?.link) {
      const link = String(action.link);
      if (link.includes('type=Air+Conditioner')) {
        return 'air_conditioner';
      } else if (link.includes('type=Refrigerator')) {
        return 'refrigerator';
      }
    }

    if (typeof item.name === 'string' && item.name.toLowerCase().includes('refrigerator')) {
      return 'refrigerator';
    }

    return 'air_conditioner';
  }

  private extractSerialNumber(item: Record<string, unknown>): string | undefined {
    const info = item.info as Record<string, unknown> | undefined;
    if (info?.serialNumber) {
      return String(info.serialNumber);
    }

    const action = item.action as Record<string, unknown> | undefined;
    if (typeof action?.link === 'string') {
      const link = action.link;
      const serialMatch = link.match(/serialNum=([^&]+)/);
      if (serialMatch) {
        return decodeURIComponent(serialMatch[1]);
      }
    }

    if (typeof item.serialNumber === 'string') {
      return item.serialNumber;
    }

    return undefined;
  }

  private extractDeviceModel(item: Record<string, unknown>): string {
    const info = item.info as Record<string, unknown> | undefined;
    if (typeof info?.model === 'string') {
      return info.model;
    }

    if (typeof item.model === 'string') {
      return item.model;
    }

    const settings = item.settings as Record<string, unknown> | undefined;
    const settingsName = settings?.name as Record<string, unknown> | undefined;
    const trackingData = settingsName?.trackingData as Record<string, unknown> | undefined;
    if (trackingData?.data && typeof trackingData.data === 'object') {
      const tdData = trackingData.data as Record<string, unknown>;
      if (typeof tdData.model === 'string') {
        return tdData.model;
      }
    }

    return this.extractDeviceType(item);
  }

  private extractFirmwareVersion(item: Record<string, unknown>): string {
    const settings = item.settings as Record<string, unknown> | undefined;
    const firmware = settings?.firmware as Record<string, unknown> | undefined;
    if (typeof firmware?.value === 'string') {
      return firmware.value;
    }

    const fw = item.firmware as Record<string, unknown> | undefined;
    if (typeof fw?.value === 'string') {
      return fw.value;
    }

    if (typeof item.firmwareVersion === 'string') {
      return item.firmwareVersion;
    }

    if (typeof item.version === 'string') {
      return item.version;
    }

    const info = item.info as Record<string, unknown> | undefined;
    if (typeof info?.firmware === 'string') {
      return info.firmware;
    }

    return '1.0.0';
  }

  private isValidDeviceData(data: Record<string, unknown>[]): boolean {
    if (!Array.isArray(data) || data.length === 0) {
      return false;
    }

    const firstItem = data[0];
    if (!firstItem || typeof firstItem !== 'object') {
      return false;
    }

    const hasDeviceId = firstItem.id || firstItem.deviceId || firstItem.macAddress || firstItem.mac || firstItem.serialNumber;
    const hasDeviceName = firstItem.name || firstItem.deviceName || firstItem.model;
    const hasDeviceType = firstItem.type || firstItem.deviceType || firstItem.category;

    this.log.debug('Validating device data:', {
      hasDeviceId,
      hasDeviceName,
      hasDeviceType,
      sampleItem: firstItem
    });

    return Boolean(hasDeviceId && hasDeviceName);
  }

  async getDeviceStatus(mac: string): Promise<DeviceStatus> {
    try {
      await this.ensureValidToken();

      this.log.info(`Getting device status for ${mac}`);

      this.log.debug(`Device config endpoint: ${API_DEVICE_CONFIG.replace('{mac}', mac)}`);

      const response = await this.executeWithRateLimit(() =>
        this.http.get(
          API_DEVICE_CONFIG.replace('{mac}', mac)
        )
      );

      const trimmed = this.trimData(response.data) as Record<string, unknown>;

      if (trimmed.error) {
        throw new Error(`Failed to get device configuration: ${JSON.stringify(trimmed.error)}`);
      }

      const deviceStatus: DeviceStatus = {};
      const parsed = trimmed.error ? null : parseDeviceConfig(trimmed);

      if (parsed) {
        if (parsed.info?.model) deviceStatus.model = parsed.info.model;
        if (parsed.info?.serialNumber) deviceStatus.serialNumber = parsed.info.serialNumber;
        if (parsed.settings?.firmware?.value) deviceStatus.firmwareVersion = parsed.settings.firmware.value;
        if (parsed.settings?.name?.name) deviceStatus.deviceName = parsed.settings.name.name.trim();
        if (parsed.attributes) deviceStatus.attributes = parsed.attributes as unknown[];
      } else if (trimmed) {
        // Fallback: extract from unvalidated response
        const info = trimmed.info as Record<string, unknown> | undefined;
        if (typeof info?.model === 'string') deviceStatus.model = info.model;
        if (typeof info?.serialNumber === 'string') deviceStatus.serialNumber = info.serialNumber;
        const settings = trimmed.settings as Record<string, unknown> | undefined;
        if (settings?.firmware && typeof settings.firmware === 'object') {
          const fw = settings.firmware as Record<string, unknown>;
          if (typeof fw?.value === 'string') deviceStatus.firmwareVersion = fw.value;
        }
        if (settings?.name && typeof settings.name === 'object') {
          const n = settings.name as Record<string, unknown>;
          if (typeof n?.name === 'string') deviceStatus.deviceName = n.name.trim();
        }
        if (Array.isArray(trimmed.attributes)) deviceStatus.attributes = trimmed.attributes;
      }

      // Extract temperature from sensors
      if (parsed?.sensors?.items) {
        const tempSensor = parsed.sensors.items.find((s) => {
          const val = s.value;
          return val && (val.description === 'indoorTemperature' || val.name === '36');
        });

        if (tempSensor?.value && parsed.attributes && typeof tempSensor.value.name === 'string') {
          const sensorName = tempSensor.value.name;
          const tempAttribute = parsed.attributes.find((a) => a.name === sensorName);
          if (tempAttribute?.currentValue) {
            const currentTemp = parseFloat(tempAttribute.currentValue);
            if (!isNaN(currentTemp)) {
              deviceStatus.current_temperature = currentTemp;
              this.log.info(`Found current temperature for device ${mac}: ${currentTemp}C`);
            }
          }
        }
      }

      // Extract target temperature
      if (parsed?.temperature?.value && parsed.attributes && typeof parsed.temperature.value.name === 'string') {
        const targetName = parsed.temperature.value.name;
        const tempAttribute = parsed.attributes.find((a) => a.name === targetName);
        if (tempAttribute?.currentValue) {
          const targetTemp = parseFloat(tempAttribute.currentValue);
          if (!isNaN(targetTemp)) {
            deviceStatus.target_temperature = targetTemp;
            this.log.info(`Found target temperature for device ${mac}: ${targetTemp}C`);
          }
        }
      }

      // Extract power status
      if (parsed?.power?.value && parsed.attributes && typeof parsed.power.value.name === 'string') {
        const powerName = parsed.power.value.name;
        const powerAttribute = parsed.attributes.find((a) => a.name === powerName);
        if (powerAttribute?.currentValue) {
          const powerStatus = powerAttribute.currentValue === '1' ? 1 : 0;
          deviceStatus.status = powerStatus;
          this.log.info(`Found power status for device ${mac}: ${powerStatus ? 'ON' : 'OFF'}`);
        }
      }

      this.log.info(`Extracted initial status for device ${mac}:`, JSON.stringify(deviceStatus));
      this.log.info(`Will rely on WebSocket for further updates for device ${mac}`);

      return deviceStatus;
    } catch (error) {
      this.log.error(`Device configuration error for ${mac}:`, error instanceof Error ? error.message : String(error));

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number; data?: unknown } };
        if (axiosError.response) {
          this.log.debug('Error response status:', axiosError.response.status);
          this.log.debug('Error response data:', JSON.stringify(axiosError.response.data, null, 2));
        }
      }

      this.emit('error', `Failed to get device configuration: ${error instanceof Error ? error.message : String(error)}`);
      this.log.info(`Will rely on WebSocket updates for device ${mac}`);
      return {};
    }
  }

  // Process WebSocket status data into a format compatible with our device models
  public processWebSocketStatus(mac: string, wsData: WebSocketMessage): DeviceStatus | null {
    try {
      if (!wsData) return null;

      this.log.info(`Processing WebSocket data for ${mac}`);

      // Handle different WebSocket message formats
      if (wsData.event === "status" && wsData.macAddress === mac && wsData.payload) {
        const payload = wsData.payload as Record<string, unknown>;
        if (Array.isArray(payload.statuses)) {
          const status = (payload.statuses as unknown[])[0] as Record<string, unknown>;
          if (status?.properties) {
            this.log.info(`Found valid WebSocket properties for ${mac}`);
            return { properties: status.properties } as DeviceStatus;
          }
        }
      }

      // Handle device status event
      if (wsData.event === "deviceStatusEvent" && wsData.macAddress === mac && wsData.payload) {
        const payload = wsData.payload as Record<string, unknown>;
        this.log.info(`Received device status event for ${mac}: ${payload.status}`);
        if (payload.status === "ONLINE") {
          return { status: 1 };
        } else if (payload.status === "TURNED_OFF" || payload.status === "OFFLINE") {
          return { status: 0 };
        }
      }

      return null;
    } catch (error) {
      this.log.error('Error processing WebSocket data:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async connectWebSocket(): Promise<void> {
    return new Promise(async (resolve, reject) => {

      // Clean up any existing connection
      if (this.ws) {
        try {
          this.ws.removeAllListeners();
          if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
          }
        } catch (e) {
          this.log.info(`Error closing existing WebSocket:`, e);
        }
        this.ws = null;
      }

      try {
        this.log.info('Connecting to WebSocket...');
        this.log.info(`WebSocket status path: ${API_WEBSOCKET_STATUS}`);

        this.wsState = 'connecting';

        try {
          await this.ensureValidToken();
          this.log.info('Token validated for WebSocket connection');
        } catch (tokenError) {
          this.log.error('Failed to validate token for WebSocket:', tokenError instanceof Error ? tokenError.message : String(tokenError));
          reject(new Error(`Token validation failed: ${tokenError instanceof Error ? tokenError.message : String(tokenError)}`));
          return;
        }

        this.log.info('Access token available:', !!this.accessToken);

        const wsUrl = this.accessToken ? `${API_WEBSOCKET_STATUS}${this.accessToken}` : API_WEBSOCKET_STATUS;
        this.log.info(`WebSocket URL: ${wsUrl}`);

        const connectionTimeout = setTimeout(() => {
          this.log.info('WebSocket connection timeout after 10 seconds');
          if (this.ws) {
            this.ws.terminate();
          }
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          this.log.info('WebSocket connected successfully');
          this.isConnected = true;
          this.connectionEstablished = true;
          this.wsState = 'connected';
          this.connectionAttempts = 0;
          this.emit('connected');
          this.startHeartbeat();
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());

            if (this.config.debug) {
              this.log.debug('WebSocket message received:', message.event || message.type || 'unknown');
            }
            this.handleWebSocketMessage(message);
          } catch (error) {
            this.log.error('Failed to parse WebSocket message:', error instanceof Error ? error.message : String(error));
            this.emit('error', `Failed to parse WebSocket message: ${error instanceof Error ? error.message : String(error)}`);
          }
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(connectionTimeout);

          const reasonString = reason ? reason.toString() : 'No reason provided';
          this.log.info(`WebSocket closed. Code: ${code}, Reason: ${reasonString}`);

          let closeReason = '';
          let isAuthError = false;

          switch (code) {
            case 1000:
              closeReason = 'Normal closure';
              break;
            case 1001:
              closeReason = 'Going away';
              break;
            case 1002:
              closeReason = 'Protocol error';
              break;
            case 1003:
              closeReason = 'Unsupported data';
              break;
            case 1006:
              closeReason = 'Abnormal closure';
              break;
            case 1007:
              closeReason = 'Invalid frame payload data';
              if (reasonString.includes('Auth token not valid') || reasonString.includes('token')) {
                isAuthError = true;
                closeReason = 'Authentication token invalid';
              }
              break;
            case 1008:
              closeReason = 'Policy violation';
              break;
            case 1009:
              closeReason = 'Message too big';
              break;
            case 1011:
              closeReason = 'Internal error';
              break;
            default:
              closeReason = `Unknown close code: ${code}`;
          }
          this.log.info(`Close reason: ${closeReason}`);

          this.isConnected = false;
          this.emit('disconnected');
          this.stopHeartbeat();

          if (isAuthError) {
            this.log.info('WebSocket authentication failed. Will refresh token and retry.');

            this.refreshAccessToken().then(() => {
              this.log.info('Token refreshed after WebSocket auth failure. Scheduling reconnect.');
              this.scheduleReconnect();
            }).catch((err: unknown) => {
              this.log.error('Failed to refresh token after WebSocket auth failure:', err instanceof Error ? err.message : String(err));
              this.scheduleReconnect();
            });

            if (!this.connectionEstablished) {
              reject(new Error(`WebSocket authentication failed: ${closeReason}`));
              return;
            }
          } else if (code === 1006 && !this.connectionEstablished) {
            this.log.info('WebSocket closed before connection was established. Will retry with exponential backoff.');
            reject(new Error(`WebSocket was closed before the connection was established: ${closeReason}`));
          } else {
            this.scheduleReconnect();
          }
        });

        this.ws.on('error', (error) => {
          clearTimeout(connectionTimeout);

          this.log.error('WebSocket error:', error instanceof Error ? error.message : String(error));
          this.emit('error', `WebSocket error: ${error instanceof Error ? error.message : String(error)}`);
          this.isConnected = false;
          reject(error);
        });
      } catch (error) {
        this.log.error('Failed to connect WebSocket:', error instanceof Error ? error.message : String(error));
        this.emit('error', `Failed to connect WebSocket: ${error instanceof Error ? error.message : String(error)}`);
        reject(error);
      }
    });
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    message = this.trimData(message) as WebSocketMessage;

    this.log.info('RECEIVED WebSocket message:', message.event || message.type || 'unknown');

    if (message.event === 'status') {
      this.handleStatusEvent(message);
    } else if (message.event === 'command_response') {
      this.log.info(`Command response received for device ${message.macAddress}, trace: ${message.trace}`);
      this.log.info(`Result: ${message.errNo === 0 ? 'Success' : 'Error ' + message.errNo}`);
      this.emit('commandResponse', message);
    } else if (message.event === 'deviceStatusEvent') {
      this.log.info(`Device status event: ${(message.payload as Record<string, unknown> | undefined)?.status || 'unknown'}`);
      this.emit('deviceStatusEvent', message);
    } else if (message.type === 'device_status_update') {
      this.log.info('Legacy status update received');
      this.emit('deviceStatusUpdate', message.data);
    } else if (message.type === 'pong') {
      this.log.info('WebSocket pong received');
    } else if (message.type === 'error' || message.event === 'error') {
      this.log.info('WebSocket error message received:', JSON.stringify(message));
      this.emit('error', `WebSocket error: ${message.message || message.errorMessage || 'Unknown error'}`);
    } else {
      this.log.info('Unknown WebSocket message type:', message.type || message.event);
    }
  }

  private handleStatusEvent(message: WebSocketMessage): void {
    const { macAddress, payload } = message;

    this.log.info(`WebSocket status event for device ${macAddress}`);

    const payloadObj = payload as Record<string, unknown> | undefined;
    if (payloadObj?.statuses && Array.isArray(payloadObj.statuses)) {
      payloadObj.statuses.forEach((statusUpdate: StatusUpdate) => {
        if (statusUpdate.properties && typeof statusUpdate.properties === 'object') {
          statusUpdate.properties = this.trimData(statusUpdate.properties) as Record<string, unknown>;

          const rawStatus = { properties: statusUpdate.properties };

          const model = this.getModelByMac(macAddress!);
          const deviceStatus = this.convertPropertiesToDeviceStatus(statusUpdate.properties, model);

          if (this.config.debug) {
            const keys = Object.keys(statusUpdate.properties);
            const preview = keys.slice(0, 5).map(k => `${k}:${statusUpdate.properties![k]}`).join(',');
            this.log.debug(`WebSocket properties for ${macAddress}: ${preview}${keys.length > 5 ? '...' : ''}`);
          }

          this.emit('deviceStatusUpdate', {
            macAddress,
            status: deviceStatus,
            timestamp: statusUpdate.ts
          });

          this.emit('device_status_update', macAddress, rawStatus);
        }
      });
    } else if (message.event === 'deviceStatusEvent') {
      this.log.info(`Device status event for ${macAddress}: ${payloadObj?.status || 'unknown'}`);

      let deviceStatus = {};

      if (payloadObj?.status === 'ONLINE') {
        deviceStatus = { status: 1 };
      } else if (payloadObj?.status === 'OFFLINE' || payloadObj?.status === 'TURNED_OFF') {
        deviceStatus = { status: 0 };
      }

      this.emit('deviceStatusUpdate', {
        macAddress,
        status: deviceStatus,
        timestamp: Date.now()
      });

      this.emit('device_status_update', macAddress, deviceStatus);
    }
  }

  private convertPropertiesToDeviceStatus(properties: Record<string, unknown>, model?: string): DeviceStatus {
    const deviceStatus: DeviceStatus = {};

    // Try model-based dynamic mapping first
    try {
      const def = this.modelConfig.findDefinitionForModel(model || '');
      if (def) {
        const nameById: Record<string, string> = {};
        def.attributes.forEach((attr: ModelAttributeConfig) => {
          nameById[attr.id] = attr.name;
        });
        const handledIds = new Set(def.attributes.map((a: ModelAttributeConfig) => a.id));
        Object.entries(properties).forEach(([propertyId, value]) => {
          const canonical = nameById[propertyId];
          if (!canonical) return; // skip if not mapped in this model

          switch (canonical) {
            case 'target_temperature':
              deviceStatus.target_temperature = parseFloat(String(value));
              break;
            case 'current_temperature': {
              const current = parseFloat(String(value));
              if (!isNaN(current)) deviceStatus.current_temperature = current;
              break;
            }
            case 'mode':
              deviceStatus.mode = this.modelConfig.mapValueFromHaier(model, 'mode', String(value));
              break;
            case 'fan_mode':
              deviceStatus.fan_mode = this.modelConfig.mapValueFromHaier(model, 'fan_mode', String(value));
              break;
            case 'status':
              deviceStatus.status = String(value).trim() === '1' ? 1 : 0;
              break;
            case 'light':
              deviceStatus.light = String(value).trim() === '1';
              break;
            case 'health':
              deviceStatus.health = String(value).trim() === '1';
              break;
            case 'quiet':
              deviceStatus.quiet = String(value).trim() === '1';
              break;
            case 'turbo':
              deviceStatus.turbo = String(value).trim() === '1';
              break;
            default:
              break;
          }
        });

        // Fallback static mappings (only for IDs not covered by model config)
        Object.entries(properties).forEach(([propertyId, value]) => {
          if (handledIds.has(propertyId)) {
            return;
          }
          switch (propertyId) {
            case '12': // screenDisplayStatus (light)
              deviceStatus.light = value === '1';
              break;
            case '14': // sound signal
              deviceStatus.sound = value === '1';
              break;
            default:
              break;
          }
        });

        return deviceStatus;
      }
    } catch (_e) {
      // fallback below
    }

    // Fallback static mappings (kept for models not in config)
    Object.entries(properties).forEach(([propertyId, value]) => {
      switch (propertyId) {
        // Temperature controls
        case '0': // targetTemperature
          deviceStatus.target_temperature = parseFloat(value as string);
          break;
        case '36': // indoorTemperature (current room temperature)
          deviceStatus.current_temperature = parseFloat(value as string);
          break;
        case '38': // alternative indoor temperature sensor
          if (!deviceStatus.current_temperature) {
            deviceStatus.current_temperature = parseFloat(value as string);
          }
          break;

        // Operation modes
        case '2': // operationMode
          deviceStatus.mode = this.mapOperationMode(value as string);
          break;

        // Fan controls
        case '4': // windSpeed (fan speed)
          deviceStatus.fan_mode = this.mapFanMode(value as string);
          break;

        // Power and status
        case '21': // onOffStatus
          deviceStatus.status = value === '1' ? 1 : 0;
          break;

        // Swing controls
        case '1': // windDirectionVertical (vertical swing)
          deviceStatus.swing_mode = this.mapVerticalSwingMode(value as string);
          break;

        // Special modes
        case '16': // silentSleepStatus (comfort sleep)
          deviceStatus.preset_mode_sleep = value === '1';
          break;
        case '17': // muteStatus (quiet mode)
          deviceStatus.quiet = value === '1';
          break;
        case '18': // rapidMode (turbo)
          deviceStatus.turbo = value === '1';
          break;
        case '20': // healthMode
          deviceStatus.health = value === '1';
          break;
        case '13': // 10degreeHeatingStatus (antifreeze)
          deviceStatus.antifreeze = value === '1';
          break;
        case '6': // selfCleaning56Status (sterile cleaning)
          deviceStatus.cleaning = value === '1';
          break;
        case '31': // selfCleaningStatus (self cleaning)
          if (!deviceStatus.cleaning) {
            deviceStatus.cleaning = value === '1';
          }
          break;
        case '31': // autoHumidity (auto humidity)
          deviceStatus.autohumidity = value === '1';
          break;

        // Refrigerator-specific door statuses
        case '9': // Freezer door (0 closed, 1 open)
          deviceStatus.freezer_door_open = String(value).trim() === '1';
          break;
        case '10': // Refrigerator door (0 closed, 1 open)
          deviceStatus.refrigerator_door_open = String(value).trim() === '1';
          break;

        // Display and sound
        case '12': // screenDisplayStatus (light)
          deviceStatus.light = value === '1';
          break;
        case '14': // sound signal
          deviceStatus.sound = value === '1';
          break;

        // Additional temperature sensors
        case '1': // alternative temperature sensor
          if (!deviceStatus.current_temperature) {
            deviceStatus.current_temperature = parseFloat(value as string);
          }
          break;
        case '3': // additional temperature sensor
          if (!deviceStatus.current_temperature) {
            deviceStatus.current_temperature = parseFloat(value as string);
          }
          break;

        // Fan speed alternatives
        case '5': // alternative fan speed
          if (!deviceStatus.fan_mode) {
            deviceStatus.fan_mode = this.mapFanMode(value as string);
          }
          break;

        // Mode alternatives
        case '22': // alternative operation mode
          if (!deviceStatus.mode) {
            deviceStatus.mode = this.mapOperationMode(value as string);
          }
          break;

        default:
          // Store unknown properties for debugging
          this.log.debug(`Unknown property ID ${propertyId} with value: ${value}`);
          break;
      }
    });

    return deviceStatus;
  }

  private mapOperationMode(modeValue: string): string {
    const modeMap: { [key: string]: string } = {
      '0': 'auto',
      '1': 'cool',
      '2': 'dry',
      '4': 'heat',
      '6': 'fan_only'
    };
    return modeMap[modeValue] || 'auto';
  }

  private mapFanMode(fanValue: string): string {
    const fanMap: { [key: string]: string } = {
      '1': 'high',
      '2': 'medium',
      '3': 'low',
      '5': 'auto'
    };
    return fanMap[fanValue] || 'auto';
  }

  private mapVerticalSwingMode(swingValue: string): string {
    const swingMap: { [key: string]: string } = {
      '0': 'off',
      '1': 'up',
      '2': 'position_1',
      '3': 'down',
      '4': 'position_2',
      '5': 'position_3',
      '6': 'position_4',
      '7': 'position_5',
      '8': 'auto',
      '9': 'comfort'
    };
    return swingMap[swingValue] || 'auto';
  }

  private statusRequestTimer: NodeJS.Timeout | null = null;

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.log.info('Starting WebSocket heartbeat...');

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.isConnected) {
        try {
          this.ws.ping();
          this.log.debug('Ping sent');
        } catch (error) {
          this.log.error('Error sending ping:', error instanceof Error ? error.message : String(error));
          this.isConnected = false;
          this.scheduleReconnect();
        }
      }
    }, 30000);

    this.startStatusRequests();
  }

  private startStatusRequests(): void {
    this.stopStatusRequests();

    this.log.info('Starting periodic status requests...');

    this.initialStatusTimer = setTimeout(() => {
      if (this.ws && this.isConnected) {
        this.log.info('Sending initial status request...');
        this.requestDeviceStatuses();
      }
    }, 2000);

    this.statusRequestTimer = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.log.info('Sending periodic status request...');
        this.requestDeviceStatuses();
      } else {
        this.log.info('Skipping status request: WebSocket not connected');
      }
    }, 60000);
  }

  private stopStatusRequests(): void {
    if (this.statusRequestTimer) {
      clearInterval(this.statusRequestTimer);
      this.statusRequestTimer = null;
    }
    if (this.initialStatusTimer) {
      clearTimeout(this.initialStatusTimer);
      this.initialStatusTimer = null;
    }
  }

  private requestDeviceStatuses(): void {
    if (!this.ws || !this.isConnected) {
      this.log.info('Cannot request device statuses: WebSocket not connected');
      return;
    }

    this.log.info('Requesting status updates for all devices via WebSocket');

    try {
      const message = {
        action: 'request_status',
        trace: uuidv4(),
        timestamp: Date.now()
      };

      if (this.config.debug) {
        this.log.debug('SENDING status request:', JSON.stringify(message));
      }

      this.ws.send(JSON.stringify(message));
      this.log.info('Status request sent via WebSocket');
    } catch (error) {
      this.log.error('Error sending status request:', error instanceof Error ? error.message : String(error));
    }
  }

  public async requestAllDeviceStatuses(): Promise<void> {
    this.log.info('Requesting device statuses...');

    try {
      await this.ensureValidToken();

      if (!this.isConnected) {
        this.log.info('WebSocket not connected, connecting first...');
        await this.connectWebSocket();

        this.log.info('Waiting 1 second after connection before requesting statuses...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (this.isConnected) {
        this.requestDeviceStatuses();
      } else {
        this.log.error('Cannot request device statuses: WebSocket not connected');
        throw new Error('WebSocket not connected');
      }
    } catch (error) {
      this.log.error('Error requesting device statuses:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.closing) {
      this.log.info('Skipping reconnect - platform is shutting down');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.connectionAttempts++;

    const baseDelay = 1000;
    const maxDelay = 60000;

    let delay = Math.min(Math.pow(2, this.connectionAttempts) * baseDelay, maxDelay);

    const jitter = delay * 0.2 * (Math.random() - 0.5);
    delay = Math.max(1000, Math.floor(delay + jitter));

    this.log.info(`Scheduling reconnection attempt ${this.connectionAttempts} in ${delay}ms`);

    if (this.connectionAttempts > this.maxConnectionAttempts) {
      this.log.info(`Maximum reconnection attempts (${this.maxConnectionAttempts}) reached. Will try again in 5 minutes.`);
      this.connectionAttempts = 0;
      delay = 300000;
    }

    this.reconnectTimer = setTimeout(async () => {
      this.log.info('Attempting to reconnect...');

      try {
        await this.ensureValidToken();
        this.log.info('Token validated for reconnection');

        await this.connectWebSocket();
      } catch (error) {
        this.log.error('Reconnection failed:', error instanceof Error ? error.message : String(error));
        this.emit('error', `Reconnection failed: ${error instanceof Error ? error.message : String(error)}`);
        this.scheduleReconnect();
      }
    }, delay);
  }

  async sendCommand(deviceId: string, command: { commandName?: string; values?: string[]; type?: string; deviceId?: string; command?: unknown; timestamp?: number }): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      type: 'device_command',
      deviceId,
      command,
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Set multiple device properties in a single batch request
   */
  async setDeviceProperties(macAddress: string, properties: Array<{propertyId: string, value: string | number | boolean}>): Promise<void> {
    await this.ensureValidToken();

    if (!this.ws || !this.isConnected) {
      this.log.info('WebSocket not connected, connecting...');
      await this.connectWebSocket();
    }

    this.log.info(`Preparing batch command for device ${macAddress} with ${properties.length} properties`);

    const commands = properties.map(prop => {
      const stringValue = typeof prop.value === 'boolean' ? (prop.value ? '1' : '0') : String(prop.value);
      this.log.info(`Adding property to batch: property=${prop.propertyId}, value=${stringValue}`);

      return {
        commandName: prop.propertyId,
        value: stringValue
      };
    });

    const message = {
      action: 'operation',
      commandName: this.modelConfig.getGroupCommandNameForModel(this.getDevice(this.findDeviceIdByMac(macAddress))?.device_model),
      macAddress: macAddress,
      commands: commands,
      trace: uuidv4()
    };

    if (this.config.debug) {
      this.log.debug('SENDING WebSocket batch message:', JSON.stringify(message));
    }

    return this.sendWebSocketMessage(message);
  }

    /**
     * Set a single device property with batching support
     * @param macAddress The MAC address of the device
     * @param propertyId The ID of the property to set
     * @param value The value to set
     */
    async setDeviceProperty(macAddress: string, propertyId: string, value: string | number | boolean): Promise<void> {
      return new Promise((resolve, reject) => {
        this.addToBatch(macAddress, propertyId, value, resolve, reject);
      });
    }

    /**
     * Add a command to the batch queue for a device
     * @param macAddress The MAC address of the device
     * @param propertyId The ID of the property to set
     * @param value The value to set
     * @param resolve Promise resolve function
     * @param reject Promise reject function
     */
    private addToBatch(
      macAddress: string,
      propertyId: string,
      value: string | number | boolean,
      resolve: () => void,
      reject: (error: unknown) => void
    ): void {
      let batch = this.commandBatches.get(macAddress);

      if (!batch) {
        this.log.info(`Creating new command batch for device ${macAddress}`);
        batch = {
          commands: [],
          promises: [],
          timeout: setTimeout(() => {
            this.processBatch(macAddress);
          }, this.batchTimeout)
        };
        this.commandBatches.set(macAddress, batch);
      } else {
        this.log.info(`Adding to existing batch for device ${macAddress} (${batch.commands.length} commands)`);
      }

      const existingIndex = batch.commands.findIndex(cmd => cmd.propertyId === propertyId);
      if (existingIndex >= 0) {
        this.log.info(`Updating existing property ${propertyId} in batch (old: ${batch.commands[existingIndex].value}, new: ${value})`);
        batch.commands[existingIndex].value = value;
      } else {
        this.log.info(`Adding new property ${propertyId}=${value} to batch`);
        batch.commands.push({ propertyId, value });
      }

      batch.promises.push({ resolve, reject });
    }

    /**
     * Process and send a batch of commands for a device
     * @param macAddress The MAC address of the device
     */
    private async processBatch(macAddress: string): Promise<void> {
      const batch = this.commandBatches.get(macAddress);
      if (!batch) {
        return;
      }

      this.log.info(`Processing batch for device ${macAddress} with ${batch.commands.length} commands`);

      this.commandBatches.delete(macAddress);
      clearTimeout(batch.timeout);

      try {
        await this.setDeviceProperties(macAddress, batch.commands);

        this.log.info(`Batch completed successfully, resolving ${batch.promises.length} promises`);
        batch.promises.forEach(promise => promise.resolve());

      } catch (error) {
        this.log.error(`Batch failed, rejecting ${batch.promises.length} promises:`, error instanceof Error ? error.message : String(error));
        batch.promises.forEach(promise => promise.reject(error));
      }
    }

    /**
     * Force immediate processing of any pending batches for a device
     * @param macAddress The MAC address of the device (optional - if not provided, processes all batches)
     */
    async flushBatches(macAddress?: string): Promise<void> {
      if (macAddress) {
        if (this.commandBatches.has(macAddress)) {
          this.log.info(`Force flushing batch for device ${macAddress}`);
          await this.processBatch(macAddress);
        }
      } else {
        const deviceMacs = Array.from(this.commandBatches.keys());
        this.log.info(`Force flushing all batches (${deviceMacs.length} devices)`);

        for (const mac of deviceMacs) {
          await this.processBatch(mac);
        }
      }
    }

    /**
     * Get the current batch timeout setting
     */
    getBatchTimeout(): number {
      return this.batchTimeout;
    }

    /**
     * Set the batch timeout (time to wait before sending batched commands)
     * @param timeoutMs Timeout in milliseconds
     */
    setBatchTimeout(timeoutMs: number): void {
      this.batchTimeout = Math.max(10, Math.min(1000, timeoutMs));
      this.log.info(`Batch timeout set to ${this.batchTimeout}ms`);
    }

    /**
     * Send a WebSocket message and handle the response
     * @param message The message to send
     */
    private async sendWebSocketMessage(message: Record<string, unknown>): Promise<void> {
      try {
        if (this.ws) {
          this.ws.send(JSON.stringify(message));
          this.log.info('Command sent successfully');

          if (!this.pendingStatusRequest) {
            this.pendingStatusRequest = true;
            this.log.info('Scheduling status update request in 1 second');
            this.pendingStatusTimer = setTimeout(() => {
              this.pendingStatusRequest = false;
              this.pendingStatusTimer = null;
              this.requestDeviceStatuses();
            }, 1000);
          }
        } else {
          this.log.info('WebSocket is null, command not sent');
          throw new Error('WebSocket connection is not established');
        }
      } catch (error) {
        this.log.error('Error sending command:', error instanceof Error ? error.message : String(error));
        throw error;
      }
    }

  async disconnect(): Promise<void> {
    this.closing = true;
    this.wsState = 'disconnecting';
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Swallow close errors so cleanup always proceeds
      }
      this.ws = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.statusRequestTimer) {
      clearInterval(this.statusRequestTimer);
      this.statusRequestTimer = null;
    }

    if (this.pendingStatusTimer) {
      clearTimeout(this.pendingStatusTimer);
      this.pendingStatusTimer = null;
    }

    this.pendingStatusRequest = false;

    // Clear command batches and reject pending promises
    for (const [macAddress, batch] of this.commandBatches.entries()) {
      this.log.info(`Clearing pending batch for ${macAddress} (${batch.commands.length} commands)`);
      clearTimeout(batch.timeout);
      batch.promises.forEach(promise => promise.reject(new Error('API disconnected')));
    }
    this.commandBatches.clear();

    // Clear token refresh timer
    this.clearTokenRefreshTimer();

    this.isConnected = false;
    this.closing = false;
    this.wsState = 'closed';
  }

  async disconnectWebSocket(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Check if token needs to be refreshed soon (based on configured threshold)
   */
  needsTokenRefresh(): boolean {
    if (!this.accessToken || !this.tokenExpire) {
      return true;
    }

    // Calculate time until token expires
    const now = new Date();
    const timeUntilExpire = this.tokenExpire.getTime() - now.getTime();

    // Get threshold from config (default: 300 seconds = 5 minutes)
    const threshold = (this.config.tokenRefreshThreshold || 300) * 1000;

    // Refresh if token expires within threshold
    return timeUntilExpire < threshold;
  }

  /**
   * Check if the current access token is still valid
   */
  isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpire) {
      return false;
    }

    // Token is valid if it hasn't expired yet
    const now = new Date();
    return now < this.tokenExpire;
  }

  /**
   * Ensures the token is valid and refreshes it if needed
   */
  async ensureValidToken(): Promise<void> {
    if (!this.isTokenValid()) {
      this.log.info('Access token invalid/expired');

      if (!this.refreshToken || !this.refreshExpire || new Date() >= this.refreshExpire) {
        this.log.info('Refresh token also invalid/expired, performing full authentication');
        await this.authenticate();
        return;
      }

      this.log.info('Attempting token refresh');
      await this.refreshAccessToken();
      return;
    }

    if (this.config.tokenRefreshMode === 'disabled') {
      return;
    }

    if (this.config.tokenRefreshMode === 'auto' && this.needsTokenRefresh()) {
      this.log.info('Token about to expire, refreshing proactively (non-blocking)');
      if (!this.refreshInProgress) {
        this.refreshAccessToken().catch(err => {
          this.log.error('Background token refresh failed:', err instanceof Error ? err.message : String(err));
        });
      }
    }
  }

  isWebSocketConnected(): boolean {
    return this.ws !== null && this.isConnected;
  }

  isRefreshTokenValid(): boolean {
    if (!this.refreshToken || !this.refreshExpire) {
      return false;
    }
    return new Date() < this.refreshExpire;
  }

  getDeviceMap(): Map<string, HaierDevice> {
    return this.devices;
  }

  getDevice(deviceId: string): HaierDevice | undefined {
    return this.devices.get(deviceId);
  }

  private findDeviceIdByMac(mac: string): string {
    for (const [id, device] of this.devices.entries()) {
      if (device.mac === mac) {
        return id;
      }
    }
    return mac;
  }

  private getModelByMac(mac: string): string | undefined {
    for (const device of this.devices.values()) {
      if (device.mac === mac) {
        return device.device_model;
      }
    }
    if (this.deviceCache && Array.isArray(this.deviceCache)) {
      const found = this.deviceCache.find(d => d.mac === mac || (d as unknown as Record<string, unknown>).macAddress === mac);
      return found?.model;
    }
    return undefined;
  }

  addDevice(device: HaierDevice): void {
    this.devices.set(device.device_id, device);
  }

  removeDevice(deviceId: string): void {
    this.devices.delete(deviceId);
  }

  // Rate limiting and retry methods
  private async executeWithRateLimit<T>(
    requestFn: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    try {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      const minInterval = this.config.minRequestDelay || this.minRequestInterval;

      if (timeSinceLastRequest < minInterval) {
        await this.delay(minInterval - timeSinceLastRequest);
      }

      const shouldRandomize = this.config.requestRandomization !== false;
      if (shouldRandomize) {
        const minDelay = this.config.minRequestDelay || 100;
        const maxDelay = this.config.maxRequestDelay || 1000;
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;

        this.log.debug(`Adding random delay of ${randomDelay}ms before request`);

        await this.delay(randomDelay);
      }

      this.lastRequestTime = Date.now();
      return await requestFn();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const err = error as { response?: { status?: number } };
        if (err.response?.status === 429) {
          return await this.handleRateLimitError(requestFn, error, retryCount);
        }
      }

      if (retryCount < this.rateLimitConfig.maxRetries) {
        return await this.handleRetryError(requestFn, error, retryCount);
      }

      throw error;
    }
  }

  private async handleRateLimitError<T>(
    requestFn: () => Promise<T>,
    error: unknown,
    retryCount: number
  ): Promise<T> {
    const retryAfter = this.getRetryAfterDelay(error);

    this.log.debug(`Rate limited (429). Retry after: ${retryAfter}ms. Retry count: ${retryCount}`);

    if (retryCount >= this.rateLimitConfig.maxRetries) {
      throw new Error(`Rate limit exceeded after ${retryCount} retries. Please try again later.`);
    }

    await this.delay(retryAfter);
    return this.executeWithRateLimit(requestFn, retryCount + 1);
  }

  private async handleRetryError<T>(
    requestFn: () => Promise<T>,
    error: unknown,
    retryCount: number
  ): Promise<T> {
    const delay = this.calculateRetryDelay(retryCount);

    this.log.debug(`Request failed. Retrying in ${delay}ms. Retry count: ${retryCount + 1}`);

    await this.delay(delay);
    return this.executeWithRateLimit(requestFn, retryCount + 1);
  }

  private getRetryAfterDelay(error: unknown): number {
    if (!this.rateLimitConfig.respectRetryAfter) {
      return this.calculateRetryDelay(0);
    }

    if (error && typeof error === 'object' && 'response' in error) {
      const err = error as { response?: { headers?: Record<string, string> } };
      const retryAfter = err.response?.headers?.['retry-after'];
      if (retryAfter) {
        const retryAfterNum = parseInt(retryAfter, 10);
        if (!isNaN(retryAfterNum)) {
          return retryAfterNum * 1000;
        } else {
          const retryAfterDate = new Date(retryAfter);
          if (!isNaN(retryAfterDate.getTime())) {
            const now = Date.now();
            const delay = retryAfterDate.getTime() - now;
            return Math.max(delay, 1000);
          }
        }
      }
    }

    return this.calculateRetryDelay(0);
  }

  private calculateRetryDelay(retryCount: number): number {
    const delay = Math.min(
      this.rateLimitConfig.baseDelay * Math.pow(2, retryCount),
      this.rateLimitConfig.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = delay * this.rateLimitConfig.jitter * Math.random();
    return delay + jitter;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public method to configure rate limiting
  configureRateLimit(config: Partial<{
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    jitter: number;
    respectRetryAfter: boolean;
    queueRetries: boolean;
  }>): void {
    this.rateLimitConfig = { ...this.rateLimitConfig, ...config };

    this.log.debug('Rate limiting configuration updated:', this.rateLimitConfig);
  }

  // Get current rate limiting status
  getRateLimitStatus(): {
    queueLength: number;
    isProcessingQueue: boolean;
    lastRequestTime: number;
    config: {
      maxRetries: number;
      baseDelay: number;
      maxDelay: number;
      jitter: number;
      respectRetryAfter: boolean;
      queueRetries: boolean;
    };
  } {
    return {
      queueLength: this.requestQueue.length,
      isProcessingQueue: this.isProcessingQueue,
      lastRequestTime: this.lastRequestTime,
      config: { ...this.rateLimitConfig }
    };
  }
}
