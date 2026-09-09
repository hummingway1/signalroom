// apps/web/src/components/LegalScreen.jsx
//
// §Toss Payments 가입 준비 - 법률 조항을 임의로 작성하지 않는다. 표준적인 섹션 구조만
// 만들고, 실제 값이 필요한 곳은 [ ] 로 명확히 표시해서 사장님이 직접 채워넣을 수 있게 한다.
const DOCS = {
  terms: {
    title: '이용약관',
    sections: [
      { heading: '제1조 (목적)', body: '이 약관은 [서비스명]이(가) 제공하는 사주/운세 분석 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.' },
      { heading: '제2조 (서비스의 내용)', body: '회사는 사주, 자미두수, 궁합, 아이시그널, 멤버십, 출생일 택일 등 명리학 기반 분석 서비스를 제공합니다. 각 서비스의 구체적인 내용과 가격은 서비스 화면에 안내된 바에 따릅니다.' },
      { heading: '제3조 (서비스의 성격)', body: '본 서비스가 제공하는 분석 결과는 참고용 정보이며, 의학적/법률적/재정적 판단을 대체하지 않습니다.' },
      { heading: '제4조 (결제 및 환불)', body: '[환불 정책을 여기에 명시하세요 - 예: 전자상거래법에 따른 청약철회 기준, 서비스 이용 시작 후 환불 제한 조건 등]' },
      { heading: '제5조 (사업자 정보)', body: '[사업자등록번호], [대표자명], [사업장 주소], [통신판매업 신고번호]를 이곳에 기재하세요.' },
      { heading: '부칙', body: '이 약관은 [연/월/일]부터 시행합니다.' },
    ],
  },
  privacy: {
    title: '개인정보처리방침',
    sections: [
      { heading: '1. 수집하는 개인정보 항목', body: '이름(닉네임), 생년월일시, 성별, 출생지, 결제 정보(주문번호, 결제수단) 등 서비스 이용에 필요한 정보를 수집합니다.' },
      { heading: '2. 개인정보의 수집 및 이용 목적', body: '사주/운세 분석 결과 생성, 결제 처리, 고객 문의 응대를 위해 사용합니다.' },
      { heading: '3. 개인정보의 보유 및 이용 기간', body: '[보유 기간을 여기에 명시하세요 - 예: 회원 탈퇴 시까지, 전자상거래법상 결제 기록은 5년 보관 등]' },
      { heading: '4. 개인정보의 제3자 제공', body: '[제3자 제공 여부와 대상(예: 결제대행사 Toss Payments)을 명시하세요]' },
      { heading: '5. 개인정보 보호책임자', body: '[담당자명], [연락처], [이메일]을 이곳에 기재하세요.' },
      { heading: '부칙', body: '이 방침은 [연/월/일]부터 시행합니다.' },
    ],
  },
  business: {
    title: '사업자 정보 / 고객센터',
    sections: [
      { heading: '상호', body: '[상호명을 입력하세요]' },
      { heading: '대표자', body: '[대표자명]' },
      { heading: '사업자등록번호', body: '[000-00-00000]' },
      { heading: '통신판매업 신고번호', body: '[제0000-서울00000-0000호]' },
      { heading: '사업장 소재지', body: '[주소]' },
      { heading: '고객센터', body: '이메일: [contact@example.com]\n운영시간: [평일 00:00~00:00]' },
    ],
  },
};

export function LegalScreen({ docType, onBack, onHome }) {
  const doc = DOCS[docType] ?? DOCS.terms;
  return (
    <div className="subscreen">
      <div className="subscreen__header">
        <button onClick={onBack} className="chat-header__back" aria-label="뒤로가기">‹</button>
        <div><p className="subscreen__header-title">{doc.title}</p></div>
        {onHome && <button className="subscreen__header-home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </div>
      <div className="subscreen__body">
        {doc.sections.map((s, i) => (
          <div key={i} className="membership-screen__explain">
            <p className="membership-screen__explain-title">{s.heading}</p>
            <p className="membership-screen__explain-body" style={{ whiteSpace: 'pre-line' }}>{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
