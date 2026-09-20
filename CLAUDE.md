# CLAUDE.md

이 폴더에서 작업할 때 Claude Code가 먼저 읽는 프로젝트 메모입니다.

## 폴더 구조

```
(repo root)
├─ index.html       ← 게임 전체 (HTML+CSS+JS 한 파일, ~746줄)
├─ CLAUDE.md        ← 이 파일 (현황 · 남은 작업 · 코드 구조)
├─ README.md
└─ .claude/
   ├─ settings.json        ← 훅 설정 (커밋 대상)
   ├─ hooks/check-syntax.mjs
   └─ settings.local.json  ← 머신별 설정 (커밋 제외)
```

작업 대상은 사실상 `index.html` 하나입니다.
좌표계·상태 전이·함수별 역할은 아래 **코드 구조** 섹션에 정리돼 있으니 코드를 고치기 전에 읽으세요.
**코드를 바꾸면 이 파일도 같이 갱신할 것.**

## 프로젝트

**스윙스타 (SWING STAR)** — 원버튼 브라우저 아케이드 게임.
행성 궤도를 돌다가 한 번의 입력으로 발사해 다음 행성 궤도에 올라타는 방식.

- 빌드 없음 · 의존성 없음 · 패키지 매니저 없음 · 린터 없음 · 테스트 없음
- git 저장소 (GitHub 공개). 빌드 파이프라인·의존성·테스트는 여전히 없음
- UI 텍스트는 한국어
- 실행: `index.html`을 브라우저로 바로 열기 (`file://` 동작함)

## 구현 완료 (플레이 가능한 상태)

게임은 처음부터 끝까지 동작합니다. 아래는 이미 들어가 있는 것들입니다.

### 코어
- `requestAnimationFrame` 루프 → `update(dt)` / `draw()`, `dt`는 0.033초로 클램프
- DPR 대응 캔버스 리사이즈 + `reflowWorld(prevW, prevH)`:
  화면 크기가 바뀌면 행성 `baseX`·`amp`, 블랙홀·조각 x좌표를 새 폭에 맞춰 재배치하고,
  세로 길이가 바뀌면 `camY`를 즉시 다시 잡는다. 둘 중 하나라도 빠지면 모바일 회전 시 즉사한다.
  `amp`는 원본 `amp0`에서 매번 재계산하므로 좁은 화면을 거쳐도 원래 폭으로 복구된다
- 상태: `menu` / `play` / `dead`
- 플레이어 모드: `orbit`(공전) / `fly`(직선 비행) / `gone`(사망)
- 입력: 클릭 · 터치 · Space · Enter (원버튼), `M` 키 음소거
- 즉시 재시작: 사망 후 `RESTART_DELAY`(260ms)가 지나면 오버레이를 기다리지 않고 아무 입력으로 다음 판 시작.
  유예는 사망 순간 눌려 있던 입력이 그대로 재시작으로 이어지는 것을 막기 위한 것 (`canQuickRestart()`)

### 레벨 생성
- 위로 무한 생성되는 절차적 행성 배치, `idx`에 따라 난이도 상승
  (반지름 감소, 간격 증가, idx 4 이후 좌우 진동 `amp` 등장)
- 행성 타입 3종: `normal` · `ice`(idx 3~, 공전 속도 ×0.55) · `lava`(idx 8~, 3초 제한 + 카운트다운 링)
- 블랙홀(idx 12~, 25% 확률): 중력이 비행 궤적을 휘게 함(속도는 일정), 코어 접촉 시 사망
- 별 조각(`shards`): 행성 사이·블랙홀 옆 배치, `clear()`로 궤도와 겹치지 않게 검사
- 카메라 아래로 벗어난 행성·블랙홀·조각 컬링

### 점수 · 피드백
- `score`(전진한 행성 수 × 콤보 배율), `height`(최고 도달 idx, 난이도 구동), `maxCombo`
- PERFECT 판정: 비행 직선이 궤도 반경의 35% 이내로 행성 중심을 지날 때 → `combo++`, 배율 `min(1+combo, 5)`
- HUD: 점수 · 최고 기록 · 획득 조각 · PERFECT 콤보 칩(pop 애니메이션)
- Web Audio로 합성한 효과음 6종(launch/land/perfect/shard/tick/boom) — 오디오 파일 없음
- `navigator.vibrate` 진동, 파티클 버스트, 화면 흔들림, 궤적, 패럴랙스 별 배경, 메뉴 별똥별

### 화면 · 메뉴
- 대기 화면 자동 시연(`demoPilot()`): 메뉴 뒤에서 AI가 혼자 플레이, 소리·진동·저장 없음
- 애니메이션 로고, 블롭 배경, 3단계 조작 안내, 범례, 시작 버튼
- 게임 오버 오버레이: 점수 · 신기록 표시 · 높이 · 최대 콤보 · 획득 조각 · 다시하기 / 결과 복사 / 메뉴 버튼
- 결과 공유 카드(`shareResult()`): 점수·높이·콤보와 배포 주소를 클립보드에 복사.
  `navigator.clipboard`는 보안 컨텍스트에서만 동작하므로 `execCommand('copy')` 폴백이 있음.
  주소는 `shareUrl()`이 결정 — http(s)면 현재 주소, `file://`이면 `PAGE_URL` 상수
- `prefers-reduced-motion` 대응, 좁은 화면용 미디어 쿼리

### 스킨 · 저장
- 스킨 5종(기본/네온/선셋/무지개/골드), 조각으로 구매, 잔액 부족 시 흔들림 피드백
- 무지개는 hue 회전, 골드는 반짝임 파티클
- `localStorage` 저장(try/catch 래퍼 `store`): `swingStarBest` · `swingStarShards` ·
  `swingStarSkins` · `swingStarSkin` · `swingStarMuted`
- 보유하지 않은 스킨이 저장돼 있으면 `basic`으로 복구하는 검증 로직 있음

## 남은 작업 / 알려진 문제

우선순위 순. ⚠️는 실제로 재현을 확인한 것, ○는 아직 없는 기능.

### ⚠️ 버그 · 엣지 케이스
1. **조각을 주울 때마다 `localStorage`에 쓰기.** (`collectShard`, `index.html:352`)
   런 종료 시 일괄 저장으로 바꾸는 게 안전합니다.
2. **메뉴 데모가 블랙홀 등장 지점에서 거의 항상 죽음.**
   25회 시뮬레이션 중 사망 높이 중앙값 14, 11에서 죽은 횟수가 7회였습니다(블랙홀은 idx 12부터).
   `demoPilot()`이 직선 조준만 하고 블랙홀 중력을 계산하지 않기 때문입니다.
   대기 화면 시연이 매번 비슷한 지점에서 끊기므로 데모 품질 개선 여지가 있습니다.
   - 참고: 블랙홀 주위를 무한히 도는 소프트락은 **발생하지 않음**(최장 비행 0.72초, 25회 검증 완료).

### ⚠️ 접근성
3. **오버레이 버튼이 전부 `<div>`** (`.btn`, `.skin`) — `tabindex`·`role`·포커스 스타일이 없어
   키보드만 쓰는 사용자는 스킨 선택과 "메뉴로 돌아가기"를 조작할 수 없습니다.
   (Space/Enter로 게임 시작만 가능)
4. 색상만으로 행성 타입을 구분 — 색각 이상 대응 없음.

### ○ 미구현 기능
5. 일시정지 없음 (탭 전환 시 `dt` 클램프로 버티는 수준)
6. BGM 없음 (효과음만)
7. `maxCombo`·플레이 기록이 저장되지 않음 — 최고 점수 하나만 남음
8. 행성 타입 3종에서 멈춤, 비행 속도 `FLY_SPEED`는 고정(공전 속도만 상승) — 후반 난이도 곡선이 평탄
9. 파비콘 · PWA 매니페스트 · 오프라인 캐시 없음 (예전에 `thumbnail.png`를 만든 흔적이 `.claude/settings.local.json`에 남아 있으나 파일은 없음)
10. 미션 / 일일 챌린지 / 리더보드 없음

## 코드 구조 (`index.html` 내부)

### Loop and state
- **Frame loop:** `requestAnimationFrame` → `update(dt)` → `draw()`, with `dt` clamped to 0.033s.
- **Globals:** all game state is top-level `let` globals, so it can be inspected or driven from the browser console.
- **States** (`state`):
  - `'menu'`: a self-playing demo runs behind the menu. `demoPilot()` auto-launches at the next planet. A demo crash calls `reset()` after 1.2s. The demo makes no sound or vibration and saves nothing.
  - `start()` switches to `'play'`.
  - `die()` switches to `'dead'`.
  - The game-over overlay offers restart, or `goMenu()` to return to the menu.
- **Overlay:** `#overlay` holds both menus. Its class is `menu` or `over`, and it is toggled with `hidden`. `#overlay[hidden]` is needed because `#overlay` sets `display:flex`.
- **Input:** `launch()` doesn't check `state`, so every input handler must check it first. Overlay clicks inside `.shop-wrap` go to `pickSkin()` and don't start the game.

### Coordinates and camera
- World x equals screen x.
- World y scrolls up, and screen y = world y − `camY`.
- The camera eases toward the current planet only while the player is orbiting.

### Player modes (`player.mode`)
- **`'orbit'`:**
  - The player follows `planet.orbit` at `angularSpeed()`. Speed is ×0.55 on `ice` planets.
  - On `lava` planets, `player.lavaT` counts down from `LAVA_TIME`, and reaching 0 calls `die()`.
- **`'fly'`:**
  - Straight-line motion at `FLY_SPEED`, bent only by black holes. The velocity is renormalized, so speed stays constant.
  - `capture()` fires on entering any planet's `orbit` radius, except `from`.
  - Leaving the screen bounds calls `die()`.
- **`'gone'`:** set by `die()`. It hides the ship and guards against dying twice.

### World generation (`addPlanet()`)
- Planets are generated upward on demand. Difficulty scales with `idx`:
  - radius shrinks and vertical gaps grow
  - horizontal oscillation (`amp`) starts after idx 4
  - `type` rolls in: `ice` from idx 3, `lava` from idx 8
- **`holes` (black holes):** a separate array of obstacles that can't be landed on, spawned from idx 12. Their gravity uses `HOLE_PULL / d²` inside `range`, and touching the core kills.
- **`shards`:** placed between planets and next to black holes. A `clear()` check keeps both black holes and shards out of planet orbits.
- **Culling:** planets, holes, and shards far below the camera are removed.

### Scoring
- `height` is the highest planet `idx` reached, and it drives difficulty.
- `score` accumulates: planets advanced × combo multiplier.
### 조각 경제
- 조각은 두 경로로 들어온다: 필드 획득(`collectShard`)과 **판 종료 시 점수 환산**(`die()`).
- 환산식은 `Math.floor(score / SCORE_PER_SHARD)`, `SCORE_PER_SHARD = 10`.
  `score`가 콤보 배율을 이미 반영하므로 잘 친 판이 더 많이 받는다.
- 이 보너스를 넣기 전에는 판당 평균 4개(60판 측정), 조각이 **0개로 끝나는 판도 있었고**
  골드 스킨(✦200)까지 50판이 걸렸다. 지금은 판당 평균 12.2개, 0개로 끝나는 판 0건,
  골드까지 약 16판이다.
- 대기 화면 데모는 조각을 받지 않는다 (`die()`가 `state === 'menu'`에서 먼저 return).
- `runShards` = `fieldShards` + `bonusShards`. 게임 오버 화면이 이 내역을 분리해 보여준다.

- **PERFECT:** the flight line passes within 35% of the orbit radius from the planet center. It is judged in `capture()`.
  - Each PERFECT does `combo++`, and the multiplier is `min(1 + combo, 5)`.
  - A normal landing resets the combo.

### Feedback
- `sfx(name)` synthesizes sounds with Web Audio. There are no audio files.
- `buzz()` uses `navigator.vibrate`.
- 소리(`muted`/`swingStarMuted`)와 진동(`vibeOn`/`swingStarVibe`)은 **완전히 독립**이다.
  조용한 곳에서 소리만 끄고 햅틱은 남기는 경우가 실제로 흔하다.
- 진동 가능 여부는 `hasVibrate()`로 **호출 시점에** 판정한다. 로드 시점 1회 판정으로 캐시하면
  터치 정보가 아직 없는 환경에서 한 번 잘못 잡힌 값이 굳어 진짜 휴대폰에서도 진동이 죽는다.
- 진동 토글 버튼(`#vibe`)은 `touchLike()`가 참일 때만 노출한다. 데스크톱 크롬에도
  `navigator.vibrate`는 존재하지만 아무 일도 하지 않기 때문이다.
  판정은 `(hover: none)` 변화와 첫 터치 입력에서 다시 수행한다(`syncVibeButton()`).
- 둘 다 `state === 'play'` 일 때만 동작한다 (대기 화면 데모는 조용하다).
- `AudioContext` is created in `initAudio()` on a user gesture.

### Skins
- `SKINS` defines each skin's ship color, glow, and `trail(i, alpha)` color function.
- Skins are bought with shards through the menu shop. `renderShop()` re-renders only the shop, so menu animations don't restart.

### Persistence
Everything is saved through `store.get/set` (JSON in `localStorage`, wrapped in try/catch) under these keys:
- `swingStarBest`
- `swingStarShards`
- `swingStarSkins`
- `swingStarSkin`
- `swingStarMuted`
- `swingStarVibe`

## 자동 검사 (훅)

`.claude/settings.json`에 훅 두 개가 걸려 있습니다. 검사 로직은 `.claude/hooks/check-syntax.mjs` 하나이며,
`index.html`의 `<script>` 블록을 뽑아 `node --check`를 돌립니다.

| 시점 | matcher | 동작 |
|---|---|---|
| `PreToolUse` | `Bash` | `git commit` 직전에 검사. 실패하면 exit 2로 **커밋을 차단** |
| `PostToolUse` | `Edit|Write` | `index.html` 편집 직후 검사. 실패하면 exit 2로 즉시 경고 |

`git commit`이 아닌 Bash 호출과 `index.html`이 아닌 파일 편집은 조용히 통과합니다.
오류 행 번호는 `index.html` 기준으로 보정되어 출력됩니다.

**한계:** `node --check`는 **문법만** 검사합니다. 선언되지 않은 변수 참조,
오타 난 함수명 같은 런타임 오류는 잡지 못합니다. 그런 것은 브라우저 콘솔 검증으로만 걸립니다.
훅 설정을 바꾸면 세션을 새로 시작해야 반영됩니다.

수동 실행:
```bash
echo '{"tool_input":{"file_path":"index.html"}}' | node .claude/hooks/check-syntax.mjs post-edit
```

## 변경 검증 방법

문법 검사는 훅이 해주지만 동작 검증은 브라우저 콘솔로 직접 해야 합니다.

1. Browser pane에서 `index.html`을 엽니다.
2. **먼저 `W`/`H`가 0이 아닌지 확인하세요.** 미리보기 창이 스냅샷으로 뜨면 `innerWidth`가 0이라
   모든 시뮬레이션이 1초 만에 사망합니다(게임 버그 아님). `resize_window`로 크기를 준 뒤
   `resize()`를 호출해 `W`/`H`를 다시 잡으세요.
3. 헤드리스 플레이:
   ```js
   state='play'; reset(); state='play';
   let f=0;
   while(state==='play' && f<120*600){ if(player.mode==='orbit') demoPilot(); update(1/120); f++; }
   ({sec:f/120, score, height, maxCombo});
   ```
   정상이면 평균 도달 높이 25~30, 1회 플레이 15~45초 정도가 나옵니다.

기타 팁:
- 특정 메커니즘만 보려면 강제로 만들면 됩니다: `planets[i].type='lava'`, `holes.push(...)`, `shards.push(...)`
- Browser pane은 `data:` URL로 서빙되어 `localStorage`가 막혀 있습니다. `store`가 기본값으로
  폴백하므로 저장은 검증되지 않습니다.
- 실제 브라우저(file:// 또는 호스팅)에서 스크립트로 플레이하면 사용자의 최고 점수·조각·스킨이
  **실제로 덮어써집니다.** `swingStar*` 키를 백업하고 복원하세요.
- 숨겨진 Browser pane은 `requestAnimationFrame`이 스로틀링되고 키 입력도 받지 않으므로
  `update()`를 직접 돌리세요.
