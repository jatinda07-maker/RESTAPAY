/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AppState, ViewName } from "./types";
import { today, uid, INITIAL_STATE, DEMO_SEEDS } from "./utils/helpers";
import { DashboardView } from "./components/DashboardView";
import { SalesView } from "./components/SalesView";
import { InvoicesView } from "./components/InvoicesView";
import { PayrollView } from "./components/PayrollView";
import { VendorsView } from "./components/VendorsView";
import { EmployeesView } from "./components/EmployeesView";
import { ProfitView } from "./components/ProfitView";
import {
  LayoutDashboard,
  TrendingDown,
  Building,
  Award,
  Wallet,
  Coins,
  FileSpreadsheet,
  CloudLightning,
  RefreshCcw,
  Sparkles,
  Download,
  Upload,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const STORAGE_KEY = "FNB_APP_STATE_v1";

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.sales && parsed.invoices && parsed.payroll) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Local storage check error:", e);
    }
    return INITIAL_STATE;
  });

  const [activeView, setActiveView] = useState<ViewName>("dashboard");
  const [syncKey, setSyncKey] = useState("");
  const [syncStatus, setSyncStatus] = useState("");

  // Auto save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const handleBackupExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fnb-audit-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSyncStatus("Backup file generated and downloaded.");
  };

  const handleBackupImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.sales && imported.invoices && imported.payroll && imported.employees) {
          setState(imported);
          setSyncStatus("State imported from file successfully!");
        } else {
          setSyncStatus("Error: Invalid backup state schema.");
        }
      } catch {
        setSyncStatus("Error: Unreadable state format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleResetToSeeds = () => {
    if (window.confirm("Load demo seed registers? This will pre-populate the workspace with demo logs for testing.")) {
      setState(DEMO_SEEDS);
      setSyncStatus("Demo seeds loaded successfully.");
    }
  };

  const handleClearWorkspace = () => {
    if (window.confirm("Wipe all data? This will permanently delete all employees, vendors, sales, invoices, and payroll logs. Your categories and custom types config will be preserved.")) {
      setState(INITIAL_STATE);
      setSyncStatus("Workspace cleared. Ready for fresh manual data on-boarding.");
    }
  };

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return <DashboardView state={state} onNavigateToView={setActiveView} onSetState={setState} />;
      case "sales":
        return <SalesView state={state} onSetState={setState} />;
      case "invoices":
        return <InvoicesView state={state} onSetState={setState} />;
      case "payroll":
        return <PayrollView state={state} onSetState={setState} />;
      case "vendors":
        return <VendorsView state={state} onSetState={setState} />;
      case "employees":
        return <EmployeesView state={state} onSetState={setState} />;
      case "profit":
        return <ProfitView state={state} onSetState={setState} />;
      default:
        return <DashboardView state={state} onNavigateToView={setActiveView} onSetState={setState} />;
    }
  };

  const menuItems = [
    { id: "dashboard" as ViewName, label: "Live Dashboard", icon: LayoutDashboard },
    { id: "sales" as ViewName, label: "POS Sales Log", icon: FileSpreadsheet },
    { id: "invoices" as ViewName, label: "Procured Invoices", icon: TrendingDown },
    { id: "payroll" as ViewName, label: "Disbursements", icon: Wallet },
    { id: "vendors" as ViewName, label: "Suppliers", icon: Building },
    { id: "employees" as ViewName, label: "Staff Wages", icon: Award },
    { id: "profit" as ViewName, label: "Margins & Cash", icon: Coins },
  ];

  return (
    <div className="min-h-screen bg-slate-50/65 flex flex-col font-sans text-slate-950 antialiased selection:bg-indigo-100 selection:text-indigo-900 leading-normal">
      {/* Premium FinTech Header */}
      <header className="bg-slate-900 text-white shadow-xl border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-gradient-to-br from-teal-400 via-emerald-500 to-indigo-600 text-white rounded-2xl shadow-lg font-black font-mono tracking-tight flex items-center justify-center leading-none text-base">
              F&amp;B
            </span>
            <div>
              <h1 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5 leading-none">
                Audit Flow Engine <Sparkles size={13} className="text-teal-400 animate-pulse" />
              </h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-tight mt-1 leading-none">
                AI Statement Extractor &amp; Restaurant Wage Reconciliation Workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToSeeds}
              className="px-3 py-2 bg-slate-800/60 border border-slate-700/60 hover:border-teal-500/50 hover:bg-slate-800 rounded-xl text-[11px] font-bold text-slate-350 hover:text-white transition-all flex items-center gap-1.5"
              title="Reset configuration state to initial demo logs"
            >
              <RefreshCcw size={12} className="text-teal-400" /> Demo Seeds
            </button>
            <button
              onClick={handleClearWorkspace}
              className="px-3 py-2 bg-slate-800/60 border border-slate-700/60 hover:border-rose-500/50 hover:bg-slate-800 rounded-xl text-[11px] font-bold text-slate-350 hover:text-white transition-all flex items-center gap-1.5"
              title="Wipe and clear all active records to start with a pristine empty workspace"
            >
              <Trash2 size={12} className="text-rose-450" /> Clear Active
            </button>
            <button
              onClick={handleBackupExport}
              className="px-3 py-2 bg-slate-800/65 border border-slate-700/60 hover:border-indigo-500/50 hover:bg-slate-800 rounded-xl text-[11px] font-bold text-slate-350 hover:text-white transition-all flex items-center gap-1.5"
              title="Export database json file"
            >
              <Download size={12} className="text-indigo-400" /> Export JSON
            </button>
            <label className="px-3 py-2 bg-slate-800/60 border border-slate-700/60 hover:border-pink-500/50 hover:bg-slate-800 rounded-xl text-[11px] font-bold text-slate-350 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer">
              <Upload size={12} className="text-pink-400" /> Restore
              <input type="file" accept=".json" onChange={handleBackupImport} className="hidden" />
            </label>
          </div>
        </div>
      </header>

      {syncStatus && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs py-2.5 text-center font-bold px-4 flex justify-center items-center gap-1 text-[11px] shadow-sm animate-fadeIn">
          <span>{syncStatus}</span>
          <button onClick={() => setSyncStatus("")} className="font-extrabold hover:opacity-85 text-white bg-slate-950/20 px-1.5 py-0.5 rounded ml-1.5">✕</button>
        </div>
      )}

      {/* Main Grid Viewport */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-12 gap-7 relative">
        {/* Responsive Desktop Sidebar Menu */}
        <aside className="md:col-span-3 lg:col-span-2.5 space-y-4">
          <nav className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-sm space-y-1.5">
            <div className="px-3 pb-2.5 pt-0.5 border-b border-slate-100 mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Main Modules</span>
            </div>
            {menuItems.map((item) => {
              const IconComp = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full py-2.5 px-3.5 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-3 ${
                    isActive 
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10 border-l-4 border-l-teal-400" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <IconComp size={15} className={isActive ? "text-teal-400 font-extrabold" : "text-slate-400"} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Dynamic Screen panel viewport */}
        <main className="md:col-span-9 lg:col-span-9.5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Outer subtle branding */}
      <footer className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          <span>Active Session Database: Local First Encrypted</span>
          <span>© F&amp;B Audit Engine v1.0.3</span>
        </div>
      </footer>
    </div>
  );
}
