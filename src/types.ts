export interface HaierEvoConfig {
  name: string;
  email: string;
  password: string;
  region: string;
  deviceId?: string;
  refreshInterval?: number;
  debug?: boolean;

  // API optimization options
  deviceCacheTTL?: number;         // Time in seconds to cache device list (default: 300)
  requestRandomization?: boolean;  // Whether to add randomization to requests (default: true)
  minRequestDelay?: number;        // Minimum delay between requests in ms (default: 100)
  maxRequestDelay?: number;        // Maximum delay between requests in ms (default: 1000)

  // Token refresh options
  tokenRefreshMode?: 'auto' | 'manual' | 'disabled';  // Token refresh mode (default: 'auto')
  tokenRefreshInterval?: number;   // Manual refresh interval in seconds (default: use expire header)
  tokenRefreshThreshold?: number;  // Time in seconds before expiration to refresh token (default: 300)

  // Command batching options
  batchTimeout?: number;           // Time in milliseconds to wait before sending batched commands (default: 100)

  // Device filtering options
  includeDevices?: string[];       // List of device IDs to include (if specified, only these devices will be added)
  excludeDevices?: string[];       // List of device IDs to exclude
  includeDeviceTypes?: string[];   // List of device types to include (e.g., "AC", "REFRIGERATOR")
  excludeDeviceTypes?: string[];   // List of device types to exclude
  includeNamePattern?: string;     // Regex pattern for device names to include
  excludeNamePattern?: string;     // Regex pattern for device names to exclude

  // AC Accessory Options
  enableFanService?: boolean;      // Enable separate Fan service (default: true)
  enableBlindsControl?: boolean;   // Enable blinds control with Fan v2 service (default: true)
  enableBlindsAutoSwitch?: boolean; // Enable blinds auto mode switch (default: true)
  enableBlindsComfortSwitch?: boolean; // Enable blinds comfort mode switch (default: true)
  enableLightControl?: boolean;    // Enable light control service (default: true)
  enableHealthModeSwitch?: boolean; // Enable health mode switch (default: true)
  enableQuietModeSwitch?: boolean; // Enable quiet mode switch (default: true)
  enableTurboModeSwitch?: boolean; // Enable turbo mode switch (default: true)
  enableComfortModeSwitch?: boolean; // Enable comfort mode switch (default: true)
  /**
   * Interval in seconds to emit HomeKit temperature update events for AC devices.
   * Set to 0 or a negative value to disable periodic events. Default: 60 seconds.
   */
  temperatureEventInterval?: number;

  /**
   * When true, publish a HomeKit temperature event every interval even if
   * the temperature value did not change. Default: true.
   */
  temperatureEventForcePublish?: boolean;

  /**
   * Minimum delta in degrees Celsius required to publish a temperature event
   * when force publish is disabled. Default: 0 (no threshold).
   */
  temperatureEventMinDelta?: number;

  /**
   * Optional jitter in seconds added as initial random delay before starting
   * periodic temperature events to avoid synchronized bursts. Default: 0.
   */
  temperatureEventJitter?: number;
}

export interface AuthResponse {
  data: {
    token: {
      accessToken: string;
      refreshToken: string;
      expire: string;
      refreshExpire: string;
    };
  };
  error?: any;
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  model: string;
  mac: string;
  status: number;
  attributes: DeviceAttribute[];
  serialNumber?: string;
  firmwareVersion?: string;
  initialStatus?: DeviceStatus; // Initial status data from API_DEVICE_CONFIG to avoid redundant calls
}

export interface DeviceAttribute {
  name: string;
  id: string;
  value?: any;
  mappings?: AttributeMapping[];
}

export interface AttributeMapping {
  haier: string;
  value: string;
}

export interface DeviceStatus {
  current_temperature?: number;
  target_temperature?: number;
  status?: number;
  mode?: string;
  fan_mode?: string;
  swing_mode?: string;
  quiet?: boolean;
  turbo?: boolean;
  comfort?: boolean;
  health?: boolean;
  light?: boolean;
  sound?: boolean;
  antifreeze?: boolean;
  cleaning?: boolean;
  autohumidity?: boolean;
  eco_sensor?: string;
  preset_mode_sleep?: boolean;
  preset_mode_boost?: boolean;

  // WebSocket and API response formats
  properties?: Record<string, unknown>;
  attributes?: any[];

  // Device information from API_DEVICE_CONFIG
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  deviceName?: string;
}

export interface HaierDevice {
  device_id: string;
  device_name: string;
  device_model: string;
  device_type: string;
  mac: string;
  serialNumber?: string;
  firmwareVersion?: string;
  status: number;
  available: boolean;
  current_temperature: number;
  target_temperature: number;
  mode: string;
  fan_mode: string;
  swing_mode: string;
  max_temperature: number;
  min_temperature: number;
  quiet: boolean;
  turbo: boolean;
  comfort: boolean;
  health: boolean;
  light: boolean;
  sound: boolean;
  antifreeze: boolean;
  cleaning: boolean;
  autohumidity: boolean;
  eco_sensor: string;
  preset_mode_sleep: boolean;
  preset_mode_boost: boolean;

  // Methods
  set_temperature(temp: number): Promise<void>;
  switch_on(): Promise<void>;
  switch_off(): Promise<void>;
  set_operation_mode(mode: string): Promise<void>;
  set_fan_mode(mode: string): Promise<void>;
  set_swing_mode(mode: string): Promise<void>;
  set_preset_mode(mode: string): Promise<void>;
  set_quiet(enabled: boolean): Promise<void>;
  set_turbo(enabled: boolean): Promise<void>;
  set_comfort(enabled: boolean): Promise<void>;
  set_health(enabled: boolean): Promise<void>;
  set_light(enabled: boolean): Promise<void>;
  set_sound(enabled: boolean): Promise<void>;
  set_antifreeze(enabled: boolean): Promise<void>;
  set_cleaning(enabled: boolean): Promise<void>;
  set_autohumidity(enabled: boolean): Promise<void>;
  set_eco_sensor(mode: string): Promise<void>;
  set_sleep_mode(enabled: boolean): Promise<void>;
  set_boost_mode(enabled: boolean): Promise<void>;

  // Event emitter methods
  on(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;

  // Status update method
  updateFromStatus(status: any): void;

  // Configuration methods
  setSkipInitialFetch(skip?: boolean): void;
  updateDeviceInfo(info: { model?: string; serialNumber?: string; firmwareVersion?: string; deviceName?: string }): void;

  // Cleanup method
  destroy(): void;
}

export interface HaierAC extends HaierDevice {
  get_supported_features(): number;
  get_hvac_modes(): string[];
  get_fan_modes(): string[];
  get_swing_modes(): string[];
  get_preset_modes(): string[];
}

/**
 * Device model configuration types for flexible per-model mapping
 */
export interface ModelModeMapping {
  haier: string;
  value: string;
}

export interface ModelAttributeConfig {
  name: string;
  id: string;
  mappings?: ReadonlyArray<ModelModeMapping>;
}

export interface ModelDefinition {
  // Regex string to match model, e.g.,
  //
  modelPattern: string;
  // Wrapper group commandName for batching operations via WebSocket
  groupCommandName: string; // e.g., "4" or "3"
  // Canonical attributes for this model
  attributes: ReadonlyArray<ModelAttributeConfig>;
}

export interface ModelsConfigSchema {
  version: string;
  models: ReadonlyArray<ModelDefinition>;
}

export interface PropertyMappings {
  operationModeId: string;
  fanSpeedId: string;
  targetTempId: string;
  currentTempIds: ReadonlyArray<string>; // some models expose multiple
  powerStatusId: string;
  verticalSwingId?: string;
  lightId?: string;
}


export interface HaierRefrigerator extends HaierDevice {
  // Refrigerator-specific methods
  set_freezer_temperature(temp: number): Promise<void>;
  set_refrigerator_temperature(temp: number): Promise<void>;
  set_eco_mode(enabled: boolean): Promise<void>;
  set_vacation_mode(enabled: boolean): Promise<void>;
}
