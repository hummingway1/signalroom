// apps/web/src/components/BirthDataForm.jsx
//
// Figma BirthScreen 이식 — 딱딱한 회원가입 폼이 아니라 대구가 먼저 말을 걸고("잠깐, 생년월일 먼저
// 알아야 할 것 같은데." / "언제 태어났어?") 그 아래 카드로 입력을 받는 대화형 UI. 타이밍도 Figma
// 그대로(phase 1: 0.35s, phase 2: 1.05s, phase 3: 1.8s).
//
// Figma 원본엔 없지만 백엔드 API 계약상 반드시 필요한 필드 2개(성별, 태어난 곳)를 같은 카드 안에
// 자연스럽게 추가했다 — §2(API 계약 유지)를 지키기 위한 최소 추가, 대화형 톤은 유지.
import { useState } from 'react';
import { CharacterAvatar } from './CharacterAvatar.jsx';
import { HOUR_OPTIONS } from '../birthTimeOptions.js';

const YEAR_OPTIONS = Array.from({ length: 61 }, (_, i) => String(1950 + i));
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => String(i + 1));

export function BirthDataForm({ onSubmit, isSubmitting, error, onBack, onHome }) {
  const [year, setYear] = useState('1995');
  const [month, setMonth] = useState('6');
  const [day, setDay] = useState('15');
  const [hourLabel, setHourLabel] = useState(HOUR_OPTIONS[0].label);
  const [gender, setGender] = useState('female');
  const [city, setCity] = useState('');

  function handleSubmit() {
    const selectedHour = HOUR_OPTIONS.find((h) => h.label === hourLabel) ?? HOUR_OPTIONS[0];
    const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onSubmit({ birthDate, birthTime: selectedHour.time, gender, city: city.trim() || 'Seoul' });
  }

  const canSubmit = city.trim().length > 0;

  return (
    <div className="birth-screen">
      <div className="chat-header">
        {onBack && <button className="chat-header__back" onClick={onBack} aria-label="뒤로가기">‹</button>}
        <CharacterAvatar characterId="daegu" size={42} />
        <div className="chat-header__info">
          <div className="chat-header__name">대구</div>
          <div className="chat-header__status">지금 이야기 중</div>
        </div>
        {onHome && <button className="chat-header__home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </div>

      <div className="birth-screen__messages">
        <div className="birth-screen__msg-row msg-in">
          <div className="birth-screen__avatar-slot">
            <CharacterAvatar characterId="daegu" size={32} />
          </div>
          <div className="birth-screen__bubble">잠깐, 생년월일 먼저 알아야 할 것 같은데.</div>
        </div>
        <div className="birth-screen__msg-row msg-in">
          <div className="birth-screen__avatar-slot birth-screen__avatar-slot--hidden" />
          <div className="birth-screen__bubble">언제, 어디서 태어났어?</div>
        </div>

        <div className="birth-screen__form-row slide-up">
          <div className="birth-screen__avatar-slot birth-screen__avatar-slot--hidden" />
          <div className="birth-screen__form-card">
            <div>
              <p className="birth-screen__field-label">생년월일 (양력)</p>
              <div className="birth-screen__row">
                <select className="birth-screen__select birth-screen__select--year" value={year} onChange={(e) => setYear(e.target.value)}>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
                <select className="birth-screen__select birth-screen__select--month" value={month} onChange={(e) => setMonth(e.target.value)}>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
                <select className="birth-screen__select birth-screen__select--day" value={day} onChange={(e) => setDay(e.target.value)}>
                  {DAY_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}일</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="birth-screen__field-label">
                태어난 시간 <span>(몰라도 괜찮아 — 정오로 계산할게)</span>
              </p>
              <select className="birth-screen__select birth-screen__select--full" value={hourLabel} onChange={(e) => setHourLabel(e.target.value)}>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h.label} value={h.label}>{h.label}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="birth-screen__field-label">성별</p>
              <div className="birth-screen__radio-group">
                <button
                  type="button"
                  className={`birth-screen__radio${gender === 'female' ? ' birth-screen__radio--active' : ''}`}
                  onClick={() => setGender('female')}
                >
                  여성
                </button>
                <button
                  type="button"
                  className={`birth-screen__radio${gender === 'male' ? ' birth-screen__radio--active' : ''}`}
                  onClick={() => setGender('male')}
                >
                  남성
                </button>
              </div>
            </div>

            <div>
              <p className="birth-screen__field-label">태어난 곳</p>
              <input
                type="text"
                className="birth-screen__select birth-screen__select--full"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="예: 서울, 부산, Seoul"
              />
            </div>
          </div>
        </div>
      </div>

      {error && <div className="intake-error">{error}</div>}

      <div className="birth-screen__footer">
        <button onClick={handleSubmit} disabled={!canSubmit || isSubmitting} className="birth-screen__submit">
          {isSubmitting ? '준비 중...' : '대화 시작하기'}
        </button>
      </div>
    </div>
  );
}
