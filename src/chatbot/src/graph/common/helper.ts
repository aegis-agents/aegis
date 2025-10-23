export function pretty(value: any, indent: number): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(parsed, null, indent);
      } catch {
        return value;
      }
    }
    return value;
  }
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return String(value);
  }
}

export function indentLines(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
}

export function isGraphRecursionError(err: unknown): err is Error {
  if (!err || typeof err !== "object") return false;
  const e = err as any;
  const msg = String(e?.message ?? "");
  const name = String(e?.name ?? "");
  return name === "GraphRecursionError" || msg.includes("Recursion limit") || msg.includes("GRAPH_RECURSION_LIMIT") || (msg.includes("Troubleshooting URL") && msg.includes("langgraphjs") && msg.includes("errors/GRAPH_RECURSION_LIMIT"));
}
