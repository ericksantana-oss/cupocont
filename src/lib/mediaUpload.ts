export const MEDIA_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

export const FORMAT_LIMITS: Record<string, { min: number; max: number }> = {
  IMAGE: { min: 1, max: 1 },
  VIDEO: { min: 1, max: 1 },
  REELS: { min: 1, max: 1 },
  CAROUSEL: { min: 2, max: 10 },
  STORIES: { min: 1, max: 1 },
};

export function sanitizeForStorageKey(fileName: string): string {
  return fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "_");
}

export function validateFileCountForFormat(format: string, count: number): void {
  const limits = FORMAT_LIMITS[format];
  if (!limits) throw new Error("Formato inválido.");
  if (count < limits.min || count > limits.max) {
    throw new Error(
      limits.min === limits.max
        ? `Este formato exige exatamente ${limits.min} arquivo(s).`
        : `Este formato aceita entre ${limits.min} e ${limits.max} arquivos.`
    );
  }
}
