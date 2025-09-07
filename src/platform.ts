import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic
} from 'homebridge';
import { HaierAPI } from './haier-api';
import { DeviceFactory } from './device-factory';
import { HaierEvoAccessory } from './accessories/haier-evo-accessory';
import { HaierEvoConfig } from './types';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

export class HaierEvoPlatform {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly log: Logger;

  private haierAPI: HaierAPI;
  private accessories: Map<string, HaierEvoAccessory> = new Map();
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly platform: DynamicPlatformPlugin,
    private readonly config: PlatformConfig,
    private readonly api: API,
    log: Logger
  ) {
    this.log = log;
    this.log.debug('Initializing Haier Evo platform');

    // Validate configuration
    this.validateConfig();

    // Initialize Haier API
    this.haierAPI = new HaierAPI(this.config as unknown as HaierEvoConfig);

    // Set up event listeners
    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    try {
      this.log.info('Initializing Haier Evo platform...');

      // Authenticate with Haier API
      await this.haierAPI.authenticate();
      this.log.info('Successfully authenticated with Haier API');

      // Discover devices
      await this.discoverDevices();

      // Connect WebSocket for real-time updates
      try {
        this.log.debug('Connecting to WebSocket for real-time updates...');
        await this.haierAPI.connectWebSocket();

        // Request initial status updates for all devices
        this.log.debug('Requesting initial device statuses...');
        await this.haierAPI.requestAllDeviceStatuses();
      } catch (wsError) {
        // Don't fail initialization if WebSocket fails
        this.log.warn(`WebSocket connection failed: ${wsError}. Will retry automatically.`);
        this.log.warn('Plugin will continue to function with HTTP fallback until WebSocket connects.');
      }

      // Start refresh timer
      this.startRefreshTimer();

      this.log.info('Haier Evo platform initialized successfully');
    } catch (error) {
      this.log.error('Failed to initialize platform:', error);
      throw error;
    }
  }

  private validateConfig(): void {
    const requiredFields = ['email', 'password', 'region'];
    for (const field of requiredFields) {
      if (!this.config[field]) {
        throw new Error(`Missing required configuration field: ${field}`);
      }
    }

    // Validate region
    const validRegions = ['ru', 'kz', 'by'];
    if (!validRegions.includes(this.config.region.toLowerCase())) {
      throw new Error(`Invalid region: ${this.config.region}. Must be one of: ${validRegions.join(', ')}`);
    }
  }

  private setupEventListeners(): void {
    // Handle API events
    this.haierAPI.on('authenticated', () => {
      this.log.info('Successfully authenticated with Haier API');
    });

    this.haierAPI.on('tokenRefreshed', () => {
      this.log.debug('Access token refreshed successfully');
    });

    this.haierAPI.on('tokenRefreshFailed', (reason) => {
      this.log.warn('Token refresh failed:', reason);
    });

    this.haierAPI.on('connected', () => {
      this.log.info('WebSocket connected');
    });

    this.haierAPI.on('disconnected', () => {
      this.log.warn('WebSocket disconnected');
    });

    this.haierAPI.on('error', (error) => {
      this.log.error('Haier API error:', error);
    });

    // Listen for both event types for compatibility
    this.haierAPI.on('deviceStatusUpdate', (data) => {
      this.log.debug('Received deviceStatusUpdate event');
      this.handleDeviceStatusUpdate(data);
    });

    // This is the new event emitted by the WebSocket handler
    this.haierAPI.on('device_status_update', (macAddress, status) => {
      this.log.debug(`Received device_status_update event for ${macAddress}`);
      this.handleDeviceStatusUpdate({
        macAddress,
        status
      });
    });

    this.haierAPI.on('commandResponse', (data) => {
      this.handleCommandResponse(data);
    });
  }

  private async discoverDevices(): Promise<void> {
    try {
      this.log.info('Discovering Haier Evo devices...');

      // Ensure token is valid before making API calls
      try {
        await this.haierAPI.ensureValidToken();
      } catch (tokenError) {
        this.log.error('Failed to ensure valid token during device discovery:', tokenError);
        // Continue anyway, the API call might still work with the current token
      }

      const devices = await this.haierAPI.fetchDevices();

      // Ensure devices is an array
      if (!Array.isArray(devices)) {
        this.log.warn(`Expected devices array but got: ${typeof devices}`, devices);
        this.log.info('No devices found or unexpected response format');
        return;
      }

      this.log.info(`Found ${devices.length} devices in Haier account`);

      if (devices.length === 0) {
        this.log.info('No devices found in the account');
        return;
      }

      // Apply device filtering
      const filteredDevices = this.filterDevices(devices);
      this.log.info(`${filteredDevices.length} of ${devices.length} devices passed filtering criteria`);

      // Fetch device configurations and create accessories with complete data
      for (const deviceInfo of filteredDevices) {
        try {
          if (!deviceInfo || typeof deviceInfo !== 'object') {
            this.log.warn('Invalid device info:', deviceInfo);
            continue;
          }

          if (!deviceInfo.id || !deviceInfo.name) {
            this.log.warn('Device missing required fields (id or name):', deviceInfo);
            continue;
          }

          // Device info is already complete from fetchDevices()
          await this.createAccessory(deviceInfo);
        } catch (error) {
          this.log.error(`Failed to create accessory for device ${deviceInfo?.name || 'unknown'}:`, error);
        }
      }
    } catch (error) {
      this.log.error('Failed to discover devices:', error);
      throw error;
    }
  }

  /**
   * Filter devices based on configuration criteria
   */
  private filterDevices(devices: any[]): any[] {
    const config = this.config as unknown as HaierEvoConfig;

    // If no filtering options are specified, return all devices
    if (!config.includeDevices &&
        !config.excludeDevices &&
        !config.includeDeviceTypes &&
        !config.excludeDeviceTypes &&
        !config.includeNamePattern &&
        !config.excludeNamePattern) {
      return devices;
    }

    return devices.filter(device => {
      // Skip invalid devices
      if (!device || !device.id || !device.name || !device.type) {
        return false;
      }

      // Check include devices list (if specified, only these devices will be included)
      if (config.includeDevices && Array.isArray(config.includeDevices) && config.includeDevices.length > 0) {
        if (!config.includeDevices.includes(device.id)) {
          this.log.debug(`Device ${device.name} (${device.id}) excluded: not in includeDevices list`);
          return false;
        }
      }

      // Check exclude devices list
      if (config.excludeDevices && Array.isArray(config.excludeDevices) && config.excludeDevices.includes(device.id)) {
        this.log.debug(`Device ${device.name} (${device.id}) excluded: in excludeDevices list`);
        return false;
      }

      // Check device type inclusion
      if (config.includeDeviceTypes && Array.isArray(config.includeDeviceTypes) && config.includeDeviceTypes.length > 0) {
        const deviceType = device.type.toUpperCase();
        const includeTypes = config.includeDeviceTypes.map(type => type.toUpperCase());

        if (!includeTypes.some(type => deviceType.includes(type))) {
          this.log.debug(`Device ${device.name} (${device.id}) excluded: type ${device.type} not in includeDeviceTypes list`);
          return false;
        }
      }

      // Check device type exclusion
      if (config.excludeDeviceTypes && Array.isArray(config.excludeDeviceTypes)) {
        const deviceType = device.type.toUpperCase();
        const excludeTypes = config.excludeDeviceTypes.map(type => type.toUpperCase());

        if (excludeTypes.some(type => deviceType.includes(type))) {
          this.log.debug(`Device ${device.name} (${device.id}) excluded: type ${device.type} in excludeDeviceTypes list`);
          return false;
        }
      }

      // Check name pattern inclusion
      if (config.includeNamePattern) {
        try {
          const includeRegex = new RegExp(config.includeNamePattern, 'i');
          if (!includeRegex.test(device.name)) {
            this.log.debug(`Device ${device.name} (${device.id}) excluded: name doesn't match includeNamePattern`);
            return false;
          }
        } catch (error) {
          this.log.error(`Invalid includeNamePattern regex: ${config.includeNamePattern}`, error);
        }
      }

      // Check name pattern exclusion
      if (config.excludeNamePattern) {
        try {
          const excludeRegex = new RegExp(config.excludeNamePattern, 'i');
          if (excludeRegex.test(device.name)) {
            this.log.debug(`Device ${device.name} (${device.id}) excluded: name matches excludeNamePattern`);
            return false;
          }
        } catch (error) {
          this.log.error(`Invalid excludeNamePattern regex: ${config.excludeNamePattern}`, error);
        }
      }

      // Device passed all filters
      this.log.debug(`Device ${device.name} (${device.id}, type: ${device.type}) included after filtering`);
      return true;
    });
  }

  private async createAccessory(deviceInfo: any): Promise<void> {
    const uuid = this.api.hap.uuid.generate(deviceInfo.id);

    // Check if accessory already exists
    const existingAccessory = (this.platform as any).accessories.find((accessory: any) => accessory.UUID === uuid);

    if (existingAccessory) {
      this.log.info(`Restoring existing accessory: ${deviceInfo.name}`);

      // Update the accessory with new device info
      existingAccessory.context.device = deviceInfo;
      existingAccessory.displayName = deviceInfo.name;

      // Create the accessory wrapper
      const accessory = new HaierEvoAccessory(this, existingAccessory, deviceInfo);
      this.accessories.set(deviceInfo.id, accessory);

      // Set up device info update listener
      this.setupDeviceInfoListener(deviceInfo.id, accessory);

      // Update the accessory
      this.api.updatePlatformAccessories([existingAccessory]);
    } else {
      this.log.info(`Creating new accessory: ${deviceInfo.name}`);

      // Create new accessory
      const accessory = new this.api.platformAccessory(deviceInfo.name, uuid);
      accessory.context.device = deviceInfo;

      // Create the accessory wrapper
      const haierAccessory = new HaierEvoAccessory(this, accessory, deviceInfo);
      this.accessories.set(deviceInfo.id, haierAccessory);

      // Set up device info update listener
      this.setupDeviceInfoListener(deviceInfo.id, haierAccessory);

      // Register the accessory
      this.api.registerPlatformAccessories(PLATFORM_NAME, PLATFORM_NAME, [accessory]);
    }
  }

  private setupDeviceInfoListener(deviceId: string, accessory: HaierEvoAccessory): void {
    // Get the device instance from the API
    const device = this.haierAPI.getDevice(deviceId);
    if (device) {
      // Listen for device info updates
      device.on('deviceInfoUpdated', (info: any) => {
        this.handleDeviceInfoUpdate(deviceId, info, accessory);
      });
    }
  }

  private handleDeviceInfoUpdate(deviceId: string, info: any, accessory: HaierEvoAccessory): void {
    this.log.info(`Received device info update for ${deviceId}:`, JSON.stringify(info));

    // Update the device info with the new information
    const currentDeviceInfo = accessory.accessory.context.device;
    const updatedDeviceInfo = {
      ...currentDeviceInfo,
      model: info.model || currentDeviceInfo.model,
      serialNumber: info.serialNumber || currentDeviceInfo.serialNumber,
      firmwareVersion: info.firmwareVersion || currentDeviceInfo.firmwareVersion
    };

    // Update the name if provided and different
    if (info.deviceName && info.deviceName !== currentDeviceInfo.name) {
      updatedDeviceInfo.name = info.deviceName;
      this.log.info(`Device name updated from "${currentDeviceInfo.name}" to "${info.deviceName}"`);
    }

    // Update the accessory context
    accessory.accessory.context.device = updatedDeviceInfo;

    // Update the accessory with the new device info
    accessory.updateDeviceInfo(updatedDeviceInfo);

    // Update the platform accessory
    this.api.updatePlatformAccessories([accessory.accessory]);
  }

  private handleDeviceStatusUpdate(data: any): void {
    this.log.debug('Received device status update:', JSON.stringify(data));

    // Handle different data formats
    let deviceId: string;
    let status: any;

    if (data.macAddress) {
      // New format from WebSocket
      deviceId = data.macAddress;
      status = data.status;

      this.log.debug(`WebSocket status update for device ${deviceId}`);
    } else if (data.deviceId) {
      // Old format
      deviceId = data.deviceId;
      status = data;

      this.log.debug(`Legacy status update for device ${deviceId}`);
    } else {
      this.log.warn('Received device status update with unknown format:', data);
      return;
    }

    // Devices themselves are subscribed to API events and will emit 'statusUpdated'.
    // We avoid forwarding here to prevent duplicate updates/logs.
    const accessory = this.accessories.get(deviceId);
    if (!accessory) {
      this.log.warn(`No accessory found for device ID ${deviceId}`);
    }
  }

  private handleCommandResponse(data: any): void {
    const accessory = this.accessories.get(data.deviceId);
    if (accessory) {
      accessory.handleCommandResponse(data);
    }
  }

  private startRefreshTimer(): void {
    const refreshInterval = (this.config as unknown as HaierEvoConfig).refreshInterval || 300; // Default: 5 minutes

    this.refreshTimer = setInterval(async () => {
      try {
        await this.refreshDevices();
      } catch (error) {
        this.log.error('Failed to refresh devices:', error);
      }
    }, refreshInterval * 1000);
  }

    private async refreshDevices(): Promise<void> {
    try {
      this.log.debug('Refreshing device status...');

      // Ensure token is valid before making API calls
      try {
        await this.haierAPI.ensureValidToken();
      } catch (tokenError) {
        this.log.error('Failed to refresh token:', tokenError);
        // Continue anyway, the API call might still work with the current token
      }

      // Get updated device list
      const devices = await this.haierAPI.fetchDevices();

      // Ensure devices is an array
      if (!Array.isArray(devices)) {
        this.log.warn(`Expected devices array but got: ${typeof devices} during refresh`);
        return;
      }

      // Apply device filtering
      const filteredDevices = this.filterDevices(devices);

      // Create a map of filtered devices for quick lookup
      const filteredDeviceMap = new Map(
        filteredDevices
          .filter(d => d && d.id)
          .map(d => [d.id, d])
      );

      // Update existing accessories that are still in the filtered list
      for (const [deviceId, accessory] of this.accessories) {
        const deviceInfo = filteredDeviceMap.get(deviceId);
        if (deviceInfo) {
          // Device is still in the filtered list, update it
          accessory.updateDeviceInfo(deviceInfo);
        } else {
          // Device is no longer in the filtered list, remove it
          this.log.info(`Removing accessory ${accessory.displayName} (${deviceId}) - no longer matches filters or not found in account`);
          this.accessories.delete(deviceId);
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory.accessory]);
        }
      }

      // Check for new devices that match our filters
      for (const deviceInfo of filteredDevices) {
        if (deviceInfo && deviceInfo.id && !this.accessories.has(deviceInfo.id)) {
          // This is a new device that matches our filters, create it
          this.log.info(`Found new device that matches filters: ${deviceInfo.name} (${deviceInfo.id})`);
          await this.createAccessory(deviceInfo);
        }
      }

      // Request status updates for all devices after refresh
      try {
        this.log.debug('Requesting status updates for all devices after refresh');
        await this.haierAPI.requestAllDeviceStatuses();
      } catch (statusError) {
        this.log.error('Failed to request device status updates:', statusError);
      }
    } catch (error) {
      this.log.error('Failed to refresh devices:', error);
    }
  }

  public   getHaierAPI(): HaierAPI {
    return this.haierAPI;
  }

  // Expose a safe way for accessories to notify Homebridge about structure changes
  public updatePlatformAccessory(accessory: PlatformAccessory): void {
    this.api.updatePlatformAccessories([accessory]);
  }

  getConfig(): HaierEvoConfig {
    return this.config as unknown as HaierEvoConfig;
  }

  public getAccessory(deviceId: string): HaierEvoAccessory | undefined {
    return this.accessories.get(deviceId);
  }

  public destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Destroy all accessories
    for (const accessory of this.accessories.values()) {
      accessory.destroy();
    }
    this.accessories.clear();

    // Disconnect API
    this.haierAPI.disconnect();
  }
}
