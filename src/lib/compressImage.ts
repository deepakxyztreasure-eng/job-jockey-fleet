// Client-side image optimizer.
// Files <= 500 KB pass through untouched.
// Larger files are resized/re-encoded as JPEG targeting 200–500 KB.

const MAX_ORIGINAL_BYTES = 500 * 1024;
const TARGET_MIN_BYTES = 200 * 1024;
const TARGET_MAX_BYTES = 500 * 1024;
const MAX_DIMENSION = 1920;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= MAX_ORIGINAL_BYTES) return file;

  const bitmap = await loadBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  let quality = 0.82;
  let blob = await draw(bitmap, width, height, quality);

  // Reduce quality until within target max
  while (blob.size > TARGET_MAX_BYTES && quality > 0.4) {
    quality -= 0.1;
    blob = await draw(bitmap, width, height, quality);
  }
  // If still too big, downscale further
  while (blob.size > TARGET_MAX_BYTES && Math.max(width, height) > 800) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    blob = await draw(bitmap, width, height, quality);
  }
  // If way under, try nudging quality up (best effort)
  if (blob.size < TARGET_MIN_BYTES && quality < 0.9) {
    const tryBlob = await draw(bitmap, width, height, Math.min(0.9, quality + 0.15));
    if (tryBlob.size <= TARGET_MAX_BYTES) blob = tryBlob;
  }

  const newName = file.name.replace(/\.(png|webp|heic|heif|bmp|tiff?)$/i, ".jpg");
  return new File([blob], newName.endsWith(".jpg") || newName.endsWith(".jpeg") ? newName : `${newName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // revoked after draw
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

async function draw(
  source: ImageBitmap | HTMLImageElement,
  w: number,
  h: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compression failed"))),
      "image/jpeg",
      quality
    )
  );
}
