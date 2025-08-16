import {
  Service,
  PlatformAccessory,
  Logger,
  CharacteristicValue
} from 'homebridge';
import { HaierEvoPlatform } from '../platform';
import { DeviceFactory } from '../device-factory';
import { HaierDevice, DeviceInfo, DeviceStatus } from '../types';

export class HaierEvoAccessory {
  private device: HaierDevice;
  private services: Service[] = [];
  private log: Logger;

  // Main service (Thermostat for AC, Switch for Refrigerator)
  private mainService: Service;

  // Additional services
  private temperatureSensorService?: Service;
  private humiditySensorService?: Service;
  private lightService?: Service;
  private fanService?: Service;
  private freezerTemperatureService?: Service;
  private myzoneTemperatureService?: Service;
  private refrigeratorDoorService?: Service;
  private freezerDoorService?: Service;
  private healthService?: Service;
  private quietService?: Service;
  private turboService?: Service;
  private comfortService?: Service;
  private powerSwitchService?: Service;

  constructor(
    private readonly platform: HaierEvoPlatform,
    public readonly accessory: PlatformAccessory,
    private deviceInfo: DeviceInfo
  ) {
    this.log = platform.log;

    // Create device instance
    this.device = DeviceFactory.createDevice(deviceInfo, platform.getHaierAPI());

    // Check if this is an existing accessory that already has services
    const isExistingAccessory = this.accessory.services.length > 1; // More than just AccessoryInformation

    if (isExistingAccessory) {
      this.log.debug(`Restoring existing accessory: ${this.deviceInfo.name}`);

      // Find existing services instead of creating new ones
      this.mainService = this.findMainService();
      this.findAdditionalServices();
    } else {
      this.log.debug(`Creating new accessory: ${this.deviceInfo.name}`);

      // Set accessory information
      this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Haier')
        .setCharacteristic(this.platform.Characteristic.Model, deviceInfo.model)
        .setCharacteristic(this.platform.Characteristic.SerialNumber, deviceInfo.id)
        .setCharacteristic(this.platform.Characteristic.FirmwareRevision, '1.0.0');

      // Create main service based on device type
      this.mainService = this.createMainService();

      // Create additional services
      this.createAdditionalServices();
    }

    // Set up event handlers
    this.setupEventHandlers();

    this.log.info(`${isExistingAccessory ? 'Restored' : 'Created'} accessory: ${this.deviceInfo.name} (${this.deviceInfo.type})`);
  }

  private findMainService(): Service {
    // Find existing main service based on device type
    if (DeviceFactory.isAirConditioner(this.device)) {
      return this.accessory.getService(this.platform.Service.Thermostat) || this.createThermostatService();
    } else if (DeviceFactory.isRefrigerator(this.device)) {
      return this.accessory.getService('refrigerator-main') || this.createRefrigeratorService();
    } else {
      // Default to switch service for unknown device types
      return this.accessory.getService(this.platform.Service.Switch) || this.createSwitchService();
    }
  }

  private findAdditionalServices(): void {
    // Find existing additional services instead of creating new ones
    this.temperatureSensorService = this.accessory.getService(this.platform.Service.TemperatureSensor);
    this.fanService = this.accessory.getService(this.platform.Service.Fanv2);
    this.lightService = this.accessory.getService(this.platform.Service.Lightbulb);

    // Find refrigerator-specific services
    this.freezerTemperatureService = this.accessory.getService('freezer-temp');
    this.myzoneTemperatureService = this.accessory.getService('myzone-temp');
    this.refrigeratorDoorService = this.accessory.getService('refrigerator-door');
    this.freezerDoorService = this.accessory.getService('freezer-door');

    // Find AC-specific services
    this.healthService = this.accessory.getService('health');
    this.quietService = this.accessory.getService('quiet');
    this.turboService = this.accessory.getService('turbo');
    this.comfortService = this.accessory.getService('comfort');
    this.powerSwitchService = this.accessory.getService('power-switch');

    // Add found services to the services array
    if (this.temperatureSensorService) this.services.push(this.temperatureSensorService);
    if (this.fanService) this.services.push(this.fanService);
    if (this.lightService) this.services.push(this.lightService);
    if (this.freezerTemperatureService) this.services.push(this.freezerTemperatureService);
    if (this.myzoneTemperatureService) this.services.push(this.myzoneTemperatureService);
    if (this.refrigeratorDoorService) this.services.push(this.refrigeratorDoorService);
    if (this.freezerDoorService) this.services.push(this.freezerDoorService);
    if (this.healthService) this.services.push(this.healthService);
    if (this.quietService) this.services.push(this.quietService);
    if (this.turboService) this.services.push(this.turboService);
    if (this.comfortService) this.services.push(this.comfortService);
    if (this.powerSwitchService) this.services.push(this.powerSwitchService);
  }

  private createMainService(): Service {
    if (DeviceFactory.isAirConditioner(this.device)) {
      return this.createThermostatService();
    } else if (DeviceFactory.isRefrigerator(this.device)) {
      return this.createRefrigeratorService();
    } else {
      // Default to switch service for unknown device types
      return this.createSwitchService();
    }
  }

  private createThermostatService(): Service {
    const service = this.accessory.addService(this.platform.Service.Thermostat, this.deviceInfo.name, 'thermostat');

    // Set up characteristics
    service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onGet(this.getTargetHeatingCoolingState.bind(this))
      .onSet(this.setTargetHeatingCoolingState.bind(this));

    service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onGet(() => this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS);

    // Set temperature range
    service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps({
        minValue: this.device.min_temperature,
        maxValue: this.device.max_temperature,
        minStep: 1
      });

    this.services.push(service);
    return service;
  }

  private createSwitchService(): Service {
    const service = this.accessory.addService(this.platform.Service.Switch, this.deviceInfo.name, 'switch');

    service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getSwitchState.bind(this))
      .onSet(this.setSwitchState.bind(this));

    this.services.push(service);
    return service;
  }

  private createRefrigeratorService(): Service {
    // Create a TemperatureSensor service as the main service for refrigerators
    // This provides temperature control without the ability to turn off
    const service = this.accessory.addService(
      this.platform.Service.TemperatureSensor,
      this.deviceInfo.name,
      'refrigerator-main'
    );

    // Set up temperature characteristics
    service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // Add target temperature characteristic for refrigerator control
    service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    // Set temperature range for refrigerator
    service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps({
        minValue: this.device.min_temperature,
        maxValue: this.device.max_temperature,
        minStep: 1
      });

    this.services.push(service);
    return service;
  }

  private createAdditionalServices(): void {
    // Temperature sensor service
    this.temperatureSensorService = this.accessory.addService(
      this.platform.Service.TemperatureSensor,
      `${this.deviceInfo.name} Temperature`,
      'temperature'
    );

    this.temperatureSensorService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.services.push(this.temperatureSensorService);

    // Fan service for AC devices
    if (DeviceFactory.isAirConditioner(this.device)) {
      this.fanService = this.accessory.addService(
        this.platform.Service.Fanv2,
        `${this.deviceInfo.name} Fan`,
        'fan'
      );

      // Use proper Fanv2 characteristics
      this.fanService.getCharacteristic(this.platform.Characteristic.Active)
        .onGet(this.getFanActiveState.bind(this))
        .onSet(this.setFanActiveState.bind(this));

      this.fanService.getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .onGet(this.getFanSpeed.bind(this))
        .onSet(this.setFanSpeed.bind(this));

      this.services.push(this.fanService);
    }

    // Light service only for AC devices that support it
    if (DeviceFactory.isAirConditioner(this.device) && this.device.light !== undefined) {
      this.lightService = this.accessory.addService(
        this.platform.Service.Lightbulb,
        `${this.deviceInfo.name} Light`,
        'light'
      );

      this.lightService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getLightState.bind(this))
        .onSet(this.setLightState.bind(this));

      this.services.push(this.lightService);
    }

    // Additional AC control services
    if (DeviceFactory.isAirConditioner(this.device)) {
      // Health mode switch
      this.healthService = this.accessory.addService(
        this.platform.Service.Switch,
        `${this.deviceInfo.name} Health Mode`,
        'health'
      );

      this.healthService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getHealthState.bind(this))
        .onSet(this.setHealthState.bind(this));

      this.services.push(this.healthService);

      // Quiet mode switch
      this.quietService = this.accessory.addService(
        this.platform.Service.Switch,
        `${this.deviceInfo.name} Quiet Mode`,
        'quiet'
      );

      this.quietService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getQuietState.bind(this))
        .onSet(this.setQuietState.bind(this));

      this.services.push(this.quietService);

      // Turbo mode switch
      this.turboService = this.accessory.addService(
        this.platform.Service.Switch,
        `${this.deviceInfo.name} Turbo Mode`,
        'turbo'
      );

      this.turboService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getTurboState.bind(this))
        .onSet(this.setTurboState.bind(this));

      this.services.push(this.turboService);

      // Comfort mode switch
      this.comfortService = this.accessory.addService(
        this.platform.Service.Switch,
        `${this.deviceInfo.name} Comfort Mode`,
        'comfort'
      );

      this.comfortService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getComfortState.bind(this))
        .onSet(this.setComfortState.bind(this));

      this.services.push(this.comfortService);

      // Power Switch service - dedicated switch for AC power control
      this.powerSwitchService = this.accessory.addService(
        this.platform.Service.Switch,
        `${this.deviceInfo.name} Power`,
        'power-switch'
      );

      this.powerSwitchService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getPowerSwitchState.bind(this))
        .onSet(this.setPowerSwitchState.bind(this));

      this.services.push(this.powerSwitchService);
    }

    // Refrigerator-specific services
    if (DeviceFactory.isRefrigerator(this.device)) {
      // Freezer temperature sensor
      this.freezerTemperatureService = this.accessory.addService(
        this.platform.Service.TemperatureSensor,
        `${this.deviceInfo.name} Freezer`,
        'freezer-temp'
      );

      this.freezerTemperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getFreezerTemperature.bind(this));

      this.services.push(this.freezerTemperatureService);

      // My Zone temperature sensor
      this.myzoneTemperatureService = this.accessory.addService(
        this.platform.Service.TemperatureSensor,
        `${this.deviceInfo.name} My Zone`,
        'myzone-temp'
      );

      this.myzoneTemperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getMyZoneTemperature.bind(this));

      this.services.push(this.myzoneTemperatureService);

      // Refrigerator door contact sensor
      this.refrigeratorDoorService = this.accessory.addService(
        this.platform.Service.ContactSensor,
        `${this.deviceInfo.name} Door`,
        'refrigerator-door'
      );

      this.refrigeratorDoorService.getCharacteristic(this.platform.Characteristic.ContactSensorState)
        .onGet(this.getRefrigeratorDoorState.bind(this));

      this.services.push(this.refrigeratorDoorService);

      // Freezer door contact sensor
      this.freezerDoorService = this.accessory.addService(
        this.platform.Service.ContactSensor,
        `${this.deviceInfo.name} Freezer Door`,
        'freezer-door'
      );

      this.freezerDoorService.getCharacteristic(this.platform.Characteristic.ContactSensorState)
        .onGet(this.getFreezerDoorState.bind(this));

      this.services.push(this.freezerDoorService);
    }
  }

  private setupEventHandlers(): void {
    // Listen for device events
    this.device.on('statusUpdated', (status) => {
      this.updateCharacteristics(status);
    });

    this.device.on('error', (error) => {
      this.log.error(`Device error: ${error}`);
    });
  }

  // Characteristic getters and setters
  private getCurrentHeatingCoolingState(): number {
    if (!this.device.available) {
      return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    }

    switch (this.device.mode) {
      case 'heat':
        return this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
      case 'cool':
        return this.platform.Characteristic.CurrentHeatingCoolingState.COOL;
      case 'auto':
        return this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
      default:
        return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    }
  }

  private getTargetHeatingCoolingState(): number {
    if (!this.device.available) {
      return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
    }

    switch (this.device.mode) {
      case 'heat':
        return this.platform.Characteristic.TargetHeatingCoolingState.HEAT;
      case 'cool':
        return this.platform.Characteristic.TargetHeatingCoolingState.COOL;
      case 'auto':
        return this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
      default:
        return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
    }
  }

  private async setTargetHeatingCoolingState(value: CharacteristicValue): Promise<void> {
    let mode: string;

    switch (value) {
      case this.platform.Characteristic.TargetHeatingCoolingState.HEAT:
        mode = 'heat';
        break;
      case this.platform.Characteristic.TargetHeatingCoolingState.COOL:
        mode = 'cool';
        break;
      case this.platform.Characteristic.TargetHeatingCoolingState.AUTO:
        mode = 'auto';
        break;
      case this.platform.Characteristic.TargetHeatingCoolingState.OFF:
        await this.device.switch_off();
        return;
      default:
        throw new Error(`Invalid heating/cooling state: ${value}`);
    }

    await this.device.switch_on(mode);
  }

  private getCurrentTemperature(): number {
    // Ensure temperature is within valid range
    const temp = this.device.current_temperature;
    if (temp < -50 || temp > 100) {
      this.log.warn(`Invalid current temperature ${temp}, using default 20`);
      return 20;
    }
    return temp;
  }

  private getTargetTemperature(): number {
    // Ensure device has proper temperature limits
    if (this.device.min_temperature === undefined || this.device.max_temperature === undefined) {
      this.log.warn(`Device ${this.deviceInfo.name} temperature limits not set, using AC defaults`);
      // Set default temperature limits for AC devices
      if (DeviceFactory.isAirConditioner(this.device)) {
        this.device.min_temperature = 16;
        this.device.max_temperature = 30;
      } else if (DeviceFactory.isRefrigerator(this.device)) {
        this.device.min_temperature = 2;
        this.device.max_temperature = 8;
      } else {
        this.device.min_temperature = 16;
        this.device.max_temperature = 30;
      }
    }

    // Ensure temperature is within device limits
    const temp = this.device.target_temperature;
    if (temp < this.device.min_temperature || temp > this.device.max_temperature) {
      const defaultTemp = Math.round((this.device.min_temperature + this.device.max_temperature) / 2);
      this.log.warn(`Invalid target temperature ${temp}, using default ${defaultTemp} (range: ${this.device.min_temperature}-${this.device.max_temperature})`);
      return defaultTemp; // Default to middle of range
    }
    return temp;
  }

  private async setTargetTemperature(value: any): Promise<void> {
    // Validate temperature value
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`Invalid temperature value: ${value}`);
    }

    // Ensure temperature is within device limits
    if (value < this.device.min_temperature || value > this.device.max_temperature) {
      throw new Error(`Temperature ${value} is outside valid range (${this.device.min_temperature}-${this.device.max_temperature})`);
    }

    await this.device.set_temperature(value);
  }

  private getSwitchState(): boolean {
    return this.device.available && this.device.status > 0;
  }

  private async setSwitchState(value: any): Promise<void> {
    if (value) {
      await this.device.switch_on();
    } else {
      await this.device.switch_off();
    }
  }

  private getFanActiveState(): number {
    return this.device.available && this.device.status > 0 ?
      this.platform.Characteristic.Active.ACTIVE :
      this.platform.Characteristic.Active.INACTIVE;
  }

  private async setFanActiveState(value: any): Promise<void> {
    if (value === this.platform.Characteristic.Active.ACTIVE) {
      await this.device.switch_on();
    } else {
      await this.device.switch_off();
    }
  }

  private getFanState(): boolean {
    return this.device.available && this.device.status > 0;
  }

  private async setFanState(value: any): Promise<void> {
    if (value) {
      await this.device.switch_on();
    } else {
      await this.device.switch_off();
    }
  }

  private getFanSpeed(): number {
    if (!this.device.available) return 0;

    switch (this.device.fan_mode) {
      case 'low':
        return 33;
      case 'medium':
        return 66;
      case 'high':
        return 100;
      case 'auto':
        return 50;
      default:
        return 0;
    }
  }

  private async setFanSpeed(value: any): Promise<void> {
    let mode: string;

    if (value <= 25) {
      mode = 'low';
    } else if (value <= 50) {
      mode = 'medium';
    } else if (value <= 75) {
      mode = 'high';
    } else {
      mode = 'auto';
    }

    await this.device.set_fan_mode(mode);
  }

  private getLightState(): boolean {
    return this.device.light || false;
  }

  private async setLightState(value: CharacteristicValue): Promise<void> {
    const boolValue = Boolean(value);
    await this.device.set_light(boolValue);
  }

  // Public methods
  public updateStatus(status: DeviceStatus): void {
    // Update device status
    this.device.updateFromStatus(status);

    // Update characteristics
    this.updateCharacteristics(status);
  }

  public updateDeviceInfo(deviceInfo: DeviceInfo): void {
    this.deviceInfo = deviceInfo;
    this.accessory.displayName = deviceInfo.name;

    // Update accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Model, deviceInfo.model);
  }

  public handleCommandResponse(response: unknown): void {
    // Handle command response if needed
    this.log.debug(`Command response: ${JSON.stringify(response)}`);
  }

  private updateCharacteristics(_status: DeviceStatus): void {
    // Update main service characteristics
    if (this.mainService) {
      if (DeviceFactory.isAirConditioner(this.device)) {
        this.mainService.updateCharacteristic(
          this.platform.Characteristic.CurrentHeatingCoolingState,
          this.getCurrentHeatingCoolingState()
        );

        this.mainService.updateCharacteristic(
          this.platform.Characteristic.TargetHeatingCoolingState,
          this.getTargetHeatingCoolingState()
        );

        this.mainService.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          this.getCurrentTemperature()
        );

        this.mainService.updateCharacteristic(
          this.platform.Characteristic.TargetTemperature,
          this.getTargetTemperature()
        );
      } else if (DeviceFactory.isRefrigerator(this.device)) {
        // Update refrigerator main service (TemperatureSensor)
        this.mainService.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          this.getCurrentTemperature()
        );

        this.mainService.updateCharacteristic(
          this.platform.Characteristic.TargetTemperature,
          this.getTargetTemperature()
        );
      } else {
        this.mainService.updateCharacteristic(
          this.platform.Characteristic.On,
          this.getSwitchState()
        );
      }
    }

    // Update temperature sensor
    if (this.temperatureSensorService) {
      this.temperatureSensorService.updateCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
        this.getCurrentTemperature()
      );
    }

    // Update fan service
    if (this.fanService) {
      this.fanService.updateCharacteristic(
        this.platform.Characteristic.Active,
        this.getFanActiveState()
      );

      this.fanService.updateCharacteristic(
        this.platform.Characteristic.RotationSpeed,
        this.getFanSpeed()
      );
    }

    // Update light service
    if (this.lightService) {
      this.lightService.updateCharacteristic(
        this.platform.Characteristic.On,
        this.getLightState()
      );
    }

    // Update additional AC characteristics if available
    if (DeviceFactory.isAirConditioner(this.device)) {
      // Update swing mode if available
      if (this.mainService && this.device.swing_mode) {
        // Note: HomeKit doesn't have a direct swing mode characteristic
        // We could add this as a custom characteristic or use a different approach
        this.log.debug(`AC Swing Mode: ${this.device.swing_mode}`);
      }

      // Update all AC mode services
      if (this.healthService) {
        this.healthService.updateCharacteristic(
          this.platform.Characteristic.On,
          this.getHealthState()
        );
      }

      if (this.quietService) {
        this.quietService.updateCharacteristic(
          this.platform.Characteristic.On,
          this.getQuietState()
        );
      }

      if (this.turboService) {
        this.turboService.updateCharacteristic(
          this.platform.Characteristic.On,
          this.getTurboState()
        );
      }

      if (this.comfortService) {
        this.comfortService.updateCharacteristic(
          this.platform.Characteristic.On,
          this.getComfortState()
        );
      }

      // Update power switch service
      if (this.powerSwitchService) {
        this.powerSwitchService.updateCharacteristic(
          this.platform.Characteristic.On,
          this.getPowerSwitchState()
        );
      }
    }
  }

  public get displayName(): string {
    return this.accessory.displayName;
  }

  public destroy(): void {
    if (this.device) {
      this.device.destroy();
    }

    // Remove all services
    for (const service of this.services) {
      this.accessory.removeService(service);
    }
    this.services = [];
  }

  // Refrigerator-specific methods
  private getFreezerTemperature(): number {
    // For now, return a default value since the property doesn't exist in the interface
    // This should be updated when the actual refrigerator properties are defined
    return -18;
  }

  private getMyZoneTemperature(): number {
    // For now, return a default value since the property doesn't exist in the interface
    // This should be updated when the actual refrigerator properties are defined
    return -5;
  }

  private getRefrigeratorDoorState(): number {
    // For now, return a default value since the property doesn't exist in the interface
    // This should be updated when the actual refrigerator properties are defined
    return this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED;
  }

  private getFreezerDoorState(): number {
    // For now, return a default value since the property doesn't exist in the interface
    // This should be updated when the actual refrigerator properties are defined
    return this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED;
  }

  // AC-specific methods
  private getHealthState(): boolean {
    return DeviceFactory.isAirConditioner(this.device) ? this.device.health || false : false;
  }

  private async setHealthState(value: CharacteristicValue): Promise<void> {
    if (DeviceFactory.isAirConditioner(this.device)) {
      const boolValue = Boolean(value);
      await this.device.set_health(boolValue);
    }
  }

  private getQuietState(): boolean {
    return DeviceFactory.isAirConditioner(this.device) ? this.device.quiet || false : false;
  }

  private async setQuietState(value: CharacteristicValue): Promise<void> {
    if (DeviceFactory.isAirConditioner(this.device)) {
      const boolValue = Boolean(value);
      await this.device.set_quiet(boolValue);
    }
  }

  private getTurboState(): boolean {
    return DeviceFactory.isAirConditioner(this.device) ? this.device.turbo || false : false;
  }

  private async setTurboState(value: CharacteristicValue): Promise<void> {
    if (DeviceFactory.isAirConditioner(this.device)) {
      const boolValue = Boolean(value);
      await this.device.set_turbo(boolValue);
    }
  }

  private getComfortState(): boolean {
    return DeviceFactory.isAirConditioner(this.device) ? this.device.comfort || false : false;
  }

  private async setComfortState(value: CharacteristicValue): Promise<void> {
    if (DeviceFactory.isAirConditioner(this.device)) {
      const boolValue = Boolean(value);
      await this.device.set_comfort(boolValue);
    }
  }

  // Power Switch service methods
  private getPowerSwitchState(): boolean {
    return this.device.available && this.device.status > 0;
  }

  private async setPowerSwitchState(value: CharacteristicValue): Promise<void> {
    const boolValue = Boolean(value);

    if (boolValue) {
      // Turn on with the current mode
      await this.device.switch_on();
    } else {
      // Turn off
      await this.device.switch_off();
    }
  }
}
