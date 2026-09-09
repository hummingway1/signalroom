import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ArrowRight } from 'lucide-react';
import { SolAvatar } from '../components/SolAvatar.jsx';

// 메인 DM 화면. 솔이가 스크립트(STEPS)를 따라 한 문장씩 typing indicator와 함께
// 보내고, 각 단계 끝에 Quick Reply 2~3개를 제안한다. 사용자가 답하면 다음 단계로
// 넘어가고, 3번째 단계에서 발견 카드, 4번째 단계에서 "분석 결과 보기" CTA 카드가 나온다.
//
// 데모용 하드코딩 스크립트다 — 실제 서비스에서는 이 STEPS 자리에 백엔드 응답이 들어간다.
export function ChatScreen({ info, onShowBasic, onBack }) {
  const [msgs, setMsgs] = useState([]);
  const [typing, setTyping] = useState(false);
  const [qr, setQr] = useState([]);
  const [inputVal, setInputVal] = useState('');

  const stepRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const idRef = useRef(0);
  const runRef = useRef();
  const scrollRef = useRef(null);

  const name = info.name || '아이';

  useEffect(() => {
    mountedRef.current = true;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const push = (msg) => {
      if (!mountedRef.current) return;
      idRef.current++;
      setMsgs((prev) => [...prev, { ...msg, id: idRef.current }]);
    };

    const STEPS = [
      {
        qr: ['최근에 갑자기 힘들어졌어요', '원래 좀 그런 편이에요', '특정 상황에서만 그래요'],
        run: async () => {
          setTyping(true);
          await sleep(700);
          if (!mountedRef.current) return;
          setTyping(false);
          push({ from: 'ai', text: '안녕하세요 😊 반가워요.' });
          await sleep(900);
          setTyping(true);
          await sleep(1000);
          if (!mountedRef.current) return;
          setTyping(false);
          push({ from: 'ai', text: `${name}이 이야기, 잘 들을게요.` });
          await sleep(800);
          setTyping(true);
          await sleep(1100);
          if (!mountedRef.current) return;
          setTyping(false);
          push({ from: 'ai', text: '요즘 어떤 상황인지 조금 더 얘기해 주실 수 있어요?' });
        },
      },
      {
        qr: ['혼자 있을 때요', '친구들이랑 있을 때요', '잘 안 될 때 포기해버려요'],
        run: async () => {
          setTyping(true);
          await sleep(800);
          if (!mountedRef.current) return;
          setTyping(false);
          push({ from: 'ai', text: '그렇군요.' });
          await sleep(600);
          setTyping(true);
          await sleep(1000);
          if (!mountedRef.current) return;
          setTyping(false);
          push({ from: 'ai', text: `${name}이가 특히 어떤 순간에 힘들어 보이나요?` });
        },
      },
      {
        qr: ['맞는 것 같아요', '어떻게 도와줄 수 있을까요?'],
        run: async () => {
          setTyping(true);
          await sleep(900);
          if (!mountedRef.current) return;
          setTyping(false);
          push({ from: 'ai', text: '맞아요, 그런 패턴이 있는 아이들이 있어요.' });
          await sleep(800);
          setTyping(true);
          await sleep(1300);
          if (!mountedRef.current) return;
          setTyping(false);
          push({
            from: 'ai',
            text: `${name}이의 생년월일을 보니까... 이 아이, 감수성이 꽤 풍부한 편이에요.`,
          });
          await sleep(600);
          push({
            from: 'ai',
            card: {
              emoji: '🔍',
              title: `${name}이에게서 발견한 신호`,
              body: '주변 분위기에 굉장히 민감해요. 좋은 일도 나쁜 일도 남들보다 더 깊이 느끼는 편이라, 겉으로는 괜찮아 보여도 속으로 많이 담아두는 경우가 있어요.',
            },
          });
        },
      },
      {
        qr: [],
        run: async () => {
          setTyping(true);
          await sleep(700);
          if (!mountedRef.current) return;
          setTyping(false);
          push({
            from: 'ai',
            text: "이런 기질의 아이들한테 제일 중요한 건 '내 편이 있다'는 느낌이에요.",
          });
          await sleep(900);
          setTyping(true);
          await sleep(1000);
          if (!mountedRef.current) return;
          setTyping(false);
          push({ from: 'ai', text: `${name}이 기본 분석 결과를 볼 수 있어요.` });
          await sleep(400);
          push({
            from: 'ai',
            card: {
              emoji: '✨',
              title: '기본 분석 준비됐어요',
              body: `${name}이의 기질 유형과 지금 상황에 맞는 방향을 정리했어요.`,
              cta: '분석 결과 보기',
            },
          });
        },
      },
    ];

    const runStep = async () => {
      if (busyRef.current) return;
      const s = stepRef.current;
      if (s >= STEPS.length) return;
      busyRef.current = true;
      setQr([]);
      await STEPS[s].run();
      if (!mountedRef.current) return;
      setQr(STEPS[s].qr);
      busyRef.current = false;
    };

    runRef.current = runStep;
    runStep();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, typing]);

  const handleReply = (text) => {
    if (busyRef.current) return;
    idRef.current++;
    setMsgs((prev) => [...prev, { from: 'user', text, id: idRef.current }]);
    setQr([]);
    stepRef.current++;
    setTimeout(() => runRef.current?.(), 400);
  };

  const handleSend = () => {
    if (!inputVal.trim() || busyRef.current) return;
    handleReply(inputVal.trim());
    setInputVal('');
  };

  return (
    <div className="phone-shell" style={{ background: '#F4FAF8' }}>
      <div
        className="flex items-center gap-3 px-4 pt-12 pb-3 flex-shrink-0"
        style={{ background: 'white', borderBottom: '1px solid #EBF5F2' }}
      >
        <button onClick={onBack} aria-label="뒤로">
          <ChevronLeft size={22} color="#1A3344" />
        </button>
        <SolAvatar size={38} />
        <div className="flex-1">
          <div className="font-bold text-sm" style={{ color: '#1A3344' }}>
            솔이
          </div>
          <div className="text-xs" style={{ color: '#39A89B' }}>
            지금 이야기 중
          </div>
        </div>
        <div className="w-2 h-2 rounded-full" style={{ background: '#39A89B' }} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {msgs.map((msg) => (
          <div key={msg.id} className="msg-in">
            {msg.from === 'ai' ? (
              msg.card ? (
                <div className="flex items-start gap-2.5">
                  <SolAvatar size={28} />
                  <div
                    className="card-in rounded-2xl rounded-tl-none p-4"
                    style={{
                      background: 'white',
                      boxShadow: '0 3px 16px rgba(26,51,68,0.09)',
                      maxWidth: '82%',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{msg.card.emoji}</span>
                      <span className="font-bold text-sm" style={{ color: '#1A3344' }}>
                        {msg.card.title}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed mb-2" style={{ color: '#5A7A8A' }}>
                      {msg.card.body}
                    </p>
                    {msg.card.cta && (
                      <button
                        onClick={onShowBasic}
                        className="w-full py-2.5 rounded-xl text-xs font-bold text-white mt-1 active:scale-[0.98] transition-transform"
                        style={{ background: 'linear-gradient(135deg, #39A89B 0%, #2D9088 100%)' }}
                      >
                        {msg.card.cta}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <SolAvatar size={28} />
                  <div
                    className="rounded-2xl rounded-tl-none px-3.5 py-2.5"
                    style={{ background: 'white', color: '#1A3344', maxWidth: '75%' }}
                  >
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex justify-end">
                <div
                  className="rounded-2xl rounded-tr-none px-3.5 py-2.5"
                  style={{ background: '#39A89B', color: 'white', maxWidth: '75%' }}
                >
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {typing && (
          <div className="flex items-start gap-2.5 msg-in">
            <SolAvatar size={28} />
            <div className="rounded-2xl rounded-tl-none px-4 py-3" style={{ background: 'white' }}>
              <div className="flex gap-1.5">
                <span className="t-dot" />
                <span className="t-dot" />
                <span className="t-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {qr.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 flex-shrink-0">
          {qr.map((r) => (
            <button
              key={r}
              onClick={() => handleReply(r)}
              className="px-3.5 py-2 rounded-full text-sm font-medium border active:scale-[0.97] transition-transform"
              style={{ background: 'white', borderColor: '#C8E8E3', color: '#1A3344' }}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      <div
        className="px-4 pb-6 pt-2 flex gap-2 items-center flex-shrink-0"
        style={{ background: 'white', borderTop: '1px solid #EBF5F2' }}
      >
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="솔이에게 이야기해보세요..."
          className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none"
          style={{ background: '#F4FAF8', color: '#1A3344' }}
        />
        <button
          onClick={handleSend}
          aria-label="보내기"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 active:scale-[0.95] transition-transform"
          style={{ background: inputVal.trim() ? '#39A89B' : '#C8E8E3' }}
        >
          <ArrowRight size={16} color="white" />
        </button>
      </div>
    </div>
  );
}
