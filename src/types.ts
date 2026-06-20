/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vendor {
  id: string;
  name: string;
  type: string;
  category: string;
  contact?: string;
}

export interface Employee {
  id: string;
  name: string;
  type: string;
  payType: string;
  rate: string;
  inactive?: boolean;
  deletedAt?: string;
}

export interface PayrollEntry {
  id: string;
  date: string;
  personId: string; // e.g. "employee:xyz" or "vendor:abc"
  type: string;
  amount: string;
  extra: string;
  reason: string;
  method: string;
  sourceToastPayrollId?: string;
  sourceWeeklyCashId?: string;
  weekStart?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: string;
  unitPrice: number;
  total: number;
  category: string;
}

export interface Invoice {
  id: string;
  date: string;
  vendorId: string;
  category: string;
  number: string;
  total: string;
  manualProfitMargin?: string;
  method: string;
  lineItems: InvoiceLineItem[];
  priceAlerts?: PriceAlert[];
  ai?: any;
  isPaid?: boolean;
}

export interface PropertyExpense {
  id: string;
  date: string;
  vendorName: string;
  vendorType: string;
  property: string;
  type: string;
  category: string;
  payee: string;
  reference: string;
  amount: number;
  method: string;
  notes?: string;
}

export interface SalesRecord {
  id: string;
  date: string;
  weekStart?: string;
  weekEnd?: string;
  grossSales: string;
  netSales: string;
  cashSales: string;
  cardSales: string;
  cashCollected?: string;
  actualCloseoutCash?: string;
  expectedCloseoutCash?: string;
  actualDeposit?: string;
  expectedDeposit?: string;
  totalCashPayments?: string;
  cashBeforeTipouts?: string;
  creditNonCashTips?: string;
  tipoutsTipsWithheld?: string;
  totalCash?: string;
  otherSales?: string;
  doorDashSales?: string;
  uberEatsSales?: string;
  grubhubSales?: string;
  giftCardSales?: string;
  discounts?: string;
  refunds?: string;
  tips?: string;
  tax?: string;
  guests?: string;
  checks?: string;
  source?: string;
  paymentRows?: any[];
}

export interface ToastPayrollRow {
  id: string;
  weekStart?: string;
  weekEnd?: string;
  date: string;
  employee: string;
  jobTitle: string;
  regularHours: number;
  overtimeHours: number;
  netSales: number;
  declaredTips: number;
  nonCashTips: number;
  totalTips: number;
  tipsWithheld: number;
  location: string;
  manualExtraPay: number;
  paymentMethod: string;
  note: string;
  finalTips: number;
  finalTotal: number;
  source: string;
}

export interface WeeklyCashEmployee {
  id: string;
  employeeId: string;
  amount: string;
  type: string;
  inactive: boolean;
}

export interface PriceAlert {
  id: string;
  date: string;
  item: string;
  currentPrice: number;
  previousPrice: number;
  averagePrice: number;
  percent: number;
  previousDate: string;
  previousVendor: string;
  invoiceNumber: string;
  category: string;
}

export interface CustomReport {
  id: string;
  name: string;
  fields: string[];
}

export interface AppOptions {
  vendorTypes: string[];
  employeeTypes: string[];
  payTypes: string[];
  paymentMethods: string[];
  categories: string[];
  propertyExpenseTypes: string[];
  propertyVendorTypes: string[];
  propertyPayees: string[];
}

export type ViewName = "dashboard" | "sales" | "invoices" | "payroll" | "vendors" | "employees" | "profit";

export interface AppState {
  options: AppOptions;
  vendors: Vendor[];
  employees: Employee[];
  payroll: PayrollEntry[];
  invoices: Invoice[];
  propertyExpenses: PropertyExpense[];
  cashCollections: { id: string; date: string; amount: string; note?: string }[];
  sales: SalesRecord[];
  toastPayroll: ToastPayrollRow[];
  weeklyCashEmployees: WeeklyCashEmployee[];
  dashboardCards: Record<string, boolean>;
  customDashboardCards: { id: string; label: string; value: string; note?: string }[];
  priceAlerts: PriceAlert[];
  customReports: CustomReport[];
  categoryMargins: Record<string, number>;
}

export const DEFAULTS: AppOptions = {
  vendorTypes: ["Food Distributor", "Cleaning Service", "Supplies Vendor", "Maintenance", "Utilities", "Beverage"],
  employeeTypes: ["Kitchen Employee", "Waiter", "Cashier", "Manager", "Cleaner"],
  payTypes: ["Hourly", "Salary", "Tips", "Bonus", "Vendor Payment", "Cash", "Check"],
  paymentMethods: ["Cash", "Check", "Card", "ACH", "Other"],
  categories: ["Food", "Supplies", "Cleaning", "Equipment", "Maintenance", "Utilities", "Beverage", "Packaging", "Other"],
  propertyExpenseTypes: ["Rent", "Utilities", "Repairs & Maintenance", "Insurance", "Property Tax", "CAM / Common Area", "Pest Control", "Security", "Landscaping", "Equipment Repair", "Licenses & Permits", "Other Property Expense"],
  propertyVendorTypes: ["Rent", "Utilities", "Repairs & Maintenance", "Insurance", "Property Tax", "Security", "Landscaping", "Supplies", "Other"],
  propertyPayees: ["Landlord", "Power Company", "Water Company", "Gas Company", "Insurance Company", "Repair Vendor", "Pest Control", "Security Company"]
};
