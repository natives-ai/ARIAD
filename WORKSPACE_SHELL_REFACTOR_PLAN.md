# WorkspaceShell 리팩터링 계획

이 문서는 `frontend/src/routes/WorkspaceShell.tsx`의 과도한 길이와 책임 집중 문제를 해결하기 위한 실행 계획입니다.

목표는 단순히 파일을 잘게 나누는 것이 아니라:

- 읽기/리뷰 난이도 낮추기
- 같은 파일 동시 수정 충돌 줄이기
- 캔버스/사이드바/오브젝트 패널/상태 동기화 경계를 명확히 하기
- 현재 진행 중인 major-lane 버그 수정 같은 작업을 더 안전하게 만들기

## 1. 현재 상태

현재 `WorkspaceShell.tsx`는 사실상 여러 화면/상호작용 시스템의 조립자이자 구현체 역할을 동시에 수행합니다.

측정 기준:

- 파일 길이: 약 `5240` lines
- `useState`: `25`
- `useEffect`: `28`
- `useRef`: `14`
- 중첩 함수: `50`

한 파일 안에 다음 책임이 동시에 들어 있습니다.

- 앱 부트스트랩과 persistence/controller 연결
- canvas drag/resize/pan/timeline-end interaction
- episode canvas UI 상태(`timelineEndY`, `nodeSizes`, `laneDividerXs`)와 localStorage/history 복원
- sidebar/folder/episode 목록 렌더링과 조작
- object library / detail panel / menu 상태
- node card 렌더링과 inline editor 동작

즉 현재 문제는 "파일이 길다"가 아니라 "책임 경계가 너무 많다"입니다.

## 2. 현재 구조의 문제점

### 문제 A. 도메인 경계가 파일 내부에서 섞여 있다

현재 같은 컴포넌트 안에:

- `beginTimelineEndDrag`, `beginNodeDrag`, `moveNodeFreely`
- `openObjectDetails`
- `assignEpisodeToFolder`, `toggleFolderCollapsed`
- `renderEpisodeItem`, `renderFolderItem`

같은 서로 다른 성격의 로직이 공존합니다.

이 구조는:

- 코드를 읽을 때 맥락 전환이 잦고
- 수정 범위를 좁히기 어렵고
- 테스트도 통합 테스트에 과하게 의존하게 만듭니다

### 문제 B. 렌더링과 상태 전이가 강하게 결합돼 있다

현재 JSX subtree와 interaction/state helper가 같은 범위 안에 섞여 있어:

- 렌더 변경이 state logic까지 건드리기 쉽고
- bug fix가 구조 변경처럼 번지고
- 리뷰 시 "무엇이 UI 변경이고 무엇이 동작 변경인지" 분리하기 어렵습니다

### 문제 C. effect/state 밀도가 너무 높다

`useEffect 28개`와 다수의 `ref`/`state`가 한 컴포넌트에 몰려 있어:

- lifecycle 추적 비용이 큽니다
- localStorage/history/fullscreen/pointer/global listeners가 얽혀 있습니다
- 작은 회귀도 찾기 어려워집니다

### 문제 D. 이미 일부 분리 모듈이 있는데 orchestration이 여전히 한 파일에 남아 있다

현재도 보조 모듈은 존재합니다.

- `workspaceShell.canvas.ts`
- `workspaceShell.inlineEditor.tsx`
- `workspaceShell.sidebar.tsx`
- `workspaceShell.storage.ts`
- `workspaceShell.types.ts`

하지만 가장 무거운 orchestration은 `WorkspaceShell.tsx`에 남아 있어서 분리 효과가 제한적입니다.

## 3. 리팩터링 원칙

이번 분해는 다음 원칙을 따라야 합니다.

1. 책임 기준으로 자릅니다.
   - JSX 단위가 아니라 도메인 단위로 분리합니다.

2. `WorkspaceShell`은 최종 조립자(composition root)로 줄입니다.
   - 환경 로드, controller 연결, 주요 hook 호출, 상위 레이아웃 조립까지만 남깁니다.

3. 거대한 새 mega-hook 하나로 옮기지 않습니다.
   - `useWorkspaceShellEverything()` 같은 구조는 파일명만 바뀌고 복잡성은 유지됩니다.

4. 현재 동작 의미를 바꾸는 refactor는 지양합니다.
   - 구조 분해와 동작 수정은 가능한 한 분리합니다.

5. 같은 파일을 여러 채팅이 동시에 건드리지 않습니다.
   - `WorkspaceShell.tsx`는 현재 사실상 single-writer 취급이 필요합니다.

## 4. 목표 구조

최종적으로는 아래 같은 구조를 목표로 합니다.

### 4.1 Route shell

- `frontend/src/routes/WorkspaceShell.tsx`

역할:

- 환경 초기화
- persistence/recommendation wiring
- 상위 레벨 데이터 조합
- 하위 feature 컴포넌트 연결

### 4.2 Canvas feature

- `frontend/src/routes/workspace-shell/WorkspaceCanvas.tsx`
- `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`
- `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`
- `frontend/src/routes/workspace-shell/useWorkspaceCanvasInteraction.ts`

역할:

- canvas 렌더링
- node card 렌더링
- drag/resize/pan/timeline-end interaction
- episode-local canvas state/history/localStorage

### 4.3 Sidebar feature

- `frontend/src/routes/workspace-shell/WorkspaceSidebar.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/useWorkspaceSidebar.ts`

역할:

- folder/episode 검색
- pin/collapse/reorder
- rename/create/menu

### 4.4 Object/detail feature

- `frontend/src/routes/workspace-shell/WorkspaceObjectPanel.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/useWorkspaceObjectPanel.ts`

역할:

- object search/sort/menu
- object detail/create panel
- object pin/open actions

## 5. 실행 트랙

### Track 1. 기준선 고정

목표:

- 현재 복잡도와 회귀 경계를 먼저 고정

작업:

- 현재 `WorkspaceShell` 책임을 캔버스 / 사이드바 / 오브젝트 패널 / bootstrap으로 분류
- 현재 테스트 게이트 재확인
- active bug work와 충돌하는 동일 파일 범위 표시

완료 기준:

- 분해 순서와 파일 ownership이 명확해짐

### Track 2. JSX subtree 분리

목표:

- 가장 위험이 낮은 UI subtree부터 분리

권장 순서:

1. `renderEpisodeItem` / `renderFolderItem`를 `WorkspaceSidebar.tsx`로 이동
2. object panel / detail panel subtree를 `WorkspaceObjectPanel.tsx`로 이동
3. node card 렌더링 블록을 `CanvasNodeCard.tsx`로 이동

주의:

- 이 단계에서는 상태의 소유권을 크게 바꾸지 않습니다
- 우선 props drilling이 다소 늘어나도 허용합니다

완료 기준:

- `WorkspaceShell.tsx`에서 대형 render helper가 제거됨

### Track 3. episode canvas state 분리

목표:

- canvas 전용 UI 상태를 route shell에서 떼어냄

대상 상태:

- `timelineEndY`
- `nodeSizes`
- `laneDividerXs`
- episode canvas history/localStorage 복원

권장 파일:

- `useEpisodeCanvasState.ts`

핵심 작업:

- episode별 canvas state의 초기화/저장/복원을 hook으로 이동
- canvas history signature와 restore 로직도 함께 이동

완료 기준:

- `WorkspaceShell`에서 canvas persistence/state effect 수가 눈에 띄게 감소

### Track 4. canvas interaction 분리

목표:

- pointer 기반 상호작용과 drag/resize/timeline-end 로직을 분리

권장 파일:

- `useWorkspaceCanvasInteraction.ts`

대상 함수:

- `beginNodeDrag`
- `beginNodeResize`
- `beginTimelineEndDrag`
- `beginCanvasPan`
- `handleCanvasStageDrop`
- `moveNodeFreely`
- preview/update helper

주의:

- 현재 major-lane 버그와 직접 맞닿아 있는 영역입니다
- 이 단계는 active bug fix와 같은 사람이 같은 흐름으로 처리하는 것이 안전합니다

완료 기준:

- `WorkspaceShell.tsx`에서 pointer/global listener effect와 drag helper가 제거됨

### Track 5. route shell 슬림화

목표:

- `WorkspaceShell`을 composition root 수준으로 축소

남겨둘 것:

- env/controller/recommendation wiring
- 상위 데이터 선택
- high-level feature 연결

제거 대상:

- 세부 렌더 helper
- canvas interaction 구현
- sidebar/object detail 내부 동작

완료 기준:

- `WorkspaceShell.tsx`가 상위 조립자 역할만 수행

### Track 6. 테스트 분할

목표:

- 대형 통합 테스트 의존도를 줄이고 feature 단위 회귀를 강화

권장 대상:

- `WorkspaceSidebar.test.tsx`
- `WorkspaceCanvas.test.tsx`
- `CanvasNodeCard.test.tsx`
- 기존 `WorkspaceShell.test.tsx`는 route integration smoke 중심으로 축소

완료 기준:

- 기능별 회귀를 더 좁은 파일 단위로 검증 가능

## 6. 권장 실행 순서

추천 순서는 다음입니다.

1. Track 1
2. Track 2
3. Track 3
4. Track 4
5. Track 5
6. Track 6

특히 현재 major-lane interaction 수정이 진행 중이라면:

- 먼저 major-lane bug를 잡거나
- 아니면 Track 4를 그 버그 수정과 함께 같은 작업 스트림에서 처리하는 편이 안전합니다

반대로 Track 2와 Track 3은 상대적으로 독립적이라 먼저 시작하기 좋습니다.

## 7. 테스트 게이트

각 단계 후 최소 다음 검증이 필요합니다.

- `corepack yarn --cwd frontend typecheck`
- 변경 파일 대상 eslint
- 관련 feature 테스트

예상 테스트:

- `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`
- `corepack yarn --cwd frontend test -- src/routes/workspace-shell/workspaceShell.layout.test.ts`
- sidebar/object panel 분리 후 해당 feature 테스트 추가

## 8. 중단 조건

다음 경우에는 구조 분해를 멈추고 재평가해야 합니다.

- refactor 중 동작 수정이 과도하게 섞이기 시작하는 경우
- major-lane bug fix와 충돌해 같은 파일 변경이 반복 충돌하는 경우
- feature 경계보다 props threading만 과하게 늘어나는 경우
- mega-hook 하나로 복잡성이 이동만 하는 경우

## 9. 지금 시점의 결론

현재 `WorkspaceShell.tsx`는 단순한 "긴 파일"이 아니라, route shell / canvas / sidebar / object panel / episode-local UI persistence가 한 곳에 중첩된 상태입니다.

따라서 가장 현실적인 해법은:

1. render subtree를 먼저 분리하고
2. canvas state를 hook으로 옮기고
3. canvas interaction을 별도 hook으로 분리한 뒤
4. `WorkspaceShell`을 composition root로 축소하는 것

이 순서가 현재 기능 리스크를 가장 낮추면서도 가독성과 유지보수성을 같이 개선하는 방향입니다.
