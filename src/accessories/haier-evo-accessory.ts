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
  private _accessoryName: string;

  // Main service (HeaterCooler for AC, Switch for Refrigerator)
  private mainService: Service;

  // Additional services
  private temperatureSensorService?: Service;
  private lightService?: Service;
  private fanService?: Service;
  private blindsFanService?: Service;
  private freezerTemperatureService?: Service;
  private myzoneTemperatureService?: Service;
  private ambientTemperatureService?: Service;
  private refrigeratorDoorService?: Service;
  private freezerDoorService?: Service;
  private healthService?: Service;
  private quietService?: Service;
  private turboService?: Service;
  private comfortService?: Service;
  private blindsAutoService?: Service;
  private blindsComfortService?: Service;
  private powerSwitchService?: Service;

  // Periodic HomeKit temperature events
  private temperatureEventTimer: NodeJS.Timeout | null = null;
  // Internal last published temperature cache for delta comparison
  private _lastPublishedTemp?: number;

  constructor(
    private readonly platform: HaierEvoPlatform,
    public readonly accessory: PlatformAccessory,
    private deviceInfo: DeviceInfo
  ) {
    this.log = platform.log;

    // Initialize accessory name with validation
    this._accessoryName = this.validateHomeKitName(deviceInfo.name);

    // Create device instance
    this.device = DeviceFactory.createDevice(deviceInfo, platform.getHaierAPI());

    // Skip initial config fetch since we already have complete device info from platform
    this.device.setSkipInitialFetch(true);

                // Device info is now complete from efficient caching in fetchDevices()
            this.log.debug(`Device ${deviceInfo.name} has complete info: model=${deviceInfo.model}, serial=${deviceInfo.serialNumber}, firmware=${deviceInfo.firmwareVersion}`);

    // Check if this is an existing accessory that already has services
    const isExistingAccessory = this.accessory.services.length > 1; // More than just AccessoryInformation

    if (isExistingAccessory) {
      this.log.debug(`Restoring existing accessory: ${this.deviceInfo.name}`);

      // Find existing services instead of creating new ones
      this.mainService = this.findMainService();
      this.findAdditionalServices();

      // Reattach characteristic handlers for restored services
      this.setupHandlersForFoundServices();
    } else {
      this.log.debug(`Creating new accessory: ${this.deviceInfo.name}`);

      // Set accessory information
      this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Haier')
        .setCharacteristic(this.platform.Characteristic.Model, deviceInfo.model || 'Unknown Model')
        .setCharacteristic(this.platform.Characteristic.SerialNumber, deviceInfo.serialNumber || deviceInfo.id)
        .setCharacteristic(this.platform.Characteristic.FirmwareRevision, deviceInfo.firmwareVersion || '1.0.0');

      // Create main service based on device type
      this.mainService = this.createMainService();

      // Create additional services
      this.createAdditionalServices();
    }

    // Set up event handlers
    this.setupEventHandlers();

    // Start periodic HomeKit temperature events if configured
    this.startTemperatureEventsIfNeeded();

    this.log.info(`${isExistingAccessory ? 'Restored' : 'Created'} accessory: ${this.deviceInfo.name} (${this.deviceInfo.type})`);
  }



  private findMainService(): Service {
    // Find existing main service based on device type
    if (DeviceFactory.isAirConditioner(this.device)) {
      return this.accessory.getService(this.platform.Service.HeaterCooler) || this.createHeaterCoolerService();
    } else if (DeviceFactory.isRefrigerator(this.device)) {
      return this.accessory.getService('refrigerator-main') || this.createRefrigeratorService();
    } else {
      // Default to switch service for unknown device types
      return this.accessory.getService(this.platform.Service.Switch) || this.createSwitchService();
    }
  }

  private findAdditionalServices(): void {
    const config = this.platform.getConfig();

    // Find existing additional services instead of creating new ones
    this.temperatureSensorService = this.accessory.getService(this.platform.Service.TemperatureSensor);

    // Only find services that are enabled in config
    if (DeviceFactory.isAirConditioner(this.device)) {
      if (config.enableFanService !== false) {
        this.fanService = this.accessory.getServiceById(this.platform.Service.Fanv2, 'fan');
      }
      // Remove Fan service if disabled
      if (config.enableFanService === false && this.fanService) {
        this.accessory.removeService(this.fanService);
        this.fanService = undefined;
      }
      if (config.enableBlindsControl !== false) {
        this.blindsFanService = this.accessory.getServiceById(this.platform.Service.Fanv2, 'blinds-fan');
      }
      // Remove Blinds Fan if disabled
      if (config.enableBlindsControl === false && this.blindsFanService) {
        this.accessory.removeService(this.blindsFanService);
        this.blindsFanService = undefined;
      }
      if (config.enableLightControl !== false) {
        this.lightService = this.accessory.getService(this.platform.Service.Lightbulb);
      }
      // Remove Light if disabled
      if (config.enableLightControl === false && this.lightService) {
        this.accessory.removeService(this.lightService);
        this.lightService = undefined;
      }
      if (config.enableHealthModeSwitch !== false) {
        this.healthService = this.accessory.getServiceById(this.platform.Service.Switch, 'health');
      }
      if (config.enableHealthModeSwitch === false && this.healthService) {
        this.accessory.removeService(this.healthService);
        this.healthService = undefined;
      }
      if (config.enableQuietModeSwitch !== false) {
        this.quietService = this.accessory.getServiceById(this.platform.Service.Switch, 'quiet');
      }
      if (config.enableQuietModeSwitch === false && this.quietService) {
        this.accessory.removeService(this.quietService);
        this.quietService = undefined;
      }
      if (config.enableTurboModeSwitch !== false) {
        this.turboService = this.accessory.getServiceById(this.platform.Service.Switch, 'turbo');
      }
      if (config.enableTurboModeSwitch === false && this.turboService) {
        this.accessory.removeService(this.turboService);
        this.turboService = undefined;
      }
      if (config.enableComfortModeSwitch !== false) {
        this.comfortService = this.accessory.getServiceById(this.platform.Service.Switch, 'comfort');
      }
      if (config.enableComfortModeSwitch === false && this.comfortService) {
        this.accessory.removeService(this.comfortService);
        this.comfortService = undefined;
      }
      if (config.enableBlindsAutoSwitch !== false) {
        this.blindsAutoService = this.accessory.getServiceById(this.platform.Service.Switch, 'blinds-auto');
      }
      if (config.enableBlindsAutoSwitch === false && this.blindsAutoService) {
        this.accessory.removeService(this.blindsAutoService);
        this.blindsAutoService = undefined;
      }
      if (config.enableBlindsComfortSwitch !== false) {
        this.blindsComfortService = this.accessory.getServiceById(this.platform.Service.Switch, 'blinds-comfort');
      }
      if (config.enableBlindsComfortSwitch === false && this.blindsComfortService) {
        this.accessory.removeService(this.blindsComfortService);
        this.blindsComfortService = undefined;
      }
    }

    // Find refrigerator-specific services
    if (DeviceFactory.isRefrigerator(this.device)) {
      this.freezerTemperatureService = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'freezer-temp');
      this.ambientTemperatureService = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'ambient-temp');
      this.myzoneTemperatureService = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'myzone-temp');
      this.refrigeratorDoorService = this.accessory.getServiceById(this.platform.Service.ContactSensor, 'refrigerator-door');
      this.freezerDoorService = this.accessory.getServiceById(this.platform.Service.ContactSensor, 'freezer-door');
    }

    this.powerSwitchService = this.accessory.getService('power-switch');

    // Create any newly enabled services that don't exist yet (restored accessories)
    if (DeviceFactory.isAirConditioner(this.device)) {
      if (config.enableFanService !== false && !this.fanService) {
        this.fanService = this.accessory.addService(
          this.platform.Service.Fanv2,
          `${this.accessoryName} Fan`,
          'fan'
        );
      }

      if (config.enableBlindsControl !== false && !this.blindsFanService) {
        this.blindsFanService = this.accessory.addService(
          this.platform.Service.Fanv2,
          `${this.accessoryName} Blinds`,
          'blinds-fan'
        );
      }

      if (config.enableLightControl !== false && this.device.light !== undefined && !this.lightService) {
        this.lightService = this.accessory.addService(
          this.platform.Service.Lightbulb,
          `${this.accessoryName} Light`,
          'light'
        );
      }

      if (config.enableHealthModeSwitch !== false && !this.healthService) {
        this.healthService = this.accessory.addService(
          this.platform.Service.Switch,
          `${this.accessoryName} Health Mode`,
          'health'
        );
      }

      if (config.enableQuietModeSwitch !== false && !this.quietService) {
        this.quietService = this.accessory.addService(
          this.platform.Service.Switch,
          `${this.accessoryName} Quiet Mode`,
          'quiet'
        );
      }

      if (config.enableTurboModeSwitch !== false && !this.turboService) {
        this.turboService = this.accessory.addService(
          this.platform.Service.Switch,
          `${this.accessoryName} Turbo Mode`,
          'turbo'
        );
      }

      if (config.enableComfortModeSwitch !== false && !this.comfortService) {
        this.comfortService = this.accessory.addService(
          this.platform.Service.Switch,
          `${this.accessoryName} Comfort Mode`,
          'comfort'
        );
      }

      if (config.enableBlindsAutoSwitch !== false && !this.blindsAutoService) {
        this.blindsAutoService = this.accessory.addService(
          this.platform.Service.Switch,
          `${this.accessoryName} Blinds Auto`,
          'blinds-auto'
        );
      }

      if (config.enableBlindsComfortSwitch !== false && !this.blindsComfortService) {
        this.blindsComfortService = this.accessory.addService(
          this.platform.Service.Switch,
          `${this.accessoryName} Blinds Comfort`,
          'blinds-comfort'
        );
      }
    }

    if (DeviceFactory.isRefrigerator(this.device)) {
      if (!this.freezerTemperatureService) {
        this.freezerTemperatureService = this.accessory.addService(
          this.platform.Service.TemperatureSensor,
          `${this.accessoryName} Freezer Compartment`,
          'freezer-temp'
        );
      }

      if (!this.ambientTemperatureService) {
        this.ambientTemperatureService = this.accessory.addService(
          this.platform.Service.TemperatureSensor,
          `${this.accessoryName} Ambient`,
          'ambient-temp'
        );
      }

      if (!this.myzoneTemperatureService) {
        this.myzoneTemperatureService = this.accessory.addService(
          this.platform.Service.TemperatureSensor,
          `${this.accessoryName} My Zone`,
          'myzone-temp'
        );
      }

      if (!this.refrigeratorDoorService) {
        this.refrigeratorDoorService = this.accessory.addService(
          this.platform.Service.ContactSensor,
          `${this.accessoryName} Refrigerator Door`,
          'refrigerator-door'
        );
      }

      if (!this.freezerDoorService) {
        this.freezerDoorService = this.accessory.addService(
          this.platform.Service.ContactSensor,
          `${this.accessoryName} Freezer Door`,
          'freezer-door'
        );
      }
    }

    // Add found services to the services array
    if (this.temperatureSensorService) this.services.push(this.temperatureSensorService);
    if (this.fanService) this.services.push(this.fanService);
    if (this.blindsFanService) this.services.push(this.blindsFanService);
    if (this.lightService) this.services.push(this.lightService);
    if (this.freezerTemperatureService) this.services.push(this.freezerTemperatureService);
    if (this.myzoneTemperatureService) this.services.push(this.myzoneTemperatureService);
    if (this.refrigeratorDoorService) this.services.push(this.refrigeratorDoorService);
    if (this.freezerDoorService) this.services.push(this.freezerDoorService);
    if (this.healthService) this.services.push(this.healthService);
    if (this.quietService) this.services.push(this.quietService);
    if (this.turboService) this.services.push(this.turboService);
    if (this.comfortService) this.services.push(this.comfortService);
    if (this.blindsAutoService) this.services.push(this.blindsAutoService);
    if (this.blindsComfortService) this.services.push(this.blindsComfortService);
    if (this.powerSwitchService) this.services.push(this.powerSwitchService);

    // If a service is disabled by config, also unregister any orphaned cached service by subtype
    // This handles cases where Homebridge still has the service cached even after removal.
    if (DeviceFactory.isAirConditioner(this.device)) {
      const toCheck: Array<{flag: boolean | undefined, service: Service | undefined, subtype: string}> = [
        { flag: config.enableFanService, service: this.fanService, subtype: 'fan' },
        { flag: config.enableBlindsControl, service: this.blindsFanService, subtype: 'blinds-fan' },
        { flag: this.device.light !== undefined ? config.enableLightControl : undefined, service: this.lightService, subtype: 'light' },
        { flag: config.enableHealthModeSwitch, service: this.healthService, subtype: 'health' },
        { flag: config.enableQuietModeSwitch, service: this.quietService, subtype: 'quiet' },
        { flag: config.enableTurboModeSwitch, service: this.turboService, subtype: 'turbo' },
        { flag: config.enableComfortModeSwitch, service: this.comfortService, subtype: 'comfort' },
        { flag: config.enableBlindsAutoSwitch, service: this.blindsAutoService, subtype: 'blinds-auto' },
        { flag: config.enableBlindsComfortSwitch, service: this.blindsComfortService, subtype: 'blinds-comfort' }
      ];

      toCheck.forEach(item => {
        if (item.flag === false) {
          // Try to find by subtype if the reference is missing
          const existing = item.service || this.accessory.services.find(s => s.subtype === item.subtype);
          if (existing) {
            this.accessory.removeService(existing);
          }
        }
      });
    }

    // Persist structural changes so Homebridge updates cached services
    try {
      this.platform.updatePlatformAccessory(this.accessory);
    } catch (_e) {
      // In tests or minimal environments, platform may not expose updater
    }
  }

  // Ensure handlers are attached for services found during restore
  private setupHandlersForFoundServices(): void {
    if (DeviceFactory.isAirConditioner(this.device)) {
      if (this.mainService) {
        this.setupHeaterCoolerCharacteristics(this.mainService);
      }
    } else if (DeviceFactory.isRefrigerator(this.device)) {
      if (this.mainService) {
        this.setupRefrigeratorCharacteristics(this.mainService);
      }
    } else if (this.mainService) {
      this.setupSwitchCharacteristics(this.mainService);
    }

    if (this.temperatureSensorService) {
      this.setupTemperatureSensorCharacteristics(this.temperatureSensorService);
    }
    if (this.fanService) {
      this.setupFanServiceCharacteristics(this.fanService);
    }
    if (this.blindsFanService) {
      this.setupBlindsFanServiceCharacteristics(this.blindsFanService);
    }
    if (this.lightService) {
      this.setupLightCharacteristics(this.lightService);
    }
    if (this.healthService) {
      this.setupSimpleSwitchCharacteristics(this.healthService, this.getHealthState.bind(this), async (v) => {
        if (DeviceFactory.isAirConditioner(this.device)) {
          await this.device.set_health(!!v);
        }
      });
    }
    if (this.quietService) {
      this.setupSimpleSwitchCharacteristics(this.quietService, this.getQuietState.bind(this), async (v) => {
        if (DeviceFactory.isAirConditioner(this.device)) {
          await this.device.set_quiet(!!v);
        }
      });
    }
    if (this.turboService) {
      this.setupSimpleSwitchCharacteristics(this.turboService, this.getTurboState.bind(this), async (v) => {
        if (DeviceFactory.isAirConditioner(this.device)) {
          await this.device.set_turbo(!!v);
        }
      });
    }
    if (this.comfortService) {
      this.setupSimpleSwitchCharacteristics(this.comfortService, this.getComfortState.bind(this), async (v) => {
        if (DeviceFactory.isAirConditioner(this.device)) {
          await this.device.set_comfort(!!v);
        }
      });
    }
    if (this.blindsAutoService) {
      this.setupSimpleSwitchCharacteristics(this.blindsAutoService, this.getBlindsAutoState.bind(this), async (v) => {
        if (DeviceFactory.isAirConditioner(this.device)) {
          await this.device.set_swing_mode(v ? 'auto' : 'position_3');
        }
      });
    }
    if (this.blindsComfortService) {
      this.setupSimpleSwitchCharacteristics(this.blindsComfortService, this.getBlindsComfortState.bind(this), async (v) => {
        if (DeviceFactory.isAirConditioner(this.device)) {
          const isHeating = this.device.mode === 'heat';
          await this.device.set_swing_mode(v ? (isHeating ? 'bottom' : 'upper') : 'position_3');
        }
      });
    }
    if (this.powerSwitchService) {
      this.setupSimpleSwitchCharacteristics(this.powerSwitchService, this.getSwitchState.bind(this), async (v) => {
        if (v) {
          await this.device.switch_on();
        } else {
          await this.device.switch_off();
        }
      });
    }
  }

  private createMainService(): Service {
    if (DeviceFactory.isAirConditioner(this.device)) {
      return this.createHeaterCoolerService();
    } else if (DeviceFactory.isRefrigerator(this.device)) {
      return this.createRefrigeratorService();
    } else {
      // Default to switch service for unknown device types
      return this.createSwitchService();
    }
  }

  private createHeaterCoolerService(): Service {
    const service = this.accessory.addService(this.platform.Service.HeaterCooler, this.accessoryName, 'heater-cooler');
    this.setupHeaterCoolerCharacteristics(service);

    this.services.push(service);
    return service;
  }

  private setupHeaterCoolerCharacteristics(service: Service): void {
    // Set up characteristics for HeaterCooler
    service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentHeaterCoolerState.bind(this));

    service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.getTargetHeaterCoolerState.bind(this))
      .onSet(this.setTargetHeaterCoolerState.bind(this));

    service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // Cooling threshold temperature
    service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .onGet(this.getCoolingThresholdTemperature.bind(this))
      .onSet(this.setCoolingThresholdTemperature.bind(this))
      .setProps({
        minValue: this.device.min_temperature,
        maxValue: this.device.max_temperature,
        minStep: 1
      });

    // Heating threshold temperature
    service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this))
      .setProps({
        minValue: this.device.min_temperature,
        maxValue: this.device.max_temperature,
        minStep: 1
      });

    service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onGet(() => this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS);

    // Add rotation speed for fan control
    service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getFanSpeed.bind(this))
      .onSet(this.setFanSpeed.bind(this))
      .setProps({
        minValue: 0,
        maxValue: 100,
        minStep: 25
      });

    // Add swing mode support
    service.getCharacteristic(this.platform.Characteristic.SwingMode)
      .onGet(this.getSwingMode.bind(this))
      .onSet(this.setSwingMode.bind(this));
  }

  private createSwitchService(): Service {
    const service = this.accessory.addService(this.platform.Service.Switch, this.accessoryName, 'switch');
    this.setupSwitchCharacteristics(service);

    this.services.push(service);
    return service;
  }

  private setupSwitchCharacteristics(service: Service): void {
    service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getSwitchState.bind(this))
      .onSet(this.setSwitchState.bind(this));
  }

  private createRefrigeratorService(): Service {
    // Create a TemperatureSensor service as the main service for refrigerators
    // This provides temperature control without the ability to turn off
    const service = this.accessory.addService(
      this.platform.Service.TemperatureSensor,
      `${this.accessoryName} Refrigerator Compartment`,
      'refrigerator-main'
    );

    this.setupRefrigeratorCharacteristics(service);

    this.services.push(service);
    return service;
  }

  private setupRefrigeratorCharacteristics(service: Service): void {
    // Set up temperature characteristics
    service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));
  }

  private createAdditionalServices(): void {
    const config = this.platform.getConfig();

    // For refrigerators, we will not add a generic duplicate temperature sensor
    if (!DeviceFactory.isRefrigerator(this.device)) {
      // Temperature sensor service for non-refrigerators
      this.temperatureSensorService = this.accessory.addService(
        this.platform.Service.TemperatureSensor,
        `${this.accessoryName} Temperature`,
        'temperature'
      );

      this.setupTemperatureSensorCharacteristics(this.temperatureSensorService);

      this.services.push(this.temperatureSensorService);
    }

    // Fan service for AC devices
    if (DeviceFactory.isAirConditioner(this.device) && (config.enableFanService !== false)) {
      this.fanService = this.accessory.addService(
        this.platform.Service.Fanv2,
        `${this.accessoryName} Fan`,
        'fan'
      );

      this.setupFanServiceCharacteristics(this.fanService);

      this.services.push(this.fanService);
    }

    // Blinds Fan service for AC devices (vertical blinds control using fan rotation)
    if (DeviceFactory.isAirConditioner(this.device) && (config.enableBlindsControl !== false)) {
      this.blindsFanService = this.accessory.addService(
        this.platform.Service.Fanv2,
        `${this.accessoryName} Blinds`,
        'blinds-fan'
      );

      // Active - controls if blinds are in manual or auto mode
      this.setupBlindsFanServiceCharacteristics(this.blindsFanService);

      this.services.push(this.blindsFanService);
    }

    // Light service only for AC devices that support it
    if (DeviceFactory.isAirConditioner(this.device) && this.device.light !== undefined && (config.enableLightControl !== false)) {
      this.lightService = this.accessory.addService(
        this.platform.Service.Lightbulb,
        `${this.accessoryName} Light`,
        'light'
      );

      this.setupLightCharacteristics(this.lightService);

      this.services.push(this.lightService);
    }

    // Additional AC control services
    if (DeviceFactory.isAirConditioner(this.device)) {
      // Health mode switch
      if (config.enableHealthModeSwitch !== false) {
        this.healthService = this.accessory.addService(
          this.platform.Service.Switch,
          `${this.accessoryName} Health Mode`,
          'health'
        );

        this.setupSimpleSwitchCharacteristics(this.healthService, this.getHealthState.bind(this), this.setHealthState.bind(this));

        this.services.push(this.healthService);
      }

      // Quiet mode switch
      if (config.enableQuietModeSwitch !== false) {
        this.quietService = this.accessory.addService(
          this.platform.Service.Switch,
          `${this.accessoryName} Quiet Mode`,
          'quiet'
        );

        this.setupSimpleSwitchCharacteristics(this.quietService, this.getQuietState.bind(this), this.setQuietState.bind(this));

        this.services.push(this.quietService);
      }

      // Turbo mode switch
      if (config.enableTurboModeSwitch !== false) {
        this.turboService = this.accessory.addService(
          this.platform.Service.Switch,
          `${this.accessoryName} Turbo Mode`,
          'turbo'
        );

        this.setupSimpleSwitchCharacteristics(this.turboService, this.getTurboState.bind(this), this.setTurboState.bind(this));

        this.services.push(this.turboService);
      }

      // Comfort mode switch
      if (config.enableComfortModeSwitch !== false) {
        this.comfortService = this.accessory.addService(
          this.platform.Service.Switch,
          `${this.accessoryName} Comfort Mode`,
          'comfort'
        );

        this.setupSimpleSwitchCharacteristics(this.comfortService, this.getComfortState.bind(this), this.setComfortState.bind(this));

        this.services.push(this.comfortService);
      }

      // Blinds Auto Mode switch (Авто режим)
      if (config.enableBlindsAutoSwitch !== false) {
        this.blindsAutoService = this.accessory.addService(
          this.platform.Service.Switch,
          `${this.accessoryName} Blinds Auto`,
          'blinds-auto'
        );

        this.setupSimpleSwitchCharacteristics(this.blindsAutoService, this.getBlindsAutoState.bind(this), this.setBlindsAutoState.bind(this));

        this.services.push(this.blindsAutoService);
      }

      // Blinds Comfort Flow switch (Комфорт-поток)
      if (config.enableBlindsComfortSwitch !== false) {
        this.blindsComfortService = this.accessory.addService(
          this.platform.Service.Switch,
          `${this.accessoryName} Blinds Comfort`,
          'blinds-comfort'
        );

        this.setupSimpleSwitchCharacteristics(this.blindsComfortService, this.getBlindsComfortState.bind(this), this.setBlindsComfortState.bind(this));

        this.services.push(this.blindsComfortService);
      }
    }

    // Refrigerator-specific services
    if (DeviceFactory.isRefrigerator(this.device)) {
      // Freezer temperature sensor
      this.freezerTemperatureService = this.accessory.addService(
        this.platform.Service.TemperatureSensor,
        `${this.accessoryName} Freezer Compartment`,
        'freezer-temp'
      );

      this.freezerTemperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getFreezerTemperature.bind(this));

      this.services.push(this.freezerTemperatureService);

      // Ambient temperature sensor (read-only)
      this.ambientTemperatureService = this.accessory.addService(
        this.platform.Service.TemperatureSensor,
        `${this.accessoryName} Ambient`,
        'ambient-temp'
      );

      this.ambientTemperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getAmbientTemperature.bind(this));

      this.services.push(this.ambientTemperatureService);

      // My Zone temperature sensor
      this.myzoneTemperatureService = this.accessory.addService(
        this.platform.Service.TemperatureSensor,
        `${this.accessoryName} My Zone`,
        'myzone-temp'
      );

      this.myzoneTemperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getMyZoneTemperature.bind(this));

      this.services.push(this.myzoneTemperatureService);

      // Refrigerator door contact sensor
      this.refrigeratorDoorService = this.accessory.addService(
        this.platform.Service.ContactSensor,
        `${this.accessoryName} Refrigerator Door`,
        'refrigerator-door'
      );

      this.refrigeratorDoorService.getCharacteristic(this.platform.Characteristic.ContactSensorState)
        .onGet(this.getRefrigeratorDoorState.bind(this));

      this.services.push(this.refrigeratorDoorService);

      // Freezer door contact sensor
      this.freezerDoorService = this.accessory.addService(
        this.platform.Service.ContactSensor,
        `${this.accessoryName} Freezer Door`,
        'freezer-door'
      );

      this.freezerDoorService.getCharacteristic(this.platform.Characteristic.ContactSensorState)
        .onGet(this.getFreezerDoorState.bind(this));

      this.services.push(this.freezerDoorService);
    }
  }

  private setupTemperatureSensorCharacteristics(service: Service): void {
    service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));
  }

  private setupFanServiceCharacteristics(service: Service): void {
    service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getFanActiveState.bind(this))
      .onSet(this.setFanActiveState.bind(this));

    service.getCharacteristic(this.platform.Characteristic.CurrentFanState)
      .onGet(this.getCurrentFanState.bind(this));

    service.getCharacteristic(this.platform.Characteristic.TargetFanState)
      .onGet(this.getTargetFanState.bind(this))
      .onSet(this.setTargetFanState.bind(this));

    service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getFanSpeed.bind(this))
      .onSet(this.setFanSpeed.bind(this));
  }

  private setupBlindsFanServiceCharacteristics(service: Service): void {
    service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getBlindsActive.bind(this))
      .onSet(this.setBlindsActive.bind(this));

    service.getCharacteristic(this.platform.Characteristic.CurrentFanState)
      .onGet(this.getBlindsCurrentState.bind(this));

    service.getCharacteristic(this.platform.Characteristic.TargetFanState)
      .onGet(this.getBlindsTargetState.bind(this))
      .onSet(this.setBlindsTargetState.bind(this));

    service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getBlindsRotationSpeed.bind(this))
      .onSet(this.setBlindsRotationSpeed.bind(this))
      .setProps({
        minValue: 0,
        maxValue: 100,
        minStep: 5
      });
  }

  private setupLightCharacteristics(service: Service): void {
    service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getLightState.bind(this))
      .onSet(this.setLightState.bind(this));
  }


  private setupSimpleSwitchCharacteristics(
    service: Service,
    getter: () => boolean,
    setter: (value: any) => Promise<void>
  ): void {
    service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(getter)
      .onSet(setter);
  }

  // Prefer verbose logging when plugin config.debug is true; otherwise use debug level
  private debugLog(message: string): void {
    try {
      const cfg = this.platform.getConfig();
      if (cfg && (cfg as any).debug) {
        this.log.info(message);
      } else {
        this.log.debug(message);
      }
    } catch (_e) {
      this.log.debug(message);
    }
  }

  private startTemperatureEventsIfNeeded(): void {
    // Run if we have any TemperatureSensor service (AC or refrigerator)
    if (!this.temperatureSensorService && !DeviceFactory.isAirConditioner(this.device)) {
      return;
    }

    const config = this.platform.getConfig();
    const intervalSeconds = (config.temperatureEventInterval ?? 0);
    const forcePublish = (config.temperatureEventForcePublish ?? false);
    const minDelta = (config.temperatureEventMinDelta ?? 0);
    const jitterSeconds = (config.temperatureEventJitter ?? 0);

    // Disable if non-positive interval
    if (!intervalSeconds || intervalSeconds <= 0) {
      return;
    }

    // Clear any previous timer
    if (this.temperatureEventTimer) {
      clearInterval(this.temperatureEventTimer);
      this.temperatureEventTimer = null;
    }

    const publishTemperature = () => {
      try {
        const temperature = this.getCurrentTemperature();

        // Optionally skip if change is below threshold and force is disabled
        if (!forcePublish && typeof this._lastPublishedTemp === 'number') {
          const delta = Math.abs(temperature - this._lastPublishedTemp);
          if (delta < minDelta) {
            this.debugLog(`Temperature event skipped (delta ${delta.toFixed(3)} < minDelta ${minDelta}). Current=${temperature}`);
            return;
          }
        }

        // Emit on HeaterCooler main service
        if (this.mainService) {
          this.mainService.updateCharacteristic(
            this.platform.Characteristic.CurrentTemperature,
            temperature
          );
        }

        // Emit on dedicated TemperatureSensor service if present
        if (this.temperatureSensorService) {
          this.temperatureSensorService.updateCharacteristic(
            this.platform.Characteristic.CurrentTemperature,
            temperature
          );
        }

        this._lastPublishedTemp = temperature;
        this.debugLog(`Temperature event published: ${temperature}`);
      } catch (error) {
        this.log.debug(`Temperature event update failed: ${error}`);
      }
    };

    // Optional initial jitter to avoid synchronized bursts across devices
    const startInterval = () => {
      this.temperatureEventTimer = setInterval(publishTemperature, intervalSeconds * 1000);
    };

    if (jitterSeconds && jitterSeconds > 0) {
      const jitter = Math.floor(Math.random() * (jitterSeconds * 1000));
      this.debugLog(`Starting temperature events with interval=${intervalSeconds}s, force=${forcePublish}, minDelta=${minDelta}, jitter=${Math.round(jitter/1000)}s`);
      setTimeout(() => {
        publishTemperature();
        startInterval();
      }, jitter);
    } else {
      this.debugLog(`Starting temperature events with interval=${intervalSeconds}s, force=${forcePublish}, minDelta=${minDelta}, jitter=0s`);
      publishTemperature();
      startInterval();
    }
  }

  private setupEventHandlers(): void {
    // Listen for device events
    this.device.on('statusUpdated', (status) => {
      this.updateCharacteristics(status);
    });

    this.device.on('deviceInfoUpdated', (info) => {
      this.log.debug(`Device info updated for ${this.deviceInfo.name}:`, info);

      // Update the device itself
      this.device.updateDeviceInfo(info);

      // Update the accessory information
      this.updateDeviceInfo({
        ...this.deviceInfo,
        model: info.model || this.deviceInfo.model,
        serialNumber: info.serialNumber || this.deviceInfo.serialNumber,
        firmwareVersion: info.firmwareVersion || this.deviceInfo.firmwareVersion,
        name: info.deviceName || this.deviceInfo.name
      });
    });

    this.device.on('error', (error) => {
      this.log.error(`Device error: ${error}`);
    });
  }

  // Characteristic getters and setters for HeaterCooler
  private getActive(): number {
    return this.device.available && this.device.status > 0 ?
      this.platform.Characteristic.Active.ACTIVE :
      this.platform.Characteristic.Active.INACTIVE;
  }

  private async setActive(value: CharacteristicValue): Promise<void> {
    if (value === this.platform.Characteristic.Active.ACTIVE) {
      await this.device.switch_on();
    } else {
      await this.device.switch_off();
    }
  }

  private getCurrentHeaterCoolerState(): number {
    if (!this.device.available || this.device.status === 0) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }

    switch (this.device.mode) {
      case 'heat':
        return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
      case 'cool':
        return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
      case 'auto':
        // For auto mode, determine based on current vs target temperature
        if (this.device.current_temperature < this.device.target_temperature) {
          return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
        } else if (this.device.current_temperature > this.device.target_temperature) {
          return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
        } else {
          return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        }
      case 'fan_only':
      case 'dry':
        return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
      default:
        return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }
  }

  private getTargetHeaterCoolerState(): number {
    if (!this.device.available) {
      return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }

    switch (this.device.mode) {
      case 'heat':
        return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
      case 'cool':
        return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
      case 'auto':
      default:
        return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }
  }

  private async setTargetHeaterCoolerState(value: CharacteristicValue): Promise<void> {
    let mode: string;

    switch (value) {
      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        mode = 'heat';
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        mode = 'cool';
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        mode = 'auto';
        break;
      default:
        throw new Error(`Invalid heater cooler state: ${value}`);
    }

    await this.device.set_operation_mode(mode);
  }

  private getCoolingThresholdTemperature(): number {
    // For cooling mode, use the target temperature
    return this.getTargetTemperature();
  }

  private async setCoolingThresholdTemperature(value: CharacteristicValue): Promise<void> {
    await this.setTargetTemperature(value);
  }

  private getHeatingThresholdTemperature(): number {
    // For heating mode, use the target temperature
    return this.getTargetTemperature();
  }

  private async setHeatingThresholdTemperature(value: CharacteristicValue): Promise<void> {
    await this.setTargetTemperature(value);
  }

  private getSwingMode(): number {
    // Check if swing mode is enabled ('auto')
    return this.device.swing_mode && this.device.swing_mode !== 'auto' ?
      this.platform.Characteristic.SwingMode.SWING_DISABLED :
      this.platform.Characteristic.SwingMode.SWING_ENABLED;
  }

  private async setSwingMode(value: CharacteristicValue): Promise<void> {
    if (value === this.platform.Characteristic.SwingMode.SWING_ENABLED) {
      await this.device.set_swing_mode('auto');
    } else {
      await this.device.set_swing_mode('off');
    }
  }

    // Blinds Fan service methods (using Fanv2 for blinds control)
  private getBlindsActive(): number {
    // Active when not in auto mode (manual control)
    return this.device.swing_mode !== 'auto' ?
      this.platform.Characteristic.Active.ACTIVE :
      this.platform.Characteristic.Active.INACTIVE;
  }

  private async setBlindsActive(value: CharacteristicValue): Promise<void> {
    const isActive = Boolean(value);

    if (isActive) {
      // Switch to manual control - set to neutral position
      await this.device.set_swing_mode('off');
    } else {
      // Switch to auto mode
      await this.device.set_swing_mode('auto');
    }
  }

  private getBlindsCurrentState(): number {
    // Show as blowing air when in manual mode, idle when in auto
    return this.device.swing_mode !== 'auto' ?
      this.platform.Characteristic.CurrentFanState.BLOWING_AIR :
      this.platform.Characteristic.CurrentFanState.IDLE;
  }

  private getBlindsTargetState(): number {
    // Always manual for blinds control
    return this.platform.Characteristic.TargetFanState.MANUAL;
  }

  private async setBlindsTargetState(value: CharacteristicValue): Promise<void> {
    // Only manual mode is supported for blinds
    if (value === this.platform.Characteristic.TargetFanState.AUTO) {
      await this.device.set_swing_mode('auto');
    } else {
      // Switch to manual mode with neutral position
      await this.device.set_swing_mode('off');
    }
  }

  private getBlindsRotationSpeed(): number {
    if (!this.device.available) return 50; // Default to center position

    // Map swing modes to rotation speed (0-100% = -90° to +90°)
    switch (this.device.swing_mode) {
      case 'upper': // -75° -> 8.3%
        return 8;
      case 'position_1': // -45° -> 25%
        return 25;
      case 'position_2': // -30° -> 33.3%
        return 33;
      case 'position_3': // 0° -> 50% (center)
        return 50;
      case 'position_4': // 30° -> 66.7%
        return 67;
      case 'position_5': // 45° -> 75%
        return 75;
      case 'bottom': // 75° -> 91.7%
        return 92;
      case 'auto': // Auto mode - center position
        return 50;
      case 'off': // Off - center position
      default:
        return 50;
    }
  }

  private async setBlindsRotationSpeed(value: CharacteristicValue): Promise<void> {
    const speed = Number(value);

    // Map rotation speed to swing modes (0-100% = -90° to +90°)
    let mode: string;
    if (speed <= 16) {
      mode = 'upper'; // 0-16% -> upper position (-75°)
    } else if (speed <= 29) {
      mode = 'position_1'; // 17-29% -> first rotation (-45°)
    } else if (speed <= 41) {
      mode = 'position_2'; // 30-41% -> second rotation (-30°)
    } else if (speed <= 58) {
      mode = 'position_3'; // 42-58% -> neutral (0°)
    } else if (speed <= 71) {
      mode = 'position_4'; // 59-71% -> fourth rotation (30°)
    } else if (speed <= 83) {
      mode = 'position_5'; // 72-83% -> fifth rotation (45°)
    } else {
      mode = 'bottom'; // 84-100% -> bottom position (75°)
    }

    await this.device.set_swing_mode(mode);
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

  private getCurrentFanState(): number {
    if (!this.device.available || this.device.status === 0) {
      return this.platform.Characteristic.CurrentFanState.INACTIVE;
    }

    // If device is on and fan mode is set, fan is blowing air
    if (this.device.fan_mode && this.device.fan_mode !== 'off') {
      return this.platform.Characteristic.CurrentFanState.BLOWING_AIR;
    }

    // Device is on but fan is idle
    return this.platform.Characteristic.CurrentFanState.IDLE;
  }

  private getTargetFanState(): number {
    if (!this.device.available) {
      return this.platform.Characteristic.TargetFanState.AUTO;
    }

    // If fan mode is 'auto', return AUTO, otherwise MANUAL
    return this.device.fan_mode === 'auto' ?
      this.platform.Characteristic.TargetFanState.AUTO :
      this.platform.Characteristic.TargetFanState.MANUAL;
  }

  private async setTargetFanState(value: any): Promise<void> {
    if (value === this.platform.Characteristic.TargetFanState.AUTO) {
      await this.device.set_fan_mode('auto');
    } else {
      // When switching to MANUAL, set to medium speed as default
      await this.device.set_fan_mode('medium');
    }
  }

  private getFanSpeed(): number {
    if (!this.device.available || this.device.status === 0) return 0;

    switch (this.device.fan_mode) {
      case 'low':
        return 25;
      case 'medium':
        return 50;
      case 'high':
        return 100;
      case 'auto':
        // For auto mode, return a representative speed based on current operation
        return 75;
      default:
        return 0;
    }
  }

  private async setFanSpeed(value: any): Promise<void> {
    let mode: string;
    const speed = Number(value);

    if (speed === 0) {
      // Speed 0 means turn off the device
      await this.device.switch_off();
      return;
    } else if (speed <= 33) {
      mode = 'low';
    } else if (speed <= 66) {
      mode = 'medium';
    } else if (speed <= 100) {
      mode = 'auto';
    } else {
      mode = 'high';
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

    // Use the accessory name setter to properly validate and update the name
    this.accessoryName = deviceInfo.name;

    // Update the underlying device information
    if (this.device && typeof this.device.updateDeviceInfo === 'function') {
      this.device.updateDeviceInfo({
        model: deviceInfo.model,
        serialNumber: deviceInfo.serialNumber,
        firmwareVersion: deviceInfo.firmwareVersion,
        deviceName: deviceInfo.name
      });
    }

    // Update accessory information
    const accessoryInfo = this.accessory.getService(this.platform.Service.AccessoryInformation)!;
    accessoryInfo.setCharacteristic(this.platform.Characteristic.Model, deviceInfo.model || 'Unknown Model');

    if (deviceInfo.serialNumber) {
      accessoryInfo.setCharacteristic(this.platform.Characteristic.SerialNumber, deviceInfo.serialNumber);
    }

    if (deviceInfo.firmwareVersion) {
      accessoryInfo.setCharacteristic(this.platform.Characteristic.FirmwareRevision, deviceInfo.firmwareVersion);
    }
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
          this.platform.Characteristic.Active,
          this.getActive()
        );

        this.mainService.updateCharacteristic(
          this.platform.Characteristic.CurrentHeaterCoolerState,
          this.getCurrentHeaterCoolerState()
        );

        this.mainService.updateCharacteristic(
          this.platform.Characteristic.TargetHeaterCoolerState,
          this.getTargetHeaterCoolerState()
        );

        this.mainService.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          this.getCurrentTemperature()
        );

        this.mainService.updateCharacteristic(
          this.platform.Characteristic.CoolingThresholdTemperature,
          this.getCoolingThresholdTemperature()
        );

        this.mainService.updateCharacteristic(
          this.platform.Characteristic.HeatingThresholdTemperature,
          this.getHeatingThresholdTemperature()
        );

        this.mainService.updateCharacteristic(
          this.platform.Characteristic.RotationSpeed,
          this.getFanSpeed()
        );

        this.mainService.updateCharacteristic(
          this.platform.Characteristic.SwingMode,
          this.getSwingMode()
        );
      } else if (DeviceFactory.isRefrigerator(this.device)) {
        // Update refrigerator main service (TemperatureSensor) - current only
        this.mainService.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          this.getCurrentTemperature()
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
        this.platform.Characteristic.CurrentFanState,
        this.getCurrentFanState()
      );

      this.fanService.updateCharacteristic(
        this.platform.Characteristic.TargetFanState,
        this.getTargetFanState()
      );

      this.fanService.updateCharacteristic(
        this.platform.Characteristic.RotationSpeed,
        this.getFanSpeed()
      );
    }

    // Update blinds fan service
    if (this.blindsFanService) {
      this.blindsFanService.updateCharacteristic(
        this.platform.Characteristic.Active,
        this.getBlindsActive()
      );

      this.blindsFanService.updateCharacteristic(
        this.platform.Characteristic.CurrentFanState,
        this.getBlindsCurrentState()
      );

      this.blindsFanService.updateCharacteristic(
        this.platform.Characteristic.TargetFanState,
        this.getBlindsTargetState()
      );

      this.blindsFanService.updateCharacteristic(
        this.platform.Characteristic.RotationSpeed,
        this.getBlindsRotationSpeed()
      );
    }

    // Update light service
    if (this.lightService) {
      this.lightService.updateCharacteristic(
        this.platform.Characteristic.On,
        this.getLightState()
      );
    }

    // Update refrigerator door sensors
    if (this.refrigeratorDoorService) {
      this.refrigeratorDoorService.updateCharacteristic(
        this.platform.Characteristic.ContactSensorState,
        this.getRefrigeratorDoorState()
      );
    }

    if (this.freezerDoorService) {
      this.freezerDoorService.updateCharacteristic(
        this.platform.Characteristic.ContactSensorState,
        this.getFreezerDoorState()
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

      // Update blinds control switches
      if (this.blindsAutoService) {
        this.blindsAutoService.updateCharacteristic(
          this.platform.Characteristic.On,
          this.getBlindsAutoState()
        );
      }

      if (this.blindsComfortService) {
        this.blindsComfortService.updateCharacteristic(
          this.platform.Characteristic.On,
          this.getBlindsComfortState()
        );
      }
    }
  }

  public get displayName(): string {
    return this.accessory.displayName;
  }

  public destroy(): void {
    if (this.temperatureEventTimer) {
      clearInterval(this.temperatureEventTimer);
      this.temperatureEventTimer = null;
    }
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
    return (this.device as any).freezer_temperature ?? -18;
  }

  private getMyZoneTemperature(): number {
    return (this.device as any).myzone_temperature ?? -5;
  }

  private getAmbientTemperature(): number {
    return (this.device as any).ambient_temperature ?? 25;
  }

  private getRefrigeratorDoorState(): number {
    // Map Haier door flag: true (open) -> NOT_DETECTED, false (closed) -> DETECTED
    const isOpen: boolean = Boolean((this.device as any).refrigerator_door_open);
    return isOpen
      ? this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      : this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED;
  }

  private getFreezerDoorState(): number {
    const isOpen: boolean = Boolean((this.device as any).freezer_door_open);
    return isOpen
      ? this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      : this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED;
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

  // Blinds Auto Mode methods (Авто режим)
  private getBlindsAutoState(): boolean {
    return DeviceFactory.isAirConditioner(this.device) ? this.device.swing_mode === 'auto' : false;
  }

  private async setBlindsAutoState(value: CharacteristicValue): Promise<void> {
    if (DeviceFactory.isAirConditioner(this.device)) {
      const boolValue = Boolean(value);

      if (boolValue) {
        // Turn on Auto mode (value "8" from AC data)
        await this.device.set_swing_mode('auto');

        // Turn off Comfort mode if it's on (mutually exclusive)
        if (this.isBlindsComfortMode()) {
          // No direct API call needed, just switching to auto mode disables comfort
          this.log.info('Switching from Comfort mode to Auto mode for blinds');
        }
      } else {
        // Turn off Auto mode - set to neutral position
        await this.device.set_swing_mode('position_3');
      }
    }
  }

  // Blinds Comfort Flow methods (Комфорт-поток)
  private getBlindsComfortState(): boolean {
    return DeviceFactory.isAirConditioner(this.device) ? this.isBlindsComfortMode() : false;
  }

  private async setBlindsComfortState(value: CharacteristicValue): Promise<void> {
    if (DeviceFactory.isAirConditioner(this.device)) {
      const boolValue = Boolean(value);

      if (boolValue) {
        // Turn on Comfort mode - this is a special mode that adjusts based on heating/cooling
        // For now, we'll use upper position for cooling and bottom for heating
        const isHeating = this.device.mode === 'heat';
        const comfortPosition = isHeating ? 'bottom' : 'upper'; // Hot air down, cold air up

        await this.device.set_swing_mode(comfortPosition);

        // Turn off Auto mode if it's on (mutually exclusive)
        if (this.device.swing_mode === 'auto') {
          this.log.info('Switching from Auto mode to Comfort mode for blinds');
        }
      } else {
        // Turn off Comfort mode - set to neutral position
        await this.device.set_swing_mode('position_3');
      }
    }
  }

  // Helper method to detect if we're in comfort mode
  private isBlindsComfortMode(): boolean {
    if (!DeviceFactory.isAirConditioner(this.device)) return false;

    // Comfort mode is detected when swing mode matches the expected comfort position
    // based on the current heating/cooling mode, and it's not in auto mode
    if (this.device.swing_mode === 'auto') return false;

    const isHeating = this.device.mode === 'heat';
    const expectedComfortPosition = isHeating ? 'bottom' : 'upper';

    return this.device.swing_mode === expectedComfortPosition;
  }

  /**
   * Validate and sanitize accessory names for HomeKit compliance
   * HomeKit naming requirements:
   * - Only alphanumeric characters, spaces, and apostrophes
   * - Must start and end with alphanumeric character
   * - No emojis or special characters
   */
  private validateHomeKitName(name: string): string {
    if (!name || typeof name !== 'string') {
      return 'Unknown Device';
    }

    // Remove invalid characters (keep only alphanumeric, spaces, and apostrophes)
    let validName = name.replace(/[^A-Za-z0-9 ']/g, '');

    // Ensure it starts and ends with an alphanumeric character
    validName = validName.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');

    // Collapse multiple spaces into single spaces
    validName = validName.replace(/\s+/g, ' ').trim();

    // Ensure minimum length and fallback
    if (validName.length === 0) {
      validName = `${this.deviceInfo.type || 'Device'} ${this.deviceInfo.id || 'Unknown'}`;
    }

    // Ensure maximum length (HomeKit limit is 64 characters)
    if (validName.length > 64) {
      validName = validName.substring(0, 64).trim();
    }

    return validName;
  }

  /**
   * Get the current accessory name
   */
  public get accessoryName(): string {
    return this._accessoryName;
  }

  /**
   * Set the accessory name with validation and update all related services
   */
  public set accessoryName(name: string) {
    const validatedName = this.validateHomeKitName(name);

    if (this._accessoryName === validatedName) {
      return; // No change needed
    }

    const oldName = this._accessoryName;
    this._accessoryName = validatedName;

    // Update the accessory display name
    this.accessory.displayName = validatedName;

    // Update the AccessoryInformation service Name characteristic
    const accessoryInfo = this.accessory.getService(this.platform.Service.AccessoryInformation);
    if (accessoryInfo) {
      accessoryInfo.setCharacteristic(this.platform.Characteristic.Name, validatedName);
    }

    // Update service names to reflect the new accessory name
    this.updateServiceNames(oldName, validatedName);

    this.log.info(`Updated accessory name from "${oldName}" to "${validatedName}"`);
  }

  /**
   * Update service names when accessory name changes
   */
  private updateServiceNames(oldName: string, newName: string): void {
    // Update main service name
    if (this.mainService) {
      this.mainService.setCharacteristic(this.platform.Characteristic.Name, newName);
    }

    // Update additional service names with proper prefixes
    const serviceUpdates = [
      { service: this.temperatureSensorService, suffix: 'Temperature' },
      { service: this.fanService, suffix: 'Fan' },
      { service: this.blindsFanService, suffix: 'Blinds' },
      { service: this.lightService, suffix: 'Light' },
      { service: this.healthService, suffix: 'Health Mode' },
      { service: this.quietService, suffix: 'Quiet Mode' },
      { service: this.turboService, suffix: 'Turbo Mode' },
      { service: this.comfortService, suffix: 'Comfort Mode' },
      { service: this.blindsAutoService, suffix: 'Blinds Auto' },
      { service: this.blindsComfortService, suffix: 'Blinds Comfort' },
      { service: this.freezerTemperatureService, suffix: 'Freezer Compartment' },
      { service: this.myzoneTemperatureService, suffix: 'My Zone' },
      { service: this.ambientTemperatureService, suffix: 'Ambient' },
      { service: this.refrigeratorDoorService, suffix: 'Door' },
      { service: this.freezerDoorService, suffix: 'Freezer Door' }
    ];

    serviceUpdates.forEach(({ service, suffix }) => {
      if (service) {
        const serviceName = suffix ? `${newName} ${suffix}` : newName;
        service.setCharacteristic(this.platform.Characteristic.Name, serviceName);
      }
    });
  }
}

