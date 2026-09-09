// apps/web/src/hooks/useChildChatController.js
//
// 자녀 사주 전용 컨트롤러. useChatController와 거의 같은 구조지만 항상 'scholar' 캐릭터를 쓰고
// 자녀 전용 카탈로그(child-opening-choices/child-catalog-choice)만 사용한다 — 성인용 대구/맹구
// 대화 로직과 완전히 분리해서 기존 흐름에 영향이 없게 했다. 자유 입력은 이번 범위에서 지원하지
// 않는다(4개 하위 카테고리 선택형에 집중).
import { useCallback, useRef, useState } from 'react';
import * as api from '../api/client.js';
import { computeTypingDelay, wait } from './useTypingDelay.js';

let messageIdCounter = 0;
function nextId() {
  messageIdCounter += 1;
  return `child-m${messageIdCounter}`;
}

export function useChildChatController() {
  const [messages, setMessages] = useState([]);
  const [choices, setChoices] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isBooting, setIsBooting] = useState(false);
  const [error, setError] = useState(null);

  const conversationIdRef = useRef(null);

  const pushMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: nextId(), timestamp: Date.now(), ...msg }]);
  }, []);

  const start = useCallback(
    async (childBirthData) => {
      setIsBooting(true);
      setError(null);
      try {
        const chart = await api.createChart(childBirthData);
        const first = await api.startFirstQuestion(chart.id, '안녕', 'scholar');
        conversationIdRef.current = first.conversationId;

        const opening = await api.getChildOpeningChoices(first.conversationId);
        setChoices(opening.choices);
        pushMessage({ role: 'character', character: opening.character, text: '아이 이야기 편하게 들려주세요. 어떤 게 궁금하세요?', card: null });
      } catch (err) {
        setError(err.message ?? '시작하지 못했습니다.');
      } finally {
        setIsBooting(false);
      }
    },
    [pushMessage]
  );

  const pickChoice = useCallback(
    async (choice) => {
      pushMessage({ role: 'user', text: choice.displayText });
      setChoices([]);
      const start_ = performance.now();
      setIsTyping(true);
      setError(null);
      try {
        const result = await api.pickChildCatalogChoice(conversationIdRef.current, choice.id);
        const elapsed = performance.now() - start_;
        const delay = computeTypingDelay({ elapsedMs: elapsed, responseLength: (result.response ?? '').length });
        if (delay > 0) await wait(delay);
        pushMessage({ role: 'character', character: result.character, text: result.response, card: result.highlight_card ?? null });
        setChoices(result.nextChoices ?? []);
      } catch (err) {
        setError(err.message ?? '오류가 발생했습니다.');
      } finally {
        setIsTyping(false);
      }
    },
    [pushMessage]
  );

  return { messages, choices, isTyping, isBooting, error, start, pickChoice };
}
