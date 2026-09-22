"use client";

import { useRouter } from "next/navigation";

interface MonthOption {
  value: string; // "YYYY-MM"
  label: string; // "September 2026"
}

interface MonthNavProps {
  currentMonth: string;
  options: MonthOption[]; // sorted most recent first (extractAvailableMonths)
}

// Dropdown of every month that actually has data, plus Previous/Next
// arrows for quick stepping — rather than an arbitrary "how many
// months" count or a raw date range, both of which imply months that
// might not have anything in them. Navigates via ?month=YYYY-MM, so
// a given month is a real bookmarkable/shareable URL, not just
// client-side state.
export function MonthNav({ currentMonth, options }: MonthNavProps) {
  const router = useRouter();
  const index = options.findIndex((o) => o.value === currentMonth);
  const hasOlder = index !== -1 && index < options.length - 1; // options[0] is most recent
  const hasNewer = index > 0;

  function goTo(month: string) {
    router.push(`/dashboard?month=${month}`);
  }

  return (
    <div className="month-nav">
      <div className="period-nav">
        <button type="button" onClick={() => goTo(options[index + 1].value)} disabled={!hasOlder} title="Previous month">
          ‹
        </button>
        <button type="button" onClick={() => goTo(options[index - 1].value)} disabled={!hasNewer} title="Next month">
          ›
        </button>
      </div>
      <select className="month-select" value={currentMonth} onChange={(e) => goTo(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
