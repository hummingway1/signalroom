import { ChevronLeft, Lock, Check } from 'lucide-react';
import { PERSONALITY } from '../data/personality.js';

// 기본(무료) 분석 결과 — 기질 유형, 지표 막대, 특징 리스트, 그리고
// 상세 분석(프리미엄) 업셀 카드.
export function BasicAnalysisScreen({ info, onDetail, onBack, onChat }) {
  const name = info.name || '아이';
  const p = PERSONALITY[info.topic] ?? PERSONALITY.school;

  return (
    <div className="phone-shell" style={{ background: '#F4FAF8' }}>
      <div
        className="flex items-center gap-3 px-5 pt-12 pb-4 flex-shrink-0"
        style={{ background: 'white', borderBottom: '1px solid #EBF5F2' }}
      >
        <button onClick={onBack} aria-label="뒤로">
          <ChevronLeft size={22} color="#1A3344" />
        </button>
        <h2 className="font-bold text-lg" style={{ color: '#1A3344' }}>
          기본 분석 결과
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        <div
          className="rounded-3xl p-5 fade-up"
          style={{ background: 'linear-gradient(135deg, #39A89B 0%, #2D9088 100%)' }}
        >
          <div className="text-xs font-semibold mb-1 opacity-70" style={{ color: 'white' }}>
            {name}이의 기질 유형
          </div>
          <div className="text-2xl font-bold mb-1" style={{ color: 'white' }}>
            {p.type}
          </div>
          <div className="text-sm opacity-80" style={{ color: 'white' }}>
            {p.sub}
          </div>
        </div>

        <div className="rounded-3xl p-5 fade-up" style={{ background: 'white', animationDelay: '0.1s' }}>
          <h3 className="font-bold text-sm mb-4" style={{ color: '#1A3344' }}>
            기질 지표
          </h3>
          <div className="space-y-3.5">
            {p.traits.map(([label, val, color], i) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: '#5A7A8A' }}>{label}</span>
                  <span className="font-semibold" style={{ color: '#39A89B' }}>
                    {val}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#EDF8F6' }}>
                  <div
                    className="h-full rounded-full bar-grow"
                    style={{ width: `${val}%`, background: color, animationDelay: `${0.2 + i * 0.1}s` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl p-5 fade-up" style={{ background: 'white', animationDelay: '0.2s' }}>
          <h3 className="font-bold text-sm mb-3" style={{ color: '#1A3344' }}>
            이런 모습이 있어요
          </h3>
          <div className="space-y-2.5">
            {p.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: '#EDF8F6' }}
                >
                  <Check size={11} color="#39A89B" />
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#3A5C6A' }}>
                  {tip}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-3xl p-5 fade-up border-2"
          style={{ background: 'white', borderColor: '#EDF8F6', animationDelay: '0.3s' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Lock size={15} color="#F07A6A" />
            <h3 className="font-bold text-sm" style={{ color: '#1A3344' }}>
              상세 분석 · 맞춤 조언
            </h3>
            <span
              className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#FEF0ED', color: '#F07A6A' }}
            >
              프리미엄
            </span>
          </div>
          <p className="text-xs leading-relaxed mb-4" style={{ color: '#7A9BAA' }}>
            {name}이의 관계 패턴, 감정 조절 방식과
            <br />
            엄마가 바로 써볼 수 있는 구체적인 조언을 담았어요.
          </p>
          <button
            onClick={onDetail}
            className="w-full py-3.5 rounded-2xl font-bold text-sm text-white active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, #F07A6A 0%, #E05A4A 100%)' }}
          >
            상세 분석 보기 · 무료 체험
          </button>
        </div>

        <button
          onClick={onChat}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform fade-up"
          style={{
            background: 'white',
            color: '#39A89B',
            border: '2px solid #C8E8E3',
            animationDelay: '0.4s',
          }}
        >
          솔이와 더 이야기하기
        </button>
        <div className="pb-4" />
      </div>
    </div>
  );
}
