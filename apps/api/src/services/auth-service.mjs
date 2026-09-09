// apps/api/src/services/auth-service.mjs
//
// STEP 3(카카오) → STEP 4(공통화 + 네이버/구글 추가). provider별 차이는 오직
// oauth-providers/{kakao,naver,google}.mjs 안에만 있다 — 이 파일은 provider 이름과 무관하게
// 동일한 파이프라인(§F 설계)을 수행한다: authorize URL 생성 → code 교환 → 프로필 조회 →
// 로그인/가입 → (신규 가입이면) 익명 데이터 승계 → 세션 생성.
import { findOrCreateUserByAuthAccount, createSession, createEmailAccount, findEmailAuthAccount } from '../repositories/auth-repository.mjs';
import { listChildProfilesForUser, updateChildProfile } from '../repositories/child-profile-repository.mjs';
import { listPurchasedAnalysesForUser, reassignOwnerForAccountLinking } from '../repositories/purchased-analysis-repository.mjs';
import { kakaoProvider } from './oauth-providers/kakao.mjs';
import { naverProvider } from './oauth-providers/naver.mjs';
import { googleProvider } from './oauth-providers/google.mjs';
import bcrypt from 'bcryptjs';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;

export class AuthValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** §이메일 회원가입 — 인증 정보(이메일/비밀번호)만 다룬다. 이름/성별/생년월일/출생시간 같은
 * 서비스 프로필 정보는 여기서 저장하지 않는다 — 기존 POST /api/charts(§3 역할 분리 원칙)로
 * 별도 처리한다. 익명 상태에서 만든 데이터를 이 신규 계정에 연결하는 것도 기존 OAuth 가입과
 * 완전히 동일한 절차(reassignOwnerForAccountLinking)를 그대로 재사용한다. */
export async function signupWithEmail({ email, password, nickname, anonymousUserId = null }) {
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    throw new AuthValidationError('INVALID_EMAIL', '올바른 이메일 형식이 아닙니다.');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new AuthValidationError('INVALID_PASSWORD', '비밀번호는 8자 이상이어야 합니다.');
  }
  if (typeof nickname !== 'string' || nickname.trim().length < 2 || nickname.trim().length > 20) {
    throw new AuthValidationError('INVALID_NICKNAME', '닉네임은 2~20자여야 합니다.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = await createEmailAccount({ email: email.toLowerCase().trim(), nickname: nickname.trim(), passwordHash });
  if (result.error === 'EMAIL_ALREADY_EXISTS') {
    throw new AuthValidationError('EMAIL_ALREADY_EXISTS', '이미 가입된 이메일입니다.');
  }

  // §기존 OAuth 가입과 완전히 동일한 절차 재사용 — 익명 상태에서 만든 자녀 프로필/구매
  // 이력을 신규 계정에 연결(실패 시 자동 롤백 포함, linkAnonymousData가 이미 처리).
  if (anonymousUserId) {
    try {
      await linkAnonymousData(anonymousUserId, result.user.id);
    } catch (err) {
      console.error('[이메일 가입 - 익명 데이터 연결 실패]', err.message);
    }
  }

  const session = await createSession(result.user.id);
  return { session, user: result.user, isNewUser: true };
}

/** §이메일 로그인 — 계정이 없는 경우와 비밀번호가 틀린 경우 모두 동일한 에러(INVALID_CREDENTIALS)
 * 를 반환한다(§보안 원칙 — 계정 존재 여부를 노출하지 않음). */
export async function loginWithEmail({ email, password }) {
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new AuthValidationError('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  const account = await findEmailAuthAccount(email.toLowerCase().trim());
  if (!account || !account.password_hash) {
    // §타이밍 공격 방지 — 계정이 없어도 해싱 비교와 비슷한 시간이 걸리도록 더미 해시와 비교한다.
    await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuuOeWs3W0v3d1t5w1p1a2s3s4w5o6r7d8');
    throw new AuthValidationError('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  const valid = await bcrypt.compare(password, account.password_hash);
  if (!valid) {
    throw new AuthValidationError('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  const session = await createSession(account.user_id);
  return { session, user: { id: account.user_id, email: account.email, nickname: account.nickname } };
}

export const OAUTH_PROVIDERS = {
  kakao: kakaoProvider,
  naver: naverProvider,
  google: googleProvider,
};

/** 순수 함수 — 네트워크 호출 없이 URL만 만든다. provider별 실제 authorize 엔드포인트/파라미터
 * 차이는 각 provider 어댑터 안에만 있다. 단위 테스트로 검증 가능(네트워크 불필요). */
export function buildOAuthAuthorizeUrl(providerName, { clientId, redirectUri, state }) {
  const provider = OAUTH_PROVIDERS[providerName];
  if (!provider) throw new Error(`알 수 없는 OAuth provider: ${providerName}`);
  return provider.buildAuthorizeUrl({ clientId, redirectUri, state });
}

/** OAuth 콜백 공통 처리: code → token 교환 → 프로필 조회 → 로그인/가입 → 익명 데이터 승계 →
 * 세션 생성. provider 이름만 다르면 카카오/네이버/구글 전부 이 함수 하나로 처리된다. 실제
 * 네트워크(fetch)를 쓰므로 이 환경(sandbox)에서는 직접 실행 검증이 불가능하다 — 로컬에서 실제
 * provider 키로 확인 필요(각 provider 어댑터의 exchangeCodeForToken/fetchProfile은 별도로
 * 목(mock) 유닛 테스트로 검증했다 — 아래 tests/37 참고). */
export async function handleOAuthCallback({ providerName, clientId, clientSecret, redirectUri, code, state, anonymousUserId = null }) {
  const provider = OAUTH_PROVIDERS[providerName];
  if (!provider) throw new Error(`알 수 없는 OAuth provider: ${providerName}`);

  const accessToken = await provider.exchangeCodeForToken({ clientId, clientSecret, redirectUri, code, state });
  const profile = await provider.fetchProfile(accessToken);
  const { user, isNewUser } = await findOrCreateUserByAuthAccount({
    provider: providerName,
    providerUserId: profile.providerUserId,
    nickname: profile.nickname,
    email: profile.email,
  });

  if (isNewUser && anonymousUserId) {
    await linkAnonymousData(anonymousUserId, user.id);
  }

  const session = await createSession(user.id);
  return { user, session, isNewUser };
}

// --- 하위 호환 래퍼(STEP 3에서 만든 이름을 그대로 유지 — 기존 auth.mjs 라우트가 당장은 이걸
// 계속 써도 되게 한다. 새 라우트는 위의 공통 함수를 직접 쓴다.) ---
export function buildKakaoAuthorizeUrl(args) {
  return buildOAuthAuthorizeUrl('kakao', args);
}
export async function handleKakaoCallback({ clientId, clientSecret, redirectUri, code, anonymousUserId = null }) {
  return handleOAuthCallback({ providerName: 'kakao', clientId, clientSecret, redirectUri, code, anonymousUserId });
}

/**
 * 익명 사용자 → 회원 계정 데이터 승계 정책(사용자 결정사항, STEP 3 사후 보완).
 *
 * §1 child_profiles와 §2 purchased_analyses(무료 사용 이력 포함) 둘 다 실제 계정으로 옮긴다.
 * §5 보안검증: anonymousUserId가 실제로 "익명" 네임스페이스(`anon-` 접두사)가 아니면 절대 진행하지
 *   않는다 — 이 접두사는 apps/web/src/utils/anonUser.js가 익명ID를 만들 때만 붙이므로, 다른
 *   사용자의 실제 user_id(순수 UUID, `anon-` 접두사 없음)를 anonymousUserId인 척 넘겨서 그
 *   사람의 데이터를 가로채는 것을 원천 차단한다.
 * §4 중복 생성 방지: 이 함수는 새 레코드를 만들지 않고 기존 레코드의 user_id만 재할당(UPDATE)
 *   하므로, 같은 승계가 두 번 호출돼도 결과가 달라지지 않는다(멱등).
 * §7/§8 트랜잭션/롤백: child_profiles와 purchased_analyses는 아직 STEP 6 이전이라 진짜 DB
 *   트랜잭션이 없는 JSON 파일 저장소다 — "완벽한 원자적 트랜잭션"은 이 저장소가 Postgres로
 *   옮겨가는 STEP 6 이후에나 가능하다. 그 전까지는 여기서 순서대로 적용하고, 중간에 실패하면
 *   이미 적용된 변경만 역순으로 되돌리는 보정(compensating rollback) 방식으로 최선을 다한다 —
 *   이건 진짜 DB 트랜잭션과 다르다는 걸 명확히 알아둬야 한다(보고서에 그대로 명시).
 * §3 무료 재사용 방지: 실제로 이 함수를 호출한 뒤 프론트가 localStorage의 익명ID를 지워야
 *   완성된다(§6) — 그렇게 안 하면 브라우저가 예전 익명ID를 계속 들고 있다가 재사용할 위험이
 *   있다. 프론트 쪽 처리는 App.jsx에서 로그인 성공 리다이렉트 감지 시 수행한다.
 */
export async function linkAnonymousData(anonymousUserId, realUserId, { _simulateFailureAfterFirstProfile = false } = {}) {
  if (!anonymousUserId || typeof anonymousUserId !== 'string' || !anonymousUserId.startsWith('anon-')) {
    return { linked: false, reason: 'NOT_ANONYMOUS_ID' };
  }
  if (anonymousUserId === realUserId) {
    return { linked: false, reason: 'SAME_USER' };
  }

  const appliedChildProfileIds = [];
  const appliedAnalysisIds = [];

  try {
    const profiles = await listChildProfilesForUser(anonymousUserId);
    for (const profile of profiles) {
      const updated = await updateChildProfile(profile.id, { user_id: realUserId });
      if (!updated) throw new Error(`child_profile ${profile.id} 업데이트 실패 — 승계 중단 및 롤백`);
      appliedChildProfileIds.push(profile.id);
      // 테스트 전용 훅 — 실제 동시성 실패(다른 프로세스가 같은 순간 레코드를 지우는 등)는
      // 단일 스레드 동기 테스트 코드로 재현할 수 없어서, 정확히 이 지점에서 실패를 주입할 수
      // 있는 매개변수를 열어뒀다. 기본값 false면 프로덕션과 완전히 동일하게 동작한다.
      if (_simulateFailureAfterFirstProfile && appliedChildProfileIds.length === 1) {
        throw new Error('시뮬레이션된 실패(테스트 전용) — 롤백 경로 검증');
      }
    }

    const analyses = await listPurchasedAnalysesForUser(anonymousUserId);
    for (const analysis of analyses) {
      const result = await reassignOwnerForAccountLinking(analysis.id, realUserId);
      if (!result) throw new Error(`purchased_analysis ${analysis.id} 업데이트 실패 — 승계 중단 및 롤백`);
      appliedAnalysisIds.push(analysis.id);
    }

    return { linked: true, linkedProfileCount: appliedChildProfileIds.length, linkedAnalysisCount: appliedAnalysisIds.length };
  } catch (err) {
    // 보정 롤백 — 이미 적용된 변경만 역순으로 되돌린다(진짜 DB 트랜잭션이 아님, 위 주석 참고).
    for (const profileId of appliedChildProfileIds.reverse()) {
      await updateChildProfile(profileId, { user_id: anonymousUserId }).catch(() => {});
    }
    for (const analysisId of appliedAnalysisIds.reverse()) {
      await reassignOwnerForAccountLinking(analysisId, anonymousUserId).catch(() => {});
    }
    throw err;
  }
}
