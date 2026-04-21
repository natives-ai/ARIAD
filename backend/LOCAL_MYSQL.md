# Local MySQL Setup (Test)

## 1) Start MySQL container

```bash
yarn db:mysql:up
```

## 2) Configure backend env

Use `backend/.env.example` values or set:

```env
PERSISTENCE_DRIVER=mysql
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=scenaairo
MYSQL_PASSWORD=scenaairo
MYSQL_DATABASE=scenaairo_local
```

## 3) Run backend

```bash
yarn dev:backend
```

## 4) Logs / shutdown

```bash
yarn db:mysql:logs
yarn db:mysql:down
```
