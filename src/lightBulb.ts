import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { FreeDomProHomebridgePlatform } from './platform';
import axios from 'axios';

/**
 * Lightbubl Platform Accessory
 * An instance of this class is created for each accessory FreedomPro registers
 * Each accessory may expose multiple services of different service types.
 */
export class LightBulbAccessory {
  private service: Service;
  private uid: string;
  private isOn = false;

  constructor(
    private readonly platform: FreeDomProHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.uid = accessory.context.deviceUid + '*' + accessory.context.device.uid;

    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        this.accessory.context.manufacturer,
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        this.accessory.context.model,
      );

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    //console.log(accessory);
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.displayName,
    );

    // register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this)) // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this)); // GET - bind to the `getOn` method below

    this.startDeviceStatePooling();
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    // implement your own code to turn your device on/off

    await axios.put(
      `https://api.freedompro.eu/api/freedompro/accessories/${this.uid}/state`,
      { on: value as boolean },
      {
        headers: { Authorization: `Bearer ${this.platform.config.apiKey}` },
      },
    );
    this.isOn = value as boolean; // Update cached state
    this.platform.log.debug('Set Characteristic On ->', value);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   */
  async getOn(): Promise<CharacteristicValue> {
    // Return the cached state for a fast response
    this.platform.log.debug('Get Characteristic On ->', this.isOn);
    return this.isOn;
  }

  startDeviceStatePooling() {
    const pollInterval = 60000;
    setInterval(async () => {
      try {
        const { data: state } = await axios.get(
          `https://api.freedompro.eu/api/freedompro/accessories/${this.uid}/state`,
          {
            headers: { Authorization: `Bearer ${this.platform.config.apiKey}` },
          },
        );
        this.isOn = state.state.on; // Update the cached state

        // Use updateCharacteristic to inform HomeKit of state change
        this.service.updateCharacteristic(
          this.platform.Characteristic.On,
          this.isOn,
        );

        this.platform.log.debug('Updated Characteristic On ->', this.isOn);
      } catch (error) {
        this.platform.log.error('Failed to poll device state:', error);
      }
    }, pollInterval);
  }
}
