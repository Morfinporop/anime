// Подключение к PostgreSQL
// DATABASE_URL берётся из переменных окружения Railway — НЕ из кода

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL не задан. Установите переменную окружения.');
  console.error('   На Railway: Variables → New Variable → DATABASE_URL');
  // НЕ завершаем процесс — пусть сервер запустится без БД
  // process.exit(1);
}

export const pool = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
}) : (null as any);

pool?.on?.('error', (err: any) => {
  console.error('[db.error] Ошибка подключения к PostgreSQL:', err);
});

// Применяем схему при запуске
export async function initDatabase() {
  if (!DATABASE_URL) {
    console.warn('[db] DATABASE_URL не задан — пропускаем инициализацию БД');
    return;
  }
  const schemaPath = join(process.cwd(), 'server', 'schema.sql');
  let schema: string;
  try {
    schema = readFileSync(schemaPath, 'utf-8');
  } catch (err) {
    console.error('[db] Не удалось прочитать schema.sql:', err);
    return;
  }

  // Разделяем по `;` но сохраняем DO $$ блоки как есть
  // Простая стратегия — выполнить весь файл одним запросом,
  // DO $$ ... $$ блоки понимает PostgreSQL
  try {
    await pool.query(schema);
    console.log('✓ Схема базы данных инициализирована');
  } catch (err: any) {
    console.error('[db] Ошибка инициализации схемы:', err?.message || err);
    // НЕ пробрасываем — сервер должен работать даже если БД недоступна
  }
}

export async function query(text: string, params?: unknown[]) {
  if (!DATABASE_URL) throw new Error('Database not configured');
  return pool.query(text, params);
}
