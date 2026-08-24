# Phase 3D.2 - Invoice Duplicate Detection + Override

- Detects exact duplicates by vendor + invoice number.
- Detects exact duplicates without invoice numbers using vendor + date + total.
- Warns about possible duplicates using nearby date/amount and line-item similarity.
- Applies to manual invoices and Gemini/AI review because both pass through the same Save Invoice workflow.
- Blocks the normal save until the user reviews the match.
- Provides an explicit Override & Save Anyway action.
- Stores duplicate_override, duplicate_match_id, and duplicate_match_reason when overridden.
- Invoice number remains optional and Gemini no longer invents a placeholder invoice number when none is detected.
