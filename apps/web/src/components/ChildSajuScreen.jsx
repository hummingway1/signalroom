// apps/web/src/components/ChildSajuScreen.jsx
//
// §6 재구축 — 이전엔 카탈로그 선택형(자유 텍스트 없음, child_profile_id 미연결)이었다. 이제 실제
// child_profile_id 파이프라인(useChildCoachController)에 연결된 자유 텍스트 채팅이다.
// 흐름: 아이 정보 입력 → 캐주얼 대화(고민 자연스럽게 수집) → 기본/전체 사주 선택(상시 노출) →
//       분석 결과 → 계속 코칭 대화(§14 — 결과 화면에서도 채팅 가능).
import { useEffect, useState } from 'react';
import { CharacterAvatar } from './CharacterAvatar.jsx';
import { ChatInput } from './ChatInput.jsx';
import { MessageList } from './MessageList.jsx';
import { useChildCoachController } from '../hooks/useChildCoachController.js';
import { HOUR_OPTIONS } from '../birthTimeOptions.js';

function ChildBirthForm({ onSubmit, isSubmitting, error }) {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [hourLabel, setHourLabel] = useState(HOUR_OPTIONS[0].label);
  const [gender, setGender] = useState('female');

  function handleSubmit(e) {
    e.preventDefault();
    if (!birthDate) return;
    const hour = HOUR_OPTIONS.find((h) => h.label === hourLabel) ?? HOUR_OPTIONS[0];
    onSubmit({ birthDate, birthTime: hour.time, gender, city: 'Seoul', name: name.trim() });
  }

  return (
    <div className="intake-screen">
      <div className="intake-card">
        <CharacterAvatar characterId="daegu" size={64} />
        <h1 className="intake-title" style={{ marginTop: 12 }}>우리 아이 성장 코치</h1>
        <p className="intake-subtitle">아이 정보를 알려주시면 이야기를 시작할게요.</p>
        <form onSubmit={handleSubmit} className="intake-form">
          <label>
            아이 이름 또는 호칭
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 첫째 민준" />
          </label>
          <label>
            생년월일 (양력)
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
          </label>
          <label>
            태어난 시간
            <select value={hourLabel} onChange={(e) => setHourLabel(e.target.value)}>
              {HOUR_OPTIONS.map((h) => (
                <option key={h.label} value={h.label}>{h.label}</option>
              ))}
            </select>
          </label>
          <label>
            성별
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="female">여자아이</option>
              <option value="male">남자아이</option>
            </select>
          </label>
          {error && <div className="intake-error">{error}</div>}
          <button type="submit" className="intake-submit" disabled={isSubmitting}>
            {isSubmitting ? '준비 중...' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ChildSajuScreen({ onBack, onHome }) {
  const coach = useChildCoachController();
  const [started, setStarted] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    coach.checkExistingProfile().then((existing) => {
      if (cancelled) return;
      if (existing) {
        coach.resumeExisting(existing).then(() => {
          if (!cancelled) setStarted(true);
        });
      }
      setCheckingExisting(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(childData) {
    await coach.start(childData);
    setStarted(true);
  }

  if (checkingExisting) {
    return <div className="intake-screen"><p className="intake-subtitle">불러오는 중...</p></div>;
  }

  if (!started) {
    return <ChildBirthForm onSubmit={handleSubmit} isSubmitting={coach.isBooting} error={coach.error} />;
  }

  // §3 — 처음부터 버튼만 던지지 않는다. 부모가 최소 2번 이상 이야기를 나눈 뒤에만
  // "이제 사주도 한번 볼까요" 하고 자연스럽게 선택지를 보여준다(후킹 대화 우선).
  const userTurnCount = coach.messages.filter((m) => m.role === 'user').length;
  const showAnalysisOptions = userTurnCount >= 2 || coach.hasAnalysis;

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <button className="chat-header__back" onClick={onBack} aria-label="뒤로가기">‹</button>
        <CharacterAvatar characterId="daegu" size={42} />
        <div className="chat-header__info">
          <div className="chat-header__name">우리 아이 성장 코치</div>
          <div className="chat-header__status">대화 중</div>
        </div>
        {onHome && <button className="chat-header__home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </header>

      <MessageList messages={coach.messages} isTyping={coach.isTyping} currentCharacterId="daegu" />

      {coach.error && <div className="error-banner"><span>{coach.error}</span></div>}

      {/* §1 — 지금 대화에서 자연스럽게 이어지는 질문(최대 3개). 타이핑 중이거나 없으면 표시 안 함. */}
      {!coach.isTyping && coach.suggestedQuestions.length > 0 && (
        <div className="quick-replies">
          {coach.suggestedQuestions.map((q, i) => (
            <button key={i} className="quick-reply-chip" onClick={() => coach.sendMessage(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* §3 — 처음부터 버튼만 던지지 않는다. 최소 2턴 이상 이야기를 나눈 뒤에만 자연스럽게 노출. */}
      {showAnalysisOptions && (
        <div className="quick-replies">
          {!coach.freeTierExhausted && (
            <button className="quick-reply-chip" onClick={() => coach.requestAnalysis('basic')} disabled={coach.isTyping}>
              기본 사주 보기 (무료 1회)
            </button>
          )}
          <button className="quick-reply-chip" onClick={() => coach.requestAnalysis('full')} disabled={coach.isTyping}>
            전체 사주 보기 (유료)
          </button>
        </div>
      )}

      {/* §14 — 분석 결과를 본 뒤에도 채팅이 막히지 않는다. */}
      <ChatInput characterId="daegu" onSend={coach.sendMessage} />
    </div>
  );
}
