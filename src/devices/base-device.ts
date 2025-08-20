import { EventEmitter } from 'events';
import { DeviceInfo, DeviceStatus, HaierDevice } from '../types';
import { HaierAPI } from '../haier-api';

export abstract class BaseDevice extends EventEmitter implements HaierDevice {
  public device_id: string;
  public device_name: string;
  public device_model: string;
  public device_type: string;
  public mac: string;
  public serialNumber?: string;
  public firmwareVersion?: string;
  public status: number = 0;
  public available: boolean = false;
  public current_temperature: number = 20;
  public target_temperature: number = 20; // Default to a safer value that works for both AC and refrigerators
  public mode: string = 'auto';
  public fan_mode: string = 'auto';
  public swing_mode: string = 'off';
  public max_temperature: number = 30;
  public min_temperature: number = 16;
  public quiet: boolean = false;
  public turbo: boolean = false;
  public comfort: boolean = false;
  public health: boolean = false;
  public light: boolean = false;
  public sound: boolean = false;
  public antifreeze: boolean = false;
  public cleaning: boolean = false;
  public autohumidity: boolean = false;
  public eco_sensor: string = 'off';
  public preset_mode_sleep: boolean = false;
  public preset_mode_boost: boolean = false;

  protected api: HaierAPI;
  protected statusUpdateTimer: ReturnType<typeof setInterval> | null = null;
  protected lastStatusUpdate: Date = new Date();

  constructor(deviceInfo: DeviceInfo, api: HaierAPI) {
    super();

    this.device_id = deviceInfo.id;
    this.device_name = deviceInfo.name;
    this.device_model = deviceInfo.model;
    this.device_type = deviceInfo.type;
    this.mac = deviceInfo.mac;
    this.serialNumber = deviceInfo.serialNumber;
    this.firmwareVersion = deviceInfo.firmwareVersion;
    this.api = api;

    // Don't start status updates immediately - let subclasses set temperature limits first
    // this.startStatusUpdates();
  }

    protected startStatusUpdates(): void {
    // We no longer poll the API_DEVICE_CONFIG endpoint - instead we rely on WebSocket updates
    console.log(`[${new Date().toLocaleString()}] [Haier Evo] Device ${this.device_name} will receive status updates via WebSocket`);

    // Set up WebSocket event listeners in the API client using the handler methods
    this.api.on('device_status_update', this.handleDeviceStatusUpdate);

    // Also listen for the legacy event format
    this.api.on('deviceStatusUpdate', this.handleLegacyStatusUpdate);

    // Do an initial status fetch to get the current state
    this.fetchInitialStatus();
  }

  public initializeStatusUpdates(): void {
    // Start status updates - called by subclasses after setting temperature limits
    this.startStatusUpdates();
  }

  private skipInitialFetch: boolean = false;

  public setSkipInitialFetch(skip: boolean = true): void {
    this.skipInitialFetch = skip;
  }

  public updateDeviceInfo(info: { model?: string; serialNumber?: string; firmwareVersion?: string; deviceName?: string }): void {
    console.log(`[${new Date().toLocaleString()}] [Haier Evo] Updating device info for ${this.device_name}`);

    if (info.model !== undefined) {
      this.device_model = info.model;
    }

    if (info.serialNumber !== undefined) {
      this.serialNumber = info.serialNumber;
    }

    if (info.firmwareVersion !== undefined) {
      this.firmwareVersion = info.firmwareVersion;
    }

    if (info.deviceName !== undefined) {
      this.device_name = info.deviceName;
    }

    console.log(`[${new Date().toLocaleString()}] [Haier Evo] Device info updated: model=${this.device_model}, serial=${this.serialNumber}, firmware=${this.firmwareVersion}`);
  }

    // Fetch initial configuration once at startup
  protected async fetchInitialStatus(): Promise<void> {
    try {
      // Skip if initial fetch was already done at platform level
      if (this.skipInitialFetch) {
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] Skipping initial config fetch for ${this.device_name} - already done at platform level`);
        return;
      }

      // Check if MAC address is available before making API call
      if (!this.mac) {
        this.emit('warning', `Device ${this.device_id} has no MAC address, skipping initial configuration fetch`);
        return;
      }

      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Fetching initial configuration for device ${this.device_name} (${this.mac})`);
      const config = await this.api.getDeviceStatus(this.mac);

      // Update device with any extracted configuration data
      if (Object.keys(config).length > 0) {
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] Applying initial configuration for device ${this.device_name}`);

        // Extract key properties for logging
        if (config.attributes && Array.isArray(config.attributes)) {
          // Log temperature values if found
          const tempAttr = config.attributes.find(attr =>
            attr && typeof attr === 'object' && 'name' in attr && attr.name === '36' && 'currentValue' in attr
          );
          if (tempAttr) {
            console.log(`[${new Date().toLocaleString()}] [Haier Evo] Found current temperature for device ${this.mac}: ${tempAttr.currentValue}°C`);
          }

          const targetTempAttr = config.attributes.find(attr =>
            attr && typeof attr === 'object' && 'name' in attr && attr.name === '0' && 'currentValue' in attr
          );
          if (targetTempAttr) {
            console.log(`[${new Date().toLocaleString()}] [Haier Evo] Found target temperature for device ${this.mac}: ${targetTempAttr.currentValue}°C`);
          }

          const powerAttr = config.attributes.find(attr =>
            attr && typeof attr === 'object' && 'name' in attr && attr.name === '21' && 'currentValue' in attr
          );
          if (powerAttr) {
            const powerStatus = powerAttr.currentValue === '1' ? 'ON' : 'OFF';
            console.log(`[${new Date().toLocaleString()}] [Haier Evo] Found power status for device ${this.mac}: ${powerStatus}`);
          }
        }

        // Log the extracted initial status for debugging
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] Extracted initial status for device ${this.mac}:`, JSON.stringify(config));

        // Update the device status with the configuration data
        this.updateFromStatus(config);
        this.lastStatusUpdate = new Date();

        // Check if we have device information updates from API_DEVICE_CONFIG
        if (config.model || config.serialNumber || config.firmwareVersion || config.deviceName) {
          console.log(`[${new Date().toLocaleString()}] [Haier Evo] Found device information updates for ${this.device_name}`);

          // Emit device info update to notify platform
          this.emit('deviceInfoUpdated', {
            mac: this.mac,
            model: config.model,
            serialNumber: config.serialNumber,
            firmwareVersion: config.firmwareVersion,
            deviceName: config.deviceName
          });
        }

        // Ensure the statusUpdated event is emitted to notify the accessory
        this.emit('statusUpdated', config);

        // Force a full status update to ensure all characteristics are updated
        setTimeout(() => {
          console.log(`[${new Date().toLocaleString()}] [Haier Evo] Triggering additional status update for ${this.device_name}`);
          this.emit('statusUpdated', this.toJSON());
        }, 1000);
      } else {
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] No initial configuration data available for ${this.device_name}`);
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] Will wait for WebSocket updates for device ${this.device_name}`);
      }
    } catch (error) {
      console.error(`[${new Date().toLocaleString()}] [Haier Evo] Failed to fetch initial device configuration: ${String(error)}`);
      this.emit('error', `Failed to fetch initial device configuration: ${String(error)}`);
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Will wait for WebSocket updates for device ${this.device_name}`);
    }
  }

  public updateFromStatus(status: DeviceStatus): void {
    console.log(`[${new Date().toLocaleString()}] [Haier Evo] Updating status for device ${this.device_name} (${this.device_type})`);

    const changes: Record<string, { old: any, new: any }> = {};

    if (status.current_temperature !== undefined) {
      // Validate current temperature is reasonable (not below -50 or above 100)
      if (status.current_temperature >= -50 && status.current_temperature <= 100) {
        if (this.current_temperature !== status.current_temperature) {
          changes.current_temperature = { old: this.current_temperature, new: status.current_temperature };
        }
        this.current_temperature = status.current_temperature;
      } else {
        console.warn(`[${new Date().toLocaleString()}] [Haier Evo] Invalid current temperature ${String(status.current_temperature)}, keeping current value ${this.current_temperature}`);
        this.emit('warning', `Invalid current temperature ${String(status.current_temperature)}, keeping current value ${this.current_temperature}`);
      }
    }

    if (status.target_temperature !== undefined) {
      // Accept any temperature value without strict validation
      if (this.target_temperature !== status.target_temperature) {
        changes.target_temperature = { old: this.target_temperature, new: status.target_temperature };
      }
      this.target_temperature = status.target_temperature;
    }

    if (status.status !== undefined && this.status !== status.status) {
      changes.status = { old: this.status, new: status.status };
      this.status = status.status;
    }

    if (status.mode !== undefined && this.mode !== status.mode) {
      changes.mode = { old: this.mode, new: status.mode };
      this.mode = status.mode;
    }

    if (status.fan_mode !== undefined && this.fan_mode !== status.fan_mode) {
      changes.fan_mode = { old: this.fan_mode, new: status.fan_mode };
      this.fan_mode = status.fan_mode;
    }

    if (status.swing_mode !== undefined && this.swing_mode !== status.swing_mode) {
      changes.swing_mode = { old: this.swing_mode, new: status.swing_mode };
      this.swing_mode = status.swing_mode;
    }

    if (status.quiet !== undefined && this.quiet !== status.quiet) {
      changes.quiet = { old: this.quiet, new: status.quiet };
      this.quiet = status.quiet;
    }

    if (status.turbo !== undefined && this.turbo !== status.turbo) {
      changes.turbo = { old: this.turbo, new: status.turbo };
      this.turbo = status.turbo;
    }

    if (status.comfort !== undefined && this.comfort !== status.comfort) {
      changes.comfort = { old: this.comfort, new: status.comfort };
      this.comfort = status.comfort;
    }

    if (status.health !== undefined && this.health !== status.health) {
      changes.health = { old: this.health, new: status.health };
      this.health = status.health;
    }

    if (status.light !== undefined && this.light !== status.light) {
      changes.light = { old: this.light, new: status.light };
      this.light = status.light;
    }

    if (status.sound !== undefined && this.sound !== status.sound) {
      changes.sound = { old: this.sound, new: status.sound };
      this.sound = status.sound;
    }

    if (status.antifreeze !== undefined && this.antifreeze !== status.antifreeze) {
      changes.antifreeze = { old: this.antifreeze, new: status.antifreeze };
      this.antifreeze = status.antifreeze;
    }

    if (status.cleaning !== undefined && this.cleaning !== status.cleaning) {
      changes.cleaning = { old: this.cleaning, new: status.cleaning };
      this.cleaning = status.cleaning;
    }

    if (status.autohumidity !== undefined && this.autohumidity !== status.autohumidity) {
      changes.autohumidity = { old: this.autohumidity, new: status.autohumidity };
      this.autohumidity = status.autohumidity;
    }

    if (status.eco_sensor !== undefined && this.eco_sensor !== status.eco_sensor) {
      changes.eco_sensor = { old: this.eco_sensor, new: status.eco_sensor };
      this.eco_sensor = status.eco_sensor;
    }

    if (status.preset_mode_sleep !== undefined && this.preset_mode_sleep !== status.preset_mode_sleep) {
      changes.preset_mode_sleep = { old: this.preset_mode_sleep, new: status.preset_mode_sleep };
      this.preset_mode_sleep = status.preset_mode_sleep;
    }

    if (status.preset_mode_boost !== undefined && this.preset_mode_boost !== status.preset_mode_boost) {
      changes.preset_mode_boost = { old: this.preset_mode_boost, new: status.preset_mode_boost };
      this.preset_mode_boost = status.preset_mode_boost;
    }

    // Handle device information updates if present in status
    // Only update if the fields are present and different to preserve device info
    if (status.model !== undefined && this.device_model !== status.model) {
      changes.device_model = { old: this.device_model, new: status.model };
      this.device_model = status.model;
    }

    if (status.serialNumber !== undefined && this.serialNumber !== status.serialNumber) {
      changes.serialNumber = { old: this.serialNumber, new: status.serialNumber };
      this.serialNumber = status.serialNumber;
    }

    if (status.firmwareVersion !== undefined && this.firmwareVersion !== status.firmwareVersion) {
      changes.firmwareVersion = { old: this.firmwareVersion, new: status.firmwareVersion };
      this.firmwareVersion = status.firmwareVersion;
    }

    if (status.deviceName !== undefined && this.device_name !== status.deviceName) {
      changes.device_name = { old: this.device_name, new: status.deviceName };
      this.device_name = status.deviceName;
    }

    const oldAvailable = this.available;
    this.available = this.status > 0;

    if (oldAvailable !== this.available) {
      changes.available = { old: oldAvailable, new: this.available };
    }

    // Log changes if any were detected
    if (Object.keys(changes).length > 0) {
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Device ${this.device_name} status changes:`, JSON.stringify(changes, null, 2));
    } else {
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] No changes detected for device ${this.device_name}`);
    }
  }

  // Abstract methods that must be implemented by subclasses
  abstract set_temperature(temp: number): Promise<void>;
  abstract switch_on(mode?: string): Promise<void>;
  abstract switch_off(): Promise<void>;
  abstract set_operation_mode(mode: string): Promise<void>;
  abstract set_fan_mode(mode: string): Promise<void>;
  abstract set_swing_mode(mode: string): Promise<void>;
  abstract set_preset_mode(mode: string): Promise<void>;
  abstract set_quiet(enabled: boolean): Promise<void>;
  abstract set_turbo(enabled: boolean): Promise<void>;
  abstract set_comfort(enabled: boolean): Promise<void>;
  abstract set_health(enabled: boolean): Promise<void>;
  abstract set_light(enabled: boolean): Promise<void>;
  // Sound mode has been removed as requested
  // Default implementation that does nothing
  async set_sound(enabled: boolean): Promise<void> {
    console.log(`[${new Date().toLocaleString()}] [Haier Evo] Sound mode has been removed from the plugin`);
  }
  abstract set_antifreeze(enabled: boolean): Promise<void>;
  abstract set_cleaning(enabled: boolean): Promise<void>;
  abstract set_autohumidity(enabled: boolean): Promise<void>;
  abstract set_eco_sensor(mode: string): Promise<void>;
  abstract set_sleep_mode(enabled: boolean): Promise<void>;
  abstract set_boost_mode(enabled: boolean): Promise<void>;

  // Common utility methods
  protected async sendCommand(command: any): Promise<void> {
    try {
      await this.api.sendCommand(this.device_id, command);
      this.emit('commandSent', command);
    } catch (error) {
      this.emit('error', `Failed to send command: ${String(error)}`);
      throw error;
    }
  }

    public destroy(): void {
    if (this.statusUpdateTimer) {
      clearInterval(this.statusUpdateTimer);
      this.statusUpdateTimer = null;
    }

    // Remove WebSocket event listeners
    this.api.removeListener('device_status_update', this.handleDeviceStatusUpdate);
    this.api.removeListener('deviceStatusUpdate', this.handleLegacyStatusUpdate);

    // Remove all other event listeners
    this.removeAllListeners();
  }

  private handleDeviceStatusUpdate = (macAddress: string, status: DeviceStatus) => {
    if (macAddress === this.mac) {
      this.updateFromStatus(status);
      this.lastStatusUpdate = new Date();
      this.emit('statusUpdated', status);
    }
  }

  private handleLegacyStatusUpdate = (data: any) => {
    if (data.macAddress === this.mac) {
      this.updateFromStatus(data.status);
      this.lastStatusUpdate = new Date();
      this.emit('statusUpdated', data.status);
    }
  }

  public toJSON(): any {
    return {
      device_id: this.device_id,
      device_name: this.device_name,
      device_model: this.device_model,
      device_type: this.device_type,
      mac: this.mac,
      serialNumber: this.serialNumber,
      firmwareVersion: this.firmwareVersion,
      status: this.status,
      available: this.available,
      current_temperature: this.current_temperature,
      target_temperature: this.target_temperature,
      mode: this.mode,
      fan_mode: this.fan_mode,
      swing_mode: this.swing_mode,
      max_temperature: this.max_temperature,
      min_temperature: this.min_temperature,
      quiet: this.quiet,
      turbo: this.turbo,
      comfort: this.comfort,
      health: this.health,
      light: this.light,
      sound: this.sound,
      antifreeze: this.antifreeze,
      cleaning: this.cleaning,
      autohumidity: this.autohumidity,
      eco_sensor: this.eco_sensor,
      preset_mode_sleep: this.preset_mode_sleep,
      preset_mode_boost: this.preset_mode_boost
    };
  }
}
