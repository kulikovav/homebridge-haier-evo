import { z } from 'zod';

export const authTokenSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expire: z.string(),
  refreshExpire: z.string(),
});

export const authResponseSchema = z.object({
  data: z.object({
    token: authTokenSchema,
  }),
  error: z.unknown().optional(),
});

export const deviceAttributeSchema = z.object({
  name: z.string(),
  id: z.string(),
  currentValue: z.string().optional(),
  value: z.unknown().optional(),
});

export const deviceConfigInfoSchema = z.object({
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  firmware: z.string().optional(),
});

export const deviceConfigSettingsSchema = z.object({
  firmware: z.object({ value: z.string() }).optional(),
  name: z.object({ name: z.string() }).optional(),
});

export const deviceConfigSensorItemSchema = z.object({
  value: z.object({
    name: z.string(),
    description: z.string().optional(),
  }).optional(),
});

export const deviceConfigSensorsSchema = z.object({
  items: z.array(deviceConfigSensorItemSchema).optional(),
});

export const deviceConfigResponseSchema = z.object({
  error: z.unknown().optional(),
  info: deviceConfigInfoSchema.optional(),
  settings: deviceConfigSettingsSchema.optional(),
  attributes: z.array(deviceAttributeSchema).optional(),
  sensors: deviceConfigSensorsSchema.optional(),
  temperature: z.object({
    value: z.object({ name: z.string() }).optional(),
  }).optional(),
  power: z.object({
    value: z.object({ name: z.string() }).optional(),
  }).optional(),
}).strict();

export const deviceStatusEventSchema = z.object({
  event: z.string(),
  macAddress: z.string().optional(),
  payload: z.object({
    status: z.string().optional(),
    statuses: z.array(z.unknown()).optional(),
  }).optional(),
});

export type AuthToken = z.infer<typeof authTokenSchema>;
export type AuthResponseData = z.infer<typeof authResponseSchema>;
export type DeviceConfigResponse = z.infer<typeof deviceConfigResponseSchema>;

export function parseAuthToken(raw: unknown): AuthToken | null {
  const result = authTokenSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseAuthResponse(raw: unknown): AuthResponseData | null {
  const result = authResponseSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseDeviceConfig(raw: unknown): DeviceConfigResponse | null {
  const result = deviceConfigResponseSchema.safeParse(raw);
  return result.success ? result.data : null;
}
