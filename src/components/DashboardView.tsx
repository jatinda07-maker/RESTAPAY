/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, PriceAlert } from "../types";
import { getProfitSnapshot, currencyValue, money, getCashReportData, accountingExpenseCategory } from "../utils/helpers";
import { DollarSign, Percent, TrendingUp, CreditCard, Users, Briefcase, Plus, TrendingDown, Clock, AlertTriangle, ChevronRight, Eye } from "lucide-react";
import { DashboardWidgets } from "./DashboardWidgets";

interface DashboardViewProps {
  state: AppState;
  onNavigateToView: (view: string) => void;
  onSetState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function DashboardView({ state, onNavigateToView }: DashboardViewProps) {
  const [rangeMode, setRangeMode] = useState<"today" | "week" | "month" | "custom">("month");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  const [activeReport, setActiveReport] = useState<{
    title: string;
    totalText: string;
    rows: Array<{ title: string; meta: string; amount: number }>;
  } | null>(null);

  // Compute Financial Snapshot for selected period
  const snapshot = getProfitSnapshot(state, rangeMode === "custom" ? startDate : "", rangeMode === "custom" ? endDate : "");
  const cashData = getCashReportData(state, rangeMode === "custom" ? startDate : "", rangeMode === "custom" ? endDate : "");

  const cogs = (snapshot.expenses.foodCost || 0) + (snapshot.expenses.beverageCost || 0);
  const grossProfit = snapshot.sales.netSales - cogs;
  const checkPayroll = snapshot.expenses.categoryTotals["Check Payroll"] || 0;
  const cashPayroll = snapshot.expenses.categoryTotals["Cash Payroll"] || 0;
  const totalTips = snapshot.sales.tips;

  // Format dates text
  const getRangeText = () => {
    if (rangeMode === "today") return "Today (All time data)";
    if (rangeMode === "week") return "This Week (All time data)";
    if (rangeMode === "month") return "This Month (All time data)";
    return `${startDate} to ${endDate}`;
  };

  // Recent events list
  const recentActivities = [
    ...state.invoices.map((item) => ({
      title: `Invoice #${item.number || "blank"}`,
      meta: `${item.date} • From ${state.vendors.find(v => v.id === item.vendorId)?.name || "Vendor"}`,
      amount: currencyValue(item.total),
      type: "invoice",
      icon: "📄"
    })),
    ...state.payroll.map((item) => {
      const isEmp = item.personId.startsWith("employee:");
      const name = isEmp
        ? state.employees.find(e => e.id === item.personId.replace(/^employee:/, ""))?.name || "Employee"
        : state.vendors.find(v => v.id === item.personId.replace(/^vendor:/, ""))?.name || "Vendor";
      return {
        title: `Payroll: ${name}`,
        meta: `${item.date} • ${item.method} • ${item.type}`,
        amount: payrollGrossAmount(item),
        type: "payroll",
        icon: "👥"
      };
    }),
    ...state.propertyExpenses.map((exp) => ({
      title: exp.vendorName || exp.payee || "Property bill",
      meta: `${exp.date} • ${exp.category}`,
      amount: currencyValue(exp.amount),
      type: "property",
      icon: "🏠"
    }))
  ].sort((a, b) => b.meta.localeCompare(a.meta)).slice(0, 5);

  function payrollGrossAmount(entry: any): number {
    return currencyValue(entry.amount) + currencyValue(entry.extra);
  }

  // Drilldown card handler
  const handleCardClick = (title: string, amountVal: number, key: string) => {
    let rows: Array<{ title: string; meta: string; amount: number }> = [];

    if (key === "netSales") {
      rows = state.sales.map(s => ({
        title: `Sales Closeout: ${s.date}`,
        meta: `Net: ${money.format(currencyValue(s.netSales))} • Cash Paid: ${money.format(currencyValue(s.cashSales))}`,
        amount: currencyValue(s.netSales)
      }));
    } else if (key === "payroll") {
      rows = state.payroll
        .filter(p => p.personId.startsWith("employee:"))
        .map(p => {
          const name = state.employees.find(e => e.id === p.personId.replace(/^employee:/, ""))?.name || "Staff";
          return {
            title: `Staff Pay: ${name}`,
            meta: `${p.date} • Method: ${p.method} • ${p.type}`,
            amount: currencyValue(p.amount) + currencyValue(p.extra)
          };
        });
    } else if (key === "expenses") {
      // General expenses list
      rows = state.invoices.map(inv => ({
        title: `Invoice Vendor: ${state.vendors.find(v => v.id === inv.vendorId)?.name || "Vendor"}`,
        meta: `${inv.date} (Inv: #${inv.number || "N/A"})`,
        amount: currencyValue(inv.total)
      })).concat(
        state.propertyExpenses.map(p => ({
          title: `Property: ${p.payee || p.vendorName}`,
          meta: `${p.date} • ${p.category}`,
          amount: currencyValue(p.amount)
        }))
      );
    } else if (key === "cash") {
      rows = cashData.collections.map((col) => ({
        title: `Drawer Closeout Tally`,
        meta: `${col.date} (Expected expected: ${money.format(col.expectedCash)})`,
        amount: col.actualCash
      }));
    }

    if (!rows.length) {
      rows = [{ title: "Summary total", meta: "Aggregation of database logs", amount: amountVal }];
    }

    setActiveReport({
      title,
      totalText: money.format(amountVal),
      rows
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Header and range settings */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:shadow-md">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Business Dashboard</h2>
          <p className="text-slate-500 text-sm mt-1">Real-time calculations of restaurant operations, profits, cost ratios, and pricing analysis.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 text-xs font-semibold">
            <button
              onClick={() => setRangeMode("today")}
              className={`px-3 py-1.5 rounded-lg transition-all ${rangeMode === "today" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-800"}`}
            >
              Today
            </button>
            <button
              onClick={() => setRangeMode("week")}
              className={`px-3 py-1.5 rounded-lg transition-all ${rangeMode === "week" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-800"}`}
            >
              This Week
            </button>
            <button
              onClick={() => setRangeMode("month")}
              className={`px-3 py-1.5 rounded-lg transition-all ${rangeMode === "month" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-800"}`}
            >
              This Month
            </button>
            <button
              onClick={() => setRangeMode("custom")}
              className={`px-3 py-1.5 rounded-lg transition-all ${rangeMode === "custom" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-800"}`}
            >
              Custom Range
            </button>
          </div>

          <span className="text-xs text-slate-400 font-semibold px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
            {getRangeText()}
          </span>
        </div>
      </div>

      {/* Date fields if custom */}
      {rangeMode === "custom" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex flex-wrap gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60"
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
            />
          </div>
        </motion.div>
      )}

      {/* Financial Metrics Widgets Panel */}
      <DashboardWidgets state={state} onNavigateToView={onNavigateToView} />

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales */}
        <div
          onClick={() => handleCardClick("Gross Sales Details", snapshot.sales.netSales, "netSales")}
          className="bg-gradient-to-br from-blue-50/70 to-indigo-50/40 border border-blue-100 rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="bg-blue-100 text-blue-600 p-2.5 rounded-xl block"><DollarSign size={20} /></span>
            <span className="text-[11px] bg-blue-100/60 text-blue-700 font-bold px-2 py-0.5 rounded-full">Net Sales</span>
          </div>
          <div className="mt-4">
            <small className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Net Sales Revenue</small>
            <strong className="text-2xl font-extrabold tracking-tight text-slate-800 block mt-0.5">{money.format(snapshot.sales.netSales)}</strong>
          </div>
          <p className="text-slate-400 text-xs mt-3 flex items-center gap-1 group-hover:text-blue-600 transition-colors">
            <span>Tap for invoice breakdown</span> <ChevronRight size={14} />
          </p>
        </div>

        {/* Profit */}
        <div
          onClick={() => handleCardClick("Net Profit details", snapshot.netProfit, "profit")}
          className="bg-gradient-to-br from-emerald-50/70 to-green-50/40 border border-emerald-100 rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="bg-emerald-100 text-emerald-600 p-2.5 reference-icon"><PercentIcon /></span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-250 px-2 py-0.5 rounded-full">{snapshot.profitMargin.toFixed(1)}% margin</span>
          </div>
          <div className="mt-3">
            <small className="text-slate-400 text-xs font-bold uppercase block">Net Profit</small>
            <strong className="text-2xl font-bold tracking-tight">{money.format(snapshot.netProfit)}</strong>
          </div>
          <p className="text-slate-400 text-xs mt-3 flex items-center gap-1 group-hover:text-emerald-600 transition-colors">
            <span>After expenses & costs</span> <ChevronRight size={14} />
          </p>
        </div>

        {/* Expenses */}
        <div
          onClick={() => handleCardClick("Business Expenses Details", snapshot.expenses.totalExpenses, "expenses")}
          className="bg-gradient-to-br from-rose-50/70 to-pink-50/40 border border-rose-100 rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-rose-200 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="bg-rose-100 text-rose-600 p-2.5 rounded-xl block"><TrendingDown size={20} /></span>
            <span className="text-[11px] bg-rose-100/60 text-rose-700 font-bold px-2 py-0.5 rounded-full">Total Cost</span>
          </div>
          <div className="mt-4">
            <small className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Expenses Total</small>
            <strong className="text-2xl font-bold tracking-tight text-slate-800 block mt-0.5">{money.format(snapshot.expenses.totalExpenses)}</strong>
          </div>
          <p className="text-slate-400 text-xs mt-3 flex items-center gap-1 group-hover:text-rose-600 transition-colors">
            <span>Deduped purchases</span> <ChevronRight size={14} />
          </p>
        </div>

        {/* Cash position */}
        <div
          onClick={() => handleCardClick("Cash Collections Details", cashData.actualCloseoutTotal, "cash")}
          className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 border border-amber-100 rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-amber-200 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="bg-amber-100 text-amber-600 p-2.5 rounded-xl block"><CreditCard size={20} /></span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cashData.varianceTotal >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {cashData.varianceTotal >= 0 ? "Balanced" : "Shortage"}
            </span>
          </div>
          <div className="mt-4">
            <small className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Leftover Cash Balance</small>
            <strong className="text-2xl font-bold tracking-tight text-slate-800 block mt-0.5">{money.format(cashData.actualCloseoutTotal)}</strong>
          </div>
          <p className="text-slate-400 text-xs mt-3 flex items-center gap-1 group-hover:text-amber-600 transition-colors">
            <span>Closeouts minus payouts</span> <ChevronRight size={14} />
          </p>
        </div>
      </section>

      {/* Auxiliary Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/60 p-4 border border-slate-200/80 rounded-2xl">
        <div className="p-3 bg-white border border-slate-100 rounded-xl">
          <small className="text-slate-400 uppercase text-[10px] font-bold block">Prime Cost Ratio</small>
          <strong className="text-lg font-bold text-slate-800 mt-1 block">{snapshot.primeCostPercent.toFixed(1)}% of Sales</strong>
          <span className="text-[11px] text-slate-500">Target limit is under 60.0%</span>
        </div>
        <div className="p-3 bg-white border border-slate-100 rounded-xl">
          <small className="text-slate-400 uppercase text-[10px] font-bold block">Employee Labor %</small>
          <strong className="text-lg font-bold text-slate-800 mt-1 block">{snapshot.laborPercent.toFixed(1)}%</strong>
          <span className="text-xs text-muted-foreground block text-slate-500">Including cash group or card wage</span>
        </div>
        <div className="p-3 bg-white border border-slate-100 rounded-xl">
          <small className="text-slate-400 uppercase text-[10px] font-bold block">Food and Beverage Cost %</small>
          <strong className="text-lg font-bold text-slate-800 mt-1 block">{snapshot.foodPercent.toFixed(1)}%</strong>
          <span className="text-[11px] text-slate-500">Based on processed invoices</span>
        </div>
      </section>

      {/* Main split sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Expense list */}
        <section className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-4 bg-indigo-500 rounded-full block"></span>
              Expense Breakdowns By Category
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">
              {Object.keys(snapshot.expenses.categoryTotals).length} categories
            </span>
          </div>

          <div className="space-y-4">
            {Object.keys(snapshot.expenses.categoryTotals).length === 0 ? (
              <p className="text-slate-400 text-center py-10 font-medium">No expense entries saved yet.</p>
            ) : (
              Object.entries(snapshot.expenses.categoryTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => {
                  const percent = snapshot.expenses.totalExpenses > 0
                    ? Math.round((amount / snapshot.expenses.totalExpenses) * 100)
                    : 0;
                  return (
                    <div
                      key={category}
                      onClick={() => handleCardClick(`${category} Procurement Details`, amount, "expenses")}
                      className="p-3.5 border border-slate-100 rounded-xl hover:bg-slate-50 transition-all cursor-pointer flex flex-col gap-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-700 font-semibold text-sm group-hover:text-indigo-600 transition-colors">{category}</strong>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-800 font-bold text-sm">{money.format(amount)}</span>
                          <span className="text-xs bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">{percent}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </section>

        {/* Profit and Loss breakdown */}
        <section className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-4 bg-emerald-500 rounded-full block"></span>
              P&L Income Projection
            </h3>
            <button
              onClick={() => onNavigateToView("reports")}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Interactive Reports ›
            </button>
          </div>

          <div className="space-y-3.5 text-slate-700">
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Gross Restaurant Sales</span>
              <strong className="font-semibold text-slate-800">{money.format(snapshot.sales.netSales)}</strong>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Cost of Goods Sold (Food & Drink)</span>
              <strong className="font-semibold text-rose-600">-{money.format(cogs)}</strong>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500 font-bold">Estimated Gross Profit</span>
              <strong className="font-bold text-emerald-600">{money.format(grossProfit)}</strong>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Labor Expenses</span>
              <strong className="font-semibold text-rose-600">-{money.format(snapshot.expenses.employeePayroll)}</strong>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Other Overhead/Utilities Expenses</span>
              <strong className="font-semibold text-rose-600">
                -{money.format(snapshot.expenses.totalExpenses - snapshot.expenses.employeePayroll - cogs)}
              </strong>
            </div>
            <div className="flex items-center justify-between py-2 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
              <span className="text-emerald-800 font-bold">Net Operating Income</span>
              <strong className="text-lg font-extrabold text-emerald-700">{money.format(snapshot.netProfit)}</strong>
            </div>
          </div>
        </section>
      </div>

      {/* Low splits: Activity and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recents */}
        <section className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-4 bg-amber-500 rounded-full block"></span>
              Recent Operations Logs
            </h3>
            <span className="text-xs text-slate-400 font-medium">Auto-updated</span>
          </div>

          <div className="divide-y divide-slate-100">
            {recentActivities.length === 0 ? (
              <p className="text-slate-400 text-center py-8 font-medium">No actions detected in current session.</p>
            ) : (
              recentActivities.map((act, i) => (
                <div key={i} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg">{act.icon}</span>
                    <div>
                      <strong className="font-bold text-slate-700 block">{act.title}</strong>
                      <span className="text-rose-500 text-xs">{act.meta}</span>
                    </div>
                  </div>
                  <strong className="font-semibold text-slate-800 text-right">{money.format(act.amount)}</strong>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Hot Price Alerts */}
        <section className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-4 bg-red-500 rounded-full block"></span>
              Smart Cost inflation notifications
            </h3>
            <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
              {state.priceAlerts.length} alerts
            </span>
          </div>

          <div className="space-y-3">
            {state.priceAlerts.length === 0 ? (
              <p className="text-slate-400 text-center py-8 font-medium">No commodity inflation matches in the last 3 months.</p>
            ) : (
              state.priceAlerts.slice(0, 4).map((alert) => {
                const diff = alert.currentPrice - alert.previousPrice;
                return (
                  <div key={alert.id} className="p-3 border border-red-100 bg-red-50/20 rounded-xl flex items-center gap-3 justify-between">
                    <div className="flex items-start gap-2.5">
                      <span className="p-2 bg-red-100 text-red-600 rounded-lg block mt-0.5"><AlertTriangle size={15} /></span>
                      <div>
                        <strong className="text-slate-700 font-bold text-xs block">{alert.item}</strong>
                        <span className="text-[11px] text-slate-500 block">
                          Up from {money.format(alert.previousPrice)} to {money.format(alert.currentPrice)} (+{alert.percent.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                    <span className="text-xs bg-red-100 text-red-750 font-extrabold px-2 py-1 rounded">
                      +{money.format(diff)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Modal Trace details */}
      <AnimatePresence>
        {activeReport && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden border border-slate-200"
            >
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-white mb-0.5">{activeReport.title}</h4>
                  <span className="text-slate-400 text-xs">Line-item trace for the selected period</span>
                </div>
                <strong className="text-xl font-extrabold tracking-tight text-emerald-400">{activeReport.totalText}</strong>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                {activeReport.rows.map((row, index) => (
                  <div key={index} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <strong className="font-semibold text-slate-700 block">{row.title}</strong>
                      <span className="text-slate-400 text-xs">{row.meta}</span>
                    </div>
                    <strong className="font-bold text-slate-800">{money.format(row.amount)}</strong>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveReport(null)}
                  className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-900 transition-colors"
                >
                  Close Trace
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PercentIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-600 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="19" cy="19" r="1.5" />
      <circle cx="5" cy="5" r="1.5" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}
