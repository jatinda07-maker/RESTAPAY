# RESTAPAY RC3.9.31 - Price KPI Drilldown Synchronization

- Price comparisons use invoice history through the selected end date, so a current-period invoice can compare against an older prior invoice.
- Only comparisons whose current invoice falls inside the selected date range appear in current-period KPI counts.
- Comparison records now carry previous_date, current_date, and effective_date.
- Price Increase, Items Decreased, Largest Increase, and Unit Impact cards pass exact comparison rows into DetailDrawer.
- Clicking a specific item inside a price KPI resolves back to that item's exact prior/current comparison rows.
- Previous comparison rows are retained in the drawer even when the previous invoice is outside the selected period, as long as the current comparison invoice is in range.
