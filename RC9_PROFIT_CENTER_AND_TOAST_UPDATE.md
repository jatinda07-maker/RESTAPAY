# RC9 Profit Center + Toast SFTP Update

## Financial rules implemented

- Customer-paid server tips are excluded from operating profit.
- Kitchen payroll is allocated 100% to Food.
- Manager payroll defaults to 50% Food / 50% Alcohol.
- Margarita mix, cocktail mix, bar syrup, beer, wine and liquor are allocated 100% to Alcohol.
- Cleaning supplies default to 50% Food / 50% Alcohol.
- Utilities default to 50% Food / 50% Alcohol.
- Rent, insurance, accounting, maintenance and other shared costs default to 50/50 and are editable.
- Dashboard includes clickable Food Profit and Alcohol Profit cards with transaction drill-downs.
- Settings includes editable Financial Allocation Rules.

## Toast SFTP status

Authentication has already been confirmed for the Toast SFTP account. The root was empty and recent dated paths were not available yet, which means the connector is authenticated but is waiting for Toast to publish the first export folder.

The backend Test Connection action now:

- confirms SFTP authentication,
- checks the current remote directory,
- checks both `/EXPORT_ID/YYYYMMDD` and `/YYYYMMDD` for the configured lookback period,
- reports the first available export path,
- reports how many files are available,
- clearly distinguishes "connected, waiting for first export" from a connection failure.

Use these server environment values:

- `TOAST_SFTP_HOST=s-9b0f88558b264dfda.server.transfer.us-east-1.amazonaws.com`
- `TOAST_SFTP_PORT=22`
- `TOAST_SFTP_USERNAME=IsabellaMexicanDataExports`
- `TOAST_EXPORT_ID=144385`
- `TOAST_TIMEZONE=America/Chicago`

Never put the private SSH key in the frontend or commit it to Git. Store it in the backend as `TOAST_SFTP_PRIVATE_KEY_BASE64` or a secure private-key file path.
