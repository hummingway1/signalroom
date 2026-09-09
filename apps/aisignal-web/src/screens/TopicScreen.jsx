import { ChevronLeft } from 'lucide-react';
import { TOPICS } from '../data/topics.js';

// 고민 주제 선택 — 2열 그리드, 카드마다 등장 딜레이를 조금씩 준다.
export function TopicScreen({ onSelect, onBack }) {
  return (
    <div className="phone-shell" style={{ background: '#F4FAF8' }}>
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button onClick={onBack} aria-label="뒤로">
          <ChevronLeft size={22} color="#1A3344" />
        </button>
        <div>
          <h2 className="font-bold text-lg leading-tight" style={{ color: '#1A3344' }}>
            어떤 부분이 걱정되세요?
          </h2>
          <p className="text-xs" style={{ color: '#8AADBA' }}>
            가장 가까운 고민을 선택해주세요
          </p>
        </div>
      </div>
      <div className="px-5 pb-8 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 mt-2">
          {TOPICS.map(({ id, icon: Icon, label, desc }, i) => (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className="text-left p-4 rounded-2xl active:scale-[0.97] transition-transform fade-up"
              style={{
                background: 'white',
                boxShadow: '0 2px 12px rgba(26,51,68,0.06)',
                animationDelay: `${i * 0.06}s`,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: '#EDF8F6' }}
              >
                <Icon size={20} color="#39A89B" />
              </div>
              <div
                className="font-semibold text-sm mb-0.5 leading-snug"
                style={{ color: '#1A3344' }}
              >
                {label}
              </div>
              <div className="text-xs leading-snug" style={{ color: '#7A9BAA' }}>
                {desc}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
