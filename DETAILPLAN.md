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
