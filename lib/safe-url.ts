export function safeExternalUrl(value: string | null | undefined): string | undefined {
  if (!value || value.length > 2048) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}
