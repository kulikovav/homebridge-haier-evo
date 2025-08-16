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

  // Device filtering options
  includeDevices?: string[];       // List of device IDs to include (if specified, only these devices will be added)
  excludeDevices?: string[];       // List of device IDs to exclude
  includeDeviceTypes?: string[];   // List of device types to include (e.g., "AC", "REFRIGERATOR")
  excludeDeviceTypes?: string[];   // List of device types to exclude
  includeNamePattern?: string;     // Regex pattern for device names to include
  excludeNamePattern?: string;     // Regex pattern for device names to exclude
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
  swing_horizontal_mode?: string;
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
}

export interface HaierDevice {
  device_id: string;
  device_name: string;
  device_model: string;
  device_type: string;
  mac: string;
  status: number;
  available: boolean;
  current_temperature: number;
  target_temperature: number;
  mode: string;
  fan_mode: string;
  swing_mode: string;
  swing_horizontal_mode: string;
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
  switch_on(mode?: string): Promise<void>;
  switch_off(): Promise<void>;
  set_fan_mode(mode: string): Promise<void>;
  set_swing_mode(mode: string): Promise<void>;
  set_swing_horizontal_mode(mode: string): Promise<void>;
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

  // Cleanup method
  destroy(): void;
}

export interface HaierAC extends HaierDevice {
  get_supported_features(): number;
  get_hvac_modes(): string[];
  get_fan_modes(): string[];
  get_swing_modes(): string[];
  get_swing_horizontal_modes(): string[];
  get_preset_modes(): string[];
}

export interface HaierRefrigerator extends HaierDevice {
  // Refrigerator-specific methods
  set_freezer_temperature(temp: number): Promise<void>;
  set_refrigerator_temperature(temp: number): Promise<void>;
  set_eco_mode(enabled: boolean): Promise<void>;
  set_vacation_mode(enabled: boolean): Promise<void>;
}
