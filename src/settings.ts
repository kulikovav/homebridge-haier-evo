import { z } from 'zod';

export const PLATFORM_NAME = 'homebridge-haier-evo';
export const PLUGIN_NAME = 'homebridge-haier-evo';

export const VALID_REGIONS = ['ru', 'kz', 'by'] as const;

export const haierEvoConfigSchema = z.object({
  platform: z.string().optional(),
  name: z.string().min(1, 'Name is required').default('Haier Evo'),
  email: z.string().email('Email must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
  region: z.enum(VALID_REGIONS),
  refreshInterval: z.number().int().min(300).max(2592000).optional(),
  debug: z.boolean().optional(),
  deviceCacheTTL: z.number().int().min(300).max(86400).optional(),
  requestRandomization: z.boolean().optional(),
  minRequestDelay: z.number().int().min(50).max(15000).optional(),
  maxRequestDelay: z.number().int().min(100).max(30000).optional(),
  tokenRefreshMode: z.enum(['auto', 'manual', 'disabled']).optional(),
  tokenRefreshInterval: z.number().int().min(60).max(86400).optional(),
  tokenRefreshThreshold: z.number().int().min(60).max(3600).optional(),
  batchTimeout: z.number().int().min(10).max(1000).optional(),
  includeDevices: z.array(z.string()).optional(),
  excludeDevices: z.array(z.string()).optional(),
  includeDeviceTypes: z.array(z.string()).optional(),
  excludeDeviceTypes: z.array(z.string()).optional(),
  includeNamePattern: z.string().optional(),
  excludeNamePattern: z.string().optional(),
  enableFanService: z.boolean().optional(),
  enableBlindsControl: z.boolean().optional(),
  enableBlindsAutoSwitch: z.boolean().optional(),
  enableBlindsComfortSwitch: z.boolean().optional(),
  enableLightControl: z.boolean().optional(),
  enableHealthModeSwitch: z.boolean().optional(),
  enableQuietModeSwitch: z.boolean().optional(),
  enableTurboModeSwitch: z.boolean().optional(),
  enableComfortModeSwitch: z.boolean().optional(),
  temperatureEventInterval: z.number().optional(),
  temperatureEventForcePublish: z.boolean().optional(),
  temperatureEventMinDelta: z.number().optional(),
  temperatureEventJitter: z.number().optional(),
  deviceId: z.string().optional(),
}).strict();

export type HaierEvoConfigSchema = z.infer<typeof haierEvoConfigSchema>;

export function validateConfig(raw: Record<string, unknown>): HaierEvoConfigSchema {
  const result = haierEvoConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid plugin configuration: ${issues}`);
  }
  return result.data;
}
