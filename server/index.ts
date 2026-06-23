async function start() {
  try {
    console.log(`[server] Запуск на порту ${PORT}...`);

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] ✓ CorpMult API запущен на порту ${PORT}`);
      console.log(`[server] Режим: ${NODE_ENV}`);
    });

    server.on('error', (err: any) => {
      console.error('[server.error]', err);
      if (err.code === 'EADDRINUSE') {
        console.error(`[fatal] Порт ${PORT} уже занят`);
        process.exit(1);
      }
    });

    const shutdown = (signal: string) => {
      console.log(`[shutdown] Получен сигнал ${signal}`);
      server.close(() => {
        console.log('[shutdown] Сервер остановлен');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('[shutdown] Принудительная остановка');
        process.exit(1);
      }, 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    try {
      await initDatabase();
      console.log('[init] ✓ База данных готова');

      try {
        const result = await query(
          `UPDATE users SET is_admin = TRUE, can_upload = TRUE WHERE id = 1 RETURNING id, username`
        );
        if (result.rows.length > 0) {
          console.log(`[init] ✓ Пользователь #1 (${result.rows[0].username}) автоматически стал админом`);
        } else {
          const hash = await hashPassword(process.env.ADMIN_PASSWORD || 'morfin2024');
          const insertResult = await query(
            `INSERT INTO users (username, password_hash, avatar_color, is_admin, can_upload)
             VALUES ($1, $2, $3, TRUE, TRUE)
             ON CONFLICT (username) DO UPDATE SET is_admin = TRUE, can_upload = TRUE, password_hash = $2
             RETURNING id, username`,
            ['Morfin', hash, '#ff85b8']
          );
          if (insertResult.rows.length > 0) {
            console.log(`[init] ✓ Создан админ Morfin (id=${insertResult.rows[0].id})`);
          }
        }
      } catch (adminErr: any) {
        console.warn('[init.warn] Не удалось создать/назначить админа:', adminErr.message);
      }
    } catch (dbErr: any) {
      console.error('[init.error] Не удалось инициализировать БД:', dbErr.message);
    }
  } catch (err) {
    console.error('[fatal] Ошибка запуска:', err);
    process.exit(1);
  }
}

start();
