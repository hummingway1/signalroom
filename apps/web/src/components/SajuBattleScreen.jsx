// apps/web/src/components/SajuBattleScreen.jsx
//
// §13 수정: 이전엔 상대방 정보를 입력받아도 결과는 여전히 정적 데모 데이터(BATTLE_ITEMS)였다.
// 이제 CompatibilityScreen과 동일한 방식으로 실제 두 사람의 canonical chart를 생성해서 기존
// compatibility 계산 엔진(/api/compatibility, 결정론적 — 같은 두 사람이면 항상 같은 결과)을
// 호출한다. 새 계산 로직을 만든 게 아니라 이미 있는 엔진을 재사용 — §16 계산 엔진 무변경 원칙 유지.
import { useState } from 'react';
import { CharacterAvatar } from './CharacterAvatar.jsx';
import * as api from '../api/client.js';

export function SajuBattleScreen({ myChartId, onBack, onHome }) {
  const [step, setStep] = useState('input'); // input | loading | result
  const [opponentName, setOpponentName] = useState('');
  const [opponent, setOpponent] = useState({ birthDate: '', birthTime: '12:00', gender: 'female' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!opponent.birthDate || !myChartId) return; // 상대방 생년월일 없이는 절대 결과로 안 넘어간다
    setStep('loading');
    setError(null);
    try {
      const opponentChart = await api.createChart({ ...opponent, city: 'Seoul' });
      const compat = await api.getCompatibility(myChartId, opponentChart.id);
      setResult(compat);
      setStep('result');
    } catch (err) {
      setError(err.message ?? '결과를 불러오지 못했어요.');
      setStep('input');
    }
  }

  if (step === 'input') {
    return (
      <div className="subscreen">
        <div className="subscreen__header">
          <button onClick={onBack} className="chat-header__back" aria-label="뒤로가기">‹</button>
          <div>
            <p className="subscreen__header-title">사주 대결</p>
            <p className="subscreen__header-subtitle">상대방 정보를 알려줘</p>
          </div>
          {onHome && <button className="subscreen__header-home" onClick={onHome} aria-label="홈으로">⌂</button>}
        </div>
        <div className="subscreen__body">
          <form onSubmit={handleSubmit} className="intake-form compat-form slide-up">
            <p className="compat-form__lead">누구랑 대결할지 알려줘</p>
            <label>
              상대방 이름 또는 호칭 (선택)
              <input type="text" value={opponentName} onChange={(e) => setOpponentName(e.target.value)} placeholder="예: 친구" />
            </label>
            <label>
              생년월일
              <input type="date" value={opponent.birthDate} onChange={(e) => setOpponent((p) => ({ ...p, birthDate: e.target.value }))} required />
            </label>
            <label>
              태어난 시간
              <input type="time" value={opponent.birthTime} onChange={(e) => setOpponent((p) => ({ ...p, birthTime: e.target.value }))} />
            </label>
            <label>
              성별
              <select value={opponent.gender} onChange={(e) => setOpponent((p) => ({ ...p, gender: e.target.value }))}>
                <option value="female">여성</option>
                <option value="male">남성</option>
              </select>
            </label>
            {error && <div className="intake-error">{error}</div>}
            <button type="submit" className="intake-submit">대결 시작</button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className="intake-screen">
        <p className="intake-subtitle">계산하는 중...</p>
      </div>
    );
  }

  const friendLabel = opponentName.trim() || '친구';

  return (
    <div className="subscreen">
      <div className="subscreen__header">
        <button onClick={onBack} className="chat-header__back" aria-label="뒤로가기">‹</button>
        <div>
          <p className="subscreen__header-title">사주 대결</p>
          <p className="subscreen__header-subtitle">두 사람의 사주를 비교해봤어</p>
        </div>
        {onHome && <button className="subscreen__header-home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </div>

      <div className="subscreen__body">
        <div className="battle-vs-row slide-up">
          <div className="battle-vs-col">
            <CharacterAvatar characterId="daegu" size={54} />
            <p className="battle-vs-name">나</p>
          </div>
          <div className="battle-vs-label">vs</div>
          <div className="battle-vs-col">
            <CharacterAvatar characterId="manggu" size={54} />
            <p className="battle-vs-name">{friendLabel}</p>
          </div>
        </div>

        {/* 실제 두 사람의 canonical chart 기반 결정론적 결과(기존 compatibility 엔진 재사용) */}
        <div className="battle-result slide-up">
          <p className="battle-result__score">{result?.score}점</p>
          <p className="battle-result__label">{result?.label}</p>
          <p className="battle-result__note">{result?.note}</p>
        </div>

        <div className="battle-share slide-up">
          <p className="battle-share__text">{friendLabel}한테 보내볼래?</p>
          <button className="subscreen__btn-full" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            결과 공유하기
          </button>
        </div>
      </div>

      <div className="subscreen__footer">
        <button onClick={onBack} className="subscreen__btn-full">대화로 돌아가기</button>
      </div>
    </div>
  );
}
