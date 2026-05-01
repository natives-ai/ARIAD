# EC2 Docker Deploy

이 문서는 ARIAD를 단일 EC2 인스턴스에서 Docker Compose로 실행하는 절차를 정리합니다.

## 구조

- `frontend`: 80번 포트를 외부에 열고 정적 프론트엔드를 서빙합니다.
- `frontend`는 `/api` 요청을 Compose 내부 네트워크의 `backend:3001`로 프록시합니다.
- `backend`: 외부 포트를 열지 않고 API와 인증/추천/영속화 로직을 실행합니다.
- `mysql`: Compose 내부에서만 접근되며 `backend/mysql/init` 초기화 SQL을 사용합니다.

## EC2 준비

1. EC2 보안 그룹에서 인바운드 `80/tcp`를 엽니다.
2. SSH 접속용 `22/tcp`는 본인 IP로 제한합니다.
3. HTTPS를 붙일 경우 ALB, nginx, Caddy 같은 TLS 종료 지점을 앞단에 둡니다.
4. Docker와 Docker Compose plugin을 설치합니다.

## 배포

```bash
git clone <repo-url> ARIAD
cd ARIAD
cp deploy/ec2.env.example .env
```

`.env`에서 최소한 아래 값은 실제 값으로 바꿉니다.

```bash
FRONTEND_ORIGIN=http://YOUR_EC2_PUBLIC_IP
MYSQL_ROOT_PASSWORD=strong-root-password
MYSQL_PASSWORD=strong-app-password
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

LLM 추천을 Gemini로 쓸 경우:

```bash
RECOMMENDATION_PROVIDER=gemini
GEMINI_API_KEY=your-key
```

실행:

```bash
docker compose --env-file .env -f docker-compose.ec2.yml up -d --build
```

상태 확인:

```bash
docker compose --env-file .env -f docker-compose.ec2.yml ps
docker compose --env-file .env -f docker-compose.ec2.yml logs -f frontend backend
curl http://127.0.0.1/service.html
curl http://127.0.0.1/api/health
```

## 업데이트

```bash
git pull
docker compose --env-file .env -f docker-compose.ec2.yml up -d --build
```

## 중요한 운영 메모

- `.env`는 절대 커밋하지 않습니다.
- `GOOGLE_CLIENT_ID`는 백엔드 런타임과 프론트엔드 빌드 둘 다에 쓰입니다. 값을 바꾸면 `--build`로 프론트 이미지를 다시 빌드해야 합니다.
- HTTP만 쓰는 동안은 `AUTH_COOKIE_SECURE=false`가 맞습니다.
- HTTPS 뒤에서 실행하면 `FRONTEND_ORIGIN=https://...`로 바꾸고 `AUTH_COOKIE_SECURE=true`를 사용합니다.
- 기본 Compose는 백엔드 포트를 외부에 열지 않습니다. 브라우저는 반드시 프론트엔드의 `/api` 프록시를 통해 API를 호출합니다.
- MySQL 데이터는 `ariad_mysql_data` Docker volume에 남습니다. 완전 초기화가 필요할 때만 `docker compose -f docker-compose.ec2.yml down -v`를 사용합니다.
