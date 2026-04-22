/**
 * Lightweight image dimension validation using raw header parsing.
 * Avoids heavy dependencies like sharp or probe-image-size.
 */

export interface IValidatedImage {
  buffer: Buffer;
  width: number;
  height: number;
  contentType: string;
}

const MIN_DIMENSION = 200;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Parse JPEG dimensions from SOF0/SOF2 markers.
 */
function parseJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  let offset = 2; // skip SOI marker (0xFFD8)
  while (offset < buf.length - 1) {
    if (buf[offset] !== 0xFF) return null;
    const marker = buf[offset + 1];
    // SOF0 (0xC0) or SOF2 (0xC2) — baseline or progressive
    if (marker === 0xC0 || marker === 0xC2) {
      if (offset + 9 > buf.length) return null;
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    // Skip to next marker
    if (offset + 3 >= buf.length) return null;
    const segmentLength = buf.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null; // Malformed segment — length includes its own 2 bytes
    offset += 2 + segmentLength;
  }
  return null;
}

/**
 * Parse PNG dimensions from IHDR chunk.
 */
function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG signature: 8 bytes, then IHDR chunk: 4-byte length + 'IHDR' + 4-byte width + 4-byte height
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null; // Not PNG
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

/**
 * Parse WebP dimensions from VP8/VP8L headers.
 */
function parseWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  const riff = buf.toString('ascii', 0, 4);
  const webp = buf.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || webp !== 'WEBP') return null;

  const format = buf.toString('ascii', 12, 16);
  if (format === 'VP8 ') {
    // Lossy: frame header starts at byte 20, dimensions at 26
    if (buf.length < 30) return null;
    const width = buf.readUInt16LE(26) & 0x3FFF;
    const height = buf.readUInt16LE(28) & 0x3FFF;
    return { width, height };
  }
  if (format === 'VP8L') {
    // Lossless: signature byte at 21, then 4 bytes packed dimensions
    if (buf.length < 25) return null;
    const bits = buf.readUInt32LE(21);
    const width = (bits & 0x3FFF) + 1;
    const height = ((bits >> 14) & 0x3FFF) + 1;
    return { width, height };
  }
  return null;
}

/**
 * Detect content type from buffer magic bytes.
 */
function detectContentType(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.length >= 12 && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Download an image, validate dimensions >= 200x200, and return validated result.
 * Returns null if image is invalid, too small, or cannot be parsed.
 */
export async function downloadAndValidateImage(imageUrl: string): Promise<IValidatedImage | null> {
  try {
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TherSpaceBot/1.0)',
      },
    });

    if (!response.ok) return null;

    const rawContentType = response.headers.get('content-type') || '';
    // Reject SVGs and GIFs
    if (rawContentType.includes('svg') || rawContentType.includes('gif')) return null;

    // Reject oversized responses early via Content-Length header
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_IMAGE_BYTES) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_IMAGE_BYTES) return null;

    if (buffer.length < 100) return null; // Too small to be a real image

    const contentType = detectContentType(buffer);
    if (!contentType) return null;

    let dimensions: { width: number; height: number } | null = null;
    if (contentType === 'image/jpeg') {
      dimensions = parseJpegDimensions(buffer);
    } else if (contentType === 'image/png') {
      dimensions = parsePngDimensions(buffer);
    } else if (contentType === 'image/webp') {
      dimensions = parseWebpDimensions(buffer);
    }

    if (!dimensions) return null;
    if (dimensions.width < MIN_DIMENSION || dimensions.height < MIN_DIMENSION) return null;

    return {
      buffer,
      width: dimensions.width,
      height: dimensions.height,
      contentType,
    };
  } catch {
    return null;
  }
}
