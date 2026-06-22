// Подключение к PostgreSQL
// DATABASE_URL берётся из переменных окружения Railway — НЕ из кода

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL не задан. Установите переменную окружения.');
  console.error('   На Railway: Variables → New Variable → DATABASE_URL');
  process.exit(1);
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Ошибка подключения к PostgreSQL:', err);
});

// Применяем схему при запуске
export async function initDatabase() {
  const schemaPath = join(process.cwd(), 'server', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  try {
    await pool.query(schema);
    console.log('✓ Схема базы данных инициализирована');
  } catch (err) {
    console.error('Ошибка инициализации схемы:', err);
    throw err;
  }
}

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}
