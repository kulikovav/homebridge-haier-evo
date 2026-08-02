import modelsConfig from './device-models.json' with { type: 'json' };
import { ModelsConfigSchema, ModelDefinition } from '../types.js';

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
      const map: Record<string, string> = {
        '0': 'auto',
        '1': 'cool',
        '2': 'dry',
        '4': 'heat',
        '6': 'fan_only'
      };
      return map[haierValue] || haierValue;
    }
    if (canonicalName === 'fan_mode') {
      const map: Record<string, string> = {
        '1': 'high',
        '2': 'medium',
        '3': 'low',
        '5': 'auto'
      };
      return map[haierValue] || haierValue;
    }
    return haierValue;
  }

  private getDefaultMappingToHaier(canonicalName: string, value: string): string {
    if (canonicalName === 'mode') {
      const map: Record<string, string> = {
        'auto': '0',
        'cool': '1',
        'dry': '2',
        'heat': '4',
        'fan_only': '6'
      };
      return map[value] || value;
    }
    if (canonicalName === 'fan_mode') {
      const map: Record<string, string> = {
        'high': '1',
        'medium': '2',
        'low': '3',
        'auto': '5'
      };
      return map[value] || value;
    }
    return value;
  }

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


