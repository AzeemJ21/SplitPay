/**
 * Splits structured AI dispute text into sections headed "1. NAME:" etc.
 */
export type AiSection = { heading: string; body: string; fullHeading: string };

export function parseAiSections(text: string): AiSection[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const blocks = trimmed.split(/\n(?=\d+\.\s+[A-Z])/);
  const out: AiSection[] = [];

  for (const block of blocks) {
    const b = block.trim();
    const m = /^(\d+)\.\s*([^\n:]+):\s*([\s\S]*)$/.exec(b);
    if (m) {
      out.push({
        fullHeading: `${m[1]}. ${m[2]}:`,
        heading: m[2].trim(),
        body: m[3].trim(),
      });
    } else if (b) {
      out.push({ fullHeading: "Analysis", heading: "Analysis", body: b });
    }
  }

  return out.length ? out : [{ fullHeading: "Analysis", heading: "Analysis", body: trimmed }];
}

/** Extract a 1–10 risk score from section text or full summary. */
export function extractRiskScore(text: string): number | null {
  const riskBlock =
    text.match(/6\.\s*RISK SCORE[:\s]*([\s\S]*?)(?=\n7\.|\n*$)/i)?.[1] ?? text;
  const line =
    riskBlock.match(/(?:score|severity|risk)[^\d]*(\d{1,2})(?:\s*\/\s*10)?/i) ??
    riskBlock.match(/\b(\d{1,2})\s*\/\s*10\b/);
  if (line?.[1]) {
    const n = parseInt(line[1], 10);
    if (n >= 1 && n <= 10) return n;
  }
  const plain = text.match(/\bRISK SCORE[:\s]*[\s\S]*?(\d)\b/i);
  if (plain?.[1]) {
    const n = parseInt(plain[1], 10);
    if (n >= 1 && n <= 10) return n;
  }
  return null;
}

export function riskSeverityClass(score: number): string {
  if (score <= 3) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (score <= 6) return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
  return "border-red-500/30 bg-red-500/10 text-red-300";
}
