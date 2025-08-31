import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  enabled: boolean;
  apiKey?: string;
}

export interface ModelUsage {
  modelId: string;
  tokensUsed: number;
  requests: number;
  errors: number;
  lastUsed: Date;
  avgResponseTime: number;
}

interface ModelStore {
  selectedModel: string;
  models: ModelConfig[];
  usage: Record<string, ModelUsage>;
  
  setSelectedModel: (modelId: string) => void;
  addModel: (model: ModelConfig) => void;
  updateModel: (modelId: string, updates: Partial<ModelConfig>) => void;
  removeModel: (modelId: string) => void;
  getModel: (modelId: string) => ModelConfig | undefined;
  getAvailableModels: () => ModelConfig[];
  updateUsage: (modelId: string, usage: Partial<ModelUsage>) => void;
  resetUsage: (modelId?: string) => void;
}

const defaultModels: ModelConfig[] = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    maxTokens: 8192,
    temperature: 0.7,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    enabled: true,
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    maxTokens: 4096,
    temperature: 0.7,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    enabled: true,
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    maxTokens: 4096,
    temperature: 0.7,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    enabled: true,
  },
];

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      selectedModel: 'gpt-4',
      models: defaultModels,
      usage: {},
      
      setSelectedModel: (modelId: string) => {
        const model = get().getModel(modelId);
        if (model && model.enabled) {
          set({ selectedModel: modelId });
        }
      },
      
      addModel: (model: ModelConfig) => {
        set((state) => ({
          models: [...state.models, model],
        }));
      },
      
      updateModel: (modelId: string, updates: Partial<ModelConfig>) => {
        set((state) => ({
          models: state.models.map(model =>
            model.id === modelId ? { ...model, ...updates } : model
          ),
        }));
      },
      
      removeModel: (modelId: string) => {
        set((state) => {
          const newModels = state.models.filter(model => model.id !== modelId);
          const newSelectedModel = state.selectedModel === modelId 
            ? (newModels.find(m => m.enabled)?.id || newModels[0]?.id || '')
            : state.selectedModel;
          
          return {
            models: newModels,
            selectedModel: newSelectedModel,
          };
        });
      },
      
      getModel: (modelId: string) => {
        return get().models.find(model => model.id === modelId);
      },
      
      getAvailableModels: () => {
        return get().models.filter(model => model.enabled);
      },
      
      updateUsage: (modelId: string, usageUpdate: Partial<ModelUsage>) => {
        set((state) => {
          const currentUsage = state.usage[modelId] || {
            modelId,
            tokensUsed: 0,
            requests: 0,
            errors: 0,
            lastUsed: new Date(),
            avgResponseTime: 0,
          };
          
          return {
            usage: {
              ...state.usage,
              [modelId]: { ...currentUsage, ...usageUpdate },
            },
          };
        });
      },
      
      resetUsage: (modelId?: string) => {
        if (modelId) {
          set((state) => {
            const { [modelId]: _, ...restUsage } = state.usage;
            return { usage: restUsage };
          });
        } else {
          set({ usage: {} });
        }
      },
    }),
    {
      name: 'model-store',
    }
  )
);