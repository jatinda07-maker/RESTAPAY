# RC4 Sprint 1.4

- Removes duplicate employee names from Payroll filters.
- Employee selection works with the existing start/end date range and recalculates totals and daily line entries.
- Adds a warning before leaving Payroll when a Supabase save is pending or failed.
- Makes Supabase the only persistent business-data store; localStorage business-data fallback and pending backups are disabled.
- Restores the previous working Toast worker URL fallback: https://render-toast-web-service.onrender.com.
