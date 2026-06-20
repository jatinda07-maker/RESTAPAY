import React from "react";
import { DollarSign, FileClock, Users2 } from "lucide-react";
import { AppState } from "../types";
import { money, currencyValue } from "../utils/helpers";

interface DashboardWidgetsProps {
  state: AppState;
  onNavigateToView?: (view: string) => void;
}

export function DashboardWidgets({ state, onNavigateToView }: DashboardWidgetsProps) {
  // 1. Calculate Monthly Revenue (active month or dynamically falls back to latest database logging month)
  const getActiveMonth = () => {
    const now = new Date();
    const calendarMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const hasCurrentSales = state.sales.some(s => s.date.startsWith(calendarMonth));
    if (hasCurrentSales) return { monthStr: calendarMonth, label: now.toLocaleString("default", { month: "long", year: "numeric" }) };
    
    if (state.sales.length > 0) {
      const sorted = [...state.sales].sort((a, b) => b.date.localeCompare(a.date));
      const latestDateStr = sorted[0].date;
      const [yr, mo] = latestDateStr.split("-");
      const tempDate = new Date(parseInt(yr), parseInt(mo) - 1, 15);
      return {
        monthStr: latestDateStr.slice(0, 7),
        label: tempDate.toLocaleString("default", { month: "long", year: "numeric" })
      };
    }
    return { monthStr: "2026-06", label: "June 2026" };
  };

  const { monthStr, label: periodLabel } = getActiveMonth();
  const monthlyRevenue = state.sales
    .filter((s) => s.date.startsWith(monthStr))
    .reduce((sum, s) => sum + currencyValue(s.netSales), 0);

  // 2. Calculate Total Outstanding Invoices (invoices where isPaid === false)
  const outstandingInvoices = state.invoices.filter((inv) => inv.isPaid === false);
  const totalOutstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + currencyValue(inv.total), 0);
  const outstandingCount = outstandingInvoices.length;

  // 3. Active Employee Count
  const activeEmployeeCount = state.employees.filter((emp) => !emp.inactive).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5" id="dashboard-widgets-container">
      {/* Metric Card 1: Monthly Revenue */}
      <div 
        id="widget-monthly-revenue"
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
      >
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Monthly Net Revenue</span>
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-extrabold text-slate-900 tracking-tight">{money.format(monthlyRevenue)}</strong>
          </div>
          <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
            Active Period: {periodLabel}
          </span>
        </div>
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
          <DollarSign size={22} className="stroke-[2.5]" />
        </div>
      </div>

      {/* Metric Card 2: Total Outstanding Invoices */}
      <div 
        id="widget-outstanding-invoices"
        onClick={() => onNavigateToView && onNavigateToView("invoices")}
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between group cursor-pointer"
      >
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Outstanding Invoices</span>
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-extrabold text-slate-900 tracking-tight">{money.format(totalOutstandingAmount)}</strong>
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block ${
            outstandingCount > 0 ? "text-amber-700 bg-amber-50" : "text-slate-500 bg-slate-50"
          }`}>
            {outstandingCount} pending {outstandingCount === 1 ? "procurement" : "procurements"}
          </span>
        </div>
        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
          <FileClock size={22} className="stroke-[2.5]" />
        </div>
      </div>

      {/* Metric Card 3: Active Employee Count */}
      <div 
        id="widget-active-employees"
        onClick={() => onNavigateToView && onNavigateToView("employees")}
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between group cursor-pointer"
      >
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Team Roster</span>
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-extrabold text-slate-900 tracking-tight">{activeEmployeeCount}</strong>
            <span className="text-slate-450 text-xs font-semibold">Staff members</span>
          </div>
          <span className="text-[11px] font-medium text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-full inline-block">
            Currently Active
          </span>
        </div>
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
          <Users2 size={22} className="stroke-[2.5]" />
        </div>
      </div>
    </div>
  );
}
