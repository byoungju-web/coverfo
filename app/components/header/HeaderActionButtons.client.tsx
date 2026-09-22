interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

/*
 * 헤더 오른쪽 버튼 자리
 * - Deploy 버튼과 개발자용 Report Bug / Debug Log 버튼은 일반 사용자에게 필요 없어 모두 뺐습니다.
 * - 나중에 버튼을 다시 넣을 때 Header.tsx 는 건드리지 않도록 이 부품은 그대로 둡니다.
 */
export function HeaderActionButtons({ chatStarted: _chatStarted }: HeaderActionButtonsProps) {
  return null;
}
