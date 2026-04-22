# Major Lane Swap 대응 메모

이 문서는 현재 보고된 다음 증상에 대한 간단한 대응 메모입니다.

- 큰 major 노드를 작은 마지막 major 노드 자리로 보내려 할 때 잘 안 바뀜
- 마지막 노드와 바꾸는 과정에서 메인 타임라인 화살표가 같이 늘어남

지금은 `WorkspaceShell` 리팩터링이 진행 중이라 바로 구현하지 않고, 나중에 이어서 볼 수 있게 핵심만 적어둡니다.

## 1. 현재 판단

가능성이 높은 원인은 두 가지입니다.

1. major reorder 기준이 큰 노드 높이를 충분히 반영하지 못함
   - 현재는 사실상 중심점/배치 기준으로 마지막 노드와의 교체를 판단하는데
   - 큰 노드는 카드 높이 때문에 사용자가 느끼는 "아래로 충분히 보냈다"와 내부 reorder 기준이 어긋날 수 있습니다

2. end major node를 움직일 때 timeline end 보정이 너무 적극적으로 따라감
   - 마지막 노드 후보를 아래로 보내는 순간
   - reorder보다 먼저 `timelineEndY`가 확장되어
   - 사용자가 의도한 "자리 교체"가 아니라 "타임라인 연장"처럼 보일 수 있습니다

## 2. 대충 해결 방향

### 방향 A. major reorder 기준 재검토

- 마지막 노드 교체 판정을 단순 center Y보다 더 직관적인 기준으로 바꿀지 검토
- 후보:
  - dragged node top/bottom과 대상 node의 top/bottom 비교
  - 큰 노드와 작은 노드 교체 시 end-node 전용 threshold 완화

### 방향 B. end-node 교체 시 timeline 확장 억제

- 단순 reorder 의도인 경우에는 `timelineEndY`를 바로 늘리지 않도록 조정
- 특히 "현재 end node와 자리만 바꾸는" 상황에서는
  - 먼저 reorder 확정
  - 그 다음 최종 end node에 맞춰 timeline을 재계산

### 방향 C. 회귀 테스트 추가

- 큰 middle major를 키운 뒤 작은 end major 아래로 드래그
- 기대 결과:
  - 큰 노드가 마지막 노드로 reorder됨
  - 불필요한 timeline extension이 생기지 않음
  - 최종 end marker와 timeline end가 같은 노드를 가리킴

## 3. 작업 순서

1. 현재 리팩터링 브랜치/워크트리 안정화
2. `WorkspaceShell.test.tsx`에 재현 케이스 추가
3. `moveNodeFreely(...)`의 major reorder 계산과 `timelineEndY` 보정 순서 조정
4. end-node swap 전용 회귀 확인

## 4. 주의사항

- 이 수정은 `WorkspaceShell.tsx` 같은 파일을 직접 건드리므로 same-file 충돌 위험이 큽니다
- 현재 진행 중인 리팩터링과 동시에 하지 말고, 한 작업 스트림에서 순차 처리하는 편이 안전합니다
