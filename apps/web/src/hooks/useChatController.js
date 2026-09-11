// apps/web/src/hooks/useChatController.js
import { useCallback, useRef, useState } from 'react';
import * as api from '../api/client.js';
import { computeTypingDelay, wait } from './useTypingDelay.js';
import { getTimeBasedGreeting } from '../characterAssets.js';
import { getServiceCatalogEntry } from '../serviceCatalog.js';
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
  const [serviceId, setServiceId] = useState(null); // §SERVICE_CATALOG 도입 — 이전엔 이 값 자체가 존재하지 않아서 ChatHeader가 서비스명을 표시할 방법이 없었다.

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
    async (birthData, newServiceId = null) => {
      setIsBooting(true);
      setError(null);
      setPurchaseRequired(null);
      setServiceId(newServiceId);
      try {
        const chart = await api.createChart(birthData);
        chartIdRef.current = chart.id;

        // conversation 레코드를 만들기 위한 가벼운 첫 호출 — 화면에는 노출하지 않는다.
        const first = await api.startFirstQuestion(chart.id, '안녕');
        conversationIdRef.current = first.conversationId;

        const opening = await api.getOpeningChoices(first.conversationId);
        setCharacter(opening.character);
        lastCharacterIdRef.current = opening.character?.id ?? null;

        // §서비스별 quickReply 분리(실측 버그 수정) — 이전엔 어떤 서비스로 들어와도 항상
        // 성인 통합 QUESTION_CATALOG의 오프닝 선택지("어? 내가 그래?" 등)가 그대로
        // 나왔고, 채팅 첫 메시지도 서비스와 무관한 시간대 인사말(getTimeBasedGreeting)
        // 이었다. WelcomeScreen이 이미 서비스를 정확히 소개했으므로, 여기서는 그
        // 흐름을 자연스럽게 이어받는 짧은 연결 문구 + 서비스 전용 quickReply만 쓴다.
        const catalogEntry = getServiceCatalogEntry(newServiceId);
        if (catalogEntry && catalogEntry.quickReplies.length > 0) {
          setChoices(catalogEntry.quickReplies.map((qr, i) => ({ id: `catalog-${newServiceId}-${i}`, displayText: qr.label, free: true, action: qr.action })));
          pushMessage({ role: 'character', character: opening.character, text: '좋아, 그럼 뭐부터 볼까?', card: null });
        } else {
          setChoices(opening.choices.slice(0, MAX_QUICK_REPLIES));
          pushMessage({ role: 'character', character: opening.character, text: getTimeBasedGreeting(opening.character.id), card: null });
        }
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
      // §서비스 진입 단계 quickReply(action 있음) — AI/백엔드 호출 없이 결정적으로 처리
      // (§6 원칙: 상품 탐색 단계는 가능한 AI 호출 없음). 실제 클릭 가능한 상품 카드+구매
      // 버튼은 아직 없음(Priority 5에서 추가 예정) — 지금은 가격 텍스트만 안내.
      if (choice.action) {
        const catalogEntry = getServiceCatalogEntry(serviceId);
        if (choice.action === 'describe') {
          pushMessage({ role: 'character', character, text: catalogEntry.description, card: null });
        } else {
          // 'start' / 'products' — 실제 상품 가격을 API로 조회해서 텍스트로 안내.
          try {
            const { products } = await api.listProducts();
            const matched = catalogEntry.productCodes.map((code) => products?.find((p) => p.code === code)).filter(Boolean);
            const priceLines = matched.map((p) => `${p.name} ${p.price.toLocaleString()}원`).join(' / ');
            pushMessage({ role: 'character', character, text: priceLines ? `좋아, 어떻게 봐줄까?\n${priceLines}\n\n☰ 메뉴의 "서비스 보기"에서 바로 시작할 수 있어.` : '가격 정보를 불러오지 못했어.', card: null });
          } catch {
            pushMessage({ role: 'character', character, text: '가격 정보를 불러오지 못했어.', card: null });
          }
        }
        return;
      }
      try {
        const result = await runWithTyping(() => api.pickCatalogChoice(conversationIdRef.current, choice.id));
        applyCharacterTurn(result);
      } catch {
        // 에러는 이미 상태에 반영됨
      }
    },
    [pushMessage, runWithTyping, applyCharacterTurn, character, serviceId]
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

  // §Critical Flow — 로그인/회원가입 성공 직후 App.jsx가 호출한다. conversation은 그대로
  // 유지(새로 만들지 않음), 대구가 서버 state(chart 존재 여부)를 기준으로 먼저 말을 건다.
  const resumeAfterAuth = useCallback(
    async (userId) => {
      if (!conversationIdRef.current) return;
      try {
        const result = await runWithTyping(() => api.resumeAfterAuth(conversationIdRef.current, userId));
        applyCharacterTurn(result);
      } catch {
        // no-op — 최소한 화면은 그대로 유지되고, 사용자가 다시 시도할 수 있음
      }
    },
    [runWithTyping, applyCharacterTurn]
  );

  const confirmBirth = useCallback(
    async (userId, chartId, confirmed) => {
      try {
        const result = await runWithTyping(() => api.confirmBirth(conversationIdRef.current, userId, chartId, confirmed));
        applyCharacterTurn(result);
      } catch {
        // no-op
      }
    },
    [runWithTyping, applyCharacterTurn]
  );

  const claimFreeTrialAction = useCallback(
    async (userId) => {
      try {
        const result = await runWithTyping(() => api.claimFreeTrial(conversationIdRef.current, userId));
        applyCharacterTurn(result);
      } catch {
        // no-op
      }
    },
    [runWithTyping, applyCharacterTurn]
  );

  return { messages, character, choices, isTyping, isBooting, error, purchaseRequired, serviceId, start, resumeConversation, pickChoice, sendFreeText, retryLast, dismissPurchaseRequired, resumeAfterAuth, confirmBirth, claimFreeTrialAction };
}
