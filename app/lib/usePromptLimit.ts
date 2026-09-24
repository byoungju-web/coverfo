/*
 * app/lib/usePromptLimit.ts
 * 프롬프트 보내기 전에 크레딧을 확인하고 1 크레딧을 차감하는 훅
 * (무료 2회 방식 → 크레딧 차감 방식. 가입 시 무료 크레딧 20, 다 쓰면 충전 크레딧으로.)
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '~/lib/supabaseClient';
import type { Profile } from '~/lib/supabaseClient';

export interface Credits {
  free: number;
  paid: number;
}

const CHAT_COST = 1;

export function usePromptLimit() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);

  const loadCredits = useCallback(async () => {
    const { data, error } = await supabase.rpc('cf_my_credits');

    if (error || !data) {
      return null;
    }

    const c = { free: Number((data as any).free || 0), paid: Number((data as any).paid || 0) };
    setCredits(c);

    return c;
  }, []);

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
      await loadCredits();
    })();
  }, [loadCredits]);

  const canPrompt = () => {
    if (!credits) {
      return false;
    } // 로그인 필요

    return credits.free + credits.paid >= CHAT_COST;
  };

  const checkAndIncrement = async (): Promise<boolean> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert('coverfo.com 로그인 먼저!');
      return false;
    }

    // 보내기 전에 브라우저에서 1크레딧 차감 (무료 한도·기간 규칙은 DB 함수 cf_spend 가 적용)
    const { data, error } = await supabase.rpc('cf_spend_self', {
      p_cost: CHAT_COST,
      p_kind: 'chat',
      p_prompt: '',
    });

    if (error) {
      alert('크레딧 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.\n' + error.message);
      return false;
    }

    const r = (data || {}) as any;

    if (!r.ok) {
      if (r.reason === 'login') {
        alert('coverfo.com 로그인 먼저!');
      } else if (r.reason === 'pool_exhausted') {
        alert('이번 달 무료 이용 한도가 모두 소진되었습니다. 다음 달 1일에 다시 열립니다.\ncoverfo.com/pricing 에서 충전하시면 계속 쓸 수 있습니다.');
      } else if (r.reason === 'free_closed') {
        alert('무료 크레딧 제공 기간이 끝났습니다.\ncoverfo.com/pricing 에서 충전해 주세요.');
      } else {
        const have = Number(r.free || 0) + Number(r.paid || 0);
        alert(`크레딧이 부족합니다. (보유 ${have} · 필요 ${CHAT_COST})\ncoverfo.com/pricing 에서 크레딧을 충전해 주세요.`);
      }

      return false;
    }

    setCredits({ free: Number(r.free || 0), paid: Number(r.paid || 0) });

    return true;
  };

  return { profile, credits, loadCredits, canPrompt, checkAndIncrement };
}
