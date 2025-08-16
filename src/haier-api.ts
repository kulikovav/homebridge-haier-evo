import axios, { AxiosInstance, AxiosResponse } from 'axios';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  HaierEvoConfig,
  AuthResponse,
  DeviceInfo,
  DeviceStatus,
  HaierDevice,
  HaierAC,
  HaierRefrigerator
} from './types';
import {
  API_PATH,
  API_LOGIN,
  API_TOKEN_REFRESH,
  API_DEVICES,
  API_DEVICE_CONFIG,
  API_WEBSOCKET_STATUS,
  API_TIMEOUT
} from './constants';

export class HaierAPI extends EventEmitter {
  private http: AxiosInstance;
  private ws: WebSocket | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpire: Date | null = null;
  private refreshExpire: Date | null = null;

  // Device cache to reduce API calls
  private deviceCache: DeviceInfo[] | null = null;
  private deviceCacheTimestamp: number = 0;
  private deviceCacheTTL: number = 300000; // 5 minutes by default
  private devices: Map<string, HaierDevice> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private connectionEstablished = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;

  // Token refresh tracking
  private refreshFailureCount: number = 0;
  private maxRefreshFailures: number = 3;
  private refreshInProgress: boolean = false;
  private refreshPromise: Promise<void> | null = null;

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
    request: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    retryCount: number;
    maxRetries: number;
  }> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private minRequestInterval = 100; // Minimum 100ms between requests

  constructor(private config: HaierEvoConfig) {
    super();

    // Set device cache TTL from config if provided
    if (this.config.deviceCacheTTL !== undefined) {
      this.deviceCacheTTL = this.config.deviceCacheTTL * 1000; // Convert to milliseconds
    }

    // Get or generate device ID
    if (!this.config.deviceId) {
      // Try to get stored device ID first
      const storedDeviceId = this.getStoredDeviceId();
      if (storedDeviceId) {
        this.config.deviceId = storedDeviceId;
        if (this.config.debug) {
          console.log(`Using stored device ID: ${this.config.deviceId}`);
        }
      } else {
        // Generate new device ID
        this.config.deviceId = this.generateDeviceId();
        this.storeDeviceId(this.config.deviceId);
        if (this.config.debug) {
          console.log(`Generated and stored new device ID: ${this.config.deviceId}`);
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

        if (this.accessToken) {
          config.headers['X-Auth-Token'] = this.accessToken;
        }

        // Debug logging for headers
        if (this.config.debug) {
          console.log(`Request to ${config.url}:`);
          console.log('Method:', config.method?.toUpperCase());
          console.log('Headers:', {
            'Device-Id': config.headers['Device-Id'],
            'X-Auth-Token': config.headers['X-Auth-Token'] ? '***' : 'None',
            'User-Agent': config.headers['User-Agent'],
            'Accept': config.headers['Accept'],
            'Accept-Language': config.headers['Accept-Language'],
            'Content-Type': config.headers['Content-Type']
          });
          if (config.data) {
            console.log('Request body:', JSON.stringify(config.data, null, 2));
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
          console.log(`Response from ${response.config.url}:`);
          console.log('Status:', response.status);
          console.log('Status text:', response.statusText);
          console.log('Response headers:', response.headers);
        }
        return response;
      },
      async (error) => {
        if (this.config.debug) {
          console.log(`Response error from ${error.config?.url}:`);
          console.log('Error status:', error.response?.status);
          console.log('Error status text:', error.response?.statusText);
          console.log('Error response headers:', error.response?.headers);
          if (error.response?.data) {
            console.log('Error response data:', JSON.stringify(error.response.data, null, 2));
          }
        }

        // Handle 429 rate limiting errors - let the rate limiting wrapper handle these
        if (error.response?.status === 429) {
          if (this.config.debug) {
            console.log('Rate limited (429) in interceptor. Passing to rate limiting handler.');
          }
          return Promise.reject(error);
        }

        // Skip token refresh for the refresh token endpoint itself to avoid infinite loops
        const isRefreshEndpoint = error.config?.url?.includes('/auth/refresh');

        if (error.response?.status === 401 && !isRefreshEndpoint) {
          if (this.config.debug) {
            console.log('401 Unauthorized error, attempting token refresh');
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
              console.log('Token refresh failed in interceptor, rejecting request:', refreshError);
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
      // Try to get device ID from a simple file storage
      const fs = require('fs');
      const path = require('path');
      const homeDir = require('os').homedir();
      const configDir = path.join(homeDir, '.homebridge');
      const deviceIdFile = path.join(configDir, 'haier-evo-device-id.txt');

      if (fs.existsSync(deviceIdFile)) {
        const deviceId = fs.readFileSync(deviceIdFile, 'utf8').trim();
        if (deviceId && deviceId.length > 0) {
          return deviceId;
        }
      }
    } catch (error) {
      // If file operations fail, just return null
      if (this.config.debug) {
        console.log('Could not read stored device ID:', error);
      }
    }
    return null;
  }

  private storeDeviceId(deviceId: string): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const homeDir = require('os').homedir();
      const configDir = path.join(homeDir, '.homebridge');
      const deviceIdFile = path.join(configDir, 'haier-evo-device-id.txt');

      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(deviceIdFile, deviceId);
      if (this.config.debug) {
        console.log(`Device ID stored to: ${deviceIdFile}`);
      }
    } catch (error) {
      if (this.config.debug) {
        console.log('Could not store device ID:', error);
      }
    }
  }

  async authenticate(): Promise<void> {
    try {
      if (this.config.debug) {
        console.log(`Authenticating with region: ${this.config.region}`);
        console.log(`Login endpoint: ${API_LOGIN.replace('{region}', this.config.region)}`);
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
        console.log('Authentication response received:');
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        console.log('Full authentication response:', JSON.stringify(response.data, null, 2));
      }

      if (response.data.error) {
        throw new Error(`Authentication failed: ${JSON.stringify(response.data.error)}`);
      }

      const { token } = response.data.data;
      this.accessToken = token.accessToken;
      this.refreshToken = token.refreshToken;
      this.tokenExpire = new Date(token.expire);
      this.refreshExpire = new Date(token.refreshExpire);

      if (this.config.debug) {
        console.log('Authentication successful:');
        console.log('Access token length:', this.accessToken?.length || 0);
        console.log('Refresh token length:', this.refreshToken?.length || 0);
        console.log('Token expires:', this.tokenExpire);
        console.log('Refresh expires:', this.refreshExpire);
      }

      this.emit('authenticated');
    } catch (error) {
      if (this.config.debug) {
        console.log('Authentication error:', error);
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as any;
          if (axiosError.response) {
            console.log('Error response status:', axiosError.response.status);
            console.log('Error response data:', JSON.stringify(axiosError.response.data, null, 2));
          }
        }
      }
      this.emit('error', `Authentication failed: ${error}`);
      throw error;
    }
  }

  async refreshAccessToken(): Promise<void> {
    // If a refresh is already in progress, return the existing promise
    if (this.refreshInProgress && this.refreshPromise) {
      if (this.config.debug) {
        console.log('Token refresh already in progress, waiting for completion');
      }
      return this.refreshPromise;
    }

    // No refresh token available, need to authenticate
    if (!this.refreshToken) {
      if (this.config.debug) {
        console.log('No refresh token available, performing full authentication');
      }
      return this.authenticate();
    }

    // Start a new refresh operation
    this.refreshInProgress = true;
    this.refreshPromise = this._refreshAccessToken();

    try {
      await this.refreshPromise;
    } finally {
      this.refreshInProgress = false;
      this.refreshPromise = null;
    }
  }

  private async _refreshAccessToken(): Promise<void> {
    try {
      if (this.config.debug) {
        console.log('Refreshing access token...');
        console.log(`Refresh endpoint: ${API_TOKEN_REFRESH.replace('{region}', this.config.region)}`);
        console.log(`Current refresh failure count: ${this.refreshFailureCount}/${this.maxRefreshFailures}`);
      }

      // If we've exceeded the maximum number of refresh failures, perform a full authentication
      if (this.refreshFailureCount >= this.maxRefreshFailures) {
        if (this.config.debug) {
          console.log(`Maximum refresh failures (${this.maxRefreshFailures}) reached, performing full authentication`);
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
        console.log('Token refresh response received:');
        console.log('Response status:', response.status);
        console.log('Full refresh response:', JSON.stringify(response.data, null, 2));
      }

      if (response.data.error) {
        this.refreshFailureCount++;
        this.emit('tokenRefreshFailed', `Token refresh failed: ${JSON.stringify(response.data.error)}`);
        throw new Error(`Token refresh failed: ${JSON.stringify(response.data.error)}`);
      }

      const { token } = response.data.data;
      this.accessToken = token.accessToken;
      this.refreshToken = token.refreshToken;
      this.tokenExpire = new Date(token.expire);
      this.refreshExpire = new Date(token.refreshExpire);

      // Reset failure count on success
      this.refreshFailureCount = 0;

      if (this.config.debug) {
        console.log('Token refresh successful:');
        console.log('New access token length:', this.accessToken?.length || 0);
        console.log('New token expires:', this.tokenExpire);
      }

      this.emit('tokenRefreshed');
    } catch (error: any) {
      this.refreshFailureCount++;

      if (this.config.debug) {
        console.log(`Token refresh error (failure ${this.refreshFailureCount}/${this.maxRefreshFailures}):`, error);
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as any;
          if (axiosError.response) {
            console.log('Error response status:', axiosError.response.status);
            console.log('Error response data:', JSON.stringify(axiosError.response.data, null, 2));
          }
        }
      }

      // Check if this is an authentication error (401)
      if (error.response?.status === 401) {
        this.emit('tokenRefreshFailed', 'Refresh token expired or invalid');

        // If we haven't exceeded max failures, wait and try again with exponential backoff
        if (this.refreshFailureCount < this.maxRefreshFailures) {
          const backoffDelay = Math.min(1000 * Math.pow(2, this.refreshFailureCount), 30000);

          if (this.config.debug) {
            console.log(`Waiting ${backoffDelay}ms before retrying token refresh`);
          }

          await this.delay(backoffDelay);
          return this._refreshAccessToken();
        } else {
          // Max failures reached, try full authentication
          if (this.config.debug) {
            console.log('Maximum refresh failures reached, performing full authentication');
          }
          this.refreshFailureCount = 0;
          return this.authenticate();
        }
      }

      this.emit('error', `Token refresh failed: ${error}`);
      throw error;
    }
  }

    async fetchDevices(): Promise<DeviceInfo[]> {
    const now = Date.now();
    const timestamp = new Date().toLocaleString();

    // Check if we have a valid cache
    if (this.deviceCache && (now - this.deviceCacheTimestamp < this.deviceCacheTTL)) {
      console.log(`[${timestamp}] [Haier Evo] Using cached device list (age: ${Math.round((now - this.deviceCacheTimestamp) / 1000)}s, TTL: ${Math.round(this.deviceCacheTTL / 1000)}s)`);
      return this.deviceCache;
    }

    console.log(`[${timestamp}] [Haier Evo] Device cache expired or not available, fetching fresh data`);

    // Use the API_DEVICES endpoint which returns UI presentation data
    // We have special parsing logic to extract devices from this response
    const endpoints = [
      API_DEVICES
    ];

    for (const endpoint of endpoints) {
      try {
        const url = endpoint.replace('{region}', this.config.region);

        // Add randomization to the URL to avoid caching on server side
        const randomParam = `&_=${now}_${Math.floor(Math.random() * 1000000)}`;
        const urlWithRandom = url + randomParam;

        if (this.config.debug) {
          console.log(`[${timestamp}] [Haier Evo] Trying endpoint: ${urlWithRandom}`);
        } else {
          console.log(`[${timestamp}] [Haier Evo] Fetching device list...`);
        }

        // Add random delay before request (between 100ms and 1000ms)
        const randomDelay = Math.floor(Math.random() * 900) + 100;
        await this.delay(randomDelay);

        const response = await this.executeWithRateLimit(() => this.http.get(urlWithRandom));

        // Debug logging for response structure
        if (this.config.debug) {
          console.log(`[${timestamp}] [Haier Evo] Response from ${url}:`, {
            hasData: !!response.data,
            dataKeys: response.data ? Object.keys(response.data) : 'No data',
            hasError: !!response.data?.error,
            errorDetails: response.data?.error || 'No error',
            dataType: typeof response.data?.data,
            dataIsArray: Array.isArray(response.data?.data),
            dataLength: Array.isArray(response.data?.data) ? response.data.data.length : 'Not an array'
          });

          // Log full server response for debugging (truncated)
          const responseStr = JSON.stringify(response.data);
          console.log(`[${timestamp}] [Haier Evo] Response size: ${responseStr.length} bytes`);
          if (responseStr.length > 1000) {
            console.log(`[${timestamp}] [Haier Evo] Response data (truncated): ${responseStr.substring(0, 1000)}...`);
          } else {
            console.log(`[${timestamp}] [Haier Evo] Response data: ${responseStr}`);
          }
        }

        if (response.data.error) {
          if (this.config.debug) {
            console.log(`[${timestamp}] [Haier Evo] Endpoint ${url} returned error:`, response.data.error);
          }
          continue; // Try next endpoint
        }

        // Check if this response contains actual device data
        let devices: any[] = [];

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
          if (this.config.debug) {
            console.log(`[${timestamp}] [Haier Evo] Found ${devices.length} devices from endpoint: ${url}`);
          } else {
            console.log(`[${timestamp}] [Haier Evo] Found ${devices.length} devices`);
          }

          // Update cache
          this.deviceCache = devices;
          this.deviceCacheTimestamp = now;

          return devices;
        } else {
          if (this.config.debug) {
            console.log(`[${timestamp}] [Haier Evo] Endpoint ${url} returned data but no valid devices found`);
          }
          continue; // Try next endpoint
        }

      } catch (error) {
        const errorTimestamp = new Date().toLocaleString();
        console.error(`[${errorTimestamp}] [Haier Evo] Endpoint ${endpoint} failed:`, error instanceof Error ? error.message : String(error));

        // If we have a cache, use it even if expired
        if (this.deviceCache) {
          console.log(`[${errorTimestamp}] [Haier Evo] Using cached device list due to fetch error (cache age: ${Math.round((now - this.deviceCacheTimestamp) / 1000)}s)`);
          return this.deviceCache;
        }

        continue; // Try next endpoint
      }
    }

    // If we get here, no endpoint returned valid device data
    if (this.config.debug) {
      console.log(`[${timestamp}] [Haier Evo] No valid device data found from any endpoint`);
    }

    // If we have a cache, use it even if expired as a fallback
    if (this.deviceCache) {
      console.log(`[${timestamp}] [Haier Evo] Using cached device list as fallback (cache age: ${Math.round((now - this.deviceCacheTimestamp) / 1000)}s)`);
      return this.deviceCache;
    }

    return [];
  }

  /**
   * Utility function to recursively trim string values in objects and arrays
   * @param data The data to trim
   * @returns The trimmed data
   */
  private trimData(data: any): any {
    if (typeof data === 'string') {
      return data.trim();
    } else if (Array.isArray(data)) {
      return data.map(item => this.trimData(item));
    } else if (data !== null && typeof data === 'object') {
      const result: Record<string, any> = {};
      for (const key of Object.keys(data)) {
        result[key] = this.trimData(data[key]);
      }
      return result;
    }
    return data;
  }

  private extractDevicesFromUIResponse(data: any): any[] {
    try {
      // Trim data before processing
      data = this.trimData(data);

      if (this.config.debug) {
        console.log('Extracting devices from UI response structure');
      }

      const scrollContainer = data.presentation?.layout?.scrollContainer;
      if (!Array.isArray(scrollContainer)) {
        if (this.config.debug) {
          console.log('No scrollContainer array found in UI response');
        }
        return [];
      }

      // Look for the smartHomeSpacesV1 component (container ID: 71dd1158-e2b7-48ed-8d51-8ee7cdc81cb2)
      for (const container of scrollContainer) {
        if (container.component === 'smartHomeSpacesV1' && container.state) {
          try {
            // Parse the state JSON string
            const state = typeof container.state === 'string' ? JSON.parse(container.state) : container.state;

            if (this.config.debug) {
              console.log('Found smartHomeSpacesV1 component, state keys:', Object.keys(state));
            }

            // Extract devices from rooms
            if (state.rooms?.rooms && Array.isArray(state.rooms.rooms)) {
              const allDevices: any[] = [];

              for (const room of state.rooms.rooms) {
                if (room.items && Array.isArray(room.items)) {
                  // Transform room items to device format
                  const roomDevices = room.items.map((item: any) => ({
                    id: item.macAddress || item.name, // Use MAC address as ID if available
                    name: item.name,
                    type: this.extractDeviceType(item),
                    model: this.extractDeviceType(item), // Use device type as model for now
                    mac: item.macAddress, // Add mac field for BaseDevice compatibility
                    macAddress: item.macAddress,
                    serialNumber: this.extractSerialNumber(item),
                    room: room.name,
                    status: item.status || [],
                    action: item.action
                  }));

                  allDevices.push(...roomDevices);

                  if (this.config.debug) {
                    console.log(`Found ${roomDevices.length} devices in room "${room.name}"`);
                  }
                }
              }

              if (this.config.debug) {
                console.log(`Total devices extracted from UI response: ${allDevices.length}`);
              }

              return allDevices;
            }
          } catch (parseError) {
            if (this.config.debug) {
              console.log('Failed to parse smartHomeSpacesV1 state:', parseError);
            }
            continue;
          }
        }
      }

      if (this.config.debug) {
        console.log('No smartHomeSpacesV1 component found in UI response');
      }
      return [];
    } catch (error) {
      if (this.config.debug) {
        console.log('Error extracting devices from UI response:', error);
      }
      return [];
    }
  }

  private extractDeviceType(item: any): string {
    // Extract device type from action link or name
    if (item.action?.link) {
      const link = item.action.link;
      if (link.includes('type=Air+Conditioner')) {
        return 'air_conditioner';
      } else if (link.includes('type=Refrigerator')) {
        return 'refrigerator';
      }
    }

    // Fallback to name-based detection
    if (item.name?.toLowerCase().includes('refrigerator')) {
      return 'refrigerator';
    }

    // Default to air_conditioner for unknown types (most common)
    return 'air_conditioner';
  }

  private extractSerialNumber(item: any): string | undefined {
    // Extract serial number from action link
    if (item.action?.link) {
      const link = item.action.link;
      const serialMatch = link.match(/serialNum=([^&]+)/);
      if (serialMatch) {
        return decodeURIComponent(serialMatch[1]);
      }
    }
    return undefined;
  }

  private isValidDeviceData(data: any[]): boolean {
    if (!Array.isArray(data) || data.length === 0) {
      return false;
    }

    // Check if the first item has device-like properties
    const firstItem = data[0];
    if (!firstItem || typeof firstItem !== 'object') {
      return false;
    }

    // Look for common device identifiers - updated to handle MAC addresses
    const hasDeviceId = firstItem.id || firstItem.deviceId || firstItem.macAddress || firstItem.mac || firstItem.serialNumber;
    const hasDeviceName = firstItem.name || firstItem.deviceName || firstItem.model;
    const hasDeviceType = firstItem.type || firstItem.deviceType || firstItem.category;

    if (this.config.debug) {
      console.log('Validating device data:', {
        hasDeviceId,
        hasDeviceName,
        hasDeviceType,
        sampleItem: firstItem
      });
    }

    return hasDeviceId && hasDeviceName;
  }

      async getDeviceStatus(mac: string): Promise<DeviceStatus> {
    try {
      // Ensure token is valid before making the request
      await this.ensureValidToken();

      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Getting initial configuration for device ${mac}`);

      if (this.config.debug) {
        console.log(`Device config endpoint: ${API_DEVICE_CONFIG.replace('{mac}', mac)}`);
      }

      const response = await this.executeWithRateLimit(() =>
        this.http.get(
          API_DEVICE_CONFIG.replace('{mac}', mac)
        )
      );

      // Trim all string values in the response data
      if (response.data) {
        response.data = this.trimData(response.data);
      }

      if (this.config.debug) {
        console.log(`Device status response for ${mac}:`);
        console.log('Response status:', response.status);
        console.log('Full status response:', JSON.stringify(response.data, null, 2));
      }

      if (response.data.error) {
        throw new Error(`Failed to get device configuration: ${JSON.stringify(response.data.error)}`);
      }

      // Extract useful information from the response, even if data field is empty
      const deviceStatus: DeviceStatus = {};

      // Extract attributes from the response if available
      if (response.data.attributes && Array.isArray(response.data.attributes)) {
        deviceStatus.attributes = response.data.attributes;
      }

      // Extract temperature information from sensors if available
      if (response.data.sensors && response.data.sensors.items) {
        const tempSensor = response.data.sensors.items.find((item: any) =>
          item.value && (item.value.description === "indoorTemperature" || item.value.name === "36"));

        if (tempSensor) {
          console.log(`[${new Date().toLocaleString()}] [Haier Evo] Found temperature sensor for device ${mac}`);

          // Look for the current temperature in attributes
          const tempAttribute = response.data.attributes?.find((attr: any) =>
            attr.name === tempSensor.value.name);

          if (tempAttribute && tempAttribute.currentValue) {
            const currentTemp = parseFloat(tempAttribute.currentValue);
            if (!isNaN(currentTemp)) {
              deviceStatus.current_temperature = currentTemp;
              console.log(`[${new Date().toLocaleString()}] [Haier Evo] Found current temperature for device ${mac}: ${currentTemp}°C`);
            }
          }
        }
      }

      // Extract target temperature if available
      if (response.data.temperature && response.data.temperature.value) {
        const tempAttribute = response.data.attributes?.find((attr: any) =>
          attr.name === response.data.temperature.value.name);

        if (tempAttribute && tempAttribute.currentValue) {
          const targetTemp = parseFloat(tempAttribute.currentValue);
          if (!isNaN(targetTemp)) {
            deviceStatus.target_temperature = targetTemp;
            console.log(`[${new Date().toLocaleString()}] [Haier Evo] Found target temperature for device ${mac}: ${targetTemp}°C`);
          }
        }
      }

      // Extract power status if available
      if (response.data.power && response.data.power.value) {
        const powerAttribute = response.data.attributes?.find((attr: any) =>
          attr.name === response.data.power.value.name);

        if (powerAttribute && powerAttribute.currentValue) {
          const powerStatus = powerAttribute.currentValue === "1" ? 1 : 0;
          deviceStatus.status = powerStatus;
          console.log(`[${new Date().toLocaleString()}] [Haier Evo] Found power status for device ${mac}: ${powerStatus ? 'ON' : 'OFF'}`);
        }
      }

      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Extracted initial status for device ${mac}:`, JSON.stringify(deviceStatus));
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Will rely on WebSocket for further updates for device ${mac}`);

      return deviceStatus;
    } catch (error) {
      console.error(`[${new Date().toLocaleString()}] [Haier Evo] Device configuration error for ${mac}:`, error);

      if (this.config.debug) {
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as any;
          if (axiosError.response) {
            console.log('Error response status:', axiosError.response.status);
            console.log('Error response data:', JSON.stringify(axiosError.response.data, null, 2));
          }
        }
      }

      this.emit('error', `Failed to get device configuration: ${error}`);
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Will rely on WebSocket updates for device ${mac}`);
      return {}; // Return empty object, WebSocket will provide updates
    }
  }

  // Process WebSocket status data into a format compatible with our device models
  public processWebSocketStatus(mac: string, wsData: any): DeviceStatus | null {
    try {
      if (!wsData) return null;

      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Processing WebSocket data for ${mac}`);

      // Handle different WebSocket message formats
      if (wsData.event === "status" && wsData.macAddress === mac && wsData.payload && wsData.payload.statuses) {
        const status = wsData.payload.statuses[0];
        if (status && status.properties) {
          console.log(`[${new Date().toLocaleString()}] [Haier Evo] Found valid WebSocket properties for ${mac}`);
          return { properties: status.properties } as DeviceStatus;
        }
      }

      // Handle device status event
      if (wsData.event === "deviceStatusEvent" && wsData.macAddress === mac && wsData.payload) {
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] Received device status event for ${mac}: ${wsData.payload.status}`);
        // Convert online/offline status to a device status format
        if (wsData.payload.status === "ONLINE") {
          return { status: 1 };
        } else if (wsData.payload.status === "TURNED_OFF" || wsData.payload.status === "OFFLINE") {
          return { status: 0 };
        }
      }

      return null;
    } catch (error) {
      console.error(`[${new Date().toLocaleString()}] [Haier Evo] Error processing WebSocket data:`, error);
      return null;
    }
  }

  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timestamp = new Date().toLocaleString();

      // Clean up any existing connection
      if (this.ws) {
        try {
          this.ws.removeAllListeners();
          if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
          }
        } catch (e) {
          console.log(`[${timestamp}] [Haier Evo] Error closing existing WebSocket:`, e);
        }
        this.ws = null;
      }

      try {
        console.log(`[${timestamp}] [Haier Evo] 🔌 Connecting to WebSocket...`);
        console.log(`[${timestamp}] [Haier Evo] WebSocket status path: ${API_WEBSOCKET_STATUS}`);
        console.log(`[${timestamp}] [Haier Evo] Access token available:`, !!this.accessToken);

        // Connect to WebSocket with JWT token in the path
        const wsUrl = this.accessToken ? `${API_WEBSOCKET_STATUS}${this.accessToken}` : API_WEBSOCKET_STATUS;
        console.log(`[${timestamp}] [Haier Evo] WebSocket URL: ${wsUrl}`);

        // Set a connection timeout
        const connectionTimeout = setTimeout(() => {
          console.log(`[${timestamp}] [Haier Evo] ⏱️ WebSocket connection timeout after 10 seconds`);
          if (this.ws) {
            this.ws.terminate(); // Force close the socket
          }
          reject(new Error('WebSocket connection timeout'));
        }, 10000); // 10 second timeout

        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          console.log(`[${timestamp}] [Haier Evo] ✅ WebSocket connected successfully`);
          this.isConnected = true;
          this.connectionEstablished = true;
          this.connectionAttempts = 0; // Reset connection attempts on successful connection
          this.emit('connected');
          this.startHeartbeat();
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            const msgTimestamp = new Date().toLocaleString();
            if (this.config.debug) {
              console.log(`[${msgTimestamp}] [Haier Evo] WebSocket message received:`, JSON.stringify(message, null, 2));
            }
            this.handleWebSocketMessage(message);
          } catch (error) {
            console.error(`[${timestamp}] [Haier Evo] Failed to parse WebSocket message:`, error);
            this.emit('error', `Failed to parse WebSocket message: ${error}`);
          }
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(connectionTimeout);
          const closeTimestamp = new Date().toLocaleString();
          console.log(`[${closeTimestamp}] [Haier Evo] 🔌 WebSocket closed. Code: ${code}, Reason: ${reason || 'No reason provided'}`);

          // Log specific close codes for debugging
          let closeReason = '';
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
          console.log(`[${closeTimestamp}] [Haier Evo] Close reason: ${closeReason}`);

          this.isConnected = false;
          this.emit('disconnected');
          this.stopHeartbeat();

          // If the connection was never established (e.g., during initialization)
          if (code === 1006 && !this.connectionEstablished) {
            console.log(`[${closeTimestamp}] [Haier Evo] ⚠️ WebSocket closed before connection was established. Will retry with exponential backoff.`);
            reject(new Error(`WebSocket was closed before the connection was established: ${closeReason}`));
          } else {
            this.scheduleReconnect();
          }
        });

        this.ws.on('error', (error) => {
          clearTimeout(connectionTimeout);
          const errorTimestamp = new Date().toLocaleString();
          console.error(`[${errorTimestamp}] [Haier Evo] ❌ WebSocket error:`, error);
          this.emit('error', `WebSocket error: ${error}`);
          this.isConnected = false;
          reject(error);
        });
      } catch (error) {
        console.error(`[${timestamp}] [Haier Evo] ❌ Failed to connect WebSocket:`, error);
        this.emit('error', `Failed to connect WebSocket: ${error}`);
        reject(error);
      }
    });
  }



  private handleWebSocketMessage(message: any): void {
    // First, trim all string values in the message
    message = this.trimData(message);

    // Log all WebSocket messages with timestamp
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] ⬇️ RECEIVED WebSocket message:`);
    console.log(JSON.stringify(message, null, 2));

    // Handle events based on the actual WebSocket sample format
    if (message.event === 'status') {
      // Status update event
      this.handleStatusEvent(message);
    } else if (message.event === 'command_response') {
      // Command response event
      console.log(`[${timestamp}] [Haier Evo] 📝 Command response received for device ${message.macAddress}, trace: ${message.trace}`);
      console.log(`[${timestamp}] [Haier Evo] Result: ${message.errNo === 0 ? '✅ Success' : '❌ Error ' + message.errNo}`);
      this.emit('commandResponse', message);
    } else if (message.event === 'deviceStatusEvent') {
      // Device status event (online/offline)
      console.log(`[${timestamp}] [Haier Evo] 🔌 Device status event: ${message.payload?.status || 'unknown'}`);
      this.emit('deviceStatusEvent', message);
    } else if (message.type === 'device_status_update') {
      // Legacy format
      console.log(`[${timestamp}] [Haier Evo] 📊 Legacy status update received`);
      this.emit('deviceStatusUpdate', message.data);
    } else if (message.type === 'pong') {
      console.log(`[${timestamp}] [Haier Evo] 🏓 WebSocket pong received`);
    } else if (message.type === 'error' || (message.event === 'error')) {
      console.log(`[${timestamp}] [Haier Evo] ❌ WebSocket error message received:`, JSON.stringify(message, null, 2));
      this.emit('error', `WebSocket error: ${message.message || message.errorMessage || 'Unknown error'}`);
    } else {
      console.log(`[${timestamp}] [Haier Evo] ❓ Unknown WebSocket message type:`, message.type || message.event);
    }
  }

  private handleStatusEvent(message: any): void {
    const { macAddress, payload } = message;

    console.log(`[${new Date().toLocaleString()}] [Haier Evo] WebSocket status event for device ${macAddress}`);

    if (payload?.statuses && Array.isArray(payload.statuses)) {
      payload.statuses.forEach((statusUpdate: any) => {
        // Trim any string values in the properties
        if (statusUpdate.properties && typeof statusUpdate.properties === 'object') {
          // Apply trimming to properties
          statusUpdate.properties = this.trimData(statusUpdate.properties);

          // First, emit the raw properties for direct use
          const rawStatus = { properties: statusUpdate.properties };

          // Then convert to our standard format
          const deviceStatus = this.convertPropertiesToDeviceStatus(statusUpdate.properties);

          console.log(`[${new Date().toLocaleString()}] [Haier Evo] WebSocket properties for ${macAddress}:`,
            JSON.stringify(Object.keys(statusUpdate.properties).slice(0, 5).map(k => `${k}:${statusUpdate.properties[k]}`)) +
            (Object.keys(statusUpdate.properties).length > 5 ? '...' : ''));

          // Emit standard event
          this.emit('deviceStatusUpdate', {
            macAddress,
            status: deviceStatus,
            timestamp: statusUpdate.ts
          });

          // Also emit direct status update for devices to consume
          this.emit('device_status_update', macAddress, rawStatus);
        }
      });
    } else if (message.event === 'deviceStatusEvent') {
      // Handle device status events (ONLINE, OFFLINE, TURNED_OFF)
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Device status event for ${macAddress}: ${payload?.status || 'unknown'}`);

      let deviceStatus = {};

      if (payload?.status === 'ONLINE') {
        deviceStatus = { status: 1 };
      } else if (payload?.status === 'OFFLINE' || payload?.status === 'TURNED_OFF') {
        deviceStatus = { status: 0 };
      }

      // Emit both event types for compatibility
      this.emit('deviceStatusUpdate', {
        macAddress,
        status: deviceStatus,
        timestamp: Date.now()
      });

      this.emit('device_status_update', macAddress, deviceStatus);
    }
  }

  private convertPropertiesToDeviceStatus(properties: any): any {
    const deviceStatus: any = {};

    // Map property IDs to device attributes based on ac.data configuration
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
          if (this.config.debug) {
            console.log(`Unknown property ID ${propertyId} with value: ${value}`);
          }
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
    // Stop any existing heartbeat
    this.stopHeartbeat();

    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 🏓 Starting WebSocket heartbeat...`);

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.isConnected) {
        try {
          this.ws.ping();
          if (this.config.debug) {
            console.log(`[${new Date().toLocaleString()}] [Haier Evo] 🏓 Ping sent`);
          }
        } catch (error) {
          console.error(`[${new Date().toLocaleString()}] [Haier Evo] ❌ Error sending ping:`, error);
          // If ping fails, attempt to reconnect
          this.isConnected = false;
          this.scheduleReconnect();
        }
      }
    }, 30000); // Send ping every 30 seconds

    // Also start periodic status requests
    this.startStatusRequests();
  }

  private startStatusRequests(): void {
    // Clear any existing timer
    this.stopStatusRequests();

    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 🔄 Starting periodic status requests...`);

    // First request immediately after connection (with a small delay)
    setTimeout(() => {
      if (this.ws && this.isConnected) {
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] 🔄 Sending initial status request...`);
        this.requestDeviceStatuses();
      }
    }, 2000); // 2 second delay for initial request

    // Then request status updates for all devices every 60 seconds
    this.statusRequestTimer = setInterval(() => {
      if (this.ws && this.isConnected) {
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] 🔄 Sending periodic status request...`);
        this.requestDeviceStatuses();
      } else {
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] ⚠️ Skipping status request: WebSocket not connected`);
      }
    }, 60000); // Request status every 60 seconds
  }

  private stopStatusRequests(): void {
    if (this.statusRequestTimer) {
      clearInterval(this.statusRequestTimer);
      this.statusRequestTimer = null;
    }
  }

    private requestDeviceStatuses(): void {
    const timestamp = new Date().toLocaleString();

    if (!this.ws || !this.isConnected) {
      console.log(`[${timestamp}] [Haier Evo] ❌ Cannot request device statuses: WebSocket not connected`);
      return;
    }

    console.log(`[${timestamp}] [Haier Evo] 🔍 Requesting status updates for all devices via WebSocket`);

    try {
      // Send a status request message for all devices
      // Based on the sample, we should use a similar format as commands
      const message = {
        action: 'request_status',
        trace: uuidv4(),
        timestamp: Date.now()
      };

      // Log the raw message being sent
      console.log(`[${timestamp}] [Haier Evo] ⬆️ SENDING status request:`);
      console.log(JSON.stringify(message, null, 2));

      this.ws.send(JSON.stringify(message));
      console.log(`[${timestamp}] [Haier Evo] ✅ Status request sent via WebSocket`);
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error sending status request:`, error);
    }
  }

  // Public method to manually request device statuses
  public async requestAllDeviceStatuses(): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 🔄 Requesting device statuses...`);

    try {
      if (!this.isConnected) {
        console.log(`[${timestamp}] [Haier Evo] 🔌 WebSocket not connected, connecting first...`);
        await this.connectWebSocket();

        // Wait a moment after connection before sending requests
        console.log(`[${timestamp}] [Haier Evo] ⏱️ Waiting 1 second after connection before requesting statuses...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Check again if connected (might have failed to connect)
      if (this.isConnected) {
        this.requestDeviceStatuses();
      } else {
        console.error(`[${timestamp}] [Haier Evo] ❌ Cannot request device statuses: WebSocket not connected`);
        throw new Error('WebSocket not connected');
      }
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error requesting device statuses:`, error);
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Increment connection attempts
    this.connectionAttempts++;

    // Calculate backoff time with exponential backoff and jitter
    const baseDelay = 1000; // 1 second base
    const maxDelay = 60000; // 60 seconds max

    // Exponential backoff: 2^attempts * baseDelay
    let delay = Math.min(Math.pow(2, this.connectionAttempts) * baseDelay, maxDelay);

    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    delay = Math.max(1000, Math.floor(delay + jitter));

    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 🔄 Scheduling reconnection attempt ${this.connectionAttempts} in ${delay}ms`);

    // Check if we've exceeded max attempts
    if (this.connectionAttempts > this.maxConnectionAttempts) {
      console.log(`[${timestamp}] [Haier Evo] ⚠️ Maximum reconnection attempts (${this.maxConnectionAttempts}) reached. Will try again in 5 minutes.`);
      this.connectionAttempts = 0; // Reset counter
      delay = 300000; // 5 minutes
    }

    this.reconnectTimer = setTimeout(() => {
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] 🔌 Attempting to reconnect...`);
      this.connectWebSocket().catch(error => {
        console.error(`[${new Date().toLocaleString()}] [Haier Evo] ❌ Reconnection failed:`, error);
        this.emit('error', `Reconnection failed: ${error}`);
        // Schedule next attempt
        this.scheduleReconnect();
      });
    }, delay);
  }

  async sendCommand(deviceId: string, command: any): Promise<void> {
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
   * Send a device property command via WebSocket
   * @param macAddress The MAC address of the device
   * @param propertyId The property ID to change
   * @param value The new value for the property
   * @returns Promise that resolves when the command is sent
   */
    /**
     * Set multiple device properties in a single batch request
     * @param macAddress The MAC address of the device
     * @param properties Array of property objects with propertyId and value
     */
    async setDeviceProperties(macAddress: string, properties: Array<{propertyId: string, value: string | number | boolean}>): Promise<void> {
      const timestamp = new Date().toLocaleString();

      if (!this.ws || !this.isConnected) {
        console.log(`[${timestamp}] [Haier Evo] 🔌 WebSocket not connected, connecting...`);
        await this.connectWebSocket();
      }

      console.log(`[${timestamp}] [Haier Evo] 🔧 Preparing batch command for device ${macAddress} with ${properties.length} properties`);

      // Convert properties to the format expected by the API
      const commands = properties.map(prop => {
        // Convert boolean values to string (API expects "1"/"0" for boolean values)
        const stringValue = typeof prop.value === 'boolean' ? (prop.value ? "1" : "0") : String(prop.value);
        console.log(`[${timestamp}] [Haier Evo] 🔧 Adding property to batch: property=${prop.propertyId}, value=${stringValue}`);

        return {
          commandName: prop.propertyId,
          value: stringValue
        };
      });

      // Format based on the actual WebSocket sample
      const message = {
        action: "operation",
        commandName: "4", // Group command for setting parameters
        macAddress: macAddress,
        commands: commands,
        trace: uuidv4()
      };

      // Log the raw message being sent
      console.log(`[${timestamp}] [Haier Evo] ⬆️ SENDING WebSocket batch message:`);
      console.log(JSON.stringify(message, null, 2));

      return this.sendWebSocketMessage(message);
    }

    /**
     * Set a single device property
     * @param macAddress The MAC address of the device
     * @param propertyId The ID of the property to set
     * @param value The value to set
     */
    async setDeviceProperty(macAddress: string, propertyId: string, value: string | number | boolean): Promise<void> {
      // Simply call the batch method with a single property
      return this.setDeviceProperties(macAddress, [{ propertyId, value }]);
    }

    /**
     * Send a WebSocket message and handle the response
     * @param message The message to send
     */
    private async sendWebSocketMessage(message: any): Promise<void> {
      const timestamp = new Date().toLocaleString();

      try {
        if (this.ws) {
          this.ws.send(JSON.stringify(message));
          console.log(`[${timestamp}] [Haier Evo] ✅ Command sent successfully`);

          // Request updated status after sending command
          console.log(`[${timestamp}] [Haier Evo] 🔄 Scheduling status update request in 1 second`);
          setTimeout(() => {
            this.requestDeviceStatuses();
          }, 1000);
        } else {
          console.log(`[${timestamp}] [Haier Evo] ❌ WebSocket is null, command not sent`);
          throw new Error('WebSocket connection is not established');
        }
      } catch (error) {
        console.error(`[${timestamp}] [Haier Evo] ❌ Error sending command:`, error);
        throw error;
      }
    }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
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

    this.isConnected = false;
  }

  async disconnectWebSocket(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpire) {
      return false;
    }
    return new Date() < this.tokenExpire;
  }

  /**
   * Check if token needs to be refreshed soon (within the next 5 minutes)
   */
  needsTokenRefresh(): boolean {
    if (!this.accessToken || !this.tokenExpire) {
      return true;
    }

    // Calculate time until token expires
    const now = new Date();
    const timeUntilExpire = this.tokenExpire.getTime() - now.getTime();

    // Refresh if token expires within 5 minutes
    return timeUntilExpire < 5 * 60 * 1000;
  }

  /**
   * Ensures the token is valid and refreshes it if needed
   */
  async ensureValidToken(): Promise<void> {
    if (!this.isTokenValid() || this.needsTokenRefresh()) {
      if (this.config.debug) {
        console.log('Token needs refresh, refreshing...');
      }
      await this.refreshAccessToken();
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
      // Ensure minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Get minimum request interval from config or use default
      const minInterval = this.config.minRequestDelay || this.minRequestInterval;

      if (timeSinceLastRequest < minInterval) {
        await this.delay(minInterval - timeSinceLastRequest);
      }

      // Add random delay if randomization is enabled (default to true if not specified)
      const shouldRandomize = this.config.requestRandomization !== false;
      if (shouldRandomize) {
        const minDelay = this.config.minRequestDelay || 100;
        const maxDelay = this.config.maxRequestDelay || 1000;
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;

        if (this.config.debug) {
          console.log(`[${new Date().toLocaleString()}] [Haier Evo] Adding random delay of ${randomDelay}ms before request`);
        }

        await this.delay(randomDelay);
      }

      this.lastRequestTime = Date.now();
      return await requestFn();
    } catch (error: any) {
      // Handle 429 rate limiting errors
      if (error.response?.status === 429) {
        return await this.handleRateLimitError(requestFn, error, retryCount);
      }

      // Handle other errors with retry logic
      if (retryCount < this.rateLimitConfig.maxRetries) {
        return await this.handleRetryError(requestFn, error, retryCount);
      }

      throw error;
    }
  }

  private async handleRateLimitError<T>(
    requestFn: () => Promise<T>,
    error: any,
    retryCount: number
  ): Promise<T> {
    const retryAfter = this.getRetryAfterDelay(error);

    if (this.config.debug) {
      console.log(`Rate limited (429). Retry after: ${retryAfter}ms. Retry count: ${retryCount}`);
    }

    if (retryCount >= this.rateLimitConfig.maxRetries) {
      throw new Error(`Rate limit exceeded after ${retryCount} retries. Please try again later.`);
    }

    // Wait for the specified retry delay
    await this.delay(retryAfter);

    // Retry the request
    return this.executeWithRateLimit(requestFn, retryCount + 1);
  }

  private async handleRetryError<T>(
    requestFn: () => Promise<T>,
    error: any,
    retryCount: number
  ): Promise<T> {
    const delay = this.calculateRetryDelay(retryCount);

    if (this.config.debug) {
      console.log(`Request failed. Retrying in ${delay}ms. Retry count: ${retryCount + 1}`);
    }

    await this.delay(delay);

    // Retry the request
    return this.executeWithRateLimit(requestFn, retryCount + 1);
  }

  private getRetryAfterDelay(error: any): number {
    if (!this.rateLimitConfig.respectRetryAfter) {
      return this.calculateRetryDelay(0);
    }

    const retryAfter = error.response?.headers?.['retry-after'];
    if (retryAfter) {
      // Parse Retry-After header (can be seconds or HTTP date)
      const retryAfterNum = parseInt(retryAfter, 10);
      if (!isNaN(retryAfterNum)) {
        // Retry-After is in seconds
        return retryAfterNum * 1000;
      } else {
        // Retry-After is an HTTP date
        const retryAfterDate = new Date(retryAfter);
        if (!isNaN(retryAfterDate.getTime())) {
          const now = Date.now();
          const delay = retryAfterDate.getTime() - now;
          return Math.max(delay, 1000); // Minimum 1 second
        }
      }
    }

    // Fallback to calculated delay
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

    if (this.config.debug) {
      console.log('Rate limiting configuration updated:', this.rateLimitConfig);
    }
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
