# ARIAD 프로젝트 개요

이 문서는 현재 코드베이스 기준으로 `ARIAD` 프로젝트의 구조, 주요 기능, 패키지 경계, 핵심 컴포넌트 역할을 한국어로 정리한 문서입니다.

## 1. 프로젝트 한눈에 보기

`ARIAD`는 웹툰 창작자가 에피소드 구조를 빠르게 설계할 수 있도록 돕는 캔버스 중심 편집 도구입니다.  
기획 문서상 제품명은 `SCENAAIRO`이며, 현재 UI와 실행 산출물에서는 `ARIAD`라는 브랜드명이 사용되고 있습니다.

핵심 방향은 다음과 같습니다.

- 채팅형 글쓰기 도구가 아니라 캔버스 기반 구조 편집기입니다.
- 노드 단위로 사건 구조를 배치하고 편집합니다.
- AI는 자동 집필이 아니라 `키워드 제안 -> 선택 -> 필요 시 문장 제안` 흐름으로 보조합니다.
- 게스트 로컬 저장과 로그인 후 동기화 흐름을 모두 지원하도록 설계되어 있습니다.

## 2. 저장소 구조

```text
ARIAD/
|- frontend/                              # React 기반 워크스페이스 UI
|  |- src/
|  |  |- auth/                            # 인증 경계 stub
|  |  |- config/                          # 프런트 환경값 로딩
|  |  |- persistence/                     # 로컬 저장, 동기화 큐, 워크스페이스 컨트롤러
|  |  |- recommendation/                  # 추천 요청 생성 및 API/standalone 클라이언트
|  |  |- routes/
|  |  |  |- workspace-shell/              # WorkspaceShell 보조 모듈 분리본
|  |  |  |  |- workspaceShell.canvas.ts       # 캔버스 배치/줌/충돌 보정/연결선 계산
|  |  |  |  |- workspaceShell.common.tsx      # 공용 포맷터/메시지/오버레이 렌더링
|  |  |  |  |- workspaceShell.constants.ts    # 레이아웃/레인/오브젝트 기본 상수
|  |  |  |  |- workspaceShell.inlineEditor.tsx # 인라인 텍스트/키워드/멘션 처리
|  |  |  |  |- workspaceShell.node.ts         # 노드 복제 등 노드 단위 보조 로직
|  |  |  |  |- workspaceShell.sidebar.tsx     # 폴더/에피소드 사이드바 보조 로직
|  |  |  |  |- workspaceShell.storage.ts      # 브라우저 저장 문자열 파싱 보조 로직
|  |  |  |  `- workspaceShell.types.ts        # WorkspaceShell 전용 타입
|  |  |  |- AuthCallbackPage.tsx          # 인증 콜백 화면
|  |  |  |- WorkspaceShell.tsx            # 메인 워크스페이스 화면
|  |  |- test/                            # 프런트 테스트 설정
|  |  |- AppRoutes.tsx                    # 라우팅 엔트리
|  |  |- copy.ts                          # UI 문구
|  |  |- main.tsx                         # 앱 마운트
|  |  |- runtime.ts                       # served/standalone 런타임 판별
|  |  `- styles.css                       # 전역 스타일
|  |- scripts/                            # dist 서빙 보조 스크립트
|  |- index.html
|  `- service.html
|- backend/                               # Fastify 기반 API 서버
|  |- mysql/
|  |  `- init/
|  |     `- 001_create_cloud_projects.sql # 로컬 MySQL 초기 스키마
|  |- src/
|  |  |- config/                          # 서버 환경값 로딩
|  |  |- persistence/                     # persistence 라우트와 파일/MySQL 저장소
|  |  |- recommendation/                  # 추천 API 라우트
|  |  |- app.ts                           # Fastify 앱 조립
|  |  `- server.ts                        # 서버 실행 엔트리
|  |- .env.example                        # 파일/MySQL persistence 예시 환경값
|  `- LOCAL_MYSQL.md                      # 로컬 MySQL 실행 가이드
|- shared/                                # 공용 타입/계약/i18n
|  |- src/
|  |  |- contracts/                       # auth, persistence API 계약
|  |  |- i18n/                            # 공용 영문 문구
|  |  |- types/                           # 도메인/저장 타입
|  |  `- index.ts
|  `- README.md
|- recommendation/                        # 추천 로직 모듈
|  |- src/
|  |  |- config/                          # 추천 모듈 환경값
|  |  |- context/                         # 추천 문맥 조립
|  |  |- contracts/                       # 추천 요청/응답 타입
|  |  |- orchestration/                   # provider를 감싼 서비스 계층
|  |  |- provider/                        # 현재 휴리스틱 추천기
|  |  `- index.ts
|  `- README.md
|- e2e/
|  `- workspace-shell.spec.ts             # Playwright E2E 시나리오
|- scripts/                               # 루트 실행/호환/산출물 스크립트
|  |- dev-backend.mjs
|  |- dev-frontend.mjs
|  |- generate-standalone-html.ps1
|  |- launch-local.ps1
|  `- serve-standalone.mjs
|- DISCOVERY.md                           # 문제 정의/제품 배경
|- SPEC.md                                # 제품 동작 명세
|- AGENTS.md                              # 저장소 운영 맵
|- AGENT_SYSTEM.md                        # 에이전트 운영 규칙
|- SCAFFOLD.md                            # 기술 구조 원칙
|- PLANS.md                               # 실행 로그 및 계획
|- PROJECT_OVERVIEW_KO.md                 # 현재 문서
|- docker-compose.mysql.yml               # 로컬 MySQL 컨테이너 구성
`- package.json                           # 루트 워크스페이스 스크립트
```

참고:
- 위 트리는 실제 이해에 필요한 주요 디렉터리만 정리한 것입니다.
- `node_modules/`, `dist/`, `.git/`, `.yarn/` 같은 생성물/도구 폴더는 의도적으로 생략했습니다.

## 3. 기술 스택

| 영역 | 기술 |
|---|---|
| 패키지 관리 | `Yarn 4` workspaces |
| 프런트엔드 | `React 19`, `TypeScript`, `Vite`, `React Router` |
| 백엔드 | `Fastify`, `TypeScript`, 선택형 `MySQL(mysql2)` 영속화 |
| 추천 로직 | 독립 `recommendation` 모듈, 현재는 휴리스틱 추천기 |
| 테스트 | `Vitest`, `Testing Library`, `Playwright` |
| 실행 모드 | 브라우저 서빙 모드 + standalone HTML 모드 |

## 4. 패키지별 역할

| 패키지 | 역할 | 핵심 파일 |
|---|---|---|
| `frontend/` | 실제 사용자 워크스페이스 UI와 상호작용 처리. 폴더 단위 오브젝트 참조 범위와 캔버스 편집 로직을 포함합니다. | `src/routes/WorkspaceShell.tsx`, `src/routes/workspace-shell/*`, `src/persistence/controller.ts` |
| `backend/` | 저장/동기화 API와 추천 API 제공. persistence는 파일 저장소와 MySQL 저장소를 설정으로 전환할 수 있습니다. | `src/app.ts`, `src/config/env.ts`, `src/persistence/routes.ts`, `src/persistence/mysql-store.ts` |
| `shared/` | 프런트/백엔드/추천 모듈이 같이 쓰는 타입과 계약 정의 | `src/types/domain.ts`, `src/contracts/persistence.ts` |
| `recommendation/` | 추천 요청 문맥 구성과 키워드/문장 추천 로직 | `src/context/index.ts`, `src/orchestration/index.ts`, `src/provider/index.ts` |
| `e2e/` | 핵심 사용자 플로우 회귀 검증 | `workspace-shell.spec.ts` |
| `scripts/` | 개발 서버 실행, 로컬 MySQL 보조, 호환 모드 fallback, standalone 산출물 생성 | `dev-frontend.mjs`, `dev-backend.mjs`, `launch-local.ps1`, `generate-standalone-html.ps1` |

## 5. 핵심 기능 요약

### 5.1 워크스페이스 편집

- 좌측 사이드바에서 에피소드와 폴더를 관리합니다.
- 상단 오브젝트 라이브러리에서 인물/장소/사물을 검색하고 편집합니다.
- 오브젝트는 에피소드 소유 단위로 저장되며, 같은 폴더에 묶인 에피소드끼리는 서로의 오브젝트를 참조로 재사용할 수 있습니다.
- 중앙 캔버스에서 `major / minor / detail` 3개 레인 기준으로 노드를 배치합니다.
- 노드는 생성, 이동, 리사이즈, 접기/펼치기, 중요 표시, 고정 표시, 삭제가 가능합니다.
- 노드 간 부모-자식 연결선을 유지하며 재배선(`rewire`)도 가능합니다.

### 5.2 인라인 텍스트 편집

- 노드 본문 편집은 우측 패널이 아니라 캔버스 내부 인라인 편집이 기본입니다.
- 키워드는 노드 텍스트 안에 토큰처럼 유지됩니다.
- `@object@` 또는 일반 단어 기반 선택으로 오브젝트 멘션을 연결할 수 있습니다.
- 오브젝트가 연결되면 오브젝트 사용 횟수도 함께 반영됩니다.

### 5.3 AI 보조 흐름

- 노드별로 `Keyword Suggestions`를 열 수 있습니다.
- 추천은 키워드 클라우드 중심으로 제공됩니다.
- 선택된 키워드는 노드에 즉시 반영됩니다.
- 문장 추천은 선택 키워드가 있을 때만 열리는 구조로 설계되어 있습니다.
- 현재 추천기는 외부 LLM이 아니라 휴리스틱 기반 추천 로직입니다.

### 5.4 저장과 동기화

- 게스트 모드에서는 로컬 저장소(`localStorage`)를 사용합니다.
- 로그인 모드에서는 계정 기반 동기화를 시도합니다.
- 현재 인증은 실제 OAuth가 아니라 데모용 `StubAuthBoundary`입니다.
- 로컬 캐시와 원격 동기화 큐를 분리해 관리합니다.
- Undo/Redo 히스토리도 프런트 컨트롤러 내부에서 유지합니다.
- 폴더 공유 상태에서 벗어난 에피소드는 외부 에피소드 오브젝트 참조를 자기 소유 오브젝트로 국소화해 독립성을 유지합니다.

### 5.5 실행 모드

- 일반 개발 모드에서는 프런트와 백엔드를 각각 띄울 수 있습니다.
- standalone 모드에서는 단일 `ARIAD.html` 파일로도 실행할 수 있습니다.
- Windows 환경의 `spawn EPERM` 문제를 피하기 위한 호환 실행 로직이 포함되어 있습니다.
- 백엔드 persistence는 기본 파일 저장소 외에 로컬 MySQL 컨테이너 경로도 지원합니다.

## 6. 주요 데이터 모델

| 모델 | 설명 |
|---|---|
| `StoryProject` | 프로젝트 단위 메타데이터와 현재 활성 에피소드 정보 |
| `StoryEpisode` | 개별 에피소드의 제목, 목표, 엔드포인트 |
| `StoryObject` | 인물/장소/사물 같은 참조 객체. `episodeId`를 가지며 기본적으로 특정 에피소드가 소유하고, 같은 폴더 범위에서는 참조로 재사용됩니다. |
| `StoryNode` | 캔버스 위 구조 노드. 레벨, 텍스트, 키워드, 부모, 위치, 오브젝트 연결을 가짐 |
| `TemporaryDrawerItem` | 캔버스 밖 임시 보관 항목 |
| `StoryWorkspaceSnapshot` | 한 프로젝트의 전체 상태 스냅샷 |
| `ProjectLinkageMetadata` | 로컬 프로젝트와 계정 기반 저장소 연결 정보 |
| `GlobalProjectRegistry` | 최근 프로젝트 목록과 활성 프로젝트 인덱스 |

## 7. 프런트엔드 주요 컴포넌트

### 7.1 라우팅 계층

| 컴포넌트/파일 | 설명 |
|---|---|
| `frontend/src/main.tsx` | 런타임 모드에 따라 `BrowserRouter` 또는 `HashRouter`를 선택해 앱을 마운트합니다. |
| `frontend/src/AppRoutes.tsx` | `/`는 워크스페이스, `/auth/callback`은 인증 콜백 화면으로 연결합니다. |
| `frontend/src/routes/AuthCallbackPage.tsx` | 인증 콜백 파라미터를 표시하는 기준 라우트입니다. 실제 인증 통합은 아직 지연되어 있습니다. |

### 7.2 워크스페이스 핵심 컴포넌트

| 컴포넌트/파일 | 설명 |
|---|---|
| `frontend/src/routes/WorkspaceShell.tsx` | 전체 편집 화면을 구성하는 메인 컴포넌트입니다. 사이드바, 오브젝트 바, 캔버스, 상세 패널, 모달, 오버레이를 한곳에서 관리합니다. |
| `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts` | 레인 폭 계산, 줌/배치/충돌 보정, 타임라인 앵커, 연결선 계산 등 캔버스 전용 보조 로직입니다. |
| `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx` | 인라인 텍스트 편집, 키워드 토큰, 오브젝트 멘션 파싱/렌더링 로직을 담당합니다. |
| `frontend/src/routes/workspace-shell/workspaceShell.sidebar.tsx` | 폴더/에피소드 목록 정리, 검색 매칭, 아이콘 렌더링 같은 사이드바 보조 로직입니다. |
| `frontend/src/routes/workspace-shell/workspaceShell.common.tsx` | 공용 포맷터, 상태 메시지, fullscreen 오버레이 루트 선택 같은 공통 UI 보조 로직입니다. |
| `frontend/src/routes/workspace-shell/workspaceShell.constants.ts` | 레인 정의, 초기 좌표, 캔버스/타임라인/오브젝트 관련 상수를 제공합니다. |
| `SidebarItemIcon` | 사이드바에서 에피소드/폴더 종류를 구분해 주는 작은 표시 컴포넌트입니다. |

### 7.3 `WorkspaceShell` 내부 UI 섹션

| UI 섹션 | 역할 |
|---|---|
| 좌측 사이드바 | 에피소드 생성, 폴더 생성, 검색, 최근 스토리 목록, 프로필/동기화 메뉴를 제공합니다. |
| 상단 오브젝트 라이브러리 | 오브젝트 검색, 정렬, 생성, 선택, 핀, 이름 변경, 삭제를 처리합니다. 폴더 안에서는 해당 폴더 소속 에피소드들의 오브젝트를 함께 보여줍니다. |
| 중앙 캔버스 | 레인별 노드 배치, 연결선, 타임라인, 레인 리사이즈, 줌, 팬, 드래그 앤 드롭의 중심 영역입니다. |
| 노드 카드 | 텍스트 편집, 키워드 상태, 오브젝트 멘션, 접기, 더보기 메뉴, 리사이즈 핸들을 포함합니다. |
| 키워드 클라우드 패널 | 선택 노드 주변에서 AI 키워드 추천을 보여줍니다. |
| 노드 더보기 메뉴 | `Rewire`, `Keyword Suggestions`, `Important`, `Fixed`, `Delete` 액션을 제공합니다. |
| 오브젝트 멘션 메뉴 | 인라인 입력 중 오브젝트 추천 목록을 띄웁니다. |
| 우측 상세 패널 | 현재는 오브젝트 생성/수정 전용 패널입니다. 폴더 범위 오브젝트일 때만 소유 에피소드(`Owned Episode`)를 표시합니다. |
| 하단 플로팅 컨트롤 | Undo, Redo, 노드 생성 버튼을 제공합니다. |
| 삭제 확인 모달 | 노드 삭제와 에피소드 삭제를 명시적으로 확인받습니다. |

## 8. 프런트엔드 상태/저장 컴포넌트

| 컴포넌트/파일 | 설명 |
|---|---|
| `frontend/src/persistence/controller.ts` | 워크스페이스의 사실상 핵심 애플리케이션 컨트롤러입니다. 초기화, 로그인/로그아웃, 에피소드/노드/오브젝트 생성 및 수정, Undo/Redo, 임시 보관함 복원, 클라우드 동기화와 함께 폴더 범위 오브젝트 참조를 에피소드 소유 모델로 정규화합니다. |
| `frontend/src/persistence/localStore.ts` | 로컬 `localStorage` 기반 스냅샷/링키지/레지스트리 저장소입니다. |
| `frontend/src/persistence/flushQueue.ts` | 원격 동기화 작업을 디바운스하고, 프로젝트/에피소드/오브젝트/노드의 의존 관계에 맞춰 순서를 정렬합니다. |
| `frontend/src/persistence/cloudClient.ts` | 백엔드 persistence API와 통신하는 HTTP 클라이언트입니다. |
| `frontend/src/persistence/standaloneCloudClient.ts` | standalone 모드에서 브라우저 저장소를 원격 저장소처럼 흉내 내는 클라이언트입니다. 에피소드 삭제와 오브젝트/노드 정리 규칙도 서버 경로와 맞춥니다. |
| `frontend/src/persistence/nodeTree.ts` | 부모 추론, 서브트리 수집, 순서 정규화 등 노드 트리 계산을 담당합니다. |
| `frontend/src/persistence/sampleWorkspace.ts` | 앱 첫 실행 시 사용할 샘플 프로젝트/에피소드/노드/오브젝트 데이터를 만듭니다. 샘플 오브젝트도 에피소드 소유 모델을 따릅니다. |
| `frontend/src/auth/stubAuthBoundary.ts` | 현재 데모용 로그인 경계를 제공합니다. `guest`와 `authenticated` 세션을 흉내 냅니다. |

## 9. 프런트엔드 추천 관련 컴포넌트

| 컴포넌트/파일 | 설명 |
|---|---|
| `frontend/src/recommendation/request.ts` | 현재 노드, 부모 노드, 에피소드, 오브젝트 정보를 추천 요청용 스냅샷으로 정리합니다. |
| `frontend/src/recommendation/client.ts` | 서빙 모드에서 백엔드 추천 API를 호출합니다. |
| `frontend/src/recommendation/standaloneClient.ts` | standalone 모드에서 추천 모듈을 직접 호출합니다. |

## 10. 백엔드 주요 컴포넌트

| 컴포넌트/파일 | 설명 |
|---|---|
| `backend/src/app.ts` | Fastify 앱을 만들고 persistence/recommendation/health 라우트를 등록합니다. persistence 드라이버와 MySQL 설정을 옵션으로 주입할 수 있습니다. |
| `backend/src/server.ts` | 실제 서버 엔트리 포인트입니다. |
| `backend/src/config/env.ts` | 포트, 프런트 origin, 데이터 디렉터리와 함께 `PERSISTENCE_DRIVER`, `MYSQL_*` 환경값을 읽습니다. |
| `backend/src/persistence/routes.ts` | 프로젝트 목록 조회, 프로젝트 조회, import, sync API를 제공합니다. 설정에 따라 파일 저장소 또는 MySQL 저장소를 선택합니다. |
| `backend/src/persistence/store.ts` | 파일 기반(`cloud-store.json`) 저장소를 사용해 프로젝트 스냅샷을 읽고 쓰며, sync 작업을 적용합니다. |
| `backend/src/persistence/mysql-store.ts` | MySQL `cloud_projects` 테이블에 스냅샷 JSON을 저장하는 영속화 저장소입니다. |
| `backend/src/recommendation/routes.ts` | 키워드 추천과 문장 추천 API를 제공합니다. |
| `backend/LOCAL_MYSQL.md` | 로컬 MySQL 컨테이너 실행과 백엔드 환경값 설정 절차를 설명합니다. |
| `docker-compose.mysql.yml` | 로컬 MySQL 8.4 컨테이너와 init 스크립트 마운트를 정의합니다. |

## 11. 추천 모듈(`recommendation/`) 주요 컴포넌트

| 컴포넌트/파일 | 설명 |
|---|---|
| `recommendation/src/contracts/index.ts` | 추천 요청/응답과 추천 문맥 타입을 정의합니다. |
| `recommendation/src/context/index.ts` | 프런트에서 온 이야기 스냅샷을 추천용 문맥으로 변환합니다. |
| `recommendation/src/orchestration/index.ts` | provider를 감싸 `getKeywordSuggestions`, `getSentenceSuggestions` 서비스를 만듭니다. |
| `recommendation/src/provider/index.ts` | 현재 휴리스틱 추천 로직이 들어 있는 provider입니다. 노드 레벨별 키워드 씨앗과 문장 템플릿을 생성합니다. |
| `recommendation/src/config/env.ts` | 추천 모듈 환경값 정의입니다. |

## 12. 공용 모듈(`shared/`) 주요 컴포넌트

| 컴포넌트/파일 | 설명 |
|---|---|
| `shared/src/types/domain.ts` | 프로젝트, 에피소드, 오브젝트, 노드, 임시 보관함의 핵심 도메인 타입입니다. |
| `shared/src/types/persistence.ts` | persistence 모드, 엔티티 종류, 링크 메타데이터, 글로벌 레지스트리를 정의합니다. |
| `shared/src/contracts/auth.ts` | 인증 세션과 콜백 스냅샷 계약을 정의합니다. |
| `shared/src/contracts/persistence.ts` | health, import, list, get, sync에 쓰이는 API 계약을 정의합니다. |
| `shared/src/i18n/index.ts` | 공용 영문 UI 문구 집합입니다. |

## 13. 테스트 구성

| 위치 | 설명 |
|---|---|
| `frontend/src/AppRoutes.test.tsx` | 라우팅과 기본 워크스페이스 렌더링을 검증합니다. |
| `frontend/src/routes/WorkspaceShell.test.tsx` | 캔버스 조작, 키워드 추천, 오브젝트 편집, 키보드 단축키 등 화면 로직을 검증합니다. |
| `backend/src/app.test.ts` | 백엔드 health 및 추천 엔드포인트를 검증합니다. |
| `backend/src/persistence/routes.integration.test.ts` | persistence API 통합 동작을 검증합니다. |
| `backend/src/recommendation/routes.integration.test.ts` | 추천 API 통합 동작을 검증합니다. |
| `recommendation/src/orchestration/index.test.ts` | 추천 서비스 계층과 문장 제안 게이트를 검증합니다. |
| `shared/src/index.test.ts` | 공용 i18n 노출 여부를 검증합니다. |
| `e2e/workspace-shell.spec.ts` | 실제 브라우저에서 핵심 사용자 플로우를 검증합니다. |

## 14. 실행 명령

| 명령 | 설명 |
|---|---|
| `yarn dev:frontend` | 프런트 개발 서버 실행 |
| `yarn dev:backend` | 백엔드 개발 서버 실행 |
| `yarn host:local` | 로컬 빌드 후 서비스 형태로 실행 |
| `yarn db:mysql:up` | 로컬 MySQL 컨테이너 실행 |
| `yarn db:mysql:logs` | 로컬 MySQL 로그 확인 |
| `yarn db:mysql:down` | 로컬 MySQL 컨테이너 종료 |
| `yarn lint` | ESLint 검사 |
| `yarn typecheck` | 전체 워크스페이스 타입 검사 |
| `yarn test` | 단위 테스트 실행 |
| `yarn integration` | 백엔드 통합 테스트 실행 |
| `yarn build` | 전체 빌드 |
| `yarn e2e` | Playwright E2E 실행 |

## 15. 현재 코드 기준으로 주의할 점

- `SPEC.md` 기준 제품명은 `SCENAAIRO`지만, 현재 앱 타이틀과 UI는 `ARIAD`로 노출됩니다.
- 임시 보관함(`Temporary Drawer`) 데이터 모델은 존재하지만, 현재 UI 토글은 비활성화되어 있습니다.
- 우측 상세 패널은 현재 노드 편집보다 오브젝트 생성/수정에 집중되어 있습니다.
- 오브젝트는 이제 프로젝트 전역 공용이 아니라 에피소드 소유 모델이며, 폴더 범위에서만 참조 공유가 열립니다.
- 인증은 실제 외부 제공자 연동이 아니라 데모용 stub입니다.
- 추천은 현재 휴리스틱 기반이므로 실제 LLM 연동 전 단계의 구조적 baseline으로 보는 것이 맞습니다.
- persistence는 기본적으로 파일 저장소를 쓰고, 필요할 때만 `PERSISTENCE_DRIVER=mysql`로 로컬 MySQL 경로를 활성화합니다.

## 16. 문서 읽는 순서

제품 의도와 현재 구현을 함께 보려면 아래 순서가 가장 이해하기 쉽습니다.

1. `DISCOVERY.md`
2. `SPEC.md`
3. `SCAFFOLD.md`
4. `shared/src/types/domain.ts`
5. `frontend/src/routes/WorkspaceShell.tsx`
6. `frontend/src/routes/workspace-shell/`
7. `frontend/src/persistence/controller.ts`
8. `backend/src/app.ts`
9. `backend/src/persistence/mysql-store.ts`
10. `recommendation/src/provider/index.ts`
