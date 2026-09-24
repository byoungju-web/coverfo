/*
 * coverfo: 탭이 멈추기 직전에 무엇을 하고 있었는지 남기는 기록장.
 * 브라우저 저장소(localStorage)에 즉시 쓰므로, 탭이 죽은 뒤 새로고침해도 남아 있습니다.
 * 확인: 콘솔에서  localStorage.getItem('cf-trace')
 */
const KEY = 'cf-trace';
const MAX = 40;

export function cfTrace(label: string, extra?: string | number) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const now = new Date();
    const time = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    const line = `${time} ${label}${extra !== undefined ? ' ' + extra : ''}`;
    const prev = window.localStorage.getItem(KEY) || '';
    const lines = prev ? prev.split('\n') : [];

    lines.push(line);

    if (lines.length > MAX) {
      lines.splice(0, lines.length - MAX);
    }

    window.localStorage.setItem(KEY, lines.join('\n'));
  } catch {
    // 기록이 안 돼도 앱 동작에는 영향 없음
  }
}
