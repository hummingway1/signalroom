// apps/web/src/components/NicknameChooser.jsx
//
// 카카오/네이버/구글로 신규 가입한 직후에만 보여준다(재로그인 시에는 안 나옴). 기본값은 provider가
// 준 닉네임 그대로지만, 사용자가 원하는 이름으로 바꿀 수 있게 한다.
import { useState } from 'react';

export function NicknameChooser({ currentNickname, onSubmit, isSubmitting, error }) {
  const [nickname, setNickname] = useState(currentNickname ?? '');

  function handleSubmit(e) {
    e.preventDefault();
    if (nickname.trim().length < 2) return;
    onSubmit(nickname.trim());
  }

  return (
    <div className="intake-screen">
      <div className="intake-card">
        <h1 className="intake-title">닉네임을 정해주세요</h1>
        <p className="intake-subtitle">
          지금은 로그인하신 계정의 이름({currentNickname})으로 되어 있어요. 그대로 써도 되고, 원하는 이름으로 바꿔도 돼요.
        </p>
        <form onSubmit={handleSubmit} className="intake-form">
          <label>
            닉네임
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="2~20자"
              maxLength={20}
              autoFocus
            />
          </label>
          {error && <div className="intake-error">{error}</div>}
          <button type="submit" className="intake-submit" disabled={nickname.trim().length < 2 || isSubmitting}>
            {isSubmitting ? '저장하는 중...' : '이 닉네임으로 시작하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
