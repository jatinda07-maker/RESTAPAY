# RC5 Payroll Employee Matching Root Fix

- Matches Toast payroll rows to existing employees by external ID, exact normalized name, reversed Toast name, and first/last name tokens.
- Prioritizes an existing employee with a configured hourly rate over an auto-created zero-rate duplicate.
- Uses inactive historical employee records for payroll calculation while keeping active-only dropdowns.
- Saves the matched employee ID and resolved hourly rate when recalculating.
- Recalculates regular pay as hours multiplied by the employee hourly rate when imported wages are absent.
- Shows the matched hourly rate or an unmatched employee warning in the Payroll Register.
- Separately reports unmatched employees and employees missing an hourly rate.
