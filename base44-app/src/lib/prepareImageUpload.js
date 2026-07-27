/**
 * Compress / resize images in-browser before upload.
 * Phone photos (8–15MB) become ~200–800KB JPEG so uploads succeed reliably.
 */

const MAX_INPUT_BYTES = 25 * 1024 * 1024; // accept up to 25MB from phone
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const TARGET_MAX_BYTES = 2.5 * 1024 * 1024;

export function formatUploadError(err) {
  const status = err?.status;
  const raw = err?.message || "";
  if (status === 413 || /entity too large|413/i.test(raw)) {
    return "התמונה גדולה מדי לשרת. נסי תמונה קטנה יותר או JPG.";
  }
  if (status === 401 || status === 403) {
    return "צריך להתחבר מחדש ואז להעלות שוב.";
  }
  if (status === 400) {
    if (/5MB|under|too large|גדול/i.test(raw)) {
      return "התמונה עדיין גדולה מדי אחרי דחיסה. נסי תמונה אחרת.";
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

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("לא ניתן לקרוא את התמונה. נסי JPG או PNG."));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
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

/**
 * @returns {Promise<File>} compressed JPEG/PNG file ready for upload
 */
export async function prepareImageForUpload(file, { maxEdge = MAX_EDGE } = {}) {
  if (!file) throw new Error("לא נבחר קובץ");

  const ext = (file.name || "").split(".").pop()?.toLowerCase() || "";
  const type = (file.type || "").toLowerCase();

  if (["heic", "heif"].includes(ext) || type.includes("heic") || type.includes("heif")) {
    throw new Error("פורמט HEIC לא נתמך. באייפון: הגדרות → מצלמה → פורמטים → תואם ביותר, או שמרי כ-JPG.");
  }

  const looksLikeImage =
    !type ||
    type.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
  if (!looksLikeImage) {
    throw new Error("יש לבחור קובץ תמונה בלבד (JPG / PNG / WEBP)");
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("התמונה גדולה מ-25MB. נסי לצלם מחדש או לבחור תמונה קטנה יותר.");
  }

  // Small enough already — skip work
  if (file.size <= 900 * 1024 && type !== "image/gif") {
    return file;
  }

  const img = await loadImageFromFile(file);
  let { width, height } = img;
  if (!width || !height) throw new Error("תמונה לא תקינה");

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("הדפדפן לא תומך בדחיסת תמונות");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = JPEG_QUALITY;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);
  while (blob.size > TARGET_MAX_BYTES && quality > 0.45) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  if (blob.size > TARGET_MAX_BYTES && maxEdge > 640) {
    // Second pass: smaller edge
    return prepareImageForUpload(file, { maxEdge: Math.round(maxEdge * 0.7) });
  }
  if (blob.size > TARGET_MAX_BYTES) {
    throw new Error("לא הצלחנו לדחוס את התמונה מספיק. נסי תמונה אחרת.");
  }

  const baseName = (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
