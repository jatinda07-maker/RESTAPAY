# RESTAPAY RC3.9.26 - Default Manager Mode

- Every fresh page load now starts in Manager mode.
- A previously elevated Admin state is cleared by refresh/reopen.
- Supabase user-role lookup still identifies the signed-in user but no longer silently promotes the UI to Admin.
- Admin remains available only through the existing secure PIN unlock flow.
- The current Manager navigation, Dashboard, and Report access configuration remains enforced immediately at startup.
