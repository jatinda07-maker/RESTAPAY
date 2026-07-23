# RestaPay RC9 True Food & Alcohol Cost Engine

## Added
- True Food Cost includes net food purchases, 100% kitchen payroll, configurable manager payroll allocation, restaurant/kitchen supplies, and the food share of cleaning, Cintas, utilities, and insurance.
- True Alcohol Cost includes beer/liquor/wine purchases, US Foods margarita mix, bar payroll, configurable manager payroll allocation, and the alcohol share of cleaning, Cintas, utilities, and insurance.
- Server/customer tips remain excluded from operating payroll and departmental profit.
- Rebate, credit memo, and return amounts remain negative and reduce their assigned department cost.
- Settings now includes editable Food/Alcohol Allocation Rules.
- Dashboard includes True Food Cost, True Alcohol Cost, and departmental profit summaries.

## Default allocation rules
- Kitchen payroll: 100% Food
- Manager payroll: 50% Food / 50% Alcohol
- Bartender/bar payroll: 100% Alcohol
- Restaurant/kitchen supplies: 100% Food
- Cleaning supplies: 50% Food / 50% Alcohol
- Cintas: 50% Food / 50% Alcohol
- Utilities: 50% Food / 50% Alcohol
- Insurance: 50% Food / 50% Alcohol

## Vendor/item routing
- US Foods normal food items -> Food
- US Foods margarita mix / sweet & sour -> Alcohol
- Beer vendors and beer products -> Alcohol
- ABC Store, Texana, liquor, wine -> Alcohol
- Buffalo Rock soda/tea/lemonade -> Other/non-alcohol beverage unless manually allocated later

## Build verification
`npm run build` completed successfully.
