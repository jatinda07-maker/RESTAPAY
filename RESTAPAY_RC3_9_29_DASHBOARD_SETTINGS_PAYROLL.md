# RESTAPAY RC3.9.29

- Restores the full financial KPI set including Prime Cost and Operating Profit.
- Replaces the generic Payroll Total dashboard card with Manager / GM & Other Payroll, Kitchen Payroll, and Tips Check - Tipped Waiters.
- Wage cards exclude customer tip pass-through; Tips Check shows net tips separately.
- Cost Allocation uses the existing Supabase-backed `restapay-cost-settings` live setting and Save Settings now explicitly persists/validates cloud settings.
- Uses the existing Supabase `app_settings` live-setting migration already in the project.
- Keeps Admin role persistent on the same browser after successful PIN elevation until the user explicitly switches/locks to Manager.
