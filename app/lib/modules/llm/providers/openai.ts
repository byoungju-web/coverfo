import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

/*
 * @ai-sdk/openai 1.1.2 는 max_tokens -> max_completion_tokens 변환을
 * o1 / o3 계열 모델에만 적용한다. gpt-5.x / gpt-6 계열은 그 조건에 걸리지 않아
 * 옛 파라미터가 그대로 전송되고 OpenAI 서버가 400 오류를 낸다.
 * 아래 fetch 래퍼가 전송 직전에 파라미터 이름만 바꿔준다.
 */
const needsCompletionTokens = (modelId: string) => /^gpt-(5|6)/.test(modelId);

const patchedFetch: typeof fetch = async (input, init) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body);

      if (typeof body.model === 'string' && needsCompletionTokens(body.model) && body.max_tokens != null) {
        if (body.max_completion_tokens == null) {
          body.max_completion_tokens = body.max_tokens;
        }

        delete body.max_tokens;
        init = { ...init, body: JSON.stringify(body) };
      }
    } catch {
      // JSON 이 아니면 그대로 통과
    }
  }

  return fetch(input, init);
};

export default class OpenAIProvider extends BaseProvider {
  name = 'OpenAI';
  getApiKeyLink = 'https://platform.openai.com/api-keys';

  config = {
    apiTokenKey: 'OPENAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // GPT-6 Astra: 2026-09-03 출시, 최신 플래그십
    {
      name: 'gpt-6-astra',
      label: 'GPT-6 Astra (최신)',
      provider: 'OpenAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 16384,
    },

    // GPT-5.6 Sol: 2026-07-09 출시, 범용 고성능
    {
      name: 'gpt-5.6-sol',
      label: 'GPT-5.6 Sol',
      provider: 'OpenAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 16384,
    },

    // GPT-5.6 Terra: 2026-07-09 출시, 중간 등급
    {
      name: 'gpt-5.6-terra',
      label: 'GPT-5.6 Terra',
      provider: 'OpenAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 16384,
    },

    // GPT-5.6 Luna: 2026-07-09 출시, 경량·저비용
    {
      name: 'gpt-5.6-luna',
      label: 'GPT-5.6 Luna (저비용)',
      provider: 'OpenAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 16384,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'OPENAI_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.openai.com/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    const data = res.data.filter(
      (model: any) =>
        model.object === 'model' &&
        (model.id.startsWith('gpt-') || model.id.startsWith('o') || model.id.startsWith('chatgpt-')) &&
        !staticModelIds.includes(model.id),
    );

    return data.map((m: any) => {
      // Get accurate context window from OpenAI API
      let contextWindow = 32000; // default fallback

      // OpenAI provides context_length in their API response
      if (m.context_length) {
        contextWindow = m.context_length;
      } else if (m.id?.includes('gpt-4o')) {
        contextWindow = 128000; // GPT-4o has 128k context
      } else if (m.id?.includes('gpt-4-turbo') || m.id?.includes('gpt-4-1106')) {
        contextWindow = 128000; // GPT-4 Turbo has 128k context
      } else if (m.id?.includes('gpt-4')) {
        contextWindow = 8192; // Standard GPT-4 has 8k context
      } else if (m.id?.includes('gpt-3.5-turbo')) {
        contextWindow = 16385; // GPT-3.5-turbo has 16k context
      }

      // Determine completion token limits based on model type (accurate 2025 limits)
      let maxCompletionTokens = 4096; // default for most models

      if (m.id?.startsWith('o1-preview')) {
        maxCompletionTokens = 32000; // o1-preview: 32K output limit
      } else if (m.id?.startsWith('o1-mini')) {
        maxCompletionTokens = 65000; // o1-mini: 65K output limit
      } else if (m.id?.startsWith('o1')) {
        maxCompletionTokens = 32000; // Other o1 models: 32K limit
      } else if (m.id?.includes('o3') || m.id?.includes('o4')) {
        maxCompletionTokens = 100000; // o3/o4 models: 100K output limit
      } else if (m.id?.includes('gpt-4o')) {
        maxCompletionTokens = 4096; // GPT-4o standard: 4K (64K with long output mode)
      } else if (m.id?.includes('gpt-4')) {
        maxCompletionTokens = 8192; // Standard GPT-4: 8K output limit
      } else if (m.id?.includes('gpt-3.5-turbo')) {
        maxCompletionTokens = 4096; // GPT-3.5-turbo: 4K output limit
      }

      return {
        name: m.id,
        label: `${m.id} (${Math.floor(contextWindow / 1000)}k context)`,
        provider: this.name,
        maxTokenAllowed: Math.min(contextWindow, 128000), // Cap at 128k for safety
        maxCompletionTokens,
      };
    });
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'OPENAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      apiKey,
      fetch: patchedFetch,
    });

    return openai(model);
  }
}
