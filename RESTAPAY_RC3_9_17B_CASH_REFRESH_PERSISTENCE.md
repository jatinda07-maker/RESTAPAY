# RESTAPAY RC3.9.17B - Cash Refresh Persistence

- Closing cash reconciliation is now treated as an authoritative balance anchor through the selected range end, even when the reconciliation date falls inside the selected range.
- The target closing balance is persisted in the existing cash-ledger notes payload as a schema-safe marker and reconstructed after Supabase reload.
- Existing older reconciliation rows remain supported by deriving their closing balance from historical cash through the reconciliation date.
- Current cash after a reconciliation is calculated as: reconciled closing cash + all cash activity after the reconciliation through the selected end date.
- Closing-balance rows are no longer counted as ordinary current-period cash adjustments.
- Includes the RC3.9.17A payrollAdapter export hotfix so Render can resolve payrollCostClass.

Expected example: a reconciled 8/9 closing balance of $203 plus $356 of later net cash activity remains $559 after browser refresh/reload.
