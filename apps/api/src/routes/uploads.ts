import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { env } from '../lib/env.js';
import { badRequest } from '../lib/errors.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// В проде каталог задаётся через UPLOAD_DIR и лежит вне кода приложения.
export const UPLOAD_DIR = env.uploadDir
  ? path.resolve(env.uploadDir)
  : path.resolve(here, '../../uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(badRequest('Поддерживаются только изображения'));
    cb(null, true);
  },
});

export const uploadsRouter = Router();

/** Загрузка фото чека. Возвращает публичный URL для сохранения в транзакции. */
uploadsRouter.post('/receipt', upload.single('file'), (req, res) => {
  if (!req.file) throw badRequest('Файл не получен');
  res.status(201).json({ url: `${env.publicUrl}/uploads/${req.file.filename}` });
});
