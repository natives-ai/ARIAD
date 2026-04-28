# DETAILPLAN

이 파일은 `PLANS.md`와 별도로 유지하는 상세 실행 계획 모음입니다.

운영 기준:

- `PLANS.md`는 기존 work-loop 로그 형식을 유지합니다
- 자세한 설계/실행 계획은 이 파일 아래 섹션으로 누적합니다
- 새 상세 계획이 필요하면 새 파일을 만들기보다 이 파일에 주제 섹션을 추가하는 것을 기본으로 합니다
- 상세 계획 인덱스는 `detail-001`, `detail-002`처럼 고정 ID를 부여합니다
- 새 상세 계획은 마지막 인덱스 다음 번호를 이어서 사용합니다

---

## detail-001 / WorkspaceShell 리팩터링 계획

### 1.1 목적

`frontend/src/routes/WorkspaceShell.tsx`의 과도한 길이와 책임 집중 문제를 줄입니다.

핵심 목표:

- 읽기/리뷰 난이도 낮추기
- 같은 파일 동시 수정 충돌 줄이기
- 캔버스/사이드바/오브젝트 패널/상태 동기화 경계를 명확히 하기
- major-lane 버그 수정 같은 작업을 더 안전하게 만들기

### 1.2 현재 상태

- 파일 길이: 약 `5240` lines
- `useState`: `25`
- `useEffect`: `28`
- `useRef`: `14`
- 중첩 함수: `50`

현재 한 파일 안에 다음 책임이 동시에 들어 있습니다.

- 앱 부트스트랩과 persistence/controller 연결
- canvas drag/resize/pan/timeline-end interaction
- episode canvas UI 상태(`timelineEndY`, `nodeSizes`, `laneDividerXs`)와 localStorage/history 복원
- sidebar/folder/episode 목록 렌더링과 조작
- object library / detail panel / menu 상태
- node card 렌더링과 inline editor 동작

즉 문제는 단순한 파일 길이가 아니라 책임 과밀입니다.

### 1.3 리팩터링 원칙

1. JSX가 아니라 책임 기준으로 분리합니다.
2. `WorkspaceShell`은 최종 조립자(composition root)로 줄입니다.
3. `useWorkspaceShellEverything()` 같은 mega-hook은 만들지 않습니다.
4. 구조 분해와 동작 수정은 가능한 한 분리합니다.
5. `WorkspaceShell.tsx`는 same-file 충돌 위험이 커서 사실상 single-writer로 다룹니다.

### 1.4 목표 구조

#### Route shell

- `frontend/src/routes/WorkspaceShell.tsx`

역할:

- 환경 초기화
- persistence/recommendation wiring
- 상위 데이터 조합
- 하위 feature 연결

#### Canvas feature

- `frontend/src/routes/workspace-shell/WorkspaceCanvas.tsx`
- `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`
- `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`
- `frontend/src/routes/workspace-shell/useWorkspaceCanvasInteraction.ts`

역할:

- canvas 렌더링
- node card 렌더링
- drag/resize/pan/timeline-end interaction
- episode-local canvas state/history/localStorage

#### Sidebar feature

- `frontend/src/routes/workspace-shell/WorkspaceSidebar.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/useWorkspaceSidebar.ts`

#### Object/detail feature

- `frontend/src/routes/workspace-shell/WorkspaceObjectPanel.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/useWorkspaceObjectPanel.ts`

### 1.5 실행 트랙

#### Track 1. 기준선 고정

- 현재 `WorkspaceShell` 책임을 캔버스 / 사이드바 / 오브젝트 패널 / bootstrap으로 분류
- 현재 테스트 게이트 재확인
- active bug work와 충돌하는 동일 파일 범위 표시

#### Track 2. JSX subtree 분리

권장 순서:

1. `renderEpisodeItem` / `renderFolderItem`를 `WorkspaceSidebar.tsx`로 이동
2. object panel / detail panel subtree를 `WorkspaceObjectPanel.tsx`로 이동
3. node card 렌더링 블록을 `CanvasNodeCard.tsx`로 이동

주의:

- 이 단계에서는 상태 소유권을 크게 바꾸지 않습니다
- props drilling이 다소 늘어나도 허용합니다

#### Track 3. episode canvas state 분리

대상 상태:

- `timelineEndY`
- `nodeSizes`
- `laneDividerXs`
- episode canvas history/localStorage 복원

권장 파일:

- `useEpisodeCanvasState.ts`

#### Track 4. canvas interaction 분리

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

- major-lane 버그와 직접 맞닿아 있는 영역이므로 같은 작업 스트림에서 처리하는 편이 안전합니다

#### Track 5. route shell 슬림화

남겨둘 것:

- env/controller/recommendation wiring
- 상위 데이터 선택
- high-level feature 연결

#### Track 6. 테스트 분할

권장 대상:

- `WorkspaceSidebar.test.tsx`
- `WorkspaceCanvas.test.tsx`
- `CanvasNodeCard.test.tsx`
- `WorkspaceShell.test.tsx`는 route integration smoke 중심으로 축소

### 1.6 권장 순서

1. Track 1
2. Track 2
3. Track 3
4. Track 4
5. Track 5
6. Track 6

현재처럼 major-lane interaction 수정이 병행되는 경우:

- 먼저 bugfix를 마치거나
- Track 4를 그 bugfix와 함께 처리하는 편이 안전합니다

### 1.7 테스트 게이트

- `corepack yarn --cwd frontend typecheck`
- 변경 파일 대상 eslint
- 관련 feature 테스트

예상 테스트:

- `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`
- `corepack yarn --cwd frontend test -- src/routes/workspace-shell/workspaceShell.layout.test.ts`

### 1.8 중단 조건

- refactor 중 동작 수정이 과도하게 섞이는 경우
- major-lane bug fix와 충돌해 같은 파일 변경이 반복 충돌하는 경우
- props threading만 과하게 늘어나는 경우
- 복잡성이 mega-hook 하나로 이동만 하는 경우

---

## detail-002 / Major Lane Swap 대응 메모

### 2.1 대상 증상

- 큰 major 노드를 작은 마지막 major 노드 자리로 보내려 할 때 잘 안 바뀜
- 마지막 노드와 바꾸는 과정에서 메인 타임라인 화살표가 같이 늘어남

현재는 `WorkspaceShell` 리팩터링이 진행 중이므로 바로 구현하지 않고, 재개 기준만 기록합니다.

### 2.2 현재 판단

가능성이 높은 원인은 두 가지입니다.

1. major reorder 기준이 큰 노드 높이를 충분히 반영하지 못함
   - 현재는 사실상 중심점/배치 기준으로 마지막 노드와의 교체를 판단하는데
   - 큰 노드는 카드 높이 때문에 사용자가 느끼는 “아래로 충분히 보냈다”와 내부 reorder 기준이 어긋날 수 있습니다

2. end major node를 움직일 때 timeline end 보정이 너무 적극적으로 따라감
   - 마지막 노드 후보를 아래로 보내는 순간
   - reorder보다 먼저 `timelineEndY`가 확장되어
   - 사용자가 의도한 “자리 교체”가 아니라 “타임라인 연장”처럼 보일 수 있습니다

### 2.3 대충 해결 방향

#### 방향 A. major reorder 기준 재검토

- 마지막 노드 교체 판정을 단순 center Y보다 더 직관적인 기준으로 바꿀지 검토
- 후보:
  - dragged node top/bottom과 대상 node의 top/bottom 비교
  - 큰 노드와 작은 노드 교체 시 end-node 전용 threshold 완화

#### 방향 B. end-node 교체 시 timeline 확장 억제

- 단순 reorder 의도인 경우에는 `timelineEndY`를 바로 늘리지 않도록 조정
- 특히 “현재 end node와 자리만 바꾸는” 상황에서는:
  - 먼저 reorder 확정
  - 그 다음 최종 end node에 맞춰 timeline을 재계산

#### 방향 C. 회귀 테스트 추가

- 큰 middle major를 키운 뒤 작은 end major 아래로 드래그

기대 결과:

- 큰 노드가 마지막 노드로 reorder됨
- 불필요한 timeline extension이 생기지 않음
- 최종 end marker와 timeline end가 같은 노드를 가리킴

### 2.4 작업 순서

1. 현재 리팩터링 브랜치/워크트리 안정화
2. `WorkspaceShell.test.tsx`에 재현 케이스 추가
3. `moveNodeFreely(...)`의 major reorder 계산과 `timelineEndY` 보정 순서 조정
4. end-node swap 전용 회귀 확인

### 2.5 주의사항

- 이 수정은 `WorkspaceShell.tsx`를 직접 건드리므로 same-file 충돌 위험이 큽니다
- 현재 진행 중인 리팩터링과 동시에 하지 말고, 한 작업 스트림에서 순차 처리하는 편이 안전합니다

---

## 운영 메모

앞으로 상세 계획은 가능하면 이 파일에 다음 형식으로 추가합니다.

- 새 주제는 `## detail-xxx / 주제명`
- 상태/원인/실행 트랙/테스트 게이트를 같은 패턴으로 유지
- `PLANS.md`에는 해당 상세 계획을 갱신했다는 짧은 work-loop 로그만 남김

---

## detail-005 / Rewire Commit Persistence 후속 대응

### 5.1 대상 증상

- 연결 화살표를 다른 노드로 옮길 때는 정상적으로 연결된 것처럼 보임
- 그런데 그 뒤 해당 노드를 다시 움직이면 연결이 원래 부모 쪽으로 돌아간 것처럼 보임

### 5.2 현재 확인된 사실

현재 프런트 코드상 이 현상은 충분히 재현 가능한 구조입니다.

#### `rewireNode(...)`는 parentId만 변경

`frontend/src/persistence/controller.ts`의 `rewireNode(...)`는 현재:

- target node의 `parentId`
- `updatedAt`

만 바꿉니다.

즉 연결 변경 자체는 로컬 상태에 반영됩니다.

#### 그러나 `moveNode(...)`가 root node의 parentId를 다시 추론해 덮어쓴다

같은 파일의 `moveNode(...)`는 subtree 이동 시:

- `inferParentId(...)`로 새 부모를 다시 계산하고
- moved subtree의 root node에 그 `parentId`를 다시 씁니다

즉:

1. 사용자가 rewire로 새 parent를 정함
2. 그 뒤 노드를 drag/move 함
3. `moveNode(...)`가 현재 order/level만 보고 parent를 다시 추론
4. 방금 rewire한 parent가 덮어써질 수 있음

이 구조는 사용자 체감인:

- “화살표 옮긴 게 반영된 것처럼 보였는데”
- “노드를 움직이니 다시 원래로 돌아간다”

를 거의 그대로 설명합니다.

### 5.3 현재 테스트 공백

현재 확인한 범위에서:

- controller 단위 rewire 테스트는 있음
- 하지만 “rewire 후 moveNode를 하면 parentId가 유지되는지” 테스트는 없음
- `WorkspaceShell.test.tsx`에도 route-level rewire -> move 회귀는 없음

즉 이 문제는 rewire 자체 테스트로는 못 잡고, rewire 이후 drag까지 포함한 회귀가 필요합니다.

### 5.4 대응 방향

#### 방향 A. moveNode가 rewire 의도를 무조건 덮어쓰지 않게 조정

가능한 접근은 두 가지입니다.

1. `moveNode(...)`가 기존 explicit parent를 존중하도록 변경
   - 특히 same-level reorder/free move일 뿐이면 기존 `parentId` 유지

2. rewire와 reorder의 authority를 분리
   - parent 변경은 `rewireNode`
   - 순서 변경은 `moveNode`
   - 두 연산이 서로의 결과를 임의로 덮어쓰지 않게 함

현재 증상 기준으로는 2번이 더 바람직합니다.

#### 방향 B. route-level drag와 rewire semantics를 분리해서 검증

- rewire 이후 위치 이동이 단순 free move인지
- reorder intent인지
- parent 재계산이 필요한 이동인지

이 구분이 필요합니다.

특히 같은 레벨 안에서 단순히 위치만 옮기는 경우까지 parent를 다시 추론하면 안 됩니다.

### 5.5 실행 순서

1. controller 단위로 “rewire 후 moveNode parent 유지” 회귀 추가
2. `WorkspaceShell` route 단위로 “rewire 후 드래그해도 연결 유지” 회귀 추가
3. `moveNode(...)`의 parent overwrite 조건을 좁히거나 제거
4. authenticated/local 양쪽에서 parent 유지가 같은지 재검증

### 5.6 테스트 게이트

- `corepack yarn --cwd frontend test -- src/persistence/controller.test.ts`
- `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`
- `corepack yarn --cwd frontend typecheck`
- 변경 파일 대상 eslint

필수 회귀:

- rewire 후 moveNode를 해도 root node `parentId` 유지
- route에서 connection rewire 후 node drag를 해도 화살표가 새 parent를 계속 가리킴

### 5.7 주의사항

- 이 작업은 `controller.ts`와 `WorkspaceShell.tsx`를 둘 다 건드릴 가능성이 큽니다
- 현재 drag/timeline/major-lane 수정도 같은 흐름에 걸쳐 있으므로, parent inference 수정이 다른 reorder 동작을 깨지 않도록 범위를 좁혀야 합니다

---

## detail-006 / Refresh Re-layout and Canonical Restore 대응

### 6.1 대상 증상

- 실제로 노드 위치나 연결을 옮긴 뒤에는 원하는 것처럼 보임
- 그런데 새로고침하면 배치가 다시 정렬되거나 재배치된 것처럼 느껴짐
- 특히 drag/reorder/rewire 이후에 refresh하면 “방금 보던 레이아웃”이 그대로 복원되지 않는 체감이 있음

### 6.2 현재 확인된 사실

#### 프런트 로드 경로

`WorkspacePersistenceController.initialize()`는:

1. 먼저 local snapshot을 로드하거나 seed
2. 인증 상태면 `connectAuthenticatedSession(...)`으로 remote snapshot을 다시 가져옴
3. 가져온 remote snapshot으로 현재 state를 교체
4. 그 뒤 `flushNow()`로 pending sync를 재전송

즉 authenticated mode에서는 refresh 시 “직전에 보던 로컬 state”가 최종 truth가 아니라, remote canonical snapshot이 다시 state를 덮어쓸 수 있습니다.

#### 백엔드 canonicalization

backend persistence는 refresh/재로드 시:

- `canonicalizeNodeOrderByEpisode(...)`
- `validateNodeGraphIntegrity(...)`

를 적용합니다.

즉 order/parent graph가 ambiguous하면, 다시 불러올 때 episode 단위 canonical order로 정리됩니다.

#### 프런트 렌더는 저장 좌표만 그대로 보여주지 않는다

`WorkspaceShell` 렌더 시 노드 배치는:

- persisted `canvasX/canvasY`
- major snap/anchor
- overlap resolution
- lane reflow
- 현재 `nodeSizes`
- 현재 `timelineEndY`

를 합쳐 다시 계산합니다.

즉 refresh 후 화면은 “저장된 snapshot을 그대로 찍은 결과”가 아니라, 저장된 snapshot 위에 현재 프런트 layout 규칙을 다시 적용한 결과입니다.

#### 일부 캔버스 UI 상태는 snapshot canonical state가 아니다

현재 구조에서:

- `nodeSizes`는 localStorage에 저장
- `timelineEndY`와 lane-divider/history 복원은 episode canvas UI state로 관리
- undo/redo history는 메모리 기반 signature restore를 사용

즉 refresh 이후에는:

- snapshot state
- localStorage 기반 node size
- 초기화된 canvas UI state

가 다시 합쳐지므로, 사용자가 방금 보던 live layout과 다를 수 있습니다.

### 6.3 가능성이 높은 원인

#### 원인 A. 프런트 live layout와 persisted canonical snapshot이 다르다

사용자가 보고 있는 위치는 다음이 섞여 있습니다.

- drag preview / resolved placement
- reflow 이후 위치
- local UI-only state

하지만 refresh 후에는 persisted snapshot과 로컬 UI 상태만으로 다시 조립됩니다.

그래서 “이동 직후 보이던 상태”와 “refresh 후 보이는 상태”가 달라질 수 있습니다.

#### 원인 B. authenticated mode에서 remote canonical snapshot이 local state를 다시 덮어쓴다

local mutation이 pending 상태거나, backend가 order를 다시 정규화하면:

- refresh 직후 remote snapshot이 다시 들어오고
- 이후 pending sync가 적용되더라도
- 최종 배치가 사용자가 직전에 본 local arrangement와 다를 수 있습니다

#### 원인 C. canvas UI state가 canonical snapshot에 포함되지 않는다

현재 exact canvas presentation 중 일부는 backend에 저장되지 않습니다.

대표적으로:

- `timelineEndY`
- lane divider positions
- `nodeSizes`(로컬 전용)

이들은 snapshot canonical state가 아니라 프런트/UI state입니다.

따라서 refresh/cross-device 복원에서 exact layout을 보장하지 못합니다.

### 6.4 해결 방향

#### 방향 A. exact layout를 어디까지 canonical로 볼지 먼저 결정

이건 제품 규칙의 문제입니다.

선택지는 두 가지입니다.

1. exact canvas presentation을 canonical로 본다
   - refresh 후에도 최대한 동일해야 함
   - backend/shared contract에 UI layout state 일부를 포함해야 함

2. canonical은 story structure만 본다
   - order/parent/canvas position만 canonical
   - 나머지 UI state는 프런트가 deterministic하게 재계산해야 함

현재 사용자 체감상은 1번 기대에 더 가깝습니다.

#### 방향 B. 프런트는 preview state와 committed state를 더 엄격히 분리

프런트가 처리해야 할 핵심:

- 사용자가 “옮겼다”고 본 최종 상태와 실제 persisted snapshot이 일치하도록 만들기
- reflow/anchor/overlap resolution이 commit 후 snapshot에도 반영되게 할지 정리
- refresh 시 local UI state restore 순서를 snapshot restore와 맞추기

#### 방향 C. 백엔드는 canonicalization 범위를 명시적으로 제한 또는 확장

백엔드가 처리해야 할 핵심:

- order/parent canonicalization은 유지하되, position/UI state를 건드리지 않는다는 계약을 명확히 하기
- 만약 exact layout를 보존해야 한다면 shared contract와 persistence schema에 layout state를 포함하기

### 6.5 프런트에서 처리해야 할 부분

#### Frontend owner

1. refresh 전후에 사용자가 본 최종 placement와 persisted `canvasX/canvasY`가 일치하는지 검증
2. preview/reflow/anchor 결과 중 무엇을 실제 저장할지 명확히 정리
3. `timelineEndY`, lane divider, `nodeSizes` 중 refresh 복원에 필요한 상태를 어떤 순서로 restore할지 재설계
4. route-level refresh simulation 테스트 추가

권장 파일:

- `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`
- 필요 시 `frontend/src/persistence/controller.ts`

### 6.6 백엔드에서 처리해야 할 부분

#### Backend owner

1. canonical snapshot에서 보존해야 하는 필드 범위 재확정
2. exact canvas UI state까지 보존할지 여부 결정
3. 보존 대상이면 shared contract + persistence layer 확장
4. canonicalization이 `orderIndex/parent` 외 필드에는 영향을 주지 않는다는 회귀 보강

권장 파일:

- `shared/src/contracts/*`
- `shared/src/types/*`
- `backend/src/persistence/store.ts`
- `backend/src/persistence/mysql-store.ts`
- `backend/src/persistence/node-order.ts`

### 6.7 실행 순서

1. 현재 refresh 후 달라지는 항목을 분류
   - order
   - parent
   - `canvasX/canvasY`
   - `timelineEndY`
   - `nodeSizes`
2. 프런트에서 refresh simulation 회귀 추가
3. exact layout canonical 범위에 대한 판단
4. 프런트-only로 해결 가능한 항목부터 수정
5. 필요하면 shared/backend contract 확장

### 6.8 테스트 게이트

#### Frontend

- `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`
- `corepack yarn --cwd frontend test -- src/persistence/controller.test.ts`
- `corepack yarn --cwd frontend typecheck`

#### Backend

- `corepack yarn --cwd backend integration`
- `corepack yarn --cwd backend typecheck`

필수 회귀:

- move/rewire/reorder 후 refresh해도 expected canonical state가 유지
- authenticated mode에서 remote recovery 후에도 unexpected re-layout이 생기지 않음
- backend canonicalization이 의도하지 않은 position reset을 만들지 않음

### 6.9 주의사항

- 이 이슈는 순수 프런트 버그로 끝날 수도 있지만, “refresh 후 exact same canvas”를 기대한다면 shared/backend contract 문제로 넘어갑니다
- 즉 먼저 제품 기준을 정해야 합니다:
  - exact canvas persistence가 목표인지
  - structure-first canonical restore가 목표인지

---

## detail-004 / Connection Anchor Side Alignment 대응

### 4.1 대상 요구사항

레인 간 노드 연결선은:

- 시작점이 source node의 오른쪽 측면
- 끝점이 target node의 왼쪽 측면

에 붙어야 합니다.

사용자 기대는 “노드 중심끼리 잇는 곡선”이 아니라, 좌우 측면 포트에서 시작/종료하는 directional connection입니다.

### 4.2 현재 확인된 사실

현재 구현은 요구사항과 다릅니다.

#### 실제 연결선 계산

`workspaceShell.canvas.ts`의 `buildConnectionLines(...)`는 현재:

- `startX = parentPlacement.x + parentSize.width / 2`
- `endX = childPlacement.x + childSize.width / 2`
- `startY = parentPlacement.y + parentSize.height / 2`
- `endY = childPlacement.y + childSize.height / 2`

를 사용합니다.

즉 시작점/끝점 모두 노드의 정중앙입니다.

#### rewire preview도 동일

`WorkspaceShell.tsx`의 `rewirePreviewLine`도 현재:

- hovered target 중심점
- source node 중심점

을 사용합니다.

즉 실제 연결선과 rewire preview가 모두 “중심점 -> 중심점” 규칙을 따릅니다.

#### connection port 버튼도 같은 좌표 사용

렌더링되는 `connection-port` 버튼 역시 `line.startX`, `line.startY`, `line.endX`, `line.endY`를 그대로 사용하므로, 포트 시각 위치도 현재는 측면이 아니라 중심점에 맞춰집니다.

### 4.3 문제점

이 구조의 문제는 다음과 같습니다.

1. 레인 간 directional flow가 덜 명확합니다.
   - 오른쪽에서 나가고 왼쪽으로 들어오는 구조가 아니어서 정보 흐름 방향이 약하게 보입니다.

2. 선이 노드 본문을 관통하는 느낌이 생깁니다.
   - 카드 중심에서 시작/종료하기 때문에 시각적으로 덜 정돈됩니다.

3. rewire preview와 실제 렌더가 도메인 의도와 어긋납니다.
   - 사용자는 측면 포트를 기대하는데, preview도 center 기준입니다.

### 4.4 대응 방향

#### 방향 A. 연결 anchor 계산을 side-based로 전환

기본 규칙:

- source anchor:
  - `x = sourcePlacement.x + sourceWidth`
  - `y = sourcePlacement.y + sourceHeight / 2`
- target anchor:
  - `x = targetPlacement.x`
  - `y = targetPlacement.y + targetHeight / 2`

즉 오른쪽 중앙 -> 왼쪽 중앙을 기본 anchor로 사용합니다.

#### 방향 B. rewire preview도 같은 anchor 규칙으로 통일

- hovered target이 있으면 target left-center를 사용
- source node는 right-center를 사용
- hovered target이 없을 때만 free pointer 좌표를 fallback으로 사용

이렇게 해야 preview와 committed line의 시각 규칙이 일치합니다.

#### 방향 C. connection-port 위치도 함께 side-based로 이동

현재 port 버튼이 line 좌표를 그대로 사용하므로,

- line path anchor가 바뀌면
- port 버튼도 side-based 위치로 함께 이동해야 합니다.

### 4.5 실행 순서

1. `buildConnectionLines(...)`의 anchor 계산을 side-based로 변경
2. `rewirePreviewLine`도 같은 규칙으로 맞춤
3. `connection-port` 버튼 위치가 새 anchor와 맞는지 확인
4. 곡선 bend distance가 side anchor 기준에서도 자연스러운지 미세조정

### 4.6 테스트 게이트

- `corepack yarn --cwd frontend typecheck`
- 변경 파일 대상 eslint
- 가능하면 connection geometry 회귀 추가

권장 회귀:

- parent-child line의 시작점이 parent right edge에 위치
- 끝점이 child left edge에 위치
- rewire preview도 동일한 방향 anchor 사용

### 4.7 주의사항

- 이 작업은 geometry 규칙 변경이라 시각적 차이가 큽니다
- 현재 major drag/timeline 관련 수정과 파일이 일부 겹치지 않지만, `WorkspaceShell.tsx`의 rewire preview는 직접 건드려야 하므로 같은 시기 충돌 가능성은 여전히 있습니다

---

## detail-003 / Major Drag Preview-End Coupling 후속 대응

### 3.1 대상 증상

- 중간에 있는 major 노드를 위로 끌어올리면 마지막 노드가 딸려오는 것처럼 보임
- 큰 major 노드와 마지막 작은 major 노드의 swap 자체는 되지만, 메인 타임라인 화살표 길이가 여전히 늘어남

### 3.2 현재 확인된 사실

현재 프런트 route 회귀에서 이미 관련 실패가 보입니다.

- `keeps timeline end stable when dragging a non-end major node`
- `allows dragging a lower major node above the first major node`

즉 이번 증상은 체감 이슈를 넘어서 현재 자동 테스트 기준에서도 major drag 회귀로 봐야 합니다.

### 3.3 가능성이 높은 원인

#### 원인 A. major drag preview가 비-end major에도 timeline end 기준을 과하게 끌어다 쓴다

현재 드래그 미리보기 경로에서는 major 드래그일 때:

- `projectedPointerNodeBottomY`를 먼저 만들고
- 그 값을 기반으로 `majorDragAnchors`를 계산한 뒤
- preview placement를 snap 합니다

즉 end node가 아닌 major를 끌 때도 preview anchor가 사실상 dragged node bottom에 끌려갑니다.

이 구조는:

- 중간 노드를 위로 옮길 때도
- preview 단계에서 timeline end semantics가 같이 흔들리게 만들 수 있습니다

#### 원인 B. preview/commit 시점의 "will become end" 판정이 현재 배치와 reorder 이후 배치를 섞어 본다

현재 major commit 경로는:

- `targetInsertIndex`
- `willNodeBecomeEnd`
- `getProjectedLowestNodeBottom(...)`

를 조합해 `timelineEndY`를 다시 계산합니다.

문제는 이 계산이 reorder 적용 전의 현재 배치들을 함께 보면서:

- 드래그된 노드는 새 위치 override로 보고
- 기존 end node는 아직 현재 위치 그대로 본 상태에서
- 다음 timeline end를 확정할 수 있다는 점입니다

이 경우:

- 실제로는 단순 swap이면 충분한 상황에서도
- old end node + dragged node가 동시에 하단 후보로 보이면서
- timeline end가 과하게 늘어날 수 있습니다

#### 원인 C. major reorder 기준 보정이 아직 upward drag에는 충분하지 않다

`detail-002`에서 size-aware insert path를 추가했지만,

- 아래로 보내는 큰 노드 swap은 일부 개선됐어도
- 위로 끌어올리는 non-end major reorder는 여전히 기존 center/top 기준과 충돌할 수 있습니다

그래서 현재 upward drag 회귀도 함께 깨진 상태로 보입니다.

### 3.4 대응 방향

#### 방향 A. preview 단계에서 end-node 전용 anchor와 일반 major drag anchor를 분리

- end major node를 직접 끄는 경우에만 timeline-end-follow preview를 사용
- 일반 major drag는 현재 timeline end를 유지한 채 reorder preview만 계산

핵심 목표:

- 중간 노드를 움직일 때 마지막 노드가 “딸려오는” 체감을 제거

#### 방향 B. commit 단계에서 timeline end 재계산을 reorder 적용 후 기준으로 재정렬

- `willNodeBecomeEnd` 판정만으로 미리 timeline을 늘리지 말고
- reorder가 반영된 최종 end node 후보 집합을 기준으로 다시 계산

실무적으로는 다음 둘 중 하나를 검토합니다.

1. reorder commit 후 최종 end node의 bottom으로 timeline end를 재계산
2. swap 성격의 이동에서는 기존 `timelineEndY`를 우선 유지하고, 실제 하단 초과가 있을 때만 확장

#### 방향 C. upward major reorder 회귀를 별도 케이스로 고정

- lower major -> first major
- middle major -> above first major
- non-end major upward drag 시 timeline end unchanged

이 세 축을 별도 회귀로 묶어야 합니다.

### 3.5 실행 순서

1. 현재 깨지는 route 테스트 2건을 기준선으로 고정
2. preview 단계에서 non-end major drag의 timeline coupling 제거
3. commit 단계의 `timelineEndY` 재계산을 reorder 이후 기준으로 정리
4. swap 시 arrow length 유지 규칙을 추가
5. upward/downward/end-swap 회귀를 다시 통과시키기

### 3.6 테스트 게이트

- `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`
- `corepack yarn --cwd frontend typecheck`
- 변경 파일 대상 eslint

필수 회귀:

- `keeps timeline end stable when dragging a non-end major node`
- `allows dragging a lower major node above the first major node`
- 큰 major와 작은 end major swap 후 timeline extension이 생기지 않는 신규 회귀

### 3.7 주의사항

- 이 작업은 `WorkspaceShell.tsx`의 drag preview와 commit semantics를 직접 건드립니다
- `detail-001`의 리팩터링 Track 4와 맞닿아 있으므로, 같은 작업 스트림에서 처리하는 편이 안전합니다
- 미리보기 단계와 커밋 단계에서 서로 다른 규칙을 남겨두면 같은 증상이 다른 형태로 다시 나타날 가능성이 높습니다

---

## detail-007 / Major Timeline End Drift 후속 대응

### 7.1 대상 증상

- Major Event Lane의 메인 화살표 끝이 마지막 major 노드의 bottom과 간헐적으로 맞지 않음
- 특히 major reorder나 swap 이후 마지막 노드는 이미 위로 올라갔는데, 메인 화살표만 더 길게 남는 체감이 있음

### 7.2 현재 확인된 사실

- 현재 메인 화살표와 end-handle은 `effectiveTimelineEndY = Math.max(timelineEndY, lowestNodeBottom)` 기준으로 렌더됩니다
- 반면 `timelineEndY`는 episode canvas UI state로 따로 저장/복원됩니다
- major 이동 커밋 경로에서는 `willNodeBecomeEnd`일 때만 `setTimelineEndY(...)`를 다시 계산합니다
- 즉 major reorder 후 실제 마지막 노드가 바뀌었거나 아래쪽 높이가 줄어든 경우에도 `timelineEndY`가 그대로 남을 수 있습니다
- 현재 route 테스트는 증상 검증 전 단계에서 `WorkspaceShell.test.tsx` 문법 에러로 막혀 있어, 자동 회귀는 먼저 복구가 필요합니다

### 7.3 가능성이 높은 원인

#### 원인 A. major reorder 이후 `timelineEndY`를 항상 정규화하지 않는다

현재 `moveNodeFreely(...)`의 major 분기에서는:

- dragged node가 최종 end node가 되는 경우에만 `setTimelineEndY(...)`를 호출하고
- 그렇지 않으면 기존 `timelineEndY`를 그대로 둡니다

이 구조에서는:

- 기존 end node를 위로 옮기거나
- swap 이후 마지막 노드 높이가 더 작아지거나
- non-end major reorder가 전체 하단 높이를 줄인 경우에도

메인 화살표 길이가 이전 값으로 남을 수 있습니다

#### 원인 B. persisted `timelineEndY`가 실측 end-node bottom보다 더 강하게 남는다

`useEpisodeCanvasState`는 `timelineEndY`를 episode UI state로 localStorage에 저장합니다.

이 자체는 필요하지만, 현재는:

- 어떤 값이 사용자 의도에 의해 늘어난 end 값인지
- 어떤 값이 이전 drag/reorder의 임시 부산물인지

를 구분하지 않습니다.

그래서 stale한 `timelineEndY`가 다시 복원되면, 마지막 노드 bottom과 맞지 않는 상태가 재현될 수 있습니다.

#### 원인 C. handle 위치와 end-node identity는 같아 보여도, 실제 계산 출처가 다르다

- handle은 `effectiveTimelineEndY`
- end marker identity는 `visualEndMajorNodeId` / `timelineEndFollowerNodeId`
- rendered node 위치는 `activeNodeDragPreview` 또는 `nodePlacements`

즉 겉으로는 모두 “마지막 노드”를 기준으로 보이지만, 실제로는 서로 다른 상태 조합을 보고 있습니다.

### 7.4 프론트엔드에서 처리해야 할 부분

#### 방향 A. major 커밋 후 `timelineEndY`를 최종 end major bottom 기준으로 항상 재정렬

- `willNodeBecomeEnd`일 때만 늘리는 방식 대신
- reorder/move가 끝난 뒤의 최종 major 순서와 최종 placement를 기준으로
- 실제 end major node bottom을 다시 계산해 `timelineEndY`를 정규화해야 합니다

핵심은 “확장만 하고 축소는 안 하는” 현재 흐름을 없애는 것입니다.

#### 방향 B. 화면 렌더용 handle 값과 persisted raw state를 분리 검토

필요하면 다음 둘을 구분합니다.

1. persisted `timelineEndY`
2. final end-major-derived `resolvedTimelineEndY`

이렇게 두면:

- active timeline-end drag 중에는 사용자의 의도를 반영하고
- 평상시 렌더에서는 마지막 major node bottom과 자동 정렬된 값을 쓸 수 있습니다

#### 방향 C. major reorder 이후 arrow-end alignment 회귀를 추가

필수 회귀 후보:

- end major를 위로 옮긴 뒤 새 end node bottom과 handle top이 일치
- tall middle major를 end와 swap한 뒤 handle이 과하게 남지 않음
- non-end major reorder 후에도 마지막 major bottom과 handle top이 일치
- reload 후에도 복원된 handle top이 마지막 major bottom과 일치

### 7.5 백엔드에서 처리해야 할 부분

- 현재 증상 기준으로는 필수 backend 수정은 없음
- backend canonicalization은 order/parent 정렬에는 영향이 있지만, 현재 메인 화살표 드리프트는 프런트 episode-canvas UI state와 drag commit 계산에서 발생합니다
- 다만 제품적으로 “timeline end 자체를 canonical project state로 저장할지”를 나중에 결정하면 그때 shared/backend 계약 변경 검토가 필요합니다

### 7.6 실행 순서

1. `WorkspaceShell.test.tsx` 문법 에러를 먼저 복구해 route 회귀를 다시 돌릴 수 있게 만듭니다
2. major reorder/commit 뒤 최종 end major bottom 재계산 helper를 도입합니다
3. `timelineEndY` 갱신 경로를 resize/delete/reorder에서 같은 규칙으로 통일합니다
4. persisted `timelineEndY`와 렌더용 resolved value를 분리할지 결정합니다
5. alignment 회귀를 추가하고 reload 케이스까지 검증합니다

### 7.7 테스트 게이트

- `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`
- `corepack yarn --cwd frontend typecheck`
- 변경 파일 대상 eslint

### 7.8 주의사항

- 이 작업은 `detail-003`과 같은 파일/같은 상호작용 경계를 만집니다
- `timelineEndY`를 단순히 렌더 직전에만 덮어쓰면, reload/persistence 쪽 drift는 숨겨지고 근본 원인은 남을 수 있습니다
- 반대로 persisted state를 무조건 지워버리면 timeline-end drag UX 자체가 흔들릴 수 있으므로, “사용자 의도값”과 “최종 정렬값”을 구분해서 다뤄야 합니다

---

## detail-008 / Lane Reflow Coupling after Reorder 대응

### 8.1 대상 증상

- 노드 순서를 한 번 바꾼 뒤 다른 노드를 이동하면, 같은 레인의 다른 노드가 같이 움직이는 것처럼 보임
- 특히 reorder 직후에는 사용자가 “한 노드만 옮긴다”고 느끼는데, 화면에서는 이전에 순서가 바뀐 다른 노드까지 다시 밀려남

### 8.2 현재 확인된 사실

- `WorkspaceShell.tsx`는 배치 계산 마지막에 major/minor/detail 모든 레인에 `applyLaneVerticalReflow(...)`를 다시 적용합니다
- `visibleNodeIdsByLevel`은 현재 `visibleNodes` 순서를 그대로 쓰고, 이 순서는 구조 순서(`orderedNodes`)를 반영합니다
- `applyLaneVerticalReflow(...)`는 전달된 `nodeIds` 순서를 유지한 채 뒤쪽 노드를 아래로 밀어 최소 간격을 강제합니다
- 현재 layout 테스트도 이 동작을 명시적으로 검증합니다
  - lower lane node를 아래로 민다
  - 제공된 lane order를 유지한다

### 8.3 가능성이 높은 원인

#### 원인 A. reorder 이후 visual freedom보다 structural lane order가 우선된다

현재는 노드 하나를 드래그해도 최종 렌더 직전에:

- 같은 레인 전체 placement를 다시 읽고
- 구조 순서대로
- 최소 세로 간격을 강제하는 reflow를 돌립니다

그래서 reorder로 순서가 바뀐 뒤에는, 이후 한 노드만 움직여도 같은 레인의 뒤쪽 노드가 같이 밀릴 수 있습니다.

#### 원인 B. `resolveNodeOverlapPlacement(...)`와 `applyLaneVerticalReflow(...)`가 연속으로 작동한다

현재 경로는:

1. 개별 드래그 placement를 overlap 기준으로 한 번 보정하고
2. 그 뒤 레인 전체를 다시 reflow 합니다

즉 사용자는 “겹치지 않게 한 칸 옮겼다”고 느껴도,
최종 화면에서는 레인 전체 재배치 효과가 추가로 얹힐 수 있습니다.

#### 원인 C. major 레인도 현재는 사실상 single-writer vertical order 모델이다

코드 주석상으로는 “자유 이동/재정렬 충돌을 줄이기 위한 최소 보정”이지만,
실제 구현은 같은 레인의 앞선 노드 bottom을 기준으로 이후 노드의 minimumY를 강제합니다.

그래서 reorder 이후 자유 이동 기대와 현재 모델이 충돌합니다.

### 8.4 프론트엔드에서 처리해야 할 부분

#### 방향 A. reorder 직후 자유 이동과 lane-wide reflow를 분리

다음 둘 중 하나를 결정해야 합니다.

1. 구조 순서를 유지하는 lane 모델을 계속 쓸 것인지
2. 사용자가 옮긴 placement를 더 강하게 존중할 것인지

현재 증상 기준으로는 적어도 major 레인에서는 전체 reflow를 약화하거나 조건부로 바꾸는 쪽이 맞습니다.

#### 방향 B. reflow 대상을 “영향받은 suffix”로 제한하거나 선택적 잠금 도입

예시 방향:

- 이동한 노드 뒤쪽 subset만 보정
- reorder 직후 일정 조건에서는 reflow 생략
- 사용자가 직접 이동한 노드는 lock처럼 취급하고 나머지만 보정

핵심은 “한 노드를 움직였는데 레인 전체가 다시 정렬되는 체감”을 줄이는 것입니다.

#### 방향 C. 레인별 정책 분리

- major: 구조 순서 강제보다 자유 이동 우선
- minor/detail: 현재 최소 간격 보정 유지 또는 완화

세 레인을 모두 같은 reflow 규칙으로 묶지 않는 편이 안전합니다.

### 8.5 백엔드에서 처리해야 할 부분

- 현재 증상 기준으로는 필수 backend 수정은 없음
- 실제로 같이 움직이는 것은 persisted order mutation보다 프런트 렌더 단계의 lane reflow 결과입니다
- backend는 노드 order/parent canonicalization만 담당하고, 이번 체감 문제의 직접 원인은 아닙니다

### 8.6 실행 순서

1. `WorkspaceShell.test.tsx` 문법 에러를 먼저 복구해 route 회귀를 다시 돌릴 수 있게 만듭니다
2. reorder 후 drag 상황을 재현하는 route 회귀를 추가합니다
3. `applyLaneVerticalReflow(...)` 적용 범위를 major/minor/detail별로 다시 나눕니다
4. major 레인에서 lane-wide reflow를 축소하거나 조건부화합니다
5. 이동한 노드 외 다른 노드가 불필요하게 다시 움직이지 않는지 검증합니다

### 8.7 테스트 게이트

- `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`
- `corepack yarn --cwd frontend test -- src/routes/workspace-shell/workspaceShell.layout.test.ts`
- `corepack yarn --cwd frontend typecheck`

필수 회귀:

- reorder 후 특정 major node 이동 시 다른 reordered major node가 불필요하게 같이 밀리지 않음
- minor/detail은 기존 최소 간격 보호가 필요한 범위 안에서만 유지됨
- overlap 해결만 필요한 경우 lane-wide reorder가 재발하지 않음

### 8.8 주의사항

- 이 작업은 `WorkspaceShell.tsx`와 `workspaceShell.canvas.ts` 양쪽을 함께 봐야 합니다
- 단순히 reflow를 전부 끄면 겹침 회피 규칙이 무너질 수 있습니다
- 따라서 “reflow 제거”보다 “어느 레인에서, 어떤 조건에서, 어느 범위까지 재배치할지”를 좁히는 방식이 더 안전합니다

---

## detail-009 / Local Backend Port Standardization to 3001 대응

### 9.1 대상 요청

- 프런트와 백엔드 관련 코드에서 로컬 백엔드 기준 포트를 `3001`로 통일하고 싶음
- 현재 섞여 있는 `3001` / `3202` 기본값 때문에 실행 경로마다 혼선이 생김

### 9.2 해석 기준

여기서 “전부 3001로 맞춘다”는 것은:

- 백엔드 서버 기본 listen 포트
- 프런트 dev/proxy가 바라보는 백엔드 기본 포트
- 프런트 dist proxy가 바라보는 백엔드 기본 포트

를 `3001`로 통일한다는 의미로 해석하는 것이 맞습니다.

프런트 dev 서버와 백엔드 서버가 동시에 둘 다 `3001`에서 직접 리슨하는 것은 불가능합니다.
따라서 프런트 자체 포트(`5173` 등)는 그대로 두고, 프런트가 연결하는 백엔드 target만 `3001`로 맞추는 방향이 안전합니다.

### 9.3 현재 확인된 드리프트

- `backend/src/config/env.ts` 기본 `PORT` fallback이 `3202`
- `frontend/vite.config.ts` 기본 backend proxy target이 `http://127.0.0.1:3202`
- `frontend/scripts/serve-dist.mjs` 기본 backend port가 `3202`

반면 기존 실행 로그/검증 기록과 Playwright readiness는 이미 `3001`을 전제로 남아 있습니다.

### 9.4 프론트엔드에서 처리해야 할 부분

#### 방향 A. dev proxy 기본 target을 `3001`로 통일

- `frontend/vite.config.ts`
- 필요하면 관련 env 주석/샘플도 함께 정리

핵심 목표:

- `yarn dev:frontend` 기준 `/api` 프록시가 별도 설정 없이 `127.0.0.1:3001`을 바라보게 만들기

#### 방향 B. dist proxy 기본 target을 `3001`로 통일

- `frontend/scripts/serve-dist.mjs`

핵심 목표:

- dist smoke/local host 경로도 dev 경로와 같은 backend 기본 포트를 사용하게 만들기

### 9.5 백엔드에서 처리해야 할 부분

#### 방향 A. backend default port fallback을 `3001`로 복귀

- `backend/src/config/env.ts`

핵심 목표:

- `PORT`를 주지 않아도 로컬 기본 실행이 `127.0.0.1:3001`에서 뜨도록 만들기

#### 방향 B. backend-facing 로그/실행 메시지의 기대 포트와 코드 기본값 정렬

- startup log 자체는 동적 포트를 쓰므로 코드 수정이 많지는 않지만
- 문서/스크립트에서 `3202`를 전제로 한 설명이 있으면 같이 정리

### 9.6 도구/런처/문서에서 처리해야 할 부분

- Playwright readiness나 로컬 런처 설명과 실제 코드 기본값이 어긋나지 않는지 재확인
- 필요 시 실행 관련 문서와 launcher 설명을 `3001` 기준으로 맞춤
- `PLANS.md`는 구조 변경 없이 routine log만 append

### 9.7 실행 순서

1. 코드 기본값 드리프트 지점을 `3001` 기준으로 일괄 정리합니다
2. 프런트 dev proxy와 dist proxy가 동일하게 `3001`을 바라보는지 맞춥니다
3. 백엔드 기본 listen port fallback을 `3001`로 맞춥니다
4. 관련 실행 문서/주석/샘플 중 남은 `3202`를 정리합니다
5. 실제 smoke로 `backend 3001` + `frontend 5173` 경로를 다시 검증합니다

### 9.8 테스트 게이트

- `corepack yarn --cwd frontend typecheck`
- `yarn workspace @scenaairo/backend typecheck`
- 실제 smoke:
  - `http://127.0.0.1:3001/api/health`
  - `http://127.0.0.1:5173/api/health`
  - 필요 시 프런트 경유 persistence/recommendation 호출

### 9.9 주의사항

- “모든 서버가 3001”은 불가능하므로, 프런트 UI 서버 포트와 backend target 포트를 구분해야 합니다
- 이번 작업은 포트 기본값 표준화이지, 런타임에서 다른 포트를 override하는 기능 제거가 아닙니다
- 즉 환경 변수로 `PORT` 또는 proxy target을 바꾸는 기존 유연성은 그대로 유지하는 편이 맞습니다

---

## detail-010 / GPT Keyword Recommendation Integration 경계 재정리 및 실행 계획

### 10.1 대상 요청

- GPT 계열 LLM API를 연결해서 추천 키워드를 얻고 싶음
- 사용자는 `shared` 디렉터리 쪽에서 시작하는 방향을 생각하고 있음

### 10.2 현재 구조 기준 판단

현재 저장소 문서와 코드 기준으로는:

- `shared`는 cross-boundary 타입/계약 전용 경계입니다
- `recommendation`은 provider integration과 recommendation orchestration 경계입니다

즉 **실제 OpenAI SDK 호출 로직을 `shared`에 두는 것은 현재 경계와 맞지 않습니다.**

권장 구조는 이렇습니다.

1. `shared`
   - 추천 요청/응답 타입
   - 필요 시 구조화 출력 스키마 타입
   - cross-boundary contract
2. `recommendation`
   - OpenAI provider 구현
   - prompt / response parsing
   - heuristic fallback과 provider factory
3. `backend`
   - env 로딩
   - recommendation route에서 provider 주입

### 10.3 공식 API 기준

공식 문서 기준으로는:

- 최신 텍스트 생성 워크플로에는 Responses API 사용이 권장됩니다
- Node.js에서는 공식 JavaScript SDK `openai`를 사용하는 경로가 기본입니다
- 구조화 출력이 필요하면 Structured Outputs(JSON schema / Zod) 사용이 가능합니다

이 계획은 위 기준을 따릅니다.

### 10.4 현재 확인된 사실

- 현재 추천 경계는 이미 `recommendation/src/provider/index.ts`에 heuristic provider를 두고 있습니다
- `backend/src/recommendation/routes.ts`는 지금 `createHeuristicRecommendationProvider()`를 직접 고정 사용합니다
- `recommendation/src/config/env.ts`에는 `RECOMMENDATION_PROVIDER`, `RECOMMENDATION_MODEL`, `RECOMMENDATION_API_KEY`가 정의되어 있지만 아직 실제로 연결되어 있지 않습니다
- `shared`에는 현재 recommendation 전용 내부 구현이 아니라 공용 타입/계약만 두는 방향이 문서로 적혀 있습니다

### 10.5 권장 아키텍처

#### 방향 A. 실제 GPT 연동은 `recommendation/provider/openai.ts`로 분리

권장 책임:

- OpenAI client 생성
- Responses API 호출
- 구조화 출력 parsing
- provider-level 에러 표준화

이렇게 하면 기존 `RecommendationProvider` 인터페이스를 그대로 유지할 수 있습니다.

#### 방향 B. `shared`에는 공용 recommendation schema만 올림

`shared`로 옮기거나 새로 둘 수 있는 후보:

- `KeywordSuggestion`
- `KeywordRecommendationRequest`
- `KeywordRecommendationResponse`
- GPT structured output result schema에 대응하는 공용 타입

단, OpenAI SDK client나 prompt builder까지 `shared`에 넣는 것은 권장하지 않습니다.

#### 방향 C. backend는 provider selection만 담당

예상 역할:

- `RECOMMENDATION_PROVIDER=openai|heuristic|stub`
- `RECOMMENDATION_MODEL=...`
- API key/env 확인
- route registration 시 provider factory 주입

즉 backend는 “호출 장소”이고, recommendation은 “구현 경계”가 됩니다.

### 10.6 프론트엔드에서 처리해야 할 부분

- 큰 구조 변경은 필수 아님
- 기존 `/api/recommendation/keywords` 호출 경로는 그대로 유지 가능
- 다만 GPT 응답 reason/label 품질이 달라질 수 있으므로 UI에서 너무 heuristic 전제에 묶여 있는 검증이 있으면 재확인 필요

### 10.7 shared에서 처리해야 할 부분

#### 최소안

- shared는 수정하지 않음
- recommendation contracts는 그대로 recommendation 패키지에 유지

#### 권장안

- 추천 요청/응답 타입만 `shared/src/contracts` 또는 `shared/src/types`로 이동/재export
- backend / frontend / recommendation이 같은 recommendation schema를 공유하게 정리

#### 비권장안

- OpenAI SDK client
- prompt text
- provider-specific parsing 로직

이 세 가지를 `shared`에 두는 것

### 10.8 recommendation에서 처리해야 할 부분

#### 단계 1. provider 파일 분리

- `recommendation/src/provider/openai.ts`
- `recommendation/src/provider/heuristic.ts`
- `recommendation/src/provider/factory.ts`

현재 `index.ts`에 몰려 있는 heuristic 구현도 이 기회에 나누는 편이 좋습니다.

#### 단계 2. OpenAI provider 구현

필수 요소:

- 공식 JS SDK `openai` 의존성 추가
- `Responses API` 호출
- keyword suggestion 구조화 출력
- fallback / refusal / malformed output 처리

#### 단계 3. structured output schema 도입

권장 출력 형식:

- suggestions: array
- each suggestion:
  - label: string
  - reason: string

가능하면 provider 경계에서 schema validation까지 끝내고 service에는 이미 정제된 결과만 넘깁니다.

#### 단계 4. heuristic fallback 유지

초기 rollout에서는:

- API key 없을 때
- provider=openai가 아닐 때
- OpenAI 호출 실패 시 옵션에 따라 fallback 허용

이 세 경로를 유지하는 편이 안전합니다.

### 10.9 backend에서 처리해야 할 부분

#### 방향 A. recommendation env를 실제로 연결

현재 `loadRecommendationEnv()`는 정의만 있고 사용되지 않습니다.

계획:

- backend app bootstrap에서 recommendation env를 읽고
- `registerRecommendationRoutes(...)` 또는 provider factory에 주입

#### 방향 B. env key 전략 정리

선택지는 둘입니다.

1. `OPENAI_API_KEY`를 표준으로 채택
2. 기존 `RECOMMENDATION_API_KEY`를 유지하되 OpenAI client 생성 시 명시적으로 전달

권장:

- 외부 표준 호환성을 위해 `OPENAI_API_KEY` 우선
- 기존 프로젝트 습관을 고려해 `RECOMMENDATION_API_KEY` fallback 허용

#### 방향 C. route-level error mapping

예상 에러 구분:

- missing_api_key
- unsupported_provider
- recommendation_failed
- structured_output_invalid

이 정도는 backend response에서 구분해두는 편이 디버깅에 유리합니다.

### 10.10 테스트 계획

#### recommendation unit

- provider factory가 env에 따라 heuristic/openai/stub를 고르는지
- OpenAI provider가 구조화 응답을 `KeywordSuggestion[]`로 변환하는지
- malformed/refusal 시 에러 또는 fallback이 기대대로 동작하는지

#### backend integration

- `/api/recommendation/keywords`가 openai provider stub/mock를 통해 정상 응답하는지
- key 누락 시 명시적 오류를 반환하는지

#### shared

- shared로 recommendation schema를 옮긴다면 type/export smoke 필요

### 10.11 실행 순서

1. 경계 결정: 실제 provider는 `recommendation`, shared는 schema만 둘지 확정
2. recommendation provider 파일 분리
3. OpenAI SDK + env 전략 도입
4. keyword structured output schema 도입
5. backend route에 provider factory 연결
6. heuristic fallback 정책 정리
7. unit/integration smoke

### 10.12 주의사항

- 사용자가 `shared`를 언급했더라도, 실제 GPT 네트워크 호출까지 shared에 넣으면 현재 모듈 경계를 깨게 됩니다
- 따라서 “shared를 쓰는 방식”은 schema/contract 공유 쪽으로 제한하는 것이 맞습니다
- 이 작업은 shared contract 변경 가능성이 있으므로 실제 구현 단계에서는 version-control gate 성격으로 보는 편이 안전합니다

---

## detail-011 / Recommendation Runtime Env Source-of-Truth 정리

### 11.1 대상 문제

- recommendation OpenAI 경로는 구현됐지만, 실제 런타임에서 어떤 env가 source of truth인지 아직 애매함
- `process.env` 직접 읽기와 recommendation env helper가 공존하고 있음
- `.env` 파일을 써도 자동 로드되지 않아 사용자가 “설정했는데 안 먹는다”고 느낄 수 있음

### 11.2 현재 확인된 사실

- backend 런타임은 `process.env`에서 recommendation 관련 값을 직접 읽습니다
- `recommendation/src/config/env.ts`의 `loadRecommendationEnv()`도 존재하지만, 현재 런타임의 단일 source of truth로 쓰이지는 않습니다
- launcher/dev 스크립트는 현재 프로세스 env를 전달할 뿐, package-local `.env`를 자동 로드하지 않습니다
- recommendation 실제 호출 주체는 backend 프로세스이므로, `recommendation/.env`는 런타임 관점에서 직관적인 위치가 아닙니다
- 기본 모델값도 backend runtime과 recommendation env helper가 아직 서로 다를 수 있습니다

### 11.3 목표 상태

다음 네 가지를 명확히 만듭니다.

1. recommendation runtime env는 어디서 읽는가
2. 어느 함수가 유일한 파서인가
3. `.env` 파일을 지원할지 말지
4. 모델/API key/provider 기본값은 무엇인가

### 11.4 권장 source of truth

#### 방향 A. runtime parser는 `loadRecommendationEnv()` 하나로 통일

권장:

- backend app bootstrap에서 recommendation 관련 env를 직접 흩어 읽지 말고
- `loadRecommendationEnv()`를 호출해 단일 객체로 받습니다

이렇게 하면:

- 기본값
- key 우선순위
- provider 파싱
- fallback flag

를 한 파일에서 일관되게 유지할 수 있습니다

#### 방향 B. backend가 실제 recommendation runtime owner임을 문서/코드에 반영

실제 네트워크 호출은 backend 프로세스에서 일어나므로:

- runtime `.env` 기준도 backend 쪽에 두는 편이 자연스럽습니다
- recommendation 패키지는 library처럼 동작하고, env parsing helper만 제공하는 구조가 맞습니다

### 11.5 `.env` 지원 전략

#### 선택지 1. `.env` 자동 로드 없이 shell env만 공식 지원

장점:

- 단순함
- 숨은 로딩 규칙이 없음

단점:

- 사용자가 `.env` 파일을 써도 자동 반영을 기대하기 쉬움

#### 선택지 2. backend 실행 경로에서 `.env` 자동 로드 지원

권장 방향:

- backend 런타임 기준 `.env`만 공식 지원
- 예: `backend/.env` 또는 루트 `.env`
- launcher/dev script가 그 파일을 읽어 `process.env`에 주입

장점:

- 사용자가 실제로 기대하는 동작에 가까움
- backend가 runtime owner라는 구조와 맞음

주의:

- recommendation package-local `.env`를 별도로 유지하면 혼선이 커집니다

### 11.6 env key / default 정리 계획

#### 방향 A. API key 우선순위 고정

권장:

1. `OPENAI_API_KEY`
2. `RECOMMENDATION_API_KEY`

이 우선순위는 helper와 backend 모두 동일해야 합니다.

#### 방향 B. 모델 기본값 단일화

현재처럼 backend runtime과 recommendation helper가 서로 다른 기본 모델을 가지면 안 됩니다.

권장:

- 기본 모델은 한 곳에서만 정의
- backend는 그 값을 그대로 사용

#### 방향 C. provider 기본값 단일화

예시 후보:

- 보수적 기본값: `heuristic`
- 적극적 기본값: `openai`

운영 안정성 기준으로는 초기에 `heuristic` 기본값이 더 안전합니다.

#### 방향 D. fallback flag를 helper로 이동

현재 backend가 직접 읽는 `RECOMMENDATION_FALLBACK_TO_HEURISTIC_ON_ERROR`도
recommendation env helper가 함께 파싱하는 편이 맞습니다.

### 11.7 파일별 작업 범위

#### recommendation

- `recommendation/src/config/env.ts`
- recommendation env 타입 정리
- helper가 provider/model/key/fallback flag를 모두 반환하도록 완성

#### backend

- `backend/src/app.ts`
- 필요 시 `backend/src/recommendation/routes.ts`

backend는 recommendation env helper를 사용해 provider 옵션을 조립만 하도록 단순화합니다.

#### scripts / launcher

- `scripts/launch-local.ps1`
- `scripts/dev-backend.mjs`
- `scripts/dev-backend-compat.mjs`

`.env` 자동 로드를 지원하기로 결정하면 이 레이어에서 반영합니다.

#### docs / samples

- `backend/.env.example`
- 실행 문서

실제 런타임 owner가 backend라면 sample env 위치도 backend 기준으로 단일화하는 편이 낫습니다.

### 11.8 테스트 게이트

#### unit

- env helper가 key/provider/model/fallback를 올바르게 파싱하는지
- 기본값이 backend와 recommendation에서 일치하는지

#### backend integration

- env 기반 openai/heuristic/stub provider 선택이 예상대로 되는지
- key 누락 시 에러, fallback 허용 시 heuristic 전환이 되는지

#### runtime smoke

- launcher/dev backend 경로에서 실제 env를 주었을 때 `/api/recommendation/keywords`가 기대 provider를 타는지

### 11.9 실행 순서

1. recommendation runtime env source of truth를 `loadRecommendationEnv()`로 고정
2. backend 직접 env 읽기 로직을 helper 기반으로 치환
3. model/provider/fallback 기본값을 단일화
4. `.env` 자동 로드 지원 여부를 결정하고 scripts에 반영
5. sample env / 문서 위치를 정리
6. provider 선택과 fallback에 대한 unit/integration/runtime smoke를 수행

### 11.10 주의사항

- 실제 호출 주체가 backend인 이상, recommendation package-local `.env`를 주 runtime 설정 위치로 두는 것은 혼선을 키울 수 있습니다
- env helper만 만들고 launcher/scripts가 여전히 `.env`를 안 읽으면 사용자 체감 문제는 남습니다
- 반대로 `.env`를 자동 로드하기로 하면 어느 파일을 공식 위치로 삼는지 하나로 못 박아야 합니다

## detail-012 / Gemini Recommendation Provider 전환 계획

### 12.1 목표

현재 recommendation 런타임은 `openai` provider 전용 경로만 실질적으로 연결되어 있습니다.
사용 의도가 Gemini라면, 이번 작업의 목표는 다음으로 잡는 편이 맞습니다.

- 키워드 추천 external provider를 `Gemini`까지 확장
- 기존 `shared` 요청/응답 계약은 1차에서 유지
- `frontend`는 되도록 무변경 유지
- 변경 범위는 `recommendation` + `backend` + env/sample/doc로 제한

즉 이번 전환은 “추천 기능 자체를 다시 설계”하는 게 아니라,
현재 provider 구조에 `gemini`를 정식 provider로 추가하는 작업입니다.

### 12.2 현재 상태 요약

현재 저장소는 다음 상태입니다.

- provider factory는 `heuristic | openai | stub`만 지원
- runtime env는 `OPENAI_API_KEY` 중심으로 파싱
- backend recommendation wiring도 provider 이름은 받지만 사실상 OpenAI/heuristic 전환 기준으로만 정리돼 있음
- 프런트 요청 계약은 provider-agnostic이라 그대로 재사용 가능

따라서 실패 원인은 UI나 request schema가 아니라,
“Gemini key를 OpenAI provider 경로에 넣은 상태”였습니다.

### 12.3 설계 원칙

#### 원칙 A. `shared` 계약은 1차에서 유지

현재 키워드 추천 request/response는 provider와 무관하게 충분히 단순합니다.

- request: story snapshot
- response: `suggestions[{ label, reason }]`

Gemini 전환만으로 `shared` 타입을 바꿀 필요는 없습니다.

#### 원칙 B. provider별 credential은 provider-aware로 해석

`RECOMMENDATION_PROVIDER=openai`인데 Gemini 키를 읽는 식의 혼선이 다시 생기면 안 됩니다.

권장 방향:

- `openai` 선택 시: `OPENAI_API_KEY` 우선
- `gemini` 선택 시: `GEMINI_API_KEY` 우선
- `RECOMMENDATION_API_KEY`는 선택적 generic fallback로만 유지하거나,
  아예 제거 여부를 별도 결정

#### 원칙 C. 모델명은 env로만 결정

모델 문자열은 provider별로 다르고 자주 바뀔 수 있으므로,
코드에 강한 기본값을 여러 군데 박아두지 않는 편이 낫습니다.

다만 1차 기본 예시는 필요합니다.
Google AI for Developers 문서 기준 현재 JS 권장 SDK는 `@google/genai`이며,
기본 모델은 production-safe한 stable flash 계열을 예시값으로 두는 편이 안전합니다.

### 12.4 프런트엔드에서 처리할 부분

1차 전환 기준으로 프런트 변경은 최소화합니다.

#### 필수 아님

- 현재 `frontend/src/recommendation/request.ts`
- 현재 `frontend/src/recommendation/client.ts`
- 현재 `WorkspaceShell` 키워드 패널 열기/토글 흐름

이 구간은 request/response shape가 유지되면 그대로 사용할 수 있습니다.

#### 선택적 후속 작업

- backend가 upstream 에러 종류를 더 잘 내려주면,
  프런트에서 `recommendation_failed` 대신 더 구체적인 메시지를 보여줄 수 있음
- 다만 이건 Gemini 전환의 선행조건은 아님

### 12.5 recommendation 패키지에서 처리할 부분

이번 작업의 핵심은 여기입니다.

#### Track A. Gemini provider 파일 추가

신규 후보:

- `recommendation/src/provider/gemini.ts`

책임:

- Gemini SDK 호출
- prompt 구성
- Gemini 응답을 `KeywordSuggestion[]`로 정규화
- 실패 시 provider 표준 에러 코드로 변환
- fallback provider가 있으면 heuristic으로 전환

#### Track B. provider 타입 확장

대상:

- `recommendation/src/provider/types.ts`
- `recommendation/src/provider/factory.ts`

필요 작업:

- `RecommendationProviderName`에 `gemini` 추가
- Gemini client 최소 인터페이스 정의
- factory가 `provider=gemini`를 선택할 수 있게 확장
- `fallbackToHeuristicOnError` 규칙은 기존과 동일하게 유지

#### Track C. prompt / parser 전략

OpenAI처럼 strict structured output이 Gemini에서 동일하게 보장되지 않을 수 있으므로,
1차 구현은 아래 우선순위가 안전합니다.

1. Gemini structured output 가능 경로 우선 사용
2. 안 되면 JSON text output을 파싱
3. 파싱 실패 시 `structured_output_invalid`
4. fallback 허용 시 heuristic으로 전환

반환 계약은 그대로 유지합니다.

- `label`: 짧은 영어 키워드
- `reason`: 짧은 영어 설명

#### Track D. sentence 경로 정책

현재 `openai` provider도 sentence generation은 사실상 미구현/폴백 상태입니다.
따라서 Gemini 1차 전환 범위는 `keywords` 우선으로 제한하는 편이 맞습니다.

권장:

- `requestKeywords`: Gemini 구현
- `requestSentences`: 기존 heuristic fallback 유지 또는 현행 정책 유지

### 12.6 백엔드에서 처리할 부분

#### Track E. env 파서 provider-aware 전환

대상:

- `recommendation/src/config/env.ts`
- `backend/src/app.ts`
- `backend/.env.example`

필요 작업:

- `GEMINI_API_KEY` 지원 추가
- provider에 따라 올바른 key를 선택하도록 `loadRecommendationEnv()` 수정
- 기본 provider 예시는 `heuristic` 유지 가능
- Gemini를 쓸 때는 `RECOMMENDATION_PROVIDER=gemini`가 되도록 sample 정리

권장 env 예시:

- `RECOMMENDATION_PROVIDER=gemini`
- `RECOMMENDATION_MODEL=gemini-2.5-flash`
- `GEMINI_API_KEY=...`

#### Track F. route / 에러 매핑 정리

대상:

- `backend/src/recommendation/routes.ts`

필요 작업:

- provider mismatch와 missing key를 더 명확히 구분
- upstream auth/network/provider error를 모두 `recommendation_failed`로만 뭉개지 않도록 개선 검토

최소한 내부 로그나 테스트 기준에서는 아래 구분이 보이는 편이 낫습니다.

- `missing_api_key`
- `invalid_api_key`
- `structured_output_invalid`
- `recommendation_failed`
- `upstream_connection_error`

단, 사용자 응답 표면을 어디까지 세분화할지는 별도 결정 가능합니다.

### 12.7 shared에서 처리할 부분

1차 전환에서는 없음으로 두는 게 맞습니다.

현재 `shared` 계약은 이미 provider-agnostic합니다.
Gemini 도입만으로 타입을 바꾸면 오히려 변경 범위만 넓어집니다.

`shared`를 건드리는 경우는 다음 둘 중 하나일 때만 검토합니다.

- provider별 메타데이터를 UI에 노출해야 할 때
- keyword/sentence 응답 형식 자체를 바꿔야 할 때

### 12.8 파일별 예상 변경 범위

#### recommendation

- `recommendation/package.json`
- `recommendation/src/provider/types.ts`
- `recommendation/src/provider/factory.ts`
- `recommendation/src/provider/gemini.ts` 신규
- `recommendation/src/config/env.ts`
- 필요 시 `recommendation/src/index.ts`
- 관련 unit test 파일들

#### backend

- `backend/src/app.ts`
- `backend/src/recommendation/routes.ts`
- `backend/src/recommendation/routes.integration.test.ts`
- `backend/.env.example`

#### docs / runtime

- `ENVIRONMENT.md`
- 필요 시 `DETAILPLAN.md`

### 12.9 실행 순서

1. `recommendation` provider 타입에 `gemini`를 추가
2. `gemini.ts` 구현과 parser/fallback 정책을 완성
3. factory가 `gemini`를 선택하도록 확장
4. env helper에 `GEMINI_API_KEY` 및 provider-aware key resolution 추가
5. backend sample env / wiring / route integration 정리
6. provider unit tests와 backend integration tests 추가
7. 실제 Gemini key로 `/api/recommendation/keywords` runtime smoke 수행

### 12.10 테스트 게이트

#### recommendation unit

- `provider=factory`가 `gemini`를 올바르게 선택하는지
- Gemini 응답 파싱이 `KeywordSuggestion[]`로 정규화되는지
- malformed output 시 `structured_output_invalid`로 가는지
- fallback flag가 true일 때 heuristic 전환이 되는지

#### backend integration

- `provider=gemini` + key 없음 -> 예상 에러
- `provider=gemini` + fallback true -> heuristic 전환
- `provider=gemini` + mocked client 성공 -> 200 + suggestions

#### runtime smoke

- 실제 `backend/.env`로 backend 실행
- `/api/recommendation/keywords` 호출
- 최소 1회 실제 Gemini 응답 확인

### 12.11 리스크와 주의사항

- Gemini SDK/모델 문자열은 바뀔 수 있으므로 provider 코드는 model명을 env 기반으로만 다뤄야 합니다
- provider-specific env를 generic env와 섞어 읽으면 지금과 같은 mismatch가 다시 생깁니다
- sentence 추천까지 한 번에 확장하면 범위가 커지므로 1차는 keyword path 우선이 맞습니다
- `shared`를 굳이 건드리지 않는 것이 병렬 작업 충돌을 줄입니다

### 12.12 권장 작업 단위

#### 1차

- Gemini keyword provider 추가
- env/provider factory/backend wiring 완료
- integration + runtime smoke 통과

#### 2차

- upstream 에러 가시성 개선
- sentence provider 확장 여부 판단
- provider metrics/logging 정리

## detail-013 / Gemini Keyword Recommendation Latency 대응 계획

### 13.1 목표

Gemini 기반 키워드 추천에서 체감 지연이 길다면,
1차 목표는 “정확도를 크게 해치지 않으면서 응답 시간을 줄이는 것”입니다.

이번 계획은 다음 순서로 다룹니다.

1. 느린 모델/과한 prompt/과한 출력량을 줄이기
2. 느릴 때 fallback으로 UX를 보호하기
3. 반복 호출을 캐시해 불필요한 재요청을 줄이기

### 13.2 현재 병목 가설

키워드 추천 용도에서 Gemini 응답이 오래 걸리는 원인은 보통 아래 조합입니다.

- `Pro`급 또는 무거운 추론 모델 사용
- 너무 긴 context prompt 전송
- 한 번에 너무 많은 suggestion 개수 요청
- 같은 노드를 열 때마다 매번 fresh request 수행
- upstream 응답이 느린데 timeout/fallback 정책이 없음

이 기능은 긴 서술 생성이 아니라 짧은 키워드 추천이므로,
모델과 prompt를 더 공격적으로 경량화해도 되는 편입니다.

### 13.3 프런트엔드에서 처리할 부분

프런트는 실제 LLM 호출 속도를 직접 줄이지는 못하지만,
체감 지연과 불필요한 재호출을 줄이는 역할이 있습니다.

#### Track A. 같은 노드 재호출 최소화

대상:

- `frontend/src/routes/WorkspaceShell.tsx`
- 필요 시 `frontend/src/recommendation/`

권장:

- 같은 노드/같은 입력 signature로 패널을 다시 열면 즉시 재호출하지 않기
- `refresh` 버튼을 누른 경우만 강제 재호출
- 직전 결과를 짧은 TTL 캐시로 재사용

캐시 키 예시:

- `node.id`
- `node.text`
- `node.keywords`
- `parentSummary`
- `objectAnchors`
- `model`

#### Track B. 로딩 UX 완화

권장:

- 추천 패널 열 때 이전 결과가 있으면 먼저 보여주고 background refresh
- 최초 호출이 느리면 “loading”만 보여주는 대신 fallback copy 또는 last-known suggestions를 유지

이건 실제 latency를 줄이지는 않지만 체감 품질을 크게 올립니다.

### 13.4 recommendation 패키지에서 처리할 부분

이번 작업의 핵심입니다.

#### Track C. 모델 기본값 경량화

대상:

- `recommendation/src/config/env.ts`
- Gemini provider 구현 파일

권장:

- keyword recommendation 기본 모델은 `flash` 계열 유지
- 모델명은 env-driven으로 관리
- `pro` 계열은 명시 opt-in일 때만 사용

이 기능은 짧은 키워드 추천이므로 속도 우선 모델이 더 적합합니다.

#### Track D. prompt 축소

대상:

- Gemini provider의 prompt builder

현재 구조에서 후보로 들어가는 문맥은 많습니다.
하지만 키워드 추천에는 전부 다 필요하지 않을 수 있습니다.

권장 축소 순서:

1. `nodeLevel`
2. `nodeText` 또는 `parentSummary`
3. 상위 몇 개 `objectAnchors`
4. 핵심 `lockedFacts` 2~4개

후순위 또는 제거 후보:

- 긴 프로젝트 요약 전체
- 중복되는 anchor 나열
- 지나치게 많은 object/fact 목록

#### Track E. 출력 개수 축소

권장:

- 현재 `12~25` 같은 넓은 범위보다
- `8~12` 또는 `10`개 고정 수준으로 축소

키워드 패널은 브레인스토밍 보조 기능이므로,
많은 후보보다 빠른 첫 응답이 더 중요할 수 있습니다.

#### Track F. provider timeout + fallback

권장:

- Gemini 호출에 provider-level timeout 부여
- 예: 3~5초 이내 응답이 없으면 heuristic fallback
- fallback 발생 여부는 내부 로그/메타로 추적 가능하게 설계

이 track은 느릴 때 “영원히 기다리는 경험”을 막는 데 가장 직접적입니다.

#### Track G. provider-side 캐시

권장:

- 짧은 TTL 메모리 캐시
- 동일 input signature에 대해 일정 시간 재사용

적합한 이유:

- 같은 노드에서 패널을 열고 닫거나 refresh 전 다시 여는 경우가 많음
- backend가 provider 호출을 매번 다시 하지 않아도 됨

### 13.5 백엔드에서 처리할 부분

#### Track H. timeout / fallback 정책을 runtime config로 노출

대상:

- `backend/src/app.ts`
- `backend/src/recommendation/routes.ts`
- env helper

권장 env 예시:

- `RECOMMENDATION_TIMEOUT_MS`
- `RECOMMENDATION_CACHE_TTL_MS`
- `RECOMMENDATION_MAX_SUGGESTIONS`

이렇게 해두면 코드 수정 없이 모델/속도 정책을 조정할 수 있습니다.

#### Track I. 관측성 추가

권장:

- provider 호출 duration 측정
- timeout 발생 횟수 집계
- fallback 전환 횟수 추적
- cache hit / miss 추적

최소한 개발 단계에서는 로그만 있어도 충분합니다.

지금은 “느리다”는 체감만 있고 어느 구간이 병목인지 안 보일 수 있으므로,
latency 대응 전후 비교를 위해 관측성이 필요합니다.

### 13.6 shared에서 처리할 부분

1차에서는 없음으로 둡니다.

latency 대응은 provider runtime과 UX 정책 문제이지,
request/response 계약 변경이 필수는 아닙니다.

### 13.7 우선순위

가성비 기준 권장 우선순위는 이렇습니다.

1. 모델을 `flash` 계열로 고정
2. prompt 축소
3. suggestion 개수 축소
4. timeout + heuristic fallback
5. provider-side TTL cache
6. 프런트 stale-while-refresh UX

이 순서가 가장 적은 변경으로 가장 큰 체감 개선을 기대할 수 있습니다.

### 13.8 파일별 예상 변경 범위

#### recommendation

- Gemini provider 구현 파일
- `recommendation/src/config/env.ts`
- provider factory 또는 공통 options 타입
- 관련 unit test

#### backend

- `backend/src/app.ts`
- 필요 시 `backend/src/recommendation/routes.ts`
- backend integration test
- `backend/.env.example`

#### frontend

- `frontend/src/routes/WorkspaceShell.tsx`
- 필요 시 recommendation client helper

### 13.9 테스트 게이트

#### recommendation unit

- prompt 축소 후 parser/정규화가 유지되는지
- timeout 발생 시 fallback이 동작하는지
- cache key/signature가 기대대로 동작하는지

#### backend integration

- timeout/fallback 설정에 따라 `keywords` 응답이 유지되는지
- fallback off일 때 timeout 에러가 기대대로 surface되는지

#### runtime smoke

- 실제 Gemini key로 3회 이상 연속 호출
- cold latency / warm latency / cache hit latency 비교

### 13.10 성공 기준

- cold request 체감 지연이 현재보다 유의미하게 감소
- 같은 노드 재열기 시 거의 즉시 응답
- 느린 경우에도 heuristic fallback으로 패널이 빈 상태로 오래 남지 않음
- keyword recommendation 품질이 과도하게 무너지지 않음

### 13.11 주의사항

- latency만 보고 context를 너무 줄이면 추천 품질이 급락할 수 있습니다
- cache는 refresh 의도까지 막으면 안 되므로 강제 refresh 경로를 남겨야 합니다
- timeout이 너무 짧으면 Gemini를 사실상 못 쓰고 항상 heuristic으로 내려갈 수 있습니다
- `shared`까지 건드리면 범위가 불필요하게 커집니다

## detail-014 / Google Login + Real DB 전환 계획

### 14.1 전제와 승인 게이트

이 작업은 인증 / 세션 / 보안 / 스키마를 함께 건드립니다.
따라서 실제 구현은 `AGENT_SYSTEM.md`의 hard-stop 범주에 해당하며,
이번 문서는 **실행 계획 정리까지만** 다룹니다.

구현 전 사람 승인 범위:

- Google 로그인 방식 확정
- 세션 저장 방식 확정
- DB schema 추가 승인
- account 식별 규칙 확정

### 14.2 목표

목표는 두 가지입니다.

1. Google 계정으로 실제 로그인 가능한 인증 경로 추가
2. guest/local 중심 흐름에서 account-backed MySQL canonical 흐름으로 전환

단, 1차 목표는 “Google API 사용”이 아니라 “Google 계정으로 사용자 인증”입니다.
즉 Google Drive 같은 외부 자원 접근은 범위 밖으로 둡니다.

### 14.3 권장 아키텍처

#### 권장 방향: GIS ID token + backend verify + server session

현재 요구만 보면 OAuth authorization code flow보다 아래 구성이 더 적합합니다.

- 프런트: Google Identity Services 버튼/프롬프트로 Google ID token 획득
- 백엔드: ID token 검증
- 백엔드: account upsert + 서버 세션 생성
- 프런트: 이후 accountId를 임의 지정하지 않고, 세션 기반으로 authenticated workspace 사용

이 방향을 권장하는 이유:

- Google API resource access가 목표가 아님
- 현재 제품은 “로그인된 사용자 식별 + 계정별 persistence”가 핵심
- 구현과 운영 복잡도를 줄일 수 있음

공식 기준도 “ID token을 backend로 보내고, backend에서 검증해 사용자 세션을 만든다”는 흐름을 권장합니다.

### 14.4 현재 저장소 상태

현재 구조는 인증 준비만 돼 있고 실제 provider는 없습니다.

- 프런트는 `StubAuthBoundary`만 사용
- `/auth/callback` 페이지는 baseline placeholder
- persistence는 `accountId`를 path param으로 받는 구조
- MySQL에는 `cloud_accounts` 테이블이 이미 준비돼 있음
- `LOCAL_MYSQL.md`에도 Google sign-in linkage 준비 상태가 명시돼 있음

즉 제품 구조상 “auth가 붙을 자리”는 이미 있지만,
실제 인증/세션/권한 경계는 아직 비어 있는 상태입니다.

### 14.5 프런트엔드에서 처리할 부분

#### Track A. Stub auth 제거 준비

대상:

- `frontend/src/auth/stubAuthBoundary.ts`
- `frontend/src/routes/WorkspaceShell.tsx`
- persistence controller auth dependency 경로

필요 작업:

- `StubAuthBoundary`를 실제 auth boundary interface로 대체
- guest / authenticated 상태 전환을 실제 서버 세션 기준으로 읽도록 변경

#### Track B. Google 로그인 UI 추가

권장:

- 상단 또는 workspace account 영역에 `Sign in with Google` 진입점 추가
- 로그인 성공 후 별도 fake session 저장이 아니라 backend session 반영
- 로그아웃도 backend session clear 기준으로 처리

#### Track C. callback route 재설계

현재 `/auth/callback`은 baseline 페이지입니다.

권장 방향은 둘 중 하나입니다.

1. GIS popup/callback JS 방식 사용
   - callback route는 사실상 불필요하거나 최소화 가능
2. redirect 기반을 유지
   - callback route에서 credential 수신 후 backend 교환

현재 요구만 보면 1번이 더 단순합니다.

#### Track D. 세션 부트스트랩

앱 시작 시:

- `getCurrentSession()`이 localStorage fake session을 읽지 않고
- backend `/api/auth/session` 같은 현재 세션 endpoint를 조회

이 단계에서 guest / authenticated 모드를 확정하도록 바꾸는 게 맞습니다.

### 14.6 백엔드에서 처리할 부분

#### Track E. Google ID token 검증 endpoint

권장 신규 API:

- `POST /api/auth/google/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

로그인 흐름:

1. frontend가 Google credential(ID token) 획득
2. backend 로그인 endpoint로 전송
3. backend가 Google 공개 키/JWK 기준으로 ID token 검증
4. `aud`, `iss`, `exp` 검증
5. `sub`를 provider subject로 사용해 account 조회/생성
6. 서버 세션 생성 후 cookie 설정

#### Track F. 계정 모델 확정

기존 `cloud_accounts`는 이미 방향이 맞습니다.
1차에서 canonical identifier는 다음처럼 두는 편이 안전합니다.

- 내부 pk: `account_id`
- auth provider: `google`
- provider subject: Google `sub`
- display name / email / picture optional 저장

중요:

- 이메일은 변경될 수 있으므로 canonical identifier가 되면 안 됨
- Google `sub`를 provider subject로 써야 함

#### Track G. session 저장 방식

권장:

- opaque session id + HttpOnly cookie + DB-backed session table

예상 신규 테이블:

- `cloud_sessions`

컬럼 예시:

- `session_id`
- `account_id`
- `created_at`
- `expires_at`
- `revoked_at`
- `user_agent_hash` optional

왜 DB-backed session이 맞는가:

- 로그아웃/만료/강제 종료 제어가 쉬움
- multi-device 대응 여지 확보
- real DB 활용 목표와도 맞음

#### Track H. persistence route의 account source 변경

현재는 `/api/persistence/accounts/:accountId/...` 형태라,
실제 인증 환경에서는 path param accountId를 신뢰하면 안 됩니다.

권장 2단계 전환:

1. transitional phase
   - 기존 route 유지
   - session account와 path account가 다르면 차단
2. canonical phase
   - accountId path 제거
   - 서버 세션에서 accountId를 resolve

예상 canonical route 예시:

- `GET /api/persistence/projects`
- `GET /api/persistence/projects/:projectId`
- `POST /api/persistence/projects/:projectId/sync`

### 14.7 DB에서 처리할 부분

#### Track I. MySQL canonical 전환

현재 MySQL normalized tables는 이미 상당 부분 준비돼 있습니다.
1차에서는 file driver를 개발 fallback으로만 두고,
authenticated mode의 canonical storage는 MySQL로 고정하는 편이 맞습니다.

권장:

- guest: local/file 가능
- authenticated: MySQL canonical

#### Track J. 신규/확장 schema

예상 필요 항목:

- `cloud_accounts` 실제 upsert 사용
- `cloud_sessions` 신규
- 필요 시 `cloud_projects.linkage_*` 정리

`cloud_accounts`는 다음 unique 규칙을 유지하는 편이 좋습니다.

- `(auth_provider, provider_subject)` unique
- `email` unique는 optional 재검토 가능

이메일 unique는 federated 계정 처리와 충돌할 수 있으므로,
운영 정책에 따라 완화 검토가 필요합니다.

### 14.8 shared에서 처리할 부분

#### Track K. auth contract 확장

대상:

- `shared/src/contracts/auth.ts`

현재는 너무 최소 형태입니다.
1차에서 필요한 확장 후보:

- `avatarUrl?: string | null`
- `email?: string | null`
- `provider?: "google" | null`
- session status metadata

다만 `shared` 변경은 version-control gate 대상이므로,
정말 프런트가 필요로 하는 최소 필드만 추가하는 편이 맞습니다.

### 14.9 recommendation에서 처리할 부분

1차 직접 범위는 거의 없습니다.

다만 authenticated session이 붙으면 향후 recommendation usage logging,
account-level quotas, per-user provider settings까지 확장할 여지는 있습니다.
이번 범위에서는 제외합니다.

### 14.10 guest -> account 마이그레이션 정책

중요한 정책 결정이 필요합니다.

권장 기본안:

- guest 작업물 유지
- 로그인 직후 현재 local workspace를 계정 canonical project로 import
- 이후 cloud-linked 상태로 전환

즉 기존 persistence controller의 import/sync 철학은 유지하되,
“authenticated account”가 이제 실제 Google account에 매핑되도록 만드는 방향입니다.

검토 포인트:

- 이미 cloud project가 있는 기존 유저 로그인 시 merge 정책
- 새 유저의 첫 로그인 시 bootstrap project 정책
- 동일 브라우저 guest 데이터가 여러 번 import되는 중복 방지

### 14.11 실행 순서

1. Google login 방식 확정
   - GIS ID token 기반으로 승인
2. backend auth env / secret / cookie policy 설계
3. `cloud_sessions` 포함 auth schema 추가
4. backend auth endpoints 구현
5. Google ID token 검증 + account upsert + session issuance 구현
6. frontend auth boundary를 real session 기반으로 교체
7. persistence route를 session-aware로 보호
8. authenticated canonical storage를 MySQL 기준으로 검증
9. guest -> account import/migration 검증
10. 문서 / env sample / local runbook 정리

### 14.12 테스트 게이트

#### backend unit / integration

- Google token 검증 성공/실패
- invalid audience / issuer / expired token 차단
- session create / read / revoke
- authenticated route가 session 없는 요청을 차단
- session account와 path account mismatch 차단

#### frontend integration

- guest boot
- 로그인 후 authenticated session 전환
- 로그아웃 후 guest 회귀
- import/sync 상태 전이 검증

#### DB integration

- `cloud_accounts` upsert
- `cloud_sessions` lifecycle
- MySQL canonical CRUD

#### runtime smoke

- 실제 Google 로그인 1회 성공
- 로그인 후 project 생성/조회/동기화
- 새로고침 후 세션 유지
- 로그아웃 후 보호 route 차단

### 14.13 리스크와 주의사항

- path param accountId를 그대로 두면 auth bypass 위험이 생깁니다
- Google 로그인은 “인증”이지 곧바로 “권한 모델”이 아니므로,
  서버 기준 account ownership을 명확히 해야 합니다
- session cookie 설정은 `SameSite`, `Secure`, `HttpOnly`, local/dev 예외를 함께 설계해야 합니다
- email을 주 식별자로 삼으면 안 됩니다
- DB migration과 auth를 한 번에 구현하면 범위가 커지므로,
  schema/auth/session/persistence 보호를 단계적으로 넣는 편이 안전합니다

### 14.14 권장 1차 범위

1차에서 끝내야 할 최소 목표:

- Google 로그인 가능
- backend session 확립
- authenticated persistence가 MySQL에 저장
- guest import가 실제 account에 연결

1차에서 미뤄도 되는 것:

- role/permission 체계
- multi-provider auth
- passwordless 대체 로그인
- recommendation usage quota
- advanced account settings

### 14.15 FE / BE / Recommendation 디렉터리별 병렬 작업 분할

#### Frontend 디렉터리 담당 범위

소유 디렉터리:

- `frontend/src/auth/`
- `frontend/src/routes/`
- `frontend/src/persistence/`
- `frontend/src/config/`

주요 작업:

1. `StubAuthBoundary`를 실제 session-aware auth boundary로 교체
2. `Sign in with Google` / `Sign out` UI 연결
3. 앱 부팅 시 `/api/auth/session` 기반으로 guest/authenticated 상태 확정
4. 로그인 후 local guest workspace -> account canonical import 흐름 연결
5. callback route를 GIS 기준으로 축소하거나 session bootstrap route로 단순화

우선 파일 후보:

- `frontend/src/auth/stubAuthBoundary.ts` 대체 또는 신규 `googleAuthBoundary.ts`
- `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/routes/AuthCallbackPage.tsx`
- `frontend/src/persistence/controller.ts`
- `frontend/src/config/env.ts`

완료 기준:

- fake local session 없이 실제 서버 세션 기반으로 authenticated 상태 표시
- 로그인/로그아웃 후 UI가 session 상태와 일치
- 새로고침 후 session 유지
- guest import 흐름이 기존 persistence controller와 충돌 없이 이어짐

주의:

- `WorkspaceShell.tsx`는 현재 병렬 작업 충돌 가능성이 큰 파일이므로 single-writer로 다루는 편이 안전합니다
- 프런트는 accountId를 직접 source-of-truth로 들고 있지 않고, backend session을 신뢰해야 합니다

#### Backend 디렉터리 담당 범위

소유 디렉터리:

- `backend/src/auth/` 신규
- `backend/src/config/`
- `backend/src/persistence/`
- `backend/mysql/init/`
- `backend/src/app.ts`

주요 작업:

1. Google ID token 검증 endpoint 추가
2. `cloud_accounts` upsert 실제 사용 연결
3. `cloud_sessions` schema + session issuance / revoke 구현
4. `GET /api/auth/session` / `POST /api/auth/google/login` / `POST /api/auth/logout` 추가
5. persistence route를 session-aware로 보호
6. authenticated mode에서 MySQL canonical 사용 정책 확정

우선 파일 후보:

- `backend/src/app.ts`
- `backend/src/config/env.ts`
- `backend/src/persistence/routes.ts`
- `backend/src/persistence/mysql-store.ts`
- `backend/mysql/init/001_create_cloud_projects.sql` 또는 후속 migration SQL
- 신규 `backend/src/auth/*`

완료 기준:

- Google credential을 검증해 account/session을 생성 가능
- session cookie로 현재 사용자 판별 가능
- session 없는 요청은 보호 route에서 차단
- session account와 요청 account가 불일치하면 차단
- authenticated persistence가 MySQL에 정상 저장

주의:

- 이 디렉터리 작업은 인증/세션/보안/스키마를 건드리므로 실제 구현 전 승인 게이트가 필요합니다
- `accountId` path 기반 persistence를 바로 제거하기보다 transitional guard를 먼저 두는 편이 안전합니다

#### Recommendation 디렉터리 담당 범위

1차 범위에서는 **직접 구현 작업 없음**으로 두는 것이 맞습니다.

소유 디렉터리:

- `recommendation/src/`

현재 역할:

- 코드 변경 없이 no-touch 또는 smoke verification only

병렬 작업 관점에서의 지시:

- 이번 Google login + real DB 전환에서는 recommendation 디렉터리에 새 기능을 억지로 넣지 않음
- 인증이 붙은 뒤에도 recommendation은 기존 contract로 계속 동작하게 유지
- 후속 단계에서만 account-level provider settings / usage logging / quota 연결 검토

완료 기준:

- recommendation 관련 코드가 auth/session 변경 때문에 깨지지 않음
- 필요 시 authenticated session 하에서도 기존 recommendation route가 계속 동작

### 14.16 병렬 실행 순서

#### Phase 1. Backend contract freeze

먼저 백엔드에서 아래를 고정합니다.

- auth endpoint shape
- session cookie 정책
- authenticated persistence 보호 규칙

이 단계가 고정되면 프런트가 병렬로 붙기 쉬워집니다.

#### Phase 2. FE / BE 병렬 구현

병렬 가능:

- Backend: auth endpoint + session storage + MySQL canonical path
- Frontend: auth boundary 교체 + UI + session bootstrap + import transition

병렬 금지 또는 최소화:

- `shared` 계약 대규모 변경
- `WorkspaceShell.tsx`와 persistence controller를 여러 채팅이 동시에 수정하는 것

#### Phase 3. 통합 검증

마지막에 합칩니다.

- 실제 Google login
- session 유지
- MySQL persistence
- guest import

Recommendation 디렉터리는 이 단계에서 회귀 확인만 하면 됩니다.

### 14.17 채팅별 권장 배치

#### Chat A / Backend Auth + Session

담당:

- `backend/src/auth/*`
- `backend/src/app.ts`
- `backend/src/config/env.ts`
- session schema 관련 파일

#### Chat B / Backend Persistence Guard + MySQL Canonical

담당:

- `backend/src/persistence/routes.ts`
- `backend/src/persistence/mysql-store.ts`
- 관련 integration test

#### Chat C / Frontend Auth Boundary + Session Bootstrap

담당:

- `frontend/src/auth/*`
- `frontend/src/persistence/controller.ts`
- `frontend/src/config/env.ts`

#### Chat D / Frontend Workspace UI Wiring

담당:

- `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/routes/AuthCallbackPage.tsx`

#### Chat E / Recommendation Regression Guard

담당:

- `recommendation/` 직접 구현보다는 smoke / regression 확인
- 필요 시 test-only 대응

### 14.18 병렬 작업 시 고정 약속

- FE는 backend session endpoint contract를 임의 변경하지 않음
- BE는 frontend가 임시로 기대하는 auth response shape를 중간에 자주 뒤집지 않음
- Recommendation은 1차에서 범위 확장을 하지 않음
- `shared` 변경이 필요해지면 별도 승인/분리 스트림으로 빼는 것이 맞습니다

## detail-015 / Minor Node Drag Reparent-to-Last-Major 버그 수정 계획

### 15.1 증상

현재 major-minor 연결 상태에서 minor 노드를 이동하면,
의도와 다르게 마지막 major 노드에 다시 연결되는 경우가 있습니다.

이번 진단 기준으로는:

- 연결선 렌더 자체보다는
- 드래그 후 삽입 인덱스 계산과 parent 재추론 규칙이 어긋난 문제

로 보는 것이 맞습니다.

### 15.2 추정 원인

현재 프런트는 드롭 후 `targetInsertIndex`를 계산할 때
같은 레벨 노드의 center Y만 보고 anchor를 잡습니다.

문제는 “뒤에 같은 레벨 노드가 없는 경우”입니다.

현재 흐름:

1. `WorkspaceShell`이 같은 레벨 다음 anchor를 못 찾음
2. fallback으로 `orderedNodes.length`를 반환
3. `controller.moveNode()`는 이를 에피소드 맨 끝으로 이동하는 intent로 해석
4. `inferParentId()`가 마지막 available major를 parent로 재추론

즉 근본 문제는 backend canonicalization이 아니라,
프런트의 insert-index fallback이 너무 거칠다는 점입니다.

### 15.3 목표

목표는 다음 두 가지입니다.

1. minor node drag 시 드롭 의도와 parent 재추론 결과가 일치하도록 수정
2. “다음 같은 레벨 노드가 없음” 상황에서도 무조건 episode end로 가지 않게 수정

### 15.4 Frontend 디렉터리에서 처리할 부분

소유 디렉터리:

- `frontend/src/routes/`
- `frontend/src/persistence/`

#### Track A. 회귀 테스트 추가

우선 추가해야 할 테스트:

- minor 노드를 위/중간 major 근처로 이동했을 때 마지막 major로 재연결되지 않는지
- 같은 레벨 다음 노드가 없는 상태에서도 의도한 major parent를 유지하는지
- 수동 rewire 이후 drag가 explicit parent intent를 덮어쓰지 않는지

권장 파일:

- `frontend/src/routes/WorkspaceShell.test.tsx`
- 필요 시 `frontend/src/persistence/controller.test.ts`

#### Track B. `getInsertIndexForCanvasY()` fallback 수정

대상:

- `frontend/src/routes/WorkspaceShell.tsx`

핵심 수정 방향:

- 현재처럼 “다음 같은 레벨 노드가 없으면 episode end”로 보내지 않기
- 대신 드롭 Y 기준으로
  - 가장 가까운 같은 레벨 anchor
  - 또는 다음 상위 레벨 경계
  - 또는 같은 parent subtree 경계
  중 하나를 기준으로 삽입 인덱스를 계산

권장 방향:

- `orderedNodes.length`를 마지막 fallback로 남기되,
  그 전에 “현재 드롭 위치와 가장 가까운 상위 parent 구간”을 먼저 계산

#### Track C. parent inference와 drag intent 정렬

대상:

- `frontend/src/persistence/controller.ts`
- 필요 시 `frontend/src/persistence/nodeTree.ts`

필요 작업:

- `moveNode()`에 전달되는 insert intent가 실제 드롭 의도와 맞는지 재검토
- 필요하면 root subtree reorder에서 parent inference 기준을 보정
- 다만 1차는 `inferParentId()` 자체를 바꾸기보다,
  `WorkspaceShell`이 더 정확한 `targetInsertIndex`를 넘기게 만드는 쪽이 우선

#### Track D. 수동 rewire와 drag 상호작용 점검

이번 버그가 수동 rewire 경로와 섞여 있을 수 있으므로,
다음도 같이 확인해야 합니다.

- plain drag reorder
- explicit rewire 후 drag
- subtree drag

이 세 경로가 서로 parent intent를 덮어쓰지 않게 만드는 것이 목표입니다.

### 15.5 Backend 디렉터리에서 처리할 부분

1차 직접 수정 범위는 없음으로 둡니다.

이유:

- 현재 문제는 서버 canonical reorder 이전,
  프런트에서 잘못된 reorder intent를 만드는 쪽에 가깝습니다
- backend는 지금 전달받은 order/parent 정보를 canonicalize할 뿐,
  이번 증상의 직접 원인은 아닙니다

다만 확인 정도는 필요합니다.

권장:

- 프런트 수정 후 authenticated mode에서도 같은 증상이 재현되지 않는지 smoke 확인

### 15.6 Recommendation 디렉터리에서 처리할 부분

없음.

이번 버그는 recommendation과 무관합니다.
병렬 작업 시 recommendation 쪽은 no-touch가 맞습니다.

### 15.7 병렬 작업 분할

#### Chat A / Frontend Route Regression + Insert Index

담당:

- `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/routes/WorkspaceShell.test.tsx`

역할:

- 드래그 회귀 테스트 추가
- `getInsertIndexForCanvasY()` 및 drop intent 계산 보정

#### Chat B / Frontend Controller Parent Semantics Review

담당:

- `frontend/src/persistence/controller.ts`
- `frontend/src/persistence/nodeTree.ts`
- 관련 controller test

역할:

- `moveNode()` / `inferParentId()` 보조 검토
- route 쪽 수정만으로 부족할 때 최소 범위 보정

권장 순서:

- Chat A가 먼저 current failure를 고정
- Chat B는 route 수정만으로 해결 안 될 때만 들어가는 것이 안전

### 15.8 실행 순서

1. 현재 재현 시나리오를 route test로 고정
2. `WorkspaceShell`의 insert-index fallback 수정
3. 여전히 parent drift가 있으면 `controller.moveNode()` / `inferParentId()` 보정
4. guest mode / authenticated mode 둘 다 smoke 확인

### 15.9 테스트 게이트

#### route/UI

- minor drag 후 parent major가 기대대로 유지되는지
- middle/upper/lower 배치 모두 확인
- 마지막 major로 잘못 연결되는 회귀가 사라졌는지

#### controller

- insert index별 inferred parent가 기대대로 나오는지
- preserveParent / rewire interaction이 유지되는지

#### runtime smoke

- 실제 canvas에서 minor node를 여러 major 사이로 이동
- 연결선과 persisted parent가 일치하는지 확인

### 15.10 주의사항

- `WorkspaceShell.tsx`는 현재 병렬 수정 빈도가 높은 파일이라 single-writer가 안전합니다
- `inferParentId()`를 과하게 바꾸면 기존 reorder semantics가 깨질 수 있습니다
- 1차는 route의 drag intent 계산 수정이 우선이고,
  controller는 최소 보정만 하는 편이 리스크가 낮습니다

## detail-016 / Google 로그인 버튼 클릭 시 로그인 UI 미노출 원인 및 수정 계획

### 16.1 증상

현재 기대 UX는 다음과 같습니다.

1. 사용자가 `Sign in with Google` 버튼을 누름
2. Google 계정 선택 또는 로그인 팝업이 열림
3. credential을 받아 backend 세션으로 교환
4. authenticated 상태로 전환

하지만 현재 구현은 버튼을 눌러도
Google 로그인 UI가 열리지 않거나,
열리더라도 안정적으로 재현되지 않을 가능성이 있습니다.

### 16.2 확인된 원인

현재 코드/설정 기준으로 원인은 세 축입니다.

#### 원인 A. 프런트 `GOOGLE_CLIENT_ID` 미설정

현재 `frontend/.env`의 `VITE_GOOGLE_CLIENT_ID`가 비어 있으면,
`SessionAuthBoundary.signIn()`은 Google SDK를 열기 전에
`google_client_id_is_not_configured`로 바로 실패합니다.

즉 이 상태에서는 버튼을 눌러도
Google 로그인 UI가 뜰 수 없습니다.

#### 원인 B. 백엔드 `GOOGLE_CLIENT_ID` 미설정 가능성

백엔드도 Google ID token 검증 시
`GOOGLE_CLIENT_ID`를 사용합니다.

즉 프런트가 credential을 받아도
백엔드에 같은 client ID가 준비돼 있지 않으면
`/api/auth/google/login` 교환이 실패합니다.

이 경우 사용자는
“팝업이 떴다가 로그인 안 됨” 또는
“눌러도 결국 guest 상태 유지”처럼 느낄 수 있습니다.

#### 원인 C. 현재 프런트 sign-in 경로가 `prompt()` 기반

현재 `SessionAuthBoundary.signIn()`은
custom 버튼 클릭 후 `google.accounts.id.prompt()`를 호출합니다.

이 경로는 One Tap / prompt 표시 가능 여부에 따라
`not displayed`, `skipped` 같은 상태를 반환할 수 있습니다.
즉 “내 버튼을 누르면 항상 Google 로그인 팝업이 뜬다”는 UX와
완전히 같은 semantics가 아닙니다.

1차 진단 결론:

- 즉시 막는 직접 원인은 env 미설정
- 그 다음 구조적 원인은 `prompt()`를 custom click UX에 기대고 있는 점

### 16.3 목표

목표는 세 가지입니다.

1. 설정이 없으면 조용히 실패하지 않고 UI에서 즉시 드러나게 만들기
2. 설정이 있으면 로그인 버튼 클릭 후 예측 가능한 Google sign-in surface로 연결되게 만들기
3. backend token verification과 frontend sign-in entry가 같은 client 설정을 바라보게 만들기

### 16.4 Frontend 디렉터리에서 처리할 부분

소유 디렉터리:

- `frontend/src/auth/`
- `frontend/src/routes/`
- `frontend/src/config/`
- 필요 시 `frontend/src/persistence/`

#### Track A. 설정 누락 상태를 UI에서 명시

대상:

- `frontend/src/config/env.ts`
- `frontend/src/routes/WorkspaceShell.tsx`
- 필요 시 auth 관련 copy

할 일:

- `VITE_GOOGLE_CLIENT_ID` 미설정 상태를 명시적으로 인식
- 로그인 버튼을 눌렀을 때 무반응처럼 보이지 않게 처리
- 버튼 비활성화, 설정 안내 메시지, 또는 auth modal 안내 중 하나로 정리

1차 권장:

- `googleClientId`가 없으면
  `Sign in with Google` 진입점을 disabled 또는 explanatory state로 렌더
- click 시 조용히 throw하는 현재 UX는 제거

#### Track B. sign-in entry를 `prompt()` 의존에서 분리

대상:

- `frontend/src/auth/sessionAuthBoundary.ts`
- `frontend/src/routes/AuthCallbackPage.tsx`
- 필요 시 새 auth surface component

핵심 방향:

- 현재 custom 버튼 클릭 -> `prompt()` 호출 구조를 재검토
- 로그인 버튼 클릭 시
  전용 auth modal/page/sheet를 열고,
  그 안에서 공식 Google-rendered button을 노출하는 방식으로 전환 검토

이유:

- `prompt()`는 One Tap 보조 경로 성격이 강하고
- “사용자 클릭 시 항상 로그인 UI가 열린다”는 제품 기대와 완전히 일치하지 않습니다

권장안:

- Workspace 상단 버튼은 “auth surface를 여는 버튼” 역할만 수행
- 실제 Google sign-in 시작은 해당 surface 안의 GIS-rendered button이 담당

#### Track C. 프런트 auth error surface 정리

할 일:

- `google_client_id_is_not_configured`
- `google_identity_sdk_not_loaded`
- `google_prompt_not_displayed:*`
- `google_prompt_skipped`

같은 오류를 사용자/개발자 모두 식별 가능하게 정리

권장:

- route-level silent failure 제거
- dev 환경에서는 짧은 원인 메시지 노출
- production에서는 user-safe copy + console diagnostics 분리

#### Track D. 프런트 회귀 테스트

권장 파일:

- `frontend/src/auth/sessionAuthBoundary.test.ts`
- `frontend/src/routes/WorkspaceShell.test.tsx`

검증 포인트:

- client ID 미설정 시 무반응이 아니라 명시적 안내/disabled 처리되는지
- 설정된 경우 auth surface가 열리는지
- GIS button callback 성공 후 session bootstrap이 갱신되는지

### 16.5 Backend 디렉터리에서 처리할 부분

소유 디렉터리:

- `backend/src/auth/`
- `backend/src/config/`
- `backend/src/app.ts`
- `backend/.env.example`

#### Track A. backend 설정 readiness 명확화

할 일:

- `GOOGLE_CLIENT_ID` 미설정 상태에서 `/api/auth/google/login`이
  애매한 내부 오류로 보이지 않게 정리
- auth service startup / route path에서
  설정 누락을 더 명시적인 오류로 반환

권장:

- `google_auth_not_configured`
- `google_token_verification_failed`

정도로 error class를 구분

#### Track B. frontend와 backend client 설정 정렬

할 일:

- `frontend`의 `VITE_GOOGLE_CLIENT_ID`
- `backend`의 `GOOGLE_CLIENT_ID`

가 같은 Google OAuth client를 바라보도록
runtime setup 문서와 example env 정리

권장:

- `backend/.env.example`를 canonical source로 유지
- frontend `.env.example`에는 public client ID만 노출
- ENV 문서에 “둘은 같은 Google client를 기준으로 맞춰야 함” 명시

#### Track C. backend auth smoke 게이트

검증 포인트:

- 잘못된 credential 입력 시 명시적 오류가 오는지
- 올바른 credential이면 session cookie가 발급되는지
- 설정 누락 시 명확한 구성 오류가 오는지

### 16.6 Recommendation 디렉터리에서 처리할 부분

없음.

이번 이슈는 auth/login UI와 session exchange 문제이므로
recommendation은 no-touch가 맞습니다.

### 16.7 병렬 작업 분할

#### Chat A / Frontend Login Entry + Auth Surface

담당:

- `frontend/src/auth/sessionAuthBoundary.ts`
- `frontend/src/routes/WorkspaceShell.tsx`
- 필요 시 새 auth modal/page component

역할:

- login 버튼 클릭 UX 재정의
- `prompt()` 의존 축소 또는 제거
- Google-rendered button 진입 surface 정리

#### Chat B / Frontend Env/Errors/Test

담당:

- `frontend/src/config/env.ts`
- auth 관련 test
- 관련 copy / error handling

역할:

- 설정 누락/SDK 실패/error surface 정리
- 회귀 테스트 추가

#### Chat C / Backend Auth Readiness + Error Contract

담당:

- `backend/src/auth/*`
- `backend/src/config/env.ts`
- `backend/.env.example`

역할:

- `GOOGLE_CLIENT_ID` readiness/error 정리
- login endpoint 오류 분류 개선
- env/documentation alignment

#### Chat D / Recommendation

담당:

- 없음

역할:

- no-touch

### 16.8 실행 순서

1. 프런트/백엔드 env readiness부터 확인하고 누락 상태 UX를 명시
2. 프런트 sign-in entry를 `prompt()` 중심 경로에서 분리
3. Google-rendered button 기반 auth surface를 연결
4. backend login 오류를 명확히 분류
5. guest -> authenticated 전환 smoke 수행

### 16.9 테스트 게이트

#### Frontend

- `googleClientId` 없음: disabled 또는 안내 상태 확인
- `googleClientId` 있음: auth surface 노출 확인
- GIS callback 성공 시 authenticated bootstrap 반영 확인

#### Backend

- `GOOGLE_CLIENT_ID` 없음: 명시적 구성 오류
- 잘못된 credential: 명시적 verification 오류
- 정상 credential: session cookie 발급

#### Runtime smoke

- Workspace에서 로그인 버튼 클릭
- Google UI 진입 여부 확인
- 로그인 후 `/api/auth/session`이 authenticated 반환

### 16.10 주의사항

- 이 작업은 `detail-014`와 같은 auth hard-stop 범주입니다
- 특히 프런트 custom 버튼에서 Google UI를 “직접 강제 오픈”하는 식으로 우회하지 말고,
  Google 공식 sign-in surface semantics에 맞춰 정리하는 편이 안전합니다
- `WorkspaceShell.tsx`는 병렬 수정 충돌 가능성이 높으므로 single-writer가 안전합니다

## detail-017 / Google 로그인 성공 후 실제 DB 서비스 전환 계획

### 17.1 현재 상태 요약

로그인 성공 이후의 기반은 일부 이미 들어와 있습니다.

- backend에는 `POST /api/auth/google/login`, `GET /api/auth/session`, `POST /api/auth/logout`가 존재
- backend에는 `cloud_accounts`, `cloud_sessions`와 MySQL-backed auth/session store가 존재
- backend에는 인증 세션 전용 canonical persistence route인 `/api/persistence/projects*`가 존재
- frontend controller는 로그인 성공 후 `connectAuthenticatedSession(...)`로 guest snapshot을 cloud로 연결하려는 흐름이 존재

즉 “Google 로그인 자체”와 “MySQL 저장소 자체”는 0에서 새로 만드는 단계가 아니라,
이미 들어온 조각들을 실제 서비스 흐름으로 일관되게 연결하는 단계입니다.

### 17.2 확인된 핵심 갭

이번 기준에서 실제 DB 서비스 전환을 막는 핵심 갭은 다음입니다.

#### 갭 A. 프런트 cloud client가 아직 legacy accountId 경로 중심

현재 frontend `CloudPersistenceClient`는 대부분:

- `/api/persistence/accounts/:accountId/projects`
- `/api/persistence/accounts/:accountId/import`
- `/api/persistence/accounts/:accountId/projects/:projectId/sync`

형태를 사용합니다.

반면 backend는 이미 authenticated canonical route:

- `/api/persistence/projects`
- `/api/persistence/import`
- `/api/persistence/projects/:projectId/sync`

를 제공합니다.

즉 로그인 이후에도 프런트가 여전히 legacy path-account 모델에 묶여 있어,
“세션 기반 서비스”로 완전히 넘어갔다고 보기 어렵습니다.

#### 갭 B. 로그인 성공 후 guest -> authenticated cutover 정책이 UX로 명확하지 않음

현재 controller에는 `connectAuthenticatedSession(...)`가 있지만,
사용자 관점에서 다음이 명확히 정의돼 있어야 합니다.

- 로그인 직후 현재 로컬 작업물을 어떤 규칙으로 import할지
- 이미 cloud에 같은 project가 있으면 어느 쪽을 기준으로 할지
- 로그인 후 언제부터 local guest가 아니라 DB-backed source-of-truth가 되는지

이 전환 정책이 명확하지 않으면
“로그인은 됐는데 어디에 저장되는지 모르겠다”는 체감이 생깁니다.

#### 갭 C. 운영 readiness와 observability가 아직 약함

실서비스 기준으로는 다음이 명확해야 합니다.

- MySQL 연결 실패 시 startup/health가 어떻게 보이는지
- auth/session은 성공했지만 persistence가 MySQL에서 실패할 때 어떤 오류를 주는지
- 로그인이 성공한 사용자가 실제로 DB 프로젝트 목록/동기화로 넘어가는지 추적 가능한지

#### 갭 D. recommendation은 1차 전환과 직접 무관

recommendation은 session/account canonical 전환의 직접 주체가 아닙니다.
이번 1차에서는 regression guard만 두는 것이 맞습니다.

### 17.3 목표

이번 전환의 목표는 다음 세 가지입니다.

1. Google 로그인 성공 후 authenticated 사용자의 canonical source-of-truth를 MySQL로 고정
2. frontend가 accountId path가 아니라 session-scoped persistence를 우선 사용하도록 전환
3. guest 로컬 작업물 import, cloud recovery, 이후 sync까지 서비스 흐름을 사용자 기준으로 일관되게 만들기

### 17.4 Frontend 디렉터리에서 처리할 부분

소유 디렉터리:

- `frontend/src/persistence/`
- `frontend/src/auth/`
- `frontend/src/routes/`

#### Track A. session-scoped cloud client 전환

대상:

- `frontend/src/persistence/cloudClient.ts`
- `frontend/src/persistence/controller.ts`

할 일:

- authenticated 상태에서는 `/api/persistence/projects*` canonical route를 우선 사용
- guest/legacy 호환이 필요한 구간만 accountId path를 fallback 또는 migration bridge로 유지
- 가능한 한 frontend API surface도 “session owns account scope” 모델에 맞춰 정리

권장:

- `CloudPersistenceClient`에 authenticated 전용 메서드를 추가하거나
- 내부적으로 session mode에 따라 route를 선택하게 만듦

#### Track B. 로그인 직후 DB cutover UX 정리

대상:

- `frontend/src/persistence/controller.ts`
- `frontend/src/routes/WorkspaceShell.tsx`

할 일:

- 로그인 성공 직후 `connectAuthenticatedSession(...)` 흐름을 사용자에게 보이게 정리
- 현재 로컬 snapshot import / 기존 cloud snapshot fetch / cloud recovery 중 어떤 상태인지 표시
- import 실패 / account mismatch / authentication required / mysql failure에 대한 UI copy 정리

권장:

- `syncStatus`에 기반한 explicit authenticated import state 유지
- 첫 로그인 후 “cloud로 연결 중” 상태를 분명히 보여줌

#### Track C. guest -> cloud import 정책 UI 정리

할 일:

- 현재 로컬 프로젝트를 자동 import할지
- 같은 project id가 DB에 이미 있으면 remote 우선인지 local import 우선인지
- 복구(recover) 버튼 의미를 authenticated 모델에 맞게 재정의

1차 권장:

- 로그인 직후:
  - 같은 account에 linked project가 있으면 remote fetch 우선
  - 없으면 local snapshot import
- 충돌 merge는 1차 범위에서 하지 않고,
  remote 우선 또는 explicit recovery로 단순화

#### Track D. 프런트 회귀 테스트

권장 파일:

- `frontend/src/persistence/controller.test.ts`
- 필요 시 `frontend/src/routes/WorkspaceShell.test.tsx`

검증 포인트:

- 로그인 성공 후 controller가 authenticated session을 반영하는지
- local snapshot이 import되거나 remote snapshot으로 교체되는지
- 이후 sync가 session-scoped canonical route를 타는지

### 17.5 Backend 디렉터리에서 처리할 부분

소유 디렉터리:

- `backend/src/auth/`
- `backend/src/persistence/`
- `backend/src/config/`
- `backend/mysql/init/`

#### Track A. MySQL canonical authenticated mode 고정

할 일:

- authenticated route(`/api/persistence/projects*`)를 canonical public contract로 확정
- session account 기반으로만 account scope를 resolve
- authenticated 상태에서 file store fallback이 일어나지 않도록 정책을 명확히 유지

권장:

- session이 있으면 무조건 MySQL store
- guest는 기존 file/local bridge 유지

#### Track B. auth + persistence readiness 강화

할 일:

- MySQL 연결 실패 시 auth/session/persistence가 어떤 상태인지 분명히 드러나게 정리
- `google_auth_not_configured`, `authentication_required`, `account_mismatch`처럼
  persistence/auth 오류를 운영 관점에서 더 구분 가능하게 유지
- 필요하면 health/readiness에 MySQL/auth readiness를 분리

#### Track C. legacy accountId route의 점진적 축소

할 일:

- `/api/persistence/accounts/:accountId/*`는 migration bridge로 남기되,
  authenticated 서비스의 기본 계약은 아님을 명확히 함
- 이후 프런트 전환이 끝나면 deprecation 또는 내부 fallback-only 경로로 낮춤

1차에서는:

- 삭제하지 않음
- frontend 전환 완료 후 단계적 축소 계획을 별도 관리

#### Track D. DB schema / session lifecycle 검증

할 일:

- `cloud_accounts`, `cloud_sessions`, `cloud_projects` 및 normalized tables가
  로그인 후 import/sync/read 흐름을 모두 수용하는지 검증
- 세션 만료/로그아웃 후 `cloud_sessions` 정리 정책 점검

### 17.6 Recommendation 디렉터리에서 처리할 부분

1차 직접 구현 범위는 없음.

역할은 다음 정도로 제한합니다.

- auth/session + MySQL cutover 후 recommendation route regression 확인
- account/session 전환이 recommendation 호출에 부수 영향이 없는지 smoke 확인

즉 이번 전환의 recommendation 소유 범위는 regression guard only입니다.

### 17.7 디렉터리별 병렬 작업 분할

#### Chat A / Frontend Session-Scoped Persistence

담당:

- `frontend/src/persistence/cloudClient.ts`
- `frontend/src/persistence/controller.ts`

역할:

- session-scoped persistence route adoption
- 로그인 직후 import/fetch/cutover 흐름 정리

#### Chat B / Frontend Workspace/Auth UX

담당:

- `frontend/src/routes/WorkspaceShell.tsx`
- 필요 시 `frontend/src/auth/*`

역할:

- 로그인 성공 후 상태 표시
- authenticated cloud 연결/오류/복구 UX 정리

주의:

- `WorkspaceShell.tsx`는 single-writer가 안전

#### Chat C / Backend Auth + Persistence Canonicalization

담당:

- `backend/src/auth/*`
- `backend/src/persistence/*`
- `backend/src/config/*`

역할:

- authenticated canonical route 고정
- readiness/error/health 정리
- legacy accountId route deprecation bridge 유지

#### Chat D / Recommendation Regression Guard

담당:

- `recommendation/` 직접 구현 없음
- regression/smoke만 수행

### 17.8 실행 순서

1. backend에서 authenticated canonical persistence 계약을 다시 고정
2. frontend cloud client를 session-scoped route로 전환
3. 로그인 직후 guest -> authenticated cutover UX를 정리
4. MySQL readiness / health / auth-persistence error surface를 정리
5. recommendation regression 포함 서비스 smoke 수행

### 17.9 테스트 게이트

#### Frontend

- 로그인 성공 후 authenticated session bootstrap
- local snapshot import 또는 remote fetch
- 이후 mutation sync가 session-scoped route를 타는지 확인

#### Backend

- `/api/auth/google/login` 후 `/api/auth/session`이 authenticated 반환
- `/api/persistence/projects`가 세션 account 기준으로 동작
- MySQL에 `cloud_accounts`, `cloud_sessions`, `cloud_projects` 데이터가 실제 생성/변경되는지 확인

#### Runtime smoke

- guest 상태에서 작업 후 로그인
- 현재 프로젝트가 계정 DB로 import 또는 연결되는지 확인
- 새로고침 후 같은 계정으로 작업물이 복원되는지 확인
- 로그아웃 시 guest-local로 복귀하는지 확인

### 17.10 주의사항

- 이 작업은 auth/session/schema/persistence를 동시에 건드리는 hard-stop 범주입니다
- `shared` 계약 변경은 1차에서 피하고,
  frontend/backend 내부 경로 정리로 우선 해결하는 편이 안전합니다
- legacy accountId route를 너무 빨리 제거하면 기존 local/standalone 흐름이 깨질 수 있으므로,
  1차는 bridge 유지가 맞습니다

## detail-018 / Google 로그인 후 `fetch Illegal invocation` 오류 대응 계획

### 18.1 증상

현재 Google 로그인 UI 자체는 열리고 credential도 받아오는 것으로 보이지만,
그 직후 앱이 authenticated 모드로 전환되지 않고
다음 오류가 발생합니다.

- `Failed to execute 'fetch' on 'Window': Illegal invocation`

즉 문제는 Google 계정 선택 이전이 아니라,
credential을 backend `/api/auth/google/login`으로 교환하는 프런트 경로에 가깝습니다.

### 18.2 추정 원인

현재 `SessionAuthBoundary`는 생성자에서:

- `options.fetchImpl ?? fetch`

형태로 raw global `fetch`를 보관합니다.

이후 인스턴스 메서드에서 `this.fetchImpl(...)`로 호출하는데,
일부 브라우저/웹뷰 환경에서는
native `Window.fetch`가 원래의 호출 컨텍스트 없이 불리면
`Illegal invocation`를 발생시킬 수 있습니다.

반면 같은 프런트 계층의 `CloudPersistenceClient`는 이미
기본 fetch를 `(...args) => fetch(...args)`로 감싸고 있어
이 문제를 피하고 있습니다.

1차 진단 결론:

- Google 로그인 자체 문제 아님
- backend auth token verification 문제로 보기 전,
  프런트 credential exchange request가 unbound fetch로 먼저 죽는 쪽이 유력

### 18.3 목표

목표는 세 가지입니다.

1. 로그인 후 credential exchange가 브라우저 바인딩 오류 없이 `/api/auth/google/login`까지 도달하게 만들기
2. auth boundary와 cloud client의 fetch 주입 규칙을 일관되게 맞추기
3. 로그인 성공 후 실제 session bootstrap이 authenticated로 전환되는지 회귀 테스트로 고정하기

### 18.4 Frontend 디렉터리에서 처리할 부분

소유 디렉터리:

- `frontend/src/auth/`
- `frontend/src/persistence/`
- 필요 시 `frontend/src/routes/`

#### Track A. `SessionAuthBoundary` fetch 바인딩 수정

대상:

- `frontend/src/auth/sessionAuthBoundary.ts`

핵심 수정:

- raw `fetch` 참조를 직접 저장하지 않고
  `(...args) => fetch(...args)` 형태의 wrapper로 저장

권장:

- `CloudPersistenceClient`와 같은 규칙으로 통일
- `fetchImpl`이 외부에서 주입될 때도 동일한 호출 계약을 유지

#### Track B. 로그인 교환 경로 회귀 테스트 추가

권장 파일:

- `frontend/src/auth/sessionAuthBoundary.test.ts`
- 필요 시 `frontend/src/routes/WorkspaceShell.test.tsx`

검증 포인트:

- 기본 global `fetch`를 사용하는 환경에서도 `Illegal invocation`가 나지 않는지
- Google credential 응답 이후 `/api/auth/google/login` 요청이 실제로 발생하는지
- 성공 응답 시 `AuthSession.mode === "authenticated"`로 정규화되는지

#### Track C. 로그인 후 상태 전환 smoke 정리

대상:

- `frontend/src/persistence/controller.ts`
- 필요 시 `frontend/src/routes/WorkspaceShell.tsx`

할 일:

- `controller.signIn()` 이후 session state가 실제로 바뀌는지 확인
- `connectAuthenticatedSession(...)`가 fetch 바인딩 오류 없이 이어지는지 점검
- auth error surface가 fetch binding 문제를 일반 로그인 실패와 구분할 필요가 있는지 검토

### 18.5 Backend 디렉터리에서 처리할 부분

1차 직접 수정 범위는 없음.

이유:

- 현재 증상은 backend route에 도달하기 전 프런트 호출 단계에서 발생할 가능성이 높습니다
- backend `/api/auth/google/login`과 session store는 이후 smoke 검증 대상이지,
  현재 오류의 1차 원인으로 보이지 않습니다

다만 확인은 필요합니다.

권장:

- 프런트 수정 후 `/api/auth/google/login`이 실제로 hit되는지 확인
- 성공 시 `/api/auth/session`이 authenticated를 반환하는지 smoke 수행

### 18.6 Recommendation 디렉터리에서 처리할 부분

없음.

이번 이슈는 auth/session exchange 경로와만 관련 있으므로
recommendation은 no-touch가 맞습니다.

### 18.7 병렬 작업 분할

#### Chat A / Frontend Auth Boundary Fix

담당:

- `frontend/src/auth/sessionAuthBoundary.ts`
- 관련 auth test

역할:

- unbound fetch 문제 수정
- auth boundary fetch contract 정리

#### Chat B / Frontend Login State Smoke

담당:

- `frontend/src/persistence/controller.ts`
- 필요 시 `frontend/src/routes/WorkspaceShell.tsx`

역할:

- 로그인 성공 후 authenticated 전환 smoke
- fetch binding 수정 이후 후속 상태 전이 확인

#### Chat C / Backend Verification Smoke

담당:

- `backend/src/auth/routes.ts`
- `backend/src/auth/service.ts`

역할:

- 프런트 수정 후 route hit 및 session issuance 확인
- 직접 구현보다는 smoke/verification 위주

#### Chat D / Recommendation

담당:

- 없음

역할:

- no-touch

### 18.8 실행 순서

1. `SessionAuthBoundary`의 fetch 바인딩 수정
2. auth boundary 단위 테스트 추가
3. 로그인 후 `/api/auth/google/login` 요청 발생 여부 확인
4. `/api/auth/session` authenticated 응답 확인
5. 이후 `detail-017`의 DB cutover 작업으로 연결

### 18.9 테스트 게이트

#### Frontend

- auth boundary 단위 테스트
- 로그인 성공 후 authenticated 전환 확인
- fetch 바인딩 오류 재발 없음 확인

#### Backend

- 프런트 수정 후 `/api/auth/google/login` 성공
- session cookie 발급
- `/api/auth/session` authenticated 반환

#### Runtime smoke

- Google 로그인 완료
- 앱이 guest에서 authenticated로 전환
- 새로고침 후 세션 유지 확인

### 18.10 주의사항

- 이 작업은 auth 경로를 건드리므로 hard-stop 범주 안에서 최소 변경으로 처리하는 것이 맞습니다
- 1차는 fetch 바인딩 문제만 정확히 고치고,
  그 다음에 `detail-017`의 실제 DB cutover로 넘어가는 것이 안전합니다

## detail-019 / 인증 상태 변화 기준 로컬 캐시 스코프 분리 및 이전 계정 노출 방지

### 19.1 문제 요약

현재 구조는 로그인 자체와 별개로,
워크스페이스 로컬 캐시가 인증 계정 기준으로 분리되지 않아
다음 문제가 발생할 수 있습니다.

- authenticated 부트 시 이전 guest/local snapshot이 먼저 렌더됨
- A 계정 로그아웃 후에도 A 계정 snapshot이 그대로 남음
- B 계정 로그인 시 이전 guest 또는 다른 사용자 cache가 import 후보로 섞일 수 있음
- project/episode 단위 UI cache도 account scope가 없어 교차 노출 가능성이 남음

### 19.2 확인된 원인

현재 프런트 구조 기준 원인은 네 가지입니다.

#### 원인 A. `LocalPersistenceStore`가 전역 단일 namespace

현재 로컬 저장은 `storagePrefix`만 기준으로 저장되고,
guest / account / accountId별 scope가 분리되지 않습니다.

즉 한 브라우저에서:

- guest 작업물
- A 계정 로컬 working cache
- B 계정 로컬 working cache

가 같은 key 공간을 공유할 수 있습니다.

#### 원인 B. authenticated 부트 전에 로컬 snapshot을 먼저 읽음

`initializeInternal()`은 세션을 읽은 뒤에도
현재 로컬 registry/snapshot을 먼저 불러와 state에 넣고,
그 다음 `connectAuthenticatedSession(...)`를 수행합니다.

이 구조에서는
현재 로그인 계정과 무관한 이전 캐시가
첫 렌더 순간 잠깐이라도 보일 수 있습니다.

#### 원인 C. 로그아웃 시 이전 authenticated snapshot을 그대로 유지

현재 sign-out 이후에도
기존 state snapshot이 그대로 남고 session만 guest로 바뀌는 경로가 존재합니다.

이 경우:

- A 계정 로그아웃 직후 A 데이터가 계속 보임
- 이후 B 로그인 직전까지 이전 계정 화면이 유지될 수 있음

#### 원인 D. project/episode UI localStorage 키도 account scope 없음

`WorkspaceShell`의 폴더/핀/오브젝트 핀/노드 크기 등
프로젝트별 UI 저장값도 account scope 없이 저장됩니다.

즉 스냅샷 분리만으로는 충분하지 않고,
적어도 계정 간 재사용 가능성이 있는 UI cache도 같이 분리하는 편이 안전합니다.

### 19.3 목표

목표는 다음입니다.

1. authenticated 상태에서는 반드시 현재 account scope의 캐시/원격 데이터만 사용
2. 이전 guest 또는 다른 account cache가 현재 authenticated 화면에 노출되지 않게 처리
3. sign-out / sign-in / account switch 시 snapshot과 pending sync가 scope 단위로 분리되게 처리
4. 첫 렌더에서 이전 계정 데이터가 잠깐이라도 보이지 않게 보호

### 19.4 수정 전략

채택 전략은 다음 조합입니다.

#### 전략 1. 로컬 영속 저장을 session/account scope로 분리

- guest scope
- `account:<accountId>` scope
- bootstrap/temporary neutral scope

를 구분해 registry / snapshot / linkage / pending sync를 나눕니다.

#### 전략 2. authenticated 부트는 guest cache fallback 금지

로그인된 세션으로 부트할 때는
guest scope를 먼저 읽지 않습니다.

우선순위:

1. current account scoped local cache
2. current account remote project
3. 둘 다 없으면 current account 기준 신규 bootstrap

#### 전략 3. sign-out 시 이전 account snapshot 즉시 제거

sign-out 직후에는 이전 authenticated snapshot을 유지하지 않고,
안전한 guest bootstrap 상태로 전환합니다.

즉 “이전 계정 화면을 유지한 채 session만 guest로 바뀌는 상태”를 없앱니다.

#### 전략 4. project/episode UI localStorage도 account scope 포함

프로젝트별/에피소드별 UI cache key에
현재 cache scope를 포함시켜
다른 계정의 node-size / folder / pin 정보가 섞이지 않게 합니다.

### 19.5 Frontend 디렉터리에서 처리할 부분

소유 디렉터리:

- `frontend/src/persistence/`
- `frontend/src/routes/`
- 필요 시 `frontend/src/auth/`

#### Track A. persistence cache scope 분리

대상:

- `frontend/src/persistence/localStore.ts`
- `frontend/src/persistence/controller.ts`
- `frontend/src/persistence/flushQueue.ts`

할 일:

- `LocalPersistenceStore`에 current cache scope 개념 도입
- registry / snapshot / linkage / pending sync를 scope-aware key로 저장
- flush queue가 scope 전환 시 다른 account의 pending operation을 재사용하지 않게 처리

#### Track B. authenticated bootstrap 보호

대상:

- `frontend/src/persistence/controller.ts`

할 일:

- authenticated session 부트 시 guest cache 선렌더 제거
- current account scoped local cache 또는 remote project만 대상으로 bootstrap
- 이전 사용자 데이터가 state에 들어가기 전에 auth-scoped source를 먼저 고름

#### Track C. signOut / account switch 보호

대상:

- `frontend/src/persistence/controller.ts`

할 일:

- sign-out 시 이전 authenticated snapshot 제거
- 새 guest bootstrap 상태로 전환
- 이후 다른 계정 로그인 시 이전 account snapshot import가 섞이지 않게 차단

#### Track D. UI localStorage key scope 분리

대상:

- `frontend/src/routes/WorkspaceShell.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/*`

할 일:

- 폴더/핀/오브젝트 핀/노드 크기/캔버스 UI key에 cache scope 반영
- 같은 project id가 다른 계정에서 재사용돼도 UI cache가 섞이지 않게 처리

### 19.6 Backend 디렉터리에서 처리할 부분

1차 직접 구현 범위는 거의 없음.

이유:

- 현재 문제의 직접 원인은 frontend local cache scope와 bootstrap 순서입니다
- backend는 이미 session account 기준 canonical persistence route를 제공하고 있습니다

다만 smoke는 필요합니다.

권장:

- account A / B 로그인 후 `/api/auth/session`과 `/api/persistence/projects`가
  올바른 account 기준으로 응답하는지만 확인

### 19.7 Recommendation 디렉터리에서 처리할 부분

없음.

이번 문제는 recommendation과 직접 무관합니다.
regression guard만 고려하면 충분합니다.

### 19.8 작업 스트림 및 파일 소유 분리

#### Stream A / Frontend Persistence Scope

개발자 유형:

- Frontend persistence owner

목표:

- scope-aware local persistence
- authenticated bootstrap / sign-out cache isolation

파일 소유:

- `frontend/src/persistence/localStore.ts`
- `frontend/src/persistence/controller.ts`
- 필요 시 `frontend/src/persistence/flushQueue.ts`

선행조건:

- 현재 auth/session bootstrap 경로 파악 완료

병렬 여부:

- 가능하지만 `controller.ts`는 single-writer 권장

#### Stream B / Frontend UI Cache Scope

개발자 유형:

- Frontend workspace/UI owner

목표:

- project/episode UI cache key를 account scope 기준으로 분리

파일 소유:

- `frontend/src/routes/WorkspaceShell.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/*`

선행조건:

- Stream A에서 cache scope 식별자 규칙 확정

병렬 여부:

- `WorkspaceShell.tsx` 충돌 위험이 크므로 Stream A와 순차 통합 권장

#### Stream C / Backend Verification Smoke

개발자 유형:

- Backend verification owner

목표:

- frontend 수정 후 account-scoped canonical route smoke 확인

파일 소유:

- 직접 구현 없음
- 필요 시 backend test/smoke command만 수행

선행조건:

- Stream A/B 완료 후

병렬 여부:

- 구현과 병렬 가능하지만 결과 해석은 마지막 통합 시점 권장

### 19.9 의존성 / 병합 순서

1. Stream A
2. Stream B
3. Stream C

이유:

- cache scope 규칙이 먼저 정해져야
  UI localStorage key도 같은 규칙으로 맞출 수 있습니다

### 19.10 검증 포인트

필수 검증:

- 비로그인 -> Google 로그인
- A 로그인 -> 로그아웃 -> B 로그인
- A 로그인 상태에서 새로고침
- 캐시가 남아 있는 상태에서 재로그인
- 첫 렌더에서 이전 사용자 데이터 순간 노출 여부

권장 추가 검증:

- authenticated 부트 시 guest legacy cache가 current account에 import되지 않는지
- sign-out 후 account snapshot이 즉시 사라지는지
- account-scoped UI localStorage key가 분리되는지

### 19.11 리스크 및 충돌 가능성

- `controller.ts`와 `WorkspaceShell.tsx`는 현재 병렬 수정 충돌 가능성이 높습니다
- bootstrap 로직을 과하게 바꾸면 guest import continuity가 약해질 수 있습니다
- `shared` 변경 없이 처리하는 1차 전략이라,
  route contract는 그대로 두고 frontend storage/session 경계만 수정해야 합니다

### 19.12 구현 반영 상태

Stream A 반영:

- `LocalPersistenceStore`에 `guest` / `account:<id>` 스코프를 추가
- `WorkspacePersistenceController`가 초기화 / 로그인 / 로그아웃마다 cache scope를 전환
- authenticated bootstrap은 guest cache 선로딩 대신 현재 account scope 로컬/원격 상태만 사용
- 로그아웃 시 이전 authenticated snapshot을 유지하지 않고 guest workspace로 즉시 교체

Stream B 반영:

- `WorkspaceShell.tsx`의 폴더 / 에피소드 핀 / 오브젝트 핀 / 노드 크기 key에 cache scope 반영
- 같은 project/episode id가 다른 계정에서 재사용돼도 UI cache가 섞이지 않게 수정

Stream C 반영:

- backend 직접 수정은 없음
- frontend build smoke와 controller/auth focused test로 1차 검증 수행

남은 확인:

- 실제 브라우저에서 A -> logout -> B 전환 시 UI localStorage까지 완전히 분리되는지 최종 수동 smoke
- 현재 `WorkspaceShell` route suite의 기존 회귀 실패들과 분리된 상태에서 full frontend lint/test를 다시 녹일지 추가 판단 필요

## detail-020 / 신규 authenticated 계정은 샘플 시드 없이 빈 상태로 시작하도록 전환

### 20.1 문제 요약

현재 authenticated 계정 부트스트랩은 DB에 프로젝트가 하나도 없을 때도
샘플 워크스페이스를 자동 생성합니다.

직접 원인:

- `frontend/src/persistence/controller.ts`
  - `bootstrapAuthenticatedSession(...)`
  - `listProjects()` 결과가 비어 있으면 `seedWorkspace()` 호출
  - 예외 경로에서도 `seedWorkspace()` 호출

이 구조 때문에
새 Google 계정이 실제 DB에는 비어 있어도
UI에는 샘플 에피소드/노드가 보입니다.

### 20.2 목표

- authenticated 계정에 프로젝트가 없으면 truly empty state로 시작
- guest 모드의 샘플 시드 정책과 authenticated 모드의 empty policy를 분리
- 서버 오류와 빈 계정을 구분
- DB가 비어 있을 때 임의 샘플/초기 더미를 import하지 않기

### 20.3 수정 전략

채택 전략:

- guest 전용 `sample seed`
- authenticated 전용 `empty workspace shell` 또는 `no project selected` 상태

핵심 방향:

1. `seedWorkspace()`는 guest 전용으로 제한
2. authenticated bootstrap은 `listProjects() === 0`이면
   샘플을 만들지 않고 empty authenticated state로 진입
3. authenticated bootstrap의 오류 경로도
   샘플 fallback 대신 empty/error state로 분리
4. UI는 empty authenticated state에서
   “아직 프로젝트가 없음”을 보여주고,
   최초 생성 액션으로만 새 프로젝트를 만들게 전환

### 20.4 대안 비교

대안 A:

- 빈 계정에도 빈 프로젝트를 자동 생성

장점:

- 기존 `snapshot always exists` 가정과 잘 맞음

단점:

- DB에 실제로 아무것도 없는 상태와 다름
- 로그인만 해도 새 프로젝트가 생긴 것처럼 보임

대안 B:

- authenticated empty state를 별도로 도입

장점:

- “DB가 비면 화면도 빈 상태”라는 기대와 정확히 일치
- 서버 canonical state와 UI 의미가 맞음

단점:

- `snapshot/linkage/active project`가 nullable일 수 있는 경계 정리가 필요

채택:

- 대안 B

이유:

- 사용자가 기대하는 제품 의미와 맞고,
  실제 DB-backed 서비스의 canonical 해석과도 일치합니다

### 20.5 Frontend 디렉터리에서 처리할 부분

개발자 유형:

- Frontend persistence owner
- Frontend workspace/UI owner

목표:

- authenticated empty state 도입
- guest sample seed와 authenticated bootstrap 분리
- empty state에서 이전/샘플 데이터가 보이지 않게 처리

수정 대상:

- `frontend/src/persistence/controller.ts`
- `frontend/src/persistence/sampleWorkspace.ts`
- `frontend/src/routes/WorkspaceShell.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/*`
- `frontend/src/persistence/controller.test.ts`
- 필요 시 `frontend/src/routes/WorkspaceShell.test.tsx`

할 일:

- `seedWorkspace()` 호출 경계를 guest 전용으로 축소
- authenticated bootstrap에서 `cloudProjects.projects.length === 0`이면
  empty authenticated state로 전환
- 오류 경로에서도 샘플 시드 대신
  empty/error 상태를 명확히 분리
- UI가 empty authenticated state를 렌더할 수 있게
  첫 렌더 보호와 CTA를 정리

### 20.6 Backend 디렉터리에서 처리할 부분

개발자 유형:

- Backend verification owner

목표:

- “빈 계정이면 빈 프로젝트 목록 반환” 계약을 smoke로 확인

수정 대상:

- 직접 구현은 1차 없음
- 필요 시 `backend/src/persistence/routes.integration.test.ts`

할 일:

- 신규 계정의 `/api/persistence/projects`가 빈 배열을 반환하는지 확인
- frontend가 빈 응답을 샘플 생성 트리거로 오해하지 않도록
  계약 해석만 검증

### 20.7 Recommendation 디렉터리에서 처리할 부분

없음.

이번 문제는 recommendation과 무관합니다.

### 20.8 작업 스트림 및 파일 소유 분리

#### Stream A / Frontend Persistence Empty-State Cutover

개발자 유형:

- Frontend persistence owner

목표:

- authenticated bootstrap에서 샘플 자동 생성 제거
- empty authenticated state 정의

파일 소유:

- `frontend/src/persistence/controller.ts`
- 필요 시 `frontend/src/persistence/sampleWorkspace.ts`
- `frontend/src/persistence/controller.test.ts`

선행조건:

- `detail-019` cache scope 분리 반영 완료

병렬 여부:

- 가능하지만 `controller.ts`는 single-writer 권장

#### Stream B / Frontend Empty UI Rendering

개발자 유형:

- Frontend workspace/UI owner

목표:

- project 0개인 authenticated 상태의 첫 화면 정리

파일 소유:

- `frontend/src/routes/WorkspaceShell.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/*`

선행조건:

- Stream A에서 empty authenticated state shape 확정

병렬 여부:

- Stream A와 순차 통합 권장

#### Stream C / Backend Verification Smoke

개발자 유형:

- Backend verification owner

목표:

- 빈 계정 contract smoke

파일 소유:

- 구현 없음
- 필요 시 backend integration test만 보강

선행조건:

- Stream A/B 완료 후

병렬 여부:

- 구현과 병렬 가능하지만 최종 해석은 마지막 권장

### 20.9 의존성 / 병합 순서

1. Stream A
2. Stream B
3. Stream C

이유:

- empty authenticated state의 데이터 shape가 먼저 정해져야
  UI 렌더와 smoke 검증이 따라갈 수 있습니다

### 20.10 검증 포인트

필수 검증:

- 신규 Google 계정 로그인 -> 프로젝트 0개 -> 빈 상태 표시
- A 계정(프로젝트 있음) -> 로그아웃 -> B 계정(프로젝트 없음) -> 빈 상태 표시
- 프로젝트 0개인 계정에서 새로고침 -> 여전히 빈 상태
- backend 오류와 빈 계정이 서로 다른 메시지/상태로 보이는지

권장 추가 검증:

- guest 모드에서는 기존 sample seed가 유지되는지
- “새 프로젝트 만들기” 액션이 있을 경우 그 시점에만 새 워크스페이스가 생성되는지

### 20.11 리스크 및 충돌 가능성

- `snapshot always exists` 가정이 넓게 퍼져 있으면 생각보다 영향 범위가 클 수 있습니다
- 빈 상태를 `null snapshot`으로 둘지, `empty snapshot shell`로 둘지에 따라 수정량이 달라집니다
- `WorkspaceShell.tsx`는 현재 다른 작업도 많아 충돌 위험이 큽니다
- guest sample seed UX를 보존하면서 authenticated empty만 바꾸려면
  분기 조건을 명확히 유지해야 합니다

## detail-021 / 로그인 및 로그아웃 전환 시 샘플 워크스페이스 유입 차단

### 21.1 문제 요약

현재 branch에는 `authenticated-empty` 상태와
`createWorkspaceFromEmptyState()`가 일부 들어갔지만,
로그인/로그아웃 전환 경로에는 여전히 샘플 워크스페이스 유입 지점이 남아 있습니다.

직접 원인:

1. `signIn()`
   - guest 상태의 `current.snapshot`을 그대로
     `connectAuthenticatedSession(session, current.snapshot, current.linkage)`에 넘깁니다
   - guest snapshot이 샘플이면 새 authenticated 계정으로 import될 수 있습니다

2. `signOut()`
   - 여전히 `seedWorkspace()`를 호출해 guest로 전환하자마자
     샘플 에피소드 9/10/11/12를 다시 만듭니다

3. guest scope local cache
   - 과거에 한번 seed된 guest sample이 local cache에 남아 있으면
     이후 guest 부트에서도 계속 재사용될 수 있습니다

즉 지금 보이는 에피소드 9/10/11/12는
단순히 DB에 있는 데이터가 아니라
sample workspace가 auth transition 경로에 섞여 들어오는 문제입니다.

### 21.2 목표

- 로그인 시 guest sample snapshot이 authenticated account로 import되지 않게 하기
- 로그아웃 시 sample workspace를 자동 생성하지 않게 하기
- 기존 guest scope에 남아 있던 sample cache가 다시 화면에 나타나지 않게 하기
- “새 계정 / 로그아웃 직후”에는 mock episodes 9/10/11/12가 보이지 않게 하기

### 21.3 수정 전략

핵심 전략:

1. 로그인은 `guest current snapshot import`가 아니라
   `authenticated bootstrap / authenticated local scope / remote canonical`만 보게 수정

2. 로그아웃은 `seedWorkspace()`가 아니라
   `guest local workspace restore or empty guest state`로 바꿈

3. guest legacy sample cache는
   식별 가능한 sample signature이면 무효화하거나
   최소한 auth transition에서는 복원하지 않게 제한

### 21.4 원인 세부 분석

로그인 경로:

- `frontend/src/persistence/controller.ts`
  - `signIn()`
  - `current.snapshot`을 그대로 `connectAuthenticatedSession(...)`에 전달
- 이때 현재 guest snapshot이 sample이면
  새 authenticated account에 import될 수 있습니다

로그아웃 경로:

- `frontend/src/persistence/controller.ts`
  - `signOut()`
  - `seedWorkspace()`를 직접 호출

sample source:

- `frontend/src/persistence/sampleWorkspace.ts`
  - Episode 12 / 11 / 10 / 9

### 21.5 Frontend 디렉터리에서 처리할 부분

개발자 유형:

- Frontend persistence owner
- Frontend workspace/UI owner

목표:

- auth transition에서 sample 유입 차단
- guest/auth empty state 정리

수정 대상:

- `frontend/src/persistence/controller.ts`
- `frontend/src/persistence/localStore.ts`
- `frontend/src/persistence/sampleWorkspace.ts`
- 필요 시 `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/persistence/controller.test.ts`

할 일:

- `signIn()`이 guest snapshot을 무조건 import하지 않도록 변경
- `signOut()`에서 `seedWorkspace()` 제거
- guest local cache가 비어 있으면 empty guest state로 전환
- 기존 guest sample cache 식별/무효화 전략 추가
- 로그인/로그아웃 전환 regression test 추가

### 21.6 Backend 디렉터리에서 처리할 부분

개발자 유형:

- Backend verification owner

목표:

- frontend가 sample import 없이도
  빈 계정 contract를 올바르게 해석하는지 smoke 검증

수정 대상:

- 직접 구현 없음
- 필요 시 integration smoke만 수행

할 일:

- 신규 계정의 `/api/persistence/projects`가 빈 배열인지 확인
- 로그인 직후 sample project가 불필요하게 import되지 않는지 smoke 확인

### 21.7 Recommendation 디렉터리에서 처리할 부분

없음.

### 21.8 작업 스트림 및 파일 소유 분리

#### Stream A / Frontend Auth Transition Semantics

개발자 유형:

- Frontend persistence owner

목표:

- 로그인/로그아웃 경로에서 sample 유입 제거

파일 소유:

- `frontend/src/persistence/controller.ts`
- 필요 시 `frontend/src/persistence/localStore.ts`
- `frontend/src/persistence/controller.test.ts`

선행조건:

- `detail-019`, `detail-020` current branch 상태 파악

병렬 여부:

- single-writer 권장

#### Stream B / Frontend Empty-State Rendering

개발자 유형:

- Frontend workspace/UI owner

목표:

- guest/authenticated empty state가 자연스럽게 보이도록 조정

파일 소유:

- `frontend/src/routes/WorkspaceShell.tsx`

선행조건:

- Stream A에서 state semantics 확정

병렬 여부:

- Stream A 이후 통합 권장

#### Stream C / Backend Verification Smoke

개발자 유형:

- Backend verification owner

목표:

- sample import 제거 후 canonical route smoke

파일 소유:

- 구현 없음

선행조건:

- Stream A/B 완료 후

병렬 여부:

- 가능하지만 마지막 해석 권장

### 21.9 병합 순서

1. Stream A
2. Stream B
3. Stream C

### 21.10 검증 포인트

필수 검증:

- guest(sample cached) 상태 -> 로그인 -> sample이 authenticated account로 import되지 않는지
- A 로그인 -> 로그아웃 -> guest 전환 -> Episode 9/10/11/12가 즉시 보이지 않는지
- 빈 계정 로그인 -> authenticated empty state 유지
- 로그아웃 후 새로고침 -> guest sample이 다시 살아나지 않는지

권장 추가 검증:

- guest에 실제 로컬 작업물이 있는 경우는 복원되고,
  sample signature만 제거되는지

### 21.11 리스크 및 충돌 가능성

- guest sample cache를 너무 공격적으로 비우면
  기존 guest 실제 작업물을 지울 위험이 있습니다
- sample signature 판별이 부정확하면 의도치 않은 guest project까지 삭제할 수 있습니다
- `controller.ts`와 `WorkspaceShell.tsx`는 여전히 병렬 충돌 위험이 큽니다

## detail-022 / 새로고침 후 메인 레인 애로우 및 노드 간격 드리프트 복원 안정화

### 22.1 문제 요약

새로고침 후 메인 레인 애로우 길이와 노드 간격이
편집 직후 보던 캔버스와 다르게 보이는 현상이 있습니다.

관찰된 증상:

- 메인 레인 애로우 길이가 초기값처럼 짧아지거나
  마지막 노드 bottom과 어긋남
- 노드 사이 간격이 좁아지며
  새로고침 전 위치와 달라짐

### 22.2 현재 원인 분석

직접 원인 후보는 프런트에 집중됩니다.

1. `useEpisodeCanvasState` 훅이 실제 `WorkspaceShell`에서 사용되지 않습니다
   - `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`
   - 훅에는 `timelineEndY`, `laneDividerXs`, `nodeSizes`를
     episode 단위로 묶어 localStorage에 저장/복원하는 로직이 있음
   - 하지만 실제 화면은 `WorkspaceShell.tsx` 안의 중복 상태/복원 로직을 사용

2. `WorkspaceShell.tsx`는 새로고침 시 `nodeSizes`만 별도 key로 복원합니다
   - `timelineEndY`, `laneDividerXs`는 같은 방식으로 복원되지 않음
   - `timelineEndY`는 주로 undo/redo용 history ref 복원 경로에만 걸려 있음

3. 렌더 시 저장된 `canvasY` 위에
   `resolveNodeOverlapPlacement(...)`와 `applyLaneVerticalReflow(...)`가 다시 적용됩니다
   - 이때 저장된 placement가 “최종 truth”가 아니라
     refresh 때 재해석됩니다
   - 결과적으로 노드 간격이 최소 gap 기준으로 재조정될 수 있음

4. major 레인은 anchor snap 규칙도 함께 적용됩니다
   - 메인 화살표 끝과 major node 배치가
     `timelineEndY` 초기화 + 재계산 경로에 따라 달라질 수 있음

### 22.3 목표

- 새로고침 후 메인 레인 애로우와 노드 간격이
  refresh 직전 보던 캔버스와 최대한 동일하게 복원
- `timelineEndY`, `laneDividerXs`, `nodeSizes`, node placement의
  authoritative 복원 경로를 하나로 통일
- refresh 시 불필요한 reflow / overlap correction으로
  저장된 간격이 줄어들지 않게 만들기

### 22.4 수정 전략

핵심 방향:

1. episode canvas UI state owner를 하나로 통일
   - `WorkspaceShell.tsx` 중복 복원 로직과
     `useEpisodeCanvasState` 훅 중 하나만 남기기

2. `timelineEndY`, `laneDividerXs`, `nodeSizes`를
   같은 episode-scoped key로 함께 저장/복원

3. refresh 시 저장된 placement를 우선 사용하고,
   reflow / overlap correction은 실제 충돌이 있을 때만 제한적으로 적용

4. 메인 레인 애로우 길이는
   refresh 후 `effectiveTimelineEndY = max(savedTimelineEndY, actualLowestBottom)`처럼
   저장값과 실제 bottom의 관계를 안정적으로 다시 맞추기

### 22.5 Frontend 디렉터리에서 처리할 부분

개발자 유형:

- Frontend canvas state owner
- Frontend layout owner

목표:

- 캔버스 UI 상태 복원 경로 단일화
- refresh 후 layout drift 제거

수정 대상:

- `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`
- `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`
- 필요 시 `frontend/src/routes/workspace-shell/workspaceShell.storage.ts`
- `frontend/src/routes/WorkspaceShell.test.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/workspaceShell.layout.test.ts`

할 일:

- 훅 사용 여부를 명확히 정리하고 중복 상태 경로 제거
- `timelineEndY` / `laneDividerXs` persistence를 refresh 경로에 연결
- refresh 시 재배치 규칙이 저장된 placement를 침범하는 조건을 축소
- 메인 레인 애로우 길이 회귀 테스트 추가
- “새로고침 후 간격 유지” 회귀 테스트 추가

### 22.6 Backend 디렉터리에서 처리할 부분

없음.

이번 문제의 직접 원인은 frontend 캔버스 복원/레이아웃 규칙입니다.

### 22.7 Recommendation 디렉터리에서 처리할 부분

없음.

### 22.8 작업 스트림 및 파일 소유 분리

#### Stream A / Canvas State Restoration

개발자 유형:

- Frontend canvas state owner

목표:

- `timelineEndY`, `laneDividerXs`, `nodeSizes` 복원 경로 단일화

파일 소유:

- `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`
- `frontend/src/routes/workspace-shell/workspaceShell.storage.ts`

선행조건:

- 현재 실제 사용 경로와 미사용 훅 상태 확인 완료

병렬 여부:

- `WorkspaceShell.tsx` 충돌 위험으로 single-writer 권장

#### Stream B / Layout Determinism

개발자 유형:

- Frontend layout owner

목표:

- refresh 시 저장된 placement를 다시 압축하지 않게 정리

파일 소유:

- `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`
- 필요 시 `frontend/src/routes/WorkspaceShell.tsx`

선행조건:

- Stream A에서 state owner 정리

병렬 여부:

- 일부 병렬 가능하지만 최종 통합은 순차 권장

#### Stream C / Regression Tests

개발자 유형:

- Frontend test owner

목표:

- refresh / arrow length / spacing drift 회귀 고정

파일 소유:

- `frontend/src/routes/WorkspaceShell.test.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/workspaceShell.layout.test.ts`

선행조건:

- Stream A/B의 최종 복원 규칙 확정

병렬 여부:

- 테스트 파일 write scope 분리 시 부분 병렬 가능

### 22.9 병합 순서

1. Stream A
2. Stream B
3. Stream C

### 22.10 검증 포인트

필수 검증:

- 새로고침 전후 major/minor/detail 노드 간격 유지
- 새로고침 후 메인 레인 애로우가 마지막 노드 bottom과 맞는지
- nodeSizes가 복원된 상태에서도 gap이 줄어들지 않는지
- laneDividerXs / timelineEndY가 refresh 후 초기값으로 돌아가지 않는지

권장 추가 검증:

- 로그아웃/재로그인 후에도 에피소드별 캔버스 UI 상태가 계정 스코프로 분리되어 유지되는지

### 22.11 리스크 및 충돌 가능성

- `WorkspaceShell.tsx`는 현재 다른 스트림도 많아 충돌 위험이 큽니다
- 미사용 훅 정리 중 복원 규칙을 잘못 합치면
  undo/redo UI history가 깨질 수 있습니다
- reflow 규칙을 너무 약하게 만들면 실제 overlap 방지가 약해질 수 있습니다

## detail-023 / 게스트 샘플 하드코딩 제거 및 초기 상태 정상화

### 23.1 문제 요약

현재 `frontend/src/persistence/sampleWorkspace.ts`에는
데모용 guest 샘플 워크스페이스가 하드코딩되어 있습니다.

직접 증상:

- guest 상태에서 `Episode 12 / 11 / 10 / 9`가 자동으로 보일 수 있음
- 로그인/로그아웃 전환 버그가 있을 때 이 샘플이 더 쉽게 섞여 들어옴
- 제품 의미상 “신규 사용자 / 신규 프로젝트 / 비로그인 기본 상태”를 혼동시킴

이제 이 샘플 하드코딩은 더 이상 필요 없으므로,
초기화 정책을 제품 의미에 맞게 정상화해야 합니다.

### 23.2 목표

- guest 기본 상태에서 데모용 sample workspace를 자동 생성하지 않기
- authenticated 기본 상태는 이미 정의된 empty shell 정책과 일치시키기
- 최초 프로젝트 생성은 starter workspace만 사용하게 정리
- 기존 localStorage에 남아 있는 legacy sample snapshot도 정리 가능하게 만들기

### 23.3 수정 전략

핵심 방향:

1. `createSampleWorkspace(...)` 기반 guest sample seed 제거
2. guest 기본 상태는 empty guest shell 또는 무에피소드 상태로 전환
3. “새 프로젝트 만들기 / 에피소드 추가” 액션에서만 starter 데이터를 만들기
4. 기존 sample signature 판별 로직은
   migration/cleanup 용도로만 잠시 유지하고,
   새 코드 경로에서는 sample 생성 자체를 차단

### 23.4 대안 비교

대안 A:

- 샘플 데이터는 유지하되 제목만 `Episode 1` 등으로 바꾸기

단점:

- 데모 seed 자체는 여전히 남아서
  guest/auth 전환과 초기화 의미가 계속 흐려집니다

대안 B:

- guest sample seed 경로 자체를 제거

장점:

- 상태 의미가 단순해짐
- 신규 사용자와 기존 사용자 동작이 일관됨
- legacy sample 제거 정책을 따로 설계할 수 있음

채택:

- 대안 B

### 23.5 Frontend 디렉터리에서 처리할 부분

개발자 유형:

- Frontend persistence owner
- Frontend workspace/UI owner

목표:

- sample hardcoding 제거
- guest / authenticated / starter 초기화 경로 정리

수정 대상:

- `frontend/src/persistence/sampleWorkspace.ts`
- `frontend/src/persistence/controller.ts`
- `frontend/src/persistence/localStore.ts`
- `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/copy.ts`
- `frontend/src/persistence/controller.test.ts`
- 필요 시 `frontend/src/routes/WorkspaceShell.test.tsx`

할 일:

- `createSampleWorkspace(...)` 제거 또는 비활성화
- guest 초기화가 sample이 아니라 empty state를 쓰도록 변경
- `createStarterWorkspace(...)`만 사용자 액션 시점에 호출되게 보장
- legacy sample signature cleanup 로직을 migration 용도로 정리
- empty guest UI copy를 제품 의미에 맞게 검토

### 23.6 Backend 디렉터리에서 처리할 부분

개발자 유형:

- Backend verification owner

목표:

- 프런트에서 sample 제거 후에도 canonical persistence contract에 변화가 없는지 확인

수정 대상:

- 직접 구현 없음
- 필요 시 smoke/integration만 확인

할 일:

- guest에서 sample 제거가 backend route 계약을 건드리지 않는지 확인
- 신규 authenticated account가 여전히 empty project list를 받는지 확인

### 23.7 Service 레이어에서 처리할 부분

없음.

이번 정상화 작업은 서비스 계층 신규 구현이 아니라
프런트 초기화 정책 정리와 backend contract 확인이 핵심입니다.

### 23.8 분야별 소유 범위 / 의존성 / 병렬성

#### Frontend

담당 역할:

- Frontend persistence owner
- Frontend workspace/UI owner

목표:

- sample workspace 생성 경로 제거
- guest / authenticated / starter 초기화 정책 분리
- empty state UI 정상화

수정 대상 파일:

- `frontend/src/persistence/sampleWorkspace.ts`
- `frontend/src/persistence/controller.ts`
- `frontend/src/persistence/localStore.ts`
- `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/copy.ts`
- `frontend/src/persistence/controller.test.ts`
- 필요 시 `frontend/src/routes/WorkspaceShell.test.tsx`

선행조건:

- `detail-021` auth transition sample 유입 차단 방향 확정

겹치지 않는 파일 소유 범위:

- persistence 초기화 로직: `sampleWorkspace.ts`, `controller.ts`, `localStore.ts`
- UI 문구/빈 상태 렌더: `WorkspaceShell.tsx`, `copy.ts`
- 테스트: `controller.test.ts`, 필요 시 route test

병렬 진행 가능 여부:

- 부분 병렬 가능
- 다만 `controller.ts`와 `WorkspaceShell.tsx` 연계가 커서 single-writer 통합 권장

#### Backend

담당 역할:

- Backend verification owner

목표:

- sample 제거 후에도 canonical persistence contract가 그대로 유지되는지 확인

수정 대상 파일:

- 직접 구현 없음
- 필요 시 integration/smoke test만 사용

선행조건:

- Frontend 정책 변경 완료 후

겹치지 않는 파일 소유 범위:

- 코드 변경 없음
- smoke 및 integration 검증만 수행

병렬 진행 가능 여부:

- Frontend 구현과 병렬 가능
- 최종 해석은 Frontend 통합 후 권장

#### Service

담당 역할:

- 없음

목표:

- 없음

수정 대상 파일:

- 없음

선행조건:

- 없음

겹치지 않는 파일 소유 범위:

- 없음

병렬 진행 가능 여부:

- 해당 없음

### 23.9 병합 순서

1. Frontend persistence 정책 정리
2. Frontend empty-state UI 정리
3. Backend smoke 확인

### 23.10 검증 포인트

필수 검증:

- guest 초기 진입 시 Episode 9/10/11/12가 자동 생성되지 않는지
- 로그아웃 직후 guest로 돌아가도 sample이 보이지 않는지
- 신규 authenticated 계정은 empty state만 보이는지
- “새 프로젝트 만들기”를 눌렀을 때만 starter workspace가 생성되는지
- legacy sample cache가 남아 있어도 정상화 경로에서 치워지는지

권장 추가 검증:

- 기존 guest 실제 작업물은 보존되고,
  sample signature로 판별된 legacy mock만 제거되는지

### 23.11 리스크 및 충돌 가능성

- guest 기본 상태를 완전히 비우면 기존 데모/온보딩 기대와 달라질 수 있습니다
- legacy sample cleanup 기준이 너무 넓으면 실제 guest 데이터를 지울 수 있습니다
- `controller.ts`와 `WorkspaceShell.tsx`는 계속 충돌 위험이 큽니다

## detail-024 / 남은 비-UI 후속 정리 계획 (인수인계용)

이 섹션은 세부 설계를 고정하기보다
각 분야 세션이 바로 이어받을 수 있도록
문제와 방향만 짧게 남깁니다.

### 24.1 Frontend

문제 A:

- guest/sample 초기화 정책이 아직 완전히 정리되지 않았습니다
- `detail-023` 범위가 남아 있습니다

방향:

- `createSampleWorkspace(...)`를 기본 초기화 경로에서 제거
- guest / authenticated / starter 초기화 경계를 단순하게 정리
- legacy sample cache는 “실제 guest 작업물”과 구분 가능한 범위에서만 정리

파일 후보:

- `frontend/src/persistence/sampleWorkspace.ts`
- `frontend/src/persistence/controller.ts`
- `frontend/src/persistence/localStore.ts`
- `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/copy.ts`

문제 B:

- `WorkspaceShell` 전체 baseline이 아직 깨끗하지 않습니다
- focused regression은 통과했지만, full route suite/lint baseline은 아직 worktree 기준 잔여 이슈가 있습니다

방향:

- `detail-022` 이후 상태를 기준으로
  route suite broad failure와 `react-hooks/set-state-in-effect` baseline을 분리해서 보수
- auth/cache/empty-state와 무관한 broad failure는 별도 정리

파일 후보:

- `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/routes/WorkspaceShell.test.tsx`
- `frontend/src/routes/workspace-shell/*`

검증 포인트:

- guest 초기 진입 / 로그인 / 로그아웃 / 계정 전환
- 새로고침 후 캔버스 복원
- full `WorkspaceShell` route suite
- `WorkspaceShell.tsx` lint baseline

### 24.2 Backend

문제:

- backend 쪽은 현재 구조 이슈보다 contract verification 성격이 큽니다

방향:

- frontend 정책 정리 후에도
  `/api/persistence/projects`와 auth/session contract가 그대로 유지되는지만 확인
- 신규 authenticated account empty contract와
  sample auto-import 부재만 regression으로 유지

파일 후보:

- 직접 구현은 거의 없음
- 필요 시 `backend/src/auth/routes.integration.test.ts`
- 필요 시 `backend/src/persistence/routes.integration.test.ts`

검증 포인트:

- fresh account -> `{ projects: [] }`
- login-only path에서 sample project 자동 생성/유입 없음

### 24.3 Service

문제:

- 현재 남은 이슈는 service 계층 신규 구현이 필요한 단계는 아닙니다

방향:

- 없음

파일 후보:

- 없음

검증 포인트:

- 없음

### 24.4 병합 순서

1. Frontend 정책/초기화 정리
2. Frontend baseline 안정화
3. Backend contract smoke 재확인

### 24.5 리스크

- `WorkspaceShell.tsx`는 여전히 same-file 충돌 위험이 큽니다
- sample cleanup를 과하게 하면 guest 실제 작업물까지 건드릴 수 있습니다
- broad route regression 정리는 auth/cache 수정과 섞지 않고 분리하는 편이 안전합니다

## detail-025 / 노드 전환 시 인라인 작성 draft 유실

이 섹션도 인수인계용으로,
각 분야 세션이 바로 이어받을 수 있도록
문제와 방향만 남깁니다.

### 25.1 Frontend

문제:

- 한 노드에서 인라인 편집 중 다른 노드를 선택하면
  이전 노드 작성 내용이 저장되기 전에 사라질 수 있습니다

현재 확인된 원인:

- `WorkspaceShell.tsx`는 이전 노드 draft 저장을 사실상 `textarea onBlur`에 의존합니다
- 동시에 선택 전환 effect가 `selectedNodeId` 변경 직후
  `inlineNodeTextDraft`를 새 노드 내용으로 덮어씁니다
- 노드 카드를 클릭하면 `setSelectedNodeId(...)`가 먼저 일어나고,
  그 결과 이전 textarea가 selected 상태에서 빠지며
  draft가 저장되기 전에 교체될 수 있습니다

관련 코드 위치:

- `frontend/src/routes/WorkspaceShell.tsx`
  - 선택 전환 effect
  - `persistInlineNodeContent(...)`
  - node card `onClick`
  - textarea `onBlur`

방향:

- blur-only 저장에서 벗어나
  “선택 전환 직전 현재 selected node draft flush” 경로를 하나 두는 쪽이 우선
- 또는 node별 draft buffer를 두고
  선택 변경 시 즉시 덮어쓰지 않게 해도 됨
- FE 담당 세션이 현재 interaction 모델에 맞는 쪽을 선택하면 됩니다

파일 후보:

- `frontend/src/routes/WorkspaceShell.tsx`
- 필요 시 `frontend/src/persistence/controller.ts`
- `frontend/src/routes/WorkspaceShell.test.tsx`

검증 포인트:

- 노드 A 편집 -> 노드 B 클릭 -> 노드 A 내용 유지
- 노드 A 편집 -> 노드 B 클릭 -> 다시 노드 A 선택 -> draft 또는 저장값 유지
- 객체 멘션/키워드 포함 텍스트도 동일하게 유지

### 25.2 Backend

문제:

- 직접 원인은 아님

방향:

- 없음

파일 후보:

- 없음

검증 포인트:

- 없음

### 25.3 Service

문제:

- 없음

방향:

- 없음

파일 후보:

- 없음

검증 포인트:

- 없음

### 25.4 병합 순서

1. Frontend 저장/선택 전환 경계 수정
2. Frontend route regression 추가

### 25.5 리스크

- `WorkspaceShell.tsx` same-file 충돌 위험이 큽니다
- 저장 시점을 공격적으로 바꾸면
  기존 blur/paste/mention 상호작용과 충돌할 수 있습니다

## detail-026 / 키워드 클라우드 3x3 고정 배열 및 로딩 모션

이 섹션은 인수인계용으로,
FE / BE / Service 담당 세션이 각각 확인할 문제와 방향만 남깁니다.

요구 요약:

- 키워드 클라우드를 현재 5x2 느낌이 아니라 3x3 배열로 표시
- 추천 생성 시간 동안 텍스트만 보이지 말고 로딩 모션 표시
- 사용자가 이미 선택한 키워드가 있으면 반드시 포함
- 화면에는 선택 키워드 포함 총 9개 슬롯이 고정되도록 정리

### 26.1 Frontend

문제:

- `keyword-suggestion-grid`가 CSS에서 `repeat(5, ...)`로 잡혀 있어 5열 기준으로 보입니다
- `buildDisplayedKeywordSuggestions(...)`가 선택 키워드를 앞에 고정하긴 하지만 최대 25개를 반환합니다
- 로딩 중에는 같은 3x3 영역이 아니라 `Loading keyword suggestions...` 텍스트만 보여 패널 높이와 시각 흐름이 바뀝니다
- `WorkspaceShell.tsx`와 미사용 후보인 `CanvasNodeCard.tsx`에 키워드 패널 마크업이 중복되어 있어 한쪽만 고치면 추후 추출/복귀 때 다시 어긋날 수 있습니다

방향:

- FE 표시 계층에서 최종 슬롯 수를 `9`로 고정하는 상수를 둡니다
- `buildDisplayedKeywordSuggestions(...)`는 선택 키워드를 먼저 배치하고, 추천 결과를 case-insensitive 중복 제거로 채운 뒤 총 9개까지만 반환하도록 정리합니다
- 선택 키워드가 9개를 넘는 경우의 정책은 FE에서 명시해야 합니다
  예: 선택 순서 기준 9개만 표시하되 실제 노드 키워드 저장은 그대로 유지
- 로딩 중에도 같은 `.keyword-suggestion-grid` 안에 9개의 skeleton/pulse 슬롯을 렌더링해 레이아웃 점프를 막습니다
- 3열 CSS는 데스크톱 기준 `repeat(3, minmax(0, 1fr))`로 두고, 좁은 화면에서는 3열 유지 또는 2열 전환 여부를 FE가 실제 폭 기준으로 판단합니다
- 선택된 키워드는 기존처럼 `aria-pressed="true"`와 selected 스타일을 유지합니다

파일 후보:

- `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx`
- `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`
- `frontend/src/styles.css`
- `frontend/src/routes/WorkspaceShell.test.tsx`
- `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`

검증 포인트:

- 추천 응답이 10개 이상이어도 화면에는 9개만 표시
- 선택 키워드 2개 + 추천 결과 n개일 때 선택 키워드가 0, 1번처럼 앞쪽에 유지되고 총 9개 표시
- 선택 키워드와 추천 결과가 같은 label이면 중복 없이 1개만 표시
- refresh 이후에도 선택 키워드는 유지되고 나머지 추천만 회전 또는 갱신
- 로딩 중 9개 placeholder가 같은 3x3 footprint로 표시
- keyword cloud route test와 inline helper unit test 추가

### 26.2 Backend

문제:

- backend recommendation config 기본값과 `.env.example`은 `RECOMMENDATION_MAX_SUGGESTIONS=10`을 전제로 합니다
- route trim도 1~25 범위 정규화라서 FE 요구인 9개 고정과 직접 맞지는 않습니다

방향:

- 제품 기본 UI가 9개 고정이라면 backend 기본 `maxSuggestions`도 9로 맞춰 불필요한 응답을 줄입니다
- 단, FE가 최종 표시 수를 반드시 보장해야 합니다
  BE는 “최대 9개 응답” 최적화 계층으로 보는 편이 안전합니다
- route cache key는 이미 `maxSuggestions`를 포함하므로 기본값만 바꿔도 캐시 충돌 위험은 낮습니다
- 명시적 테스트에서 `maxSuggestions: 8` 같은 override는 그대로 유지해 config override 동작을 검증합니다

파일 후보:

- `backend/src/recommendation/routes.ts`
- `backend/src/recommendation/routes.integration.test.ts`
- `backend/.env.example`
- 필요 시 `backend/src/app.test.ts`

검증 포인트:

- 기본 keyword endpoint 응답 길이가 9인지 확인
- explicit `maxSuggestions` override가 여전히 적용되는지 확인
- fallback heuristic 경로도 route trim 이후 9개 이하인지 확인

### 26.3 Service

문제:

- recommendation env 기본값이 10입니다
- heuristic provider는 25개 full cloud를 만들도록 작성되어 있고 관련 테스트도 25개를 기대합니다
- OpenAI provider prompt/schema는 12~25개를 요구하고, Gemini provider 기본값은 10입니다
- keyword request는 `story.existingKeywords`를 통해 현재 키워드를 context에 넣지만, provider 응답이 선택 키워드를 반드시 포함한다고 보장하지는 않습니다

방향:

- Service 기본 추천 개수를 9로 통일합니다
- provider prompt/schema는 “UI가 9-slot keyword cloud를 구성할 수 있게 최대 9개 또는 필요한 추가 후보를 반환”하는 방향으로 맞춥니다
- 선택 키워드 포함 여부의 최종 책임은 FE 표시 헬퍼에 둡니다
  Service는 context를 참고해 중복이 적고 보완적인 후보를 주는 역할에 머무르는 편이 안전합니다
- heuristic provider는 내부 seed pool은 유지해도 최종 반환 기본값과 테스트 기대값을 9개 기준으로 정리합니다
- 만약 선택 키워드가 request context에 최신 draft 기준으로 들어가지 않는 문제가 보이면 FE request 조립 쪽에서 `existingKeywords` 업데이트 여부도 같이 확인합니다

파일 후보:

- `recommendation/src/config/env.ts`
- `recommendation/src/config/env.test.ts`
- `recommendation/src/provider/heuristic.ts`
- `recommendation/src/provider/gemini.ts`
- `recommendation/src/provider/openai.ts`
- `recommendation/src/provider/factory.test.ts`
- `recommendation/src/orchestration/index.test.ts`

검증 포인트:

- env 기본 `maxSuggestions`가 9
- heuristic keyword response 기본 길이 9
- Gemini/OpenAI provider가 9개 기준 prompt/schema/trim과 충돌하지 않음
- 선택 키워드가 context에 들어가도 중복 추천이 과하게 나오지 않음

### 26.4 병합 순서

1. Frontend 표시 헬퍼와 CSS를 먼저 수정해 UI가 항상 9개 3x3을 보장하게 합니다
2. Frontend route/helper 테스트로 선택 키워드 포함, 중복 제거, 로딩 skeleton을 고정합니다
3. Service 기본값과 provider prompt/schema/test를 9개 기준으로 맞춥니다
4. Backend env/example/route integration 기대값을 9개 기준으로 맞춥니다
5. 전체 recommendation + frontend focused smoke를 실행합니다

### 26.5 리스크

- 선택 키워드가 9개를 넘는 경우 표시 정책을 정하지 않으면 사용자가 선택한 항목이 숨겨진 것처럼 보일 수 있습니다
- 로딩 skeleton이 실제 버튼으로 인식되면 접근성 테스트가 흔들릴 수 있으니 `aria-hidden` 또는 명확한 loading role을 정해야 합니다
- provider가 9개보다 적게 반환하는 경우 FE가 빈 슬롯을 보여줄지, heuristic fallback으로 채울지 결정이 필요합니다
- `WorkspaceShell.tsx`는 충돌 위험이 높은 파일이라 다른 FE 세션과 같은 시점에 수정하면 안 됩니다

## detail-027 / FIX 노드 편집 잠금 및 Major 타임라인 끝점 분리

이 섹션은 인수인계용으로,
고정 노드 텍스트 수정 차단과 Major Event Lane 메인 화살표 끝점 문제를 함께 정리합니다.

요구 요약:

- 노드가 `FIX` 상태이면 위치/크기뿐 아니라 텍스트도 수정되지 않아야 합니다
- Major Event Lane의 메인 화살표 끝은 항상 마지막 major 노드의 하단에 위치해야 합니다
- minor/detail 노드가 더 아래에 있어도 major lane 화살표 끝이 그 노드까지 늘어나면 안 됩니다

### 27.1 Frontend

문제 A: FIX 노드 텍스트 수정

- 현재 drag/resize는 `node.isFixed`일 때 차단되어 있습니다
- 하지만 선택된 노드는 `node.isFixed` 여부와 무관하게 inline textarea가 렌더링됩니다
- 따라서 FIX 노드도 클릭 후 텍스트 입력, keyword toggle, inline token 삭제 같은 내용 변경 경로가 열릴 수 있습니다

방향 A:

- `node.isFixed`인 선택 노드는 inline editor 대신 read-only text view를 렌더링합니다
- fixed 상태에서는 textarea focus, `onChange`, `onBlur` 저장, keyword toggle처럼 본문/키워드를 바꾸는 경로를 막습니다
- More menu의 `Unfix` 동작은 유지하되, 텍스트 편집 관련 액션은 숨기거나 disabled 처리합니다
- 키워드 클라우드 버튼도 fixed 노드에서는 숨기거나 disabled 처리하는 쪽이 안전합니다
  키워드 선택은 결국 inline text/keywords를 수정하기 때문입니다
- 빈 fixed 노드는 placeholder를 보여주되 실제 입력창은 만들지 않습니다

문제 B: Major 타임라인 끝점

- 현재 `effectiveTimelineEndY`가 `Math.max(timelineEndY, lowestNodeBottom)`로 계산되어 모든 레인의 최하단 노드가 major timeline 표시 길이에 영향을 줍니다
- `moveNodeFreely(...)`, resize 종료, drag preview, drop 보조 로직도 전체 visible node bottom 기준으로 `setTimelineEndY(...)`를 호출합니다
- 그래서 minor/detail 노드가 major 마지막 노드보다 아래로 내려가면 major lane 화살표 끝이 해당 non-major 위치까지 늘어납니다

방향 B:

- `timelineEndY`는 major lane 전용 상태로 취급합니다
- major timeline 표시값과 canvas stage 높이 계산을 분리합니다
  예: `majorTimelineEndY`는 마지막 major 노드 하단 기준, `stageHeight`는 전체 노드 최하단 기준
- non-major drag/drop/resize/delete 경로에서는 `setTimelineEndY(...)`를 호출하지 않게 정리합니다
- stage 높이는 계속 전체 노드 기준으로 늘려서 minor/detail 노드가 잘리지 않게 유지합니다
- end major 노드 이동, end major resize, timeline end handle drag, major reorder 이후에만 timeline end를 마지막 major 노드 하단으로 갱신합니다
- 기존 localStorage에 non-major 기준으로 커진 `timelineEndY`가 남아 있을 수 있으므로, 표시 단계에서 마지막 major 하단을 우선하거나 한 번 정상화하는 경로를 검토합니다

파일 후보:

- `frontend/src/routes/WorkspaceShell.tsx`
- `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`
- `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`
- `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`
- `frontend/src/routes/WorkspaceShell.test.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/workspaceShell.canvas.test.ts`

검증 포인트:

- FIX 노드를 선택해도 textbox가 렌더링되지 않음
- FIX 노드에서 키보드 입력, Backspace/Delete, keyword 선택으로 text/keywords가 바뀌지 않음
- FIX 해제 후에는 기존처럼 텍스트 편집 가능
- minor/detail 노드를 마지막 major보다 아래로 드래그해도 timeline end handle top은 마지막 major 하단과 일치
- minor/detail 노드를 크게 resize해도 major timeline arrow는 늘어나지 않고 canvas stage만 충분히 늘어남
- timeline end handle을 직접 늘리면 end major 노드가 따라 내려오고 handle이 end major 하단과 일치
- major reorder 후 새 마지막 major 노드 하단으로 timeline end가 맞춰짐
- stale canvas UI cache가 있어도 새로고침 후 non-major 최하단 기준으로 화살표가 늘어나지 않음

### 27.2 Backend

문제:

- 직접 구현 대상은 아닙니다
- `isFixed`, node placement, node size, order가 이미 저장된다면 BE는 기존 값을 그대로 보존하면 됩니다

방향:

- FE가 보내는 text/keyword update 요청이 fixed 노드에서 발생하지 않는지 frontend test로 우선 막습니다
- 장기적으로는 서버 canonical persistence가 강해질 때 fixed 노드 mutation 차단을 backend validation으로 보강할 수 있습니다
- 이번 단계에서는 schema/API 변경 없이 관찰 대상으로 둡니다

파일 후보:

- 직접 수정 없음
- 필요 시 향후 `backend/src/persistence/*` validation 검토

검증 포인트:

- 없음

### 27.3 Service

문제:

- 추천 서비스는 직접 원인이 아닙니다
- 다만 fixed 노드에서 keyword cloud를 열 수 있으면 추천 선택이 본문 수정으로 이어질 수 있습니다

방향:

- fixed 노드에서는 FE가 recommendation invocation 자체를 막는 방향이 우선입니다
- Service 변경은 필요 없습니다

파일 후보:

- 없음

검증 포인트:

- fixed 노드에서 recommendation keyword request가 발생하지 않는지 FE route test로 확인

### 27.4 병합 순서

1. Frontend에서 fixed 노드 read-only 렌더링과 텍스트/키워드 변경 경로 차단
2. Frontend에서 major timeline end와 전체 canvas height 계산 분리
3. 기존 `setTimelineEndY(...)` 호출부를 major-only 규칙에 맞게 정리
4. route regression test 추가
5. lint / typecheck / focused route test 실행

### 27.5 리스크

- `WorkspaceShell.tsx`가 현재 다른 UI 작업과 충돌 가능성이 매우 높습니다
- timeline end 상태를 단순히 줄이면 기존 저장된 캔버스 UI 복원과 충돌할 수 있으므로 stage height 계산과 분리해야 합니다
- fixed 노드에서 어떤 액션까지 막을지 범위를 분명히 해야 합니다
  최소 범위는 text/keywords 수정 차단이고, delete/collapse/important 여부는 별도 정책입니다
- major end 기준을 “시각적으로 가장 아래 major”로 둘지 “정렬 순서상 마지막 major”로 둘지 FE가 현재 reorder 정책과 맞춰 확정해야 합니다
