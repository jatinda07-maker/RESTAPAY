/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { AppState, Vendor } from "../types";
import { uid } from "../utils/helpers";
import { Plus, Trash2, Edit, PhoneCall, Building, Check, Sparkles } from "lucide-react";

interface VendorsViewProps {
  state: AppState;
  onSetState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function VendorsView({ state, onSetState }: VendorsViewProps) {
  const [vendorName, setVendorName] = useState("");
  const [vendorType, setVendorType] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [contact, setContact] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newVendorType, setNewVendorType] = useState("");
  const [showAddTypeInput, setShowAddTypeInput] = useState(false);

  const [newCategory, setNewCategory] = useState("");
  const [newCategoryMargin, setNewCategoryMargin] = useState("50");
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);

  const handleCreateVendorType = (e: React.MouseEvent) => {
    e.preventDefault();
    const cleanType = newVendorType.trim();
    if (!cleanType) return;
    if (state.options.vendorTypes.some(t => t.toLowerCase() === cleanType.toLowerCase())) {
      alert("This vendor type already exists.");
      return;
    }
    onSetState((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        vendorTypes: [...prev.options.vendorTypes, cleanType]
      }
    }));
    setVendorType(cleanType);
    setNewVendorType("");
    setShowAddTypeInput(false);
  };

  const handleCreateCategoryWithMargin = (e: React.MouseEvent) => {
    e.preventDefault();
    const cleanCat = newCategory.trim();
    const marginNum = Number(newCategoryMargin) || 50;
    if (!cleanCat) return;
    if (state.options.categories.some(c => c.toLowerCase() === cleanCat.toLowerCase())) {
      alert("This category already exists.");
      return;
    }
    onSetState((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        categories: [...prev.options.categories, cleanCat],
      },
      categoryMargins: {
        ...prev.categoryMargins,
        [cleanCat]: marginNum
      }
    }));
    setDefaultCategory(cleanCat);
    setNewCategory("");
    setNewCategoryMargin("50");
    setShowAddCategoryInput(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName) return;

    if (editingId) {
      onSetState((prev) => ({
        ...prev,
        vendors: prev.vendors.map(v => v.id === editingId ? {
          ...v,
          name: vendorName,
          type: vendorType,
          category: defaultCategory,
          contact
        } : v)
      }));
      setEditingId(null);
    } else {
      const newVendor: Vendor = {
        id: uid("vendor"),
        name: vendorName,
        type: vendorType || "Food Distributor",
        category: defaultCategory || "Food",
        contact
      };
      onSetState((prev) => ({
        ...prev,
        vendors: [...prev.vendors, newVendor]
      }));
    }

    setVendorName("");
    setVendorType("");
    setDefaultCategory("");
    setContact("");
  };

  const handleEdit = (vendor: Vendor) => {
    setVendorName(vendor.name);
    setVendorType(vendor.type);
    setDefaultCategory(vendor.category);
    setContact(vendor.contact || "");
    setEditingId(vendor.id);
  };

  const handleDelete = (id: string) => {
    const invoicesLinked = state.invoices.filter(x => x.vendorId === id).length;
    const payrollLinked = state.payroll.filter(p => p.personId === `vendor:${id}`).length;
    const totalLines = invoicesLinked + payrollLinked;

    const msg = totalLines > 0
      ? `This vendor has ${totalLines} transaction histories linked. If you delete it, past data remains but it will be removed from input lists. Continue?`
      : "Delete this vendor?";

    if (!window.confirm(msg)) return;

    onSetState((prev) => ({
      ...prev,
      vendors: prev.vendors.filter(v => v.id !== id)
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      {/* Editor card left split */}
      <div className="lg:col-span-5">
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {editingId ? "Modify Registered Vendor" : "Create Vendor Account"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Setup procurement channels, supply lines, or service crews.</p>
            </div>
            {editingId && (
              <span className="text-[10px] bg-slate-900 text-white font-bold p-1 px-2 rounded-lg">EDIT MODE</span>
            )}
          </div>

          <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
            Vendor Supplier Name
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. US Foods, Sysco, State Power"
              required
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
            />
          </label>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5 justify-between">
                Service Type
                <div className="flex gap-1.5">
                  <select
                    value={vendorType}
                    onChange={(e) => setVendorType(e.target.value)}
                    required
                    className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none flex-1"
                  >
                    <option value="">Select type</option>
                    {state.options.vendorTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddTypeInput(!showAddTypeInput)}
                    className="px-2 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700"
                  >
                    {showAddTypeInput ? "✕" : "+"}
                  </button>
                </div>
              </label>

              <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5 justify-between">
                Default Category
                <div className="flex gap-1.5">
                  <select
                    value={defaultCategory}
                    onChange={(e) => setDefaultCategory(e.target.value)}
                    required
                    className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none flex-1"
                  >
                    <option value="">Select category</option>
                    {state.options.categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryInput(!showAddCategoryInput)}
                    className="px-2 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-slate-700"
                  >
                    {showAddCategoryInput ? "✕" : "+"}
                  </button>
                </div>
              </label>
            </div>

            {showAddTypeInput && (
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 animate-fadeIn">
                <span className="text-[10px] uppercase font-bold text-indigo-600 block">Add Custom Service Type</span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newVendorType}
                    onChange={(e) => setNewVendorType(e.target.value)}
                    placeholder="e.g. Linen Supplier, Waste"
                    className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateVendorType}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {showAddCategoryInput && (
              <div className="p-3.5 bg-teal-50/50 border border-teal-100 rounded-xl space-y-2.5 animate-fadeIn">
                <span className="text-[10px] uppercase font-bold text-teal-650 block">Add Category &amp; Target Profit Margin</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="e.g. Wine, Desserts"
                    className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={newCategoryMargin}
                      onChange={(e) => setNewCategoryMargin(e.target.value)}
                      placeholder="Margin %"
                      className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-center focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-bold">%</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCreateCategoryWithMargin}
                  className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg shadow-sm"
                >
                  Save Category &amp; Pricing Margin
                </button>
              </div>
            )}
          </div>

          <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
            Contact Reference (Phone/Email)
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="e.g. rep@usfoods.com or 555-0199"
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
            >
              {editingId ? <Check size={16} /> : <Plus size={16} />}
              {editingId ? "Save Vendor Details" : "Add New Vendor Supplier"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setVendorName("");
                  setVendorType("");
                  setDefaultCategory("");
                  setContact("");
                }}
                className="border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Roster right split */}
      <div className="lg:col-span-7">
        <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building size={16} className="text-slate-700" />
              Service & Supplier Directory
            </h3>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
              {state.vendors.length} vendors
            </span>
          </div>

          <div className="space-y-3">
            {state.vendors.length === 0 ? (
              <p className="text-slate-400 text-center py-16 font-medium">No vendors logged in directory yet.</p>
            ) : (
              state.vendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between gap-4 hover:shadow-sm hover:border-slate-200 transition-all group"
                >
                  <div className="space-y-1">
                    <strong className="font-bold text-slate-800 text-sm block">{vendor.name}</strong>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">{vendor.type}</span>
                      <span className="bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.5 rounded border border-indigo-100">
                        {vendor.category}
                      </span>
                      {vendor.contact && (
                        <span className="text-slate-400 inline-flex items-center gap-1">
                          <PhoneCall size={10} /> {vendor.contact}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEdit(vendor)}
                      aria-label="Edit vendor"
                      className="p-1 px-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                    >
                      <Edit size={12} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(vendor.id)}
                      aria-label="Delete vendor"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
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
