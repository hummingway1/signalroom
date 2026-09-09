// apps/web/src/components/NicknameSignup.jsx
//
// 닉네임 기반 경량 계정 — 실제로 작동한다. 카카오/네이버/구글 로그인 전부 STEP 3~4에서 실제로
// 연결됐다(백엔드에 실제 {PROVIDER}_CLIENT_ID/{PROVIDER}_REDIRECT_URI가 설정되어 있어야 실제로
// 동작 — 없으면 백엔드가 명확한 에러를 반환한다. 가짜로 동작하는 척하는 버튼을 만들지 않는다).
import { useState } from 'react';

import { API_BASE_URL } from '../config.js'; // production에서 실제 API 주소를 쓰도록 client.js와 동일한 소스 재사용(하드코딩 금지)
import * as api from '../api/client.js';

const SOCIAL_PROVIDERS = [
  { id: 'kakao', label: '카카오로 계속하기', background: '#FEE500' },
  { id: 'naver', label: '네이버로 계속하기', background: '#03C75A', color: '#fff' },
  { id: 'google', label: 'Google로 계속하기', background: '#fff', color: '#3c4043', border: '1px solid #dadce0' },
];

export function NicknameSignup({ onSubmit, isSubmitting, error, onBack, onEmailAuthSuccess }) {
  const [nickname, setNickname] = useState('');

  // §이메일/비밀번호 인증(기존 OAuth와 동일한 세션 쿠키 체계) — 위 "닉네임으로 시작하기"
  // (localStorage 기반 경량 계정)와는 완전히 별개의 정식 로그인 경로다.
  const [emailMode, setEmailMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailNickname, setEmailNickname] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (nickname.trim().length < 2) return;
    onSubmit(nickname.trim());
  }

  function handleSocialLogin(providerId) {
    // 익명 상태에서 만든 데이터(예: 자녀 프로필)를 로그인 후 실제 계정에 연결하기 위해
    // 현재 익명 userId를 함께 넘긴다(결정사항 §1) — 백엔드가 state 파라미터로 왕복시킨다.
    const anonymousUserId = localStorage.getItem('saju_anon_user_id') ?? '';
    const url = `${API_BASE_URL}/api/auth/${providerId}/start?anonymousUserId=${encodeURIComponent(anonymousUserId)}`;
    window.location.href = url;
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setEmailBusy(true);
    setEmailError(null);
    try {
      if (emailMode === 'signup') {
        const anonymousUserId = localStorage.getItem('saju_anon_user_id') ?? null;
        const { user, isNewUser } = await api.signupWithEmail({ email: email.trim(), password, nickname: emailNickname.trim(), anonymousUserId });
        onEmailAuthSuccess?.(user, isNewUser);
      } else {
        const { user } = await api.loginWithEmail({ email: email.trim(), password });
        onEmailAuthSuccess?.(user, false);
      }
    } catch (err) {
      setEmailError(err.message ?? (emailMode === 'signup' ? '회원가입에 실패했어요.' : '로그인에 실패했어요.'));
    } finally {
      setEmailBusy(false);
    }
  }

  const emailFormValid = emailMode === 'login'
    ? email.trim().length > 0 && password.length > 0
    : email.trim().length > 0 && password.length >= 8 && emailNickname.trim().length >= 2;

  return (
    <div className="intake-screen">
      {onBack && <button className="chat-header__back" style={{ alignSelf: 'flex-start', marginBottom: 8 }} onClick={onBack} aria-label="뒤로가기">‹ 뒤로</button>}
      <div className="intake-card">
        {/* §이메일/비밀번호 로그인·회원가입 */}
        <h1 className="intake-title">{emailMode === 'login' ? '이메일로 로그인' : '이메일로 회원가입'}</h1>
        <p className="intake-subtitle">
          {emailMode === 'login' ? '이메일과 비밀번호로 로그인해요.' : '이메일/비밀번호는 로그인용이고, 성별·생년월일·출생시간 같은 사주 정보는 다음 화면에서 따로 입력해요.'}
        </p>
        <form onSubmit={handleEmailSubmit} className="intake-form">
          <label>
            이메일
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" />
          </label>
          <label>
            비밀번호
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={emailMode === 'signup' ? '8자 이상' : ''} />
          </label>
          {emailMode === 'signup' && (
            <label>
              닉네임
              <input type="text" value={emailNickname} onChange={(e) => setEmailNickname(e.target.value)} placeholder="2~20자" maxLength={20} />
            </label>
          )}
          {emailError && <div className="intake-error">{emailError}</div>}
          <button type="submit" className="intake-submit" disabled={!emailFormValid || emailBusy}>
            {emailBusy ? '처리 중...' : emailMode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
        <button
          className="nickname-signup__mode-toggle"
          onClick={() => { setEmailMode(emailMode === 'login' ? 'signup' : 'login'); setEmailError(null); }}
        >
          {emailMode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </button>

        <div className="nickname-signup__divider"><span>또는</span></div>

        <div className="nickname-signup__social">
          {SOCIAL_PROVIDERS.map((p) => (
            <button
              key={p.id}
              className="nickname-signup__social-btn"
              style={{ background: p.background, color: p.color, border: p.border }}
              onClick={() => handleSocialLogin(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="nickname-signup__divider"><span>또는</span></div>

        {/* §기존 닉네임 전용 경량 계정(localStorage 기반) — 그대로 유지 */}
        <h1 className="intake-title" style={{ marginTop: 8 }}>닉네임으로 시작하기</h1>
        <p className="intake-subtitle">리더보드에 표시될 이름이자 로그인 아이디예요. 같은 닉네임으로 다시 들어오면 이전 기록이 그대로 이어져요.</p>

        <form onSubmit={handleSubmit} className="intake-form">
          <label>
            닉네임
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="2~20자"
              maxLength={20}
            />
          </label>
          {error && <div className="intake-error">{error}</div>}
          <button type="submit" className="intake-submit" disabled={nickname.trim().length < 2 || isSubmitting}>
            {isSubmitting ? '만드는 중...' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
