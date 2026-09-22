import { describe, test, expect } from "vitest";
import { extractAvailableMonths, resolveTargetMonth, monthLabel, monthStartDate, monthEndExclusive } from "../lib/budget/months";

describe("Phase 3 — extractAvailableMonths()", () => {
  test("de-duplicates and sorts most-recent-first", () => {
    const dates = ["2026-03-05", "2026-03-18", "2026-01-10", "2026-09-20", "2025-12-25"];
    expect(extractAvailableMonths(dates)).toEqual(["2026-09", "2026-03", "2026-01", "2025-12"]);
  });

  test("empty input returns an empty list", () => {
    expect(extractAvailableMonths([])).toEqual([]);
  });

  test("a single month's worth of dates collapses to one entry", () => {
    expect(extractAvailableMonths(["2026-09-01", "2026-09-15", "2026-09-30"])).toEqual(["2026-09"]);
  });
});

describe("Phase 3 — resolveTargetMonth()", () => {
  const available = ["2026-09", "2026-08", "2026-01"];

  test("returns the requested month when it has data", () => {
    expect(resolveTargetMonth(available, "2026-08")).toBe("2026-08");
  });

  test("falls back to the most recent month when nothing is requested", () => {
    expect(resolveTargetMonth(available, undefined)).toBe("2026-09");
  });

  test("falls back to the most recent month when the requested month has no data — never silently accepts an invalid month", () => {
    expect(resolveTargetMonth(available, "2026-05")).toBe("2026-09");
  });

  test("returns null when there's no data at all", () => {
    expect(resolveTargetMonth([], "2026-08")).toBeNull();
  });
});

describe("Phase 3 — month formatting helpers", () => {
  test("monthLabel formats an Australian-style month/year", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
  });

  test("monthStartDate appends the first of the month", () => {
    expect(monthStartDate("2026-09")).toBe("2026-09-01");
  });

  test("monthEndExclusive rolls over to the first of the next month", () => {
    expect(monthEndExclusive("2026-09")).toBe("2026-10-01");
  });

  test("monthEndExclusive rolls over the year boundary correctly", () => {
    expect(monthEndExclusive("2026-12")).toBe("2027-01-01");
  });
});
