import modelsConfig from './device-models.json' with { type: 'json' };
import { ModelsConfigSchema, ModelDefinition } from '../types.js';
import { HVAC_MODES, FAN_MODES } from '../constants.js';

const DEFAULT_MODE_TO_HAIER: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(HVAC_MODES).map(([haier, value]) => [value, haier])
);

const DEFAULT_FAN_MODE_TO_HAIER: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(FAN_MODES).map(([haier, value]) => [value, haier])
);

export class ModelConfigService {
  private static instance: ModelConfigService | null = null;
  private readonly config: ModelsConfigSchema;
  private readonly compiledPatterns: Array<{ def: ModelDefinition; regex: RegExp }>;

  private constructor() {
    this.config = modelsConfig;
    this.compiledPatterns = (this.config.models || []).map(def => ({
      def,
      regex: new RegExp(def.modelPattern, 'i')
    }));
  }

  public static getInstance(): ModelConfigService {
    if (!ModelConfigService.instance) {
      ModelConfigService.instance = new ModelConfigService();
    }
    return ModelConfigService.instance;
  }

  public findDefinitionForModel(model: string | undefined): ModelDefinition | undefined {
    if (!model) return undefined;
    const match = this.compiledPatterns.find(p => p.regex.test(model));
    return match?.def;
  }

  public getGroupCommandNameForModel(model: string | undefined): string {
    const def = this.findDefinitionForModel(model);
    return def?.groupCommandName || '4';
  }

  public getAttributeId(model: string | undefined, canonicalName: string, fallbackId: string): string {
    const def = this.findDefinitionForModel(model);
    if (!def) return fallbackId;
    const attr = def.attributes.find(a => a.name === canonicalName);
    return attr?.id || fallbackId;
  }

  private getDefaultMappingFromHaier(canonicalName: string, haierValue: string): string {
    if (canonicalName === 'mode') {
      return HVAC_MODES[haierValue as keyof typeof HVAC_MODES] ?? 'auto';
    }
    if (canonicalName === 'fan_mode') {
      return FAN_MODES[haierValue as keyof typeof FAN_MODES] ?? 'auto';
    }
    return haierValue;
  }

  private getDefaultMappingToHaier(canonicalName: string, value: string): string {
    if (canonicalName === 'mode') {
      return DEFAULT_MODE_TO_HAIER[value] || value;
    }
    if (canonicalName === 'fan_mode') {
      return DEFAULT_FAN_MODE_TO_HAIER[value] || value;
    }
    return value;
  }

  /**
   * Maps a Haier API attribute value to the plugin canonical value.
   * For mode/fan_mode, unknown models and missing/incomplete mappings use the
   * standard encodings from HVAC_MODES/FAN_MODES (unknown Haier codes → "auto").
   * Other attributes remain pass-through when unmapped.
   */
  public mapValueFromHaier(model: string | undefined, canonicalName: string, haierValue: string): string {
    const def = this.findDefinitionForModel(model);
    if (!def) {
      return this.getDefaultMappingFromHaier(canonicalName, haierValue);
    }
    const attr = def.attributes.find(a => a.name === canonicalName);
    if (!attr?.mappings) {
      return this.getDefaultMappingFromHaier(canonicalName, haierValue);
    }
    const mapping = attr.mappings.find(m => m.haier === haierValue);
    return mapping?.value || this.getDefaultMappingFromHaier(canonicalName, haierValue);
  }

  /**
   * Maps a plugin canonical attribute value to the Haier API value.
   * For mode/fan_mode, unknown models and missing/incomplete mappings use the
   * standard encodings from HVAC_MODES/FAN_MODES (unmapped canonical values pass through).
   * Other attributes remain pass-through when unmapped.
   */
  public mapValueToHaier(model: string | undefined, canonicalName: string, value: string): string {
    const def = this.findDefinitionForModel(model);
    if (!def) {
      return this.getDefaultMappingToHaier(canonicalName, value);
    }
    const attr = def.attributes.find(a => a.name === canonicalName);
    if (!attr?.mappings) {
      return this.getDefaultMappingToHaier(canonicalName, value);
    }
    const mapping = attr.mappings.find(m => m.value === value);
    return mapping?.haier || this.getDefaultMappingToHaier(canonicalName, value);
  }
}
