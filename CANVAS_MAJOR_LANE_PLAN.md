# Canvas Major Lane 안정화 계획

이 문서는 현재 보고된 `Major Event Lane` 상호작용 오류를 별도로 정리합니다.
대상 증상은 다음 네 가지입니다.

- timeline end handle(아래 화살표)는 움직여 보이지만, 맨 아래 major 노드를 옮기면 원래 상태로 돌아가는 느낌이 있음
- 원래는 화살표를 늘리면 맨 아래 major 노드가 따라와야 하는데 그렇지 않음
- major/non-major 모두 자유 위치 이동이 어색하게 느껴짐
- 노드 순서 변경이 여전히 부자연스럽게 체감됨

## 1. 현재 확인된 사실

현재 테스트/타입 상태는 깨져 있지 않습니다.

- `frontend` typecheck 통과
- `src/routes/WorkspaceShell.test.tsx` 통과 (`80/80`)

즉, 지금 문제는 "기존 회귀 테스트가 놓치고 있는 상호작용 공백"일 가능성이 높습니다.

코드 기준으로 확인된 핵심 사실은 다음과 같습니다.

1. `timeline-end` 드래그는 현재 `timelineEndY`만 바꿉니다.
   - `frontend/src/routes/WorkspaceShell.tsx`
   - `pointermove`의 `timeline-end` 분기에는 특정 major 노드 배치를 함께 갱신하는 로직이 없습니다.

2. major drag commit은 여전히 두 기준을 섞어 씁니다.
   - 실제 저장 위치: `snappedPlacement`
   - reorder 계산 위치: `intendedSnappedPlacement`
   - 이 차이 때문에 "보기에는 이동했는데 commit 후 다시 어색해지는" 현상이 생길 수 있습니다.

3. end marker는 "ordered last"가 아니라 "visual lowest major"를 따릅니다.
   - 이 변경 자체는 UX 개선용이지만
   - timeline end handle이 같은 기준을 항상 공유하지 않으면 end node identity가 흔들릴 수 있습니다.

4. minor/detail에는 lane reflow가 있지만 major에는 같은 규칙이 없습니다.
   - major는 timeline anchor 규칙이 따로 있어서 단순 reflow를 그대로 넣기 어렵습니다.
   - 따라서 major는 별도 규칙으로 다뤄야 합니다.

## 2. 가능성이 높은 원인

### 원인 A. timeline end handle과 "따라와야 하는 major node"의 기준이 분리돼 있다

현재 코드에서는:

- end handle은 `effectiveTimelineEndY`를 직접 렌더링
- end node 표시는 `visualEndMajorNodeId`
- major drag commit은 `endMajorNodeId`

를 사용합니다.

이 세 값이 매 순간 같은 노드를 기준으로 움직이지 않으면:

- handle은 늘어났는데 노드는 그대로 있거나
- 노드는 드래그 중 움직였다가 commit 후 다시 정렬되거나
- end marker가 다른 노드로 넘어가면서 사용자가 "되돌아갔다"고 느낄 수 있습니다

### 원인 B. timeline-end 드래그가 노드 이동 intent가 아니라 단순 rail 길이 변경으로만 처리된다

사용자가 기대하는 동작은 사실상:

- handle을 늘린다
- 현재 end 역할을 하는 major 노드도 아래로 따라온다

입니다.

하지만 지금 구현은:

- rail 끝 위치(`timelineEndY`)만 늘리고
- 실제 major 노드 배치는 렌더 시 다시 계산되도록 맡기는 구조

라서 "handle과 end node가 함께 움직이는" 체감이 약합니다.

### 원인 C. major drag에서 최종 위치와 reorder 기준 위치가 다르다

`moveNodeFreely(...)`의 major 경로는:

- overlap 해소/anchor snap 이후 `snappedPlacement`를 저장하고
- reorder 계산은 `intendedSnappedPlacement`로 합니다

이 차이 때문에:

- 자유 위치 이동
- major reorder
- end marker 재선정

이 한 번에 일어나면 commit 후 결과가 사용자가 본 미리보기와 달라질 수 있습니다.

## 3. 우선 해결 방향

핵심은 `timeline end`, `end marker`, `end-follow major node`를 하나의 규칙으로 묶는 것입니다.

권장 방향:

1. "현재 timeline end를 대표하는 major 노드"를 하나의 도출값으로 고정
2. timeline-end 드래그는 rail 길이만 바꾸지 말고 그 대표 major 노드의 preview/commit도 함께 갱신
3. major drag commit은 저장 좌표와 reorder 계산 좌표를 같은 final placement 기준으로 통일
4. major lane은 minor/detail과 분리된 별도 안정화 규칙으로 다룸

## 4. 실행 트랙

### Track 1. 회귀 테스트로 증상 먼저 고정

대상 파일:

- `frontend/src/routes/WorkspaceShell.test.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/workspaceShell.layout.test.ts`

추가할 테스트:

- timeline end handle을 아래로 드래그하면 현재 end major node의 bottom도 함께 내려감
- 현재 visually lowest major node를 직접 드래그해도 commit 후 제자리로 튕기지 않음
- non-end major를 움직여도 timeline end가 불필요하게 재배치되지 않음
- major drag 후 실제 위치와 `is-end-node` 지정 결과가 사용자가 본 최종 위치와 일치함

완료 기준:

- 지금 보고된 증상이 자동 테스트로 재현됨

### Track 2. major end semantics 단일화

대상 파일:

- `frontend/src/routes/WorkspaceShell.tsx`

핵심 작업:

- `visualEndMajorNodeId`, `endMajorNodeId`, timeline end follower 역할을 분리하지 말고 하나의 도출 규칙으로 정리
- pointermove preview, pointerup commit, 렌더 마커가 같은 node identity를 보도록 맞춤

완료 기준:

- handle, end marker, end-follow node가 같은 major node를 가리킴

### Track 3. timeline-end 드래그를 node-aware interaction으로 변경

대상 파일:

- `frontend/src/routes/WorkspaceShell.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`

핵심 작업:

- `timeline-end` 드래그 중 대표 end major node preview도 같이 갱신
- pointerup 시 rail 길이만 남기지 말고 end major node placement도 commit
- handle 드래그와 end node 이동이 같은 계산 경로를 쓰도록 정리

완료 기준:

- 화살표를 늘리면 end major node가 같이 따라온다는 체감이 실제 동작과 일치

### Track 4. major drag commit 기준 통일

대상 파일:

- `frontend/src/routes/WorkspaceShell.tsx`

핵심 작업:

- `updateNodePlacement(...)`와 `moveNode(...)`가 같은 final placement 기준을 사용하도록 통일
- preview에 보인 최종 snap 결과와 commit 결과가 달라지지 않게 조정

완료 기준:

- "움직여 보였는데 놓으면 다시 돌아감" 현상이 major drag에서 재현되지 않음

### Track 5. 자유 이동 / reorder 후속 보정

대상 파일:

- `frontend/src/routes/WorkspaceShell.tsx`
- 필요 시 `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`

핵심 작업:

- major lane에 minor/detail용 reflow를 그대로 넣지 말고, timeline rule을 해치지 않는 최소 보정만 적용할지 검토
- reorder와 free-move가 동시에 일어날 때 어떤 축이 authoritative한지 명확히 정리

완료 기준:

- major lane에서 free move와 reorder가 서로 덮어쓰지 않음

## 5. 테스트 게이트

구현 단계에서는 최소 다음을 다시 확인해야 합니다.

- `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`
- 필요 시 `corepack yarn --cwd frontend test -- src/routes/workspace-shell/workspaceShell.layout.test.ts`
- `corepack yarn --cwd frontend typecheck`
- 변경 파일 대상 eslint

## 6. 지금 시점의 결론

이 문제는 단순히 "겹침"만의 문제가 아닙니다.
현재로서는 다음 순서가 가장 안전합니다.

1. timeline end handle과 end major node의 의미를 단일화
2. handle 드래그를 node-aware interaction으로 변경
3. major drag commit 기준을 final placement 하나로 통일
4. 그 다음 자유 이동/reorder 체감을 다듬기

즉, 지금은 DB나 persistence보다 `WorkspaceShell` 내부 major-lane interaction semantics를 먼저 바로잡는 것이 맞습니다.
