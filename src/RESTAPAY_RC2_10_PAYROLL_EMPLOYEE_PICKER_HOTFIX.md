# RESTAPAY RC2.10 - Payroll Employee Picker Hotfix

- Manual Payroll Entry now uses the active Employees collection instead of a free-text employee field.
- Employee options are sorted A-Z.
- Selecting an employee inherits Job Type and Payment Method into the payroll form.
- Added an inline + Add Employee action from Manual Payroll Entry.
- New employees are written to the same `restapay-employees` collection used by the Employees page and are automatically selected after save.
- Duplicate employee names are not re-created; the existing employee is selected instead.
- Added selector layout CSS so the employee name remains visible beside the + action.
