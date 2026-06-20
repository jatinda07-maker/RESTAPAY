/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { AppState, PriceAlert } from "../types";
import {
  currencyValue,
  money,
  getCashReportData,
  waiterTipDeduction,
  uid,
  today,
} from "../utils/helpers";
import { DollarSign, ShieldAlert, Sliders, TrendingDown, AlignLeft, RefreshCw, Layers } from "lucide-react";

interface ProfitViewProps {
  state: AppState;
  onSetState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function ProfitView({ state, onSetState }: ProfitViewProps) {
  const [subTab, setSubTab] = useState<"cash" | "margins" | "alerts">("cash");

  // Margin customization states
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newMargin, setNewMargin] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryMargin, setNewCategoryMargin] = useState("50");
  const [showAddForm, setShowAddForm] = useState(false);

  // Cash report calculation
  const cashReport = getCashReportData(state);

  const handleUpdateMargin = (e: React.FormEvent, catName: string) => {
    e.preventDefault();
    if (!newMargin) return;

    onSetState((prev) => ({
      ...prev,
      categoryMargins: {
        ...prev.categoryMargins,
        [catName]: Number(newMargin),
      },
    }));
    setEditingCategory(null);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    const marginVal = Number(newCategoryMargin) || 50;
    if (!cleanName) return;
    if (state.options.categories.some(c => c.toLowerCase() === cleanName.toLowerCase())) {
      alert("This category already exists.");
      return;
    }

    onSetState((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        categories: [...prev.options.categories, cleanName]
      },
      categoryMargins: {
        ...prev.categoryMargins,
        [cleanName]: marginVal
      }
    }));
    setNewCategoryName("");
    setNewCategoryMargin("50");
    setShowAddForm(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Visual Subtabs */}
      <div className="flex border-b border-slate-200 gap-1 text-sm font-semibold mb-4 leading-none select-none">
        <button
          onClick={() => setSubTab("cash")}
          className={`pb-2.5 px-3 border-b-2 transition-all ${subTab === "cash" ? "border-indigo-600 text-indigo-700 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          Daily Cash Sheets &amp; Closeouts
        </button>
        <button
          onClick={() => setSubTab("margins")}
          className={`pb-2.5 px-3 border-b-2 transition-all ${subTab === "margins" ? "border-indigo-600 text-indigo-700 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          Category Pricing Margins
        </button>
        <button
          onClick={() => setSubTab("alerts")}
          className={`pb-2.5 px-3 border-b-2 transition-all ${subTab === "alerts" ? "border-indigo-600 text-indigo-700 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          Price Inflation Alerts ({state.priceAlerts?.length || 0})
        </button>
      </div>

      {subTab === "cash" && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Expected Cash Collections</span>
              <strong className="text-xl font-bold tracking-tight text-white block">{money.format(cashReport.expectedCloseoutTotal)}</strong>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Real Cash Closeout Drawer</span>
              <strong className="text-xl font-bold tracking-tight text-white block">{money.format(cashReport.actualCloseoutTotal)}</strong>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Cash Drawer Over/Under</span>
              <strong className={`text-xl font-bold block ${cashReport.varianceTotal < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {money.format(cashReport.varianceTotal)}
              </strong>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Tips Withheld</span>
              <strong className="text-xl font-bold tracking-tight text-indigo-400 block">{money.format(cashReport.payoutsTotal)}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Cash history report list table */}
            <div className="lg:col-span-8">
              <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-slate-700">Daily Closeout Variance History</h3>
                  <p className="text-xs text-slate-500 mt-1">Cross-referencing net sales register tallies with credit settlements.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[500px]">
                    <thead className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Reference Date</th>
                        <th className="p-3">Expected Cash</th>
                        <th className="p-3">Drawer Tally</th>
                        <th className="p-3 text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {cashReport.collections.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-400 italic">No daily registers parsed.</td>
                        </tr>
                      ) : (
                        cashReport.collections.map((col, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-3 font-semibold">{col.date}</td>
                            <td className="p-3">{money.format(col.expectedCash)}</td>
                            <td className="p-3">{money.format(col.actualCash)}</td>
                            <td className={`p-3 text-right font-extrabold ${col.variance < 0 ? "text-rose-500" : "text-emerald-600"}`}>
                              {money.format(col.variance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Sunday Cash payouts tracker column */}
            <div className="lg:col-span-4">
              <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Sunday Cash Salaries</h3>
                  <p className="text-xs text-slate-500 mt-1">Recapping employee weekly cash hand payouts.</p>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-y-auto">
                  {state.payroll.filter(p => p.method === "Cash").length === 0 ? (
                    <p className="text-slate-400 text-center py-10 italic text-xs">No active cash hand salaries logged.</p>
                  ) : (
                    state.payroll
                      .filter(p => p.method === "Cash")
                      .map((p) => {
                        const name = state.employees.find(e => `employee:${e.id}` === p.personId)?.name || "Employee";
                        return (
                          <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <strong className="font-bold text-slate-700 block">{name}</strong>
                              <span className="text-slate-400">{p.date} • {p.type}</span>
                            </div>
                            <strong className="font-extrabold text-slate-800">{money.format(currencyValue(p.amount))}</strong>
                          </div>
                        );
                      })
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {subTab === "margins" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in">
          {/* Target Margin controls */}
          <div className="md:col-span-6 space-y-6">
            <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Sliders size={16} className="text-indigo-600" />
                  Profit Margins Configuration
                </h3>
                <p className="text-xs text-slate-500 mt-1">Configure target pricing ratios by industry department lines.</p>
              </div>

              <div className="space-y-4.5">
                {state.options.categories.map((cat) => {
                  const targetPercent = state.categoryMargins[cat] || 65;
                  const isEditing = editingCategory === cat;

                  return (
                    <div key={cat} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/50">
                      <div>
                        <strong className="text-sm font-bold text-slate-800 block">{cat}</strong>
                        <span className="text-xs text-slate-400 leading-none">Healthy ratio standard</span>
                      </div>

                      <div className="flex items-center gap-3">
                        {isEditing ? (
                          <form
                            onSubmit={(e) => handleUpdateMargin(e, cat)}
                            className="bg-white p-1 border border-slate-200 rounded-lg flex gap-1.5"
                          >
                            <input
                              type="number"
                              min="1"
                              max="99"
                              value={newMargin}
                              onChange={(e) => setNewMargin(e.target.value)}
                              className="w-12 text-center text-xs font-bold font-mono py-0.5 focus:outline-none"
                            />
                            <button type="submit" className="bg-slate-900 text-white rounded px-2 py-0.5 text-[10px] font-bold">
                              Save
                            </button>
                          </form>
                        ) : (
                          <>
                            <strong className="text-base font-extrabold text-indigo-600">{targetPercent}%</strong>
                            <button
                              onClick={() => {
                                setNewMargin(String(targetPercent));
                                setEditingCategory(cat);
                              }}
                              className="text-xs font-bold text-slate-600 border border-slate-200 hover:border-slate-300 rounded-lg px-2 py-1 bg-white"
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100">
                {!showAddForm ? (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="w-full py-2.5 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-850 transition-all flex justify-center items-center gap-1.5"
                  >
                    + Add New Category
                  </button>
                ) : (
                  <form onSubmit={handleAddCategory} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3 animate-fadeIn">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-500">Configure New Procurement Category</span>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block">Category Name</label>
                        <input
                          type="text"
                          required
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="e.g. Seafood, Marketing"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block">Target Margin %</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            required
                            min="1"
                            max="99"
                            value={newCategoryMargin}
                            onChange={(e) => setNewCategoryMargin(e.target.value)}
                            placeholder="65"
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-center font-mono font-bold focus:outline-none text-indigo-650"
                          />
                          <span className="text-xs text-slate-400 font-extrabold">%</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all"
                    >
                      Initialize Category &amp; Pricing Ratio
                    </button>
                  </form>
                )}
              </div>
            </section>
          </div>

          {/* Pricing generator lists */}
          <div className="md:col-span-6 space-y-6">
            <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Layers size={16} className="text-indigo-600" />
                  Suggested Pricing Roster
                </h3>
                <p className="text-xs text-slate-500 mt-1">Computed dynamic menu sale prices according to registered invoice inventory costs and profit targets.</p>
              </div>

              <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto">
                {state.invoices.flatMap(i => i.lineItems || []).length === 0 ? (
                  <p className="text-slate-400 text-center py-16 italic text-xs">No registered line items found.</p>
                ) : (
                  state.invoices
                    .flatMap(inv => (inv.lineItems || []).map(line => ({ ...line, invoiceDate: inv.date })))
                    // Filter duplicate descriptors to show latest price suggestion
                    .filter((value, index, self) => self.findIndex(t => t.description === value.description) === index)
                    .slice(0, 10)
                    .map((item, idx) => {
                      const costValue = currencyValue(item.unitPrice) || (currencyValue(item.total) / (Number(item.quantity) || 1)) || 0;
                      const ratio = state.categoryMargins[item.category] || 65;
                      const suggestedPrice = costValue / (1 - ratio / 100);

                      return (
                        <div key={idx} className="py-3 flex justify-between items-center text-xs gap-3">
                          <div className="space-y-0.5">
                            <strong className="font-semibold text-slate-700 block">{item.description}</strong>
                            <span className="text-slate-400">Unit Cost: {money.format(costValue)} • {item.category}</span>
                          </div>

                          <div className="text-right">
                            <strong className="font-extrabold text-emerald-600 block">{money.format(suggestedPrice)}</strong>
                            <span className="text-[10px] text-slate-400">Target sale ({ratio}%)</span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {subTab === "alerts" && (
        <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4 animate-fade-in">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert size={18} className="text-rose-500" />
              Supplier Price Inflation Alerts
            </h3>
            <p className="text-xs text-slate-500 mt-1">Drawn dynamically by monitoring past purchasing entries for item-level margin variations exceeding 1.5%.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(!state.priceAlerts || state.priceAlerts.length === 0) ? (
              <p className="col-span-2 text-slate-400 text-center py-16 font-medium italic">All purchasing margins stable. Excellent job!</p>
            ) : (
              state.priceAlerts.map((alert, idx) => (
                <div key={idx} className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col justify-between gap-3 text-xs leading-relaxed">
                  <div>
                    <strong className="font-bold text-rose-800 text-sm block mb-1">{alert.item}</strong>
                    <div className="text-rose-700 space-y-0.5">
                      <p>Prior Price: <b className="font-bold">{money.format(alert.previousPrice)}</b></p>
                      <p>Current Price: <b className="font-bold text-red-650">{money.format(alert.currentPrice)}</b></p>
                    </div>
                  </div>

                  <span className="text-[9px] bg-rose-100 border border-rose-200 text-rose-700 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider self-start">
                    +{Math.round(alert.percent)}% Inflation Hike
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </motion.div>
  );
}
