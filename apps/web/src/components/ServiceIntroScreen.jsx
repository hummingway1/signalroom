// apps/web/src/components/ServiceIntroScreen.jsx
//
// §SERVICE_CATALOG 도입 — 서비스 소개 텍스트/상품코드를 이 컴포넌트에 더 이상 하드코딩하지
// 않는다. SERVICE_CATALOG(단일 소스)에서 조회하고, 실제 가격은 여전히 GET /api/products로
// 조회한다(§가격 하드코딩 금지 원칙 유지).
import { useEffect, useState } from 'react';
import * as api from '../api/client.js';
import { getServiceCatalogEntry } from '../serviceCatalog.js';

export function ServiceIntroScreen({ serviceKey, onNext, onBack }) {
  const info = getServiceCatalogEntry(serviceKey);
  const [productPrices, setProductPrices] = useState(null); // 상품 코드별 {price, question_quota, validity_hours} | null

  useEffect(() => {
    if (!info || info.productCodes.length === 0) return;
    api.listProducts()
      .then(({ products }) => {
        const map = {};
        for (const code of info.productCodes) {
          map[code] = products?.find((p) => p.code === code) ?? null;
        }
        setProductPrices(map);
      })
      .catch(() => setProductPrices(null));
  }, [serviceKey]);

  if (!info) return null;

  const detailProduct = info.productCodes.length > 1 ? productPrices?.[info.productCodes[1]] : productPrices?.[info.productCodes[0]];

  return (
    <div className="subscreen">
      <div className="subscreen__header">
        <button onClick={onBack} className="chat-header__back" aria-label="뒤로가기">‹</button>
        <div>
          <p className="subscreen__header-title">{info.title}</p>
        </div>
      </div>
      <div className="subscreen__body">
        <div className="service-intro slide-up">
          <p className="service-intro__detail">{info.description}</p>
          <div className="service-intro__section">
            <p className="service-intro__label">무엇을 알 수 있나요</p>
            <p className="service-intro__text">{info.subtitle}</p>
          </div>
          <div className="service-intro__section">
            <p className="service-intro__label">가격</p>
            {info.productCodes.length === 0 ? (
              <p className="service-intro__text">준비 중이에요.</p>
            ) : detailProduct ? (
              <p className="service-intro__text">
                무료 체험 가능 · 상세 분석 {detailProduct.price.toLocaleString()}원
                {detailProduct.question_quota ? `(채팅 ${detailProduct.question_quota}회, ${detailProduct.validity_hours}시간)` : ''}
              </p>
            ) : (
              <p className="service-intro__text">가격 정보를 불러오는 중이에요.</p>
            )}
          </div>
        </div>
      </div>
      <div className="subscreen__footer">
        {serviceKey === 'gunghap' ? (
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
            무료로 시작하기
          </button>
        )}
      </div>
    </div>
  );
}
