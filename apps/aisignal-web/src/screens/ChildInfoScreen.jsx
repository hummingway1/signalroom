import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { TOPICS } from '../data/topics.js';
import { SolAvatar } from '../components/SolAvatar.jsx';

// 대화형 정보 입력 — 회원가입 폼이 아니라 솔이가 한 가지씩 물어보는 3단계.
// 0: 이름/별명, 1: 생년월일, 2: 성별
export function ChildInfoScreen({ topic, onComplete, onBack }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [gender, setGender] = useState('');

  const topicLabel = TOPICS.find((t) => t.id === topic)?.label ?? '';

  const isValid = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1)
      return (
        birthYear.length === 4 &&
        +birthMonth >= 1 &&
        +birthMonth <= 12 &&
        +birthDay >= 1 &&
        +birthDay <= 31
      );
    return gender !== '';
  };

  const next = () => {
    if (step < 2) {
      setStep((s) => s + 1);
      return;
    }
    onComplete({ name: name.trim(), birthYear, birthMonth, birthDay, gender, topic });
  };

  const AI_MSG = [
    `"${topicLabel}"에 대해 이야기 나눠볼게요.\n아이를 어떻게 불러드릴까요?`,
    `${name || '아이'}의 생년월일을 알려주세요.\n기질을 이해하는 데 도움이 돼요.`,
    `${name || '아이'}이 남자아이인가요,\n여자아이인가요?`,
  ];

  return (
    <div className="phone-shell" style={{ background: '#F4FAF8' }}>
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button onClick={step === 0 ? onBack : () => setStep((s) => s - 1)} aria-label="뒤로">
          <ChevronLeft size={22} color="#1A3344" />
        </button>
        <div className="flex gap-1.5 flex-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full transition-all duration-300"
              style={{ background: i <= step ? '#39A89B' : '#C8E8E3' }}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 px-5 flex flex-col">
        <div className="flex items-start gap-3 mt-4 mb-8 msg-in" key={`msg-${step}`}>
          <SolAvatar size={40} />
          <div>
            <div className="text-xs font-bold mb-1.5" style={{ color: '#39A89B' }}>
              솔이
            </div>
            <div
              className="rounded-2xl rounded-tl-none px-4 py-3 text-sm leading-relaxed whitespace-pre-line"
              style={{ background: 'white', color: '#1A3344', maxWidth: 260 }}
            >
              {AI_MSG[step]}
            </div>
          </div>
        </div>

        <div className="fade-up" key={`input-${step}`}>
          {step === 0 && (
            <>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#5A7A8A' }}>
                아이 이름 또는 별명
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && isValid() && next()}
                placeholder="예: 민준이, 우리 딸"
                className="w-full px-4 py-3.5 rounded-2xl text-base outline-none border-2 transition-colors"
                style={{
                  background: 'white',
                  color: '#1A3344',
                  borderColor: name ? '#39A89B' : '#D8EEEA',
                }}
              />
            </>
          )}

          {step === 1 && (
            <>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#5A7A8A' }}>
                생년월일
              </label>
              <div className="flex gap-2">
                <input
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ''))}
                  placeholder="2018년"
                  maxLength={4}
                  inputMode="numeric"
                  className="px-3 py-3.5 rounded-2xl text-base text-center outline-none border-2 transition-colors"
                  style={{
                    flex: 2,
                    minWidth: 0,
                    width: 0,
                    background: 'white',
                    color: '#1A3344',
                    borderColor: birthYear.length === 4 ? '#39A89B' : '#D8EEEA',
                  }}
                />
                <input
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value.replace(/\D/g, ''))}
                  placeholder="월"
                  maxLength={2}
                  inputMode="numeric"
                  className="px-3 py-3.5 rounded-2xl text-base text-center outline-none border-2 transition-colors"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    width: 0,
                    background: 'white',
                    color: '#1A3344',
                    borderColor: birthMonth ? '#39A89B' : '#D8EEEA',
                  }}
                />
                <input
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value.replace(/\D/g, ''))}
                  placeholder="일"
                  maxLength={2}
                  inputMode="numeric"
                  className="px-3 py-3.5 rounded-2xl text-base text-center outline-none border-2 transition-colors"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    width: 0,
                    background: 'white',
                    color: '#1A3344',
                    borderColor: birthDay ? '#39A89B' : '#D8EEEA',
                  }}
                />
              </div>
              <p className="text-xs mt-2" style={{ color: '#8AADBA' }}>
                생년월일은 기질 분석에만 활용되며 저장하지 않아요.
              </p>
            </>
          )}

          {step === 2 && (
            <div className="flex gap-3">
              {[
                { v: 'boy', label: '남자아이', emoji: '👦' },
                { v: 'girl', label: '여자아이', emoji: '👧' },
              ].map(({ v, label, emoji }) => (
                <button
                  key={v}
                  onClick={() => setGender(v)}
                  className="flex-1 py-5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all active:scale-[0.97]"
                  style={{
                    background: gender === v ? '#EDF8F6' : 'white',
                    borderColor: gender === v ? '#39A89B' : '#D8EEEA',
                  }}
                >
                  <span className="text-3xl">{emoji}</span>
                  <span className="text-sm font-semibold" style={{ color: '#1A3344' }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto pb-10 pt-8">
          <button
            onClick={next}
            disabled={!isValid()}
            className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-all"
            style={{
              background: isValid()
                ? 'linear-gradient(135deg, #39A89B 0%, #2D9088 100%)'
                : '#D8EEEA',
              color: isValid() ? 'white' : '#8AADBA',
            }}
          >
            {step < 2 ? '다음' : '대화 시작하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
