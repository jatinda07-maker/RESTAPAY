/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, SalesRecord } from "../types";
import { currencyValue, money, parseToastSalesFile, uid, today } from "../utils/helpers";
import { FileSpreadsheet, Plus, Trash2, Edit, X, TrendingUp, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

interface SalesViewProps {
  state: AppState;
  onSetState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function SalesView({ state, onSetState }: SalesViewProps) {
  const [date, setDate] = useState(today);
  const [grossSales, setGrossSales] = useState("");
  const [netSales, setNetSales] = useState("");
  const [cashSales, setCashSales] = useState("");
  const [cardSales, setCardSales] = useState("");
  const [doorDashSales, setDoorDashSales] = useState("");
  const [uberEatsSales, setUberEatsSales] = useState("");
  const [grubhubSales, setGrubhubSales] = useState("");
  const [giftCardSales, setGiftCardSales] = useState("");
  const [otherSales, setOtherSales] = useState("");
  const [tips, setTips] = useState("");
  const [discounts, setDiscounts] = useState("");
  const [refunds, setRefunds] = useState("");

  const [importStatus, setImportStatus] = useState("");
  const [editingRecord, setEditingRecord] = useState<SalesRecord | null>(null);

  // Stats
  const sortedSales = [...state.sales].sort((a, b) => b.date.localeCompare(a.date));
  const totalNet = state.sales.reduce((sum, s) => sum + currencyValue(s.netSales), 0);
  const avgDaily = state.sales.length > 0 ? totalNet / state.sales.length : 0;
  const totalTips = state.sales.reduce((sum, s) => sum + currencyValue(s.tips), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!netSales) return;

    const newRecord: SalesRecord = {
      id: uid("sales"),
      date: date || today,
      grossSales: grossSales || netSales,
      netSales: netSales,
      cashSales: cashSales || "0",
      cardSales: cardSales || "0",
      doorDashSales: doorDashSales || "0",
      uberEatsSales: uberEatsSales || "0",
      grubhubSales: grubhubSales || "0",
      giftCardSales: giftCardSales || "0",
      otherSales: otherSales || "0",
      tips: tips || "0",
      discounts: discounts || "0",
      refunds: refunds || "0"
    };

    onSetState((prev) => ({
      ...prev,
      sales: [...prev.sales, newRecord]
    }));

    // Reset Form
    setGrossSales("");
    setNetSales("");
    setCashSales("");
    setCardSales("");
    setDoorDashSales("");
    setUberEatsSales("");
    setGrubhubSales("");
    setGiftCardSales("");
    setOtherSales("");
    setTips("");
    setDiscounts("");
    setRefunds("");
    setImportStatus("Sales record saved manually.");
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this sales entry?")) return;
    onSetState((prev) => ({
      ...prev,
      sales: prev.sales.filter(s => s.id !== id)
    }));
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    onSetState((prev) => ({
      ...prev,
      sales: prev.sales.map(s => s.id === editingRecord.id ? editingRecord : s)
    }));
    setEditingRecord(null);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus("Processing Toast Excel...");
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const parsedRows = parseToastSalesFile(workbook, file.name, today);

      if (!parsedRows || parsedRows.length === 0) {
        throw new Error("No readable sales records found.");
      }

      onSetState((prev) => {
        // Upsert by date to prevent duplicates
        const updatedSales = [...prev.sales];
        parsedRows.forEach((newRow) => {
          const idx = updatedSales.findIndex((x) => x.date === newRow.date);
          if (idx >= 0) {
            updatedSales[idx] = { ...updatedSales[idx], ...newRow };
          } else {
            updatedSales.push(newRow);
          }
        });
        return { ...prev, sales: updatedSales };
      });

      setImportStatus(`Success! Imported ${parsedRows.length} sales logs dynamically.`);
    } catch (err: any) {
      setImportStatus(`Import Error: ${err.message || "Failed to parse file."}`);
    }
    e.target.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      <div className="lg:col-span-5 space-y-6">
        {/* Sales Addition Manual */}
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Register Sales Entry</h3>
            <p className="text-xs text-slate-500 mt-1">Natively record operational registers or closeout parameters.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Sales Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Net Sales ($)
              <input
                type="number"
                step="0.01"
                min="0"
                value={netSales}
                onChange={(e) => setNetSales(e.target.value)}
                required
                placeholder="0.00"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Gross Sales ($)
              <input
                type="number"
                step="0.01"
                min="0"
                value={grossSales}
                onChange={(e) => setGrossSales(e.target.value)}
                placeholder="Matches net if left blank"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Tips Collected ($)
              <input
                type="number"
                step="0.01"
                min="0"
                value={tips}
                onChange={(e) => setTips(e.target.value)}
                placeholder="0.00"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/50 space-y-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Payment Channel Breakdowns</span>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] font-medium text-slate-600 flex flex-col gap-1">
                Cash Payments
                <input
                  type="number"
                  step="0.01"
                  value={cashSales}
                  onChange={(e) => setCashSales(e.target.value)}
                  placeholder="0.00"
                  className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-none"
                />
              </label>
              <label className="text-[11px] font-medium text-slate-600 flex flex-col gap-1">
                Credit Card
                <input
                  type="number"
                  step="0.01"
                  value={cardSales}
                  onChange={(e) => setCardSales(e.target.value)}
                  placeholder="0.00"
                  className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-none"
                />
              </label>
              <label className="text-[11px] font-medium text-slate-600 flex flex-col gap-1">
                DoorDash
                <input
                  type="number"
                  step="0.01"
                  value={doorDashSales}
                  onChange={(e) => setDoorDashSales(e.target.value)}
                  placeholder="0.00"
                  className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-none"
                />
              </label>
              <label className="text-[11px] font-medium text-slate-600 flex flex-col gap-1">
                Uber Eats
                <input
                  type="number"
                  step="0.01"
                  value={uberEatsSales}
                  onChange={(e) => setUberEatsSales(e.target.value)}
                  placeholder="0.00"
                  className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-none"
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus size={16} /> Save Register Entry
          </button>
        </form>

        {/* Spreadsheet Loader */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="text-emerald-600" size={18} />
              Toast POS Excel Loader
            </h3>
            <p className="text-xs text-slate-500 mt-1">Upload daily/weekly closed checkout spreadsheets automatically.</p>
          </div>

          <label className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 cursor-pointer block transition-colors">
            <span className="text-xs text-slate-600 font-semibold block">Select Toast Checkout spreadsheet (.xlsx)</span>
            <span className="text-[11px] text-slate-400 block mt-1">Processes payment splits, tip collections, and gross sales</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelImport}
              className="hidden"
            />
          </label>

          {importStatus && (
            <div className="p-3 bg-slate-50 text-slate-700 text-xs rounded-xl flex items-start gap-2 border border-slate-200/60">
              <span className="text-emerald-500 mt-0.5">ℹ</span>
              <p className="font-semibold leading-relaxed">{importStatus}</p>
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-7 space-y-6">
        {/* Stats card */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Sales Invoiced</span>
            <strong className="text-2xl font-extrabold tracking-tight text-white block">{money.format(totalNet)}</strong>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Daily Average</span>
            <strong className="text-xl font-bold tracking-tight text-emerald-400 block">{money.format(avgDaily)}</strong>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Gross Tips Roster</span>
            <strong className="text-xl font-bold tracking-tight text-indigo-400 block">{money.format(totalTips)}</strong>
          </div>
        </div>

        {/* History table list */}
        <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Historical Register Logs</h3>
          </div>

          <div className="divide-y divide-slate-100">
            {sortedSales.length === 0 ? (
              <p className="text-slate-400 text-center py-12 font-medium">No sales registers logged.</p>
            ) : (
              sortedSales.map((item) => (
                <div key={item.id} className="py-3.5 flex items-center justify-between gap-4 group hover:bg-slate-50/50 rounded-xl px-2 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="font-bold text-slate-700 text-sm">{item.date}</strong>
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 font-extrabold px-1.5 py-0.5 rounded">
                        {item.source || "Manual Entry"}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs">
                      Cash Split: {money.format(currencyValue(item.cashSales))} • Card Split: {money.format(currencyValue(item.cardSales))}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <strong className="font-bold text-slate-800">{money.format(currencyValue(item.netSales))}</strong>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingRecord(item)}
                        className="p-1 px-2 text-xs font-semibold border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 flex items-center gap-1 text-[11px]"
                      >
                        <Edit size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Editing Dialog Modal overlay */}
      <AnimatePresence>
        {editingRecord && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.form
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onSubmit={handleEditSave}
              className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden border border-slate-200"
            >
              <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-white mb-0.5">Edit Sales Record</h4>
                  <span className="text-[11px] text-slate-400">Date: {editingRecord.date}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="p-1.5 bg-slate-900 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-6 grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
                <label className="text-xs font-bold text-slate-600 flex flex-col gap-1">
                  Sales Date
                  <input
                    type="date"
                    value={editingRecord.date}
                    onChange={(e) => setEditingRecord({ ...editingRecord, date: e.target.value })}
                    required
                    className="border border-slate-200 p-1.5 text-sm rounded-lg"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600 flex flex-col gap-1">
                  Net Sales
                  <input
                    type="number"
                    step="0.01"
                    value={editingRecord.netSales}
                    onChange={(e) => setEditingRecord({ ...editingRecord, netSales: e.target.value })}
                    required
                    className="border border-slate-200 p-1.5 text-sm rounded-lg"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600 flex flex-col gap-1">
                  Gross Sales
                  <input
                    type="number"
                    step="0.01"
                    value={editingRecord.grossSales}
                    onChange={(e) => setEditingRecord({ ...editingRecord, grossSales: e.target.value })}
                    required
                    className="border border-slate-200 p-1.5 text-sm rounded-lg"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600 flex flex-col gap-1">
                  Tips
                  <input
                    type="number"
                    step="0.01"
                    value={editingRecord.tips}
                    onChange={(e) => setEditingRecord({ ...editingRecord, tips: e.target.value })}
                    className="border border-slate-200 p-1.5 text-sm rounded-lg"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600 flex flex-col gap-1">
                  Cash Collected/Closeout
                  <input
                    type="number"
                    step="0.01"
                    value={editingRecord.cashCollected || editingRecord.actualCloseoutCash || ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, cashCollected: e.target.value, actualCloseoutCash: e.target.value })}
                    className="border border-slate-200 p-1.5 text-sm rounded-lg"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600 flex flex-col gap-1">
                  Card Sales
                  <input
                    type="number"
                    step="0.01"
                    value={editingRecord.cardSales}
                    onChange={(e) => setEditingRecord({ ...editingRecord, cardSales: e.target.value })}
                    className="border border-slate-200 p-1.5 text-sm rounded-lg"
                  />
                </label>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-slate-800"
                >
                  Save Changes
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
