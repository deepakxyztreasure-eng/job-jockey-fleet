// Client-side image optimizer.
// Files <= 500 KB pass through untouched.
// Larger files are resized/re-encoded as JPEG targeting 200–500 KB.
// Never throws: if anything fails (unsupported codec, canvas blocked, HEIC on
// old browsers) the original file is returned so the upload still succeeds.

const MAX_ORIGINAL_BYTES = 500 * 1024;
const TARGET_MIN_BYTES = 200 * 1024;
const TARGET_MAX_BYTES = 500 * 1024;
const MAX_DIMENSION = 1920;

export type OptimizeResult = {
  file: File;
  originalSize: number;
  finalSize: number;
  optimized: boolean;
  error?: string;
};

export async function optimizeImage(file: File): Promise<OptimizeResult> {
  const base: OptimizeResult = {
    file,
    originalSize: file.size,
    finalSize: file.size,
    optimized: false,
  };
  if (!file.type.startsWith("image/")) return base;
  if (file.size <= MAX_ORIGINAL_BYTES) return base;

  let bitmap: ImageBitmap | HTMLImageElement | null = null;
  try {
    bitmap = await loadBitmap(file);
    let width = "width" in bitmap ? bitmap.width : (bitmap as HTMLImageElement).naturalWidth;
    let height = "height" in bitmap ? bitmap.height : (bitmap as HTMLImageElement).naturalHeight;
    if (!width || !height) throw new Error("Could not read image dimensions");

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    let quality = 0.82;
    let blob = await draw(bitmap, width, height, quality);

    // Reduce quality until within target max
    while (blob.size > TARGET_MAX_BYTES && quality > 0.4) {
      quality = Math.round((quality - 0.1) * 100) / 100;
      blob = await draw(bitmap, width, height, quality);
    }
    // If still too big, downscale further
    while (blob.size > TARGET_MAX_BYTES && Math.max(width, height) > 800) {
      width = Math.max(1, Math.round(width * 0.85));
      height = Math.max(1, Math.round(height * 0.85));
      blob = await draw(bitmap, width, height, quality);
    }
    // If way under target, nudge quality up (best effort)
    if (blob.size < TARGET_MIN_BYTES && quality < 0.9) {
      const tryBlob = await draw(bitmap, width, height, Math.min(0.9, quality + 0.15));
      if (tryBlob.size <= TARGET_MAX_BYTES) blob = tryBlob;
    }

    // Never upload something bigger than the original.
    if (blob.size >= file.size) return base;

    const newName = jpgName(file.name);
    const out = new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
    return { file: out, originalSize: file.size, finalSize: out.size, optimized: true };
  } catch (e: any) {
    return { ...base, error: e?.message || "Optimization failed" };
  } finally {
    if (bitmap && "close" in bitmap) {
      try {
        (bitmap as ImageBitmap).close();
      } catch {
        /* noop */
      }
    }
  }
}

// Back-compat helper used by the upload flow.
export async function compressImage(file: File): Promise<File> {
  return (await optimizeImage(file)).file;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function jpgName(name: string): string {
  const stripped = name.replace(/\.[^.]+$/, "");
  return `${stripped || "image"}.jpg`;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> decoding
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
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
  if (!blob) throw new Error("Canvas encoding failed");
  return blob;
}
