// apps/web/src/components/CompatibilityScreen.jsx
//
// ⚠️ 엔터테인먼트 콘텐츠 — packages/character/compatibility-content.mjs 참고.
import { useState } from 'react';
import { CharacterAvatar } from './CharacterAvatar.jsx';
import { ShareCard } from './ShareCard.jsx';
import * as api from '../api/client.js';

export function CompatibilityScreen({ myChartId, onBack, onHome }) {
  const [step, setStep] = useState('input'); // input | loading | result
  const [partner, setPartner] = useState({ birthDate: '', birthTime: '12:00', gender: 'female' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!partner.birthDate) return;
    setStep('loading');
    setError(null);
    try {
      const partnerChart = await api.createChart({ ...partner, city: 'Seoul' });
      const compat = await api.getCompatibility(myChartId, partnerChart.id);
      setResult(compat);
      setStep('result');
    } catch (err) {
      setError(err.message ?? '궁합을 볼 수 없었어요.');
      setStep('input');
    }
  }

  return (
    <div className="subscreen">
      <div className="subscreen__header">
        <button onClick={onBack} className="chat-header__back" aria-label="뒤로가기">‹</button>
        <CharacterAvatar characterId="cupid" size={36} />
        <div>
          <p className="subscreen__header-title">궁합</p>
          <p className="subscreen__header-subtitle">큐피가 봐주는 재미 궁합 💘</p>
        </div>
        {onHome && <button className="subscreen__header-home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </div>

      <div className="subscreen__body">
        {step === 'input' && (
          <form onSubmit={handleSubmit} className="intake-form compat-form slide-up">
            <p className="compat-form__lead">상대방 정보를 알려줘</p>
            <label>
              생년월일
              <input type="date" value={partner.birthDate} onChange={(e) => setPartner((p) => ({ ...p, birthDate: e.target.value }))} required />
            </label>
            <label>
              태어난 시간
              <input type="time" value={partner.birthTime} onChange={(e) => setPartner((p) => ({ ...p, birthTime: e.target.value }))} />
            </label>
            <label>
              성별
              <select value={partner.gender} onChange={(e) => setPartner((p) => ({ ...p, gender: e.target.value }))}>
                <option value="female">여성</option>
                <option value="male">남성</option>
              </select>
            </label>
            {error && <div className="intake-error">{error}</div>}
            <button type="submit" className="intake-submit">궁합 보기</button>
          </form>
        )}

        {step === 'loading' && <p className="leaderboard__loading">큐피가 궁합을 보는 중...</p>}

        {step === 'result' && result && (
          <div className="compat-result slide-up">
            <div className="compat-result__score">{result.score}</div>
            <div className="compat-result__emoji">{result.emoji}</div>
            <p className="compat-result__label">{result.label}</p>
            <p className="compat-result__note">{result.note}</p>
            <ShareCard
              tier="free"
              title={result.label}
              subtitle={`궁합 점수 ${result.score}점`}
              emoji={result.emoji}
            />
          </div>
        )}
      </div>

      <div className="subscreen__footer">
        <button onClick={onBack} className="subscreen__btn-full">대화로 돌아가기</button>
      </div>
    </div>
  );
}
