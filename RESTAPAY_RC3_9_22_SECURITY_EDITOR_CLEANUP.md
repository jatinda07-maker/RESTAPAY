# RESTAPAY RC3.9.22 - Users & Security Editor Cleanup

- Replaces placeholder Edit toast with a working role editor modal.
- Administrator Edit opens access summary and Admin PIN reset/recovery.
- Manager Edit opens access summary and Manager PIN reset.
- Existing PIN is not required when already in Administrator role.
- Removes the always-visible PIN forms from Users & Security to reduce clutter.
- Keeps PIN values masked and never displays the current PIN.
- Includes the role PIN Supabase migration and access-control helper for cumulative compatibility.
