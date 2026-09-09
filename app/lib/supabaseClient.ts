/*
 * src/lib/supabaseClient.ts
 * bolt.diy 프로젝트의 app/lib/ 에 넣기
 */
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!);

export type Plan = 'free' | 'starter' | 'pro';

export interface Profile {
  id: string;
  email: string;
  plan: Plan;
  prompt_count: number;
  prompt_limit: number;
  byok_enabled: boolean;
}
