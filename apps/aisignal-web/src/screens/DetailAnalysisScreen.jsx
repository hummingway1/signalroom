import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { PERSONALITY } from '../data/personality.js';

const TABS = [
  { id: 'trait', label: '기질' },
  { id: 'relation', label: '관계' },
  { id: 'emotion', label: '감정' },
  { id: 'advice', label: '조언' },
];

// 상세 분석 — 기질/관계/감정/조언 탭. 탭이 바뀌면 카드가 다시 fade-up 한다.
export function DetailAnalysisScreen({ info, onBack }) {
  const [tab, setTab] = useState('trait');
  const name = info.name || '아이';
  const p = PERSONALITY[info.topic] ?? PERSONALITY.school;

  return (
    <div className="phone-shell" style={{ background: '#F4FAF8' }}>
      <div
        className="flex items-center gap-3 px-5 pt-12 pb-4 flex-shrink-0"
        style={{ background: 'white' }}
      >
        <button onClick={onBack} aria-label="뒤로">
          <ChevronLeft size={22} color="#1A3344" />
        </button>
        <h2 className="font-bold text-lg" style={{ color: '#1A3344' }}>
          상세 분석
        </h2>
        <span
          className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: '#FEF0ED', color: '#F07A6A' }}
        >
          ✨ 무료 체험
        </span>
      </div>

      <div
        className="mx-5 mt-4 mb-3 rounded-2xl p-4 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #39A89B, #2D9088)' }}
      >
        <p className="text-xs font-semibold opacity-70 mb-0.5" style={{ color: 'white' }}>
          {name}이의 기질
        </p>
        <p className="text-lg font-bold" style={{ color: 'white' }}>
          {p.type}
        </p>
      </div>

      <div className="flex px-5 gap-1 mb-3 flex-shrink-0">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: tab === id ? '#39A89B' : 'white',
              color: tab === id ? 'white' : '#7A9BAA',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="space-y-3" key={tab}>
          {p.detail[tab].map(({ title, text }, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 fade-up"
              style={{ background: 'white', animationDelay: `${i * 0.08}s` }}
            >
              <h4 className="font-bold text-sm mb-2" style={{ color: '#1A3344' }}>
                {title}
              </h4>
              <p className="text-sm leading-relaxed" style={{ color: '#5A7A8A' }}>
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
