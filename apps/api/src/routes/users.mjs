// apps/api/src/routes/users.mjs
//
// 닉네임 기반 경량 계정. 실제 소셜 로그인(네이버/구글/카카오)은 각 플랫폼 개발자센터의 실제 앱
// 등록(client ID/secret)이 필요해서 이 코드만으로는 진짜로 구현할 수 없다 — 그런 척 가짜로 만들지
// 않는다. 나중에 실제 키가 주어지면 provider/provider_user_id 필드에 연결하면 된다.
import { Router } from 'express';
import { createUser, getUser, findUserByNickname } from '../repositories/user-repository.mjs';

export function usersRouter() {
  const router = Router();

  // POST /api/users — 닉네임으로 계정 생성(이미 있으면 기존 계정 반환)
  router.post('/', async (req, res) => {
    const { nickname } = req.body ?? {};
    if (!nickname || typeof nickname !== 'string' || nickname.trim().length < 2) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: '닉네임은 2자 이상이어야 합니다.' } });
    }
    const trimmed = nickname.trim().slice(0, 20);
    const existing = await findUserByNickname(trimmed);
    if (existing) return res.json({ id: existing.id, nickname: existing.nickname });
    const user = await createUser({ nickname: trimmed });
    return res.status(201).json({ id: user.id, nickname: user.nickname });
  });

  router.get('/:id', async (req, res) => {
    const user = await getUser(req.params.id);
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return res.json({ id: user.id, nickname: user.nickname });
  });

  return router;
}
