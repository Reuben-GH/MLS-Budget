"use client";

import { useTransition } from "react";
import { forgetMerchant } from "./actions";

export interface MerchantMemoryRow {
  id: string;
  merchant_key: string;
  category: string;
  subcategory: string | null;
}

interface RememberedMerchantsCardProps {
  rows: MerchantMemoryRow[];
}

// Correcting a transaction's category (see TransactionCategoryEditor)
// silently teaches the app that merchant for next time — this card is
// the only place that's visible, so a tester isn't left guessing what
// got remembered. "Forget" only removes the rule; it never touches
// transactions already categorised under it (see forgetMerchant).
export function RememberedMerchantsCard({ rows }: RememberedMerchantsCardProps) {
  const [isPending, startTransition] = useTransition();

  function handleForget(id: string) {
    startTransition(async () => {
      await forgetMerchant(id);
    });
  }

  return (
    <div className="taxonomy-card">
      <div className="taxonomy-card-head">
        <span className="taxonomy-card-name">Remembered Merchants</span>
      </div>
      <div className="taxonomy-note" style={{ marginBottom: 10 }}>
        Correcting a transaction&apos;s category teaches the app that merchant — every other
        transaction from it updates immediately, and future uploads get it right from the start.
      </div>
      {rows.length === 0 ? (
        <div className="no-subs">Nothing remembered yet — correct a transaction on the Dashboard to start.</div>
      ) : (
        <div className="sub-list">
          {rows.map((row) => (
            <div className="sub-list-row" key={row.id}>
              <span className="sub-list-name">
                {row.merchant_key} → {row.category}
                {row.subcategory ? ` · ${row.subcategory}` : ""}
              </span>
              <button
                type="button"
                className="rename-sub-link"
                onClick={() => handleForget(row.id)}
                disabled={isPending}
              >
                forget
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
