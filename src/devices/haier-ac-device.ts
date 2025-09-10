import { BaseDevice } from './base-device';
import { HaierAC, DeviceInfo } from '../types';
import { HaierAPI } from '../haier-api';
import { HVAC_MODES, FAN_MODES, SWING_MODES, HVACMode, FanMode, SwingMode } from '../constants';
import { ModelConfigService } from '../models/model-config';

export class HaierACDevice extends BaseDevice implements HaierAC {
  // Command mappings based on AC data
  private static readonly COMMANDS = {
    POWER: '21',           // Power on/off
    MODE: '2',            // Operation mode
    TEMPERATURE: '0',     // Target temperature
    FAN_SPEED: '4',       // Fan speed
    VERTICAL_SWING: '1',  // Vertical swing
    LIGHT: '12',          // Unit lighting
    // SOUND: '14',       // Sound - removed as requested
    HEALTH: '20',         // Health mode
    QUIET: '17',          // Quiet mode
    TURBO: '18',          // Turbo mode
    COMFORT: '16',        // Comfort sleep
    CLEANING: '6',        // Sterile cleaning
    ANTIFREEZE: '13',     // 10 degree heating
    AUTOHUMIDITY: '31'    // Auto humidity
  } as const;

  // Properties
  public light_on: boolean = true;

  // Operation mode values from AC data
  private static readonly OPERATION_MODES = {
    AUTO: '0',           // Auto
    COOL: '1',           // Cool
    DRY: '2',            // Dehumidify
    HEAT: '4',           // Heat
    FAN: '6'             // Fan only
  } as const;

  // Fan speed values from AC data
  private static readonly FAN_SPEEDS = {
    FAST: '1',           // Fast mode
    MEDIUM: '2',         // Medium mode
    SLOW: '3',           // Slow mode
    AUTO: '5'            // Auto mode
  } as const;

  constructor(deviceInfo: DeviceInfo, api: HaierAPI) {
    super(deviceInfo, api);
    this.modelConfig = ModelConfigService.getInstance();

    // Set temperature limits based on AC data
    this.max_temperature = 30;
    this.min_temperature = 16;

    // Ensure target temperature is within valid range
    if (this.target_temperature < this.min_temperature || this.target_temperature > this.max_temperature) {
      this.target_temperature = Math.round((this.min_temperature + this.max_temperature) / 2);
    }

    // Now start status updates after temperature limits are set
    this.initializeStatusUpdates();
  }

  private readonly modelConfig: ModelConfigService;

  private getId(canonical: string, fallback: string): string {
    return this.modelConfig.getAttributeId(this.device_model, canonical, fallback);
  }

  /**
   * Set the operation mode of the air conditioner
   * @param mode The HVAC mode to set (auto, cool, dry, heat, fan_only)
   */
  async set_operation_mode(mode: string): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 🌡️ Setting operation mode for ${this.device_name} to ${mode}`);

    if (!this.isValidHVACMode(mode)) {
      const error = `Invalid HVAC mode: ${mode}`;
      console.error(`[${timestamp}] [Haier Evo] ❌ ${error}`);
      throw new Error(error);
    }

    try {
      // Map mode string to command value
      let commandValue: string;
      switch (mode) {
        case 'auto':
          commandValue = HaierACDevice.OPERATION_MODES.AUTO;
          break;
        case 'cool':
          commandValue = HaierACDevice.OPERATION_MODES.COOL;
          break;
        case 'dry':
          commandValue = HaierACDevice.OPERATION_MODES.DRY;
          break;
        case 'heat':
          commandValue = HaierACDevice.OPERATION_MODES.HEAT;
          break;
        case 'fan_only':
          commandValue = HaierACDevice.OPERATION_MODES.FAN;
          break;
        default:
          throw new Error(`Unsupported mode: ${mode}`);
      }

      console.log(`[${timestamp}] [Haier Evo] 📤 Sending operation mode command: ${mode} (value: ${commandValue})`);
      const propId = this.getId('mode', HaierACDevice.COMMANDS.MODE);
      const valueToSend = this.modelConfig.mapValueToHaier(this.device_model, 'mode', mode);
      await this.api.setDeviceProperty(this.mac, propId, valueToSend);

      // Update local state
      this.mode = mode;
      console.log(`[${timestamp}] [Haier Evo] ✅ Operation mode set to ${mode}`);

      // Emit event
      this.emit('modeChanged', mode);
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error setting operation mode: ${error}`);
      throw error;
    }
  }

  /**
   * Set the target temperature for the air conditioner
   * @param temp The target temperature to set
   */
  async set_temperature(temp: number): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 🌡️ Setting temperature for ${this.device_name} to ${temp}°C`);

    try {
      // Format the temperature value with 2 decimal places
      const tempValue = temp.toFixed(2);

      console.log(`[${timestamp}] [Haier Evo] 📤 Sending temperature command: ${tempValue}°C`);
      const propId = this.getId('target_temperature', HaierACDevice.COMMANDS.TEMPERATURE);
      await this.api.setDeviceProperty(this.mac, propId, tempValue);

      // Update local state
      this.target_temperature = temp;
      console.log(`[${timestamp}] [Haier Evo] ✅ Temperature set to ${temp}°C`);

      // Emit event
      this.emit('temperatureChanged', temp);
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error setting temperature: ${error}`);
      throw error;
    }
  }

    /**
   * Set the light state for the air conditioner
   * @param value true to turn on, false to turn off
   */
  async set_light(value: boolean): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 💡 Setting light for ${this.device_name} to ${value ? 'ON' : 'OFF'}`);
    console.log(`[${timestamp}] [Haier Evo] 📊 Device details: MAC=${this.mac}, ID=${this.device_id}, Type=${this.device_type}`);

    try {
      // Log current state before change
      console.log(`[${timestamp}] [Haier Evo] 🔍 Current light state: ${this.light_on ? 'ON' : 'OFF'}`);

      // Send command via WebSocket
      const propId = this.getId('light', HaierACDevice.COMMANDS.LIGHT);
      await this.api.setDeviceProperty(this.mac, propId, value);

      // Update local state
      this.light_on = value;
      console.log(`[${timestamp}] [Haier Evo] ✅ Light state updated to: ${this.light_on ? 'ON' : 'OFF'}`);

      // Emit event
      this.emit('lightChanged', value);
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error setting light: ${error}`);
      throw error;
    }
  }

  /**
   * Turn on the air conditioner
   */
  async switch_on(): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 🔌 Turning ON device ${this.device_name}`);

    try {
      // Then turn on the device using WebSocket API
      console.log(`[${timestamp}] [Haier Evo] 📤 Sending power ON command`);
      const propId = this.getId('status', HaierACDevice.COMMANDS.POWER);
      await this.api.setDeviceProperty(this.mac, propId, true);

      // Update local state
      this.status = 1;
      console.log(`[${timestamp}] [Haier Evo] ✅ Device powered ON successfully`);

      // Emit event
      this.emit('powerChanged', true);
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error turning device ON: ${error}`);
      throw error;
    }
  }

  /**
   * Turn off the air conditioner
   */
  async switch_off(): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 🔌 Turning OFF device ${this.device_name}`);

    try {
      // Send power off command using WebSocket API
      console.log(`[${timestamp}] [Haier Evo] 📤 Sending power OFF command`);
      const propId = this.getId('status', HaierACDevice.COMMANDS.POWER);
      await this.api.setDeviceProperty(this.mac, propId, false);

      // Update local state
      this.status = 0;
      console.log(`[${timestamp}] [Haier Evo] ✅ Device powered OFF successfully`);

      // Emit event
      this.emit('powerChanged', false);
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error turning device OFF: ${error}`);
      throw error;
    }
  }

  /**
   * Set the fan speed mode for the air conditioner
   * @param mode The fan mode to set (high, medium, low, auto)
   */
  async set_fan_mode(mode: string): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 💨 Setting fan mode for ${this.device_name} to ${mode}`);

    if (!this.isValidFanMode(mode)) {
      const error = `Invalid fan mode: ${mode}`;
      console.error(`[${timestamp}] [Haier Evo] ❌ ${error}`);
      throw new Error(error);
    }

    try {
      // Map fan mode string to command value
      let commandValue: string;
      switch (mode) {
        case 'high':
          commandValue = HaierACDevice.FAN_SPEEDS.FAST;
          break;
        case 'medium':
          commandValue = HaierACDevice.FAN_SPEEDS.MEDIUM;
          break;
        case 'low':
          commandValue = HaierACDevice.FAN_SPEEDS.SLOW;
          break;
        case 'auto':
          commandValue = HaierACDevice.FAN_SPEEDS.AUTO;
          break;
        default:
          throw new Error(`Unsupported fan mode: ${mode}`);
      }

      console.log(`[${timestamp}] [Haier Evo] 📤 Sending fan mode command: ${mode} (value: ${commandValue})`);
      const propId = this.getId('fan_mode', HaierACDevice.COMMANDS.FAN_SPEED);
      const valueToSend = this.modelConfig.mapValueToHaier(this.device_model, 'fan_mode', mode);
      await this.api.setDeviceProperty(this.mac, propId, valueToSend || commandValue);

      // Update local state
      this.fan_mode = mode;
      console.log(`[${timestamp}] [Haier Evo] ✅ Fan mode set to ${mode}`);

      // Emit event
      this.emit('fanModeChanged', mode);
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error setting fan mode: ${error}`);
      throw error;
    }
  }

  // Enhanced swing control
  /**
   * Set the swing mode for the air conditioner
   * @param mode The swing mode to set (off, upper, position_1, bottom, position_2, position_3, position_4, position_5, auto, special)
   */
    /**
   * Set the swing mode for the air conditioner's vertical blinds
   * This method supports both string mode names and numeric tilt angles
   * @param mode The swing mode to set ('off', 'upper', 'position_1', etc.) or a tilt angle (-90 to 90)
   */
  async set_swing_mode(mode: string | number): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 🔄 Setting vertical blinds for ${this.device_name} to ${mode}`);

    let commandValue: string;

    // Handle numeric tilt angle input (for HomeKit Slats service)
    if (typeof mode === 'number') {
      // Convert tilt angle (-90 to 90) to swing mode command (0 to 9)
      commandValue = this.tiltAngleToCommandValue(mode);
      console.log(`[${timestamp}] [Haier Evo] ℹ️ Converted tilt angle ${mode}° to command value ${commandValue}`);

      // Update mode to be the string representation for our internal state
      mode = this.commandValueToSwingMode(commandValue);
    } else {
      // Handle string mode input
      if (!this.isValidSwingMode(mode)) {
        const error = `Invalid swing mode: ${mode}`;
        console.error(`[${timestamp}] [Haier Evo] ❌ ${error}`);
        throw new Error(error);
      }

      // Map swing mode string to command value
      switch (mode) {
        case 'off':
          commandValue = '0';
          break;
        case 'upper':
          commandValue = '1';
          break;
        case 'position_1':
          commandValue = '2';
          break;
        case 'bottom':
          commandValue = '3';
          break;
        case 'position_2':
          commandValue = '4';
          break;
        case 'position_3':
          commandValue = '5';
          break;
        case 'position_4':
          commandValue = '6';
          break;
        case 'position_5':
          commandValue = '7';
          break;
        case 'auto':
          commandValue = '8';
          break;
        case 'special':
          commandValue = '9';
          break;
        default:
          throw new Error(`Unsupported swing mode: ${mode}`);
      }
    }

    try {
      console.log(`[${timestamp}] [Haier Evo] 📤 Sending vertical blinds command: ${mode} (value: ${commandValue})`);
      await this.api.setDeviceProperty(this.mac, HaierACDevice.COMMANDS.VERTICAL_SWING, commandValue);

      // Update local state
      this.swing_mode = mode as string;
      console.log(`[${timestamp}] [Haier Evo] ✅ Vertical blinds set to ${mode}`);

      // Emit events
      this.emit('swingModeChanged', mode);
      this.emit('verticalBlindsChanged', {
        mode: mode,
        commandValue: commandValue,
        tiltAngle: this.swingModeToTiltAngle(mode as string)
      });
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error setting vertical blinds: ${error}`);
      throw error;
    }
  }

  /**
   * Set the tilt angle for the vertical blinds
   * This method is specifically for HomeKit integration via the Slats service
   * @param angle The tilt angle in degrees (-90 to 90)
   */
  async set_tilt_angle(angle: number): Promise<void> {
    return this.set_swing_mode(angle);
  }

  /**
   * Get the current tilt angle based on the current swing mode
   * @returns The current tilt angle in degrees (-90 to 90)
   */
  get_tilt_angle(): number {
    return this.swingModeToTiltAngle(this.swing_mode);
  }

  /**
   * Check if the device is in swing mode (auto)
   * @returns true if in swing mode, false otherwise
   */
  is_in_swing_mode(): boolean {
    return this.swing_mode === 'auto';
  }

  /**
   * Set the swing mode (auto) for continuous movement of vertical blinds
   * @param enabled true to enable swing mode, false to disable
   */
  async set_swing_enabled(enabled: boolean): Promise<void> {
    if (enabled) {
      return this.set_swing_mode('auto');
    } else {
      // Default to middle position when disabling swing
      return this.set_swing_mode('position_3');
    }
  }

  // Enhanced preset mode controls
        /**
   * Set the quiet mode (mute) for the air conditioner
   * @param enabled true to enable quiet mode, false to disable
   */
  async set_quiet_mode(enabled: boolean): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 🔇 Setting quiet mode for ${this.device_name} to ${enabled ? 'ON' : 'OFF'}`);

    try {
      if (enabled) {
        await this.api.setDeviceProperty(this.mac, HaierACDevice.COMMANDS.QUIET, true);

        // Update local states
        this.quiet = enabled;
        this.turbo = false;

        // Emit events
        this.emit('quietModeChanged', enabled);
        this.emit('turboModeChanged', false);
      } else {
        // If disabling quiet mode, just send a single command
        console.log(`[${timestamp}] [Haier Evo] 📤 Sending quiet mode command: OFF`);
        await this.api.setDeviceProperty(this.mac, HaierACDevice.COMMANDS.QUIET, false);

        // Update local state
        this.quiet = false;

        // Emit event
        this.emit('quietModeChanged', false);
      }

      console.log(`[${timestamp}] [Haier Evo] ✅ Quiet mode operation completed successfully`);
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error setting quiet mode: ${error}`);
      throw error;
    }
  }

        /**
   * Set the turbo mode (rapid mode) for the air conditioner
   * @param enabled true to enable turbo mode, false to disable
   */
  async set_turbo_mode(enabled: boolean): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 🚀 Setting turbo mode for ${this.device_name} to ${enabled ? 'ON' : 'OFF'}`);

    try {
      if (enabled) {
        await this.api.setDeviceProperty(this.mac, HaierACDevice.COMMANDS.TURBO, true);

        // Update local states
        this.turbo = enabled;
        this.quiet = false;

        // Emit events
        this.emit('turboModeChanged', enabled);
        this.emit('quietModeChanged', false);
      } else {
        // If disabling turbo mode, just send a single command
        console.log(`[${timestamp}] [Haier Evo] 📤 Sending turbo mode command: OFF`);
        await this.api.setDeviceProperty(this.mac, HaierACDevice.COMMANDS.TURBO, false);

        // Update local state
        this.turbo = false;

        // Emit event
        this.emit('turboModeChanged', false);
      }

      console.log(`[${timestamp}] [Haier Evo] ✅ Turbo mode operation completed successfully`);
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error setting turbo mode: ${error}`);
      throw error;
    }
  }

  /**
   * Set the comfort mode (silent sleep) for the air conditioner
   * @param enabled true to enable comfort mode, false to disable
   */
  async set_comfort_mode(enabled: boolean): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 😴 Setting comfort mode for ${this.device_name} to ${enabled ? 'ON' : 'OFF'}`);

    try {
      console.log(`[${timestamp}] [Haier Evo] 📤 Sending comfort mode command: ${enabled ? 'ON' : 'OFF'}`);
      await this.api.setDeviceProperty(this.mac, HaierACDevice.COMMANDS.COMFORT, enabled);

      // Update local state
      this.comfort = enabled;
      console.log(`[${timestamp}] [Haier Evo] ✅ Comfort mode set to ${enabled ? 'ON' : 'OFF'}`);

      // Emit event
      this.emit('comfortModeChanged', enabled);
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error setting comfort mode: ${error}`);
      throw error;
    }
  }

  /**
   * Set the health mode for the air conditioner
   * @param enabled true to enable health mode, false to disable
   */
  async set_health_mode(enabled: boolean): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] 🌿 Setting health mode for ${this.device_name} to ${enabled ? 'ON' : 'OFF'}`);

    try {
      console.log(`[${timestamp}] [Haier Evo] 📤 Sending health mode command: ${enabled ? 'ON' : 'OFF'}`);
      await this.api.setDeviceProperty(this.mac, HaierACDevice.COMMANDS.HEALTH, enabled);

      // Update local state
      this.health = enabled;
      console.log(`[${timestamp}] [Haier Evo] ✅ Health mode set to ${enabled ? 'ON' : 'OFF'}`);

      // Emit event
      this.emit('healthModeChanged', enabled);
    } catch (error) {
      console.error(`[${timestamp}] [Haier Evo] ❌ Error setting health mode: ${error}`);
      throw error;
    }
  }

  // Light control is now handled by set_light method defined above

    /**
   * Sound mode has been removed as requested
   * @param enabled This parameter is ignored
   */
  override async set_sound(enabled: boolean): Promise<void> {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Haier Evo] Sound mode has been removed from the plugin`);
  }

  async set_cleaning(enabled: boolean): Promise<void> {
    const command = {
      commandName: HaierACDevice.COMMANDS.CLEANING,
      values: [enabled.toString()]
    };

    await this.sendCommand(command);
    this.cleaning = enabled;
    this.emit('cleaningChanged', enabled);
  }

  async set_antifreeze(enabled: boolean): Promise<void> {
    const command = {
      commandName: HaierACDevice.COMMANDS.ANTIFREEZE,
      values: [enabled.toString()]
    };

    await this.sendCommand(command);
    this.antifreeze = enabled;
    this.emit('antifreezeChanged', enabled);
  }

  async set_autohumidity(enabled: boolean): Promise<void> {
    const command = {
      commandName: HaierACDevice.COMMANDS.AUTOHUMIDITY,
      values: [enabled.toString()]
    };

    await this.sendCommand(command);
    this.autohumidity = enabled;
    this.emit('autohumidityChanged', enabled);
  }

  // Enhanced status update from AC data
  updateFromStatus(status: unknown) {
    console.log(`[${new Date().toLocaleString()}] [Haier Evo] Updating AC status for ${this.device_name}`);

    // Log the raw status data (truncated if large)
    const statusStr = JSON.stringify(status);
    console.log(`[${new Date().toLocaleString()}] [Haier Evo] Raw status data for ${this.device_name}:`,
      statusStr.length > 200 ? statusStr.substring(0, 200) + '...' : statusStr);

    // Handle WebSocket status updates (property ID based)
    if (status && typeof status === 'object' && 'properties' in status && status.properties) {
      // This is a WebSocket status update with property IDs
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Processing WebSocket status update for ${this.device_name}`);
      this.updateFromWebSocketStatus(status.properties as Record<string, unknown>);
      return;
    }

    // Handle traditional API status updates (attribute based)
    if (status && typeof status === 'object' && 'attributes' in status && status.attributes && Array.isArray(status.attributes)) {
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Processing attribute-based status update for ${this.device_name}`);
      this.updateFromAttributeStatus(status.attributes);
      return;
    }

    // Handle status field directly (for online/offline status)
    if (status && typeof status === 'object' && 'status' in status) {
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Processing status update for ${this.device_name}: ${status.status}`);
      const newStatus = Number(status.status);
      if (this.status !== newStatus) {
        const oldStatus = this.status;
        this.status = newStatus;
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] Device ${this.device_name} status changed from ${oldStatus} to ${this.status}`);
        this.emit('statusChanged', this.status);
      }
      return;
    }

    // Handle direct property updates (fallback)
    console.log(`[${new Date().toLocaleString()}] [Haier Evo] Processing direct status update for ${this.device_name}`);
    this.updateFromDirectStatus(status);
  }

  private updateFromWebSocketStatus(properties: Record<string, unknown>) {
    console.log(`[${new Date().toLocaleString()}] [Haier Evo] Processing WebSocket properties for ${this.device_name}:`, JSON.stringify(properties, null, 2));

    const changes: Record<string, { old: any, new: any }> = {};

    Object.entries(properties).forEach(([propertyId, value]) => {
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Processing WebSocket property ${propertyId} = ${value}`);

      switch (propertyId) {
        case '0': { // targetTemperature
          const targetTemp = parseFloat(value as string);
          if (!isNaN(targetTemp)) {
            if (this.target_temperature !== targetTemp) {
              changes.target_temperature = { old: this.target_temperature, new: targetTemp };
              this.target_temperature = targetTemp;
            }
          }
          break;
        }

        case '36': { // indoorTemperature
          const currentTemp = parseFloat(value as string);
          if (!isNaN(currentTemp) && currentTemp >= -50 && currentTemp <= 100) {
            if (this.current_temperature !== currentTemp) {
              changes.current_temperature = { old: this.current_temperature, new: currentTemp };
              this.current_temperature = currentTemp;
            }
          }
          break;
        }

        case '2': { // operationMode
          const mode = this.mapOperationMode(value as string);
          if (mode !== this.mode) {
            changes.mode = { old: this.mode, new: mode };
            this.mode = mode;
          }
          break;
        }

        case '4': { // windSpeed (fan speed)
          const fanMode = this.mapFanMode(value as string);
          if (fanMode !== this.fan_mode) {
            changes.fan_mode = { old: this.fan_mode, new: fanMode };
            this.fan_mode = fanMode;
          }
          break;
        }

        case '21': { // onOffStatus
          const newStatus = value === '1' ? 1 : 0;
          if (newStatus !== this.status) {
            changes.status = { old: this.status, new: newStatus };
            this.status = newStatus;
          }
          break;
        }

        case '1': { // windDirectionVertical (vertical swing)
          const swingMode = this.mapVerticalSwingMode(value as string);
          if (swingMode !== this.swing_mode) {
            changes.swing_mode = { old: this.swing_mode, new: swingMode };
            this.swing_mode = swingMode;

            // Emit events for vertical blinds changes
            const timestamp = new Date().toLocaleString();
            console.log(`[${timestamp}] [Haier Evo] 🔄 Vertical blinds changed from ${changes.swing_mode.old} to ${changes.swing_mode.new}`);

            // Calculate tilt angle for the new swing mode
            const tiltAngle = this.swingModeToTiltAngle(swingMode);

            // Emit events
            this.emit('swingModeChanged', swingMode);
            this.emit('verticalBlindsChanged', {
              mode: swingMode,
              commandValue: value,
              tiltAngle: tiltAngle
            });
          }
          break;
        }

        case '16': { // silentSleepStatus (comfort sleep)
          const sleepMode = value === '1';
          if (sleepMode !== this.preset_mode_sleep) {
            changes.preset_mode_sleep = { old: this.preset_mode_sleep, new: sleepMode };
            this.preset_mode_sleep = sleepMode;
          }
          break;
        }

        case '17': { // muteStatus (quiet mode)
          const quietMode = value === '1';
          if (quietMode !== this.quiet) {
            changes.quiet = { old: this.quiet, new: quietMode };
            this.quiet = quietMode;

            // If quiet mode is enabled, automatically update turbo mode state to false
            if (quietMode) {
              console.log(`[${new Date().toLocaleString()}] [Haier Evo] ℹ️ Quiet mode enabled from WebSocket, updating turbo mode state to OFF`);
              changes.turbo = { old: this.turbo, new: false };
              this.turbo = false;
            }
          }
          break;
        }

        case '18': { // rapidMode (turbo)
          const turboMode = value === '1';
          if (turboMode !== this.turbo) {
            changes.turbo = { old: this.turbo, new: turboMode };
            this.turbo = turboMode;

            // If turbo mode is enabled, automatically update quiet mode state to false
            if (turboMode) {
              console.log(`[${new Date().toLocaleString()}] [Haier Evo] ℹ️ Turbo mode enabled from WebSocket, updating quiet mode state to OFF`);
              changes.quiet = { old: this.quiet, new: false };
              this.quiet = false;
            }
          }
          break;
        }

        case '20': { // healthMode
          const healthMode = value === '1';
          if (healthMode !== this.health) {
            changes.health = { old: this.health, new: healthMode };
            this.health = healthMode;
          }
          break;
        }

        case '13': { // 10degreeHeatingStatus (antifreeze)
          const antifreezeMode = value === '1';
          if (antifreezeMode !== this.antifreeze) {
            changes.antifreeze = { old: this.antifreeze, new: antifreezeMode };
            this.antifreeze = antifreezeMode;
          }
          break;
        }

        case '6': // selfCleaning56Status (sterile cleaning)
        case '31': { // selfCleaningStatus (self cleaning) and autoHumidity
          const cleaningMode = value === '1';
          if (cleaningMode !== this.cleaning) {
            changes.cleaning = { old: this.cleaning, new: cleaningMode };
            this.cleaning = cleaningMode;
          }
          // Also handle autoHumidity for case '31'
          const autoHumidityMode = value === '1';
          if (autoHumidityMode !== this.autohumidity) {
            changes.autohumidity = { old: this.autohumidity, new: autoHumidityMode };
            this.autohumidity = autoHumidityMode;
          }
          break;
        }

        case '12': { // screenDisplayStatus (light)
          const timestamp = new Date().toLocaleString();
          console.log(`[${timestamp}] [Haier Evo] 💡 Processing light property update: value=${value}`);

          const lightMode = value === '1';
          if (lightMode !== this.light_on) {
            changes.light = { old: this.light_on, new: lightMode };
            console.log(`[${timestamp}] [Haier Evo] 🔄 Light state changing from ${this.light_on ? 'ON' : 'OFF'} to ${lightMode ? 'ON' : 'OFF'}`);

            this.light_on = lightMode;
            this.emit('lightChanged', this.light_on);
          } else {
            console.log(`[${timestamp}] [Haier Evo] ℹ️ Light state unchanged: ${this.light_on ? 'ON' : 'OFF'}`);
          }
          break;
        }

        case '14': { // sound signal - property handling removed as requested
          // Sound mode functionality has been removed
          break;
        }

        default:
          // Unknown property ID - log it for debugging
          console.log(`[${new Date().toLocaleString()}] [Haier Evo] Unknown property ID: ${propertyId} = ${value}`);
          break;
      }
    });

    // Log changes if any were detected
    if (Object.keys(changes).length > 0) {
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] AC ${this.device_name} WebSocket status changes:`, JSON.stringify(changes, null, 2));
    } else {
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] No WebSocket status changes detected for ${this.device_name}`);
    }
  }

  private updateFromAttributeStatus(attributes: unknown[]) {
    // Track changes to emit events later
    const changes: Record<string, { old: any, new: any }> = {};

    attributes.forEach(attr => {
      if (attr && typeof attr === 'object' && 'name' in attr && 'currentValue' in attr) {
        const { name, currentValue } = attr as { name: string; currentValue: string };

        switch (name) {
          case '0': { // targetTemperature
            const targetTemp = parseFloat(currentValue);
            if (!isNaN(targetTemp) && targetTemp >= this.min_temperature && targetTemp <= this.max_temperature) {
              if (this.target_temperature !== targetTemp) {
                changes.target_temperature = { old: this.target_temperature, new: targetTemp };
                this.target_temperature = targetTemp;
              }
            }
            break;
          }

          case '36': { // indoorTemperature
            const currentTemp = parseFloat(currentValue);
            if (!isNaN(currentTemp) && currentTemp >= -50 && currentTemp <= 100) {
              if (this.current_temperature !== currentTemp) {
                changes.current_temperature = { old: this.current_temperature, new: currentTemp };
                this.current_temperature = currentTemp;
              }
            }
            break;
          }

          case '2': { // operationMode
            const newMode = this.mapOperationMode(currentValue);
            if (this.mode !== newMode) {
              changes.mode = { old: this.mode, new: newMode };
              this.mode = newMode;
            }
            break;
          }

          case '4': { // windSpeed
            const newFanMode = this.mapFanMode(currentValue);
            if (this.fan_mode !== newFanMode) {
              changes.fan_mode = { old: this.fan_mode, new: newFanMode };
              this.fan_mode = newFanMode;
            }
            break;
          }

          case '21': { // onOffStatus
            const newStatus = currentValue === '1' ? 1 : 0;
            if (this.status !== newStatus) {
              changes.status = { old: this.status, new: newStatus };
              this.status = newStatus;
            }
            break;
          }

          case '1': { // windDirectionVertical
            const newSwingMode = this.mapVerticalSwingMode(currentValue);
            if (this.swing_mode !== newSwingMode) {
              changes.swing_mode = { old: this.swing_mode, new: newSwingMode };
              this.swing_mode = newSwingMode;

              // Calculate tilt angle for the new swing mode
              const tiltAngle = this.swingModeToTiltAngle(newSwingMode);

              // Emit specific events for vertical blinds
              this.emit('swingModeChanged', newSwingMode);
              this.emit('verticalBlindsChanged', {
                mode: newSwingMode,
                commandValue: currentValue,
                tiltAngle: tiltAngle
              });
            }
            break;
          }

          case '16': { // silentSleepStatus
            const newValue = currentValue === '1';
            if (this.preset_mode_sleep !== newValue) {
              changes.preset_mode_sleep = { old: this.preset_mode_sleep, new: newValue };
              this.preset_mode_sleep = newValue;
            }
            break;
          }

          case '17': { // muteStatus
            const newValue = currentValue === '1';
            if (this.quiet !== newValue) {
              changes.quiet = { old: this.quiet, new: newValue };
              this.quiet = newValue;
            }
            break;
          }

          case '18': { // rapidMode
            const newValue = currentValue === '1';
            if (this.turbo !== newValue) {
              changes.turbo = { old: this.turbo, new: newValue };
              this.turbo = newValue;
            }
            break;
          }

          case '20': { // healthMode
            const newValue = currentValue === '1';
            if (this.health !== newValue) {
              changes.health = { old: this.health, new: newValue };
              this.health = newValue;
            }
            break;
          }

          case '13': { // 10degreeHeatingStatus
            const newValue = currentValue === '1';
            if (this.antifreeze !== newValue) {
              changes.antifreeze = { old: this.antifreeze, new: newValue };
              this.antifreeze = newValue;
            }
            break;
          }

          case '6': // selfCleaning56Status
          case '31': { // selfCleaningStatus and autoHumidity
            const newValue = currentValue === '1';
            if (this.cleaning !== newValue) {
              changes.cleaning = { old: this.cleaning, new: newValue };
              this.cleaning = newValue;
            }
            if (this.autohumidity !== newValue) {
              changes.autohumidity = { old: this.autohumidity, new: newValue };
              this.autohumidity = newValue;
            }
            break;
          }

          case '12': { // screenDisplayStatus
            const newValue = currentValue === '1';
            if (this.light !== newValue) {
              changes.light = { old: this.light, new: newValue };
              this.light = newValue;
            }
            break;
          }

          case '14': { // sound signal - property handling removed as requested
            // Sound mode functionality has been removed
            break;
          }
        }
      }
    });

    // Update available status based on current status
    const oldAvailable = this.available;
    this.available = this.status > 0;

    if (oldAvailable !== this.available) {
      changes.available = { old: oldAvailable, new: this.available };
    }

    // Log changes if any were detected
    if (Object.keys(changes).length > 0) {
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] AC ${this.device_name} attribute status changes:`, JSON.stringify(changes, null, 2));

      // Emit events for each changed property
      if (changes.target_temperature) {
        this.emit('temperatureChanged', this.target_temperature);
      }

      if (changes.mode) {
        this.emit('modeChanged', this.mode);
      }

      if (changes.fan_mode) {
        this.emit('fanModeChanged', this.fan_mode);
      }

      if (changes.status) {
        this.emit('powerChanged', this.status > 0);
      }

      if (changes.quiet) {
        this.emit('quietModeChanged', this.quiet);
      }

      if (changes.turbo) {
        this.emit('turboModeChanged', this.turbo);
      }

      if (changes.comfort) {
        this.emit('comfortModeChanged', this.comfort);
      }

      if (changes.health) {
        this.emit('healthModeChanged', this.health);
      }

      if (changes.light) {
        this.emit('lightChanged', this.light);
      }

      if (changes.cleaning) {
        this.emit('cleaningChanged', this.cleaning);
      }

      if (changes.antifreeze) {
        this.emit('antifreezeChanged', this.antifreeze);
      }

      if (changes.autohumidity) {
        this.emit('autohumidityChanged', this.autohumidity);
      }
    } else {
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] No attribute status changes detected for ${this.device_name}`);
    }
  }

    private updateFromDirectStatus(status: unknown) {
    // Check if status is empty or undefined
    if (!status || (typeof status === 'object' && Object.keys(status as object).length === 0)) {
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Warning: Empty status data for ${this.device_name}, using cached values`);
      console.log(`[${new Date().toLocaleString()}] [Haier Evo] Will wait for WebSocket updates for device ${this.device_name}`);
      return;
    }

    console.log(`[${new Date().toLocaleString()}] [Haier Evo] Processing direct status update for ${this.device_name}:`,
      JSON.stringify(status).length > 200 ? JSON.stringify(status).substring(0, 200) + '...' : JSON.stringify(status));

    // Handle direct property updates (fallback)
    if (typeof status === 'object') {
      const statusObj = status as Record<string, unknown>;
      const changes: Record<string, { old: any, new: any }> = {};

      if (statusObj.target_temperature !== undefined) {
        const targetTemp = parseFloat(String(statusObj.target_temperature));
        if (!isNaN(targetTemp)) {
          if (this.target_temperature !== targetTemp) {
            changes.target_temperature = { old: this.target_temperature, new: targetTemp };
            this.target_temperature = targetTemp;
          }
        }
      }

      if (statusObj.current_temperature !== undefined) {
        const currentTemp = parseFloat(String(statusObj.current_temperature));
        if (!isNaN(currentTemp) && currentTemp >= -50 && currentTemp <= 100) {
          if (this.current_temperature !== currentTemp) {
            changes.current_temperature = { old: this.current_temperature, new: currentTemp };
            this.current_temperature = currentTemp;
          }
        }
      }

      if (statusObj.mode !== undefined && this.mode !== String(statusObj.mode)) {
        changes.mode = { old: this.mode, new: String(statusObj.mode) };
        this.mode = String(statusObj.mode);
      }

      if (statusObj.fan_mode !== undefined && this.fan_mode !== String(statusObj.fan_mode)) {
        changes.fan_mode = { old: this.fan_mode, new: String(statusObj.fan_mode) };
        this.fan_mode = String(statusObj.fan_mode);
      }

      if (statusObj.status !== undefined) {
        const newStatus = Number(statusObj.status);
        if (this.status !== newStatus) {
          changes.status = { old: this.status, new: newStatus };
          this.status = newStatus;
        }
      }

      if (statusObj.swing_mode !== undefined && this.swing_mode !== String(statusObj.swing_mode)) {
        const newSwingMode = String(statusObj.swing_mode);
        changes.swing_mode = { old: this.swing_mode, new: newSwingMode };
        this.swing_mode = newSwingMode;

        // Emit events for vertical blinds changes
        const timestamp = new Date().toLocaleString();
        console.log(`[${timestamp}] [Haier Evo] 🔄 Vertical blinds direct update from ${changes.swing_mode.old} to ${changes.swing_mode.new}`);

        // Calculate tilt angle for the new swing mode
        const tiltAngle = this.swingModeToTiltAngle(newSwingMode);

        // Emit events
        this.emit('swingModeChanged', newSwingMode);
        this.emit('verticalBlindsChanged', {
          mode: newSwingMode,
          tiltAngle: tiltAngle
        });
      }

      if (statusObj.preset_mode_sleep !== undefined) {
        const newValue = Boolean(statusObj.preset_mode_sleep);
        if (this.preset_mode_sleep !== newValue) {
          changes.preset_mode_sleep = { old: this.preset_mode_sleep, new: newValue };
          this.preset_mode_sleep = newValue;
        }
      }

      if (statusObj.quiet !== undefined) {
        const newValue = Boolean(statusObj.quiet);
        if (this.quiet !== newValue) {
          changes.quiet = { old: this.quiet, new: newValue };
          this.quiet = newValue;
        }
      }

      if (statusObj.turbo !== undefined) {
        const newValue = Boolean(statusObj.turbo);
        if (this.turbo !== newValue) {
          changes.turbo = { old: this.turbo, new: newValue };
          this.turbo = newValue;
        }
      }

      if (statusObj.health !== undefined) {
        const newValue = Boolean(statusObj.health);
        if (this.health !== newValue) {
          changes.health = { old: this.health, new: newValue };
          this.health = newValue;
        }
      }

      if (statusObj.antifreeze !== undefined) {
        const newValue = Boolean(statusObj.antifreeze);
        if (this.antifreeze !== newValue) {
          changes.antifreeze = { old: this.antifreeze, new: newValue };
          this.antifreeze = newValue;
        }
      }

      if (statusObj.cleaning !== undefined) {
        const newValue = Boolean(statusObj.cleaning);
        if (this.cleaning !== newValue) {
          changes.cleaning = { old: this.cleaning, new: newValue };
          this.cleaning = newValue;
        }
      }

      if (statusObj.autohumidity !== undefined) {
        const newValue = Boolean(statusObj.autohumidity);
        if (this.autohumidity !== newValue) {
          changes.autohumidity = { old: this.autohumidity, new: newValue };
          this.autohumidity = newValue;
        }
      }

      if (statusObj.light !== undefined) {
        const newValue = Boolean(statusObj.light);
        if (this.light !== newValue) {
          changes.light = { old: this.light, new: newValue };
          this.light = newValue;
        }
      }

      // Sound mode functionality has been removed as requested
      // if (statusObj.sound !== undefined) { ... }

      // Update available status based on current status
      const oldAvailable = this.available;
      this.available = this.status > 0;

      if (oldAvailable !== this.available) {
        changes.available = { old: oldAvailable, new: this.available };
      }

      // Log changes if any were detected
      if (Object.keys(changes).length > 0) {
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] AC ${this.device_name} direct status changes:`, JSON.stringify(changes, null, 2));
      } else {
        console.log(`[${new Date().toLocaleString()}] [Haier Evo] No direct status changes detected for ${this.device_name}`);
      }

      // Call the base class updateFromStatus to handle device information and other base properties
      super.updateFromStatus(status as any);
    }
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

  /**
   * Map a vertical swing value from the API to a swing mode string
   * @param swingValue The swing value from the API
   * @returns The corresponding swing mode string
   */
  private mapVerticalSwingMode(swingValue: string): string {
    return this.commandValueToSwingMode(swingValue);
  }

  /**
   * Convert a command value to a swing mode string
   * @param commandValue The command value ('0' to '9')
   * @returns The corresponding swing mode string
   */
  private commandValueToSwingMode(commandValue: string): string {
    const swingMap: { [key: string]: string } = {
      '0': 'off',
      '1': 'upper',
      '2': 'position_1',
      '3': 'bottom',
      '4': 'position_2',
      '5': 'position_3',
      '6': 'position_4',
      '7': 'position_5',
      '8': 'auto',
      '9': 'special'
    };
    return swingMap[commandValue] || 'auto';
  }

  /**
   * Convert a tilt angle to a command value
   * @param angle The tilt angle in degrees (-90 to 90)
   * @returns The corresponding command value ('0' to '9')
   */
  private tiltAngleToCommandValue(angle: number): string {
    // Normalize angle to be between -90 and 90
    angle = Math.max(-90, Math.min(90, angle));

    // Map angle ranges to command values
    if (angle < -70) return '1';      // Upper position (-90 to -70)
    if (angle < -50) return '2';      // Position 1 (-70 to -50)
    if (angle < -30) return '4';      // Position 2 (-50 to -30)
    if (angle < -10) return '5';      // Position 3 (-30 to -10)
    if (angle < 10) return '0';       // Off/Center (-10 to 10)
    if (angle < 30) return '6';       // Position 4 (10 to 30)
    if (angle < 50) return '7';       // Position 5 (30 to 50)
    if (angle < 70) return '3';       // Bottom (50 to 70)
    return '8';                       // Auto (70 to 90)
  }

  /**
   * Convert a swing mode string to a tilt angle
   * @param mode The swing mode string
   * @returns The corresponding tilt angle in degrees (-90 to 90)
   */
  private swingModeToTiltAngle(mode: string): number {
    switch (mode) {
      case 'off': return 0;           // Center position
      case 'upper': return -90;       // Fully up
      case 'position_1': return -60;  // Position 1
      case 'bottom': return 60;       // Fully down
      case 'position_2': return -40;  // Position 2
      case 'position_3': return -20;  // Position 3
      case 'position_4': return 20;   // Position 4
      case 'position_5': return 40;   // Position 5
      case 'auto': return 90;         // Auto (swing mode)
      case 'special': return 80;      // Special mode
      default: return 0;              // Default to center
    }
  }

  // Enhanced feature support detection
  get_supported_features(): number {
    let features = 0;

    // Basic temperature control
    features |= 1; // ON_OFF
    features |= 2; // MODE
    features |= 4; // TEMPERATURE

    // Fan control
    if (this.supportsFanMode()) {
      features |= 8; // FAN_MODE
    }

    // Swing control
    if (this.supportsSwingMode()) {
      features |= 16; // SWING_MODE
    }

    // Preset modes
    if (this.supportsPresetModes()) {
      features |= 32; // PRESET_MODE
    }

    return features;
  }

  get_hvac_modes(): string[] {
    return Object.values(HVAC_MODES);
  }

  get_fan_modes(): string[] {
    return Object.values(FAN_MODES);
  }

  get_swing_modes(): string[] {
    return Object.values(SWING_MODES);
  }

  get_preset_modes(): string[] {
    const modes = [];

    if (this.supportsQuietMode()) modes.push('quiet');
    if (this.supportsTurboMode()) modes.push('turbo');
    if (this.supportsComfortMode()) modes.push('comfort');
    if (this.supportsHealthMode()) modes.push('health');
    if (this.supportsSleepMode()) modes.push('sleep');
    if (this.supportsBoostMode()) modes.push('boost');

    return modes;
  }

  // Validation methods
  private isValidHVACMode(mode: string): boolean {
    return Object.values(HVAC_MODES).includes(mode as HVACMode);
  }

  private isValidFanMode(mode: string): boolean {
    return Object.values(FAN_MODES).includes(mode as FanMode);
  }

  private isValidSwingMode(mode: string): boolean {
    return Object.values(SWING_MODES).includes(mode as SwingMode);
  }

  // Feature support methods
  private supportsFanMode(): boolean {
    return true; // AC devices always support fan control
  }

  private supportsSwingMode(): boolean {
    return true; // AC devices always support swing control
  }

  private supportsPresetModes(): boolean {
    return true; // AC devices support various preset modes
  }

  private supportsQuietMode(): boolean {
    return true;
  }

  private supportsTurboMode(): boolean {
    return true;
  }

  private supportsComfortMode(): boolean {
    return true;
  }

  private supportsHealthMode(): boolean {
    return true;
  }

  private supportsSleepMode(): boolean {
    return true;
  }

  private supportsBoostMode(): boolean {
    return true;
  }

  // Implement missing abstract methods from BaseDevice
  async set_swing_horizontal_mode(_mode: string): Promise<void> {
    // Horizontal swing not supported by this AC model
    throw new Error('Horizontal swing mode not supported by this AC device');
  }

  async set_preset_mode(mode: string): Promise<void> {
    switch (mode) {
      case 'quiet':
        await this.set_quiet_mode(true);
        break;
      case 'turbo':
        await this.set_turbo_mode(true);
        break;
      case 'comfort':
        await this.set_comfort_mode(true);
        break;
      case 'health':
        await this.set_health_mode(true);
        break;
      case 'sleep':
        await this.set_sleep_mode(true);
        break;
      case 'boost':
        await this.set_boost_mode(true);
        break;
      default:
        throw new Error(`Invalid preset mode: ${mode}`);
    }
  }

  async set_quiet(enabled: boolean): Promise<void> {
    return this.set_quiet_mode(enabled);
  }

  async set_turbo(enabled: boolean): Promise<void> {
    return this.set_turbo_mode(enabled);
  }

  async set_comfort(enabled: boolean): Promise<void> {
    return this.set_comfort_mode(enabled);
  }

  async set_health(enabled: boolean): Promise<void> {
    return this.set_health_mode(enabled);
  }

  // These methods are already implemented above with enhanced functionality

  async set_eco_sensor(_mode: string): Promise<void> {
    // Eco sensor not supported by this AC model
    throw new Error('Eco sensor mode not supported by this AC device');
  }

  async set_sleep_mode(enabled: boolean): Promise<void> {
    // Sleep mode not directly supported, use comfort mode instead
    if (enabled) {
      await this.set_comfort_mode(true);
    } else {
      await this.set_comfort_mode(false);
    }
  }

  async set_boost_mode(enabled: boolean): Promise<void> {
    // Boost mode not directly supported, use turbo mode instead
    if (enabled) {
      await this.set_turbo_mode(true);
    } else {
      await this.set_turbo_mode(false);
    }
  }
}
