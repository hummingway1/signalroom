import { ChevronRight, ArrowRight } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo.jsx';
import { PERSONALITY } from '../data/personality.js';

// 재방문 화면 — 이전 분석 요약을 보여주고, 후속 질문 또는 새 고민으로 진입.
export function ReturnScreen({ info, onContinue, onNew }) {
  const name = info.name || '아이';
  const p = PERSONALITY[info.topic] ?? PERSONALITY.school;

  const FOLLOW_UPS = [
    `${name}이 요즘 어떤가요?`,
    `지난번 이후로 달라진 게 있나요?`,
    `이번 주 어떤 변화가 있었나요?`,
  ];

  return (
    <div className="phone-shell" style={{ background: '#F4FAF8' }}>
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center gap-2 mb-6">
          <BrandLogo />
        </div>
        <div className="fade-up">
          <p className="text-sm mb-1" style={{ color: '#7A9BAA' }}>
            다시 오셨군요 😊
          </p>
          <h1 className="text-[24px] font-bold leading-snug mb-4" style={{ color: '#1A3344' }}>
            {name}이의 이야기,
            <br />
            이어서 살펴볼까요?
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-4">
        <div
          className="rounded-3xl p-5 fade-up"
          style={{ background: 'linear-gradient(135deg, #39A89B, #2D9088)', animationDelay: '0.08s' }}
        >
          <p className="text-xs opacity-70 mb-1" style={{ color: 'white' }}>
            이전 분석 결과
          </p>
          <p className="text-lg font-bold mb-0.5" style={{ color: 'white' }}>
            {p.type}
          </p>
          <p className="text-xs opacity-80" style={{ color: 'white' }}>
            {p.sub}
          </p>
        </div>

        <div className="rounded-3xl p-5 fade-up" style={{ background: 'white', animationDelay: '0.14s' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#1A3344' }}>
            오늘은 무엇이 궁금하세요?
          </p>
          <div className="space-y-2">
            {FOLLOW_UPS.map((q) => (
              <button
                key={q}
                onClick={onContinue}
                className="w-full text-left px-4 py-3 rounded-2xl text-sm flex items-center justify-between active:scale-[0.98] transition-transform"
                style={{ background: '#F4FAF8', color: '#1A3344' }}
              >
                {q}
                <ChevronRight size={16} color="#8AADBA" className="flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl p-5 fade-up" style={{ background: 'white', animationDelay: '0.2s' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#1A3344' }}>
            새로운 고민이 생겼나요?
          </p>
          <p className="text-xs mb-3" style={{ color: '#7A9BAA' }}>
            다른 주제로 새 대화를 시작할 수 있어요
          </p>
          <button
            onClick={onNew}
            className="w-full py-3 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
            style={{ background: '#EDF8F6', color: '#39A89B' }}
          >
            새 고민 시작하기
          </button>
        </div>
      </div>

      <div className="px-5 pb-10 pt-3 flex-shrink-0">
        <button
          onClick={onContinue}
          className="w-full py-4 rounded-2xl font-bold text-white text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #39A89B 0%, #2D9088 100%)' }}
        >
          솔이와 이야기 이어가기 <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
