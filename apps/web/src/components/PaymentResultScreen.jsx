// apps/web/src/components/PaymentResultScreen.jsx
//
// Toss가 결제 성공/실패 후 successUrl/failUrl로 리다이렉트하면서 쿼리파라미터(orderId,
// paymentKey, amount)를 붙여준다. 성공 리다이렉트 자체를 결제 완료의 증거로 믿지 않고, 반드시
// 서버의 /api/payments/confirm을 호출해서 서버가 Toss에 직접 확인한 결과로만 완료 여부를
// 판단한다(§결제 보안 핵심).
import { useEffect, useState } from 'react';
import * as api from '../api/client.js';

export function PaymentResultScreen({ status, params, onDone }) {
  const [state, setState] = useState(status === 'fail' ? 'fail' : 'confirming');
  const [message, setMessage] = useState(null);
  const [confirmResult, setConfirmResult] = useState(null);

  useEffect(() => {
    if (status !== 'success') return;
    const { orderId, paymentKey, amount } = params;
    if (!orderId || !paymentKey || !amount) {
      setState('fail');
      setMessage('결제 정보가 올바르지 않습니다.');
      return;
    }
    api.confirmPayment({ orderId, paymentKey, amount: Number(amount) })
      .then((result) => { setConfirmResult(result); setState('success'); })
      .catch((err) => {
        setState('fail');
        setMessage(err.message ?? '결제 확인 중 문제가 발생했어요.');
      });
  }, [status, params]);

  return (
    <div className="subscreen">
      <div className="subscreen__body payment-result">
        {state === 'confirming' && <p>결제를 확인하는 중이에요...</p>}
        {state === 'success' && (
          <>
            <p className="payment-result__title">결제가 완료됐어요</p>
            <p className="payment-result__desc">이제 이용권을 사용할 수 있어요.</p>
          </>
        )}
        {state === 'fail' && (
          <>
            <p className="payment-result__title">결제가 완료되지 않았어요</p>
            {message && <p className="payment-result__desc">{message}</p>}
          </>
        )}
        <button className="intake-submit" onClick={() => onDone(confirmResult)}>홈으로</button>
      </div>
    </div>
  );
}
