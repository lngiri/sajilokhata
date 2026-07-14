export function compressImage(
  file: File,
  maxSizeKB: number = 200
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      const maxDim = 1920;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round(height * maxDim / width);
          width = maxDim;
        } else {
          width = Math.round(width * maxDim / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      const tryQuality = (q: number, format: "webp" | "jpeg" = "webp") => {
        const mimeType = format === "webp" ? "image/webp" : "image/jpeg";
        canvas.toBlob((blob) => {
          if (!blob) {
            // WebP not supported — retry as JPEG
            if (format === "webp") {
              tryQuality(0.8, "jpeg");
            } else {
              reject(new Error("Canvas compression returned null"));
            }
            return;
          }
          if (blob.size <= maxSizeKB * 1024 || q <= 0.1) {
            resolve(blob);
          } else {
            tryQuality(q - 0.1, format);
          }
        }, mimeType, q);
      };
      tryQuality(0.8);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
