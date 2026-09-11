// apps/web/src/components/ProductSelectionCard.jsx
//
// §Priority5 — 대화 중 실제 클릭 가능한 상품 카드. 가격/이름/설명은 전부 백엔드가
// GET 시점에 DB에서 조회해서 내려준 실제 값이다(하드코딩 없음).
export function ProductSelectionCard({ card, onSelectProduct }) {
  if (!card?.products?.length) return null;
  return (
    <div className="product-selection-card">
      {card.products.map((p) => (
        <div key={p.code} className="product-selection-card__item">
          <p className="product-selection-card__name">{p.name}</p>
          <p className="product-selection-card__price">{p.price.toLocaleString()}원</p>
          {p.description && <p className="product-selection-card__desc">{p.description}</p>}
          <button className="product-selection-card__btn" onClick={() => onSelectProduct(p.code)}>
            {p.price.toLocaleString()}원으로 시작하기
          </button>
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
