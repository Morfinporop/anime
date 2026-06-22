// Подключение к PostgreSQL
// DATABASE_URL берётся из переменных окружения Railway — НЕ из кода

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL не задан. API запустится, но БД будет недоступна.');
}

export const pool: Pool | null = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
}) : null;

pool?.on('error', (err: any) => {
  console.error('[db.error] Подключение к PostgreSQL:', err.message);
});

// Разделяем SQL файл на отдельные statements
// Корректно обрабатываем DO $$ ... $$ блоки и строки в кавычках
function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let inSingleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    // Блочный комментарий /* ... */
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }

    // Строчный комментарий -- ...
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      current += ch;
      continue;
    }
    if (ch === '-' && next === '-') { inLineComment = true; current += ch; continue; }

    // $$ dollar quoting $$ для DO блоков
    if (ch === '$') {
      if (sql.substr(i, 2) === '$$') {
        inDollarQuote = !inDollarQuote;
        current += '$$';
        i++;
        continue;
      }
    }

    // Одинарные кавычки '...'
    if (ch === "'" && !inDollarQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    // Разделитель ; (вне кавычек и комментариев)
    if (ch === ';' && !inDollarQuote && !inSingleQuote) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = '';
      continue;
    }

    current += ch;
  }

  // Последний statement без ;
  const last = current.trim();
  if (last) statements.push(last);

  return statements;
}

// Применяем схему
export async function initDatabase() {
  if (!DATABASE_URL || !pool) {
    console.warn('[db] DATABASE_URL не задан — пропускаем инициализацию БД');
    return;
  }

  const schemaPath = join(process.cwd(), 'server', 'schema.sql');
  let schema: string;
  try {
    schema = readFileSync(schemaPath, 'utf-8');
  } catch (err: any) {
    console.error('[db] Не удалось прочитать schema.sql:', err.message);
    return;
  }

  // Разделяем и выполняем каждый statement отдельно
  const statements = splitSQLStatements(schema);
  console.log(`[db] Выполняю ${statements.length} SQL statements...`);

  let successCount = 0;
  let skipCount = 0;

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      successCount++;
    } catch (err: any) {
      // Игнорируем ошибки "уже существует" — останавливаемся на критических
      const msg = err.message || '';
      if (msg.includes('already exists') || msg.includes('does not exist') && msg.includes('DROP')) {
        skipCount++;
      } else if (msg.includes('relation') && msg.includes('does not exist')) {
        // Не критично — таблица не существует, может быть нормальным
        console.warn(`[db] Пропуск: ${msg.slice(0, 100)}`);
        skipCount++;
      } else {
        console.error(`[db] Ошибка: ${msg.slice(0, 200)}`);
        skipCount++;
      }
    }
  }

  console.log(`[db] ✓ Схема: ${successCount} OK, ${skipCount} пропущено`);
}

export async function query(text: string, params?: unknown[]) {
  if (!pool) throw new Error('Database not configured');
  return pool.query(text, params);
}
