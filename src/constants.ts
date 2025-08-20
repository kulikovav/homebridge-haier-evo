export const COMMON_LIMIT_CALLS = 5;
export const COMMON_LIMIT_PERIOD = 60;
export const LOGIN_LIMIT_CALLS = 1;
export const LOGIN_LIMIT_PERIOD = 15;
export const LOGIN_LIMIT_MAX = 900;
export const LOGIN_LIMIT_429 = 60;
export const LOGIN_LIMIT_500 = 60;
export const REFRESH_LIMIT_CALLS = 1;
export const REFRESH_LIMIT_PERIOD = 15;
export const REFRESH_LIMIT_MAX = 900;
export const REFRESH_LIMIT_429 = 60;
export const REFRESH_LIMIT_500 = 60;
export const API_HTTP_ROUTE = true;
export const API_TIMEOUT = 15;
export const API_PATH = 'https://evo.haieronline.ru';
export const API_LOGIN = 'v2/{region}/users/auth/sign-in';
export const API_TOKEN_REFRESH = 'v2/{region}/users/auth/refresh';
// This endpoint returns UI presentation data with devices grouped by rooms
// We have special parsing logic to extract devices from the smartHomeSpacesV1 component
export const API_DEVICES = 'v2/{region}/pages/sduiRawPaginated/smartHome/spaces/house?part=1&partitionWeight=6';
// This endpoint returns detailed device configuration and current status
export const API_DEVICE_CONFIG = 'https://iot-platform.evo.haieronline.ru/mobile-backend-service/api/v1/config/{mac}?type=DETAILED';
// This endpoint provides real-time device status updates via WebSocket
export const API_WEBSOCKET_STATUS = 'wss://iot-platform.evo.haieronline.ru/gateway-ws-service/ws/';

// HVAC Modes mapping
export const HVAC_MODES = {
  '0': 'auto',
  '1': 'cool',
  '2': 'dry',
  '4': 'heat',
  '6': 'fan_only'
} as const;

export type HVACMode = typeof HVAC_MODES[keyof typeof HVAC_MODES];

// Fan Modes mapping
export const FAN_MODES = {
  '1': 'high',
  '2': 'medium',
  '3': 'low',
  '5': 'auto'
} as const;

export type FanMode = typeof FAN_MODES[keyof typeof FAN_MODES];

// Swing Modes mapping
export const SWING_MODES = {
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
} as const;

export type SwingMode = typeof SWING_MODES[keyof typeof SWING_MODES];