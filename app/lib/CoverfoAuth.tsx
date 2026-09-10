/*
 * src/components/CoverfoAuth.tsx
 * bolt.diy의 app/components/header.tsx 위에 import 해서 사용
 */
import { useEffect, useState } from 'react';
import { supabase } from '~/lib/supabaseClient';

export function CoverfoAuth() {
  const [email, setEmail] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://coverfo.com' },
    });

    if (!error) {
      alert('이메일로 로그인 링크 보냈어요! coverfo.com');
    } else {
      alert(error.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (user) {
    return (
      <div className="flex items-center gap-2 text-sm max-w-full">
        <span className="opacity-70 truncate max-w-[40vw]">{user.email}</span>
        <button onClick={signOut} className="px-3 py-1 rounded bg-zinc-800 text-white shrink-0 whitespace-nowrap">
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 max-w-full">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@coverfo.com"
        className="px-3 py-1 rounded bg-white text-black placeholder-zinc-400 border border-zinc-300 w-32 sm:w-56 min-w-0 text-sm"
      />
      <button
        onClick={signIn}
        className="px-3 py-1 rounded bg-white text-black font-medium shrink-0 whitespace-nowrap text-sm"
      >
        로그인 / 가입
      </button>
    </div>
  );
}
