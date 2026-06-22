# CorpMult

Современный видеохостинг аниме на React + PostgreSQL + Railway.

## Структура

```
corpmult/
├── src/                  # Frontend (React + Vite + TypeScript)
│   ├── pages/            # Страницы
│   ├── components/       # React компоненты
│   ├── services/         # API клиент
│   └── ...
├── server/               # Backend (Express + PostgreSQL)
│   ├── index.ts          # API сервер
│   ├── auth.ts           # JWT + bcrypt авторизация
│   ├── db.ts             # Подключение к PostgreSQL
│   └── schema.sql        # Схема базы данных
├── railway.toml          # Конфиг Railway
└── package.json
```

## Деплой на Railway

1. Создайте новый проект на [railway.app](https://railway.app)
2. Добавьте PostgreSQL сервис
3. Подключите GitHub репозиторий или используйте `railway up`
4. В Variables добавьте:
   - `JWT_SECRET` — случайная строка 32+ символов
5. Railway автоматически создаст `DATABASE_URL`

## Локальная разработка

```bash
# Установка зависимостей
npm install

# Запуск сервера (API)
npm run server

# Запуск фронтенда
npm run dev
```

## Безопасность

- Пароли хранятся как bcrypt хеши (10 раундов)
- JWT токены в HttpOnly cookies
- Все защищённые маршруты требуют авторизации
- DATABASE_URL никогда не попадает во фронтенд
