// apps/web/src/hooks/useChildCoachController.js
//
// §6 — 자녀 성장 코치를 실제 child_profile_id / PurchasedAnalysis / AIProfileContext / target-
// intent-depth 엔진 파이프라인에 연결한다. 기존 useChildChatController(카탈로그 선택형, 자유 텍스트
// 없음)와 달리 자유 텍스트 캐주얼 대화를 실제로 지원한다.
//
// 흐름: intake(아이 정보 입력) → casual(자유 텍스트 대화, 고민 자연스럽게 수집) →
//       choice(기본/전체 사주 선택 상시 노출) → 선택 시 분석 실행 → 계속 코칭 대화 가능(§14).
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api/client.js';
import { computeTypingDelay, wait } from './useTypingDelay.js';
import { getOrCreateUserId, isLoggedIn } from '../utils/anonUser.js';
import { splitIntoBubbles } from '../utils/splitIntoBubbles.js';

let messageIdCounter = 0;
function nextId() {
  messageIdCounter += 1;
  return `cc-m${messageIdCounter}`;
}

export function useChildCoachController() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isBooting, setIsBooting] = useState(false);
  const [error, setError] = useState(null);
  const [freeTierExhausted, setFreeTierExhausted] = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]); // §1 — 지금 대화에서 자연스럽게 이어지는 질문(최대 3개)

  const conversationIdRef = useRef(null);
  const userIdRef = useRef(null);
  const childProfileIdRef = useRef(null);
  const messagesRef = useRef([]); // sendMessage 콜백 안에서 최신 turn 수를 세기 위한 참조

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const pushMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: nextId(), timestamp: Date.now(), character: msg.role === 'character' ? { id: 'daegu' } : undefined, ...msg }]);
  }, []);

  const pushCharacterText = useCallback(
    (text) => {
      // §17 — API 호출은 이미 끝났다. 긴 응답만 여러 bubble로 나눠 순차 표시.
      splitIntoBubbles(text).forEach((t) => pushMessage({ role: 'character', text: t }));
    },
    [pushMessage]
  );

  /** 아이 정보 입력 → chart 생성 → child profile 생성 → conversation 시작 → 캐주얼 대화 첫 문장. */
  const start = useCallback(
    async (childBirthData) => {
      setIsBooting(true);
      setError(null);
      try {
        const userId = getOrCreateUserId();
        userIdRef.current = userId;

        const chart = await api.createChart(childBirthData);
        const profile = await api.createChildProfile({ userId, chartId: chart.id, name: childBirthData.name || null });
        childProfileIdRef.current = profile.id;

        const first = await api.startFirstQuestion(chart.id, '안녕', 'daegu', profile.id);
        conversationIdRef.current = first.conversationId;

        // §5 — 고정 인사 대신 부모가 편하게 이야기할 수 있는 자연스러운 질문으로 시작한다.
        pushCharacterText('요즘 아이를 보면서 신경 쓰이는 일이 있나요. 편하게 이야기해 주세요. 작은 고민도 괜찮아요.');
      } catch (err) {
        setError(err.message ?? '시작하지 못했습니다.');
      } finally {
        setIsBooting(false);
      }
    },
    [pushCharacterText]
  );

  /** 로그인 사용자의 기존 자녀 프로필을 재사용해서 이어서 대화한다 — 전체 사주를 이미 봤다면
   * hasAnalysis/freeTierExhausted를 실제 이력대로 복원해서 "결제했는지 기억 못하는" 문제를 해결. */
  const resumeExisting = useCallback(
    async (existingProfile) => {
      setIsBooting(true);
      setError(null);
      try {
        const userId = getOrCreateUserId();
        userIdRef.current = userId;
        childProfileIdRef.current = existingProfile.id;
        setHasAnalysis(existingProfile.hasFullAnalysis || existingProfile.hasBasicAnalysis);
        setFreeTierExhausted(existingProfile.hasBasicAnalysis); // 무료 1회를 이미 썼다면 다시 버튼에 안 뜨게

        const first = await api.startFirstQuestion(existingProfile.chart_id, '안녕', 'daegu', existingProfile.id);
        conversationIdRef.current = first.conversationId;

        // §10/§15 — "지난번에 본 내용 기억하고 있어요" 같은 감시 느낌 표현은 절대 쓰지 않는다.
        // 구매 이력 상태(hasAnalysis/freeTierExhausted)는 내부적으로 복원하되, 인사 문구는 이력
        // 유무와 무관하게 항상 동일한 중립적 문구를 쓴다.
        pushCharacterText('다시 오셨네요. 오늘은 어떤 이야기를 해볼까요.');
      } catch (err) {
        setError(err.message ?? '시작하지 못했습니다.');
      } finally {
        setIsBooting(false);
      }
    },
    [pushCharacterText]
  );

  /** 로그인 사용자라면 이미 등록된 자녀 프로필이 있는지 먼저 확인한다(없으면 null 반환 — 화면이
   * 새 아이 등록 폼을 보여줘야 함을 뜻함). */
  const checkExistingProfile = useCallback(async () => {
    if (!isLoggedIn()) return null;
    const userId = getOrCreateUserId();
    try {
      const { profiles } = await api.listChildProfiles(userId);
      return profiles.length > 0 ? profiles[0] : null; // 다자녀 지원은 이번 범위 밖 — 첫 번째 재사용
    } catch {
      return null;
    }
  }, []);

  /** 자유 텍스트 캐주얼 대화 — 고민/궁금한 점을 자연스럽게 이어간다. */
  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      pushMessage({ role: 'user', text: trimmed });
      setSuggestedQuestions([]); // 새 메시지를 보내면 이전 추천은 즉시 치운다(낡은 추천 노출 방지)
      const userTurnCountBefore = messagesRef.current.filter((m) => m.role === 'user').length;
      const startedAt = performance.now();
      setIsTyping(true);
      setError(null);
      try {
        const result = await api.sendMessage(conversationIdRef.current, trimmed);
        const elapsed = performance.now() - startedAt;
        const delay = computeTypingDelay({ elapsedMs: elapsed, responseLength: (result.response ?? '').length });
        if (delay > 0) await wait(delay);
        pushCharacterText(result.response);
        setSuggestedQuestions(result.suggestedQuestions ?? []);
        // §3 — 후킹 대화가 2턴에 도달하는 순간, 버튼을 그냥 띄우지 않고 먼저 자연스럽게 제안한다.
        if (userTurnCountBefore + 1 === 2) {
          pushCharacterText('그럼 이 이야기를 아이 사주랑 한번 같이 봐볼까요.');
        }
      } catch (err) {
        setError(err.message ?? '오류가 발생했습니다.');
      } finally {
        setIsTyping(false);
      }
    },
    [pushMessage, pushCharacterText]
  );

  /** 기본(무료 1회) 또는 전체(유료) 사주 분석을 실제로 실행한다. */
  const requestAnalysis = useCallback(
    async (tier) => {
      setIsTyping(true);
      setError(null);
      setFreeTierExhausted(false);
      try {
        const result = await api.generateChildAnalysis(childProfileIdRef.current, userIdRef.current, tier);
        // §2(가독성) — summary가 이제 {title, body}[] 섹션 배열이다. 섹션마다 별도 bubble로
        // 보여줘서 카테고리가 구분되게 표시한다.
        for (const section of result.summary ?? []) {
          pushMessage({ role: 'character', text: section.body, sectionTitle: section.title });
        }
        setHasAnalysis(true);
        if (tier === 'full') {
          // §13 — 전체 사주 완료 후 자연스러운 구독 안내(강제 유도 아님).
          pushCharacterText('더 자세한 분석을 바탕으로 앞으로 실제 상황에서도 계속 같이 이야기 나눌 수 있어요. 궁금한 게 생기면 언제든 물어보세요.');
        }
      } catch (err) {
        if (err.code === 'FREE_TIER_EXHAUSTED') {
          setFreeTierExhausted(true);
          pushCharacterText('무료 기본 사주는 이미 한 번 봤어요. 더 자세히 보려면 전체 사주를 선택해주세요.');
        } else {
          setError(err.message ?? '분석을 진행하지 못했습니다.');
        }
      } finally {
        setIsTyping(false);
      }
    },
    [pushMessage, pushCharacterText]
  );

  return { messages, isTyping, isBooting, error, freeTierExhausted, hasAnalysis, suggestedQuestions, start, resumeExisting, checkExistingProfile, sendMessage, requestAnalysis };
}
