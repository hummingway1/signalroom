// apps/web/src/App.jsx
//
// 화면 흐름: welcome → birth → chat  (+ chat에서 더보기 메뉴로 fun/battle/ranking/compatibility/
// child 진입). 실제 대화 내용(캐릭터 응답/선택지)은 전부 useChatController가 실제 백엔드에서
// 받아온다 — Figma의 STEPS 하드코딩 스크립트는 데모용이라 가져오지 않았다(기존 실제 기능 유지).
//
// 랭킹(리더보드) 진입 시 닉네임 계정이 없으면 NicknameSignup을 먼저 보여준다 — 처음부터 강제
// 가입시키지 않고, 실제로 필요한 시점(§결제 직전 UX처럼 자연스럽게)에만 요청한다.
import { useEffect, useState } from 'react';
import { useChatController } from './hooks/useChatController.js';
import { HomeScreen } from './components/HomeScreen.jsx';
import { SignalRoomHome } from './components/SignalRoomHome.jsx';
import { ServiceIntroScreen } from './components/ServiceIntroScreen.jsx';
import { AnalysisChoiceScreen } from './components/AnalysisChoiceScreen.jsx';
import { getAnalysisRecommendation } from './analysisRecommendation.js';
import { WelcomeScreen } from './components/WelcomeScreen.jsx';
import { BirthDataForm } from './components/BirthDataForm.jsx';
import { ChatScreen } from './components/ChatScreen.jsx';
import { RevealScreen } from './components/RevealScreen.jsx';
import { FunContentScreen } from './components/FunContentScreen.jsx';
import { SajuBattleScreen } from './components/SajuBattleScreen.jsx';
import { MoreMenu } from './components/MoreMenu.jsx';
import { NicknameSignup } from './components/NicknameSignup.jsx';
import { NicknameChooser } from './components/NicknameChooser.jsx';
import { MyPage } from './components/MyPage.jsx';
import { MembershipScreen } from './components/MembershipScreen.jsx';
import { LegalScreen } from './components/LegalScreen.jsx';
import { BirthSelectionScreen } from './components/BirthSelectionScreen.jsx';
import { BirthSelectionResult } from './components/BirthSelectionResult.jsx';
import { ProductsScreen } from './components/ProductsScreen.jsx';
import { PaymentResultScreen } from './components/PaymentResultScreen.jsx';
import { LeaderboardScreen } from './components/LeaderboardScreen.jsx';
import { CompatibilityScreen } from './components/CompatibilityScreen.jsx';
import { ChildSajuScreen } from './components/ChildSajuScreen.jsx';
import { YearlyFortuneScreen } from './components/YearlyFortuneScreen.jsx';
import * as api from './api/client.js';
import { isLoggedIn } from './utils/anonUser.js';
import './styles/app.css';

const USER_ID_STORAGE_KEY = 'saju_nickname_user_id';
const NICKNAME_STORAGE_KEY = 'saju_nickname';

export default function App() {
  const chat = useChatController();
  const [screen, setScreen] = useState('signalRoom'); // §1차 구현 — SIGNAL ROOM이 새 최초 화면. 기존 'home'(teal 홈)은 삭제하지 않고 그대로 남겨둠(다른 진입 경로에서 계속 재사용 가능).
  // §2단계 — mypage/products/signup 등 여러 기존 흐름이 여전히 teal 'home'으로 돌아가므로,
  // pendingService 값만으로는 "SIGNAL ROOM에서 왔는지 teal 홈에서 왔는지" 구분이 안 된다.
  // 이 최소 state 하나로 정확히 추적한다(새 라우팅 구조 아님 — 기존 screen/pendingService
  // 패턴에 필드 하나 추가).
  const [homeOrigin, setHomeOrigin] = useState('signalRoom');
  const [pendingService, setPendingService] = useState(null); // intro 화면에서 고른 서비스
  const [pendingBirthData, setPendingBirthData] = useState(null); // §ANALYSIS_ROUTER — 추천 선택 화면에서 최종 확정 전까지 보관
  const [pendingRecommendation, setPendingRecommendation] = useState(null);
  const [revealDest, setRevealDest] = useState(null); // null | 'fun' | 'battle'
  const [showMenu, setShowMenu] = useState(false);
  const [chartId, setChartId] = useState(null);
  const [userId, setUserId] = useState(() => localStorage.getItem(USER_ID_STORAGE_KEY));
  const [nickname, setNickname] = useState(() => localStorage.getItem(NICKNAME_STORAGE_KEY));
  const [nicknameError, setNicknameError] = useState(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [pendingAfterSignup, setPendingAfterSignup] = useState(null); // 가입 완료 후 이동할 화면
  const [pendingProductCode, setPendingProductCode] = useState(null); // §Priority5 — 로그인/가입 전에 채팅에서 고른 상품을 보존
  const [showNicknameChooser, setShowNicknameChooser] = useState(false); // 신규 OAuth 가입 직후에만 true
  const [nicknameChooserError, setNicknameChooserError] = useState(null);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [paymentRedirect, setPaymentRedirect] = useState(null); // { status: 'success'|'fail', params } | null
  const [birthSelectionScopeId, setBirthSelectionScopeId] = useState(null);
  const [legalDocType, setLegalDocType] = useState('terms');

  useEffect(() => {
    // §6(익명 데이터 승계 정책) — 카카오 로그인 콜백이 성공하면 서버가 이미 익명 데이터를 실제
    // 계정으로 옮겨뒀다(auth-service.mjs linkAnonymousData). 여기서는 그 옛 익명ID를 브라우저에서
    // 지워서, 같은 브라우저가 이 ID를 다시 들고 "또 다른 무료 체험"을 시도할 수 없게 한다.
    const params = new URLSearchParams(window.location.search);
    const justLoggedIn = params.get('login') === 'success';
    const isNewSignup = params.get('new') === '1';

    // Toss 결제 리다이렉트 감지 — successUrl/failUrl로 돌아오면서 orderId/paymentKey/amount(성공
    // 시) 또는 code/message(실패 시)를 쿼리에 붙여준다. 여기서는 파라미터만 읽고, 실제 결제
    // 완료 여부 판단은 PaymentResultScreen이 서버 confirm 호출로만 한다(리다이렉트 자체를 증거로
    // 삼지 않음).
    const paymentStatus = params.get('payment');
    if (paymentStatus === 'success' || paymentStatus === 'fail') {
      setPaymentRedirect({
        status: paymentStatus,
        params: { orderId: params.get('orderId'), paymentKey: params.get('paymentKey'), amount: params.get('amount') },
      });
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (justLoggedIn) {
      localStorage.removeItem('saju_anon_user_id');
      window.history.replaceState({}, '', window.location.pathname);
    }

    // 세션 쿠키(sid)가 있으면 실제 로그인 사용자 정보로 nickname/userId를 채운다. OAuth 로그인
    // 직후뿐 아니라, 페이지를 새로고침했을 때도 세션이 남아있으면 로그인 상태가 유지되도록 앱이
    // 시작될 때마다 항상 확인한다.
    api.getCurrentUser().then(({ user }) => {
      if (user) {
        setUserId(user.id);
        setNickname(user.nickname);
        localStorage.setItem(USER_ID_STORAGE_KEY, user.id);
        localStorage.setItem(NICKNAME_STORAGE_KEY, user.nickname);
        // 신규 OAuth 가입일 때만 닉네임을 직접 정할 기회를 준다(재로그인 시엔 안 나옴) —
        // 그동안은 카카오/네이버/구글 기본 닉네임이 그대로 서비스 닉네임이 돼버렸다.
        if (isNewSignup) setShowNicknameChooser(true);
      }
    }).catch(() => {
      // 세션 조회 실패해도 비로그인 상태로 조용히 진행 — 기존 닉네임 가입 흐름과 공존해야 함
    });
  }, []);

  async function handleNicknameChooserSubmit(newNickname) {
    setIsSavingNickname(true);
    setNicknameChooserError(null);
    try {
      const { user } = await api.updateNickname(newNickname);
      setNickname(user.nickname);
      localStorage.setItem(NICKNAME_STORAGE_KEY, user.nickname);
      setShowNicknameChooser(false);
    } catch (err) {
      setNicknameChooserError(err.message ?? '닉네임 저장에 실패했어요.');
    } finally {
      setIsSavingNickname(false);
    }
  }

  async function proceedToChat(birthData, finalServiceId) {
    await chat.start(birthData, finalServiceId);
    // 리더보드/궁합/사주대결 기능에 쓸 chartId를 별도로 확보 — chat.start 내부에서 생성된 chart를
    // 재사용하기 위해 여기서 한 번 더 생성하지 않고, useChatController가 chartIdRef로 갖고 있는
    // 값을 못 꺼내오는 구조라 편의상 이 화면에서 한 번 더 생성한다(계산 비용만 있고 AI 호출은 없음).
    try {
      const chart = await api.createChart(birthData);
      setChartId(chart.id);
    } catch {
      // 채팅 자체는 이미 시작됐으니 실패해도 채팅 진행에는 지장 없음 — 랭킹/궁합만 못 씀
    }
    setScreen('chat');
  }

  async function handleBirthSubmit(birthData) {
    if (pendingService === 'yearlyFortuneAfterBirth') {
      // 신년운세 진입은 일반 사주 채팅이 필요 없다 — chart만 만들고 원래 화면으로 돌아간다.
      try {
        const chart = await api.createChart(birthData);
        setChartId(chart.id);
      } catch (err) {
        console.error('[yearly-fortune birth] chart 생성 실패', err.message);
      }
      setScreen('yearlyFortune');
      return;
    }

    if (pendingService === 'birthEditFromChat') {
      // §Critical Flow §6 — [아니, 수정할게] → 폼 수정 완료. 다시 확인 질문을 던지지 않고
      // 새 chart로 곧바로 다음 단계(entitlement/campaign 판정)로 이어간다.
      setScreen('chat');
      try {
        const chart = await api.createChart(birthData);
        setChartId(chart.id);
        await chat.confirmBirth(userId, chart.id, true);
      } catch (err) {
        console.error('[birth-edit] chart 생성 실패', err.message);
      }
      return;
    }

    // §ANALYSIS_ROUTER — saju/jami 진입에서만 추천 판단(다른 서비스는 이 판단과 무관).
    // "추천 후 사용자 선택" 확정 UX — 여기서 절대 자동으로 서비스를 바꾸지 않는다.
    if (pendingService === 'saju' || pendingService === 'jami') {
      const recommendation = getAnalysisRecommendation({ requestedServiceId: pendingService, timeKnown: birthData.timeKnown });
      if (recommendation.requiresUserChoice) {
        setPendingBirthData(birthData);
        setPendingRecommendation(recommendation);
        setScreen('analysisChoice');
        return;
      }
    }

    await proceedToChat(birthData, pendingService);
  }

  async function handleAnalysisChoice(finalServiceId) {
    setPendingService(finalServiceId);
    const birthData = pendingBirthData;
    setPendingBirthData(null);
    setPendingRecommendation(null);
    await proceedToChat(birthData, finalServiceId);
  }

  function handleOpenDetail(message) {
    console.info('[detail] would open detail view for', message.id);
  }

  // §3/§5 — Home에서 서비스를 고르면 곧바로 입력으로 가지 않고 먼저 소개 화면을 보여준다.
  async function handleOpenYearlyFortuneChat(analysisScopeId, targetChartId) {
    try {
      const { conversationId } = await api.startYearlyFortuneChat(analysisScopeId);
      await chat.resumeConversation(conversationId, targetChartId);
      setScreen('chat');
    } catch (err) {
      console.error('[yearly-fortune chat] 시작 실패', err.message);
    }
  }

  async function handleOpenBirthSelectionChat() {
    try {
      const { conversationId } = await api.startBirthSelectionChat(birthSelectionScopeId);
      await chat.resumeConversation(conversationId, null); // §DATE_SELECTION은 단일 chart_id가 없음(chartIdRef는 실제 API 호출에 쓰이지 않음, 확인됨)
      setScreen('chat');
    } catch (err) {
      console.error('[birth-selection chat] 시작 실패', err.message);
    }
  }

  function handleHomeSelect(serviceKey, origin = 'signalRoom') {
    setHomeOrigin(origin);
    setPendingService(serviceKey);
    setScreen('intro');
  }

  function handleIntroNext(destOverride) {
    if (pendingService === 'saju' || pendingService === 'jami') {
      setScreen('welcome');
    } else if (pendingService === 'isignal') {
      setScreen('child');
    } else if (pendingService === 'gunghap') {
      // §13 — 궁합/사주대결 둘 다 "내 정보 확인 또는 입력"이 먼저다. chartId가 아직 없으면 내 정보부터.
      setPendingService(destOverride); // birth 화면에서 목적지 판단에 쓰임(battle/compatibility)
      setScreen(chartId ? destOverride : 'birth');
    }
  }

  function handleMenuSelect(key) {
    setShowMenu(false);
    if (key === 'fun' || key === 'battle') {
      setRevealDest(key);
    } else if (key === 'ranking') {
      if (!userId) {
        setPendingAfterSignup('ranking');
        setScreen('signup');
      } else {
        setScreen('ranking');
      }
    } else if (key === 'compatibility') {
      setScreen('compatibility');
    } else if (key === 'child') {
      setScreen('child');
    } else if (key === 'yearlyFortune') {
      if (!userId) {
        setPendingAfterSignup('yearlyFortune');
        setScreen('signup');
      } else {
        setScreen('yearlyFortune');
      }
    }
  }

  async function handleNicknameSubmit(nickname) {
    setIsSigningUp(true);
    setNicknameError(null);
    try {
      const user = await api.signUpWithNickname(nickname);
      localStorage.setItem(USER_ID_STORAGE_KEY, user.id);
      localStorage.setItem(NICKNAME_STORAGE_KEY, user.nickname);
      setUserId(user.id);
      setNickname(user.nickname);
      const dest = pendingAfterSignup ?? 'home';
      setScreen(dest);
      setPendingAfterSignup(null);
      if (dest === 'chat') await chat.resumeAfterAuth(user.id);
    } catch (err) {
      setNicknameError(err.message ?? '가입에 실패했어요.');
    } finally {
      setIsSigningUp(false);
    }
  }

  async function handleEmailAuthSuccess(user, isNewUser) {
    localStorage.removeItem('saju_anon_user_id');
    localStorage.setItem(USER_ID_STORAGE_KEY, user.id);
    localStorage.setItem(NICKNAME_STORAGE_KEY, user.nickname);
    setUserId(user.id);
    setNickname(user.nickname);
    const dest = pendingAfterSignup ?? 'home';
    setScreen(dest);
    setPendingAfterSignup(null);
    if (dest === 'chat') await chat.resumeAfterAuth(user.id);
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // 서버 로그아웃 실패해도 프론트 상태는 정리한다
    }
    setUserId(null);
    setNickname(null);
    localStorage.removeItem(USER_ID_STORAGE_KEY);
    localStorage.removeItem(NICKNAME_STORAGE_KEY);
    setScreen('home');
  }

  function handleRevealComplete() {
    setScreen(revealDest);
    setRevealDest(null);
  }

  // Toss 결제 리다이렉트 직후엔 다른 화면보다 결제 결과 확인을 최우선으로 보여준다.
  if (paymentRedirect) {
    return (
      <div className="app-outer">
        <div className="phone-shell">
          <PaymentResultScreen
            status={paymentRedirect.status}
            params={paymentRedirect.params}
            onDone={(confirmResult) => {
              setPaymentRedirect(null);
              if (confirmResult?.analysisScopeId && pendingService === 'taegil') {
                setBirthSelectionScopeId(confirmResult.analysisScopeId);
                setScreen('birthSelectionResult');
              } else {
                setScreen('home');
              }
            }}
          />
        </div>
      </div>
    );
  }

  // 신규 OAuth 가입 직후엔 다른 화면보다 닉네임 선택을 최우선으로 보여준다.
  if (showNicknameChooser) {
    return (
      <div className="app-outer">
        <div className="phone-shell">
          <NicknameChooser currentNickname={nickname} onSubmit={handleNicknameChooserSubmit} isSubmitting={isSavingNickname} error={nicknameChooserError} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-outer">
      <div className="phone-shell">
        {screen === 'signalRoom' && (
          <SignalRoomHome
            onOpenMyPage={() => { setHomeOrigin('signalRoom'); setScreen('mypage'); }}
            onService={(id) => {
              // §SERVICE_CATALOG 도입 — 더 이상 jami를 saju로, gunghap을 relationship으로
              // 뭉개는 매핑을 하지 않는다. serviceId(catalog id) 그대로 pendingService에
              // 저장해서 이후 전체 화면 체인(intro/welcome/chat)에서 유지되게 한다.
              if (id === 'taegil') {
                setHomeOrigin('signalRoom');
                setPendingService('taegil');
                setScreen('birthSelection');
              } else if (id === 'jakmeong') {
                // 작명(naming) — SERVICE_CATALOG.status='comingSoon', 아직 실제 서비스 없음.
                setPendingService(id);
                setScreen('comingSoon');
              } else if (id === 'yearlyFortune') {
                setHomeOrigin('signalRoom');
                if (!userId) {
                  setPendingAfterSignup('yearlyFortune');
                  setScreen('signup');
                } else {
                  setScreen('yearlyFortune');
                }
              } else {
                // saju / jami / gunghap / isignal — 각자의 identity를 그대로 유지.
                handleHomeSelect(id);
              }
            }}
          />
        )}
        {screen === 'birthSelection' && (
          <BirthSelectionScreen onBack={() => setScreen(homeOrigin)} onHome={() => setScreen(homeOrigin)} />
        )}
        {screen === 'birthSelectionResult' && (
          <BirthSelectionResult
            analysisScopeId={birthSelectionScopeId}
            onOpenChat={handleOpenBirthSelectionChat}
            header={
              <div className="subscreen__header">
                <button onClick={() => setScreen(homeOrigin)} className="chat-header__back" aria-label="뒤로가기">‹</button>
                <div><p className="subscreen__header-title">출생일 택일 결과</p></div>
                <button className="subscreen__header-home" onClick={() => setScreen(homeOrigin)} aria-label="홈으로">⌂</button>
              </div>
            }
          />
        )}
        {screen === 'membership' && (
          <MembershipScreen
            userId={userId}
            onBack={() => setScreen(homeOrigin)}
            onHome={() => setScreen(homeOrigin)}
            onLogin={() => { setPendingAfterSignup(homeOrigin); setScreen('signup'); }}
          />
        )}
        {screen === 'comingSoon' && (
          <div className="sr-coming-soon">
            <div className="sr-coming-soon__hanja">
              {{ jakmeong: '作名' }[pendingService] ?? '命'}
            </div>
            <div className="sr-coming-soon__title">
              {{ jakmeong: '작명소' }[pendingService] ?? '준비 중'}
            </div>
            <div className="sr-coming-soon__badge">COMING SOON · 추후 서비스 예정</div>
            <p className="sr-coming-soon__desc">곧 문이 열릴 예정이에요.<br />조금만 기다려주세요.</p>
            <button className="sr-coming-soon__back" onClick={() => setScreen('signalRoom')}>SIGNAL ROOM으로 돌아가기</button>
          </div>
        )}
        {screen === 'home' && <HomeScreen onSelect={(key) => handleHomeSelect(key, 'home')} onLogin={() => { setPendingAfterSignup('home'); setScreen('signup'); }} onOpenMyPage={() => setScreen('mypage')} nickname={nickname} />}
        {screen === 'mypage' && <MyPage nickname={nickname} onBack={() => setScreen(homeOrigin)} onHome={() => setScreen(homeOrigin)} onOpenProducts={() => setScreen('products')} onLogout={handleLogout} onOpenLegal={(docType) => { setLegalDocType(docType); setScreen('legal'); }} onLogin={() => { setPendingAfterSignup(homeOrigin); setScreen('signup'); }} />}
        {screen === 'legal' && <LegalScreen docType={legalDocType} onBack={() => setScreen('mypage')} onHome={() => setScreen(homeOrigin)} />}
        {screen === 'products' && <ProductsScreen onBack={() => setScreen('mypage')} onHome={() => setScreen(homeOrigin)} autoBuyCode={pendingProductCode} />}
        {screen === 'intro' && <ServiceIntroScreen serviceKey={pendingService} onNext={handleIntroNext} onBack={() => setScreen(homeOrigin)} />}
        {screen === 'analysisChoice' && pendingRecommendation && (
          <AnalysisChoiceScreen
            recommendation={pendingRecommendation}
            onChoose={handleAnalysisChoice}
            onBack={() => setScreen('birth')}
          />
        )}
        {screen === 'welcome' && <WelcomeScreen serviceId={pendingService} onStart={() => setScreen('birth')} onBack={() => setScreen('intro')} onHome={() => setScreen(homeOrigin)} />}
        {screen === 'birth' && (
          <BirthDataForm
            onSubmit={async (birthData) => {
              // battle/compatibility로 가는 길목이었다면 채팅을 시작하지 않고 chartId만 확보한다.
              if (pendingService === 'battle' || pendingService === 'compatibility') {
                try {
                  const chart = await api.createChart(birthData);
                  setChartId(chart.id);
                  setScreen(pendingService);
                } catch (err) {
                  // BirthDataForm의 error prop은 chat.error를 쓰므로 여기선 콘솔로만 남긴다.
                  console.error(err);
                }
                return;
              }
              await handleBirthSubmit(birthData);
            }}
            isSubmitting={chat.isBooting}
            error={chat.error}
            onBack={() => setScreen('welcome')}
            onHome={() => setScreen(homeOrigin)}
          />
        )}
        {screen === 'signup' && <NicknameSignup onSubmit={handleNicknameSubmit} isSubmitting={isSigningUp} error={nicknameError} onBack={() => setScreen(homeOrigin)} onEmailAuthSuccess={handleEmailAuthSuccess} />}
        {screen === 'fun' && <FunContentScreen onBack={() => setScreen('chat')} onHome={() => setScreen('home')} />}
        {screen === 'battle' && <SajuBattleScreen myChartId={chartId} onBack={() => setScreen(pendingService === 'battle' ? homeOrigin : 'chat')} onHome={() => setScreen(homeOrigin)} />}
        {screen === 'ranking' && <LeaderboardScreen chartId={chartId} userId={userId} onBack={() => setScreen('chat')} onHome={() => setScreen('home')} />}
        {screen === 'compatibility' && <CompatibilityScreen myChartId={chartId} onBack={() => setScreen(pendingService === 'compatibility' ? homeOrigin : 'chat')} onHome={() => setScreen(homeOrigin)} />}
        {screen === 'yearlyFortune' && (
          <YearlyFortuneScreen
            userId={userId}
            chartId={chartId}
            onBack={() => setScreen(homeOrigin)}
            onHome={() => setScreen(homeOrigin)}
            onNeedBirthData={() => { setPendingService('yearlyFortuneAfterBirth'); setScreen('birth'); }}
            onOpenChat={handleOpenYearlyFortuneChat}
          />
        )}
        {screen === 'child' && <ChildSajuScreen onBack={() => setScreen(homeOrigin)} onHome={() => setScreen(homeOrigin)} />}

        {screen === 'chat' && (
          <ChatScreen
            chat={chat}
            userId={userId}
            onOpenDetail={handleOpenDetail}
            onOpenMenu={() => setShowMenu(true)}
            onHome={() => setScreen(homeOrigin)}
            onNeedLogin={() => { setPendingAfterSignup('chat'); setScreen('signup'); }}
            onNeedPurchase={(code) => { setPendingProductCode(code); if (!userId) { setPendingAfterSignup('products'); setScreen('signup'); } else { setScreen('products'); } }}
            onOpenBirthForm={() => { setPendingService('birthEditFromChat'); setScreen('birth'); }}
          />
        )}

        {showMenu && <MoreMenu onSelect={handleMenuSelect} onClose={() => setShowMenu(false)} />}

        {revealDest && (
          <div className="reveal-screen-overlay">
            <RevealScreen onComplete={handleRevealComplete} />
          </div>
        )}
      </div>
    </div>
  );
}
