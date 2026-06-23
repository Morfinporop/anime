app.post('/api/seasons/:seasonId/episodes', requireUploadPermission, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'poster', maxCount: 1 },
]), async (req: any, res) => {
  try {
    const { seasonId } = req.params;
    const { episodeNumber = '1', title = '' } = req.body;
    const videoFile = req.files?.video?.[0];
    const posterFile = req.files?.poster?.[0];
    if (!videoFile) return res.status(400).json({ error: 'Видеофайл не загружен' });

    const ext = videoFile.mimetype.includes('webm') ? 'webm' : 'mp4';
    const filename = `${seasonId}_${Date.now()}_${episodeNumber}.${ext}`;
    const filepath = join(UPLOAD_DIR, filename);
    writeFileSync(filepath, videoFile.buffer);

    const sizeMB = videoFile.size / 1024 / 1024;
    console.log(`[upload] Серия ${episodeNumber}: ${sizeMB.toFixed(1)} МБ`);

    if (sizeMB > 50) {
      try {
        const crf = sizeMB > 500 ? '35' : sizeMB > 200 ? '32' : '28';
        const videoBitrate = sizeMB > 500 ? '800k' : sizeMB > 200 ? '1200k' : '1800k';
        const maxHeight = sizeMB > 500 ? '480' : '720';
        
        await new Promise<void>((resolve, reject) => {
          const tmpPath = `${filepath}.tmp.mp4`;
          const cmd = `ffmpeg -i "${filepath}" -c:v libx264 -preset fast -crf ${crf} -vf "scale='min(1280,iw)':-2" -maxrate ${videoBitrate} -bufsize ${parseInt(videoBitrate) * 2}k -c:a aac -b:a 96k -movflags +faststart -pix_fmt yuv420p -y "${tmpPath}"`;
          
          exec(cmd, { timeout: 600000, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
              console.error(`[compress] Ошибка: ${err.message}`);
              console.error(`[compress] stderr: ${stderr}`);
              resolve();
              return;
            }
            
            try {
              if (existsSync(tmpPath)) {
                const newSize = statSync(tmpPath).size / 1024 / 1024;
                unlinkSync(filepath);
                renameSync(tmpPath, filepath);
                console.log(`[compress] ${sizeMB.toFixed(1)} МБ → ${newSize.toFixed(1)} МБ (${((1 - newSize / sizeMB) * 100).toFixed(0)}%)`);
              }
            } catch (e: any) {
              console.error(`[compress] Ошибка замены: ${e.message}`);
            }
            resolve();
          });
        });
      } catch (e: any) {
        console.error(`[compress] Критическая ошибка: ${e.message}`);
      }
    }

    let durationSeconds = 0;
    try {
      await new Promise<void>((resolve) => {
        exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filepath}"`, (err, stdout) => {
          if (!err && stdout) {
            durationSeconds = Math.round(parseFloat(stdout.trim()) || 0);
          }
          resolve();
        });
      });
    } catch (e: any) {
      console.warn(`[ffprobe] Не удалось получить длительность: ${e.message}`);
    }

    let posterBuffer: Buffer | null = null;
    let posterMime: string | null = null;
    if (posterFile) {
      posterBuffer = posterFile.buffer;
      posterMime = posterFile.mimetype;
    }

    const videoUrl = `/uploads/${filename}`;

    try {
      const result = await query(
        `INSERT INTO episodes (season_id, episode_number, title, video_url, duration_seconds, poster_data, poster_mime)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [seasonId, parseInt(episodeNumber), title || `Серия ${episodeNumber}`, videoUrl, durationSeconds, posterBuffer, posterMime]
      );
      res.json({ ok: true, episodeId: result.rows[0].id, videoUrl });
    } catch (err: any) {
      if (err.message?.includes('duplicate key')) return res.status(409).json({ error: 'Такая серия уже есть в этом сезоне' });
      throw err;
    }
  } catch (err: any) {
    console.error('Upload episode error:', err);
    res.status(500).json({ error: 'Ошибка загрузки' });
  }
});
