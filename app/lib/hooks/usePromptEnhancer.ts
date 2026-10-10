import { useState } from 'react';
import type { ProviderInfo } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';

/* coverfo: 브라우저에 저장된 Supabase 로그인 토큰 (홈 화면 sbAuth 와 같은 방법 — supabase 모듈을 불러오지 않음) */
function cfLoginToken(): string {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);

      if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) {
        const v = JSON.parse(localStorage.getItem(k) || 'null');
        const t = v && (v.access_token || (v.currentSession && v.currentSession.access_token));

        if (t) {
          return String(t);
        }
      }
    }
  } catch {
    // 저장소를 못 읽으면 토큰 없이 (서버가 로그인 필요로 안내)
  }

  return '';
}

const logger = createScopedLogger('usePromptEnhancement');

export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (
    input: string,
    setInput: (value: string) => void,
    model: string,
    provider: ProviderInfo,
    apiKeys?: Record<string, string>,
  ) => {
    setEnhancingPrompt(true);
    setPromptEnhanced(false);

    const requestBody: any = {
      message: input,
      model,
      provider,
    };

    if (apiKeys) {
      requestBody.apiKeys = apiKeys;
    }

    // coverfo: 로그인 토큰을 붙여 보냄 (서버가 로그인한 사람만 받음)
    const cfToken = cfLoginToken();

    const response = await fetch('/api/enhancer', {
      method: 'POST',
      headers: cfToken ? { Authorization: 'Bearer ' + cfToken } : undefined,
      body: JSON.stringify(requestBody),
    });

    const reader = response.body?.getReader();

    const originalInput = input;

    if (reader) {
      const decoder = new TextDecoder();

      let _input = '';
      let _error;

      try {
        setInput('');

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            break;
          }

          _input += decoder.decode(value);

          logger.trace('Set input', _input);

          setInput(_input);
        }
      } catch (error) {
        _error = error;
        setInput(originalInput);
      } finally {
        if (_error) {
          logger.error(_error);
        }

        setEnhancingPrompt(false);
        setPromptEnhanced(true);

        setTimeout(() => {
          setInput(_input);
        });
      }
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
