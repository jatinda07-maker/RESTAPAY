/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { AppState, Employee } from "../types";
import { currencyValue, money, uid, today } from "../utils/helpers";
import { Search, Plus, Archive, RotateCcw, Trash2, Edit, Award } from "lucide-react";

interface EmployeesViewProps {
  state: AppState;
  onSetState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function EmployeesView({ state, onSetState }: EmployeesViewProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [payType, setPayType] = useState("");
  const [rate, setRate] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEmployeeType, setNewEmployeeType] = useState("");
  const [showAddTypeInput, setShowAddTypeInput] = useState(false);

  const handleCreateEmployeeType = (e: React.MouseEvent) => {
    e.preventDefault();
    const cleanType = newEmployeeType.trim();
    if (!cleanType) return;
    if (state.options.employeeTypes.some(t => t.toLowerCase() === cleanType.toLowerCase())) {
      alert("This employee type already exists.");
      return;
    }
    onSetState((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        employeeTypes: [...prev.options.employeeTypes, cleanType]
      }
    }));
    setType(cleanType);
    setNewEmployeeType("");
    setShowAddTypeInput(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    if (editingId) {
      onSetState((prev) => ({
        ...prev,
        employees: prev.employees.map(emp => emp.id === editingId ? {
          ...emp,
          name,
          type,
          payType,
          rate
        } : emp)
      }));
      setEditingId(null);
    } else {
      const newEmp: Employee = {
        id: uid("employee"),
        name,
        type: type || "Waiter",
        payType: payType || "Hourly",
        rate: rate || "15.00"
      };
      onSetState((prev) => ({
        ...prev,
        employees: [...prev.employees, newEmp]
      }));
    }

    setName("");
    setType("");
    setPayType("");
    setRate("");
  };

  const handleEdit = (emp: Employee) => {
    setName(emp.name);
    setType(emp.type);
    setPayType(emp.payType);
    setRate(emp.rate);
    setEditingId(emp.id);
  };

  const handleArchiveToggle = (emp: Employee) => {
    const active = !emp.inactive;
    const msg = active
      ? `Archive employee "${emp.name}"? This removes them from active selections. Past history remains.`
      : `Restore employee "${emp.name}" back to active status?`;

    if (!window.confirm(msg)) return;

    onSetState((prev) => ({
      ...prev,
      employees: prev.employees.map(x => x.id === emp.id ? {
        ...x,
        inactive: active,
        deletedAt: active ? today : undefined
      } : x)
    }));
  };

  const handlePermanentDelete = (id: string) => {
    if (!window.confirm("Permanently delete this employee? This will fully remove their record from roster, though payroll logs are preserved.")) return;
    onSetState((prev) => ({
      ...prev,
      employees: prev.employees.filter((x) => x.id !== id)
    }));
  };

  // Searching logic
  const filteredEmployees = state.employees.filter((emp) => {
    const textMatches = [emp.name, emp.type, emp.payType]
      .some(field => String(field || "").toLowerCase().includes(search.toLowerCase()));

    if (statusFilter === "active") return textMatches && !emp.inactive;
    if (statusFilter === "inactive") return textMatches && emp.inactive;
    return textMatches;
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      {/* Left editor split form */}
      <div className="lg:col-span-4">
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {editingId ? "Edit Staff Wage & Pay" : "Onboard Employee"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Configure default wage rates, staff types, and payment modes.</p>
            </div>
            {editingId && (
              <span className="text-[10px] bg-slate-900 text-white font-extrabold px-2 py-0.5 rounded">EDIT</span>
            )}
          </div>

          <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
            Full Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Michael Smith"
              required
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
            />
          </label>

           <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Roster Job Title
              <div className="flex gap-2">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none flex-1"
                >
                  <option value="">Select type</option>
                  {state.options.employeeTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddTypeInput(!showAddTypeInput)}
                  className="px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all border border-slate-200"
                >
                  {showAddTypeInput ? "Cancel" : "+ New"}
                </button>
              </div>
            </label>

            {showAddTypeInput && (
              <div className="p-3 bg-violet-50/50 border border-violet-100 rounded-xl space-y-2 animate-fadeIn">
                <span className="text-[10px] uppercase font-bold text-violet-600 block">Add Custom Job Title</span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newEmployeeType}
                    onChange={(e) => setNewEmployeeType(e.target.value)}
                    placeholder="e.g. Head Chef, Sommelier"
                    className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateEmployeeType}
                    className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Default Pay Type
              <select
                value={payType}
                onChange={(e) => setPayType(e.target.value)}
                required
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              >
                <option value="">Select type</option>
                {state.options.payTypes.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700 flex flex-col gap-1.5">
              Hourly Wage or Salary ($)
              <input
                type="number"
                step="0.01"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
                placeholder="15.00"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white focus:outline-none"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus size={16} /> {editingId ? "Save Profile" : "Register Onboarding"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setName("");
                  setType("");
                  setPayType("");
                  setRate("");
                }}
                className="border border-slate-200 text-slate-600 rounded-xl px-4 text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Directory right split */}
      <div className="lg:col-span-8 space-y-4">
        <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Award size={16} className="text-slate-700" />
                Staff Wage Directory
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Filter team by roster status, search by role types or pay-rate.</p>
            </div>

            {/* Filter buttons */}
            <div className="bg-slate-100 p-0.5 rounded-lg flex gap-1 text-[11px] font-bold">
              <button
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1 rounded-md transition-all ${statusFilter === "active" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                Active ({state.employees.filter((e) => !e.inactive).length})
              </button>
              <button
                onClick={() => setStatusFilter("inactive")}
                className={`px-3 py-1 rounded-md transition-all ${statusFilter === "inactive" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                Archived ({state.employees.filter((e) => e.inactive).length})
              </button>
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 rounded-md transition-all ${statusFilter === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                All
              </button>
            </div>
          </div>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search name, job title, pay type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredEmployees.length === 0 ? (
              <p className="col-span-2 text-slate-400 text-center py-16 font-medium">No employees pass selected search criteria.</p>
            ) : (
              filteredEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className={`p-4 border rounded-2xl flex flex-col justify-between gap-4 transition-all group ${emp.inactive ? "border-slate-100 bg-slate-50/50" : "border-slate-200 bg-white hover:shadow-sm"}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <strong className={`font-bold text-sm ${emp.inactive ? "text-slate-400 line-through" : "text-slate-800"}`}>
                        {emp.name}
                      </strong>
                      {emp.inactive && (
                        <span className="text-[9px] font-bold bg-slate-200 text-slate-500 px-1 py-0.2 rounded uppercase">
                          Archived
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <span className="bg-slate-100 text-slate-600 font-medium px-1.5 py-0.5 rounded">{emp.type}</span>
                      <span>Default:</span>
                      <strong className="text-slate-600 font-semibold">{emp.payType}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-50 pt-2.5">
                    <div>
                      <small className="text-[10px] text-slate-400 uppercase font-bold block leading-none">Roster Pay Rate</small>
                      <strong className="text-[14px] font-extrabold text-slate-800 mt-1 block">
                        {money.format(currencyValue(emp.rate))}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(emp)}
                        className="p-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300"
                        title="Edit roster pay profile"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        onClick={() => handleArchiveToggle(emp)}
                        className={`p-1.5 rounded-lg border transition-colors ${emp.inactive ? "bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100" : "border-slate-200 text-slate-400 hover:text-amber-600 hover:bg-amber-50"}`}
                        title={emp.inactive ? "Restore to active staff roster" : "Archive and release roster profile"}
                      >
                        {emp.inactive ? <RotateCcw size={12} /> : <Archive size={12} />}
                      </button>
                      {emp.inactive && (
                        <button
                          onClick={() => handlePermanentDelete(emp.id)}
                          className="p-1.5 border border-red-100 text-red-500 rounded-lg hover:bg-red-50 hover:border-red-200"
                          title="Purge record permanently"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
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
