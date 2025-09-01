import { BaseDevice } from './base-device';
import { HaierRefrigerator, DeviceInfo, DeviceStatus } from '../types';
import { HaierAPI } from '../haier-api';

export class HaierRefrigeratorDevice extends BaseDevice implements HaierRefrigerator {
  // Refrigerator-specific properties
  public freezer_temperature: number = -18;
  public refrigerator_temperature: number = 4;
  public myzone_temperature: number = -5;
  public eco_mode: boolean = false;
  public vacation_mode: boolean = false;
  public defrost_mode: boolean = false;
  public super_cool_mode: boolean = false;
  public super_freeze_mode: boolean = false;
  public refrigerator_door_open: boolean = false;
  public freezer_door_open: boolean = false;
  public freezer2_door_open: boolean = false;
  public ambient_temperature: number = 25;

  // Command mappings based on refrigerator data
  private static readonly COMMANDS = {
    REFRIGERATOR_TEMP: '3',      // Refrigerator compartment temperature
    FREEZER_TEMP: '4',           // Freezer compartment temperature
    MYZONE_TEMP: '5',            // My Zone temperature
    SUPER_COOL: '6',             // Super cooling mode
    SUPER_FREEZE: '7',           // Super freezing mode
    VACATION_MODE: '8',          // Vacation mode
    REFRIGERATOR_DOOR: '10',     // Refrigerator door status
    FREEZER_DOOR: '9',           // Freezer door status
    FREEZER2_DOOR: 'freezer2DoorStatus', // Freezer 2 door status
    AMBIENT_TEMP: '2'            // Ambient temperature
  } as const;

  // Temperature ranges from refrigerator data
  public static readonly TEMP_RANGES = {
    REFRIGERATOR: { min: 2, max: 8, step: 1 },
    FREEZER: { min: -24, max: -16, step: 1 },
    MYZONE: { min: -5, max: 5, step: 5 },
    AMBIENT: { min: -38, max: 50, step: 1 }
  } as const;

  constructor(deviceInfo: DeviceInfo, api: HaierAPI) {
    super(deviceInfo, api);

    // Set temperature limits based on refrigerator data
    this.max_temperature = HaierRefrigeratorDevice.TEMP_RANGES.REFRIGERATOR.max;
    this.min_temperature = HaierRefrigeratorDevice.TEMP_RANGES.REFRIGERATOR.min;

    // Set a valid default target temperature for refrigerators
    // Use the middle of the valid range (typically 5°C for refrigerators)
    this.target_temperature = Math.round((this.min_temperature + this.max_temperature) / 2);

    // Initialize status updates (WebSocket listeners and initial status fetch policy)
    this.initializeStatusUpdates();
  }

  // Enhanced temperature control methods with proper command mapping
  async set_temperature(temp: number): Promise<void> {
    // Map degrees to list code for command '3'
    const command = {
      commandName: HaierRefrigeratorDevice.COMMANDS.REFRIGERATOR_TEMP,
      values: [this.mapRefrigeratorTempToCommand(temp)]
    };

    await this.sendCommand(command);
    this.refrigerator_temperature = temp;
    this.target_temperature = temp;
    this.emit('refrigeratorTemperatureChanged', temp);
  }

  async set_freezer_temperature(temp: number): Promise<void> {
    const command = {
      commandName: HaierRefrigeratorDevice.COMMANDS.FREEZER_TEMP,
      values: [this.mapFreezerTempToCommand(temp)]
    };

    await this.sendCommand(command);
    this.freezer_temperature = temp;
    this.emit('freezerTemperatureChanged', temp);
  }

  async set_myzone_temperature(temp: number): Promise<void> {
    // No temperature validation - accept any value

    // Map temperature to command value based on data
    let commandValue: string;
    switch (temp) {
      case -5:
        commandValue = '26';
        break;
      case 0:
        commandValue = '31';
        break;
      case 5:
        commandValue = '36';
        break;
      default:
        // For any other value, use the closest valid value
        if (temp < -2.5) {
          commandValue = '26'; // Use -5°C
        } else if (temp < 2.5) {
          commandValue = '31'; // Use 0°C
        } else {
          commandValue = '36'; // Use 5°C
        }
    }

    const command = {
      commandName: HaierRefrigeratorDevice.COMMANDS.MYZONE_TEMP,
      values: [commandValue]
    };

    await this.sendCommand(command);
    this.myzone_temperature = temp;
    this.emit('myzoneTemperatureChanged', temp);
  }

  // Enhanced mode control methods
  async set_super_cool_mode(enabled: boolean): Promise<void> {
    const command = {
      commandName: HaierRefrigeratorDevice.COMMANDS.SUPER_COOL,
      values: [enabled.toString()]
    };

    await this.sendCommand(command);
    this.super_cool_mode = enabled;
    this.emit('superCoolModeChanged', enabled);
  }

  async set_super_freeze_mode(enabled: boolean): Promise<void> {
    const command = {
      commandName: HaierRefrigeratorDevice.COMMANDS.SUPER_FREEZE,
      values: [enabled.toString()]
    };

    await this.sendCommand(command);
    this.super_freeze_mode = enabled;
    this.emit('superFreezeModeChanged', enabled);
  }

  async set_vacation_mode(enabled: boolean): Promise<void> {
    const command = {
      commandName: HaierRefrigeratorDevice.COMMANDS.VACATION_MODE,
      values: [enabled.toString()]
    };

    await this.sendCommand(command);
    this.vacation_mode = enabled;
    this.emit('vacationModeChanged', enabled);
  }

  // Power control methods (inherited from base)
  async switch_on(mode?: string): Promise<void> {
    // Refrigerators are always on when plugged in
    this.status = 1;
    this.emit('powerChanged', true);
  }

  async switch_off(): Promise<void> {
    // Refrigerators cannot be turned off via API
    throw new Error('Refrigerators cannot be turned off via API for safety reasons');
  }

  // Additional refrigerator-specific methods required by interface
  async set_refrigerator_temperature(temp: number): Promise<void> {
    // This is the same as set_temperature for main compartment
    return this.set_temperature(temp);
  }

  async set_eco_mode(enabled: boolean): Promise<void> {
    // Eco mode not directly supported by this refrigerator model
    // Could be implemented as vacation mode for energy saving
    if (enabled) {
      await this.set_vacation_mode(true);
    } else {
      await this.set_vacation_mode(false);
    }
    this.eco_mode = enabled;
    this.emit('ecoModeChanged', enabled);
  }

  // Helper methods for mapping command values to temperatures
  private mapFreezerCommandToTemp(commandValue: number): number {
    switch (commandValue) {
      case 6: return -24;
      case 7: return -23;
      case 8: return -22;
      case 9: return -21;
      case 10: return -20;
      case 11: return -19;
      case 12: return -18;
      case 13: return -17;
      case 14: return -16;
      default: return -18;
    }
  }

  private mapMyZoneCommandToTemp(commandValue: number): number {
    switch (commandValue) {
      case 26: return -5;
      case 31: return 0;
      case 36: return 5;
      default: return -5;
    }
  }

  private mapFreezerTempToCommand(temp: number): string {
    const clamped = Math.max(HaierRefrigeratorDevice.TEMP_RANGES.FREEZER.min, Math.min(HaierRefrigeratorDevice.TEMP_RANGES.FREEZER.max, temp));
    // -24 maps to 6, -23→7 ... -16→14
    const code = 6 + (Math.round(clamped - (-24)));
    return String(code);
  }

  private mapRefrigeratorTempToCommand(temp: number): string {
    const clamped = Math.max(HaierRefrigeratorDevice.TEMP_RANGES.REFRIGERATOR.min, Math.min(HaierRefrigeratorDevice.TEMP_RANGES.REFRIGERATOR.max, temp));
    // 2→3, 3→4, ... 8→9
    return String(clamped + 1);
  }

  // Enhanced status update from refrigerator data
  updateFromStatus(status: unknown): void {
    console.log(`[${new Date().toLocaleString()}] [Haier Evo] Updating refrigerator status for ${this.device_name}`);

    // Handle WebSocket properties format
    if (status && typeof status === 'object' && 'properties' in status && (status as any).properties) {
      const props = (status as any).properties as Record<string, string>;
      const changes: Record<string, { old: any, new: any }> = {};

      const parseIntSafe = (v: any): number => {
        const n = parseInt(String(v));
        return isNaN(n) ? 0 : n;
      };

      // 0: Refrigerator current temperature (℃)
      if (props['0'] !== undefined) {
        const temp = parseIntSafe(props['0']);
        if (temp >= HaierRefrigeratorDevice.TEMP_RANGES.REFRIGERATOR.min && temp <= HaierRefrigeratorDevice.TEMP_RANGES.REFRIGERATOR.max) {
          if (this.current_temperature !== temp) {
            changes.current_temperature = { old: this.current_temperature, new: temp };
          }
          if (this.refrigerator_temperature !== temp) {
            changes.refrigerator_temperature = { old: this.refrigerator_temperature, new: temp };
          }
          this.current_temperature = temp;
          this.refrigerator_temperature = temp;
        }
      }

      // 1: Freezer current temperature (℃)
      if (props['1'] !== undefined) {
        const temp = parseIntSafe(props['1']);
        if (temp >= HaierRefrigeratorDevice.TEMP_RANGES.FREEZER.min && temp <= HaierRefrigeratorDevice.TEMP_RANGES.FREEZER.max) {
          if (this.freezer_temperature !== temp) {
            changes.freezer_temperature = { old: this.freezer_temperature, new: temp };
          }
          this.freezer_temperature = temp;
        }
      }

      // 2: Ambient temperature (℃)
      if (props['2'] !== undefined) {
        const temp = parseIntSafe(props['2']);
        if (temp >= HaierRefrigeratorDevice.TEMP_RANGES.AMBIENT.min && temp <= HaierRefrigeratorDevice.TEMP_RANGES.AMBIENT.max) {
          if (this.ambient_temperature !== temp) {
            changes.ambient_temperature = { old: this.ambient_temperature, new: temp };
          }
          this.ambient_temperature = temp;
        }
      }

      // 3: Refrigerator target level (list code 3..9 -> 2..8 ℃)
      if (props['3'] !== undefined) {
        const level = parseIntSafe(props['3']);
        const mapped = (level >= 3 && level <= 9) ? (level - 1) : level;
        if (mapped >= HaierRefrigeratorDevice.TEMP_RANGES.REFRIGERATOR.min && mapped <= HaierRefrigeratorDevice.TEMP_RANGES.REFRIGERATOR.max) {
          if (this.target_temperature !== mapped) {
            changes.target_temperature = { old: this.target_temperature, new: mapped };
          }
          this.target_temperature = mapped;
        }
      }

      // 4: Freezer target level (list code -> mapped temp)
      if (props['4'] !== undefined) {
        const code = parseIntSafe(props['4']);
        const mapped = this.mapFreezerCommandToTemp(code);
        if (this.freezer_temperature !== mapped) {
          changes.freezer_temperature = { old: this.freezer_temperature, new: mapped };
        }
        this.freezer_temperature = mapped;
      }

      // 6: Super cool (0/1)
      if (props['6'] !== undefined) {
        const newValue = String(props['6']).trim() === '1';
        if (this.super_cool_mode !== newValue) {
          changes.super_cool_mode = { old: this.super_cool_mode, new: newValue };
          this.super_cool_mode = newValue;
        }
      }

      // 7: Super freeze (0/1)
      if (props['7'] !== undefined) {
        const newValue = String(props['7']).trim() === '1';
        if (this.super_freeze_mode !== newValue) {
          changes.super_freeze_mode = { old: this.super_freeze_mode, new: newValue };
          this.super_freeze_mode = newValue;
        }
      }

      // 8: Vacation mode (0/1)
      if (props['8'] !== undefined) {
        const newValue = String(props['8']).trim() === '1';
        if (this.vacation_mode !== newValue) {
          changes.vacation_mode = { old: this.vacation_mode, new: newValue };
          this.vacation_mode = newValue;
        }
      }

      // 9: Freezer door (0 closed, 1 open)
      if (props['9'] !== undefined) {
        const newValue = String(props['9']).trim() === '1';
        if (this.freezer_door_open !== newValue) {
          changes.freezer_door_open = { old: this.freezer_door_open, new: newValue };
          this.freezer_door_open = newValue;
        }
      }

      // 10: Refrigerator door (0 closed, 1 open)
      if (props['10'] !== undefined) {
        const newValue = String(props['10']).trim() === '1';
        if (this.refrigerator_door_open !== newValue) {
          changes.refrigerator_door_open = { old: this.refrigerator_door_open, new: newValue };
          this.refrigerator_door_open = newValue;
        }
      }

      if (Object.keys(changes).length > 0) {
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] Refrigerator ${this.device_name} status (properties) changes:`, JSON.stringify(changes, null, 2));
      }
    }

    // Only call super if status is DeviceStatus
    if (status && typeof status === 'object' && 'current_temperature' in status) {
      super.updateFromStatus(status as DeviceStatus);
    }

    // Parse attributes from refrigerator data response
    if (status && typeof status === 'object' && 'attributes' in status && status.attributes && Array.isArray(status.attributes)) {
      const changes: Record<string, { old: any, new: any }> = {};

      for (const attr of status.attributes) {
        if (attr && typeof attr === 'object' && 'name' in attr && 'currentValue' in attr) {
          const attrObj = attr as { name: string; currentValue: string };
          console.log(`[${new Date().toLocaleString()}] [Haier Evo] Processing attribute ${attrObj.name} = ${attrObj.currentValue}`);

          switch (attrObj.name) {
          case '0': // Refrigerator temperature
            if (attrObj.currentValue !== undefined) {
              const temp = parseInt(attrObj.currentValue);
              if (temp >= HaierRefrigeratorDevice.TEMP_RANGES.REFRIGERATOR.min &&
                  temp <= HaierRefrigeratorDevice.TEMP_RANGES.REFRIGERATOR.max) {
                if (this.refrigerator_temperature !== temp) {
                  changes.refrigerator_temperature = { old: this.refrigerator_temperature, new: temp };
                  this.refrigerator_temperature = temp;
                  // Map primary compartment temperature to generic current_temperature for HomeKit
                  this.current_temperature = temp;
                }
              }
            }
            break;
          case '1': // Freezer temperature
            if (attrObj.currentValue !== undefined) {
              const temp = parseInt(attrObj.currentValue);
              if (temp >= HaierRefrigeratorDevice.TEMP_RANGES.FREEZER.min &&
                  temp <= HaierRefrigeratorDevice.TEMP_RANGES.FREEZER.max) {
                if (this.freezer_temperature !== temp) {
                  changes.freezer_temperature = { old: this.freezer_temperature, new: temp };
                  this.freezer_temperature = temp;
                }
              }
            }
            break;
          case '2': // Ambient temperature
            if (attrObj.currentValue !== undefined) {
              const temp = parseInt(attrObj.currentValue);
              if (temp >= HaierRefrigeratorDevice.TEMP_RANGES.AMBIENT.min &&
                  temp <= HaierRefrigeratorDevice.TEMP_RANGES.AMBIENT.max) {
                if (this.ambient_temperature !== temp) {
                  changes.ambient_temperature = { old: this.ambient_temperature, new: temp };
                  this.ambient_temperature = temp;
                }
              }
            }
            break;
          case '3': // Refrigerator compartment setting (target)
            if (attrObj.currentValue !== undefined) {
              const value = parseInt(attrObj.currentValue);
              const mappedTemp = (value >= 3 && value <= 9) ? (value - 1) : value;
              if (this.target_temperature !== mappedTemp) {
                changes.target_temperature = { old: this.target_temperature, new: mappedTemp };
                this.target_temperature = mappedTemp;
              }
            }
            break;
          case '4': // Freezer compartment setting
            if (attrObj.currentValue !== undefined) {
              const temp = parseInt(attrObj.currentValue);
              // Map command value to actual temperature without strict validation
              const mappedTemp = this.mapFreezerCommandToTemp(temp);
              if (this.freezer_temperature !== mappedTemp) {
                changes.freezer_temperature = { old: this.freezer_temperature, new: mappedTemp };
                this.freezer_temperature = mappedTemp;
              }
            }
            break;
          case '5': // My Zone temperature
            if (attrObj.currentValue !== undefined) {
              const temp = parseInt(attrObj.currentValue);
              const mappedTemp = this.mapMyZoneCommandToTemp(temp);
              if (this.myzone_temperature !== mappedTemp) {
                changes.myzone_temperature = { old: this.myzone_temperature, new: mappedTemp };
                this.myzone_temperature = mappedTemp;
              }
            }
            break;
          case '6': // Super cooling mode
            if (attrObj.currentValue !== undefined) {
              const newValue = attrObj.currentValue === 'true';
              if (this.super_cool_mode !== newValue) {
                changes.super_cool_mode = { old: this.super_cool_mode, new: newValue };
                this.super_cool_mode = newValue;
              }
            }
            break;
          case '7': // Super freezing mode
            if (attrObj.currentValue !== undefined) {
              const raw = String(attrObj.currentValue).toLowerCase();
              const newValue = raw === 'true' || raw === '1';
              if (this.super_freeze_mode !== newValue) {
                changes.super_freeze_mode = { old: this.super_freeze_mode, new: newValue };
                this.super_freeze_mode = newValue;
              }
            }
            break;
          case '8': // Vacation mode
            if (attrObj.currentValue !== undefined) {
              const raw = String(attrObj.currentValue).toLowerCase();
              const newValue = raw === 'true' || raw === '1';
              if (this.vacation_mode !== newValue) {
                changes.vacation_mode = { old: this.vacation_mode, new: newValue };
                this.vacation_mode = newValue;
              }
            }
            break;
          case '9': // Freezer door status (0 closed, 1 open)
            if (attrObj.currentValue !== undefined) {
              const raw = String(attrObj.currentValue).trim();
              const newValue = raw === '1';
              if (this.freezer_door_open !== newValue) {
                changes.freezer_door_open = { old: this.freezer_door_open, new: newValue };
                this.freezer_door_open = newValue;
              }
            }
            break;
          case '10': // Refrigerator door status (0 closed, 1 open)
            if (attrObj.currentValue !== undefined) {
              const raw = String(attrObj.currentValue).trim();
              const newValue = raw === '1';
              if (this.refrigerator_door_open !== newValue) {
                changes.refrigerator_door_open = { old: this.refrigerator_door_open, new: newValue };
                this.refrigerator_door_open = newValue;
              }
            }
            break;
          // Remove freezer2DoorStatus as it does nothing per data
          }
        }
      }

      // Log changes if any were detected
      if (Object.keys(changes).length > 0) {
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] Refrigerator ${this.device_name} status changes:`, JSON.stringify(changes, null, 2));
      } else {
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] No refrigerator-specific changes detected for ${this.device_name}`);
      }
    }
  }

  // Enhanced feature support detection
  public get_supported_features(): number {
    let features = 0;

    // Temperature control
    features |= 1; // REFRIGERATOR_TEMP
    features |= 2; // FREEZER_TEMP
    features |= 4; // MYZONE_TEMP
    features |= 8; // SUPER_COOL
    features |= 16; // SUPER_FREEZE
    features |= 32; // VACATION_MODE
    features |= 64; // DOOR_MONITORING

    return features;
  }

  // Get temperature ranges for UI
  public get_temperature_ranges(): any {
    return {
      refrigerator: HaierRefrigeratorDevice.TEMP_RANGES.REFRIGERATOR,
      freezer: HaierRefrigeratorDevice.TEMP_RANGES.FREEZER,
      myzone: HaierRefrigeratorDevice.TEMP_RANGES.MYZONE,
      ambient: HaierRefrigeratorDevice.TEMP_RANGES.AMBIENT
    };
  }

  // Get current status summary
  public get_status_summary(): any {
    return {
      power: this.status === 1 ? 'on' : 'off',
      refrigerator_temp: this.refrigerator_temperature,
      freezer_temp: this.freezer_temperature,
      myzone_temp: this.myzone_temperature,
      ambient_temp: this.ambient_temperature,
      super_cool: this.super_cool_mode,
      super_freeze: this.super_freeze_mode,
      vacation_mode: this.vacation_mode,
      refrigerator_door: this.refrigerator_door_open ? 'open' : 'closed',
      freezer_door: this.freezer_door_open ? 'open' : 'closed',
      freezer2_door: this.freezer2_door_open ? 'open' : 'closed'
    };
  }

  // Implement missing abstract methods from BaseDevice
  async set_operation_mode(mode: string): Promise<void> {
    // Refrigerators don't have operation modes like AC units
    console.log(`Operation mode not supported for refrigerator: ${mode}`);
  }

  async set_fan_mode(mode: string): Promise<void> {
    // Refrigerators don't have fan modes
    throw new Error('Fan mode not supported by refrigerator devices');
  }

  async set_swing_mode(mode: string): Promise<void> {
    // Refrigerators don't have swing modes
    throw new Error('Swing mode not supported by refrigerator devices');
  }

  async set_swing_horizontal_mode(mode: string): Promise<void> {
    // Refrigerators don't have horizontal swing modes
    throw new Error('Horizontal swing mode not supported by refrigerator devices');
  }

  async set_preset_mode(mode: string): Promise<void> {
    switch (mode) {
      case 'super_cool':
        await this.set_super_cool_mode(true);
        break;
      case 'super_freeze':
        await this.set_super_freeze_mode(true);
        break;
      case 'vacation':
        await this.set_vacation_mode(true);
        break;
      default:
        throw new Error(`Invalid preset mode: ${mode}`);
    }
  }

  async set_quiet(enabled: boolean): Promise<void> {
    // Refrigerators don't have quiet mode
    throw new Error('Quiet mode not supported by refrigerator devices');
  }

  async set_turbo(enabled: boolean): Promise<void> {
    // Refrigerators don't have turbo mode
    throw new Error('Turbo mode not supported by refrigerator devices');
  }

  async set_comfort(enabled: boolean): Promise<void> {
    // Refrigerators don't have comfort mode
    throw new Error('Comfort mode not supported by refrigerator devices');
  }

  async set_health(enabled: boolean): Promise<void> {
    // Refrigerators don't have health mode
    throw new Error('Health mode not supported by refrigerator devices');
  }

  async set_light(enabled: boolean): Promise<void> {
    // Refrigerators don't have light control
    throw new Error('Light control not supported by refrigerator devices');
  }

  async set_sound(enabled: boolean): Promise<void> {
    // Refrigerators don't have sound control
    throw new Error('Sound control not supported by refrigerator devices');
  }

  async set_antifreeze(enabled: boolean): Promise<void> {
    // Refrigerators don't have antifreeze mode
    throw new Error('Antifreeze mode not supported by refrigerator devices');
  }

  async set_cleaning(enabled: boolean): Promise<void> {
    // Refrigerators don't have cleaning mode
    throw new Error('Cleaning mode not supported by refrigerator devices');
  }

  async set_autohumidity(enabled: boolean): Promise<void> {
    // Refrigerators don't have auto humidity control
    throw new Error('Auto humidity control not supported by refrigerator devices');
  }

  async set_eco_sensor(mode: string): Promise<void> {
    // Refrigerators don't have eco sensor
    throw new Error('Eco sensor not supported by refrigerator devices');
  }

  async set_sleep_mode(enabled: boolean): Promise<void> {
    // Refrigerators don't have sleep mode
    throw new Error('Sleep mode not supported by refrigerator devices');
  }

  async set_boost_mode(enabled: boolean): Promise<void> {
    // Refrigerators don't have boost mode
    throw new Error('Boost mode not supported by refrigerator devices');
  }
}