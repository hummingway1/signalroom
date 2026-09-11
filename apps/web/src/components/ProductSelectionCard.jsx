// apps/web/src/components/ProductSelectionCard.jsx
//
// §Priority5 — 대화 중 실제 클릭 가능한 상품 카드. 가격/이름/설명은 전부 백엔드가
// GET 시점에 DB에서 조회해서 내려준 실제 값이다(하드코딩 없음).
// §10,000명 무료 캠페인 — p.campaignActive가 true면 정가에 취소선을 긋고 "지금 무료
// 체험하기"를 강조 표시한다. 상품 자체가 영구 무료로 바뀐 게 아니라(products.price는
// 그대로 990원), campaign 레이어가 있을 때만 이렇게 보인다 — 캠페인이 끝나면 이 조건이
// 자동으로 꺼지면서 정상가 표시로 돌아간다(프론트가 임의 판단하지 않고 서버가 보낸
// campaignActive 값만 그대로 반영).
export function ProductSelectionCard({ card, onSelectProduct, onClaimFreeTrial }) {
  if (!card?.products?.length) return null;
  return (
    <div className="product-selection-card">
      {card.products.map((p) => (
        <div key={p.code} className="product-selection-card__item">
          <p className="product-selection-card__name">{p.name}</p>
          {p.campaignActive ? (
            <>
              <p className="product-selection-card__price product-selection-card__price--strike">{p.price.toLocaleString()}원</p>
              <p className="product-selection-card__free-badge">지금 무료 체험하기!</p>
              <p className="product-selection-card__campaign-note">첫 10,000명 한정</p>
            </>
          ) : (
            <p className="product-selection-card__price">{p.price.toLocaleString()}원</p>
          )}
          {p.description && <p className="product-selection-card__desc">{p.description}</p>}
          {p.campaignActive ? (
            <button className="product-selection-card__btn product-selection-card__btn--free" onClick={() => onClaimFreeTrial?.()}>
              무료로 시작하기
            </button>
          ) : (
            <button className="product-selection-card__btn" onClick={() => onSelectProduct(p.code)}>
              {p.price.toLocaleString()}원으로 시작하기
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function SignupCtaCard({ onSignup }) {
  return (
    <div className="product-selection-card">
      <button className="product-selection-card__btn product-selection-card__btn--full" onClick={onSignup}>
        회원가입하고 시작하기
      </button>
    </div>
  );
}

// §Critical Flow — 저장된 생년월일 확인 카드. birthDate/birthTime은 백엔드가 실제 chart의
// canonical.subject에서 읽어온 값이다(하드코딩/추측 없음).
export function BirthConfirmCard({ card, onConfirm }) {
  return (
    <div className="product-selection-card">
      <div className="product-selection-card__item">
        <button className="product-selection-card__btn" onClick={() => onConfirm(card.chartId, true)}>
          응, 맞아
        </button>
        <button className="product-selection-card__btn product-selection-card__btn--secondary" onClick={() => onConfirm(card.chartId, false)}>
          아니, 수정할게
        </button>
      </div>
    </div>
  );
}

export function BirthFormNeededCard({ onOpenBirthForm }) {
  return (
    <div className="product-selection-card">
      <button className="product-selection-card__btn product-selection-card__btn--full" onClick={onOpenBirthForm}>
        생년월일 입력하기
      </button>
    </div>
  );
}
