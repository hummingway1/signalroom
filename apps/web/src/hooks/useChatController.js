// apps/web/src/hooks/useChatController.js
import { useCallback, useRef, useState } from 'react';
import * as api from '../api/client.js';
import { computeTypingDelay, wait } from './useTypingDelay.js';
import { getTimeBasedGreeting } from '../characterAssets.js';
import { MAX_QUICK_REPLIES } from '../config.js';
import { splitIntoBubbles } from '../utils/splitIntoBubbles.js';

// 브라우저의 raw fetch 에러("Failed to fetch", "NetworkError..." 등)를 그대로 화면에 노출하지
// 않는다 — 사용자에게 의미 없는 영어 기술 문구 대신 이해할 수 있는 한국어 안내로 바꾼다.
function toFriendlyErrorMessage(err) {
  const msg = err?.message ?? '';
  if (/fetch|network/i.test(msg)) return '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.';
  return msg || '알 수 없는 오류가 발생했습니다.';
}

let messageIdCounter = 0;
function nextId() {
  messageIdCounter += 1;
  return `m${messageIdCounter}`;
}

/**
 * 채팅 화면 전체를 오케스트레이션하는 훅. 백엔드가 내려주는 데이터(선택지/답변/카드)를 그대로
 * 반영하고, 프론트엔드는 새로운 사주 판단이나 선택지를 만들어내지 않는다 — API 응답을 UI 상태로
 * 옮기는 역할만 한다.
 */
export function useChatController() {
  const [messages, setMessages] = useState([]);
  const [character, setCharacter] = useState(null); // { id, displayName, emoji }
  const [choices, setChoices] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isBooting, setIsBooting] = useState(false);
  const [error, setError] = useState(null);
  const [purchaseRequired, setPurchaseRequired] = useState(null); // §실제 상품 플로우 연결 — { productCode, loginRequired } | null

  const conversationIdRef = useRef(null);
  const chartIdRef = useRef(null);
  const lastCharacterIdRef = useRef(null); // Figma MsgRow kind="marker" — 캐릭터 전환 감지용

  const pushMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: nextId(), timestamp: Date.now(), ...msg }]);
  }, []);

  /** 실제 API 호출을 감싸서 typing indicator + 최소/최대 지연을 적용한다. */
  const runWithTyping = useCallback(async (apiCall) => {
    const start = performance.now();
    setIsTyping(true);
    setError(null);
    try {
      const result = await apiCall();
      const elapsed = performance.now() - start;
      const responseLength = (result.response ?? '').length;
      const delay = computeTypingDelay({ elapsedMs: elapsed, responseLength });
      if (delay > 0) await wait(delay);
      return result;
    } catch (err) {
      setError(toFriendlyErrorMessage(err));
      throw err;
    } finally {
      setIsTyping(false);
    }
  }, []);

  const applyCharacterTurn = useCallback(
    (result) => {
      const newCharId = result.character?.id;
      // 캐릭터가 바뀌었으면(예: 대구 → 맹구) 대화 중간에 구분선 마커를 먼저 끼워 넣는다
      // (Figma "OO가 이어받았어" 연출 그대로).
      if (newCharId && lastCharacterIdRef.current && lastCharacterIdRef.current !== newCharId) {
        pushMessage({ role: 'marker', character: result.character });
      }
      if (newCharId) lastCharacterIdRef.current = newCharId;

      if (result.character) setCharacter(result.character);
      // §17 — API 호출은 이미 끝났다(1회). 응답 텍스트 하나를 여러 bubble로 나눠 순차 표시만 한다.
      const bubbles = splitIntoBubbles(result.response);
      bubbles.forEach((text, idx) => {
        pushMessage({
          role: 'character',
          character: result.character,
          text,
          card: idx === bubbles.length - 1 ? (result.highlight_card ?? null) : null, // 카드는 마지막 bubble에만
        });
      });
      if (Array.isArray(result.nextChoices)) setChoices(result.nextChoices.slice(0, MAX_QUICK_REPLIES));
      setPurchaseRequired(result.purchaseRequired ?? null);
    },
    [pushMessage]
  );

  /** 생년월일시 입력 → 차트 생성 → 대화 시작 → 첫 선택지 로드. */
  const start = useCallback(
    async (birthData) => {
      setIsBooting(true);
      setError(null);
      setPurchaseRequired(null);
      try {
        const chart = await api.createChart(birthData);
        chartIdRef.current = chart.id;

        // conversation 레코드를 만들기 위한 가벼운 첫 호출 — 화면에는 노출하지 않는다.
        const first = await api.startFirstQuestion(chart.id, '안녕');
        conversationIdRef.current = first.conversationId;

        const opening = await api.getOpeningChoices(first.conversationId);
        setCharacter(opening.character);
        lastCharacterIdRef.current = opening.character?.id ?? null;
        setChoices(opening.choices.slice(0, MAX_QUICK_REPLIES));

        pushMessage({ role: 'character', character: opening.character, text: getTimeBasedGreeting(opening.character.id), card: null });
      } catch (err) {
        setError(toFriendlyErrorMessage(err));
      } finally {
        setIsBooting(false);
      }
    },
    [pushMessage]
  );

  /** 이미 만들어진 conversation(예: 신년운세 CHAT 진입)을 이어받아 기존 채팅 UI를 그대로 쓴다.
   * start()와 달리 chart/conversation을 새로 만들지 않는다 — chart 생성 단계만 생략. */
  const resumeConversation = useCallback(
    async (conversationId, chartId) => {
      setIsBooting(true);
      setError(null);
      try {
        chartIdRef.current = chartId;
        conversationIdRef.current = conversationId;
        const opening = await api.getOpeningChoices(conversationId);
        setCharacter(opening.character);
        lastCharacterIdRef.current = opening.character?.id ?? null;
        setChoices(opening.choices.slice(0, MAX_QUICK_REPLIES));
        pushMessage({ role: 'character', character: opening.character, text: getTimeBasedGreeting(opening.character.id), card: null });
      } catch (err) {
        setError(toFriendlyErrorMessage(err));
      } finally {
        setIsBooting(false);
      }
    },
    [pushMessage]
  );

  /** 사용자가 선택지(quick reply)를 골랐을 때. */
  const pickChoice = useCallback(
    async (choice) => {
      pushMessage({ role: 'user', text: choice.displayText });
      setChoices([]);
      try {
        const result = await runWithTyping(() => api.pickCatalogChoice(conversationIdRef.current, choice.id));
        applyCharacterTurn(result);
      } catch {
        // 에러는 이미 상태에 반영됨
      }
    },
    [pushMessage, runWithTyping, applyCharacterTurn]
  );

  /** 사용자가 직접 텍스트를 입력했을 때 (§13: 선택형과 동일한 스트림). */
  const sendFreeText = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      pushMessage({ role: 'user', text: trimmed });
      setChoices([]);
      try {
        const result = await runWithTyping(() => api.sendMessage(conversationIdRef.current, trimmed));
        applyCharacterTurn(result);
      } catch {
        // no-op
      }
    },
    [pushMessage, runWithTyping, applyCharacterTurn]
  );

  const retryLast = useCallback(() => setError(null), []);
  const dismissPurchaseRequired = useCallback(() => setPurchaseRequired(null), []);

  return { messages, character, choices, isTyping, isBooting, error, purchaseRequired, start, resumeConversation, pickChoice, sendFreeText, retryLast, dismissPurchaseRequired };
}
