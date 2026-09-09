// apps/web/src/components/ServiceIntroScreen.jsx
//
// 아이시그널 3개 서비스 구조에 맞춘 소개 화면. 가격은 §7("기본 990원, 최초 1회 무료, 전체 분석은
// Terra")을 그대로 표시 — 실제 결제 로직은 여전히 미구현이므로 텍스트로만 안내하고 결제를
// 강제하지 않는다(§16, 기존 정책 그대로). 개인정보 안내는 §9 원칙(저장되지만 목적 제한, 절대적
// 표현 금지, 개인정보처리방침은 링크 자리만 확보) 그대로.
const SERVICE_INTRO = {
  child: {
    emoji: '🤓',
    title: '아이시그널',
    detail: '아이가 왜 이렇게 행동하는지, 내가 어떻게 이야기해야 할지 막막할 때가 있죠. 아이의 성향을 바탕으로 지금 부모님이 겪고 있는 상황을 함께 살펴보고, 대화하면서 현실적인 방법을 찾아갑니다.',
    whatYouGet: '아이의 사주를 바탕으로 성향과 기질을 살펴보고, 아이를 이해하는 데 도움이 될 만한 관점과 대화 방법을 함께 찾아드려요.',
    price: '기본 분석 990원, 첫 이용은 무료. 더 자세한 전체 분석은 별도 유료.',
    privacyNote: true,
  },
  saju: {
    emoji: '🔮',
    title: '나의 시그널',
    detail: '태어난 년월일시를 바탕으로 나의 타고난 성향과 삶의 흐름을 사주와 자미두수로 살펴봅니다.',
    whatYouGet: '성향, 기질, 현재와 앞으로의 흐름에 대한 이야기를 나눌 수 있어요.',
    price: '무료',
  },
  relationship: {
    emoji: '💘',
    title: '관계 시그널',
    detail: '나와 상대방의 정보를 함께 넣어 두 사람의 관계 구조와 성향 흐름을 살펴봅니다.',
    whatYouGet: '서로 다른 점과 잘 맞는 점에 대한 이야기를 나눌 수 있어요.',
    price: '무료',
  },
};

export function ServiceIntroScreen({ serviceKey, onNext, onBack }) {
  const info = SERVICE_INTRO[serviceKey];
  if (!info) return null;

  return (
    <div className="subscreen">
      <div className="subscreen__header">
        <button onClick={onBack} className="chat-header__back" aria-label="뒤로가기">‹</button>
        <div>
          <p className="subscreen__header-title">{info.emoji} {info.title}</p>
        </div>
      </div>
      <div className="subscreen__body">
        <div className="service-intro slide-up">
          <p className="service-intro__detail">{info.detail}</p>
          <div className="service-intro__section">
            <p className="service-intro__label">무엇을 알 수 있나요</p>
            <p className="service-intro__text">{info.whatYouGet}</p>
          </div>
          <div className="service-intro__section">
            <p className="service-intro__label">가격</p>
            <p className="service-intro__text">{info.price}</p>
          </div>
          {info.privacyNote && (
            <div className="service-intro__privacy">
              <p className="service-intro__privacy-title">아이와 나눈 이야기는 소중하게 보호합니다.</p>
              <p className="service-intro__privacy-text">
                대화 내용은 서비스를 제공하고 이어가기 위해 저장될 수 있습니다. 원하시면 언제든 대화와 저장된 정보를 삭제할 수 있습니다. 광고 목적으로 사용하지 않습니다. OpenAI API를 통한 대화 내용은 기본적으로 AI 모델 학습에 사용되지 않습니다.
              </p>
              <a className="service-intro__privacy-link" href="/privacy" target="_blank" rel="noreferrer">개인정보처리방침 보기</a>
            </div>
          )}
        </div>
      </div>
      <div className="subscreen__footer">
        {serviceKey === 'relationship' ? (
          <>
            <button onClick={() => onNext('compatibility')} className="subscreen__btn-full" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              궁합 보기
            </button>
            <button onClick={() => onNext('battle')} className="subscreen__btn-secondary">
              사주 대결 보기
            </button>
          </>
        ) : (
          <button onClick={() => onNext()} className="subscreen__btn-full" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            다음
          </button>
        )}
      </div>
    </div>
  );
}
