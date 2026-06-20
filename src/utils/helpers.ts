/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, Vendor, Invoice, PayrollEntry, SalesRecord, ToastPayrollRow, PriceAlert } from "../types";
import * as XLSX from "xlsx";

export const DATA_KEY = "restaurant-payroll-vendor";
export const today = "2026-06-20"; // Match the current date year 2026 as per constraints

export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function currencyValue(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  const raw = String(value).trim();
  if (!raw) return 0;
  const isParenthesesNegative = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[,$%\s]/g, "").replace(/[()]/g, "");
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num)) return 0;
  return isParenthesesNegative && num > 0 ? -num : num;
}

export function marginValue(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  const num = Number.parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function weekStartDate(value: string): string {
  const source = value ? new Date(value + "T00:00:00") : new Date();
  const day = source.getDay();
  const diff = (day + 6) % 7; // Monday start
  source.setDate(source.getDate() - diff);
  return toDateInput(source);
}

export function dateInRange(value: string, start?: string, end?: string): boolean {
  if (!value) return false;
  const formattedVal = value.slice(0, 10);
  return (!start || formattedVal >= start) && (!end || formattedVal <= end);
}

export function safeText(value: any): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

// --------------------------------------------------------------------------
// Core Payroll Math
// --------------------------------------------------------------------------

export function isWaiterTipEntry(entry: PayrollEntry, employees: { id: string; type: string }[]): boolean {
  const employee = employees.find((item) => item.id === entry.personId.replace(/^employee:/, ""));
  if (!employee) return false;
  return (
    String(employee.type).toLowerCase().includes("waiter") &&
    String(entry.type).toLowerCase().includes("tip")
  );
}

export function payrollGrossAmount(entry: PayrollEntry): number {
  return currencyValue(entry.amount) + currencyValue(entry.extra);
}

export function waiterTipDeduction(entry: PayrollEntry, employees: { id: string; type: string }[]): boolean | number {
  const isTip = isWaiterTipEntry(entry, employees);
  return isTip ? currencyValue(entry.amount) * 0.03 : 0;
}

export function payrollFinalCheckAmount(entry: PayrollEntry, employees: { id: string; type: string }[]): number {
  const isTip = isWaiterTipEntry(entry, employees);
  const deduction = isTip ? currencyValue(entry.amount) * 0.03 : 0;
  return payrollGrossAmount(entry) - deduction;
}

// --------------------------------------------------------------------------
// Cash Reconciliation & Closeout Reports
// --------------------------------------------------------------------------

export interface CashReport {
  expectedCloseoutTotal: number;
  actualCloseoutTotal: number;
  varianceTotal: number;
  payoutsTotal: number;
  collections: { date: string; expectedCash: number; actualCash: number; variance: number }[];
}

export function getCashReportData(state: AppState, start?: string, end?: string): CashReport {
  const inRange = (dValue: string) => dateInRange(dValue, start, end);

  // Aggregated totals over daily register records
  let expectedCloseoutTotal = 0;
  let actualCloseoutTotal = 0;
  const collections: { date: string; expectedCash: number; actualCash: number; variance: number }[] = [];

  state.sales.forEach((s) => {
    if (!inRange(s.date)) return;
    const exp = currencyValue(s.cashSales || s.expectedCloseoutCash || s.cashCollected);
    const act = currencyValue(s.actualCloseoutCash || s.cashCollected);
    const diff = act - exp;

    expectedCloseoutTotal += exp;
    actualCloseoutTotal += act;
    collections.push({
      date: s.date,
      expectedCash: exp,
      actualCash: act,
      variance: diff
    });
  });

  const varianceTotal = actualCloseoutTotal - expectedCloseoutTotal;

  // Cash tip deductions and payments
  const payoutsTotal = state.payroll
    .filter((p) => inRange(p.date) && String(p.method).toLowerCase() === "cash")
    .reduce((sum, p) => sum + payrollFinalCheckAmount(p, state.employees), 0);

  return {
    expectedCloseoutTotal,
    actualCloseoutTotal,
    varianceTotal,
    payoutsTotal,
    collections,
  };
}

// Clean invoice line items helper
export function cleanInvoiceItems(items: any[], categories: string[]): any[] {
  return (Array.isArray(items) ? items : []).map(item => ({
    description: String(item.description || "").trim(),
    quantity: String(item.quantity || "").trim(),
    unitPrice: currencyValue(item.unitPrice),
    total: currencyValue(item.total),
    category: categories.includes(item.category) ? item.category : inferCategory(item.description)
  })).filter(item => item.description || item.total !== 0);
}

export function inferCategory(text: string): string {
  const value = String(text || "").toLowerCase();
  const rules: Array<[string, string[]]> = [
    ["Cleaning", ["clean", "cleaner", "soap", "sanitizer", "sani", "degreaser", "bleach", "detergent", "mop", "broom", "disinfect", "chemical", "deodorizer", "scrub", "trash liner", "wiper"]],
    ["Packaging", ["clamshell", "to go", "takeout", "container", "hinged", "foil pan", "film", "wrap", "bag", "box", "carton", "packaging"]],
    ["Supplies", ["supply", "supplies", "napkin", "straw", "glove", "paper", "cup", "lid", "utensil", "fork", "spoon", "knife", "plate", "receipt", "roll", "ticket", "register tape"]],
    ["Beverage", ["soda", "tea", "coffee", "juice", "beer", "wine", "drink", "beverage", "bar mix", "syrup", "water"]],
    ["Food", [
      "food", "us foods", "sysco", "pfg", "gfs", "beef", "steak", "brisket", "chicken", "pork", "bacon", "ham", "sausage", "turkey", "fish", "shrimp", "seafood",
      "produce", "lettuce", "tomato", "onion", "pepper", "cilantro", "avocado", "lime", "lemon", "potato", "bean", "beans", "pinto", "rice", "corn", "jalapeno",
      "cheese", "milk", "cream", "butter", "egg", "eggs", "flour", "tortilla", "chips", "bread", "bun", "roll", "oil", "sauce", "salsa", "seasoning", "salt",
      "sugar", "spice", "mix", "topping", "dressing", "mayo", "ketchup", "mustard", "frozen", "refrigerated", "dry goods"
    ]],
    ["Equipment", ["oven", "freezer", "cooler", "equipment", "machine"]],
    ["Maintenance", ["repair", "maintenance", "service call", "plumbing", "electric"]]
  ];
  const matched = rules.find(([, words]) => words.some(word => value.includes(word)));
  return matched ? matched[0] : "Other";
}

// Expense distribution categories
export function accountingExpenseCategory(value: string, source = ""): string {
  const raw = String(value || "").trim();
  const key = raw.toLowerCase();
  if (!key) return "Other";
  if (key.includes("food")) return "Food";
  if (key.includes("beverage") || key.includes("drink")) return "Beverage";
  if (key.includes("suppl")) return "Supplies";
  if (key.includes("pack")) return "Packaging";
  if (key.includes("util") || key.includes("gas") || key.includes("electric") || key.includes("water") || key.includes("garbage")) return "Utilities";
  if (key.includes("insurance")) return "Insurance";
  if (key.includes("mortgage") || key.includes("loan") || key.includes("bank")) return "Mortgage & Loans";
  if (key.includes("repair") || key.includes("maintenance")) return "Repairs & Maintenance";
  if (key.includes("rent") || key.includes("property")) return source === "property" ? "Other Property" : "Property Expenses";
  if (key.includes("cash payroll") || key.includes("cash salary")) return "Cash Payroll";
  if (key.includes("check payroll") || key.includes("salary") || key.includes("tips") || key.includes("payroll")) return "Check Payroll";
  return raw;
}

export function invoiceCategoryEntries(invoice: Invoice, categories: string[]) {
  const lineItems = cleanInvoiceItems(invoice.lineItems || [], categories);
  const usableLines = lineItems
    .filter((item) => item.total !== 0)
    .map((item) => ({ category: item.category || invoice.category || "Other", total: currencyValue(item.total) }));
  if (usableLines.length) return usableLines;
  return [{ category: invoice.category || "Other", total: currencyValue(invoice.total) }];
}

// Pricing Inflation Alerts Engine
export function dateMinusMonths(dateValue: string, months: number): string {
  const baseDate = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  baseDate.setMonth(baseDate.getMonth() - months);
  return toDateInput(baseDate);
}

function normalizeItemName(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(each|case|cs|lb|lbs|oz|gal|ct|pack|pkg|fresh|frozen|dry)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);
}

function normalizeInvoiceUnitPrice(item: any): number {
  const unit = currencyValue(item.unitPrice);
  const total = currencyValue(item.total);
  const qty = Number.parseFloat(String(item.quantity || "").replace(/[^0-9.]/g, ""));
  if (unit > 0 && unit < total * 0.95) return unit;
  if (total > 0 && qty > 0) return total / qty;
  return unit > 0 && unit < 1000 ? unit : 0;
}

export function findPriorInvoiceItems(state: any, description: string, invoiceDate: string, vendorsMap: Record<string, string>) {
  const key = normalizeItemName(description);
  if (!key) return [];
  const endDate = invoiceDate || today;
  const startDate = dateMinusMonths(endDate, 3);
  const matches: Array<{ description: string; date: string; invoiceNumber: string; vendor: string; price: number }> = [];

  state.invoices.forEach((invoice: any) => {
    const date = invoice.date || "";
    if (!date || date >= endDate || date < startDate) return;
    const cleanLines = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
    cleanLines.forEach((item: any) => {
      const itemKey = normalizeItemName(item.description);
      if (!itemKey) return;
      if (!(itemKey === key || itemKey.includes(key) || key.includes(itemKey))) return;
      const price = normalizeInvoiceUnitPrice(item);
      if (price > 0) {
        matches.push({
          description: item.description,
          date,
          invoiceNumber: invoice.number || "",
          vendor: vendorsMap[invoice.vendorId] || "Vendor",
          price,
        });
      }
    });
  });
  return matches.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function buildPriceAlertsForInvoice(state: any, invoiceDraft: any) {
  const invoiceDate = invoiceDraft.date || invoiceDraft.invoiceDate || today;
  const lineItems = Array.isArray(invoiceDraft.lineItems) ? invoiceDraft.lineItems : [];
  const alerts: any[] = [];

  const vendorNameMap = (state.vendors || []).reduce((acc: any, v: any) => {
    acc[v.id] = v.name;
    return acc;
  }, {});

  lineItems.forEach((item: any) => {
    const currentPrice = normalizeInvoiceUnitPrice(item);
    if (!item.description || currentPrice <= 0) return;
    const history = findPriorInvoiceItems(state, item.description, invoiceDate, vendorNameMap);
    if (!history.length) return;
    const last = history[0];
    const avg = history.reduce((sum, entry) => sum + entry.price, 0) / history.length;
    const baseline = last.price || avg;
    const ratio = currentPrice / baseline;
    if (ratio > 3 || ratio < 0.25) return;
    if (Math.abs(currentPrice - baseline) < 0.05) return;

    const increase = currentPrice - baseline;
    const percent = baseline > 0 ? (increase / baseline) * 100 : 0;

    if (increase > 0 && percent >= 10) {
      alerts.push({
        id: uid("price-alert"),
        date: invoiceDate,
        item: item.description,
        currentPrice,
        previousPrice: baseline,
        averagePrice: avg,
        percent,
        previousDate: last.date,
        previousVendor: last.vendor,
        invoiceNumber: invoiceDraft.number || "",
        category: item.category || "Other",
      });
    }
  });
  return alerts.sort((a, b) => b.percent - a.percent);
}

// --------------------------------------------------------------------------
// P&L and KPI Snapshots
// --------------------------------------------------------------------------

export function getProfitSnapshot(state: AppState, start = "", end = "") {
  const inRange = (dValue: string) => dateInRange(dValue, start, end);

  // Sales
  const salesItems = state.sales.filter((s) => inRange(s.date));
  const grossSales = salesItems.reduce((sum, s) => sum + currencyValue(s.grossSales), 0);
  const netSales = salesItems.reduce((sum, s) => sum + currencyValue(s.netSales), 0);
  const cashSales = salesItems.reduce((sum, s) => sum + currencyValue(s.cashSales), 0);
  const cardSales = salesItems.reduce((sum, s) => sum + currencyValue(s.cardSales), 0);
  const discounts = salesItems.reduce((sum, s) => sum + currencyValue(s.discounts), 0);
  const refunds = salesItems.reduce((sum, s) => sum + currencyValue(s.refunds), 0);
  const tips = salesItems.reduce((sum, s) => sum + currencyValue(s.tips), 0);
  const tax = salesItems.reduce((sum, s) => sum + currencyValue(s.tax), 0);
  const checks = salesItems.reduce((sum, s) => sum + currencyValue(s.checks), 0);
  const guests = salesItems.reduce((sum, s) => sum + currencyValue(s.guests), 0);

  // Expenses
  const payrollItems = state.payroll.filter((p) => inRange(p.date));
  const invoiceItems = state.invoices.filter((inv) => inRange(inv.date));
  const propertyExpenseItems = state.propertyExpenses.filter((p) => inRange(p.date));

  // Category Totals De-duplication mapping
  const categoryTotals: Record<string, number> = {};
  
  // Categorize invoice items
  invoiceItems.forEach((inv) => {
    const lines = invoiceCategoryEntries(inv, state.options.categories);
    lines.forEach((line) => {
      const catName = accountingExpenseCategory(line.category, "invoice");
      categoryTotals[catName] = (categoryTotals[catName] || 0) + line.total;
    });
  });

  // Categorize property expenses
  propertyExpenseItems.forEach((exp) => {
    const catName = accountingExpenseCategory(exp.category || exp.type, "property");
    categoryTotals[catName] = (categoryTotals[catName] || 0) + currencyValue(exp.amount);
  });

  // Categorize payroll entries
  payrollItems.forEach((entry) => {
    const isEmployee = entry.personId.startsWith("employee:");
    let catName = "";
    if (isEmployee) {
      catName = String(entry.method).toLowerCase() === "cash" ? "Cash Payroll" : "Check Payroll";
    } else {
      const vId = entry.personId.replace(/^vendor:/, "");
      const vendor = state.vendors.find((v) => v.id === vId);
      catName = accountingExpenseCategory(vendor?.category || entry.type || "Vendor Payments", "payroll");
    }
    categoryTotals[catName] = (categoryTotals[catName] || 0) + payrollFinalCheckAmount(entry, state.employees);
  });

  const employeePayroll = (categoryTotals["Check Payroll"] || 0) + (categoryTotals["Cash Payroll"] || 0);
  const foodCost = categoryTotals["Food"] || 0;
  const beverageCost = categoryTotals["Beverage"] || 0;
  
  const totalExpenses = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);
  const netProfit = netSales - totalExpenses;
  const profitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;
  const laborPercent = netSales > 0 ? (employeePayroll / netSales) * 100 : 0;
  const foodPercent = netSales > 0 ? (foodCost / netSales) * 100 : 0;
  const primeCostPercent = netSales > 0 ? ((employeePayroll + foodCost + beverageCost) / netSales) * 100 : 0;

  return {
    sales: { grossSales, netSales, cashSales, cardSales, discounts, refunds, tips, tax, checks, guests },
    expenses: { totalExpenses, employeePayroll, foodCost, beverageCost, categoryTotals },
    netProfit,
    profitMargin,
    laborPercent,
    foodPercent,
    primeCostPercent,
  };
}

// --------------------------------------------------------------------------
// Optional Toast Sales and Payroll spreadsheet parsing
// --------------------------------------------------------------------------

export function parseToastDateRangeFromName(name: string): { start: string; end: string } {
  const match = String(name || "").match(/(20\d{2})[-_](\d{2})[-_](\d{2}).*(20\d{2})[-_](\d{2})[-_](\d{2})/);
  if (!match) return { start: "", end: today };
  return {
    start: `${match[1]}-${match[2]}-${match[3]}`,
    end: `${match[4]}-${match[5]}-${match[6]}`
  };
}

export function parseToastSalesFile(workbook: XLSX.WorkBook, fileName: string, fallbackDate: string) {
  const range = parseToastDateRangeFromName(fileName) || { start: "", end: fallbackDate };
  
  // Custom logic matches workbook tabs
  const sheets = workbook.SheetNames;
  let cashSales = 0;
  let cardSales = 0;
  let netSales = 0;
  let grossSales = 0;
  let tips = 0;
  let tax = 0;
  let checks = 0;
  let guests = 0;
  let discounts = 0;
  let refunds = 0;
  let expectedCloseoutCash = 0;
  let actualCloseoutCash = 0;

  sheets.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
    
    rows.forEach((row: any) => {
      const lineStr = row.map((cell: any) => String(cell).toLowerCase()).join(" | ");
      if (lineStr.includes("net sales") && !netSales) {
        netSales = findRowAmount(row);
      }
      if (lineStr.includes("gross sales") && !grossSales) {
        grossSales = findRowAmount(row);
      }
      if (lineStr.includes("cash") && lineStr.includes("collected") && !actualCloseoutCash) {
        actualCloseoutCash = findRowAmount(row);
      }
      if (lineStr.includes("credit") || lineStr.includes("card") || lineStr.includes("visa")) {
        const amt = findRowAmount(row);
        if (amt > 0) cardSales += amt;
      }
      if (lineStr.includes("cash payments") || (lineStr.includes("cash") && lineStr.includes("amount") && !cashSales)) {
        cashSales = findRowAmount(row);
      }
      if (lineStr.includes("tips") && !tips) {
        tips = findRowAmount(row);
      }
      if (lineStr.includes("discounts") && !discounts) {
        discounts = Math.abs(findRowAmount(row));
      }
      if (lineStr.includes("refunds") && !refunds) {
        refunds = Math.abs(findRowAmount(row));
      }
    });
  });

  return [{
    id: uid("sales"),
    date: range.end || fallbackDate,
    weekStart: range.start,
    weekEnd: range.end,
    grossSales: String(grossSales || netSales),
    netSales: String(netSales),
    cashSales: String(cashSales || actualCloseoutCash),
    cardSales: String(cardSales),
    cashCollected: String(actualCloseoutCash || cashSales),
    actualCloseoutCash: String(actualCloseoutCash || cashSales),
    expectedCloseoutCash: String(expectedCloseoutCash || actualCloseoutCash),
    discounts: String(discounts),
    refunds: String(refunds),
    tips: String(tips),
    tax: String(tax),
    checks: String(checks),
    guests: String(guests),
    source: "Toast Sales Excel",
  }];
}

function findRowAmount(row: any[]): number {
  for (let i = 0; i < row.length; i++) {
    const val = currencyValue(row[i]);
    if (val !== 0) return val;
  }
  return 0;
}

export function parseToastPayrollCsv(text: string, fileName: string, fallbackDate: string): ToastPayrollRow[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
  const range = parseToastDateRangeFromName(fileName) || { start: "", end: fallbackDate };

  const index = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
  
  const empIdx = index("Employee");
  const jobIdx = index("Job Title");
  const regHrsIdx = index("Regular Hours");
  const otHrsIdx = index("Overtime Hours");
  const declaredTipsIdx = index("Declared Tips");
  const nonCashTipsIdx = index("Non-Cash Tips");
  const totalTipsIdx = index("Total Tips");
  const tipsWithheldIdx = index("Tips Withheld");

  const results: ToastPayrollRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Basic CSV splitting keeping quotes intact
    const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/"/g, "").trim());
    const employee = empIdx >= 0 ? row[empIdx] : "";
    if (!employee) continue;

    const totalTips = totalTipsIdx >= 0 ? currencyValue(row[totalTipsIdx]) : 0;
    const tipsWithheld = tipsWithheldIdx >= 0 ? currencyValue(row[tipsWithheldIdx]) : 0;
    const finalTips = totalTips - tipsWithheld;

    results.push({
      id: uid("toast-payroll"),
      weekStart: range.start,
      weekEnd: range.end,
      date: range.end || fallbackDate,
      employee,
      jobTitle: jobIdx >= 0 ? row[jobIdx] : "Server",
      regularHours: regHrsIdx >= 0 ? currencyValue(row[regHrsIdx]) : 0,
      overtimeHours: otHrsIdx >= 0 ? currencyValue(row[otHrsIdx]) : 0,
      netSales: 0,
      declaredTips: declaredTipsIdx >= 0 ? currencyValue(row[declaredTipsIdx]) : 0,
      nonCashTips: nonCashTipsIdx >= 0 ? currencyValue(row[nonCashTipsIdx]) : 0,
      totalTips,
      tipsWithheld,
      location: "",
      manualExtraPay: 0,
      paymentMethod: "Check",
      note: "",
      finalTips,
      finalTotal: finalTips,
      source: "Toast Payroll CSV"
    });
  }

  return results;
}

// --------------------------------------------------------------------------
// Live Simulation Database Seeds
// --------------------------------------------------------------------------

import { DEFAULTS } from "../types";

export const DEMO_SEEDS: AppState = {
  options: DEFAULTS,
  vendors: [
    { id: "vendor-1", name: "US Foods Co", type: "Food Distributor", category: "Food", contact: "sales@usfoods.com" },
    { id: "vendor-2", name: "Sysco Corporation", type: "Food Distributor", category: "Food", contact: "support@sysco.com" },
    { id: "vendor-3", name: "Baldor Specialty Foods", type: "Food Distributor", category: "Food", contact: "order@baldor.com" },
    { id: "vendor-4", name: "State Grid Utilities", type: "Utilities", category: "Utilities", contact: "service@stategrid.com" },
    { id: "vendor-5", name: "Apex Supply Co", type: "Supplies Vendor", category: "Supplies", contact: "855-0100" }
  ],
  employees: [
    { id: "employee-1", name: "Michael Chang", type: "Kitchen Employee", payType: "Salary", rate: "900.00" },
    { id: "employee-2", name: "Sarah Connor", type: "Waiter", payType: "Hourly", rate: "12.50" },
    { id: "employee-3", name: "John Miller", type: "Waiter", payType: "Hourly", rate: "12.50" },
    { id: "employee-4", name: "Emma Watson", type: "Cashier", payType: "Hourly", rate: "15.00" }
  ],
  payroll: [
    { id: "p-1", date: "2026-06-14", personId: "employee-1", type: "Salary", amount: "900.00", extra: "0", reason: "Regular salary week close", method: "Check" },
    { id: "p-2", date: "2026-06-14", personId: "employee-2", type: "Hourly", amount: "480.00", extra: "50.00", reason: "Tips override settlement", method: "Check" },
    { id: "p-3", date: "2026-06-14", personId: "employee-3", type: "Tips", amount: "220.00", extra: "0", reason: "Sunday tip allocation out", method: "Cash" }
  ],
  invoices: [
    {
      id: "inv-1",
      date: "2026-06-18",
      vendorId: "vendor-1",
      category: "Food",
      number: "USF-33491",
      total: "1240.00",
      method: "Check",
      isPaid: false,
      lineItems: [
        { description: "Fresh Beef Patty 80/20", quantity: "10", unitPrice: 42.00, total: 420.00, category: "Food" },
        { description: "Hinged Takeout Clamshells", quantity: "5", unitPrice: 35.00, total: 175.00, category: "Packaging" },
        { description: "Liquid Fry Shortening", quantity: "2", unitPrice: 55.00, total: 110.00, category: "Food" }
      ]
    },
    {
      id: "inv-2",
      date: "2026-06-15",
      vendorId: "vendor-2",
      category: "Food",
      number: "SYS-98218",
      total: "680.00",
      method: "Card",
      isPaid: true,
      lineItems: [
        { description: "Premium French Fries Case", quantity: "8", unitPrice: 28.00, total: 224.00, category: "Food" },
        { description: "Glove Nitrile Powder-Free L", quantity: "4", unitPrice: 45.00, total: 180.00, category: "Supplies" }
      ]
    }
  ],
  propertyExpenses: [
    { id: "prop-1", date: "2026-06-01", vendorName: "Slate Realty Group", vendorType: "Rent", property: "Main Restaurant", type: "Rent", category: "Rent", payee: "Slate Realty Group", reference: "R-99824", amount: 4500.00, method: "ACH", notes: "Monthly property leasing installment" },
    { id: "prop-2", date: "2026-06-10", vendorName: "State Grid Utilities", vendorType: "Utilities", property: "Main Restaurant", type: "Utilities", category: "Utilities", payee: "State Grid Utilities", reference: "U-11229", amount: 620.00, method: "ACH", notes: "Electrical network consumption billing period" }
  ],
  cashCollections: [],
  sales: [
    { id: "s-1", date: "2026-06-19", grossSales: "4850.00", netSales: "4520.00", cashSales: "980.00", cardSales: "3540.00", cashCollected: "980.00", actualCloseoutCash: "975.00", expectedCloseoutCash: "980.00", source: "Manual Log" },
    { id: "s-2", date: "2026-06-18", grossSales: "4100.00", netSales: "3890.00", cashSales: "820.00", cardSales: "3070.00", cashCollected: "820.00", actualCloseoutCash: "830.00", expectedCloseoutCash: "820.00", source: "Manual Log" },
    { id: "s-3", date: "2026-06-17", grossSales: "3980.00", netSales: "3750.00", cashSales: "740.00", cardSales: "3010.00", cashCollected: "740.00", actualCloseoutCash: "740.00", expectedCloseoutCash: "740.00", source: "Manual Log" }
  ],
  toastPayroll: [],
  weeklyCashEmployees: [
    { id: "wc-1", employeeId: "employee-3", amount: "220.00", type: "Tips", inactive: false }
  ],
  dashboardCards: { revSnapshot: true, primeSnapshot: true },
  customDashboardCards: [],
  priceAlerts: [],
  customReports: [],
  categoryMargins: {
    "Food": 65,
    "Supplies": 55,
    "Cleaning": 50,
    "Equipment": 40,
    "Maintenance": 60,
    "Utilities": 50,
    "Beverage": 75,
    "Packaging": 45,
    "Other": 50
  }
};

export const INITIAL_STATE: AppState = {
  options: DEFAULTS,
  vendors: [],
  employees: [],
  payroll: [],
  invoices: [],
  propertyExpenses: [],
  cashCollections: [],
  sales: [],
  toastPayroll: [],
  weeklyCashEmployees: [],
  dashboardCards: { revSnapshot: true, primeSnapshot: true },
  customDashboardCards: [],
  priceAlerts: [],
  customReports: [],
  categoryMargins: {
    "Food": 65,
    "Supplies": 55,
    "Cleaning": 50,
    "Equipment": 40,
    "Maintenance": 60,
    "Utilities": 50,
    "Beverage": 75,
    "Packaging": 45,
    "Other": 50
  }
};

