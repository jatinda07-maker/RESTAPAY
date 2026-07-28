# RC4.4.1 Stability Release

- Supabase payroll tables are authoritative after a successful cloud load.
- Deleted payroll rows are removed from normalized Supabase tables, not only from local state.
- Payroll deletion is permanent from both Payroll and Approved Payroll.
- Deleted payroll tombstones prevent recovery caches from recreating records.
- Cloud saves are serialized to prevent an older save finishing after a newer delete.
- Automatic reconnect runs on app start, browser focus, network reconnect, and every 60 seconds.
- Current page is retained after refresh.
- Date inputs open when any part of the field is clicked.
- Buttons missing an explicit type were changed to type=button to prevent accidental form submissions and double-click behavior.
- Clear All Payroll requires typing CLEAR PAYROLL.
