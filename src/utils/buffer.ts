async function getClipBuffer(
  clip: { file?: File; url?: string } | null,
  fallbackUrl?: string
): Promise<ArrayBuffer | null> {
  if (!clip) return null;

  if (clip.file) {
    return clip.file.arrayBuffer();
  }

  const url = clip.url || fallbackUrl;
  if (!url) return null;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch clip buffer: " + response.statusText);
  }

  return response.arrayBuffer();
}

export { getClipBuffer };
