// apps/web/src/characterAssets.js
//
// 캐릭터 "표시용" 정보만 여기서 관리한다 — 실제 톤/안전 규칙은 백엔드
// packages/character/characters.mjs가 갖고 있고, 프론트는 API가 내려주는 character.id로
// 이 테이블을 조회해서 보여주기만 한다.
//
// avatarUrl이 채워지면(나중에 실제 사진으로 교체) CharacterAvatar가 자동으로 <img>를 쓴다 —
// 지금은 null이라 Figma에서 이식한 실제 SVG 일러스트(DaeguSVG/MaengguSVG)가 렌더링된다.
// statusText는 Figma가 두 캐릭터 모두 "지금 이야기 중"으로 통일했으므로 그대로 맞춤.
export const CHARACTER_ASSETS = {
  daegu: {
    avatarUrl: null, // 나중에 실제 이미지로 교체 시 여기 채우기
    statusText: '지금 이야기 중',
    firstGreetings: ['사주 보러 왔구나. 요즘 뭐가 제일 궁금해?', '어서 와. 요즘 신경 쓰이는 거 있어?'],
    timeGreetings: {
      morning: '아침부터 왔네. 오늘 하루 어떻게 시작할지 궁금해?',
      night: '이 시간에 왔네. 뭔가 마음에 걸리는 거 있어?',
    },
  },
  manggu: {
    avatarUrl: null,
    statusText: '지금 이야기 중',
    firstGreetings: ['안녕. 요즘 어떤 게 궁금해서 왔어?', '왔네. 뭐부터 봐줄까?'],
    timeGreetings: {
      morning: '아침부터 왔네. 오늘 흐름 한번 볼까?',
      night: '이 시간에 궁금한 거 있었구나.',
    },
  },
  cupid: {
    avatarUrl: null,
    statusText: '궁합 봐주는 중',
    firstGreetings: ['안녕. 누구랑 궁합 볼 거야?', '왔네. 오늘은 누구 데려왔어?'],
    timeGreetings: {
      morning: '아침부터 궁합이 궁금했구나.',
      night: '이 시간에 궁합이라니, 누구 생각났어?',
    },
  },
  scholar: {
    avatarUrl: null,
    statusText: '아이 사주 보는 중',
    firstGreetings: ['안녕하세요, 아이 이야기 들어볼까요.', '왔어요. 어떤 게 궁금하세요?'],
    timeGreetings: {
      morning: '아침 일찍 오셨네요.',
      night: '늦은 시간까지 아이 걱정이 많으셨나 봐요.',
    },
  },
};

export function getCharacterAsset(characterId) {
  return CHARACTER_ASSETS[characterId] ?? CHARACTER_ASSETS.daegu;
}

export function getTimeBasedGreeting(characterId) {
  const hour = new Date().getHours();
  const asset = getCharacterAsset(characterId);
  if (hour >= 5 && hour < 10) return asset.timeGreetings.morning;
  if (hour >= 23 || hour < 5) return asset.timeGreetings.night;
  return asset.firstGreetings[Math.floor(Math.random() * asset.firstGreetings.length)];
}
