import { BookOpen, Users, Heart, Star, Brain, Shield } from 'lucide-react';

// 첫 진입 후 고르는 "가장 가까운 고민" — 각 항목이 기질 분석 프로필(personality.js) 키가 된다.
export const TOPICS = [
  { id: 'school', icon: BookOpen, label: '학교생활 적응', desc: '새 환경에 적응하기 힘들어해요' },
  { id: 'friends', icon: Users, label: '친구 관계', desc: '친구 사귀기가 어려워 보여요' },
  { id: 'emotion', icon: Heart, label: '감정 표현', desc: '감정을 잘 표현 못 해요' },
  { id: 'confidence', icon: Star, label: '자신감 키우기', desc: '너무 소극적이거나 자책해요' },
  { id: 'learning', icon: Brain, label: '학습 태도', desc: '공부에 집중하기 힘들어해요' },
  { id: 'sibling', icon: Shield, label: '형제 사이', desc: '형제자매와 자주 다퉈요' },
];
