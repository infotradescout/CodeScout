function stableSerializeValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerializeValue(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerializeValue(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(String(value));
}

export function stableSerialize(value: unknown): string {
  return stableSerializeValue(value);
}

export function createPayloadHash(value: unknown): string {
  const serialized = stableSerialize(value);
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `codescout-hash-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
