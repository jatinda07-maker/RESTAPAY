# RC14 Stability and Enterprise UI Release

## Workflow and date behavior
- Dashboard and all date-filtered workspaces open month-to-date on every visit.
- Empty current-month results remain empty and never silently expand to all historical data.
- Sales, Payroll, Invoices, and Expenses use ascending date order for consistent review.
- Text and numeric entry fields select their content on click or Tab; zero-value defaults clear for immediate entry.

## Sales
- Compact filter bar with visible search, source, and payment dropdowns.
- Search is positioned beside the date and table controls with a contrasting background.
- Month-to-date default and ascending business-date order.
- Toast cash, credit, gift, other, tips, tax, refunds, discounts, and guest fields remain independently displayed.
- Wide table and horizontal scrolling prevent header overlap.

## Payroll
- Compact payroll history rows replace the lengthy stacked layout.
- Search, payment-method, and payroll-class filters sit beside the date controls.
- Toast Labor upload includes an explicit payroll-date selector.
- Import preview and payroll history retain editable hours, pay, tips, withholding, extra pay, check number, and classification.

## Formatting
- Search controls have a pale-gold background and strong border so they are easy to find.
- Filter dropdowns have a separate pale-blue treatment.
- White dashboard icons remain enforced inside colored circles.
- Responsive horizontal scrolling prevents dense tables from overlapping.

## Deployment note
Render should build from source using:

    npm ci && npm run build

Publish directory:

    dist
