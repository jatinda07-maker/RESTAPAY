/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, PayrollEntry, WeeklyCashEmployee, ToastPayrollRow } from "../types";
import {
  currencyValue,
  money,
  parseToastPayrollCsv,
  uid,
  today,
  isWaiterTipEntry,
  waiterTipDeduction,
  payrollFinalCheckAmount,
  weekStartDate
} from "../utils/helpers";
import { Plus, Trash2, Edit, FileText, Check, DollarSign, RefreshCw, X, Users, Settings } from "lucide-react";

interface PayrollViewProps {
  state: AppState;
  onSetState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function PayrollView({ state, onSetState }: PayrollViewProps) {
  // Manual Payroll States
  const [date, setDate] = useState(today);
  const [personId, setPersonId] = useState(""); // format "employee:id" or "vendor:id"
  const [payType, setPayType] = useState("");
  const [amount, setAmount] = useState("");
  const [extra, setExtra] = useState("0");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Group Cash States
  const [weeklyDate, setWeeklyDate] = useState(today);
  const [cashEmployeeId, setCashEmployeeId] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [cashPayType, setCashPayType] = useState("Cash Salary");
  const [cashStatus, setCashStatus] = useState("");
  const [editingCashId, setEditingCashId] = useState<string | null>(null);

  // Toast Import summary
  const [toastStatus, setToastStatus] = useState("");
  const [editingToastRow, setEditingToastRow] = useState<ToastPayrollRow | null>(null);

  const getPayeeName = (pId: string) => {
    if (!pId) return "Not selected";
    const [kind, actualId] = pId.split(":");
    if (kind === "employee") {
      return state.employees.find((e) => e.id === actualId)?.name || "Employee";
    }
    return state.vendors.find((v) => v.id === actualId)?.name || "Vendor";
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personId || !amount) return;

    if (editingId) {
      onSetState((prev) => ({
        ...prev,
        payroll: prev.payroll.map((p) =>
          p.id === editingId
            ? {
                ...p,
                date,
                personId,
                type: payType,
                amount,
                extra: extra || "0",
                reason,
                method,
              }
            : p
        ),
      }));
      setEditingId(null);
    } else {
      const newEntry: PayrollEntry = {
        id: uid("payroll"),
        date,
        personId,
        type: payType || "Hourly",
        amount,
        extra: extra || "0",
        reason,
        method: method || "Check",
      };
      onSetState((prev) => ({
        ...prev,
        payroll: [...prev.payroll, newEntry],
      }));
    }

    setPersonId("");
    setPayType("");
    setAmount("");
    setExtra("0");
    setReason("");
    setMethod("");
  };

  const handleEdit = (entry: PayrollEntry) => {
    setDate(entry.date);
    setPersonId(entry.personId);
    setPayType(entry.type);
    setAmount(entry.amount);
    setExtra(entry.extra);
    setReason(entry.reason);
    setMethod(entry.method);
    setEditingId(entry.id);
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete payroll/expense payment recorded for "${name}"?`)) return;
    onSetState((prev) => ({
      ...prev,
      payroll: prev.payroll.filter((p) => p.id !== id),
    }));
  };

  // Automated cash wage trigger
  const handleProcessGroupPayments = () => {
    const configs = state.weeklyCashEmployees.filter((x) => !x.inactive && x.employeeId && currencyValue(x.amount) > 0);
    if (!configs.length) {
      alert("No active cash salary group staff found. Setup group staff below first.");
      return;
    }

    const startWeek = weekStartDate(weeklyDate);
    const skippedNames: string[] = [];
    let addedCount = 0;

    onSetState((prev) => {
      const updatedPayroll = [...prev.payroll];

      configs.forEach((item) => {
        const pId = `employee:${item.employeeId}`;
        const name = prev.employees.find((e) => e.id === item.employeeId)?.name || "Employee";

        // Check duplicate cash pay on same day
        const isDuplicate = updatedPayroll.some(
          (p) =>
            p.personId === pId &&
            p.date === weeklyDate &&
            String(p.method).toLowerCase() === "cash"
        );

        if (isDuplicate) {
          skippedNames.push(name);
          return;
        }

        updatedPayroll.push({
          id: uid("payroll"),
          date: weeklyDate,
          personId: pId,
          type: item.type || "Cash Salary",
          amount: String(currencyValue(item.amount)),
          extra: "0",
          reason: `Group weekly salary payment (${weeklyDate})`,
          method: "Cash",
          sourceWeeklyCashId: item.id,
          weekStart: startWeek,
        });
        addedCount++;
      });

      return {
        ...prev,
        payroll: updatedPayroll,
      };
    });

    if (addedCount > 0) {
      setCashStatus(`Added ${addedCount} automated cash payouts.`);
    } else {
      setCashStatus(`Completed. Skipped roster duplicates: ${skippedNames.join(", ")}`);
    }
  };

  // Add Cash Salary Employee
  const handleSaveCashRoster = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashEmployeeId || !cashAmount) return;

    if (editingCashId) {
      onSetState((prev) => ({
        ...prev,
        weeklyCashEmployees: prev.weeklyCashEmployees.map((x) =>
          x.id === editingCashId
            ? { ...x, employeeId: cashEmployeeId, amount: cashAmount, type: cashPayType }
            : x
        ),
      }));
      setEditingCashId(null);
    } else {
      const newCash: WeeklyCashEmployee = {
        id: uid("weekly-cash"),
        employeeId: cashEmployeeId,
        amount: cashAmount,
        type: cashPayType,
        inactive: false,
      };
      onSetState((prev) => ({
        ...prev,
        weeklyCashEmployees: [...prev.weeklyCashEmployees, newCash],
      }));
    }

    setCashEmployeeId("");
    setCashAmount("");
    setCashPayType("Cash Salary");
  };

  // Toggle toggle cash employees
  const handleToggleActiveGroupCard = (id: string, active: boolean) => {
    onSetState((prev) => ({
      ...prev,
      weeklyCashEmployees: prev.weeklyCashEmployees.map((x) =>
        x.id === id ? { ...x, inactive: !active } : x
      ),
    }));
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setToastStatus("Processing Toast CSV...");
    try {
      const text = await file.text();
      const parsedRows = parseToastPayrollCsv(text, file.name, today);

      if (!parsedRows.length) {
        throw new Error("No readable records. Ensure 'Employee' column is present.");
      }

      onSetState((prev) => {
        // Sync to state to synchronize with Payroll
        const activeIds = new Set(parsedRows.map((p) => p.id));
        const cleanPayroll = prev.payroll.filter((p) => !p.sourceToastPayrollId || activeIds.has(p.sourceToastPayrollId));

        parsedRows.forEach((row) => {
          let emp = prev.employees.find((e) => e.name.toLowerCase() === row.employee.toLowerCase());
          if (!emp) {
            // Seed roster
            emp = {
              id: uid("employee"),
              name: row.employee,
              type: row.jobTitle,
              payType: "Tips",
              rate: "0",
            };
            prev.employees.push(emp);
          }

          const personPayeeId = `employee:${emp.id}`;
          cleanPayroll.push({
            id: uid("payroll"),
            date: row.date || today,
            personId: personPayeeId,
            type: "Tips",
            amount: String(row.finalTotal),
            extra: "0",
            reason: row.note ? `Toast sync: ${row.note}` : "Toast synced sales & tips payouts",
            method: "Check",
            sourceToastPayrollId: row.id,
          });
        });

        return {
          ...prev,
          toastPayroll: parsedRows,
          payroll: cleanPayroll,
        };
      });

      setToastStatus(`Imported ${parsedRows.length} Employee tip rows and synced to general ledger.`);
    } catch (err: any) {
      setToastStatus(`CSV Error: ${err.message || "Spreadsheet unreadable."}`);
    }
    e.target.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Three splits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* MANUAL PAYMENT REGISTER FORM */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleManualSubmit} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Payroll &amp; Expense payment</h3>
                <p className="text-xs text-slate-500 mt-1">Natively record salaries, tips, bonuses, and vendor payouts.</p>
              </div>
              {editingId && <span className="bg-slate-900 text-white font-bold p-1 px-2 rounded-lg text-[9px]">EDIT MODE</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5 col-span-2">
                Payee (Staff or Vendor)
                <select
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                  required
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
                >
                  <option value="">Select payee</option>
                  <optgroup label="Employees (Roster)">
                    {state.employees.filter(e => !e.inactive).map(e => (
                      <option key={e.id} value={`employee:${e.id}`}>Employee: {e.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Vendors (Procurement)">
                    {state.vendors.map(v => (
                      <option key={v.id} value={`vendor:${v.id}`}>Vendor: {v.name}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
                Pay Type
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value)}
                  required
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
                >
                  <option value="">Select type</option>
                  {state.options.payTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5 col-span-2">
                Principal Amount ($)
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
                Extra Pay ($)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="0"
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
                />
              </label>
            </div>

            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Reason / Memo description
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Overtime shift bonus or vendor invoice reference"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white"
              />
            </label>

            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Method Mode
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                required
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              >
                <option value="">Select method</option>
                {state.options.paymentMethods.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>

            <div className="flex gap-2 text-sm">
              <button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold p-2.5 rounded-xl transition-all">
                {editingId ? "Save Change Details" : "Record Entry Payment"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setPersonId("");
                    setPayType("");
                    setAmount("");
                    setExtra("0");
                    setReason("");
                    setMethod("");
                  }}
                  className="border border-slate-200 p-2.5 font-semibold text-slate-500 rounded-xl hover:bg-slate-100"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* Toast CSV Payroll upload */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-00 uppercase tracking-wider">Toast Payroll CSV syncing</h3>
              <p className="text-xs text-slate-500 mt-1">Rapidly sync tips, salaries, withheld parameters from Toast tables.</p>
            </div>

            <label className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer block hover:bg-slate-50">
              <span className="text-xs text-slate-600 font-semibold block">Choose Toast payroll CSV</span>
              <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
            </label>

            {toastStatus && (
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-slate-600 font-semibold leading-relaxed">
                {toastStatus}
              </div>
            )}
          </div>
        </div>

        {/* PAYMENTS HISTORY LIST - Middle split */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 mb-2 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Payroll &amp; Purchases Ledger</h3>
              <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                {state.payroll.length} records
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
              {state.payroll.length === 0 ? (
                <p className="text-slate-400 text-center py-16 font-medium">No disbursements documented.</p>
              ) : (
                [...state.payroll]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((p) => {
                    const name = getPayeeName(p.personId);
                    const finalAmount = payrollFinalCheckAmount(p, state.employees);
                    return (
                      <div key={p.id} className="py-3 flex items-center justify-between gap-4 group hover:bg-slate-50 rounded-xl px-2 transition-colors">
                        <div className="space-y-1">
                          <strong className="font-bold text-slate-800 text-sm block">{name}</strong>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">{p.date}</span>
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium px-1 rounded">
                              {p.type}
                            </span>
                            <span className="text-slate-400">{p.method}</span>
                            {currencyValue(p.extra) > 0 && (
                              <span className="text-emerald-600 font-bold">+{money.format(currencyValue(p.extra))} extra</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <strong className="font-bold text-slate-800">{money.format(finalAmount)}</strong>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleManual(p)}
                              className="p-1 px-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-100"
                            >
                              <Edit size={11} />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id, name)}
                              className="text-red-500 p-1 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </section>
        </div>
      </div>

      {/* WEEKLY CASH SALARY GROUP CARDS - Lower grid */}
      <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Users size={18} className="text-pink-600" />
              Roster Cash Salary Group Settings
            </h3>
            <p className="text-xs text-slate-500 mt-1">Configure staff paid in cash on Sundays. Adds all payments at once automatically.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 border border-slate-200 rounded-xl text-xs">
            <label className="font-bold text-slate-600 flex items-center gap-1.5">
              Pay Date:
              <input
                type="date"
                value={weeklyDate}
                onChange={(e) => setWeeklyDate(e.target.value)}
                className="bg-white border rounded p-1 text-xs"
              />
            </label>
            <button
              onClick={handleProcessGroupPayments}
              className="bg-slate-900 text-white font-bold p-1.5 px-3 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Add Group Payments
            </button>
          </div>
        </div>

        {cashStatus && (
          <div className="p-3 bg-amber-50 text-slate-700 text-xs rounded-xl border border-amber-200 flex items-center justify-between">
            <span className="font-semibold leading-relaxed">{cashStatus}</span>
            <button onClick={() => setCashStatus("")} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Add Staff form */}
          <form onSubmit={handleSaveCashRoster} className="md:col-span-4 bg-slate-50/50 p-4 border border-slate-200/60 rounded-xl space-y-3">
            <strong className="text-xs font-bold text-slate-700 uppercase block mb-1">
              {editingCashId ? "Update Group Staff" : "Add Staff to Salary Group"}
            </strong>

            <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1">
              Select Employee
              <select
                value={cashEmployeeId}
                onChange={(e) => setCashEmployeeId(e.target.value)}
                required
                className="bg-white border rounded-lg p-1.5 text-xs text-slate-800 focus:outline-none"
              >
                <option value="">Select staff</option>
                {state.employees.filter((e) => !e.inactive).map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1">
                Weekly amount ($)
                <input
                  type="number"
                  step="0.01"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  required
                  placeholder="0.00"
                  className="bg-white border rounded-lg p-1.5 text-xs text-slate-800"
                />
              </label>

              <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1">
                Salary Type
                <select
                  value={cashPayType}
                  onChange={(e) => setCashPayType(e.target.value)}
                  className="bg-white border rounded-lg p-1.5 text-xs text-slate-800"
                >
                  <option value="Cash Salary">Cash Salary</option>
                  <option value="Salary">Salary</option>
                  <option value="Tips">Tips</option>
                </select>
              </label>
            </div>

            <button type="submit" className="w-full bg-slate-900 text-white rounded-lg py-1.5 text-xs font-bold hover:bg-slate-800">
              {editingCashId ? "Save Setup" : "Append Group Staff"}
            </button>
          </form>

          {/* Group list roster */}
          <div className="md:col-span-8 space-y-3">
            <strong className="text-xs font-bold text-slate-700 uppercase block">Active Group Members</strong>
            {state.weeklyCashEmployees.length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center italic">No employees added to cash group yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {state.weeklyCashEmployees.map((member) => {
                  const empObj = state.employees.find((e) => e.id === member.employeeId);
                  if (!empObj) return null;
                  return (
                    <div
                      key={member.id}
                      className={`p-3.5 border rounded-xl flex items-center justify-between gap-3 ${member.inactive ? "border-slate-100 bg-slate-50/50" : "border-slate-200 bg-white"}`}
                    >
                      <div className="space-y-0.5">
                        <strong className={`font-semibold text-xs block ${member.inactive ? "text-slate-400 line-through" : "text-slate-800"}`}>
                          {empObj.name}
                        </strong>
                        <span className="text-[10px] text-slate-400">
                          {member.type} • {money.format(currencyValue(member.amount))}/wk
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleActiveGroupCard(member.id, !member.inactive)}
                          className={`text-[10px] font-bold p-1 px-2 rounded-md ${member.inactive ? "bg-slate-200 text-slate-500" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}
                        >
                          {member.inactive ? "On Hold" : "Active"}
                        </button>
                        <button
                          onClick={() => {
                            setCashEmployeeId(member.employeeId);
                            setCashAmount(member.amount);
                            setCashPayType(member.type);
                            setEditingCashId(member.id);
                          }}
                          className="text-slate-450 hover:text-slate-700"
                        >
                          <Edit size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </motion.div>
  );

  function handleManual(p: PayrollEntry) {
    handleEdit(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
