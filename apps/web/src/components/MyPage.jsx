// apps/web/src/components/MyPage.jsx
import { useState } from 'react';

export function MyPage({ nickname, onBack, onHome, onOpenProducts, onLogout, onOpenLegal }) {
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
        <div className="mypage__profile">
          <p className="mypage__nickname">{nickname}님</p>
        </div>
        {onOpenProducts && (
          <button className="mypage__products-btn" onClick={onOpenProducts}>상품 안내 / 구매</button>
        )}
        <button className="mypage__logout-btn" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
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
