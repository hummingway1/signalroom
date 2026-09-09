// apps/web/src/components/MyPage.jsx
import { useState } from 'react';

export function MyPage({ nickname, onBack, onHome, onOpenProducts, onLogout, onOpenLegal, onLogin }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await onLogout();
  }

  return (
    <div className="subscreen">
      <div className="subscreen__header">
        <button onClick={onBack} className="chat-header__back" aria-label="뒤로가기">‹</button>
        <div><p className="subscreen__header-title">마이페이지</p></div>
        {onHome && <button className="subscreen__header-home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </div>
      <div className="subscreen__body">
        {nickname ? (
          <>
            <div className="mypage__profile">
              <p className="mypage__nickname">{nickname}님</p>
            </div>
            {onOpenProducts && (
              <button className="mypage__products-btn" onClick={onOpenProducts}>상품 안내 / 구매</button>
            )}
            <button className="mypage__logout-btn" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? '로그아웃 중...' : '로그아웃'}
            </button>
          </>
        ) : (
          // §Toss 심사 준비 — 비로그인 방문자(신규 사용자, 심사자 포함)를 위한 로그인 진입점.
          // 이전엔 이 화면이 "이미 로그인된 사용자"만 가정해서, 로그인 화면 자체로 갈 방법이
          // 전혀 없었다(실제 브라우저 테스트로 발견).
          onLogin && (
            <div className="mypage__profile">
              <p className="mypage__nickname">로그인이 필요해요</p>
              <button className="mypage__products-btn" onClick={onLogin}>로그인 / 회원가입</button>
            </div>
          )
        )}
        {onOpenLegal && (
          <div className="mypage__legal-links">
            <button className="mypage__legal-link" onClick={() => onOpenLegal('terms')}>이용약관</button>
            <button className="mypage__legal-link" onClick={() => onOpenLegal('privacy')}>개인정보처리방침</button>
            <button className="mypage__legal-link" onClick={() => onOpenLegal('business')}>사업자 정보 / 고객센터</button>
          </div>
        )}
      </div>
    </div>
  );
}
