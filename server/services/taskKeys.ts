const taskKeyPattern =
  /(^|[^A-Z0-9])(CL-(?:PROTO|VRS|ALP|BET|RC|R)-\d{3}(?:\.\d{2})?)(?=$|[^A-Z0-9])/i;

export function extractTaskKey(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }
  const match = input.match(taskKeyPattern);
  return match?.[2]?.toUpperCase() || null;
}

export function findTaskKey(...inputs: Array<string | null | undefined>) {
  for (const input of inputs) {
    const key = extractTaskKey(input);
    if (key) {
      return key;
    }
  }
  return null;
}
