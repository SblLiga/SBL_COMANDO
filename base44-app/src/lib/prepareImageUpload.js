/**
 * Compress / resize images in-browser before upload.
 * Phone photos become small JPEGs so nginx/EB accepts them.
 */

const MAX_INPUT_BYTES = 30 * 1024 * 1024;
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.78;
const TARGET_MAX_BYTES = 900 * 1024; // stay under typical 1MB proxy limits

export function formatUploadError(err) {
  const status = err?.status;
  const raw = err?.message || "";
  if (status === 413 || /entity too large|413/i.test(raw)) {
    return "התמונה גדולה מדי לשרת. נסי תמונה אחרת או JPG.";
  }
  if (status === 401 || status === 403) {
    return "צריך להתחבר מחדש ואז להעלות שוב.";
  }
  if (status === 400) {
    if (/15MB|5MB|under|too large|גדול/i.test(raw)) {
      return "התמונה גדולה מדי. נסי תמונה אחרת.";
    }
    if (/image|Only image/i.test(raw)) {
      return "רק קבצי תמונה נתמכים (JPG / PNG / WEBP).";
    }
    return typeof raw === "string" && raw.trim() ? raw : "העלאה נדחתה על ידי השרת.";
  }
  if (status >= 500) {
    return "תקלה בשרת בהעלאה. נסי שוב בעוד רגע.";
  }
  if (/Failed to fetch|NetworkError|network/i.test(raw)) {
    return "בעיית רשת — בדקי חיבור ונסי שוב.";
  }
  return raw || "העלאת התמונה נכשלה. נסי שוב.";
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    if (!canvas.toBlob) {
      try {
        const dataUrl = canvas.toDataURL(type, quality);
        const bin = atob(dataUrl.split(",")[1] || "");
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type }));
      } catch (e) {
        reject(e);
      }
      return;
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("דחיסת התמונה נכשלה"));
        else resolve(blob);
      },
      type,
      quality
    );
  });
}

async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("לא ניתן לקרוא את התמונה. נסי JPG או PNG."));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToCanvas(source, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("הדפדפן לא תומך בדחיסת תמונות");
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

/**
 * Always produce a compact JPEG for upload (avoids proxy 413 on phone photos).
 * @returns {Promise<File>}
 */
export async function prepareImageForUpload(file, { maxEdge = MAX_EDGE } = {}) {
  if (!file) throw new Error("לא נבחר קובץ");

  const ext = (file.name || "").split(".").pop()?.toLowerCase() || "";
  const type = (file.type || "").toLowerCase();

  if (["heic", "heif"].includes(ext) || type.includes("heic") || type.includes("heif")) {
    throw new Error("פורמט HEIC לא נתמך. שמרי כ-JPG או PNG ואז העלי שוב.");
  }

  const looksLikeImage =
    !type ||
    type.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
  if (!looksLikeImage) {
    throw new Error("יש לבחור קובץ תמונה בלבד (JPG / PNG / WEBP)");
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("התמונה גדולה מדי. נסי תמונה קטנה יותר.");
  }

  let bitmap;
  try {
    bitmap = await decodeImage(file);
  } catch (err) {
    // Last resort: send original if already small enough for proxy
    if (file.size <= TARGET_MAX_BYTES) return file;
    throw err;
  }

  try {
    let width = bitmap.width || bitmap.naturalWidth || 0;
    let height = bitmap.height || bitmap.naturalHeight || 0;
    if (!width || !height) {
      if (file.size <= TARGET_MAX_BYTES) return file;
      throw new Error("תמונה לא תקינה");
    }

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = drawToCanvas(bitmap, width, height);
    let quality = JPEG_QUALITY;
    let blob = await canvasToBlob(canvas, "image/jpeg", quality);
    while (blob.size > TARGET_MAX_BYTES && quality > 0.4) {
      quality -= 0.12;
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
    }

    if (blob.size > TARGET_MAX_BYTES && maxEdge > 480) {
      return prepareImageForUpload(file, { maxEdge: Math.round(maxEdge * 0.65) });
    }
    if (blob.size > TARGET_MAX_BYTES) {
      if (file.size <= TARGET_MAX_BYTES) return file;
      throw new Error("לא הצלחנו לדחוס את התמונה. נסי תמונה אחרת.");
    }

    const baseName = (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    if (bitmap && typeof bitmap.close === "function") {
      try {
        bitmap.close();
      } catch {
        /* ignore */
      }
    }
  }
}
