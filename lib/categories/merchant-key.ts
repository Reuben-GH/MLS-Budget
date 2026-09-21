// Bank CSV descriptions carry variable trailing tokens for the same
// merchant — a store number, a reference number, sometimes a date —
// e.g. "WOOLWORTHS 2145" today, "WOOLWORTHS 8890" at a different
// store next month. Matching the raw description exactly would mean
// a merchant memory rule almost never fires a second time. This
// strips a trailing run of digits (and the whitespace before it) to
// get a stable merchant identity instead.
//
// This is a first-pass heuristic, not a promise — same "good enough
// starting point" scope call already made for the keyword rules in
// lib/categorisation/engine.ts. A description with no trailing digits
// (e.g. "NETFLIX.COM") is returned unchanged.
export function deriveMerchantKey(description: string): string {
  return description
    .trim()
    .toUpperCase()
    .replace(/\s+\d+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}
