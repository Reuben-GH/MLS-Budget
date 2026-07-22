# Data model decisions

## Sign convention (needs Reg's confirmation)

`transactions.amount` follows a bank-statement convention:

- **Debits (money out) are negative.**
- **Credits (money in, including refunds) are positive.**

Aggregation, given this convention:

```
total_income    = SUM(amount) WHERE top_level_category = 'Income'
total_expenses  = -SUM(amount) WHERE top_level_category <> 'Income'
surplus         = total_income - total_expenses
```

This is what makes the fixture's refund edge case resolve correctly: a
$45 refund against a JB HI-FI-type purchase, categorised under
`Personal / Shopping` (not `Income`), is a **positive** amount within a
non-Income category — it nets against that category's outgoing total
without ever inflating `total_income`.

If this isn't the intended convention, flag it before Phase 2
(ingestion) locks in a parsing direction for statement amounts.

## Category taxonomy

See [`lib/categories/taxonomy.ts`](../lib/categories/taxonomy.ts) — the
single source of truth for the 11 fixed top-level categories. The
categorisation engine (Phase 3) must classify into these and must not
invent new top-level categories.
