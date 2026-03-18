/**
 * GCS upload helper for space images.
 * Follows the same credential + path patterns as maps-service.
 */
import { Storage } from '@google-cloud/storage';
import * as crypto from 'crypto';

let storageInstance: Storage | null = null;

function getStorage(): Storage {
  if (!storageInstance) {
    storageInstance = new Storage({
      credentials: JSON.parse(
        Buffer.from(process.env.MAPS_SERVICE_GOOGLE_CREDENTIALS_BASE64 || 'e30=', 'base64').toString('utf8'),
      ),
    });
  }
  return storageInstance;
}

function getExtension(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg': return '.jpg';
    case 'image/png': return '.png';
    case 'image/webp': return '.webp';
    default: return '.jpg';
  }
}

/**
 * Upload an image buffer to GCS and return the storage path.
 * Path format matches maps-service: "{userId}/{spaceId}_{uuid}{ext}"
 */
export async function uploadImage(
  userId: string,
  spaceId: string,
  imageBuffer: Buffer,
  contentType: string,
): Promise<string> {
  const storage = getStorage();
  const bucketName = process.env.BUCKET_PUBLIC_USER_DATA || '';
  if (!bucketName) {
    throw new Error('BUCKET_PUBLIC_USER_DATA env var is not set');
  }

  const ext = getExtension(contentType);
  const uuid = crypto.randomUUID();
  const storagePath = `${userId}/${spaceId}_${uuid}${ext}`;

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(storagePath);

  await file.save(imageBuffer, {
    metadata: {
      contentType,
    },
    resumable: false,
  });

  return storagePath;
}
