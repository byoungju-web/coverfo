/*
 * src/hooks/usePromptLimit.ts
 * 프롬프트 보내기 전에 체크하는 훅
 */
import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabaseClient';
import type { Profile } from '~/lib/supabaseClient';

export function usePromptLimit() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data as Profile);
    })();
  }, []);

  const canPrompt = () => {
    if (!profile) {
      return false;
    } // 로그인 필요

    if (profile.byok_enabled) {
      return true;
    } // 자기 키면 무제한

    return profile.prompt_count < profile.prompt_limit;
  };

  const checkAndIncrement = async (): Promise<boolean> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert('coverfo.com 로그인 먼저!');
      return false;
    }

    const { data: p } = (await supabase.from('profiles').select('*').eq('id', user.id).single()) as any;

    if (!p) {
      return false;
    }

    if (!p.byok_enabled && p.prompt_count >= p.prompt_limit) {
      if (p.plan === 'free') {
        alert(
          `무료 2회 다 썼어요! coverfo.com/pricing 에서 9900원 플랜으로 업그레이드 하세요. 또는 설정에서 본인 API키를 넣으면 무제한 무료!`,
        );
      } else {
        alert('사용량 초과! API키를 직접 입력해주세요.');
      }

      return false;
    }

    // BYOK가 아니면 카운트 증가
    if (!p.byok_enabled) {
      await supabase.rpc('increment_prompt_count', { user_id: user.id });
    }

    return true;
  };

  return { profile, canPrompt, checkAndIncrement };
}
