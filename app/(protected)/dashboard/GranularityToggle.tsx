"use client";

import { useState } from "react";

type Granularity = "monthly" | "fortnightly" | "weekly";

const LABELS: Record<Granularity, string> = {
  monthly: "Monthly",
  fortnightly: "Fortnightly",
  weekly: "Weekly",
};

// Monthly is the only granularity with real data behind it right now.
// Fortnightly/Weekly show the control's shape honestly rather than
// faking recalculated numbers — same treatment as the approved mockup.
export function GranularityToggle() {
  const [granularity, setGranularity] = useState<Granularity>("monthly");

  return (
    <>
      <div className="pill-toggle">
        {(Object.keys(LABELS) as Granularity[]).map((g) => (
          <button
            key={g}
            type="button"
            className={granularity === g ? "active" : ""}
            onClick={() => setGranularity(g)}
          >
            {LABELS[g]}
          </button>
        ))}
      </div>
      {granularity !== "monthly" && (
        <div className="granularity-note">
          {LABELS[granularity]} view — activates once more transaction history is loaded. Shown
          here for layout review only.
        </div>
      )}
    </>
  );
}
