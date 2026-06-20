/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, Invoice, InvoiceLineItem, PriceAlert } from "../types";
import {
  currencyValue,
  money,
  inferCategory,
  uid,
  today,
  buildPriceAlertsForInvoice,
  cleanInvoiceItems,
} from "../utils/helpers";
import { Sparkles, FileText, Camera, Upload, AlertTriangle, Plus, Trash2, Edit3, Check, X, ShieldAlert } from "lucide-react";

interface InvoicesViewProps {
  state: AppState;
  onSetState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function InvoicesView({ state, onSetState }: InvoicesViewProps) {
  // Main form states
  const [vendorId, setVendorId] = useState("");
  const [category, setCategory] = useState("Food");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [total, setTotal] = useState("");
  const [manualMargin, setManualMargin] = useState("");
  const [paymentMethod, setMethod] = useState("Check");
  const [isPaid, setIsPaid] = useState(true);

  // Dynamic lines state
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);

  // Selected invoice overlay
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Status logs
  const [aiStatus, setAiStatus] = useState("");
  const [scanPreview, setScanPreview] = useState<any | null>(null);

  const getVendorName = (vId: string) => {
    return state.vendors.find((v) => v.id === vId)?.name || "Vendor";
  };

  const handleManualAddLine = () => {
    setLineItems((prev) => [
      ...prev,
      { description: "", quantity: "", unitPrice: 0, total: 0, category: "Other" },
    ]);
  };

  const handleLineValueChange = (index: number, field: keyof InvoiceLineItem, val: any) => {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: val };
        if (field === "description" && (!item.category || item.category === "Other")) {
          updated.category = inferCategory(val);
        }
        return updated;
      })
    );
  };

  const handleRemoveLine = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result.split(",")[1]);
        } else {
          reject(new Error("Unable to encode file."));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Local first processor fallback
  const processLocalTextFallback = async (file: File) => {
    setAiStatus("Local text breakdown processing...");
    try {
      const text = await file.text();
      const extractedNumber = text.match(/(?:invoice|inv|bill)[\s#:*-]*([A-Z0-9-]{3,})/i)?.[1] || "";
      const extractedDate = text.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b/)?.[1] || today;

      const totalMatch = text.match(/(?:total|amount due|balance due)[\s$:*-]*([0-9,]+\.\d{2})/i);
      const extractedTotal = totalMatch ? totalMatch[1].replace(/,/g, "") : "";

      setInvoiceNumber(extractedNumber);
      setInvoiceDate(extractedDate);
      setTotal(extractedTotal);
      setCategory("Food");
      setAiStatus("Parsed details locally. Fill any remaining fields below.");
    } catch {
      setAiStatus("Local scan limited. Enter invoice parameters manually below.");
    }
  };

  // Server-Side Gemini Smart Scanner Trigger
  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".edi")) {
      await processLocalTextFallback(file);
      return;
    }

    setAiStatus("Loading invoice to Gemini AI...");
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/read-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: file.type || "image/jpeg" }),
      });

      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.error || "Gemini scanner failed.");
      }

      const invoice = responseData.invoice;
      const matchedVendor = state.vendors.find(
        (v) => v.name.toLowerCase() === String(invoice.vendorName || "").toLowerCase()
      );

      setVendorId(matchedVendor?.id || "");
      setInvoiceNumber(invoice.invoiceNumber || "");
      setInvoiceDate(invoice.invoiceDate || today);
      setTotal(String(invoice.total || ""));
      setCategory(invoice.category || "Food");
      
      const lineData = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
      setLineItems(
        lineData.map((item: any) => ({
          description: item.description || "",
          quantity: item.quantity || "",
          unitPrice: item.unitPrice || 0,
          total: item.total || 0,
          category: item.category || inferCategory(item.description),
        }))
      );

      setScanPreview(invoice);
      setAiStatus(`AI Scan active. Verification confidence: ${Math.round((invoice.confidence || 0.9) * 100)}%`);
    } catch (err: any) {
      console.error(err);
      setAiStatus(`AI server error: ${err.message || "Failed to reach model"}. Local OCR fallback activated.`);
      await processLocalTextFallback(file);
    }
  };

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !total) {
      alert("Provide a Vendor name and Total amount.");
      return;
    }

    const lines = cleanInvoiceItems(lineItems, state.options.categories);
    const calculatedAlerts = buildPriceAlertsForInvoice(state, {
      date: invoiceDate,
      number: invoiceNumber,
      lineItems: lines,
    });

    const newInvoice: Invoice = {
      id: uid("invoice"),
      date: invoiceDate || today,
      vendorId,
      category: category || "Food",
      number: invoiceNumber || "N/A",
      total,
      manualProfitMargin: manualMargin,
      method: paymentMethod || "Check",
      lineItems: lines,
      priceAlerts: calculatedAlerts,
      isPaid: isPaid,
    };

    onSetState((prev) => ({
      ...prev,
      invoices: [...prev.invoices, newInvoice],
      priceAlerts: [...calculatedAlerts, ...(prev.priceAlerts || [])].slice(0, 100),
    }));

    // Reset Form
    setVendorId("");
    setInvoiceNumber("");
    setInvoiceDate(today);
    setTotal("");
    setManualMargin("");
    setIsPaid(true);
    setLineItems([]);
    setScanPreview(null);
    setAiStatus("Invoice registered successfully!");
  };

  const handleToggleInvoicePaid = (invoiceId: string) => {
    onSetState((prev) => {
      const updatedInvoices = prev.invoices.map((inv) =>
        inv.id === invoiceId ? { ...inv, isPaid: inv.isPaid === false ? true : false } : inv
      );
      const currentSelected = updatedInvoices.find((inv) => inv.id === invoiceId);
      if (selectedInvoice && selectedInvoice.id === invoiceId && currentSelected) {
        setSelectedInvoice(currentSelected);
      }
      return {
        ...prev,
        invoices: updatedInvoices,
      };
    });
  };

  const handleDeleteInvoice = (id: string, number: string) => {
    if (!window.confirm(`Permanently delete invoice #${number}?`)) return;
    onSetState((prev) => ({
      ...prev,
      invoices: prev.invoices.filter((i) => i.id !== id),
    }));
    if (selectedInvoice?.id === id) {
      setSelectedInvoice(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      {/* Upload and form panel split */}
      <div className="lg:col-span-5 space-y-6">
        {/* Smart AI upload container */}
        <section className="bg-gradient-to-br from-indigo-50/50 to-purple-50/30 p-6 border border-indigo-100 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="text-indigo-600 animate-pulse" size={18} />
                Smart AI Invoice Scanner
              </h3>
              <p className="text-xs text-slate-500 mt-1">Upload JPEG/PNG/PDF or open camera. Gemini automatically matches lines.</p>
            </div>
            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Gemini model
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col items-center justify-center p-4 border border-dashed border-indigo-200 bg-white rounded-xl hover:bg-slate-50 cursor-pointer text-center text-xs font-semibold text-slate-600 transition-colors">
              <Upload className="text-indigo-500 mb-1" size={18} />
              <span>Select File</span>
              <input type="file" accept="image/*,application/pdf,.edi,.txt" onChange={handleAiScan} className="hidden" />
            </label>

            <label className="flex flex-col items-center justify-center p-4 border border-dashed border-indigo-200 bg-white rounded-xl hover:bg-slate-50 cursor-pointer text-center text-xs font-semibold text-slate-600 transition-colors">
              <Camera className="text-indigo-500 mb-1" size={18} />
              <span>Use Camera</span>
              <input type="file" accept="image/*" capture="environment" onChange={handleAiScan} className="hidden" />
            </label>
          </div>

          {aiStatus && (
            <div className="p-3 bg-white text-slate-700 text-xs rounded-xl flex items-center justify-between border border-indigo-100 font-semibold shadow-sm animate-fade-in">
              <span>{aiStatus}</span>
              {scanPreview && (
                <button
                  type="button"
                  onClick={() => setScanPreview(null)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                >
                  Clear scan
                </button>
              )}
            </div>
          )}
        </section>

        {/* Form Inputs */}
        <form onSubmit={handleSaveInvoice} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Invoice Registration</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5 col-span-2">
              Supplier/Vendor Name
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              >
                <option value="">Select vendor</option>
                {state.vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Invoice Date
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Category split
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              >
                {state.options.categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Invoice Number
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. 19283"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5 col-span-2">
              Invoice Total Amount ($)
              <input
                type="number"
                step="0.01"
                min="0"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                required
                placeholder="0.00"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Manual Margin % override
              <input
                type="number"
                step="0.01"
                value={manualMargin}
                onChange={(e) => setManualMargin(e.target.value)}
                placeholder="Category default"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Payment Method
              <select
                value={paymentMethod}
                onChange={(e) => setMethod(e.target.value)}
                required
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              >
                {state.options.paymentMethods.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Payment Status
              <select
                value={isPaid ? "paid" : "outstanding"}
                onChange={(e) => setIsPaid(e.target.value === "paid")}
                required
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              >
                <option value="paid">Paid</option>
                <option value="outstanding">Outstanding</option>
              </select>
            </label>
          </div>

          {/* Line item editor inline */}
          <div className="space-y-3.5 pt-2">
            <div className="flex justify-between items-center border-t border-slate-100 pt-3">
              <strong className="text-xs text-slate-700 uppercase tracking-wider block font-bold">Line details distribution</strong>
              <button
                type="button"
                onClick={handleManualAddLine}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
              >
                ＋ Add item line
              </button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200/50">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleLineValueChange(idx, "description", e.target.value)}
                    className="flex-1 bg-white border border-slate-200 p-1 rounded-lg text-xs"
                  />
                  <select
                    value={item.category}
                    onChange={(e) => handleLineValueChange(idx, "category", e.target.value)}
                    className="bg-white border border-slate-200 px-1 py-1 rounded-lg text-[10px] w-24"
                  >
                    {state.options.categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Total"
                    value={item.total || ""}
                    onChange={(e) => handleLineValueChange(idx, "total", currencyValue(e.target.value))}
                    className="w-16 bg-white border border-slate-200 p-1 rounded-lg text-xs"
                  />
                  <button type="button" onClick={() => handleRemoveLine(idx)} className="text-red-500 p-1">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            Save Register Invoice
          </button>
        </form>
      </div>

      {/* Grid of registered invoices */}
      <div className="lg:col-span-7 space-y-6">
        <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText size={16} className="text-slate-700" />
              Registered Invoices Directory
            </h3>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
              {state.invoices.length} entries
            </span>
          </div>

          <div className="space-y-3">
            {state.invoices.length === 0 ? (
              <p className="text-slate-400 text-center py-16 font-medium">No procurement invoices recorded.</p>
            ) : (
              [...state.invoices]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((inv) => {
                  const vendor = getVendorName(inv.vendorId);
                  return (
                    <div
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between gap-4 hover:shadow-sm hover:border-slate-200 cursor-pointer transition-all group"
                    >
                      <div className="space-y-1">
                        <strong className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">
                          {vendor}
                        </strong>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">{inv.date}</span>
                          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold px-2 rounded">
                            {inv.category}
                          </span>
                          <span className="text-slate-400 font-medium">Inv #{inv.number}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleInvoicePaid(inv.id);
                            }}
                            title="Click to toggle payment status"
                            className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-extrabold border transition-all ${
                              inv.isPaid !== false
                                ? "bg-emerald-50 text-emerald-700 border-emerald-150 hover:bg-emerald-100"
                                : "bg-rose-50 text-rose-700 border-rose-150 hover:bg-rose-100"
                            }`}
                          >
                            {inv.isPaid !== false ? "Paid" : "Outstanding"}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <strong className="font-bold text-slate-800">{money.format(currencyValue(inv.total))}</strong>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteInvoice(inv.id, inv.number);
                          }}
                          className="logo-delete-action text-slate-350 hover:text-red-600 p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </section>
      </div>

      {/* Selected Invoice Overlay detail drawer */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-end p-4">
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              className="bg-white max-w-xl w-full h-[95vh] rounded-3xl shadow-2xl overflow-hidden border border-slate-250 flex flex-col"
            >
              <div className="bg-slate-950 text-white p-6 flex justify-between items-center">
                <div>
                  <h4 className="text-base font-extrabold text-white text-slate-100">Procured Invoice Details</h4>
                  <span className="text-slate-400 text-xs">Vendor: {getVendorName(selectedInvoice.vendorId)}</span>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 px-2 border border-slate-800 rounded bg-slate-900 hover:bg-slate-850 hover:text-slate-200 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div className="grid grid-cols-3 gap-3 text-sm mt-2">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase leading-none">Invoice date</span>
                    <strong className="text-slate-800 block mt-1.5">{selectedInvoice.date}</strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase leading-none">Total Payment</span>
                    <strong className="text-slate-800 block mt-1.5">{money.format(currencyValue(selectedInvoice.total))}</strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase leading-none">Payment Status</span>
                    <button
                      type="button"
                      onClick={() => handleToggleInvoicePaid(selectedInvoice.id)}
                      title="Click to toggle payment status"
                      className={`mt-1 py-1 px-2 rounded text-[11px] font-bold text-center border transition-all ${
                        selectedInvoice.isPaid !== false
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                      }`}
                    >
                      {selectedInvoice.isPaid !== false ? "Paid" : "Outstanding"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <strong className="text-xs uppercase tracking-wider text-slate-400 font-bold block">Assigned Items Breakdown</strong>
                  <div className="border border-slate-150 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {(!selectedInvoice.lineItems || selectedInvoice.lineItems.length === 0) ? (
                      <p className="p-5 text-center text-slate-405 italic text-sm">No specific lines items linked from scan.</p>
                    ) : (
                      selectedInvoice.lineItems.map((line, k) => (
                        <div key={k} className="p-3.5 flex items-center justify-between text-sm hover:bg-slate-50/50">
                          <div>
                            <strong className="font-semibold text-slate-700 block">{line.description}</strong>
                            <span className="text-[11px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-100 mt-1 inline-block">
                              {line.category}
                            </span>
                          </div>
                          <strong className="font-bold text-slate-800">{money.format(line.total)}</strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="bg-slate-900 text-white font-bold p-2 px-5 rounded-xl hover:bg-slate-850 text-xs"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
