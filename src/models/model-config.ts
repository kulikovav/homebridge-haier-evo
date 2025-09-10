import modelsConfig from './device-models.json';
import { ModelsConfigSchema, ModelDefinition } from '../types';

export class ModelConfigService {
  private static instance: ModelConfigService | null = null;
  private readonly config: ModelsConfigSchema;
  private readonly compiledPatterns: Array<{ def: ModelDefinition; regex: RegExp }>;

  private constructor() {
    this.config = modelsConfig as ModelsConfigSchema;
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

  public mapValueFromHaier(model: string | undefined, canonicalName: string, haierValue: string): string {
    const def = this.findDefinitionForModel(model);
    if (!def) return haierValue;
    const attr = def.attributes.find(a => a.name === canonicalName);
    if (!attr || !attr.mappings) return haierValue;
    const mapping = attr.mappings.find(m => m.haier === haierValue);
    return mapping?.value || haierValue;
  }

  public mapValueToHaier(model: string | undefined, canonicalName: string, value: string): string {
    const def = this.findDefinitionForModel(model);
    if (!def) return value;
    const attr = def.attributes.find(a => a.name === canonicalName);
    if (!attr || !attr.mappings) return value;
    const mapping = attr.mappings.find(m => m.value === value);
    return mapping?.haier || value;
  }
}


