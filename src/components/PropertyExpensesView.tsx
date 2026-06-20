/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { AppState, PropertyExpense } from "../types";
import { currencyValue, money, uid, today } from "../utils/helpers";
import { Plus, Trash2, Edit, Home, Banknote, ListCollapse, AlignLeft } from "lucide-react";

interface PropertyExpensesViewProps {
  state: AppState;
  onSetState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function PropertyExpensesView({ state, onSetState }: PropertyExpensesViewProps) {
  const [date, setDate] = useState(today);
  const [vendorName, setVendorName] = useState("");
  const [expenseType, setExpenseType] = useState("");
  const [vendorType, setVendorType] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Check");
  const [notes, setNotes] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  // Computed Summaries
  const sortedExpenses = [...state.propertyExpenses].sort((a, b) => b.date.localeCompare(a.date));
  const totalAmount = state.propertyExpenses.reduce((sum, item) => sum + currencyValue(item.amount), 0);

  // Grouped by Type
  const expensesByType = state.propertyExpenses.reduce<Record<string, number>>((acc, item) => {
    const key = item.type || "Other Property";
    acc[key] = (acc[key] || 0) + currencyValue(item.amount);
    return acc;
  }, {});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    const newExpense: PropertyExpense = {
      id: editingId || uid("property-expense"),
      date: date || today,
      vendorName: vendorName || payee || "",
      vendorType: vendorType || "",
      property: vendorName || "",
      type: expenseType || "Rent",
      category: expenseType || "Rent",
      payee: vendorName || payee || "",
      reference,
      amount: currencyValue(amount),
      method,
      notes,
    };

    if (editingId) {
      onSetState((prev) => ({
        ...prev,
        propertyExpenses: prev.propertyExpenses.map((x) => x.id === editingId ? newExpense : x),
      }));
      setEditingId(null);
    } else {
      onSetState((prev) => ({
        ...prev,
        propertyExpenses: [...prev.propertyExpenses, newExpense],
      }));
    }

    // Reset Form
    setVendorName("");
    setExpenseType("");
    setVendorType("");
    setReference("");
    setAmount("");
    setNotes("");
  };

  const handleEdit = (exp: PropertyExpense) => {
    setDate(exp.date);
    setVendorName(exp.vendorName || exp.payee || "");
    setExpenseType(exp.type || exp.category || "");
    setVendorType(exp.vendorType || "");
    setReference(exp.reference || "");
    setAmount(String(exp.amount));
    setMethod(exp.method || "Check");
    setNotes(exp.notes || "");
    setEditingId(exp.id);
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete property expense for "${name}"?`)) return;
    onSetState((prev) => ({
      ...prev,
      propertyExpenses: prev.propertyExpenses.filter((x) => x.id !== id),
    }));
  };

  const payee = vendorName;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      {/* Editor Split left */}
      <div className="lg:col-span-5">
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {editingId ? "Edit Property Expense" : "Record Property Billings"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Configure overhead items such as rent, common logistics, repairs or security.</p>
            </div>
            {editingId && (
              <span className="text-[10px] bg-slate-900 text-white font-bold p-1 px-2 rounded-lg">EDIT MODE</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Service Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Payee/Vendor Name
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Landlord, Power Company"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Expense Type
              <select
                value={expenseType}
                onChange={(e) => setExpenseType(e.target.value)}
                required
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              >
                <option value="">Select type</option>
                {state.options.propertyExpenseTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Overhead Industry Type
              <input
                type="text"
                value={vendorType}
                onChange={(e) => setVendorType(e.target.value)}
                placeholder="e.g. Rent, Gas Utility"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5 col-span-2">
              Payment Amount ($)
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0.00"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                required
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              >
                {state.options.paymentMethods.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
            Reference / Invoice Number
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Bill #839X"
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white"
            />
          </label>

          <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
            Internal comments / Audit description
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Rent check comments, account details, etc."
              rows={3}
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
            ></textarea>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              <Plus size={16} className="inline mr-1" /> {editingId ? "Save Change Details" : "Record Property Billings"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setVendorName("");
                  setExpenseType("");
                  setVendorType("");
                  setReference("");
                  setAmount("");
                  setNotes("");
                }}
                className="border border-slate-200 text-slate-600 rounded-xl px-4 text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Directory Split right */}
      <div className="lg:col-span-7 space-y-6">
        {/* KPI Panel */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Overhead Outlays Total</span>
            <strong className="text-2xl font-extrabold tracking-tight block text-indigo-400">{money.format(totalAmount)}</strong>
          </div>
          <span className="bg-slate-800 p-2.5 rounded-xl block"><Home size={22} className="text-indigo-400" /></span>
        </div>

        {/* Group by category list */}
        <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-3.5">
          <strong className="text-xs uppercase tracking-wider text-slate-400 font-bold block mb-1">Allocated Overhead Types</strong>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.keys(expensesByType).length === 0 ? (
              <p className="col-span-2 text-slate-400 text-xs italic">No entries aggregated.</p>
            ) : (
              Object.entries(expensesByType).map(([type, amountVal]) => {
                const percent = totalAmount > 0 ? Math.round((amountVal / totalAmount) * 100) : 0;
                return (
                  <div key={type} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs gap-3">
                    <div>
                      <strong className="font-bold text-slate-700 block">{type}</strong>
                      <span className="text-slate-400 leading-none">{percent}% of overhead outlays</span>
                    </div>
                    <strong className="font-extrabold text-slate-800">{money.format(amountVal)}</strong>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ledger Directory */}
        <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 mb-2 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Banknote size={16} className="text-slate-700" />
              Property Expenditures Directory
            </h3>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
              {state.propertyExpenses.length} entries
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {sortedExpenses.length === 0 ? (
              <p className="text-slate-400 text-center py-12 font-medium">No overhead logs found.</p>
            ) : (
              sortedExpenses.map((expense) => (
                <div key={expense.id} className="py-3.5 flex items-center justify-between gap-4 group hover:bg-slate-50/50 rounded-xl px-2 transition-colors">
                  <div className="space-y-1">
                    <strong className="font-bold text-slate-800 text-sm block">
                      {expense.vendorName || expense.payee || "Property Expenditure"}
                    </strong>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">{expense.date}</span>
                      <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold px-2 rounded">
                        {expense.type}
                      </span>
                      <span className="text-slate-400">{expense.method}</span>
                      {expense.reference && <span className="text-slate-400">Ref: #{expense.reference}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <strong className="font-bold text-slate-800">{money.format(expense.amount)}</strong>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(expense)}
                        className="p-1 px-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-100"
                        title="Edit entry"
                      >
                        <Edit size={11} />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id, expense.vendorName || expense.payee)}
                        className="text-red-500 p-1 hover:bg-red-50 rounded"
                        title="Delete entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
