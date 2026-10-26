import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary is OPTIONAL. The whole app must run with no image keys at all.
 *
 * WHY a flag instead of throwing: this is a student project that gets cloned
 * and demoed on machines with no credentials. Rather than crash at boot, we
 * expose `cloudinaryEnabled` so the upload route can answer a clean 503 and
 * the client can swap its file picker for a plain "image URL" text field.
 */
export const cloudinaryEnabled = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Upload an in-memory buffer straight to Cloudinary.
 *
 * WHY upload_stream and not upload(path): multer keeps the file in RAM
 * (memoryStorage) and we never touch the disk. Render's filesystem is
 * ephemeral and read-only in places, so a temp file written during a request
 * may be gone by the next one - and on a free instance it also counts against
 * a tiny disk. Streaming the buffer avoids the filesystem entirely.
 */
export const uploadBuffer = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        // Cap stored dimensions: a 12MP phone photo would otherwise be served
        // as-is to every feed visitor.
        transformation: [{ width: 1200, height: 1200, crop: 'limit' }],
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });

/**
 * Best-effort delete of a replaced image.
 *
 * WHY swallow the error: failing to clean up an old avatar must never fail
 * the user's profile update. An orphaned image is a billing footnote; a 500
 * on save is a broken feature.
 */
export const destroyImage = async (publicId) => {
  if (!cloudinaryEnabled || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[cloudinary] failed to destroy', publicId, err.message);
  }
};

export default cloudinary;
