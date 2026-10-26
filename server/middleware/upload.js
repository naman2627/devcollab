import multer from 'multer';
import ApiError from '../utils/ApiError.js';

/**
 * multer with memoryStorage - the file never touches the disk.
 *
 * WHY memory and not diskStorage: Render's filesystem is ephemeral, so a temp
 * file written during one request can be gone by the next, and nothing cleans
 * up /tmp between deploys. Holding the buffer in RAM and streaming it on to
 * Cloudinary means there is no filesystem state to get wrong. The 5MB cap is
 * what keeps "in RAM" safe.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Reject non-images before reading the body, so a 50MB video is refused at
    // the first chunk rather than after a full upload.
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)) {
      return cb(new ApiError(400, 'Only JPEG, PNG, WebP, GIF or AVIF images are allowed.'));
    }
    return cb(null, true);
  },
});

/**
 * Accept one optional image field and normalise multer's own errors.
 *
 * WHY wrap it: multer throws MulterError, which does not carry a statusCode,
 * so the global handler would log a 500 for a user uploading a large file.
 * Translating here keeps the "file too large" message honest.
 */
export const singleImage = (field) => (req, res, next) =>
  upload.single(field)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5MB or smaller.' : err.message;
      return next(new ApiError(400, message));
    }
    return next(err);
  });

export default upload;
