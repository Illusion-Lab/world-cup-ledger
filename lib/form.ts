export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function formNumber(formData: FormData, key: string) {
  const value = formString(formData, key);
  if (!value) return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function messagePath(path: string, message: string) {
  return `${path}?error=${encodeURIComponent(message)}`;
}
