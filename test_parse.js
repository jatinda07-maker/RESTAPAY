const XLSX = require('xlsx');
const window = {XLSX};
function currencyValue(value) { return Number.parseFloat(value || 0) || 0; }
const today = '2026-06-14';
function excelDateNumberToInput(value) {
  const raw = String(value || "").replace(/[^0-9]/g, "");
  if (raw.length >= 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return "";
}

function parseToastDateRangeFromName(name) {
  const match = String(name || "").match(/(20\d{2})[-_](\d{2})[-_](\d{2}).*(20\d{2})[-_](\d{2})[-_](\d{2})/);
  if (!match) return { start: "", end: today };
  return {
    start: `${match[1]}-${match[2]}-${match[3]}`,
    end: `${match[4]}-${match[5]}-${match[6]}`
  };
}

function readWorkbookRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
}

function findToastDailyRows(workbook) {
  const daily = [];
  workbook.SheetNames.forEach(sheetName => {
    const rows = readWorkbookRows(workbook, sheetName);
    rows.forEach(row => {
      const date = excelDateNumberToInput(row[0]);
      const netSales = currencyValue(row[1]);
      const checks = currencyValue(row[2]);
      const guests = currencyValue(row[3]);
      if (date && netSales > 0) {
        daily.push({
          date,
          grossSales: netSales,
          netSales,
          cashSales: 0,
          cardSales: 0,
          discounts: 0,
          refunds: 0,
          tips: 0,
          tax: 0,
          guests,
          checks,
          source: "Toast Sales Excel"
        });
      }
    });
  });

  const unique = {};
  daily.forEach(item => {
    unique[item.date] = item;
  });
  return Object.values(unique).sort((a, b) => a.date.localeCompare(b.date));
}



function findToastLabeledAmount(workbook, labelPatterns) {
  if (!window.XLSX || !workbook?.Sheets) return 0;
  const patterns = labelPatterns.map(pattern => pattern instanceof RegExp ? pattern : new RegExp(String(pattern), "i"));

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "" });
    for (const row of rows) {
      for (let i = 0; i < row.length; i += 1) {
        const text = String(row[i] || "").trim();
        if (!text) continue;
        if (patterns.some(pattern => pattern.test(text))) {
          for (let j = i + 1; j < row.length; j += 1) {
            const amount = currencyValue(row[j]);
            if (amount !== 0) return amount;
          }
          // Some Toast files put label in one cell and amount in first numeric cell on same row, including before label.
          for (let j = 0; j < row.length; j += 1) {
            if (j === i) continue;
            const amount = currencyValue(row[j]);
            if (amount !== 0) return amount;
          }
        }
      }
    }
  }

  return 0;
}

function toastCashCollectedFromWorkbook(workbook, fallbackCashSales = 0) {
  const exact = findToastLabeledAmount(workbook, [
    /^cash collected$/i,
    /cash\s+collected/i,
    /^cash collected amount$/i
  ]);
  return exact || fallbackCashSales;
}

function toastSheetName(workbook, exactName, fallbackPattern = null) {
  if (!workbook?.SheetNames?.length) return "";
  const exact = workbook.SheetNames.find(name => String(name).trim().toLowerCase() === String(exactName || "").trim().toLowerCase());
  if (exact) return exact;
  if (fallbackPattern) return workbook.SheetNames.find(name => fallbackPattern.test(String(name))) || "";
  return "";
}

function normalizeToastHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toastHeaderIndex(headerRow, labels) {
  const wanted = (Array.isArray(labels) ? labels : [labels]).map(normalizeToastHeader);
  return (headerRow || []).findIndex(cell => wanted.includes(normalizeToastHeader(cell)));
}

function toastSheetRows(workbook, exactName, fallbackPattern = null) {
  const sheetName = toastSheetName(workbook, exactName, fallbackPattern);
  return sheetName ? readWorkbookRows(workbook, sheetName) : [];
}

function toastSingleRowValues(workbook, exactName, fallbackPattern = null) {
  const rows = toastSheetRows(workbook, exactName, fallbackPattern);
  if (!rows.length) return {};
  const headers = rows[0] || [];
  const data = rows.find((row, index) => index > 0 && row.some(cell => String(cell || "").trim() !== "")) || [];
  return headers.reduce((values, header, index) => {
    const key = normalizeToastHeader(header);
    if (key) values[key] = data[index];
    return values;
  }, {});
}

function toastValue(values, labels) {
  const wanted = Array.isArray(labels) ? labels : [labels];
  for (const label of wanted) {
    const key = normalizeToastHeader(label);
    if (Object.prototype.hasOwnProperty.call(values, key)) return currencyValue(values[key]);
  }
  return 0;
}

function toastPaymentSummaryRows(workbook) {
  if (!window.XLSX || !workbook?.Sheets) return [];
  const rows = toastSheetRows(workbook, "Payments summary", /payment/i);
  if (!rows.length) return [];
  const header = rows[0] || [];
  const indexes = {
    type: toastHeaderIndex(header, "Payment type"),
    subType: toastHeaderIndex(header, "Payment sub type"),
    count: toastHeaderIndex(header, "Count"),
    amount: toastHeaderIndex(header, "Amount"),
    tips: toastHeaderIndex(header, "Tips"),
    gratuity: toastHeaderIndex(header, ["Grat", "Gratuity"]),
    tax: toastHeaderIndex(header, "Tax amount"),
    refunds: toastHeaderIndex(header, "Refunds"),
    tipRefunds: toastHeaderIndex(header, "Tip refunds"),
    legacyTips: toastHeaderIndex(header, "Legacy tips"),
    total: toastHeaderIndex(header, "Total")
  };

  return rows.slice(1)
    .map(row => ({
      type: String(row[indexes.type] || "").trim(),
      subType: String(row[indexes.subType] || "").trim(),
      count: currencyValue(row[indexes.count]),
      amount: currencyValue(row[indexes.amount]),
      tips: currencyValue(row[indexes.tips]),
      gratuity: currencyValue(row[indexes.gratuity]),
      tax: currencyValue(row[indexes.tax]),
      refunds: currencyValue(row[indexes.refunds]),
      tipRefunds: currencyValue(row[indexes.tipRefunds]),
      legacyTips: currencyValue(row[indexes.legacyTips]),
      total: currencyValue(row[indexes.total]) || currencyValue(row[indexes.amount])
    }))
    .filter(row => row.type);
}

function toastPaymentSummaryTotals(workbook) {
  const rows = toastPaymentSummaryRows(workbook);
  const totals = {
    cashSales: 0,
    cashCollected: 0,
    cardSales: 0,
    otherSales: 0,
    doorDashSales: 0,
    giftCardSales: 0,
    amexSales: 0,
    discoverSales: 0,
    mastercardSales: 0,
    visaSales: 0,
    paymentTotal: 0,
    paymentAmountTotal: 0,
    paymentTaxTotal: 0,
    paymentTipsTotal: 0,
    paymentRows: rows
  };

  rows.forEach(row => {
    const type = String(row.type || "").trim().toLowerCase();
    const subType = String(row.subType || "").trim().toLowerCase();
    const amount = currencyValue(row.amount);
    const total = currencyValue(row.total) || amount;

    if (!type || type === "payment type") return;
    if (type === "total") {
      totals.paymentAmountTotal = amount;
      totals.paymentTotal = total;
      totals.paymentTaxTotal = currencyValue(row.tax);
      totals.paymentTipsTotal = currencyValue(row.tips || row.legacyTips);
      return;
    }

    if (type === "cash") totals.cashSales += amount;
    if (type === "credit/debit" && !subType) totals.cardSales += amount;
    if (type === "gift card") totals.giftCardSales += amount;
    if (type === "other" && !subType) totals.otherSales += amount;
    if (type === "other" && subType.includes("doordash")) totals.doorDashSales += amount;

    if (subType.includes("amex")) totals.amexSales += amount;
    if (subType.includes("discover")) totals.discoverSales += amount;
    if (subType.includes("mastercard")) totals.mastercardSales += amount;
    if (subType.includes("visa")) totals.visaSales += amount;
  });

  if (!totals.cardSales) {
    totals.cardSales = totals.amexSales + totals.discoverSales + totals.mastercardSales + totals.visaSales;
  }
  if (!totals.otherSales) totals.otherSales = totals.doorDashSales;
  if (!totals.paymentAmountTotal) {
    totals.paymentAmountTotal = rows
      .filter(row => String(row.type || "").trim().toLowerCase() !== "total" && !String(row.subType || "").trim())
      .reduce((sum, row) => sum + currencyValue(row.amount), 0);
  }
  if (!totals.paymentTotal) {
    totals.paymentTotal = rows
      .filter(row => String(row.type || "").trim().toLowerCase() !== "total" && !String(row.subType || "").trim())
      .reduce((sum, row) => sum + currencyValue(row.total), 0);
  }

  return totals;
}

function findToastTableValue(workbook, sheetNamePattern, rowLabelPattern, columnLabelPattern = null) {
  if (!window.XLSX || !workbook?.Sheets) return 0;
  const sheetName = workbook.SheetNames.find(name => sheetNamePattern.test(String(name)));
  if (!sheetName) return 0;

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "" });
  if (!rows.length) return 0;

  if (columnLabelPattern) {
    const header = rows[0].map(cell => String(cell || "").trim());
    const colIndex = header.findIndex(label => columnLabelPattern.test(label));
    const rowIndex = rows.findIndex(row => row.some(cell => rowLabelPattern.test(String(cell || "").trim())));
    if (colIndex >= 0 && rowIndex >= 0) return currencyValue(rows[rowIndex][colIndex]);
  }

  for (const row of rows) {
    const labelIndex = row.findIndex(cell => rowLabelPattern.test(String(cell || "").trim()));
    if (labelIndex >= 0) {
      for (let i = labelIndex + 1; i < row.length; i += 1) {
        const amount = currencyValue(row[i]);
        if (amount !== 0) return amount;
      }
      for (let i = 0; i < row.length; i += 1) {
        if (i === labelIndex) continue;
        const amount = currencyValue(row[i]);
        if (amount !== 0) return amount;
      }
    }
  }
  return 0;
}

function toastCashSummaryTotals(workbook) {
  const cashSummary = toastSingleRowValues(workbook, "Cash summary", /cash summary/i);
  const cashActivity = toastSingleRowValues(workbook, "Cash activity", /cash activity/i);
  return {
    expectedCloseoutCash: toastValue(cashSummary, "Expected closeout cash"),
    actualCloseoutCash: toastValue(cashSummary, "Actual closeout cash"),
    expectedDeposit: toastValue(cashSummary, "Expected deposit"),
    actualDeposit: toastValue(cashSummary, "Actual deposit"),
    totalCashPayments: toastValue(cashActivity, "Total cash payments"),
    cashBeforeTipouts: toastValue(cashActivity, "Cash before tipouts"),
    creditNonCashTips: toastValue(cashActivity, "Credit/non-cash tips"),
    tipoutsTipsWithheld: toastValue(cashActivity, "Tipouts tips withheld"),
    totalCash: toastValue(cashActivity, "Total cash")
  };
}

function toastActualCloseoutCashFromWorkbook(workbook) {
  const cash = toastCashSummaryTotals(workbook);
  return cash.actualCloseoutCash
    || findToastTableValue(workbook, /cash summary/i, /^actual closeout cash$/i)
    || findToastTableValue(workbook, /cash summary/i, /actual closeout/i);
}

function toastCashCollectedAmount(item) {
  return currencyValue(item.actualCloseoutCash || item.cashCollected);
}

function toastCashCollectedInRange(start = "", end = "") {
  return (state.sales || [])
    .filter(item => dateInRange(item.date, start, end))
    .reduce((sum, item) => sum + toastCashCollectedAmount(item), 0);
}

function toastCashCollectedRows(start = "", end = "") {
  return (state.sales || [])
    .filter(item => dateInRange(item.date, start, end) && toastCashCollectedAmount(item) > 0)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .map(item => detailRow(
      `${item.date || "No date"} • Actual Closeout Cash`,
      `Toast Cash Collected • Cash sales ${money.format(currencyValue(item.cashSales))} • Net sales ${money.format(currencyValue(item.netSales))}`,
      toastCashCollectedAmount(item)
    ));
}

function parseToastSalesByDayRows(workbook, range) {
  const rows = toastSheetRows(workbook, "Sales by day", /sales by day/i);
  if (rows.length < 2) return [];
  const header = rows[0] || [];
  const indexes = {
    date: toastHeaderIndex(header, ["yyyyMMdd", "Date"]),
    netSales: toastHeaderIndex(header, "Net sales"),
    checks: toastHeaderIndex(header, ["Total orders", "Checks"]),
    guests: toastHeaderIndex(header, ["Total guests", "Guests"])
  };
  return rows.slice(1).map(row => {
    const date = excelDateNumberToInput(row[indexes.date]);
    const netSales = currencyValue(row[indexes.netSales]);
    return {
      date,
      weekStart: range.start,
      weekEnd: range.end,
      grossSales: netSales,
      netSales,
      checks: currencyValue(row[indexes.checks]),
      guests: currencyValue(row[indexes.guests]),
      source: "Toast Sales Excel"
    };
  }).filter(row => row.date && row.netSales);
}

function parseToastSalesWorkbook(workbook, fileName) {
  const range = parseToastDateRangeFromName(fileName);
  const paymentTotals = toastPaymentSummaryTotals(workbook);
  const revenue = toastSingleRowValues(workbook, "Revenue summary", /revenue summary/i);
  const netSalesSummary = toastSingleRowValues(workbook, "Net sales summary", /net sales summary/i);
  const tipSummary = toastSingleRowValues(workbook, "Tip summary", /tip summary/i);
  const cash = toastCashSummaryTotals(workbook);
  const dailyRows = parseToastSalesByDayRows(workbook, range);

  const netSales = toastValue(revenue, "Net sales") || toastValue(netSalesSummary, "Net sales") || dailyRows.reduce((sum, row) => sum + currencyValue(row.netSales), 0);
  const discounts = Math.abs(toastValue(netSalesSummary, ["Discounts", "Discount amount"]));
  const refunds = toastValue(netSalesSummary, ["Refunds", "Refund amount"]);
  const grossSales = toastValue(netSalesSummary, ["Gross sales", "Gross sales before discounts"])
    || (netSales + discounts - refunds)
    || toastValue(revenue, "Total");
  const tips = toastValue(revenue, "Tips") || toastValue(tipSummary, ["Total tips", "Tips"]);
  const tax = toastValue(revenue, "Tax amount") || paymentTotals.paymentTaxTotal;
  const checks = dailyRows.reduce((sum, row) => sum + currencyValue(row.checks), 0);
  const guests = dailyRows.reduce((sum, row) => sum + currencyValue(row.guests), 0);

  const weeklyRow = {
    date: range.end,
    weekStart: range.start,
    weekEnd: range.end,
    grossSales,
    netSales,
    cashSales: paymentTotals.cashSales,
    cashCollected: cash.actualCloseoutCash || cash.totalCash || paymentTotals.cashSales,
    actualCloseoutCash: cash.actualCloseoutCash || cash.totalCash || paymentTotals.cashSales,
    expectedCloseoutCash: cash.expectedCloseoutCash,
    actualDeposit: cash.actualDeposit,
    expectedDeposit: cash.expectedDeposit,
    totalCashPayments: cash.totalCashPayments,
    cashBeforeTipouts: cash.cashBeforeTipouts,
    creditNonCashTips: cash.creditNonCashTips,
    tipoutsTipsWithheld: cash.tipoutsTipsWithheld,
    totalCash: cash.totalCash,
    cardSales: paymentTotals.cardSales,
    otherSales: paymentTotals.otherSales,
    doorDashSales: paymentTotals.doorDashSales,
    giftCardSales: paymentTotals.giftCardSales,
    amexSales: paymentTotals.amexSales,
    discoverSales: paymentTotals.discoverSales,
    mastercardSales: paymentTotals.mastercardSales,
    visaSales: paymentTotals.visaSales,
    paymentTotal: paymentTotals.paymentTotal,
    paymentAmountTotal: paymentTotals.paymentAmountTotal,
    paymentTaxTotal: paymentTotals.paymentTaxTotal,
    paymentTipsTotal: paymentTotals.paymentTipsTotal,
    paymentRows: paymentTotals.paymentRows,
    discounts,
    refunds,
    tips,
    tax,
    guests,
    checks,
    source: "Toast Sales Excel"
  };

  // Keep one imported sales row per Toast report so all payment channels stay aligned to the same report period.
  if (weeklyRow.netSales || weeklyRow.grossSales || weeklyRow.paymentTotal || weeklyRow.cashSales) {
    return [weeklyRow];
  }

  return dailyRows.map(row => ({
    ...row,
    cashSales: 0,
    cashCollected: 0,
    cardSales: 0,
    otherSales: 0,
    doorDashSales: 0,
    giftCardSales: 0,
    source: "Toast Sales Excel"
  }));
}


const workbook = XLSX.readFile('/mnt/data/SalesSummary_2026-06-01_2026-06-07(2).xlsx');
const rows = parseToastSalesWorkbook(workbook, 'SalesSummary_2026-06-01_2026-06-07(2).xlsx');
console.log(JSON.stringify(rows, null, 2));
