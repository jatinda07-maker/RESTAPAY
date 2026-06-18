const SUPABASE_URL = "https://nzravalposusjrjcwvgz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Hl39iP3Oj41qiywYFLrqjw_0-0iAvi4";
const DATA_KEY = "restaurant-payroll-vendor";
const DATA_KEY_CANDIDATES = [
  "restaurant-payroll-vendor",
  "RESTAPAY",
  "restapay",
  "restapay-state",
  "resta-pay",
  "restaurant-payroll-vendor-v1",
  "restaurant-payroll-vendor-data"
];
const supabaseClient = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY) || null;
let cloudStorageReady = false;
let cloudStorageLoading = true;
let cloudSaveTimer = null;
let lastSavedPayload = "";
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const today = new Date().toISOString().slice(0, 10);

const defaults = {
  vendorTypes: ["Food Distributor", "Cleaning Service", "Supplies Vendor", "Maintenance", "Utilities", "Beverage"],
  employeeTypes: ["Kitchen Employee", "Waiter", "Cashier", "Manager", "Cleaner"],
  payTypes: ["Hourly", "Salary", "Tips", "Bonus", "Vendor Payment", "Cash", "Check"],
  paymentMethods: ["Cash", "Check", "Card", "ACH", "Other"],
  categories: ["Food", "Supplies", "Cleaning", "Equipment", "Maintenance", "Utilities", "Beverage", "Packaging", "Other"],
  propertyExpenseTypes: ["Rent", "Utilities", "Repairs & Maintenance", "Insurance", "Property Tax", "CAM / Common Area", "Pest Control", "Security", "Landscaping", "Equipment Repair", "Licenses & Permits", "Other Property Expense"],
  propertyVendorTypes: ["Rent", "Utilities", "Repairs & Maintenance", "Insurance", "Property Tax", "Security", "Landscaping", "Supplies", "Other"],
  propertyPayees: ["Landlord", "Power Company", "Water Company", "Gas Company", "Insurance Company", "Repair Vendor", "Pest Control", "Security Company"]
};

let state = loadState();
let lastInvoiceRead = null;
let currentInvoiceItems = [];
let selectedInvoiceId = null;
let selectedToastPayrollId = null;
let selectedToastSalesId = null;

// Expose read-only handles for inline dashboard layout scripts.
try {
  window.restaPayState = state;
  window.restaPayMoney = money;
  window.restaPayCurrencyValue = currencyValue;
} catch (_) {}

function defaultStateFromSaved(saved = {}) {
  return {
    options: migrateOptions({ ...defaults, ...(saved.options || {}) }),
    vendors: normalizeSavedRows(saved.vendors || [], "vendor"),
    employees: normalizeSavedRows(saved.employees || [], "employee"),
    payroll: saved.payroll || [],
    invoices: saved.invoices || [],
    propertyExpenses: normalizeSavedRows(saved.propertyExpenses || [], "property-expense"),
    cashCollections: saved.cashCollections || [],
    sales: saved.sales || [],
    toastPayroll: normalizeSavedRows(saved.toastPayroll || [], "toast-payroll"),
    weeklyCashEmployees: normalizeSavedRows(saved.weeklyCashEmployees || [], "weekly-cash"),
    dashboardCards: saved.dashboardCards || defaultDashboardCards(),
    customDashboardCards: saved.customDashboardCards || [],
    priceAlerts: saved.priceAlerts || [],
    customReports: saved.customReports || [],
    categoryMargins: saved.categoryMargins || {}
  };
}

function loadState() {
  try {
    let bestSaved = {};
    let bestScore = -1;
    const keys = [...DATA_KEY_CANDIDATES];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && !keys.includes(key)) keys.push(key);
    }

    keys.forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw || raw.length < 2) return;
        const parsed = JSON.parse(raw);
        const candidate = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
        const score = dataCompletenessScore(candidate);
        if (score > bestScore) {
          bestScore = score;
          bestSaved = candidate;
        }
      } catch (_) {}
    });

    if (bestScore > 0) {
      console.log("Loaded RESTAPAY local data score:", bestScore);
      return defaultStateFromSaved(bestSaved);
    }

    return defaultStateFromSaved({});
  } catch (error) {
    console.warn("Local saved data could not be loaded:", error);
    return defaultStateFromSaved({});
  }
}

function dataCompletenessScore(saved = {}) {
  return [
    "vendors",
    "employees",
    "payroll",
    "invoices",
    "propertyExpenses",
    "cashCollections",
    "sales",
    "toastPayroll",
    "weeklyCashEmployees",
    "priceAlerts"
  ].reduce((score, key) => score + ((saved[key] || []).length || 0), 0);
}

function migrateOptions(options) {
  const migrated = { ...(options || {}) };
  migrated.propertyVendorTypes = migrated.propertyVendorTypes || migrated.propertyPayees || defaults.propertyVendorTypes || [];
  migrated.propertyPayees = migrated.propertyPayees || [];
  return migrated;
}

function saveState() {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Local backup save failed:", error);
  }

  if (!supabaseClient || !cloudStorageReady || cloudStorageLoading) return;

  const payload = JSON.stringify(state);
  if (payload === lastSavedPayload) return;
  lastSavedPayload = payload;

  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    const { error } = await supabaseClient
      .from("app_data")
      .upsert({
        id: DATA_KEY,
        data: JSON.parse(payload),
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });

    if (error) {
      console.error("Supabase save error:", error);
      const status = document.getElementById("cloudSaveStatus");
      setCloudStatus("Cloud save failed - check app_data table/RLS", false);
    } else {
      const status = document.getElementById("cloudSaveStatus");
      setCloudStatus("Cloud saved");
    }
  }, 350);
}

function hasMeaningfulSavedData(saved = {}) {
  return dataCompletenessScore(saved) > 0;
}

function setCloudStatus(message, ok = true) {
  const status = document.getElementById("cloudSaveStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", !ok);
}

async function loadStateFromSupabase() {
  const localState = state;

  if (!supabaseClient) {
    console.warn("Supabase client not loaded. Using local browser backup only.");
    cloudStorageLoading = false;
    cloudStorageReady = false;
    setCloudStatus("Local only - Supabase not loaded", false);
    return false;
  }

  cloudStorageLoading = true;
  setCloudStatus("Cloud loading...");

  const { data, error } = await supabaseClient
    .from("app_data")
    .select("id,data")
    .in("id", DATA_KEY_CANDIDATES);

  cloudStorageLoading = false;

  if (error) {
    console.error("Supabase load error:", error);
    cloudStorageReady = false;
    setCloudStatus("Cloud load failed - check app_data table/RLS", false);
    return false;
  }

  cloudStorageReady = true;

  const bestCloud = (data || [])
    .map(row => ({ id: row.id, data: row.data || {}, score: dataCompletenessScore(row.data || {}) }))
    .sort((a, b) => b.score - a.score)[0];

  const cloudData = bestCloud?.data || {};
  const cloudScore = bestCloud?.score || 0;
  const localScore = dataCompletenessScore(localState);

  if (cloudScore > 0 && cloudScore >= localScore) {
    state = defaultStateFromSaved(cloudData);
    window.restaPayState = state;
    lastSavedPayload = JSON.stringify(state);
    setCloudStatus(`Cloud loaded ${cloudScore} records`);
  } else if (hasMeaningfulSavedData(localState)) {
    // First-time setup: seed Supabase from this browser's local data.
    state = localState;
    window.restaPayState = state;
    lastSavedPayload = "";
    setCloudStatus("Seeding cloud...");
    saveState();
  } else {
    state = defaultStateFromSaved({});
    window.restaPayState = state;
    setCloudStatus("Cloud ready - no data yet");
  }

  return true;
}

async function initializeAppData() {
  await loadStateFromSupabase();
  renderAll();
  // Ensure cloud has latest state after all import/sync migrations run.
  setTimeout(() => saveState(), 750);
}

function normalizeSavedRows(rows, prefix) {
  const seen = new Set();
  return (rows || []).map(row => {
    const copy = { ...(row || {}) };
    if (!copy.id) copy.id = uid(prefix);
    // Very old saved data or imported rows can occasionally share an id.
    // Give duplicates a fresh id so the Delete button removes the exact row clicked.
    if (seen.has(copy.id)) copy.id = uid(prefix);
    seen.add(copy.id);
    return copy;
  });
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function activeEmployees() {
  return (state.employees || []).filter(employee => !employee.inactive && !employee.deletedAt);
}

function inactiveEmployees() {
  return (state.employees || []).filter(employee => employee.inactive || employee.deletedAt);
}

function employeeSearchText(employee) {
  return [employee.name, employee.type, employee.payType, employee.rate].map(value => String(value || '').toLowerCase()).join(' ');
}

function visibleEmployeesForList() {
  const search = String(document.getElementById('employeeSearch')?.value || '').trim().toLowerCase();
  const status = document.getElementById('employeeStatusFilter')?.value || 'active';
  let rows = state.employees || [];
  if (status === 'active') rows = activeEmployees();
  if (status === 'inactive') rows = inactiveEmployees();
  if (search) rows = rows.filter(employee => employeeSearchText(employee).includes(search));
  return rows;
}

function currencyValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const isParenthesesNegative = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[,$%\s]/g, "").replace(/[()]/g, "");
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num)) return 0;
  return isParenthesesNegative && num > 0 ? -num : num;
}

function marginValue(value) {
  const num = Number.parseFloat(String(value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function categoryMargin(category) {
  return marginValue((state.categoryMargins || {})[category || "Other"]);
}

function invoiceManualMargin(invoice) {
  return marginValue(invoice?.manualProfitMargin || invoice?.profitMargin || "");
}

function invoiceEffectiveMargin(invoice) {
  const manual = invoiceManualMargin(invoice);
  if (manual) return manual;
  return categoryMargin(invoice?.category || topInvoiceCategory(invoice || {}));
}

function marginText(value) {
  const num = marginValue(value);
  return num ? `${num.toFixed(2).replace(/\.00$/, "")}%` : "Not set";
}

function categoryProfitEstimate(category, costAmount) {
  const margin = categoryMargin(category);
  const cost = currencyValue(costAmount);
  if (!margin || margin >= 99.99) return { margin, estimatedSales: 0, estimatedProfit: 0 };
  const estimatedSales = cost / (1 - margin / 100);
  return { margin, estimatedSales, estimatedProfit: estimatedSales - cost };
}

function categoryProfitMeta(category, costAmount) {
  const estimate = categoryProfitEstimate(category, costAmount);
  if (!estimate.margin) return "No category margin set";
  return `Margin ${marginText(estimate.margin)} • Est. sales ${money.format(estimate.estimatedSales)} • Est. profit ${money.format(estimate.estimatedProfit)}`;
}

function fillSelect(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
  select.value = current && values.includes(current) ? current : "";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function renderSelects() {
  document.querySelectorAll("select[data-kind]").forEach(select => {
    const kind = select.dataset.kind;
    const first = select.querySelector("option")?.textContent || "Select";
    fillSelect(select, state.options[kind] || [], first);
  });

  const payrollPerson = document.getElementById("payrollPerson");
  payrollPerson.innerHTML = '<option value="">Select employee or vendor</option>';
  activeEmployees().forEach(employee => payrollPerson.append(new Option(`Employee: ${employee.name}`, `employee:${employee.id}`)));
  state.vendors.forEach(vendor => payrollPerson.append(new Option(`Vendor: ${vendor.name}`, `vendor:${vendor.id}`)));

  const invoiceVendor = document.getElementById("invoiceVendor");
  invoiceVendor.innerHTML = '<option value="">Select vendor</option>';
  state.vendors.forEach(vendor => invoiceVendor.append(new Option(vendor.name, vendor.id)));

  const reportPerson = document.getElementById("reportPerson");
  reportPerson.innerHTML = '<option value="">All employees and vendors</option>';
  activeEmployees().forEach(employee => reportPerson.append(new Option(`Employee: ${employee.name}`, `employee:${employee.id}`)));
  state.vendors.forEach(vendor => reportPerson.append(new Option(`Vendor: ${vendor.name}`, `vendor:${vendor.id}`)));

  const savedReportSelect = document.getElementById("savedReportSelect");
  savedReportSelect.innerHTML = '<option value="">Select saved report</option>';
  state.customReports.forEach(report => savedReportSelect.append(new Option(report.name, report.id)));

  const propertyVendorNameList = document.getElementById("propertyVendorNameList");
  if (propertyVendorNameList) {
    propertyVendorNameList.innerHTML = "";
    const names = new Set();
    (state.vendors || []).forEach(vendor => vendor?.name && names.add(vendor.name));
    (propertyExpenses || []).forEach(expense => {
      const name = expense.vendorName || expense.payee || expense.property;
      if (name) names.add(name);
    });
    [...names].sort((a,b) => a.localeCompare(b)).forEach(name => propertyVendorNameList.append(new Option(name, name)));
  }

  const propertyVendorTypeList = document.getElementById("propertyVendorTypeList");
  if (propertyVendorTypeList) {
    propertyVendorTypeList.innerHTML = "";
    (state.options.propertyVendorTypes || []).forEach(type => propertyVendorTypeList.append(new Option(type, type)));
  }

  renderInvoiceLineEditor();
}

function renderList(elementId, rows, emptyText) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Skipped renderList: missing #${elementId}`);
    return;
  }
  element.innerHTML = "";
  if (!rows.length) {
    element.innerHTML = `<div class="status">${emptyText}</div>`;
    return;
  }
  rows.forEach(row => element.append(row));
}

function iconSvg(kind) {
  const icons = {
    vendor: '<svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01"/></svg>',
    employee: '<svg viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>',
    payroll: '<svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
    invoice: '<svg viewBox="0 0 24 24"><path d="M7 3h10l3 3v15l-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1V3h3ZM8 9h8M8 13h8M8 17h5"/></svg>',
    type: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };
  return icons[kind] || icons.type;
}

function rowItem(title, meta, onDelete, kind = "type") {
  const row = document.createElement("div");
  row.className = `row-item ${kind}-row`;
  row.innerHTML = `<span class="row-icon">${iconSvg(kind)}</span><div><strong>${title}</strong><small>${meta}</small></div>`;
  const button = document.createElement("button");
  button.className = "delete-button";
  button.type = "button";
  button.innerHTML = iconSvg("trash");
  button.addEventListener("click", event => {
    event.stopPropagation();
    onDelete(event);
  });
  row.append(button);
  return row;
}

function appendEditButton(row, onEdit, title = "Edit") {
  const editButton = document.createElement("button");
  editButton.className = "delete-button edit-row-button";
  editButton.type = "button";
  editButton.innerHTML = iconSvg("edit");
  editButton.addEventListener("click", event => {
    event.stopPropagation();
    onEdit(event);
  });
  const deleteButton = row.querySelector(".delete-button");
  if (deleteButton) row.insertBefore(editButton, deleteButton);
  else row.append(editButton);
  return editButton;
}

function renderVendors() {
  renderList("vendorList", state.vendors.map(vendor => {
    const row = rowItem(
      vendor.name,
      `${vendor.type || "No type"} • ${vendor.category || "No category"} • ${vendor.contact || "No contact"}`,
      () => deleteVendor(vendor.id),
      "vendor"
    );
    row.classList.add("clickable-vendor-row");
    row.title = "Click to edit this vendor";
    row.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      fillVendorForm(vendor.id);
    });
    appendEditButton(row, () => fillVendorForm(vendor.id), "Edit vendor");
    return row;
  }), "No vendors yet.");
}

function fillVendorForm(id) {
  const form = document.getElementById("vendorForm");
  const vendor = (state.vendors || []).find(item => String(item.id || "") === String(id || ""));
  if (!form || !vendor) return;
  if (form.elements.id) form.elements.id.value = vendor.id || "";
  if (form.elements.name) form.elements.name.value = vendor.name || "";
  if (form.elements.type) form.elements.type.value = vendor.type || "";
  if (form.elements.category) form.elements.category.value = vendor.category || "";
  if (form.elements.contact) form.elements.contact.value = vendor.contact || "";
  const submit = document.getElementById("vendorSubmit");
  if (submit) submit.textContent = "Save Vendor";
  const clear = document.getElementById("clearVendorForm");
  if (clear) clear.style.display = "inline-flex";
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearVendorForm() {
  const form = document.getElementById("vendorForm");
  if (!form) return;
  form.reset();
  if (form.elements.id) form.elements.id.value = "";
  const submit = document.getElementById("vendorSubmit");
  if (submit) submit.textContent = "Add Vendor";
  const clear = document.getElementById("clearVendorForm");
  if (clear) clear.style.display = "none";
}

function deleteVendor(id) {
  const vendor = (state.vendors || []).find(item => String(item.id || "") === String(id || ""));
  if (!vendor) return;
  const linkedInvoices = (state.invoices || []).filter(item => String(item.vendorId || "") === String(id || "")).length;
  const linkedPayroll = (state.payroll || []).filter(item => String(item.personId || "") === `vendor:${id}`).length;
  const linkedPropertyExpenses = (state.propertyExpenses || []).filter(item => String(item.vendorName || item.payee || "").trim().toLowerCase() === String(vendor.name || "").trim().toLowerCase()).length;
  const linked = linkedInvoices + linkedPayroll + linkedPropertyExpenses;
  const message = linked
    ? `Delete vendor ${vendor.name}?\n\nThis vendor has ${linked} linked record(s). Saved history will stay, but this vendor will be removed from dropdown lists.`
    : `Delete vendor ${vendor.name}?`;
  if (!window.confirm(message)) return;
  state.vendors = (state.vendors || []).filter(item => String(item.id || "") !== String(id || ""));
  clearVendorForm();
  renderAll();
}

function renderEmployees() {
  const rows = visibleEmployeesForList();
  renderList("employeeList", rows.map(employee => employeeRowItem(employee)), "No employees found.");
}

function employeeRowItem(employee) {
  const inactive = Boolean(employee.inactive || employee.deletedAt);
  const meta = `${employee.type || "No type"} • ${employee.payType || "No pay type"} • Rate ${money.format(currencyValue(employee.rate))}${inactive ? ` • Archived ${employee.deletedAt || ""}` : ""}`;
  const row = rowItem(
    `${employee.name}${inactive ? ' <span class="archive-pill">Archived</span>' : ''}`,
    meta,
    () => inactive ? permanentlyDeleteEmployee(employee.id, employee.name) : chooseEmployeeDeleteAction(employee.id, employee.name),
    "employee"
  );
  const detail = row.querySelector('strong');
  if (detail) detail.innerHTML = `${esc(employee.name)}${inactive ? ' <span class="archive-pill">Archived</span>' : ''}`;
  const actions = document.createElement("div");
  actions.className = "row-actions";
  if (inactive) {
    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "restore-button";
    restore.textContent = "Restore";
    restore.addEventListener("click", () => restoreEmployee(employee.id));
    actions.append(restore);
  }
  row.append(actions);
  const deleteButton = row.querySelector('.delete-button');
  if (deleteButton) {
    deleteButton.title = inactive ? "Delete permanently" : "Delete options";
  }
  return row;
}

function personName(personId) {
  const [kind, id] = String(personId || "").split(":");
  if (kind === "employee") return state.employees.find(item => item.id === id)?.name || "Employee";
  if (kind === "vendor") return state.vendors.find(item => item.id === id)?.name || "Vendor";
  return "Not selected";
}

function employeeForPayroll(entry) {
  const [kind, id] = String(entry.personId || "").split(":");
  if (kind !== "employee") return null;
  return state.employees.find(item => item.id === id) || null;
}

function isWaiterTipEntry(entry) {
  const employee = employeeForPayroll(entry);
  return Boolean(employee)
    && String(employee.type || "").toLowerCase().includes("waiter")
    && String(entry.type || "").toLowerCase().includes("tip");
}

function payrollGrossAmount(entry) {
  return currencyValue(entry.amount) + currencyValue(entry.extra);
}

function waiterTipDeduction(entry) {
  return isWaiterTipEntry(entry) ? currencyValue(entry.amount) * 0.03 : 0;
}

function payrollFinalCheckAmount(entry) {
  return payrollGrossAmount(entry) - waiterTipDeduction(entry);
}

function payrollMeta(entry) {
  const method = methodOf(entry) || entry.method || "Check";
  const finalLabel = String(method).toLowerCase() === "cash" ? "Final cash" : "Final check";
  const base = `${entry.type} • ${method} • Base ${money.format(currencyValue(entry.amount))} • Extra ${money.format(currencyValue(entry.extra))}`;
  const deduction = waiterTipDeduction(entry);
  if (!deduction) return `${base} • ${finalLabel} ${money.format(payrollFinalCheckAmount(entry))}`;
  return `${base} • Waiter tip Final Tips deduction ${money.format(deduction)} • ${finalLabel} ${money.format(payrollFinalCheckAmount(entry))}`;
}

function renderPayroll() {
  const sortedPayroll = (state.payroll || []).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  renderList("payrollList", sortedPayroll.map(entry => {
    const amount = payrollFinalCheckAmount(entry);
    const method = methodOf(entry) || "Check";
    const type = entry.type || "Payroll";
    const date = entry.date || "No date";
    const employee = personName(entry.personId);

    const row = document.createElement("div");
    row.className = "payroll-compact-row clickable-payroll-row";
    row.tabIndex = 0;
    row.role = "button";
    row.title = "Click to edit this payment";
    row.innerHTML = `
      <span class="payroll-avatar">${iconSvg("payroll")}</span>
      <div class="payroll-main">
        <div class="payroll-title-line">
          <strong>${esc(employee)}</strong>
          <span class="payroll-amount">${money.format(amount)}</span>
        </div>
        <div class="payroll-meta-line">
          <span class="payroll-pill">${esc(type)}</span>
          <span>${esc(method)}</span>
          <span>${esc(date)}</span>
          ${entry.extra && currencyValue(entry.extra) ? `<span>Extra ${money.format(currencyValue(entry.extra))}</span>` : ""}
          ${entry.reason ? `<span>${esc(entry.reason)}</span>` : ""}
        </div>
      </div>
      <div class="payroll-row-actions">
        <button class="mini-button payroll-visible-edit" type="button">${iconSvg("edit")} <span>Edit</span></button>
        <button class="ghost-button danger-button payroll-visible-delete" type="button">${iconSvg("trash")} <span>Delete</span></button>
      </div>
    `;

    row.querySelector(".payroll-visible-edit")?.addEventListener("click", event => {
      event.stopPropagation();
      fillPayrollForm(entry.id);
    });
    row.querySelector(".payroll-visible-delete")?.addEventListener("click", event => {
      event.stopPropagation();
      removeById("payroll", entry.id);
    });
    row.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      fillPayrollForm(entry.id);
    });
    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fillPayrollForm(entry.id);
      }
    });
    return row;
  }), "No payments saved yet.");
}

function fillPayrollForm(id) {
  const form = document.getElementById("payrollForm");
  const entry = (state.payroll || []).find(item => String(item.id || "") === String(id || ""));
  if (!form || !entry) return;

  let idInput = form.elements.id;
  if (!idInput) {
    idInput = document.createElement("input");
    idInput.type = "hidden";
    idInput.name = "id";
    form.prepend(idInput);
  }

  idInput.value = entry.id || "";
  if (form.elements.date) form.elements.date.value = entry.date || today;
  if (form.elements.personId) form.elements.personId.value = entry.personId || "";
  if (form.elements.type) form.elements.type.value = entry.type || "";
  if (form.elements.amount) form.elements.amount.value = currencyValue(entry.amount) || "";
  if (form.elements.extra) form.elements.extra.value = currencyValue(entry.extra) || "0";
  if (form.elements.reason) form.elements.reason.value = entry.reason || "";
  if (form.elements.method) form.elements.method.value = entry.method || "";
  const submit = form.querySelector("button[type='submit']");
  if (submit) submit.textContent = "Update Payment";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearPayrollForm() {
  const form = document.getElementById("payrollForm");
  if (!form) return;
  form.reset();
  if (form.elements.id) form.elements.id.value = "";
  if (form.elements.date) form.elements.date.value = today;
  if (form.elements.extra) form.elements.extra.value = "0";
  const submit = form.querySelector("button[type='submit']");
  if (submit) submit.textContent = "Save Payment";
}


function weekStartDate(value) {
  const source = value ? new Date(value + "T00:00:00") : new Date();
  const day = source.getDay();
  const diff = (day + 6) % 7;
  source.setDate(source.getDate() - diff);
  return toDateInput(source);
}

function weeklyCashEmployeeName(config) {
  return state.employees.find(employee => employee.id === config.employeeId)?.name || "Employee";
}

function renderWeeklyCashEmployeeSelect() {
  const select = document.getElementById("weeklyCashEmployee");
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Select cash employee</option>';
  activeEmployees().forEach(employee => select.append(new Option(employee.name, employee.id)));
  select.value = current;
}

function renderWeeklyCashEmployees() {
  renderWeeklyCashEmployeeSelect();
  const dateInput = document.getElementById("weeklyCashDate");
  if (dateInput && !dateInput.value) dateInput.value = weekStartDate(today);
  const list = document.getElementById("weeklyCashEmployeeList");
  if (!list) return;
  const configs = state.weeklyCashEmployees || [];
  const active = configs.filter(item => !item.inactive);
  document.getElementById("weeklyCashCount") && (document.getElementById("weeklyCashCount").textContent = `${active.length} active`);
  if (!configs.length) {
    list.innerHTML = '<div class="empty-state">No weekly cash employees saved yet.</div>';
    return;
  }
  list.innerHTML = configs.map(item => {
    const status = item.inactive ? '<span class="archive-pill">Off</span>' : '<span class="pill">Auto weekly</span>';
    return `<div class="weekly-cash-row ${item.inactive ? 'is-off' : ''}" data-weekly-cash-id="${esc(item.id)}">
      <div class="weekly-cash-main">
        <strong>${esc(weeklyCashEmployeeName(item))}</strong>
        <span>${esc(item.type || 'Cash Salary')} • ${money.format(currencyValue(item.amount))} every week ${status}</span>
      </div>
      <div class="weekly-cash-actions">
        <button class="mini-button" type="button" data-weekly-edit="${esc(item.id)}">Edit</button>
        <button class="ghost-button danger-button" type="button" data-weekly-delete="${esc(item.id)}">Delete</button>
      </div>
    </div>`;
  }).join("");
  list.querySelectorAll("[data-weekly-edit]").forEach(button => button.addEventListener("click", () => editWeeklyCashEmployee(button.dataset.weeklyEdit)));
  list.querySelectorAll("[data-weekly-delete]").forEach(button => button.addEventListener("click", () => deleteWeeklyCashEmployee(button.dataset.weeklyDelete)));
}

function editWeeklyCashEmployee(id) {
  const item = (state.weeklyCashEmployees || []).find(row => row.id === id);
  const form = document.getElementById("weeklyCashEmployeeForm");
  if (!item || !form) return;
  form.idValue.value = item.id;
  form.employeeId.value = item.employeeId || "";
  form.amount.value = currencyValue(item.amount) || "";
  form.type.value = item.type || "Cash Payroll";
  form.active.checked = !item.inactive;
  form.querySelector("button[type='submit']").textContent = "Update Group Employee";
}

function clearWeeklyCashEmployeeForm() {
  const form = document.getElementById("weeklyCashEmployeeForm");
  if (!form) return;
  form.reset();
  form.idValue.value = "";
  form.type.value = "Cash Salary";
  form.active.checked = true;
  form.querySelector("button[type='submit']").textContent = "Save Group Employee";
}

function deleteWeeklyCashEmployee(id) {
  state.weeklyCashEmployees = (state.weeklyCashEmployees || []).filter(row => row.id !== id);
  clearWeeklyCashEmployeeForm();
  renderAll();
}

function saveWeeklyCashEmployee(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formData(form);
  if (!data.employeeId) return;
  const row = {
    id: data.idValue || uid("weekly-cash"),
    employeeId: data.employeeId,
    amount: data.amount || "0",
    type: data.type || "Cash Salary",
    inactive: !form.active.checked
  };
  state.weeklyCashEmployees = state.weeklyCashEmployees || [];
  const index = state.weeklyCashEmployees.findIndex(item => item.id === row.id);
  if (index >= 0) state.weeklyCashEmployees[index] = row;
  else state.weeklyCashEmployees.push(row);
  clearWeeklyCashEmployeeForm();
  renderAll();
}

function autoAddWeeklyCashPayments() {
  const selectedDate = document.getElementById("weeklyCashDate")?.value || today;
  const weekStart = weekStartDate(selectedDate);
  const configs = (state.weeklyCashEmployees || []).filter(item => !item.inactive && item.employeeId && currencyValue(item.amount) > 0);
  if (!configs.length) {
    alert("Add at least one active cash salary employee first.");
    return;
  }

  const skipped = [];
  let added = 0;

  configs.forEach(item => {
    const personId = `employee:${item.employeeId}`;
    const employeeName = weeklyCashEmployeeName(item);
    const exists = (state.payroll || []).some(entry =>
      String(entry.personId) === personId
      && String(entry.date || "") === String(selectedDate)
      && String(entry.method || "").toLowerCase() === "cash"
      && (String(entry.sourceWeeklyCashId || "") === String(item.id) || String(entry.type || "").toLowerCase().includes("cash"))
    );

    if (exists) {
      skipped.push(employeeName);
      return;
    }

    state.payroll.push({
      id: uid("payroll"),
      date: selectedDate,
      personId,
      type: item.type || "Cash Salary",
      amount: String(currencyValue(item.amount)),
      extra: "0",
      reason: `Auto cash salary group payment - ${selectedDate}`,
      method: "Cash",
      sourceWeeklyCashId: item.id,
      weekStart
    });
    added += 1;
  });

  const status = document.getElementById("weeklyCashStatus");
  if (status) {
    const skippedText = skipped.length ? ` Skipped duplicates: ${skipped.join(", ")}.` : "";
    status.textContent = added
      ? `Added ${added} cash salary payment${added === 1 ? "" : "s"} for ${selectedDate}.${skippedText}`
      : `No new payments added for ${selectedDate}. All active group employees already exist.`;
  }
  renderAll();
}

function vendorName(id) {
  return state.vendors.find(vendor => vendor.id === id)?.name || "No vendor selected";
}

function cleanInvoiceItems(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({
      description: String(item.description || "").trim(),
      quantity: String(item.quantity || "").trim(),
      unitPrice: currencyValue(item.unitPrice),
      total: currencyValue(item.total),
      category: state.options.categories.includes(item.category) ? item.category : inferCategory(item.description)
    }))
    .filter(item => item.description || item.total !== 0)
    .map(item => ({ ...item, category: item.category || "Other" }));
}

function invoiceCategoryEntries(invoice) {
  const lineItems = cleanInvoiceItems(invoice.lineItems);
  const usableLines = lineItems
    .filter(item => item.total !== 0)
    .map(item => ({ category: item.category || invoice.category || "Other", total: currencyValue(item.total) }));
  if (usableLines.length) return usableLines;
  return [{ category: invoice.category || "Other", total: currencyValue(invoice.total) }];
}

function invoiceCategoryTotals(invoices) {
  return invoices.reduce((groups, invoice) => {
    invoiceCategoryEntries(invoice).forEach(item => {
      groups[item.category] = (groups[item.category] || 0) + item.total;
    });
    return groups;
  }, {});
}

function invoiceMatchesCategory(invoice, category) {
  if (!category) return true;
  return invoiceCategoryEntries(invoice).some(item => item.category === category);
}

function topInvoiceCategory(invoice) {
  const totals = invoiceCategoryTotals([invoice]);
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] || invoice.category || "Other";
}

function renderInvoices() {
  const rows = state.invoices.map(invoice => {
    const row = rowItem(
      `${invoice.date || "No date"} • ${vendorName(invoice.vendorId)}`,
      `${invoice.category || "No category"} • Invoice ${invoice.number || "blank"} • ${money.format(currencyValue(invoice.total))} • Margin ${marginText(invoiceEffectiveMargin(invoice))}`,
      event => {
        event.stopPropagation();
        removeById("invoices", invoice.id);
        if (selectedInvoiceId === invoice.id) clearSelectedInvoice();
      },
      "invoice"
    );
    row.classList.add("clickable-invoice-row");
    row.title = "Click to view or edit invoice line items";
    row.addEventListener("click", () => selectInvoice(invoice.id));
    return row;
  });
  renderList("invoiceList", rows, "No invoices saved yet.");
}


function selectedInvoice() {
  return state.invoices.find(invoice => invoice.id === selectedInvoiceId) || null;
}

function clearSelectedInvoice() {
  selectedInvoiceId = null;
  const panel = document.getElementById("invoiceDetailPanel");
  const status = document.getElementById("selectedInvoiceStatus");
  const header = document.getElementById("selectedInvoiceHeader");
  const lines = document.getElementById("selectedInvoiceLines");
  const save = document.getElementById("saveSelectedInvoice");
  const close = document.getElementById("closeSelectedInvoice");
  const del = document.getElementById("deleteSelectedInvoice");
  if (panel) panel.classList.remove("active");
  if (status) status.textContent = "No invoice selected";
  if (header) header.textContent = "Click a saved invoice below to view, edit, or delete its line items.";
  if (lines) lines.innerHTML = "";
  if (save) save.disabled = true;
  if (close) close.disabled = true;
  if (del) del.disabled = true;
}

function selectInvoice(id) {
  selectedInvoiceId = id;
  renderSelectedInvoice();
  const panel = document.getElementById("invoiceDetailPanel");
  if (panel) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderSelectedInvoice() {
  const invoice = selectedInvoice();
  const panel = document.getElementById("invoiceDetailPanel");
  const status = document.getElementById("selectedInvoiceStatus");
  const header = document.getElementById("selectedInvoiceHeader");
  const lines = document.getElementById("selectedInvoiceLines");
  const save = document.getElementById("saveSelectedInvoice");
  const close = document.getElementById("closeSelectedInvoice");
  const del = document.getElementById("deleteSelectedInvoice");
  if (!panel || !status || !header || !lines) return;

  if (!invoice) {
    clearSelectedInvoice();
    return;
  }

  panel.classList.add("active");
  status.textContent = "Editing saved invoice";
  if (save) save.disabled = false;
  if (close) close.disabled = false;
  if (del) del.disabled = false;

  invoice.lineItems = cleanInvoiceItems(invoice.lineItems || []);

  const vendorOptions = state.vendors
    .map(vendor => `<option value="${esc(vendor.id)}"${vendor.id === invoice.vendorId ? " selected" : ""}>${esc(vendor.name)}</option>`)
    .join("");
  const categoryOptions = state.options.categories
    .map(category => `<option value="${esc(category)}"${category === invoice.category ? " selected" : ""}>${esc(category)}</option>`)
    .join("");
  const methodOptions = state.options.paymentMethods
    .map(method => `<option value="${esc(method)}"${method === invoice.method ? " selected" : ""}>${esc(method)}</option>`)
    .join("");

  header.innerHTML = `
    <div class="selected-invoice-edit-grid">
      <label>Vendor<select id="selectedInvoiceVendor"><option value="">Select vendor</option>${vendorOptions}</select></label>
      <label>Category<select id="selectedInvoiceCategory"><option value="">Select category</option>${categoryOptions}</select></label>
      <label>Invoice date<input id="selectedInvoiceDate" type="date" value="${esc(invoice.date || "")}"></label>
      <label>Invoice number<input id="selectedInvoiceNumber" value="${esc(invoice.number || "")}" placeholder="Invoice number"></label>
      <label>Total<input id="selectedInvoiceTotal" type="number" step="0.01" value="${esc(currencyValue(invoice.total) || "")}" placeholder="0.00"></label>
      <label>Payment method<select id="selectedInvoiceMethod"><option value="">Select payment method</option>${methodOptions}</select></label>
      <label>Manual profit margin %<input id="selectedInvoiceManualMargin" type="number" step="0.01" min="0" value="${esc(invoice.manualProfitMargin || "")}" placeholder="Category default ${esc(marginText(categoryMargin(invoice.category)))}"></label>
      <div class="selected-invoice-total"><span>Effective margin</span><strong>${esc(marginText(invoiceEffectiveMargin(invoice)))}</strong></div>
    </div>
  `;

  header.querySelectorAll("input, select").forEach(field => {
    field.addEventListener("input", () => { if (status) status.textContent = "Unsaved invoice detail changes"; });
    field.addEventListener("change", () => { if (status) status.textContent = "Unsaved invoice detail changes"; });
  });

  if (!invoice.lineItems.length) {
    lines.innerHTML = '<div class="status">No line items saved for this invoice. Click Add Line Item below.</div>';
  } else {
    lines.innerHTML = invoice.lineItems.map((item, index) => `
      <div class="selected-invoice-line" data-index="${index}">
        <input class="selected-line-description" value="${esc(item.description)}" placeholder="Item description">
        <select class="selected-line-category">${categoryOptions}</select>
        <input class="selected-line-total" type="number" step="0.01" value="${currencyValue(item.total) || ""}" placeholder="0.00">
        <button class="delete-button selected-line-delete" type="button" aria-label="Delete line">${iconSvg("trash")}</button>
      </div>
    `).join("");

    lines.querySelectorAll(".selected-invoice-line").forEach(row => {
      const index = Number(row.dataset.index);
      const category = row.querySelector(".selected-line-category");
      category.value = invoice.lineItems[index].category || "Other";

      row.querySelector(".selected-line-description").addEventListener("input", event => {
        invoice.lineItems[index].description = event.currentTarget.value;
      });
      category.addEventListener("change", event => {
        invoice.lineItems[index].category = event.currentTarget.value || "Other";
      });
      row.querySelector(".selected-line-total").addEventListener("input", event => {
        invoice.lineItems[index].total = currencyValue(event.currentTarget.value);
      });
      row.querySelector(".selected-line-delete").addEventListener("click", () => {
        invoice.lineItems.splice(index, 1);
        renderSelectedInvoice();
      });
    });
  }

  const addLine = document.createElement("button");
  addLine.className = "mini-button selected-add-line";
  addLine.type = "button";
  addLine.textContent = "Add Line Item";
  addLine.addEventListener("click", () => {
    invoice.lineItems.push({ description: "", quantity: "", unitPrice: 0, total: 0, category: "Other" });
    renderSelectedInvoice();
  });
  lines.append(addLine);
}

function saveSelectedInvoiceChanges() {
  const invoice = selectedInvoice();
  if (!invoice) return;
  const vendorField = document.getElementById("selectedInvoiceVendor");
  const categoryField = document.getElementById("selectedInvoiceCategory");
  const dateField = document.getElementById("selectedInvoiceDate");
  const numberField = document.getElementById("selectedInvoiceNumber");
  const totalField = document.getElementById("selectedInvoiceTotal");
  const methodField = document.getElementById("selectedInvoiceMethod");
  const marginField = document.getElementById("selectedInvoiceManualMargin");
  if (vendorField) invoice.vendorId = vendorField.value;
  if (categoryField) invoice.category = categoryField.value || invoice.category || "Other";
  if (dateField) invoice.date = dateField.value;
  if (numberField) invoice.number = numberField.value;
  if (methodField) invoice.method = methodField.value;
  if (marginField) invoice.manualProfitMargin = String(marginField.value || "").trim();
  invoice.lineItems = cleanInvoiceItems(invoice.lineItems || []);
  const lineTotal = invoice.lineItems.reduce((sum, item) => sum + currencyValue(item.total), 0);
  if (totalField && String(totalField.value).trim() !== "") invoice.total = String(currencyValue(totalField.value).toFixed(2));
  else if (lineTotal !== 0) invoice.total = String(lineTotal.toFixed(2));
  if (!invoice.category || invoice.category === "Other") invoice.category = topInvoiceCategory(invoice);
  invoice.categoryTotals = invoiceCategoryTotals([invoice]);
  const alerts = buildPriceAlertsForInvoice({ ...invoice, lineItems: invoice.lineItems });
  invoice.priceAlerts = alerts;
  state.priceAlerts = [...alerts, ...(state.priceAlerts || [])].slice(0, 100);
  saveState();
  renderAll();
  selectedInvoiceId = invoice.id;
  renderSelectedInvoice();
  renderPriceAlerts(alerts);
  const status = document.getElementById("selectedInvoiceStatus");
  if (status) status.textContent = "Changes saved";
}

function deleteSelectedInvoice() {
  const invoice = selectedInvoice();
  if (!invoice) return;
  const ok = window.confirm(`Delete invoice ${invoice.number || "blank"} from ${vendorName(invoice.vendorId)}?`);
  if (!ok) return;
  state.invoices = state.invoices.filter(item => item.id !== invoice.id);
  clearSelectedInvoice();
  renderAll();
}

function updateInvoiceReadActions() {
  const saveButton = document.getElementById("saveReadInvoice");
  const clearButton = document.getElementById("clearReadInvoice");
  if (!saveButton || !clearButton) return;

  const form = document.getElementById("invoiceForm");
  const hasReadInvoice = Boolean(lastInvoiceRead)
    || Boolean(form?.number?.value)
    || Boolean(form?.total?.value)
    || currentInvoiceItems.length > 0;

  saveButton.disabled = !hasReadInvoice;
  clearButton.disabled = !hasReadInvoice;
}

function clearCurrentInvoiceRead(message = "Read invoice cleared. Choose another invoice or enter details manually.") {
  const form = document.getElementById("invoiceForm");
  form.reset();
  lastInvoiceRead = null;
  currentInvoiceItems = [];
  document.getElementById("invoiceFile") && (document.getElementById("invoiceFile").value = "");
  document.getElementById("invoiceCameraFile") && (document.getElementById("invoiceCameraFile").value = "");
  document.getElementById("localInvoiceFile") && (document.getElementById("localInvoiceFile").value = "");
  document.getElementById("invoiceStatus").textContent = message;
  document.getElementById("invoicePreview").className = "invoice-preview empty";
  document.getElementById("invoicePreview").textContent = "No invoice read yet.";
  renderSelects();
  renderInvoiceLineEditor();
  updateInvoiceReadActions();
  updateCurrentInvoicePriceAlerts();
}

function renderOptionManager() {
  const groups = {
    vendorTypes: "vendorTypeOptions",
    employeeTypes: "employeeTypeOptions",
    payTypes: "payTypeOptions",
    paymentMethods: "paymentMethodOptions",
    categories: "categoryOptions",
    propertyExpenseTypes: "propertyExpenseTypeOptions",
    propertyVendorTypes: "propertyVendorTypeOptions"
  };

  Object.entries(groups).forEach(([kind, elementId]) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.innerHTML = "";
    (state.options[kind] || []).forEach(value => {
      const chip = document.createElement("div");
      chip.className = "option-chip";
      chip.innerHTML = `<span class="option-icon">${iconSvg("type")}</span><span>${value}</span>`;
      const button = document.createElement("button");
      button.type = "button";
      button.title = "Delete option";
      button.innerHTML = iconSvg("close");
      button.addEventListener("click", () => removeOption(kind, value));
      chip.append(button);
      element.append(chip);
    });
    if (!element.children.length) element.innerHTML = '<div class="status">No options yet.</div>';
  });
  renderCategoryMarginManager();
}

function renderCategoryMarginManager() {
  const element = document.getElementById("categoryMarginOptions");
  if (!element) return;
  const categories = state.options.categories || [];
  if (!categories.length) {
    element.innerHTML = '<div class="status">Add invoice categories first, then enter margin % for each category.</div>';
    return;
  }
  element.innerHTML = categories.map(category => `
    <div class="category-margin-row" data-category="${esc(category)}">
      <strong>${esc(category)}</strong>
      <label>Manual profit margin %<input class="category-margin-input" type="number" step="0.01" min="0" value="${esc((state.categoryMargins || {})[category] || "")}" placeholder="ex: 30"></label>
    </div>
  `).join("");
  element.querySelectorAll(".category-margin-input").forEach(input => {
    input.addEventListener("change", event => {
      const category = event.currentTarget.closest(".category-margin-row")?.dataset.category || "Other";
      state.categoryMargins = state.categoryMargins || {};
      const value = String(event.currentTarget.value || "").trim();
      if (value) state.categoryMargins[category] = value;
      else delete state.categoryMargins[category];
      saveState();
      renderAll();
    });
  });
}


function dateInRange(value, start, end) {
  if (!value) return false;
  return (!start || value >= start) && (!end || value <= end);
}

function getCashDashboardRange() {
  return {
    start: document.getElementById("cashStartDate")?.value || "",
    end: document.getElementById("cashEndDate")?.value || ""
  };
}

function setCashDashboardRange(kind) {
  const start = document.getElementById("cashStartDate");
  const end = document.getElementById("cashEndDate");
  if (!start || !end) return;
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (kind === "all") {
    start.value = "";
    end.value = "";
  } else if (kind === "today") {
    start.value = today;
    end.value = today;
  } else if (kind === "week") {
    const from = new Date(date);
    from.setDate(date.getDate() - date.getDay());
    start.value = toDateInput(from);
    end.value = today;
  } else if (kind === "month") {
    start.value = toDateInput(new Date(date.getFullYear(), date.getMonth(), 1));
    end.value = today;
  }
  renderAll();
}

function cashCollectionMeta(entry) {
  return `${entry.date || "No date"} • ${money.format(currencyValue(entry.amount))}${entry.note ? ` • ${entry.note}` : ""}`;
}

function renderCashCollections(cashItems, cashPayroll, cashExpenses, cashBalance) {
  const count = document.getElementById("cashCollectionCount");
  if (count) count.textContent = `${cashItems.length} entries`;

  const summary = document.getElementById("cashBalanceSummary");
  if (summary) {
    summary.innerHTML = "";
    summary.append(
      summaryCard("Toast Cash Collected", money.format(cashItems.reduce((sum, item) => sum + currencyValue(item.amount), 0)), "green"),
      summaryCard("Cash Payroll", money.format(cashPayroll), "orange"),
      summaryCard("Cash Expenses", money.format(cashExpenses), "pink"),
      summaryCard("Leftover Balance", money.format(cashBalance), cashBalance < 0 ? "orange" : "blue")
    );
  }

  const rows = cashItems
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .map(entry => rowItem(
      money.format(currencyValue(entry.amount)),
      cashCollectionMeta(entry),
      () => removeById("cashCollections", entry.id),
      "payroll"
    ));
  renderList("cashCollectionList", rows, "No cash collected entries for this range.");
}


function normalizeItemName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(each|case|cs|lb|lbs|oz|gal|ct|pack|pkg|fresh|frozen|dry)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);
}

function itemComparablePrice(item) {
  return normalizeInvoiceUnitPrice(item);
}

function isPriceAlertComparable(currentPrice, baselinePrice) {
  if (currentPrice <= 0 || baselinePrice <= 0) return false;
  const ratio = currentPrice / baselinePrice;
  // Suppress line-total-vs-unit mismatches and impossible parse jumps.
  if (ratio > 3 || ratio < 0.25) return false;
  if (Math.abs(currentPrice - baselinePrice) < 0.05) return false;
  return true;
}

function dateMinusMonths(dateValue, months) {
  const baseDate = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  baseDate.setMonth(baseDate.getMonth() - months);
  return toDateInput(baseDate);
}

function findPriorInvoiceItems(description, invoiceDate) {
  const key = normalizeItemName(description);
  if (!key) return [];
  const endDate = invoiceDate || today;
  const startDate = dateMinusMonths(endDate, 3);
  const matches = [];

  state.invoices.forEach(invoice => {
    const date = invoice.date || "";
    if (!date || date >= endDate || date < startDate) return;
    cleanInvoiceItems(invoice.lineItems).forEach(item => {
      const itemKey = normalizeItemName(item.description);
      if (!itemKey) return;
      if (!(itemKey === key || itemKey.includes(key) || key.includes(itemKey))) return;
      const price = itemComparablePrice(item);
      if (price > 0) {
        matches.push({
          description: item.description,
          date,
          invoiceNumber: invoice.number || "",
          vendor: vendorName(invoice.vendorId),
          price
        });
      }
    });
  });
  return matches.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function buildPriceAlertsForInvoice(invoiceDraft) {
  const invoiceDate = invoiceDraft.date || invoiceDraft.invoiceDate || today;
  const lineItems = cleanInvoiceItems(invoiceDraft.lineItems || currentInvoiceItems);
  const alerts = [];

  lineItems.forEach(item => {
    const currentPrice = itemComparablePrice(item);
    if (!item.description || currentPrice <= 0) return;
    const history = findPriorInvoiceItems(item.description, invoiceDate);
    if (!history.length) return;
    const last = history[0];
    const avg = history.reduce((sum, entry) => sum + entry.price, 0) / history.length;
    const baseline = last.price || avg;
    if (!isPriceAlertComparable(currentPrice, baseline)) return;
    const increase = currentPrice - baseline;
    const percent = baseline > 0 ? (increase / baseline) * 100 : 0;

    // Only show meaningful price increases. Small day-to-day invoice noise is hidden.
    if (increase > 0 && percent >= 10) {
      alerts.push({
        id: uid("price-alert"),
        date: invoiceDate,
        item: item.description,
        currentPrice,
        previousPrice: baseline,
        averagePrice: avg,
        percent,
        previousDate: last.date,
        previousVendor: last.vendor,
        invoiceNumber: invoiceDraft.number || invoiceDraft.invoiceNumber || "",
        category: item.category || "Other"
      });
    }
  });
  return alerts.sort((a, b) => b.percent - a.percent).slice(0, 20);
}

function priceAlertRow(alert) {
  const row = document.createElement("div");
  const increaseAmount = currencyValue(alert.currentPrice) - currencyValue(alert.previousPrice);
  const increaseClass = alert.percent >= 20 ? "high" : alert.percent >= 10 ? "medium" : "low";

  row.className = `price-alert-row price-alert-${increaseClass}`;
  row.innerHTML = `
    <div class="price-alert-main">
      <strong>${esc(alert.item)}</strong>
      <small>${esc(alert.category || "Other")}</small>
    </div>

    <div class="price-alert-cell current">
      <span>Current unit</span>
      <small>${esc(alert.date || today)}</small>
      <strong>${money.format(currencyValue(alert.currentPrice))}</strong>
    </div>

    <div class="price-alert-cell previous">
      <span>Previous unit</span>
      <small>${esc(alert.previousDate || "No date")}</small>
      <strong>${money.format(currencyValue(alert.previousPrice))}</strong>
    </div>

    <div class="price-alert-cell increase">
      <span>Increase</span>
      <small>${money.format(Math.max(0, increaseAmount))}</small>
      <strong>+${Math.round(alert.percent)}%</strong>
    </div>
  `;
  return row;
}

function renderPriceAlerts(alerts = state.priceAlerts || []) {
  const element = document.getElementById("priceAlertList");
  const count = document.getElementById("priceAlertCount");
  if (count) count.textContent = `${alerts.length} alerts`;
  if (!element) return;
  element.innerHTML = "";
  if (!alerts.length) {
    element.innerHTML = '<div class="status">No price increases found in the last 3 months.</div>';
    return;
  }
  alerts.slice(0, 12).forEach(alert => element.append(priceAlertRow(alert)));
}

function updateCurrentInvoicePriceAlerts() {
  const form = document.getElementById("invoiceForm");
  if (!form) return [];
  const alerts = buildPriceAlertsForInvoice({
    date: form.date?.value || today,
    number: form.number?.value || "",
    lineItems: currentInvoiceItems
  });
  renderPriceAlerts(alerts);
  return alerts;
}



function categoryColorClass(category) {
  const key = String(category || "Other").toLowerCase();
  if (key.includes("food")) return "cat-food";
  if (key.includes("suppl")) return "cat-supplies";
  if (key.includes("util")) return "cat-utilities";
  if (key.includes("clean")) return "cat-cleaning";
  if (key.includes("beverage")) return "cat-beverage";
  if (key.includes("pack")) return "cat-packaging";
  if (key.includes("maintenance")) return "cat-maintenance";
  if (key.includes("equipment")) return "cat-equipment";
  return "cat-other";
}

function payrollCategory(entry) {
  const isEmployee = String(entry.personId || "").startsWith("employee:");
  if (isEmployee) return String(entry.method || "").toLowerCase() === "check" ? "Check Payroll" : "Cash Payroll";
  const vendorId = String(entry.personId || "").split(":")[1];
  const vendor = state.vendors.find(item => item.id === vendorId);
  return vendor?.category || entry.category || entry.type || "Vendor Payments";
}

function readableCategory(value) {
  const text = String(value || "").trim();
  return text || "Other";
}


function accountingExpenseCategory(value, source = "") {
  const raw = String(value || "").trim();
  const key = raw.toLowerCase();

  if (!key) return "Other";
  if (key.includes("food")) return "Food";
  if (key.includes("beverage") || key.includes("drink")) return "Beverage";
  if (key.includes("suppl")) return "Supplies";
  if (key.includes("pack")) return "Packaging";
  if (key.includes("util") || key.includes("gas") || key.includes("electric") || key.includes("water") || key.includes("garbage")) return "Utilities";
  if (key.includes("insurance")) return "Insurance";
  if (key.includes("mortgage") || key.includes("loan") || key.includes("bank")) return "Mortgage & Loans";
  if (key.includes("repair") || key.includes("maintenance")) return "Repairs & Maintenance";
  if (key.includes("rent") || key.includes("property")) return source === "property" ? "Other Property" : "Property Expenses";
  if (key.includes("cash payroll") || key.includes("cash salary")) return "Cash Payroll";
  if (key.includes("check payroll") || key.includes("salary") || key.includes("tips") || key.includes("payroll")) return "Check Payroll";
  return raw;
}

function categoryDisplayOrder(category) {
  const order = [
    "Food",
    "Beverage",
    "Supplies",
    "Packaging",
    "Utilities",
    "Insurance",
    "Repairs & Maintenance",
    "Mortgage & Loans",
    "Property Expenses",
    "Other Property",
    "Check Payroll",
    "Cash Payroll",
    "Vendor Payments",
    "Other"
  ];
  const index = order.indexOf(category);
  return index === -1 ? 999 : index;
}

function sortedAccountingRows(totals) {
  return Object.entries(totals || {})
    .map(([category, amount]) => [accountingExpenseCategory(category), currencyValue(amount)])
    .filter(([, amount]) => amount !== 0)
    .sort((a, b) => {
      const orderDiff = categoryDisplayOrder(a[0]) - categoryDisplayOrder(b[0]);
      return orderDiff || b[1] - a[1] || String(a[0]).localeCompare(String(b[0]));
    });
}

function methodOf(record) {
  return String(record?.method || record?.paymentMethod || record?.paymentType || "").trim();
}

function payrollCategory(entry) {
  const isEmployee = String(entry.personId || "").startsWith("employee:");
  const method = methodOf(entry).toLowerCase();
  if (isEmployee) return method === "cash" ? "Cash Payroll" : "Check Payroll";
  const vendorId = String(entry.personId || "").split(":")[1];
  const vendor = state.vendors.find(item => item.id === vendorId);
  return accountingExpenseCategory(entry.category || vendor?.category || entry.type || "Vendor Payments");
}

function categorySourceRows(invoices = state.invoices, payroll = state.payroll, propertyExpenses = state.propertyExpenses || []) {
  const rows = [];
  const syncedToastIds = new Set((payroll || []).map(entry => entry.sourceToastPayrollId).filter(Boolean));
  (state.toastPayroll || []).forEach(item => {
    if (syncedToastIds.has(item.id)) return;
    const amount = toastPayrollFinalTotal(item);
    if (amount <= 0) return;
    rows.push({
      category: toastPayrollDefaultPaymentMethod(item).toLowerCase() === "cash" ? "Cash Payroll" : "Check Payroll",
      title: `Toast Tips: ${item.employee || "Employee"}`,
      meta: `${item.date || "No date"} • ${item.jobTitle || "Toast employee"} • ${toastPayrollDefaultPaymentMethod(item)} • Toast Employee Sales & Tips`,
      amount
    });
  });
  invoices.forEach(invoice => {
    const vendor = vendorName(invoice.vendorId);
    const invoiceMethod = methodOf(invoice) || "Invoice";
    const lineEntries = invoiceCategoryEntries(invoice).filter(line => currencyValue(line.total) !== 0);
    if (lineEntries.length) {
      lineEntries.forEach(line => rows.push({
        category: accountingExpenseCategory(line.category || invoice.category, "invoice"),
        title: `Invoice: ${vendor}`,
        meta: `${invoice.date || "No date"} • ${readableCategory(line.category || invoice.category)} • ${invoice.number || "No invoice #"} • ${invoiceMethod} • Margin ${marginText(invoiceEffectiveMargin(invoice))}`,
        amount: currencyValue(line.total)
      }));
    } else if (currencyValue(invoice.total) !== 0) {
      rows.push({
        category: accountingExpenseCategory(invoice.category, "invoice"),
        title: `Invoice: ${vendor}`,
        meta: `${invoice.date || "No date"} • ${readableCategory(invoice.category)} • ${invoice.number || "No invoice #"} • ${invoiceMethod} • Margin ${marginText(invoiceEffectiveMargin(invoice))}`,
        amount: currencyValue(invoice.total)
      });
    }
  });

  (state.propertyExpenses || []).forEach(expense => {
    const amount = currencyValue(expense.amount);
    if (amount === 0) return;
    rows.push({
      category: accountingExpenseCategory(expense.category || expense.type || "Property Expense", "property"),
      title: `Property Expense: ${expense.payee || expense.property || expense.type || "Property"}`,
      meta: `${expense.date || "No date"} • ${readableCategory(expense.type || expense.category || "Property Expense")} • ${expense.reference || "No ref"} • ${expense.method || "Check"}`,
      amount
    });
  });
  payroll.forEach(entry => {
    const amount = payrollFinalCheckAmount(entry);
    if (amount <= 0) return;
    const category = payrollCategory(entry);
    rows.push({
      category,
      title: `Payroll: ${personName(entry.personId)}`,
      meta: `${entry.date || "No date"} • ${category} • ${methodOf(entry) || "Check"}`,
      amount
    });
  });
  return rows;
}

function categoryRowDedupeKey(row) {
  const category = accountingExpenseCategory(row.category || "Other");
  const amount = currencyValue(row.amount).toFixed(2);
  const date = String(row.meta || "").match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
  const title = String(row.title || "")
    .replace(/^Invoice:\s*/i, "")
    .replace(/^Property Expense:\s*/i, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();

  // Use normalized vendor/payee + date + amount + accounting category.
  // This avoids counting the same insurance/mortgage/property bill twice
  // when it was entered once as an invoice and once as property expense.
  return `${category}|${date}|${amount}|${title}`;
}

function allCategorySpendingTotals(invoices = state.invoices, payroll = state.payroll) {
  const totals = {};
  const seen = new Set();

  categorySourceRows(invoices, payroll).forEach(row => {
    const category = accountingExpenseCategory(row.category || "Other");
    const key = categoryRowDedupeKey(row);

    // Prevent common duplicate entry problem where the same insurance/mortgage/property bill
    // exists once as an invoice and once as a property expense.
    if (seen.has(key)) return;
    seen.add(key);

    totals[category] = (totals[category] || 0) + currencyValue(row.amount);
  });
  return totals;
}

function categoryDetailRows(category) {
  const wanted = accountingExpenseCategory(category || "").toLowerCase();
  const seen = new Set();
  return categorySourceRows()
    .filter(row => !wanted || accountingExpenseCategory(row.category || "").toLowerCase() === wanted)
    .filter(row => {
      const key = categoryRowDedupeKey(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(row => detailRow(row.title, row.meta, row.amount));
}

function ensureDashboardReportModal() {
  let modal = document.getElementById("dashboardReportModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "dashboardReportModal";
  modal.className = "dashboard-report-modal";
  modal.innerHTML = `
    <div class="dashboard-report-card">
      <button type="button" class="icon-button dashboard-report-close" aria-label="Close report">${iconSvg("close")}</button>
      <div class="panel-head"><h2 id="dashboardReportModalTitle">Card report</h2><span class="pill" id="dashboardReportModalTotal">$0.00</span></div>
      <div id="dashboardReportModalList" class="data-list dashboard-detail-list"></div>
    </div>`;
  document.body.append(modal);
  modal.addEventListener("click", event => {
    if (event.target === modal || event.target.closest(".dashboard-report-close")) modal.classList.remove("open");
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") modal.classList.remove("open"); });
  return modal;
}

function cloneDetailRows(rows) {
  return (rows || []).map(row => row.cloneNode(true));
}

function showDashboardDetails(title, total, rows) {
  const titleEl = document.getElementById("dashboardDetailTitle");
  const totalEl = document.getElementById("dashboardDetailTotal");
  const list = document.getElementById("dashboardDetailList");
  const panel = document.getElementById("dashboardDetailPanel");
  const safeRows = rows || [];
  if (titleEl && totalEl && list) {
    titleEl.textContent = title;
    totalEl.textContent = total;
    list.innerHTML = "";
    if (!safeRows.length) {
      list.innerHTML = '<div class="status">No line items found for this total yet.</div>';
    } else {
      cloneDetailRows(safeRows).forEach(row => list.append(row));
    }
    if (panel) panel.classList.add("has-report");
  }
  const modal = ensureDashboardReportModal();
  const modalTitle = document.getElementById("dashboardReportModalTitle");
  const modalTotal = document.getElementById("dashboardReportModalTotal");
  const modalList = document.getElementById("dashboardReportModalList");
  if (modalTitle) modalTitle.textContent = title;
  if (modalTotal) modalTotal.textContent = total;
  if (modalList) {
    modalList.innerHTML = "";
    if (!safeRows.length) modalList.innerHTML = '<div class="status">No line items found for this total yet.</div>';
    else cloneDetailRows(safeRows).forEach(row => modalList.append(row));
  }
  modal.classList.add("open");
}


function dashboardRowsForMetric(key) {
  const payrollEmployeeRows = state.payroll
    .filter(entry => String(entry.personId || "").startsWith("employee:"))
    .map(entry => detailRow(personName(entry.personId), `${entry.date || "No date"} • ${methodOf(entry) || "Check"} • ${entry.type || "Payroll"}`, payrollFinalCheckAmount(entry)));
  const payrollVendorRows = state.payroll
    .filter(entry => String(entry.personId || "").startsWith("vendor:"))
    .map(entry => detailRow(personName(entry.personId), `${entry.date || "No date"} • ${methodOf(entry) || "Check"} • ${entry.type || "Vendor payment"}`, payrollFinalCheckAmount(entry)));
  const invoiceRows = state.invoices.map(invoice => detailRow(vendorName(invoice.vendorId), `${invoice.date || "No date"} • ${readableCategory(invoice.category || topInvoiceCategory(invoice))} • ${invoice.number || "No invoice #"} • Margin ${marginText(invoiceEffectiveMargin(invoice))}`, currencyValue(invoice.total)));
  const propertyRows = (state.propertyExpenses || []).map(expense => detailRow(expense.vendorName || expense.payee || expense.property || expense.type || "Property Expense", `${expense.date || "No date"} • ${readableCategory(expense.category || expense.type || "Property Expense")} • ${expense.reference || "No ref"} • ${expense.method || "Check"}`, currencyValue(expense.amount)));
  const checkPayrollRows = state.payroll
    .filter(entry => methodOf(entry).toLowerCase() !== "cash")
    .map(entry => detailRow(personName(entry.personId), `${entry.date || "No date"} • Check • ${entry.type || "Payroll"}`, payrollFinalCheckAmount(entry)));
  const cashPayrollRows = state.payroll
    .filter(entry => String(entry.personId || "").startsWith("employee:") && methodOf(entry).toLowerCase() === "cash")
    .map(entry => detailRow(personName(entry.personId), `${entry.date || "No date"} • Cash payroll`, payrollFinalCheckAmount(entry)));
  const cashExpenseRows = [
    ...state.payroll.filter(entry => String(entry.personId || "").startsWith("vendor:") && methodOf(entry).toLowerCase() === "cash")
      .map(entry => detailRow(personName(entry.personId), `${entry.date || "No date"} • Cash vendor payment`, payrollFinalCheckAmount(entry))),
    ...state.invoices.filter(invoice => methodOf(invoice).toLowerCase() === "cash")
      .map(invoice => detailRow(vendorName(invoice.vendorId), `${invoice.date || "No date"} • Cash invoice`, currencyValue(invoice.total))),
    ...(state.propertyExpenses || []).filter(expense => methodOf(expense).toLowerCase() === "cash")
      .map(expense => detailRow(expense.payee || expense.type || "Property Expense", `${expense.date || "No date"} • Cash property expense`, currencyValue(expense.amount)))
  ];
  const tipRows = state.payroll
    .filter(entry => waiterTipDeduction(entry) > 0)
    .map(entry => detailRow(personName(entry.personId), `${entry.date || "No date"} • Waiter tip deduction`, waiterTipDeduction(entry)));
  const cashRows = (cashReportData(...Object.values(getCashDashboardRange())).cashCollections || [])
    .map(item => detailRow(item.date || "Toast cash", `${item.source || "Toast actual closeout"}`, currencyValue(item.amount || item.cashCollected || item.cashSales)));
  const categoryRows = categoryDetailRows();

  const groups = {
    payroll: payrollEmployeeRows,
    vendorPayments: [...payrollVendorRows, ...invoiceRows],
    invoiceSpending: [...invoiceRows, ...propertyRows],
    checkPayroll: checkPayrollRows,
    tipDeduction: tipRows,
    actualCash: cashRows,
    cashPayroll: cashPayrollRows,
    cashExpenses: cashExpenseRows,
    foodCost: categoryRows.filter(row => row.textContent.toLowerCase().includes("food"))
  };
  groups.totalSpend = [...payrollEmployeeRows, ...payrollVendorRows, ...invoiceRows, ...propertyRows];
  groups.leftoverCash = [...cashRows, ...cashPayrollRows, ...cashExpenseRows];
  return groups[key] || [];
}

function attachDashboardMetricActions() {
  const grid = document.getElementById("dashboardMetricGrid");
  if (!grid) return;
  grid.querySelectorAll(".metric[data-metric-key]").forEach(card => card.setAttribute("draggable", "false"));
  if (grid.dataset.clickReady === "1") return;
  grid.dataset.clickReady = "1";
  const openCardReport = card => {
    if (!card || !grid.contains(card)) return;
    if (card.dataset.wasDragged === "1" || Date.now() - Number(grid.dataset.lastDragTime || 0) < 180) return;
    document.querySelectorAll(".metric[data-metric-key]").forEach(c => c.classList.remove("selected-detail-card"));
    card.classList.add("selected-detail-card");
    showDashboardDetails(card.querySelector("span")?.textContent || "Card details", card.querySelector("strong")?.textContent || "$0.00", dashboardRowsForMetric(card.dataset.metricKey));
  };
  grid.addEventListener("click", event => {
    const card = event.target.closest(".metric[data-metric-key]");
    openCardReport(card);
  });
  grid.addEventListener("pointerup", event => {
    const card = event.target.closest(".metric[data-metric-key]");
    setTimeout(() => openCardReport(card), 0);
  });
  grid.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".metric[data-metric-key]");
    if (!card) return;
    event.preventDefault();
    card.click();
  });
  grid.querySelectorAll(".metric[data-metric-key]").forEach(card => {
    card.tabIndex = 0;
    card.role = "button";
    card.title = "Click for line-wise details. Drag to move.";
  });
}

function renderDashboardCategorySpending(categoryTotals, invoiceTotal) {
  const totalElement = document.getElementById("dashboardCategoryTotal");
  const cards = document.getElementById("dashboardCategorySpendingCards");
  if (!cards) return;
  const fullCategoryTotals = Object.keys(categoryTotals || {}).length ? categoryTotals : allCategorySpendingTotals(state.invoices, state.payroll);
  const rows = sortedAccountingRows(fullCategoryTotals);
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  if (totalElement) totalElement.textContent = money.format(total);

  cards.innerHTML = "";
  if (!rows.length) {
    cards.innerHTML = '<div class="status">No category spending yet. Add payroll, vendor payments, or invoices with totals/categories.</div>';
    return;
  }

  const table = document.createElement("div");
  table.className = "expense-breakdown-table";
  table.innerHTML = `
    <div class="expense-breakdown-header">
      <span>Category</span>
      <span>Amount</span>
    </div>
  `;

  rows.forEach(([category, amount]) => {
    const percent = total ? Math.round((amount / total) * 100) : 0;
    const row = document.createElement("button");
    row.type = "button";
    row.className = `expense-breakdown-row ${categoryColorClass(category)}`;
    row.innerHTML = `
      <span class="expense-breakdown-name">${esc(category)}</span>
      <span class="expense-breakdown-value">${money.format(amount)}</span>
      <span class="expense-breakdown-percent">${percent}%</span>
    `;
    row.addEventListener("click", () => showDashboardDetails(`${category} Details`, money.format(amount), categoryDetailRows(category)));
    table.append(row);
  });

  cards.append(table);

  const panel = document.querySelector(".dashboard-category-panel");
  if (panel && panel.dataset.categoryClickReady !== "1") {
    panel.dataset.categoryClickReady = "1";
    panel.addEventListener("click", event => {
      if (event.target.closest(".expense-breakdown-row")) return;
      showDashboardDetails("Expense Breakdown", money.format(total), categoryDetailRows());
    });
  }
}

function salesInRange(start = "", end = "") {
  return state.sales.filter(item => dateInRange(item.date, start, end));
}

function salesTotals(items = state.sales) {
  return items.reduce((totals, item) => {
    totals.grossSales += currencyValue(item.grossSales);
    totals.netSales += currencyValue(item.netSales);
    totals.cashSales += currencyValue(item.cashSales);
    totals.cashCollected += toastCashCollectedAmount(item);
    totals.cardSales += currencyValue(item.cardSales);
    totals.otherSales += currencyValue(item.otherSales);
    totals.doorDashSales += currencyValue(item.doorDashSales);
    totals.uberEatsSales += currencyValue(item.uberEatsSales);
    totals.grubhubSales += currencyValue(item.grubhubSales);
    totals.giftCardSales += currencyValue(item.giftCardSales);
    totals.tax += currencyValue(item.tax);
    totals.guests += currencyValue(item.guests);
    totals.checks += currencyValue(item.checks);
    totals.discounts += currencyValue(item.discounts);
    totals.refunds += currencyValue(item.refunds);
    totals.tips += currencyValue(item.tips);
    return totals;
  }, {
    grossSales: 0,
    netSales: 0,
    cashSales: 0,
    cashCollected: 0,
    cashCollected: 0,
    cardSales: 0,
    discounts: 0,
    refunds: 0,
    tips: 0,
    tax: 0,
    guests: 0,
    checks: 0,
    otherSales: 0,
    doorDashSales: 0,
    uberEatsSales: 0,
    grubhubSales: 0,
    giftCardSales: 0
  });
}

function expenseTotalsForRange(start = "", end = "") {
  const payrollItems = state.payroll.filter(item => dateInRange(item.date, start, end));
  const invoiceItems = state.invoices.filter(item => dateInRange(item.date, start, end));
  const propertyExpenseItems = (state.propertyExpenses || []).filter(item => dateInRange(item.date, start, end));

  const rows = categorySourceRows(invoiceItems, payrollItems, propertyExpenseItems);
  const seen = new Set();
  const dedupedRows = rows.filter(row => {
    const key = categoryRowDedupeKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const categoryTotals = {};
  dedupedRows.forEach(row => {
    const category = accountingExpenseCategory(row.category || "Other");
    categoryTotals[category] = (categoryTotals[category] || 0) + currencyValue(row.amount);
  });

  const payrollTotal = dedupedRows
    .filter(row => ["Check Payroll", "Cash Payroll"].includes(accountingExpenseCategory(row.category || "")))
    .reduce((sum, row) => sum + currencyValue(row.amount), 0);

  const employeePayroll = payrollTotal;
  const cashPayroll = currencyValue(categoryTotals["Cash Payroll"]);
  const checkPayroll = currencyValue(categoryTotals["Check Payroll"]);
  const invoiceTotal = dedupedRows
    .filter(row => String(row.title || "").startsWith("Invoice:"))
    .reduce((sum, row) => sum + currencyValue(row.amount), 0);
  const propertyExpenseTotal = dedupedRows
    .filter(row => String(row.title || "").startsWith("Property Expense:"))
    .reduce((sum, row) => sum + currencyValue(row.amount), 0);
  const vendorPayroll = dedupedRows
    .filter(row => accountingExpenseCategory(row.category || "") === "Vendor Payments")
    .reduce((sum, row) => sum + currencyValue(row.amount), 0);

  const foodCost = currencyValue(categoryTotals.Food);
  const totalExpenses = dedupedRows.reduce((sum, row) => sum + currencyValue(row.amount), 0);

  return {
    payrollItems,
    invoiceItems,
    propertyExpenseItems,
    propertyExpenseTotal,
    payrollTotal,
    employeePayroll,
    cashPayroll,
    checkPayroll,
    vendorPayroll,
    invoiceTotal,
    vendorCost: vendorPayroll + invoiceTotal + propertyExpenseTotal,
    totalExpenses,
    foodCost,
    categoryTotals,
    expenseRows: dedupedRows
  };
}

function profitSnapshot(start = "", end = "") {
  const sales = salesTotals(salesInRange(start, end));
  const expenses = expenseTotalsForRange(start, end);
  const netProfit = sales.netSales - expenses.totalExpenses;
  const profitMargin = sales.netSales ? (netProfit / sales.netSales) * 100 : 0;
  const laborPercent = sales.netSales ? (expenses.employeePayroll / sales.netSales) * 100 : 0;
  const foodPercent = sales.netSales ? (expenses.foodCost / sales.netSales) * 100 : 0;
  const primeCostPercent = sales.netSales ? ((expenses.employeePayroll + expenses.foodCost) / sales.netSales) * 100 : 0;

  return {
    sales,
    expenses,
    netProfit,
    profitMargin,
    laborPercent,
    foodPercent,
    primeCostPercent
  };
}

function percentText(value) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}


function safeSetValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}


function refreshAfterToastImport() {
  saveState();
  try { renderSelects(); } catch (error) { console.warn("Skipped select refresh:", error); }
  try { renderPayroll(); } catch (error) { console.warn("Skipped payroll refresh:", error); }
  try { renderToastPayroll(); } catch (error) { console.warn("Skipped Toast payroll refresh:", error); }
  try { renderSales(); } catch (error) { console.warn("Skipped sales refresh:", error); }
  try { renderDashboard(); } catch (error) { console.warn("Skipped dashboard refresh:", error); }
  try { renderPriceAlerts();
  renderDashboardCardManager();
  renderCustomDashboardCards();
  applyDashboardCardVisibility(); } catch (error) { console.warn("Skipped price alert refresh:", error); }
}

function setToastImportStatus(message) {
  const status = document.getElementById("toastImportStatus");
  if (status) status.textContent = message;
  console.log(message);
}

function setToastPayrollImportStatus(message) {
  const status = document.getElementById("toastPayrollImportStatus");
  if (status) status.textContent = message;
  console.log(message);
}

function excelDateNumberToInput(value) {
  const raw = String(value || "").replace(/[^0-9]/g, "");
  if (raw.length >= 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return "";
}

function parseToastDateRangeFromName(name) {
  const match = String(name || "").match(/(20\d{2})[-_](\d{2})[-_](\d{2}).*(20\d{2})[-_](\d{2})[-_](\d{2})/);
  if (!match) return { start: "", end: today };
  return {
    start: `${match[1]}-${match[2]}-${match[3]}`,
    end: `${match[4]}-${match[5]}-${match[6]}`
  };
}

function readWorkbookRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
}

function findToastDailyRows(workbook) {
  const daily = [];
  workbook.SheetNames.forEach(sheetName => {
    const rows = readWorkbookRows(workbook, sheetName);
    rows.forEach(row => {
      const date = excelDateNumberToInput(row[0]);
      const netSales = currencyValue(row[1]);
      const checks = currencyValue(row[2]);
      const guests = currencyValue(row[3]);
      if (date && netSales > 0) {
        daily.push({
          date,
          grossSales: netSales,
          netSales,
          cashSales: 0,
          cardSales: 0,
          discounts: 0,
          refunds: 0,
          tips: 0,
          tax: 0,
          guests,
          checks,
          source: "Toast Sales Excel"
        });
      }
    });
  });

  const unique = {};
  daily.forEach(item => {
    unique[item.date] = item;
  });
  return Object.values(unique).sort((a, b) => a.date.localeCompare(b.date));
}



function findToastLabeledAmount(workbook, labelPatterns) {
  if (!window.XLSX || !workbook?.Sheets) return 0;
  const patterns = labelPatterns.map(pattern => pattern instanceof RegExp ? pattern : new RegExp(String(pattern), "i"));

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "" });
    for (const row of rows) {
      for (let i = 0; i < row.length; i += 1) {
        const text = String(row[i] || "").trim();
        if (!text) continue;
        if (patterns.some(pattern => pattern.test(text))) {
          for (let j = i + 1; j < row.length; j += 1) {
            const amount = currencyValue(row[j]);
            if (amount !== 0) return amount;
          }
          // Some Toast files put label in one cell and amount in first numeric cell on same row, including before label.
          for (let j = 0; j < row.length; j += 1) {
            if (j === i) continue;
            const amount = currencyValue(row[j]);
            if (amount !== 0) return amount;
          }
        }
      }
    }
  }

  return 0;
}

function toastCashCollectedFromWorkbook(workbook, fallbackCashSales = 0) {
  const exact = findToastLabeledAmount(workbook, [
    /^cash collected$/i,
    /cash\s+collected/i,
    /^cash collected amount$/i
  ]);
  return exact || fallbackCashSales;
}

function toastSheetName(workbook, exactName, fallbackPattern = null) {
  if (!workbook?.SheetNames?.length) return "";
  const exact = workbook.SheetNames.find(name => String(name).trim().toLowerCase() === String(exactName || "").trim().toLowerCase());
  if (exact) return exact;
  if (fallbackPattern) return workbook.SheetNames.find(name => fallbackPattern.test(String(name))) || "";
  return "";
}

function normalizeToastHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toastHeaderIndex(headerRow, labels) {
  const wanted = (Array.isArray(labels) ? labels : [labels]).map(normalizeToastHeader);
  return (headerRow || []).findIndex(cell => wanted.includes(normalizeToastHeader(cell)));
}

function toastSheetRows(workbook, exactName, fallbackPattern = null) {
  const sheetName = toastSheetName(workbook, exactName, fallbackPattern);
  return sheetName ? readWorkbookRows(workbook, sheetName) : [];
}

function toastSingleRowValues(workbook, exactName, fallbackPattern = null) {
  const rows = toastSheetRows(workbook, exactName, fallbackPattern);
  if (!rows.length) return {};
  const headers = rows[0] || [];
  const data = rows.find((row, index) => index > 0 && row.some(cell => String(cell || "").trim() !== "")) || [];
  return headers.reduce((values, header, index) => {
    const key = normalizeToastHeader(header);
    if (key) values[key] = data[index];
    return values;
  }, {});
}

function toastValue(values, labels) {
  const wanted = Array.isArray(labels) ? labels : [labels];
  for (const label of wanted) {
    const key = normalizeToastHeader(label);
    if (Object.prototype.hasOwnProperty.call(values, key)) return currencyValue(values[key]);
  }
  return 0;
}

function toastPaymentSummaryRows(workbook) {
  if (!window.XLSX || !workbook?.Sheets) return [];
  const rows = toastSheetRows(workbook, "Payments summary", /payment/i);
  if (!rows.length) return [];
  const header = rows[0] || [];
  const indexes = {
    type: toastHeaderIndex(header, "Payment type"),
    subType: toastHeaderIndex(header, "Payment sub type"),
    count: toastHeaderIndex(header, "Count"),
    amount: toastHeaderIndex(header, "Amount"),
    tips: toastHeaderIndex(header, "Tips"),
    gratuity: toastHeaderIndex(header, ["Grat", "Gratuity"]),
    tax: toastHeaderIndex(header, "Tax amount"),
    refunds: toastHeaderIndex(header, "Refunds"),
    tipRefunds: toastHeaderIndex(header, "Tip refunds"),
    legacyTips: toastHeaderIndex(header, "Legacy tips"),
    total: toastHeaderIndex(header, "Total")
  };

  return rows.slice(1)
    .map(row => ({
      type: String(row[indexes.type] || "").trim(),
      subType: String(row[indexes.subType] || "").trim(),
      count: currencyValue(row[indexes.count]),
      amount: currencyValue(row[indexes.amount]),
      tips: currencyValue(row[indexes.tips]),
      gratuity: currencyValue(row[indexes.gratuity]),
      tax: currencyValue(row[indexes.tax]),
      refunds: currencyValue(row[indexes.refunds]),
      tipRefunds: currencyValue(row[indexes.tipRefunds]),
      legacyTips: currencyValue(row[indexes.legacyTips]),
      total: currencyValue(row[indexes.total]) || currencyValue(row[indexes.amount])
    }))
    .filter(row => row.type);
}

function toastPaymentSummaryTotals(workbook) {
  const rows = toastPaymentSummaryRows(workbook);
  const totals = {
    cashSales: 0,
    cashCollected: 0,
    cardSales: 0,
    otherSales: 0,
    doorDashSales: 0,
    uberEatsSales: 0,
    grubhubSales: 0,
    giftCardSales: 0,
    amexSales: 0,
    discoverSales: 0,
    mastercardSales: 0,
    visaSales: 0,
    paymentTotal: 0,
    paymentAmountTotal: 0,
    paymentTaxTotal: 0,
    paymentTipsTotal: 0,
    paymentRows: rows
  };

  rows.forEach(row => {
    const type = String(row.type || "").trim().toLowerCase();
    const subType = String(row.subType || "").trim().toLowerCase();
    const amount = currencyValue(row.amount);
    const total = currencyValue(row.total) || amount;

    if (!type || type === "payment type") return;
    if (type === "total") {
      totals.paymentAmountTotal = amount;
      totals.paymentTotal = total;
      totals.paymentTaxTotal = currencyValue(row.tax);
      totals.paymentTipsTotal = currencyValue(row.tips || row.legacyTips);
      return;
    }

    if (type === "cash") totals.cashSales += amount;
    if (type === "credit/debit" && !subType) totals.cardSales += amount;
    if (type === "gift card") totals.giftCardSales += amount;
    if (type === "other" && !subType) totals.otherSales += amount;
    if (type === "other" && subType.includes("doordash")) totals.doorDashSales += amount;
    if (type === "other" && (subType.includes("uber") || subType.includes("ubereats") || subType.includes("uber eats"))) totals.uberEatsSales += amount;
    if (type === "other" && subType.includes("grubhub")) totals.grubhubSales += amount;

    if (subType.includes("amex")) totals.amexSales += amount;
    if (subType.includes("discover")) totals.discoverSales += amount;
    if (subType.includes("mastercard")) totals.mastercardSales += amount;
    if (subType.includes("visa")) totals.visaSales += amount;
  });

  if (!totals.cardSales) {
    totals.cardSales = totals.amexSales + totals.discoverSales + totals.mastercardSales + totals.visaSales;
  }
  if (!totals.otherSales) totals.otherSales = totals.doorDashSales + totals.uberEatsSales + totals.grubhubSales;
  if (!totals.paymentAmountTotal) {
    totals.paymentAmountTotal = rows
      .filter(row => String(row.type || "").trim().toLowerCase() !== "total" && !String(row.subType || "").trim())
      .reduce((sum, row) => sum + currencyValue(row.amount), 0);
  }
  if (!totals.paymentTotal) {
    totals.paymentTotal = rows
      .filter(row => String(row.type || "").trim().toLowerCase() !== "total" && !String(row.subType || "").trim())
      .reduce((sum, row) => sum + currencyValue(row.total), 0);
  }

  return totals;
}

function findToastTableValue(workbook, sheetNamePattern, rowLabelPattern, columnLabelPattern = null) {
  if (!window.XLSX || !workbook?.Sheets) return 0;
  const sheetName = workbook.SheetNames.find(name => sheetNamePattern.test(String(name)));
  if (!sheetName) return 0;

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "" });
  if (!rows.length) return 0;

  if (columnLabelPattern) {
    const header = rows[0].map(cell => String(cell || "").trim());
    const colIndex = header.findIndex(label => columnLabelPattern.test(label));
    const rowIndex = rows.findIndex(row => row.some(cell => rowLabelPattern.test(String(cell || "").trim())));
    if (colIndex >= 0 && rowIndex >= 0) return currencyValue(rows[rowIndex][colIndex]);
  }

  for (const row of rows) {
    const labelIndex = row.findIndex(cell => rowLabelPattern.test(String(cell || "").trim()));
    if (labelIndex >= 0) {
      for (let i = labelIndex + 1; i < row.length; i += 1) {
        const amount = currencyValue(row[i]);
        if (amount !== 0) return amount;
      }
      for (let i = 0; i < row.length; i += 1) {
        if (i === labelIndex) continue;
        const amount = currencyValue(row[i]);
        if (amount !== 0) return amount;
      }
    }
  }
  return 0;
}

function toastCashSummaryTotals(workbook) {
  const cashSummary = toastSingleRowValues(workbook, "Cash summary", /cash summary/i);
  const cashActivity = toastSingleRowValues(workbook, "Cash activity", /cash activity/i);
  return {
    expectedCloseoutCash: toastValue(cashSummary, "Expected closeout cash"),
    actualCloseoutCash: toastValue(cashSummary, "Actual closeout cash"),
    expectedDeposit: toastValue(cashSummary, "Expected deposit"),
    actualDeposit: toastValue(cashSummary, "Actual deposit"),
    totalCashPayments: toastValue(cashActivity, "Total cash payments"),
    cashBeforeTipouts: toastValue(cashActivity, "Cash before tipouts"),
    creditNonCashTips: toastValue(cashActivity, "Credit/non-cash tips"),
    tipoutsTipsWithheld: toastValue(cashActivity, "Tipouts tips withheld"),
    totalCash: toastValue(cashActivity, "Total cash")
  };
}

function toastActualCloseoutCashFromWorkbook(workbook) {
  const cash = toastCashSummaryTotals(workbook);
  return cash.actualCloseoutCash
    || findToastTableValue(workbook, /cash summary/i, /^actual closeout cash$/i)
    || findToastTableValue(workbook, /cash summary/i, /actual closeout/i);
}

function toastCashCollectedAmount(item) {
  return currencyValue(item.actualCloseoutCash || item.cashCollected);
}

function toastCashCollectedInRange(start = "", end = "") {
  return (state.sales || [])
    .filter(item => dateInRange(item.date, start, end))
    .reduce((sum, item) => sum + toastCashCollectedAmount(item), 0);
}

function toastCashCollectedRows(start = "", end = "") {
  return (state.sales || [])
    .filter(item => dateInRange(item.date, start, end) && toastCashCollectedAmount(item) > 0)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .map(item => detailRow(
      `${item.date || "No date"} • Actual Closeout Cash`,
      `Toast Cash Collected • Cash sales ${money.format(currencyValue(item.cashSales))} • Net sales ${money.format(currencyValue(item.netSales))}`,
      toastCashCollectedAmount(item)
    ));
}

function parseToastSalesByDayRows(workbook, range) {
  const rows = toastSheetRows(workbook, "Sales by day", /sales by day/i);
  if (rows.length < 2) return [];
  const header = rows[0] || [];
  const indexes = {
    date: toastHeaderIndex(header, ["yyyyMMdd", "Date"]),
    netSales: toastHeaderIndex(header, "Net sales"),
    checks: toastHeaderIndex(header, ["Total orders", "Checks"]),
    guests: toastHeaderIndex(header, ["Total guests", "Guests"])
  };
  return rows.slice(1).map(row => {
    const date = excelDateNumberToInput(row[indexes.date]);
    const netSales = currencyValue(row[indexes.netSales]);
    return {
      date,
      weekStart: range.start,
      weekEnd: range.end,
      grossSales: netSales,
      netSales,
      checks: currencyValue(row[indexes.checks]),
      guests: currencyValue(row[indexes.guests]),
      source: "Toast Sales Excel"
    };
  }).filter(row => row.date && row.netSales);
}

function parseToastSalesWorkbook(workbook, fileName) {
  const range = parseToastDateRangeFromName(fileName);
  const paymentTotals = toastPaymentSummaryTotals(workbook);
  const revenue = toastSingleRowValues(workbook, "Revenue summary", /revenue summary/i);
  const netSalesSummary = toastSingleRowValues(workbook, "Net sales summary", /net sales summary/i);
  const tipSummary = toastSingleRowValues(workbook, "Tip summary", /tip summary/i);
  const cash = toastCashSummaryTotals(workbook);
  const dailyRows = parseToastSalesByDayRows(workbook, range);

  const netSales = toastValue(revenue, "Net sales") || toastValue(netSalesSummary, "Net sales") || dailyRows.reduce((sum, row) => sum + currencyValue(row.netSales), 0);
  const discounts = Math.abs(toastValue(netSalesSummary, ["Discounts", "Discount amount"]));
  const refunds = toastValue(netSalesSummary, ["Refunds", "Refund amount"]);
  const grossSales = toastValue(netSalesSummary, ["Gross sales", "Gross sales before discounts"])
    || (netSales + discounts - refunds)
    || toastValue(revenue, "Total");
  const tips = toastValue(revenue, "Tips") || toastValue(tipSummary, ["Total tips", "Tips"]);
  const tax = toastValue(revenue, "Tax amount") || paymentTotals.paymentTaxTotal;
  const checks = dailyRows.reduce((sum, row) => sum + currencyValue(row.checks), 0);
  const guests = dailyRows.reduce((sum, row) => sum + currencyValue(row.guests), 0);

  const weeklyRow = {
    date: range.end,
    weekStart: range.start,
    weekEnd: range.end,
    grossSales,
    netSales,
    cashSales: paymentTotals.cashSales,
    cashCollected: cash.actualCloseoutCash || cash.totalCash || paymentTotals.cashSales,
    actualCloseoutCash: cash.actualCloseoutCash || cash.totalCash || paymentTotals.cashSales,
    expectedCloseoutCash: cash.expectedCloseoutCash,
    actualDeposit: cash.actualDeposit,
    expectedDeposit: cash.expectedDeposit,
    totalCashPayments: cash.totalCashPayments,
    cashBeforeTipouts: cash.cashBeforeTipouts,
    creditNonCashTips: cash.creditNonCashTips,
    tipoutsTipsWithheld: cash.tipoutsTipsWithheld,
    totalCash: cash.totalCash,
    cardSales: paymentTotals.cardSales,
    otherSales: paymentTotals.otherSales,
    doorDashSales: paymentTotals.doorDashSales,
    uberEatsSales: paymentTotals.uberEatsSales,
    grubhubSales: paymentTotals.grubhubSales,
    giftCardSales: paymentTotals.giftCardSales,
    amexSales: paymentTotals.amexSales,
    discoverSales: paymentTotals.discoverSales,
    mastercardSales: paymentTotals.mastercardSales,
    visaSales: paymentTotals.visaSales,
    paymentTotal: paymentTotals.paymentTotal,
    paymentAmountTotal: paymentTotals.paymentAmountTotal,
    paymentTaxTotal: paymentTotals.paymentTaxTotal,
    paymentTipsTotal: paymentTotals.paymentTipsTotal,
    paymentRows: paymentTotals.paymentRows,
    discounts,
    refunds,
    tips,
    tax,
    guests,
    checks,
    source: "Toast Sales Excel"
  };

  // Keep one imported sales row per Toast report so all payment channels stay aligned to the same report period.
  if (weeklyRow.netSales || weeklyRow.grossSales || weeklyRow.paymentTotal || weeklyRow.cashSales) {
    return [weeklyRow];
  }

  return dailyRows.map(row => ({
    ...row,
    cashSales: 0,
    cashCollected: 0,
    cardSales: 0,
    otherSales: 0,
    doorDashSales: 0,
    uberEatsSales: 0,
    grubhubSales: 0,
    giftCardSales: 0,
    source: "Toast Sales Excel"
  }));
}

function upsertSalesRows(rows) {
  let added = 0;
  let updated = 0;

  rows.forEach(row => {
    const existing = state.sales.find(item => item.date === row.date && item.source === "Toast Sales Excel");
    const clean = {
      id: existing?.id || uid("sales"),
      date: row.date || today,
      weekStart: row.weekStart || "",
      weekEnd: row.weekEnd || "",
      grossSales: String(currencyValue(row.grossSales)),
      netSales: String(currencyValue(row.netSales)),
      cashSales: String(currencyValue(row.cashSales)),
      cashCollected: String(currencyValue(row.actualCloseoutCash || row.cashCollected || row.totalCash || row.cashSales)),
      actualCloseoutCash: String(currencyValue(row.actualCloseoutCash || row.cashCollected || row.totalCash || row.cashSales)),
      actualDeposit: String(currencyValue(row.actualDeposit)),
      expectedDeposit: String(currencyValue(row.expectedDeposit)),
      expectedCloseoutCash: String(currencyValue(row.expectedCloseoutCash)),
      totalCashPayments: String(currencyValue(row.totalCashPayments)),
      cashBeforeTipouts: String(currencyValue(row.cashBeforeTipouts)),
      creditNonCashTips: String(currencyValue(row.creditNonCashTips)),
      tipoutsTipsWithheld: String(currencyValue(row.tipoutsTipsWithheld)),
      totalCash: String(currencyValue(row.totalCash)),
      cardSales: String(currencyValue(row.cardSales)),
      otherSales: String(currencyValue(row.otherSales)),
      doorDashSales: String(currencyValue(row.doorDashSales)),
      uberEatsSales: String(currencyValue(row.uberEatsSales)),
      grubhubSales: String(currencyValue(row.grubhubSales)),
      giftCardSales: String(currencyValue(row.giftCardSales)),
      amexSales: String(currencyValue(row.amexSales)),
      discoverSales: String(currencyValue(row.discoverSales)),
      mastercardSales: String(currencyValue(row.mastercardSales)),
      visaSales: String(currencyValue(row.visaSales)),
      paymentTotal: String(currencyValue(row.paymentTotal)),
      paymentAmountTotal: String(currencyValue(row.paymentAmountTotal)),
      paymentTaxTotal: String(currencyValue(row.paymentTaxTotal)),
      paymentTipsTotal: String(currencyValue(row.paymentTipsTotal)),
      paymentRows: Array.isArray(row.paymentRows) ? row.paymentRows.map(payment => ({
        type: payment.type || "",
        subType: payment.subType || "",
        count: currencyValue(payment.count),
        amount: currencyValue(payment.amount),
        tips: currencyValue(payment.tips),
        gratuity: currencyValue(payment.gratuity),
        tax: currencyValue(payment.tax),
        refunds: currencyValue(payment.refunds),
        tipRefunds: currencyValue(payment.tipRefunds),
        legacyTips: currencyValue(payment.legacyTips),
        total: currencyValue(payment.total)
      })) : [],
      discounts: String(currencyValue(row.discounts)),
      refunds: String(currencyValue(row.refunds)),
      tips: String(currencyValue(row.tips)),
      tax: String(currencyValue(row.tax)),
      guests: String(currencyValue(row.guests)),
      checks: String(currencyValue(row.checks)),
      source: row.source || "Toast Sales Excel"
    };

    if (existing) {
      Object.assign(existing, clean);
      updated += 1;
    } else {
      state.sales.push(clean);
      added += 1;
    }
  });

  return { added, updated };
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some(cell => String(cell).trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some(cell => String(cell).trim())) rows.push(row);
  return rows;
}

function parseToastPayrollCsv(text, fileName = "") {
  const rows = parseCsvText(text);
  const headers = rows.shift()?.map(header => String(header).trim()) || [];
  const index = name => headers.findIndex(header => header.toLowerCase() === name.toLowerCase());
  const range = parseToastDateRangeFromName(fileName);

  return rows.map(row => ({
    id: uid("toast-payroll"),
    weekStart: range.start,
    weekEnd: range.end,
    date: range.end || today,
    employee: row[index("Employee")] || "",
    jobTitle: row[index("Job Title")] || "",
    regularHours: currencyValue(row[index("Regular Hours")]),
    overtimeHours: currencyValue(row[index("Overtime Hours")]),
    netSales: currencyValue(row[index("Net Sales")]),
    declaredTips: currencyValue(row[index("Declared Tips")]),
    nonCashTips: currencyValue(row[index("Non-Cash Tips")]),
    totalTips: currencyValue(row[index("Total Tips")]),
    tipsWithheld: currencyValue(row[index("Tips Withheld")]),
    location: row[index("Location")] || "",
    manualExtraPay: 0,
    paymentMethod: "Check",
    note: "",
    finalTips: 0,
    finalTotal: 0,
    source: "Toast Payroll CSV"
  })).map(item => ({ ...item, finalTips: toastPayrollFinalTips(item), finalTotal: toastPayrollFinalTotal(item) })).filter(item => item.employee);
}



function toastPayrollFinalTips(item) {
  return currencyValue(item.totalTips) - currencyValue(item.tipsWithheld);
}

function toastPayrollFinalTotal(item) {
  return toastPayrollFinalTips(item) + currencyValue(item.manualExtraPay);
}


function toastPayrollDefaultPaymentMethod(item) {
  if (item?.paymentMethod) return item.paymentMethod;
  return "Check";
}

function toastPayrollEmployeeType(item) {
  const job = String(item?.jobTitle || "").trim();
  if (/server/i.test(job)) return "Server";
  if (/manager/i.test(job)) return "Manager";
  return job || "Toast Employee";
}

function ensureOption(kind, value) {
  const clean = String(value || "").trim();
  if (!clean) return;
  state.options[kind] = state.options[kind] || [];
  if (!state.options[kind].some(option => option.toLowerCase() === clean.toLowerCase())) {
    state.options[kind].push(clean);
  }
}

function ensureToastPayrollEmployee(item) {
  const employeeName = String(item?.employee || "").trim();
  if (!employeeName) return "";
  let employee = state.employees.find(row => String(row.name || "").trim().toLowerCase() === employeeName.toLowerCase());
  const type = toastPayrollEmployeeType(item);
  ensureOption("employeeTypes", type);
  if (!employee) {
    employee = {
      id: uid("employee"),
      name: employeeName,
      type,
      payType: "Tips",
      rate: "0"
    };
    state.employees.push(employee);
  } else if (!employee.type || employee.type === "Toast Employee") {
    employee.type = type;
  }
  return `employee:${employee.id}`;
}

function syncToastPayrollToPayroll() {
  ensureOption("paymentMethods", "Check");
  ensureOption("payTypes", "Tips");
  const activeToastIds = new Set((state.toastPayroll || []).map(item => item.id));
  state.payroll = (state.payroll || []).filter(entry => !entry.sourceToastPayrollId || activeToastIds.has(entry.sourceToastPayrollId));

  (state.toastPayroll || []).forEach(item => {
    item.finalTips = toastPayrollFinalTips(item);
    item.finalTotal = toastPayrollFinalTotal(item);
    item.paymentMethod = toastPayrollDefaultPaymentMethod(item);
    const personId = ensureToastPayrollEmployee(item);
    if (!personId) return;
    const amount = toastPayrollFinalTotal(item);
    let entry = state.payroll.find(row => row.sourceToastPayrollId === item.id);
    const payload = {
      personId,
      date: item.date || today,
      type: "Tips",
      method: item.paymentMethod || "Check",
      amount: String(amount.toFixed(2)),
      extra: "0",
      reason: item.note ? `Toast tips - ${item.note}` : "Toast employee sales & tips",
      sourceToastPayrollId: item.id
    };
    if (entry) Object.assign(entry, payload);
    else state.payroll.push({ id: uid("payroll"), ...payload });
  });
}

function selectedToastPayrollRow() {
  return (state.toastPayroll || []).find(item => String(item.id || "") === String(selectedToastPayrollId || "")) || null;
}

function deleteToastPayrollById(id, ask = true) {
  const targetId = String(id || "");
  const item = (state.toastPayroll || []).find(row => String(row.id || "") === targetId);
  if (!item) {
    window.alert("Toast payroll row was not found. Refresh the page and try again.");
    return false;
  }
  const employeeName = item.employee || item.name || "this employee";
  if (ask && !window.confirm(`Delete imported Toast payroll row for ${employeeName}?

This will also remove the linked Payroll/Expenses entry created from this Toast import.`)) return false;

  state.toastPayroll = (state.toastPayroll || []).filter(row => String(row.id || "") !== targetId);
  state.payroll = (state.payroll || []).filter(row => String(row.sourceToastPayrollId || "") !== targetId);
  if (String(selectedToastPayrollId || "") === targetId) closeToastPayrollEdit();
  syncToastPayrollToPayroll();
  saveState();
  renderAll();
  return true;
}

function toastPayrollCalculationHtml(item) {
  if (!item) return "Select an imported payroll row to edit.";
  const finalTips = toastPayrollFinalTips(item);
  const finalTotal = toastPayrollFinalTotal(item);
  return `
    <div><span>Total Tips</span><strong>${money.format(currencyValue(item.totalTips))}</strong></div>
    <div><span>Tips Withheld</span><strong>-${money.format(currencyValue(item.tipsWithheld))}</strong></div>
    <div><span>Final Tips</span><strong>${money.format(finalTips)}</strong></div>
    <div><span>Manual Extra Pay</span><strong>${money.format(currencyValue(item.manualExtraPay))}</strong></div>
    <div class="final"><span>Final Total</span><strong>${money.format(finalTotal)}</strong></div>
  `;
}

function openToastPayrollEdit(id) {
  selectedToastPayrollId = id;
  const item = selectedToastPayrollRow();
  const panel = document.getElementById("toastPayrollEditPanel");
  const form = document.getElementById("toastPayrollEditForm");
  const status = document.getElementById("toastPayrollEditStatus");
  const calc = document.getElementById("toastPayrollCalculation");
  if (!item || !panel || !form) return;

  panel.classList.add("active");
  if (status) status.textContent = "Editing row";
  form.id.value = item.id;
  form.employee.value = item.employee || "";
  if (form.date) form.date.value = item.date || today;
  form.jobTitle.value = item.jobTitle || "";
  form.netSales.value = currencyValue(item.netSales) || "";
  form.totalTips.value = currencyValue(item.totalTips) || "";
  form.tipsWithheld.value = currencyValue(item.tipsWithheld) || "";
  if (form.paymentMethod) form.paymentMethod.value = toastPayrollDefaultPaymentMethod(item);
  form.manualExtraPay.value = currencyValue(item.manualExtraPay) || "0";
  form.note.value = item.note || "";
  if (calc) calc.innerHTML = toastPayrollCalculationHtml(item);
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeToastPayrollEdit() {
  selectedToastPayrollId = null;
  const panel = document.getElementById("toastPayrollEditPanel");
  const status = document.getElementById("toastPayrollEditStatus");
  const form = document.getElementById("toastPayrollEditForm");
  const calc = document.getElementById("toastPayrollCalculation");
  if (panel) panel.classList.remove("active");
  if (status) status.textContent = "No row selected";
  if (form) form.reset();
  if (calc) calc.textContent = "Select an imported payroll row to edit.";
}

function saveToastPayrollEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const item = selectedToastPayrollRow();
  if (!item) return;

  item.date = form.date?.value || item.date || today;
  item.jobTitle = form.jobTitle.value || "";
  item.netSales = currencyValue(form.netSales.value);
  item.totalTips = currencyValue(form.totalTips.value);
  item.tipsWithheld = currencyValue(form.tipsWithheld.value);
  item.paymentMethod = form.paymentMethod?.value || "Check";
  item.manualExtraPay = currencyValue(form.manualExtraPay.value);
  item.note = form.note.value || "";
  item.finalTips = toastPayrollFinalTips(item);
  item.finalTotal = toastPayrollFinalTotal(item);

  const status = document.getElementById("toastPayrollEditStatus");
  if (status) status.textContent = "Saved";
  syncToastPayrollToPayroll();
  saveState();
  renderAll();
  openToastPayrollEdit(item.id);
}

function deleteToastPayrollSelectedRow() {
  const item = selectedToastPayrollRow();
  if (!item) return;
  deleteToastPayrollById(item.id, true);
}

function toastPayrollRowsInRange(start = "", end = "") {
  return state.toastPayroll.filter(item => dateInRange(item.date, start, end));
}

function renderToastPayroll() {
  const list = document.getElementById("toastPayrollList");
  if (!list) return;
  const count = document.getElementById("toastPayrollCount");
  const rows = state.toastPayroll
    .slice()
    .sort((a, b) => currencyValue(b.netSales) - currencyValue(a.netSales));

  if (count) count.textContent = `${rows.length} rows`;

  renderList("toastPayrollList", rows.map(item => {
      item.finalTips = toastPayrollFinalTips(item);
  item.finalTotal = toastPayrollFinalTotal(item);

    const row = rowItem(
      `${item.employee} • ${money.format(currencyValue(item.netSales))} sales`,
      `${item.date || "No date"} • ${item.jobTitle || "No job"} • Payment ${toastPayrollDefaultPaymentMethod(item)} • Total Tips ${money.format(currencyValue(item.totalTips))} • Withheld ${money.format(currencyValue(item.tipsWithheld))} • Final Tips ${money.format(item.finalTips)} • Extra ${money.format(currencyValue(item.manualExtraPay))}${item.note ? ` • Reason: ${item.note}` : ""} • Final Total ${money.format(item.finalTotal)}`,
      event => {
        event.stopPropagation();
        deleteToastPayrollById(item.id, true);
      },
      "employee"
    );
    const editButton = document.createElement("button");
    editButton.className = "delete-button";
    editButton.type = "button";
    editButton.title = "Edit payment method / amount";
    editButton.innerHTML = iconSvg("edit");
    editButton.addEventListener("click", event => {
      event.stopPropagation();
      openToastPayrollEdit(item.id);
    });
    const deleteButton = row.querySelector(".delete-button");
    if (deleteButton) row.insertBefore(editButton, deleteButton);
    row.classList.add("clickable-toast-payroll-row");
    row.title = "Click to edit Toast payroll row";
    row.addEventListener("click", () => openToastPayrollEdit(item.id));
    return row;
  }), "No Toast payroll import yet.");
}

function employeeSalesTipReportRows(start = "", end = "") {
  return toastPayrollRowsInRange(start, end)
    .slice()
    .sort((a, b) => currencyValue(b.netSales) - currencyValue(a.netSales))
    .map(item => detailRow(
      item.employee,
      `${item.date || "No date"} • ${item.jobTitle || "No job"} • Total Tips ${money.format(currencyValue(item.totalTips))} • Withheld ${money.format(currencyValue(item.tipsWithheld))} • Final Tips ${money.format(toastPayrollFinalTips(item))} • Extra ${money.format(currencyValue(item.manualExtraPay))}${item.note ? ` • Reason: ${item.note}` : ""} • Final Total ${money.format(toastPayrollFinalTotal(item))}`,
      toastPayrollFinalTotal(item)
    ));
}


function selectedToastSalesRow() {
  return (state.sales || []).find(item => item.id === selectedToastSalesId) || null;
}

function salesPaymentTotal(item = {}) {
  return currencyValue(item.cashSales)
    + currencyValue(item.cardSales)
    + currencyValue(item.doorDashSales)
    + currencyValue(item.uberEatsSales)
    + currencyValue(item.grubhubSales)
    + currencyValue(item.giftCardSales)
    + currencyValue(item.otherSales);
}

function updateToastSalesEditReconcile() {
  const form = document.getElementById("toastSalesEditForm");
  const box = document.getElementById("toastSalesEditReconcile");
  if (!form || !box) return;
  const temp = {
    cashSales: form.cashSales?.value,
    cardSales: form.cardSales?.value,
    doorDashSales: form.doorDashSales?.value,
    uberEatsSales: form.uberEatsSales?.value,
    grubhubSales: form.grubhubSales?.value,
    giftCardSales: form.giftCardSales?.value,
    otherSales: form.otherSales?.value
  };
  const total = salesPaymentTotal(temp);
  const gross = currencyValue(form.grossSales?.value);
  const diff = gross - total;
  box.textContent = `Total payments ${money.format(total)} • Gross difference ${money.format(diff)}`;
  box.classList.toggle("warn", Math.abs(diff) >= 0.01);
}

function openToastSalesEdit(id) {
  selectedToastSalesId = id;
  const item = selectedToastSalesRow();
  const panel = document.getElementById("toastSalesEditPanel");
  const form = document.getElementById("toastSalesEditForm");
  const status = document.getElementById("toastSalesEditStatus");
  if (!item || !panel || !form) return;

  panel.classList.add("active");
  if (status) status.textContent = "Editing imported sales";
  form.id.value = item.id;
  form.date.value = item.date || today;
  form.cashCollected.value = toastCashCollectedAmount(item) || "";
  form.cashSales.value = currencyValue(item.cashSales) || "";
  if (form.cardSales) form.cardSales.value = currencyValue(item.cardSales) || "";
  if (form.doorDashSales) form.doorDashSales.value = currencyValue(item.doorDashSales) || "";
  if (form.uberEatsSales) form.uberEatsSales.value = currencyValue(item.uberEatsSales) || "";
  if (form.grubhubSales) form.grubhubSales.value = currencyValue(item.grubhubSales) || "";
  if (form.giftCardSales) form.giftCardSales.value = currencyValue(item.giftCardSales) || "";
  if (form.otherSales) form.otherSales.value = currencyValue(item.otherSales) || "";
  form.netSales.value = currencyValue(item.netSales) || "";
  form.grossSales.value = currencyValue(item.grossSales) || "";
  form.tips.value = currencyValue(item.tips) || "";
  updateToastSalesEditReconcile();
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeToastSalesEdit() {
  selectedToastSalesId = null;
  const panel = document.getElementById("toastSalesEditPanel");
  const status = document.getElementById("toastSalesEditStatus");
  const form = document.getElementById("toastSalesEditForm");
  if (panel) panel.classList.remove("active");
  if (status) status.textContent = "No sales row selected";
  if (form) form.reset();
}

function saveToastSalesEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const item = selectedToastSalesRow();
  if (!item) return;

  item.date = form.date.value || item.date || today;
  item.cashCollected = currencyValue(form.cashCollected.value);
  item.actualCloseoutCash = currencyValue(form.cashCollected.value);
  item.cashSales = currencyValue(form.cashSales.value);
  item.cardSales = currencyValue(form.cardSales?.value);
  item.doorDashSales = currencyValue(form.doorDashSales?.value);
  item.uberEatsSales = currencyValue(form.uberEatsSales?.value);
  item.grubhubSales = currencyValue(form.grubhubSales?.value);
  item.giftCardSales = currencyValue(form.giftCardSales?.value);
  item.otherSales = currencyValue(form.otherSales?.value);
  item.netSales = currencyValue(form.netSales.value);
  item.grossSales = currencyValue(form.grossSales.value);
  item.tips = currencyValue(form.tips.value);

  saveState();
  renderSales();
  renderDashboard();
  openToastSalesEdit(item.id);
  const status = document.getElementById("toastSalesEditStatus");
  if (status) status.textContent = "Saved";
}

function deleteToastSalesSelectedRow() {
  const item = selectedToastSalesRow();
  if (!item) return;
  const ok = window.confirm(`Delete imported sales row for ${item.date || "No date"}?`);
  if (!ok) return;
  state.sales = (state.sales || []).filter(row => row.id !== item.id);
  closeToastSalesEdit();
  saveState();
  renderSales();
  renderDashboard();
}

function renderSales() {
  const list = document.getElementById("salesList");
  if (!list) return;
  list.style.display = "";
  list.hidden = false;

  const count = document.getElementById("salesCount");
  const totalNet = document.getElementById("salesTotalNet");
  const avgDaily = document.getElementById("salesAverageDaily");
  const totalTips = document.getElementById("salesTotalTips");

  const sorted = (state.sales || []).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const totals = salesTotals(sorted);
  if (count) count.textContent = `${sorted.length} entries`;
  if (totalNet) totalNet.textContent = money.format(totals.netSales);
  if (avgDaily) avgDaily.textContent = money.format(sorted.length ? totals.netSales / sorted.length : 0);
  if (totalTips) totalTips.textContent = money.format(totals.tips);

  const rows = sorted.map(item => {
    const row = document.createElement("div");
    row.className = "sales-history-row";
    row.tabIndex = 0;
    row.role = "button";
    row.innerHTML = `
      <div>
        <strong>${esc(item.date || "No date")}</strong>
        <small>Cash ${money.format(currencyValue(item.cashSales))} • Card ${money.format(currencyValue(item.cardSales))} • DoorDash ${money.format(currencyValue(item.doorDashSales))} • Tips ${money.format(currencyValue(item.tips))}</small>
      </div>
      <strong>${money.format(currencyValue(item.netSales))}</strong>
      <div class="sales-row-actions">
        <button class="mini-button" type="button">${iconSvg("edit")} Edit</button>
        <button class="ghost-button danger-button" type="button">${iconSvg("trash")}</button>
      </div>
    `;
    row.querySelector(".mini-button")?.addEventListener("click", event => {
      event.stopPropagation();
      openToastSalesEdit(item.id);
    });
    row.querySelector(".danger-button")?.addEventListener("click", event => {
      event.stopPropagation();
      removeById("sales", item.id);
      if (selectedToastSalesId === item.id) closeToastSalesEdit();
    });
    row.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      openToastSalesEdit(item.id);
    });
    return row;
  });

  renderList("salesList", rows, "No sales entries yet.");
  renderToastPayroll();
}

function renderProfitDashboard(snapshot) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  set("metricNetSales", money.format(snapshot.sales.netSales));
  set("metricTotalExpenses", money.format(snapshot.expenses.totalExpenses));
  set("metricNetProfit", money.format(snapshot.netProfit));
  set("metricProfitMargin", percentText(snapshot.profitMargin));
  set("metricLaborPercent", percentText(snapshot.laborPercent));
  set("metricFoodCostSalesPercent", percentText(snapshot.foodPercent));
}


function defaultDashboardCards() {
  return {
    netSales: true,
    totalExpenses: true,
    netProfit: true,
    profitMargin: true,
    laborPercent: true,
    foodCostPercent: true,
    cashCollected: true,
    expectedDeposit: true,
    payroll: true,
    invoices: true,
    categorySpending: true,
    priceAlerts: true
  };
}

const dashboardCardLabels = {
  netSales: "Net Sales",
  totalExpenses: "Total Expenses",
  netProfit: "Net Profit",
  profitMargin: "Profit Margin",
  laborPercent: "Labor %",
  foodCostPercent: "Food Cost %",
  cashCollected: "Toast Cash Collected",
  expectedDeposit: "Remaining Cash",
  payroll: "Payroll",
  invoices: "Invoices",
  categorySpending: "Category Spending",
  priceAlerts: "Price Alerts"
};

function applyDashboardCardVisibility() {
  const map = {
    netSales: "metricNetSales",
    totalExpenses: "metricTotalExpenses",
    netProfit: "metricNetProfit",
    profitMargin: "metricProfitMargin",
    laborPercent: "metricLaborPercent",
    foodCostPercent: "metricFoodCostSalesPercent"
  };

  Object.entries(map).forEach(([key, id]) => {
    const card = document.getElementById(id)?.closest(".profit-kpi, .metric, article");
    if (card) card.style.display = state.dashboardCards[key] === false ? "none" : "";
  });

  const categoryPanel = document.querySelector(".dashboard-category-panel");
  if (categoryPanel) categoryPanel.style.display = state.dashboardCards.categorySpending === false ? "none" : "";

  const pricePanel = document.querySelector(".price-alert-panel");
  if (pricePanel) pricePanel.style.display = state.dashboardCards.priceAlerts === false ? "none" : "";

  // Hide/show common metric cards by their text labels.
  document.querySelectorAll(".metric").forEach(card => {
    const text = card.textContent.toLowerCase();
    if (text.includes("payroll")) card.style.display = state.dashboardCards.payroll === false ? "none" : "";
    if (text.includes("invoice")) card.style.display = state.dashboardCards.invoices === false ? "none" : "";
    if (text.includes("cash")) card.style.display = state.dashboardCards.cashCollected === false && state.dashboardCards.expectedDeposit === false ? "none" : "";
  });
}

function renderDashboardCardManager() {
  const holder = document.getElementById("dashboardCardToggles");
  if (!holder) return;

  holder.innerHTML = Object.entries(dashboardCardLabels).map(([key, label]) => `
    <label>
      <input type="checkbox" value="${key}" ${state.dashboardCards[key] !== false ? "checked" : ""}>
      ${label}
    </label>
  `).join("");

  holder.querySelectorAll("input[type='checkbox']").forEach(input => {
    input.addEventListener("change", event => {
      state.dashboardCards[event.currentTarget.value] = event.currentTarget.checked;
      saveState();
      applyDashboardCardVisibility();
    });
  });
}

function renderCustomDashboardCards() {
  const holder = document.getElementById("customDashboardCards");
  const count = document.getElementById("customDashboardCardCount");
  if (!holder) return;
  if (count) count.textContent = `${state.customDashboardCards.length} cards`;

  if (!state.customDashboardCards.length) {
    holder.innerHTML = '<div class="status compact-note">No custom cards yet. Add one above.</div>';
    return;
  }

  holder.innerHTML = "";
  state.customDashboardCards.forEach(card => {
    const article = document.createElement("article");
    article.className = "custom-dashboard-card";
    article.innerHTML = `
      <button class="delete-button custom-card-delete" type="button" aria-label="Delete card">×</button>
      <span>${esc(card.label || "Custom Card")}</span>
      <strong>${esc(card.value || "$0.00")}</strong>
      <small>${esc(card.note || "")}</small>
    `;
    article.querySelector(".custom-card-delete").addEventListener("click", () => {
      state.customDashboardCards = state.customDashboardCards.filter(item => item.id !== card.id);
      saveState();
      renderCustomDashboardCards();
    });
    holder.append(article);
  });
}

function addCustomDashboardCard(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  if (!data.label && !data.value) return;
  state.customDashboardCards.push({
    id: uid("dashboard-card"),
    label: data.label || "Custom Card",
    value: data.value || "$0.00",
    note: data.note || ""
  });
  event.currentTarget.reset();
  saveState();
  renderCustomDashboardCards();
}


function renderFinalCashOverview(start = "", end = "") {
  const data = cashReportData(start, end);
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  set("finalToastCashCollected", money.format(data.cashCollectedTotal));
  set("finalCashPayroll", money.format(data.cashPayrollTotal));
  set("finalCashExpenses", money.format(data.cashExpensesTotal));
  set("finalRemainingCash", money.format(data.cashBalance));
}


function initDashboardCardDrag() {
  const grid = document.getElementById("dashboardMetricGrid");
  if (!grid) return;
  grid.querySelectorAll(".metric[data-metric-key]").forEach(card => card.setAttribute("draggable", "false"));
  if (grid.dataset.dragReady === "1") return;
  grid.dataset.dragReady = "1";
  const savedOrder = JSON.parse(localStorage.getItem("dashboard-metric-card-order") || "[]");
  savedOrder.forEach(key => {
    const card = grid.querySelector(`[data-metric-key="${CSS.escape(key)}"]`);
    if (card) grid.append(card);
  });

  let active = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;

  const saveOrder = () => localStorage.setItem("dashboard-metric-card-order", JSON.stringify([...grid.querySelectorAll(".metric[data-metric-key]")].map(card => card.dataset.metricKey)));

  grid.addEventListener("pointerdown", event => {
    const card = event.target.closest(".metric[data-metric-key]");
    if (!card || event.button !== 0) return;
    active = card;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    card.dataset.wasDragged = "0";
  });

  grid.addEventListener("pointermove", event => {
    if (!active) return;
    const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
    if (distance < 8 && !dragging) return;
    dragging = true;
    active.dataset.wasDragged = "1";
    active.classList.add("dragging");
    const cards = [...grid.querySelectorAll(".metric[data-metric-key]:not(.dragging)")];
    const after = cards.find(card => {
      const rect = card.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2 && event.clientX < rect.right;
    });
    if (after) grid.insertBefore(active, after);
    else grid.append(active);
  });

  const endDrag = () => {
    if (!active) return;
    const finished = active;
    finished.classList.remove("dragging");
    if (dragging) {
      grid.dataset.lastDragTime = String(Date.now());
      finished.dataset.wasDragged = "1";
      setTimeout(() => { finished.dataset.wasDragged = "0"; }, 180);
      saveOrder();
    }
    active = null;
    dragging = false;
  };
  grid.addEventListener("pointerup", endDrag);
  grid.addEventListener("pointercancel", endDrag);
}


function compactDateLabel(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ownerSalesTrendRows() {
  const rows = (state.sales || [])
    .slice()
    .filter(item => item.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-14);

  if (!rows.length) return [];

  return rows.map(item => {
    const expenses = expenseTotalsForRange(item.date, item.date);
    const sales = currencyValue(item.netSales);
    return {
      label: compactDateLabel(item.date),
      sales,
      expenses: expenses.totalExpenses,
      profit: sales - expenses.totalExpenses
    };
  });
}

function renderOwnerLineChart(id, rows) {
  const element = document.getElementById(id);
  if (!element) return;
  element.innerHTML = "";

  if (!rows.length) {
    element.innerHTML = '<div class="status">Add or import sales to see your daily sales trend.</div>';
    return;
  }

  const max = Math.max(...rows.flatMap(row => [row.sales, row.expenses, row.profit]).map(value => Math.max(0, currencyValue(value))), 1);
  const points = (key) => rows.map((row, index) => {
    const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
    const y = 92 - ((Math.max(0, currencyValue(row[key])) / max) * 78);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  const labels = rows.map((row, index) => {
    if (rows.length > 8 && index % 2) return "";
    const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
    return `<span style="left:${x}%">${esc(row.label)}</span>`;
  }).join("");

  element.innerHTML = `
    <div class="owner-chart-legend">
      <span><i class="legend-sales"></i>Sales</span>
      <span><i class="legend-expenses"></i>Expenses</span>
      <span><i class="legend-profit"></i>Profit</span>
    </div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Sales, expenses, and profit trend">
      <polyline class="trend-sales" points="${points("sales")}"></polyline>
      <polyline class="trend-expenses" points="${points("expenses")}"></polyline>
      <polyline class="trend-profit" points="${points("profit")}"></polyline>
    </svg>
    <div class="owner-chart-axis">${labels}</div>
  `;
}

function weekKeyForDate(value) {
  return weekStartDate(value || today);
}

function ownerWeeklyFoodRows() {
  const weeks = {};
  (state.sales || []).forEach(sale => {
    if (!sale.date) return;
    const key = weekKeyForDate(sale.date);
    if (!weeks[key]) weeks[key] = { week: key, sales: 0, food: 0 };
    weeks[key].sales += currencyValue(sale.netSales);
  });

  categorySourceRows().forEach(row => {
    const metaDate = String(row.meta || "").slice(0, 10);
    const normalizedCategory = accountingExpenseCategory(row.category || "");
    if (normalizedCategory !== "Food") return;
    const key = weekKeyForDate(metaDate || today);
    if (!weeks[key]) weeks[key] = { week: key, sales: 0, food: 0 };
    weeks[key].food += currencyValue(row.amount);
  });

  return Object.values(weeks)
    .sort((a, b) => String(a.week).localeCompare(String(b.week)))
    .slice(-6)
    .map(row => ({ ...row, label: compactDateLabel(row.week), foodPercent: row.sales ? (row.food / row.sales) * 100 : 0 }));
}

function renderOwnerBarChart(id, rows) {
  const element = document.getElementById(id);
  if (!element) return;
  element.innerHTML = "";

  if (!rows.length) {
    element.innerHTML = '<div class="status">Add sales and food invoices to compare weekly food cost with sales.</div>';
    return;
  }

  const max = Math.max(...rows.flatMap(row => [row.sales, row.food]).map(currencyValue), 1);
  element.innerHTML = `
    <div class="owner-chart-legend">
      <span><i class="legend-sales"></i>Sales</span>
      <span><i class="legend-food"></i>Food cost</span>
    </div>
    <div class="owner-week-bars">
      ${rows.map(row => `
        <div class="owner-week-row">
          <span>${esc(row.label)}</span>
          <div class="owner-week-bar-stack">
            <i class="bar-sales" style="width:${Math.max(2, (currencyValue(row.sales) / max) * 100)}%"></i>
            <i class="bar-food" style="width:${Math.max(2, (currencyValue(row.food) / max) * 100)}%"></i>
          </div>
          <strong>${percentText(row.foodPercent)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderOwnerBusinessInsights(snapshot, cashData, categoryTotals) {
  const list = document.getElementById("ownerBusinessInsights");
  const headline = document.getElementById("ownerInsightHeadline");
  if (!list) return;

  const insights = [];
  if (snapshot.sales.netSales > 0) {
    insights.push({ type: snapshot.netProfit >= 0 ? "good" : "bad", text: `${snapshot.netProfit >= 0 ? "Profit positive" : "Profit negative"} at ${money.format(snapshot.netProfit)}.` });
    insights.push({ type: snapshot.foodPercent <= 32 ? "good" : "warn", text: `Food cost is ${percentText(snapshot.foodPercent)} of sales.` });
    insights.push({ type: snapshot.laborPercent <= 28 ? "good" : "warn", text: `Labor is ${percentText(snapshot.laborPercent)} of sales.` });
  } else {
    insights.push({ type: "neutral", text: "Add or import sales to unlock margin, labor, and food-cost insights." });
  }

  if (currencyValue(cashData.cashBalance) < 0) insights.push({ type: "bad", text: `Cash is short by ${money.format(Math.abs(cashData.cashBalance))}.` });
  else insights.push({ type: "good", text: `Remaining cash is ${money.format(cashData.cashBalance)}.` });

  const largestExpense = sortedAccountingRows(categoryTotals)[0];
  if (largestExpense) insights.push({ type: "neutral", text: `Largest expense bucket is ${largestExpense[0]} at ${money.format(largestExpense[1])}.` });

  if (headline) {
    headline.textContent = snapshot.sales.netSales
      ? `Sales ${money.format(snapshot.sales.netSales)} • Profit ${money.format(snapshot.netProfit)} • Food cost ${percentText(snapshot.foodPercent)}`
      : "Import sales to start seeing business insights.";
  }

  list.innerHTML = insights.map(item => `
    <div class="owner-insight ${item.type}">
      <span>${item.type === "good" ? "✓" : item.type === "warn" ? "!" : item.type === "bad" ? "!" : "•"}</span>
      <p>${esc(item.text)}</p>
    </div>
  `).join("");
}

function wireOwnerQuickActions() {
  document.querySelectorAll("[data-view-target]").forEach(button => {
    if (button.dataset.ownerActionReady === "1") return;
    button.dataset.ownerActionReady = "1";
    button.addEventListener("click", () => {
      const target = button.dataset.viewTarget;
      const nav = document.querySelector(`.nav-item[data-view="${target}"]`);
      if (nav) nav.click();
    });
  });
}



function sampleSetText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function sampleCompactDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sampleSalesTrendRows() {
  return (state.sales || [])
    .slice()
    .filter(item => item.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-14)
    .map(item => {
      const expenses = expenseTotalsForRange(item.date, item.date);
      const sales = currencyValue(item.netSales);
      return {
        label: sampleCompactDate(item.date),
        sales,
        expenses: expenses.totalExpenses,
        profit: sales - expenses.totalExpenses
      };
    });
}

function sampleRenderLineChart(id, rows) {
  const element = document.getElementById(id);
  if (!element) return;
  element.innerHTML = "";
  if (!rows.length) {
    element.innerHTML = '<div class="status">Add or import sales to see your sales trend.</div>';
    return;
  }

  const max = Math.max(...rows.flatMap(row => [row.sales, row.expenses, row.profit]).map(value => Math.max(0, currencyValue(value))), 1);
  const points = key => rows.map((row, index) => {
    const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
    const y = 90 - ((Math.max(0, currencyValue(row[key])) / max) * 76);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  const labels = rows.map((row, index) => {
    if (rows.length > 8 && index % 2) return "";
    const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
    return `<span style="left:${x}%">${esc(row.label)}</span>`;
  }).join("");

  element.innerHTML = `
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Sales trend">
      <polyline class="sample-line-blue" points="${points("sales")}"></polyline>
      <polyline class="sample-line-gray" points="${points("expenses")}"></polyline>
      <polyline class="sample-line-green" points="${points("profit")}"></polyline>
    </svg>
    <div class="sample-chart-axis">${labels}</div>
  `;
}

function sampleWeekKey(value) {
  return weekStartDate(value || today);
}

function sampleWeeklyFoodRows() {
  const weeks = {};
  (state.sales || []).forEach(sale => {
    if (!sale.date) return;
    const key = sampleWeekKey(sale.date);
    if (!weeks[key]) weeks[key] = { week: key, sales: 0, food: 0 };
    weeks[key].sales += currencyValue(sale.netSales);
  });

  categorySourceRows().forEach(row => {
    if (accountingExpenseCategory(row.category || "") !== "Food") return;
    const date = String(row.meta || "").match(/\d{4}-\d{2}-\d{2}/)?.[0] || today;
    const key = sampleWeekKey(date);
    if (!weeks[key]) weeks[key] = { week: key, sales: 0, food: 0 };
    weeks[key].food += currencyValue(row.amount);
  });

  return Object.values(weeks)
    .sort((a, b) => String(a.week).localeCompare(String(b.week)))
    .slice(-7)
    .map(row => ({ ...row, label: sampleCompactDate(row.week), foodPercent: row.sales ? (row.food / row.sales) * 100 : 0 }));
}

function sampleRenderBarChart(id, rows) {
  const element = document.getElementById(id);
  if (!element) return;
  element.innerHTML = "";
  if (!rows.length) {
    element.innerHTML = '<div class="status">Add sales and food invoices to compare food cost with sales.</div>';
    return;
  }

  const max = Math.max(...rows.flatMap(row => [row.sales, row.food]).map(currencyValue), 1);
  element.innerHTML = `
    <div class="sample-bars">
      ${rows.map(row => `
        <div class="sample-bar-column">
          <div class="sample-bar-pair">
            <i class="sales" style="height:${Math.max(3, (currencyValue(row.sales) / max) * 100)}%"></i>
            <i class="food" style="height:${Math.max(3, (currencyValue(row.food) / max) * 100)}%"></i>
          </div>
          <span>${esc(row.label)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function sampleRenderBusinessInsights(snapshot, cashData, categoryTotals) {
  const list = document.getElementById("ownerBusinessInsights");
  if (!list) return;

  const insights = [];
  if (snapshot.sales.netSales > 0) {
    insights.push({ type: "up", text: `Sales are ${money.format(snapshot.sales.netSales)} for this period.` });
    insights.push({ type: snapshot.netProfit >= 0 ? "up" : "warn", text: `Profit is ${money.format(snapshot.netProfit)} with ${percentText(snapshot.profitMargin)} margin.` });
    insights.push({ type: snapshot.foodPercent <= 32 ? "ok" : "warn", text: `Food cost is ${percentText(snapshot.foodPercent)} of sales.` });
    insights.push({ type: snapshot.laborPercent <= 28 ? "ok" : "warn", text: `Labor cost is ${percentText(snapshot.laborPercent)} of sales.` });
  } else {
    insights.push({ type: "ok", text: "Import or add sales to unlock business insights." });
  }

  if (currencyValue(cashData.cashBalance) >= 0) insights.push({ type: "ok", text: `Remaining cash is ${money.format(cashData.cashBalance)}.` });
  else insights.push({ type: "warn", text: `Cash is short by ${money.format(Math.abs(cashData.cashBalance))}.` });

  list.innerHTML = insights.map(item => `
    <div class="sample-insight ${item.type}">
      <span>${item.type === "warn" ? "!" : item.type === "up" ? "↑" : "✓"}</span>
      <p>${esc(item.text)}</p>
    </div>
  `).join("");
}

function sampleRenderRecentActivity() {
  const recent = [
    ...(state.invoices || []).map(item => ({ label: `Invoice ${item.number || "saved"}`, meta: `${item.date || "No date"} • ${money.format(currencyValue(item.total))}`, type: "invoice" })),
    ...(state.payroll || []).map(item => ({ label: `Payroll: ${personName(item.personId)}`, meta: `${item.date || "No date"} • ${money.format(payrollFinalCheckAmount(item))}`, type: "payroll" })),
    ...(state.propertyExpenses || []).map(item => ({ label: `Property expense added`, meta: `${item.date || "No date"} • ${money.format(currencyValue(item.amount))}`, type: "property" }))
  ].slice(-5).reverse();

  sampleSetText("recentCount", `${recent.length} items`);
  const list = document.getElementById("recentList");
  if (!list) return;
  if (!recent.length) {
    list.innerHTML = '<div class="status">No recent activity yet.</div>';
    return;
  }
  list.innerHTML = recent.map(item => `
    <div class="sample-recent-item">
      <span>${item.type === "invoice" ? "📄" : item.type === "payroll" ? "👥" : "🏠"}</span>
      <div><strong>${esc(item.label)}</strong><small>${esc(item.meta)}</small></div>
    </div>
  `).join("");
}

function sampleWireQuickActions() {
  document.querySelectorAll("[data-view-target]").forEach(button => {
    if (button.dataset.sampleActionReady === "1") return;
    button.dataset.sampleActionReady = "1";
    button.addEventListener("click", () => {
      const nav = document.querySelector(`.nav-item[data-view="${button.dataset.viewTarget}"]`);
      if (nav) nav.click();
    });
  });
}


function restapayMoney(value) {
  return money.format(currencyValue(value));
}

function renderFinalFlatDashboardPanels(snapshot, cashData, categoryTotals) {
  // Hide chart blocks for the final uploaded design direction: information cards, no graphs.
  document.querySelectorAll(".sample-sales-card, .sample-food-card").forEach(el => el.style.display = "none");

  const dashboard = document.querySelector(".sample-one-dashboard");
  if (!dashboard) return;

  let expensePanel = document.getElementById("finalExpenseSummaryPanel");
  if (!expensePanel) {
    expensePanel = document.createElement("section");
    expensePanel.id = "finalExpenseSummaryPanel";
    expensePanel.className = "sample-card final-summary-panel final-expense-panel";
    expensePanel.innerHTML = `
      <div class="sample-card-head"><h3>Expense Summary</h3><button class="sample-mini-select" type="button" id="openExpenseSummaryPopup">View All Expenses</button></div>
      <div id="finalExpenseSummaryList" class="final-info-list"></div>
    `;
    const anchor = document.querySelector(".sample-alert-card");
    dashboard.insertBefore(expensePanel, anchor || null);
  }

  let pnlPanel = document.getElementById("finalPnlSummaryPanel");
  if (!pnlPanel) {
    pnlPanel = document.createElement("section");
    pnlPanel.id = "finalPnlSummaryPanel";
    pnlPanel.className = "sample-card final-summary-panel final-pnl-panel";
    pnlPanel.innerHTML = `
      <div class="sample-card-head"><h3>Profit & Loss Summary</h3><button class="sample-mini-select" type="button" data-view-target="reports">View Full P&L</button></div>
      <div id="finalPnlSummaryList" class="final-info-list"></div>
    `;
    const alertPanel = document.querySelector(".sample-alert-card");
    dashboard.insertBefore(pnlPanel, alertPanel || null);
  }

  const rows = sortedAccountingRows(categoryTotals);
  const expenseList = document.getElementById("finalExpenseSummaryList");
  const totalExpenses = rows.reduce((sum, [, value]) => sum + currencyValue(value), 0);
  if (expenseList) {
    const preferred = ["Food", "Beverage", "Supplies", "Utilities", "Insurance", "Repairs & Maintenance", "Mortgage & Loans", "Check Payroll", "Cash Payroll", "Other"];
    const sorted = rows.sort((a, b) => preferred.indexOf(a[0]) - preferred.indexOf(b[0]));
    const displayRows = sorted.filter(row => currencyValue(row[1]) !== 0).slice(0, 8);
    expenseList.innerHTML = displayRows.map(([category, amount]) => `
      <button class="final-info-row" type="button" data-final-category="${esc(category)}">
        <span>${esc(category)}</span>
        <strong>${money.format(amount)}</strong>
        <em>${totalExpenses ? percentText((amount / totalExpenses) * 100) : "0.0%"}</em>
      </button>
    `).join("") + `
      <button class="final-info-row total" type="button" id="finalExpenseTotalRow">
        <span>Total Expenses</span>
        <strong>${money.format(totalExpenses)}</strong>
        <em>100%</em>
      </button>
    `;
    expenseList.querySelectorAll("[data-final-category]").forEach(button => {
      button.addEventListener("click", () => {
        const category = button.dataset.finalCategory;
        const amount = categoryTotals[category] || rows.find(r => r[0] === category)?.[1] || 0;
        showDashboardDetails(`${category} Details`, money.format(amount), categoryDetailRows(category));
      });
    });
    expenseList.querySelector("#finalExpenseTotalRow")?.addEventListener("click", () => {
      showDashboardDetails("All Expense Details", money.format(totalExpenses), categoryDetailRows());
    });
  }

  const pnl = document.getElementById("finalPnlSummaryList");
  if (pnl) {
    const cogs = currencyValue(categoryTotals.Food) + currencyValue(categoryTotals.Beverage) + currencyValue(categoryTotals.Supplies) + currencyValue(categoryTotals.Packaging);
    const grossProfit = snapshot.sales.netSales - cogs;
    pnl.innerHTML = `
      <div class="final-info-row"><span>Total Net Sales</span><strong>${money.format(snapshot.sales.netSales)}</strong></div>
      <div class="final-info-row"><span>Cost of Goods Sold</span><strong>${money.format(cogs)}</strong></div>
      <div class="final-info-row good"><span>Gross Profit</span><strong>${money.format(grossProfit)}</strong></div>
      <div class="final-info-row"><span>Total Expenses</span><strong>${money.format(snapshot.expenses.totalExpenses)}</strong></div>
      <div class="final-info-row good"><span>Net Profit</span><strong>${money.format(snapshot.netProfit)}</strong></div>
      <div class="final-info-row good"><span>Profit Margin</span><strong>${percentText(snapshot.profitMargin)}</strong></div>
    `;
  }

  // Re-label KPI cards to match final design.
  const kpiLabels = document.querySelectorAll(".sample-kpi small");
  if (kpiLabels[1]) kpiLabels[1].textContent = "Gross Profit";
  const netProfitCard = document.querySelector("#metricNetProfit");
  const grossCard = document.querySelector(".sample-kpi:nth-child(2) strong");
  if (grossCard) {
    const cogs = currencyValue(categoryTotals.Food) + currencyValue(categoryTotals.Beverage) + currencyValue(categoryTotals.Supplies) + currencyValue(categoryTotals.Packaging);
    grossCard.textContent = money.format(snapshot.sales.netSales - cogs);
  }

  sampleWireQuickActions();
}


function normalizeInvoiceUnitPrice(item) {
  const unit = currencyValue(item.unitPrice);
  const total = currencyValue(item.total);
  const qty = Number.parseFloat(String(item.quantity || "").replace(/[^0-9.]/g, ""));
  if (unit > 0 && unit < total * 0.95) return unit;
  if (total > 0 && qty > 0) return total / qty;
  return unit > 0 && unit < 1000 ? unit : 0;
}

function renderPosDashboard(snapshot, cashData, categoryTotals) {
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  const cogs = currencyValue(categoryTotals.Food) + currencyValue(categoryTotals.Beverage) + currencyValue(categoryTotals.Supplies) + currencyValue(categoryTotals.Packaging);
  const grossProfit = snapshot.sales.netSales - cogs;
  const checkPayroll = currencyValue(categoryTotals["Check Payroll"]);
  const cashPayroll = currencyValue(categoryTotals["Cash Payroll"]);
  const totalTips = (snapshot.expenses.payrollItems || []).reduce((sum, item) => sum + waiterTipDeduction(item), 0);

  set("posGrossProfit", money.format(grossProfit));
  set("posCreditPayroll", money.format(checkPayroll));
  set("posTotalTips", money.format(totalTips));
  set("metricCashPayroll", money.format(cashPayroll));
  set("metricTotalExpenses", money.format(snapshot.expenses.totalExpenses));
  set("sampleDashboardRange", selectedRangeText());

  const expenseList = document.getElementById("posExpenseSummaryList");
  if (expenseList) {
    const preferred = ["Food", "Beverage", "Supplies", "Packaging", "Utilities", "Insurance", "Repairs & Maintenance", "Mortgage & Loans", "Check Payroll", "Cash Payroll", "Other Property", "Other"];
    const rows = sortedAccountingRows(categoryTotals).sort((a,b) => {
      const ai = preferred.includes(a[0]) ? preferred.indexOf(a[0]) : 999;
      const bi = preferred.includes(b[0]) ? preferred.indexOf(b[0]) : 999;
      return ai - bi || b[1] - a[1];
    });
    const total = rows.reduce((sum, [, amount]) => sum + currencyValue(amount), 0);
    expenseList.innerHTML = rows.filter(([, amount]) => currencyValue(amount) !== 0).slice(0, 9).map(([category, amount]) => `
      <button class="pos-info-row" type="button" data-pos-category="${esc(category)}">
        <span>${esc(category)}</span>
        <strong>${money.format(amount)}</strong>
        <em>${total ? percentText((amount / total) * 100) : "0.0%"}</em>
      </button>
    `).join("") + `
      <button class="pos-info-row total" type="button" id="posExpenseTotal">
        <span>Total Expenses</span>
        <strong>${money.format(total)}</strong>
        <em>100%</em>
      </button>
    `;
    expenseList.querySelectorAll("[data-pos-category]").forEach(button => {
      button.addEventListener("click", () => {
        const category = button.dataset.posCategory;
        const amount = rows.find(row => row[0] === category)?.[1] || 0;
        showDashboardDetails(`${category} Details`, money.format(amount), categoryDetailRows(category));
      });
    });
    expenseList.querySelector("#posExpenseTotal")?.addEventListener("click", () => showDashboardDetails("All Expenses", money.format(total), categoryDetailRows()));
  }

  const pnl = document.getElementById("posPnlSummaryList");
  if (pnl) {
    pnl.innerHTML = `
      <div class="pos-info-row"><span>Total Net Sales</span><strong>${money.format(snapshot.sales.netSales)}</strong></div>
      <div class="pos-info-row"><span>Cost of Goods Sold</span><strong>${money.format(cogs)}</strong></div>
      <div class="pos-info-row good"><span>Gross Profit</span><strong>${money.format(grossProfit)}</strong></div>
      <div class="pos-info-row"><span>Total Expenses</span><strong>${money.format(snapshot.expenses.totalExpenses)}</strong></div>
      <div class="pos-info-row good"><span>Net Profit</span><strong>${money.format(snapshot.netProfit)}</strong></div>
      <div class="pos-info-row good"><span>Profit Margin</span><strong>${percentText(snapshot.profitMargin)}</strong></div>
    `;
  }

  document.getElementById("posViewAllExpenses")?.addEventListener("click", () => showDashboardDetails("All Expenses", money.format(snapshot.expenses.totalExpenses), categoryDetailRows()));
  document.getElementById("posViewAllPriceAlerts")?.addEventListener("click", () => showDashboardDetails("Price Increase Insights", "", priceAlertDetailRows()));

  sampleRenderRecentActivity();
  sampleWireQuickActions();
}

function selectedRangeText() {
  const dates = (state.sales || []).map(item => item.date).filter(Boolean).sort();
  if (!dates.length) return "All dates";
  return `${dates[0]} to ${dates[dates.length - 1]}`;
}

function priceAlertDetailRows() {
  return (state.priceAlerts || []).map(alert => detailRow(alert.item || "Item", `${alert.previousDate || ""} to ${alert.date || ""} • Unit price comparison`, currencyValue(alert.currentPrice) - currencyValue(alert.previousPrice)));
}


function renderSquareDashboard(snapshot, cashData, categoryTotals) {
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  const cogs = currencyValue(categoryTotals.Food) + currencyValue(categoryTotals.Beverage) + currencyValue(categoryTotals.Supplies) + currencyValue(categoryTotals.Packaging);
  const grossProfit = snapshot.sales.netSales - cogs;
  const checkPayroll = currencyValue(categoryTotals["Check Payroll"]);
  const cashPayroll = currencyValue(categoryTotals["Cash Payroll"]);
  const totalTips = (snapshot.expenses.payrollItems || []).reduce((sum, item) => sum + waiterTipDeduction(item), 0);

  set("posGrossProfit", money.format(grossProfit));
  set("posCreditPayroll", money.format(checkPayroll));
  set("posTotalTips", money.format(totalTips));
  set("metricCashPayroll", money.format(cashPayroll));
  set("metricPayroll", money.format(cashPayroll + checkPayroll));
  set("metricTotalExpenses", money.format(snapshot.expenses.totalExpenses));
  set("metricInvoices", money.format(snapshot.expenses.invoiceTotal));
  set("sampleDashboardRange", selectedRangeText());
  set("squareDashboardDate", new Date().toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }));

  const expenseList = document.getElementById("posExpenseSummaryList");
  if (expenseList) {
    const preferred = ["Food", "Beverage", "Supplies", "Packaging", "Utilities", "Insurance", "Repairs & Maintenance", "Mortgage & Loans", "Check Payroll", "Cash Payroll", "Other Property", "Other"];
    const rows = sortedAccountingRows(categoryTotals).sort((a,b) => {
      const ai = preferred.includes(a[0]) ? preferred.indexOf(a[0]) : 999;
      const bi = preferred.includes(b[0]) ? preferred.indexOf(b[0]) : 999;
      return ai - bi || b[1] - a[1];
    });
    const total = rows.reduce((sum, [, amount]) => sum + currencyValue(amount), 0);
    expenseList.innerHTML = rows.filter(([, amount]) => currencyValue(amount) !== 0).slice(0, 9).map(([category, amount]) => `
      <button class="square-info-row" type="button" data-square-category="${esc(category)}">
        <span>${esc(category)}</span>
        <strong>${money.format(amount)}</strong>
      </button>
    `).join("") + `
      <button class="square-info-row total" type="button" id="squareExpenseTotal">
        <span>Total Expenses</span>
        <strong>${money.format(total)}</strong>
      </button>
    `;
    expenseList.querySelectorAll("[data-square-category]").forEach(button => {
      button.addEventListener("click", () => {
        const category = button.dataset.squareCategory;
        const amount = rows.find(row => row[0] === category)?.[1] || 0;
        showDashboardDetails(`${category} Details`, money.format(amount), categoryDetailRows(category));
      });
    });
    expenseList.querySelector("#squareExpenseTotal")?.addEventListener("click", () => showDashboardDetails("All Expenses", money.format(total), categoryDetailRows()));
  }

  const pnl = document.getElementById("posPnlSummaryList");
  if (pnl) {
    pnl.innerHTML = `
      <div class="square-info-row"><span>Total Net Sales</span><strong>${money.format(snapshot.sales.netSales)}</strong></div>
      <div class="square-info-row"><span>Cost of Goods Sold</span><strong>${money.format(cogs)}</strong></div>
      <div class="square-info-row good"><span>Gross Profit</span><strong>${money.format(grossProfit)}</strong></div>
      <div class="square-info-row"><span>Total Expenses</span><strong>${money.format(snapshot.expenses.totalExpenses)}</strong></div>
      <div class="square-info-row good"><span>Net Profit</span><strong>${money.format(snapshot.netProfit)}</strong></div>
      <div class="square-info-row good"><span>Profit Margin</span><strong>${percentText(snapshot.profitMargin)}</strong></div>
    `;
  }

  document.getElementById("posViewAllExpenses")?.addEventListener("click", () => showDashboardDetails("All Expenses", money.format(snapshot.expenses.totalExpenses), categoryDetailRows()));
  document.getElementById("posViewAllPriceAlerts")?.addEventListener("click", () => showDashboardDetails("Price Increase Insights", "", priceAlertDetailRows()));

  sampleRenderRecentActivity();
  sampleWireQuickActions();
}


function renderDashboard() {
  try { if ((state.toastPayroll || []).length) syncToastPayrollToPayroll(); } catch (error) { console.warn("Toast payroll sync skipped", error); }
  const employeePayrollTotal = state.payroll
    .filter(entry => String(entry.personId).startsWith("employee:"))
    .reduce((sum, entry) => sum + payrollFinalCheckAmount(entry), 0);
  const vendorPayrollTotal = state.payroll
    .filter(entry => String(entry.personId).startsWith("vendor:"))
    .reduce((sum, entry) => sum + payrollFinalCheckAmount(entry), 0);
  const invoiceTotal = state.invoices.reduce((sum, invoice) => sum + currencyValue(invoice.total), 0);
  const vendorPaymentTotal = vendorPayrollTotal + invoiceTotal;
  const totalSpend = employeePayrollTotal + vendorPaymentTotal;
  const categoryTotals = allCategorySpendingTotals(state.invoices, state.payroll);
  const foodCost = Object.entries(categoryTotals)
    .filter(([category]) => String(category || "").toLowerCase() === "food")
    .reduce((sum, [, total]) => sum + total, 0);
  const foodPercent = totalSpend ? Math.round((foodCost / totalSpend) * 100) : 0;
  const extraTotal = state.payroll.reduce((sum, entry) => sum + currencyValue(entry.extra), 0);
  const checkPayrollDashboardTotal = state.payroll
    .filter(entry => String(entry.method || "").toLowerCase() === "check")
    .reduce((sum, entry) => sum + payrollFinalCheckAmount(entry), 0);
  const tipDeductionTotal = state.payroll.reduce((sum, entry) => sum + waiterTipDeduction(entry), 0);
  const { start: cashStart, end: cashEnd } = getCashDashboardRange();
  const cashData = cashReportData(cashStart, cashEnd);
  const cashCollections = cashData.cashCollections;
  const cashCollectedTotal = cashData.cashCollectedTotal;
  const cashPayrollTotal = cashData.cashPayrollTotal;
  const cashExpenseTotal = cashData.cashExpensesTotal;
  const cashBalance = cashData.cashBalance;
  renderFinalCashOverview(cashStart, cashEnd);
  renderProfitDashboard(profitSnapshot(cashStart, cashEnd));

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText("metricTotalSpend", money.format(totalSpend));
  setText("metricPayroll", money.format(employeePayrollTotal));
  setText("metricVendorPayments", money.format(vendorPaymentTotal));
  setText("metricFoodCost", money.format(foodCost));
  setText("metricFoodPercent", `${foodPercent}% of spending`);
  setText("metricInvoices", money.format(invoiceTotal));
  setText("metricExtra", money.format(checkPayrollDashboardTotal));
  setText("metricTipDeduction", money.format(tipDeductionTotal));
  const metricCashCollected = document.getElementById("metricCashCollected");
  const metricCashPayroll = document.getElementById("metricCashPayroll");
  const metricCashExpenses = document.getElementById("metricCashExpenses");
  const metricCashBalance = document.getElementById("metricCashBalance");
  if (metricCashCollected) metricCashCollected.textContent = money.format(cashCollectedTotal);
  if (metricCashPayroll) metricCashPayroll.textContent = money.format(cashPayrollTotal);
  if (metricCashExpenses) metricCashExpenses.textContent = money.format(cashExpenseTotal);
  if (metricCashBalance) metricCashBalance.textContent = money.format(cashBalance);
  renderCashCollections(cashCollections, cashPayrollTotal, cashExpenseTotal, cashBalance);
  setText("categoryCount", `${Object.values(categoryTotals).filter(total => currencyValue(total) !== 0).length} categories`);
  renderDashboardCategorySpending(categoryTotals, totalSpend);
  renderSquareDashboard(profitSnapshot(cashStart, cashEnd), cashData, categoryTotals);
  attachDashboardMetricActions();
  initDashboardCardDrag();

  const categoryTotalAll = Object.values(categoryTotals).reduce((sum, value) => sum + currencyValue(value), 0);
  const categoryRows = Object.entries(categoryTotals)
    .map(([category, total]) => [category, currencyValue(total)])
    .filter(([, total]) => total !== 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category, total]) => {
      const percent = categoryTotalAll ? Math.round((total / categoryTotalAll) * 100) : 0;
      const row = document.createElement("div");
      row.className = "category-row";
      row.tabIndex = 0;
      row.role = "button";
      row.innerHTML = `
        <div class="category-row-top"><strong>${category}</strong><span>${money.format(total)}</span></div>
        <div class="category-bar"><i style="width: ${percent}%"></i></div>
        <small>${percent}% of total category spending • ${esc(categoryProfitMeta(category, total))}</small>`;
      const open = () => showDashboardDetails(`Category: ${category}`, money.format(total), categoryDetailRows(category));
      row.addEventListener("click", open);
      row.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
      return row;
    });
  renderList("categorySpendList", categoryRows, "No category spending yet. Add payroll, vendor payments, or invoices.");

  sampleRenderRecentActivity();
}


function propertyExpenseSummary() {
  const rows = state.propertyExpenses || [];
  const total = rows.reduce((sum, item) => sum + currencyValue(item.amount), 0);
  const byType = groupTotals(rows, item => readableCategory(item.type || item.category || "Property Expense"), item => currencyValue(item.amount));
  return { total, byType };
}

function renderPropertyExpenses() {
  const list = document.getElementById("propertyExpenseList");
  if (!list) return;
  const rows = (state.propertyExpenses || []).slice().sort((a,b) => String(b.date || "").localeCompare(String(a.date || "")));
  const summary = propertyExpenseSummary();
  const count = document.getElementById("propertyExpenseCount");
  const total = document.getElementById("propertyExpenseTotal");
  const summaryList = document.getElementById("propertyExpenseSummaryList");
  if (count) count.textContent = `${rows.length} entries`;
  if (total) total.textContent = money.format(summary.total);
  if (summaryList) {
    const typeRows = Object.entries(summary.byType).sort((a,b) => Math.abs(b[1]) - Math.abs(a[1]));
    summaryList.innerHTML = typeRows.length ? typeRows.map(([type, amount]) => `<div class="summary-line"><span>${esc(type)}</span><strong>${money.format(amount)}</strong></div>`).join("") : '<div class="status">No property expenses yet.</div>';
  }
  renderList("propertyExpenseList", rows.map(expense => {
    const row = rowItem(
      expense.vendorName || expense.payee || expense.property || expense.type || "Property Expense",
      `${expense.date || "No date"} • ${readableCategory(expense.type || expense.category || "Property Expense")} • ${expense.vendorType || "No vendor type"} • ${expense.reference || "No ref"} • ${expense.method || "Check"} • ${money.format(currencyValue(expense.amount))}`,
      () => deletePropertyExpense(expense.id),
      "invoice"
    );
    row.classList.add("clickable-property-expense-row");
    row.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      fillPropertyExpenseForm(expense.id);
    });
    appendEditButton(row, () => fillPropertyExpenseForm(expense.id), "Edit property expense");
    return row;
  }), "No property expenses saved yet.");
}

function fillPropertyExpenseForm(id) {
  const form = document.getElementById("propertyExpenseForm");
  const expense = (state.propertyExpenses || []).find(item => item.id === id);
  if (!form || !expense) return;
  form.elements.id.value = expense.id || "";
  form.elements.date.value = expense.date || "";
  form.elements.vendorName.value = expense.vendorName || expense.payee || expense.property || "";
  form.elements.type.value = expense.type || "";
  form.elements.vendorType.value = expense.vendorType || expense.payeeType || "";
  form.elements.reference.value = expense.reference || "";
  form.elements.amount.value = expense.amount || "";
  form.elements.method.value = expense.method || "";
  form.elements.notes.value = expense.notes || "";
  const btn = document.getElementById("propertyExpenseSubmit");
  if (btn) btn.textContent = "Save Property Expense";
}

function clearPropertyExpenseForm() {
  const form = document.getElementById("propertyExpenseForm");
  if (!form) return;
  form.reset();
  form.elements.id.value = "";
  form.elements.date.value = today;
  const btn = document.getElementById("propertyExpenseSubmit");
  if (btn) btn.textContent = "Add Property Expense";
}

function deletePropertyExpense(id) {
  const expense = (state.propertyExpenses || []).find(item => String(item.id) === String(id));
  const name = expense?.vendorName || expense?.payee || expense?.property || expense?.type || "this property expense";
  if (!window.confirm(`Delete ${name}?`)) return;
  state.propertyExpenses = (state.propertyExpenses || []).filter(item => String(item.id) !== String(id));
  const form = document.getElementById("propertyExpenseForm");
  if (form?.elements?.id && String(form.elements.id.value || "") === String(id || "")) clearPropertyExpenseForm();
  renderAll();
}

function addOptionIfMissing(kind, value, rerender = true) {
  const clean = String(value || "").trim();
  if (!clean) return false;
  state.options[kind] = state.options[kind] || [];
  const exists = state.options[kind].some(item => item.toLowerCase() === clean.toLowerCase());
  if (!exists) state.options[kind].push(clean);
  saveState();
  if (rerender) renderAll();
  return !exists;
}

function addPropertyVendorType() {
  const value = window.prompt("Enter property vendor type");
  if (!value) return;
  addOptionIfMissing("propertyVendorTypes", value);
  const form = document.getElementById("propertyExpenseForm");
  if (form?.elements?.vendorType) form.elements.vendorType.value = String(value).trim();
}

function savePropertyExpense(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formData(form);
  const existing = (state.propertyExpenses || []).find(item => item.id === data.id);
  const row = {
    id: data.id || uid("property-expense"),
    date: data.date || today,
    vendorName: data.vendorName || data.payee || data.property || "",
    vendorType: data.vendorType || data.payeeType || "",
    property: data.vendorName || data.property || "",
    type: data.type || data.category || "Property Expense",
    category: data.type || data.category || "Property Expense",
    payee: data.vendorName || data.payee || "",
    reference: data.reference || "",
    amount: currencyValue(data.amount),
    method: data.method || "Check",
    notes: data.notes || ""
  };
  if (row.vendorType) addOptionIfMissing("propertyVendorTypes", row.vendorType, false);
  if (row.vendorName && !(state.vendors || []).some(v => String(v.name || "").toLowerCase() === String(row.vendorName).toLowerCase())) {
    state.vendors.push({ id: uid("vendor"), name: row.vendorName, type: row.vendorType || "Property Expense", category: row.type || "Property Expense", contact: "" });
  }
  if (existing) Object.assign(existing, row);
  else state.propertyExpenses.push(row);
  clearPropertyExpenseForm();
  renderAll();
}

function renderAll() {
  try { window.restaPayState = state; } catch (_) {}
  renderSelects();
  renderVendors();
  renderEmployees();
  renderPayroll();
  renderWeeklyCashEmployees();
  renderInvoices();
  renderPropertyExpenses();
  renderOptionManager();
  renderDashboard();
  renderSales();
  renderToastPayroll();
  renderPriceAlerts();
  if (selectedInvoiceId) renderSelectedInvoice();
  updateInvoiceReadActions();
  saveState();
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function applyReportRange(range) {
  const start = document.getElementById("reportStart");
  const end = document.getElementById("reportEnd");
  const single = document.getElementById("reportSingleDate");
  document.querySelectorAll(".report-date-field").forEach(field => field.classList.remove("visible"));
  start.value = "";
  end.value = "";
  single.value = "";
  start.disabled = true;
  end.disabled = true;
  single.disabled = true;
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from = null;
  let to = new Date(date);

  if (range === "single") {
    document.getElementById("singleDateField").classList.add("visible");
    single.disabled = false;
    single.value = today;
    return;
  }
  if (range === "today") from = new Date(date);
  if (range === "week") {
    from = new Date(date);
    from.setDate(date.getDate() - date.getDay());
  }
  if (range === "month") from = new Date(date.getFullYear(), date.getMonth(), 1);
  if (range === "quarter") from = new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
  if (range === "year") from = new Date(date.getFullYear(), 0, 1);

  if (range === "all" || !range) {
    return;
  }

  document.getElementById("startDateField").classList.add("visible");
  document.getElementById("endDateField").classList.add("visible");
  start.disabled = false;
  end.disabled = false;
  if (range === "custom") return;
  start.value = toDateInput(from);
  end.value = toDateInput(to);
}

function groupTotals(items, keyFn, amountFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item) || "Blank";
    groups[key] = (groups[key] || 0) + amountFn(item);
    return groups;
  }, {});
}

function mergeTotals(...groups) {
  return groups.reduce((merged, group) => {
    Object.entries(group).forEach(([key, value]) => {
      merged[key] = (merged[key] || 0) + value;
    });
    return merged;
  }, {});
}

function showSummaryDetails(label, rows) {
  const reportOutput = document.getElementById("reportOutput");
  if (!reportOutput) return;
  reportOutput.innerHTML = "";
  const header = document.createElement("div");
  header.className = "section-header";
  header.textContent = `${label} Details`;
  reportOutput.append(header);
  if (!rows || !rows.length) {
    reportOutput.insertAdjacentHTML("beforeend", '<div class="status">No detail rows found for this total.</div>');
    return;
  }
  rows.forEach(row => reportOutput.append(row));
}

function summaryCard(label, value, tone, rows) {
  const card = document.createElement("div");
  card.className = `summary-card ${tone || ""}`;
  card.innerHTML = `<span>${label}</span><strong>${value}</strong><small>Click for details</small>`;
  card.tabIndex = 0;
  card.role = "button";
  card.title = `Show ${label} details`;
  card.addEventListener("click", () => showSummaryDetails(label, rows || []));
  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showSummaryDetails(label, rows || []);
    }
  });
  return card;
}

function detailRow(title, meta, amount) {
  const row = document.createElement("div");
  row.className = "row-item report-row";
  row.innerHTML = `<div><strong>${title}</strong><small>${meta}</small></div><strong>${money.format(amount)}</strong>`;
  return row;
}

function totalRows(groups) {
  return Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .map(([label, total]) => detailRow(label, "Grouped total", total));
}

function selectedCustomReportFields() {
  return [...document.querySelectorAll('#customReportPanel input[type="checkbox"]:checked')]
    .map(input => input.value);
}

function setCustomReportFields(fields) {
  document.querySelectorAll('#customReportPanel input[type="checkbox"]').forEach(input => {
    input.checked = fields.includes(input.value);
  });
}

function updateCustomReportPanel() {
  const panel = document.getElementById("customReportPanel");
  const reportForm = document.getElementById("reportForm");
  if (!panel || !reportForm) return;
  const type = reportForm.elements?.type?.value || "";
  const saved = reportForm.elements?.savedReport?.value || "";
  panel.classList.toggle("visible", type === "custom" || Boolean(saved));
}

function sectionHeader(title) {
  const row = document.createElement("div");
  row.className = "report-section-title";
  row.textContent = title;
  return row;
}


function exportReportPdf() {
  const reportSummary = document.getElementById("reportSummary");
  const reportOutput = document.getElementById("reportOutput");
  const reportTotal = document.getElementById("reportTotal");
  const reportForm = document.getElementById("reportForm");

  if (!reportOutput || !reportOutput.innerHTML.trim()) {
    alert("Generate a report first, then export PDF.");
    return;
  }

  const typeLabel = reportForm?.elements?.type?.selectedOptions?.[0]?.textContent || "Report";
  const rangeLabel = reportForm?.elements?.range?.selectedOptions?.[0]?.textContent || "Date range";
  const printedAt = new Date().toLocaleString();

  const printableRows = [...reportOutput.querySelectorAll(".row-item, .report-section-title, .status")]
    .map(node => {
      if (node.classList.contains("report-section-title")) {
        return `<tr class="section"><td colspan="3">${esc(node.textContent)}</td></tr>`;
      }
      if (node.classList.contains("status")) {
        return `<tr><td colspan="3">${esc(node.textContent)}</td></tr>`;
      }
      const title = node.querySelector("strong")?.textContent || "";
      const meta = node.querySelector("small")?.textContent || "";
      const amount = node.matches(".report-row") ? (node.lastElementChild?.textContent || "") : "";
      return `<tr><td>${esc(title)}</td><td>${esc(meta)}</td><td class="amount">${esc(amount)}</td></tr>`;
    })
    .join("");

  const summaryRows = [...(reportSummary?.querySelectorAll(".summary-card") || [])]
    .map(card => {
      const label = card.querySelector("span")?.textContent || "";
      const value = card.querySelector("strong")?.textContent || "";
      return `<tr><td>${esc(label)}</td><td class="amount">${esc(value)}</td></tr>`;
    })
    .join("");

  const html = `
<!doctype html>
<html>
<head>
  <title>${esc(typeLabel)}</title>
  <style>
    @page { margin: 0.45in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      font-family: Inter, Segoe UI, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      background: #fff;
    }
    .top {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: end;
      padding-bottom: 8px;
      border-bottom: 1px solid #d1d5db;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0;
      font-size: 17px;
      font-weight: 650;
      letter-spacing: -0.02em;
    }
    .meta {
      color: #6b7280;
      font-size: 10px;
      text-align: right;
    }
    .summary {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 10px;
    }
    .summary td {
      padding: 5px 7px;
      border-bottom: 1px solid #e5e7eb;
    }
    .summary td:first-child {
      color: #4b5563;
      width: 70%;
    }
    table.detail {
      width: 100%;
      border-collapse: collapse;
    }
    table.detail th {
      padding: 6px 7px;
      text-align: left;
      color: #374151;
      font-size: 10px;
      font-weight: 650;
      text-transform: uppercase;
      border-bottom: 1px solid #d1d5db;
      background: #f9fafb;
    }
    table.detail td {
      padding: 6px 7px;
      vertical-align: top;
      border-bottom: 1px solid #e5e7eb;
    }
    .amount {
      text-align: right;
      white-space: nowrap;
      font-weight: 650;
    }
    tr.section td {
      padding-top: 10px;
      color: #111827;
      font-weight: 650;
      background: #f3f4f6;
    }
    .footer {
      margin-top: 12px;
      padding-top: 6px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 9px;
      text-align: center;
    }
    @media print {
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>Resta Pay - ${esc(typeLabel)}</h1>
      <div class="meta" style="text-align:left;">${esc(rangeLabel)} • Total ${esc(reportTotal?.textContent || "$0.00")}</div>
    </div>
    <div class="meta">Printed ${esc(printedAt)}</div>
  </div>

  ${summaryRows ? `<table class="summary">${summaryRows}</table>` : ""}

  <table class="detail">
    <thead><tr><th>Item</th><th>Details</th><th class="amount">Amount</th></tr></thead>
    <tbody>${printableRows || '<tr><td colspan="3">No report rows.</td></tr>'}</tbody>
  </table>

  <div class="footer">Generated by Resta Pay</div>
  <script>
    window.onload = () => {
      window.print();
      setTimeout(() => window.close(), 500);
    };
  <\/script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup blocked. Please allow popups to export the report PDF.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}



function toastPaymentBreakdownReportRows(salesItems = []) {
  const keyed = {};
  salesItems.forEach(item => {
    (item.paymentRows || []).forEach(payment => {
      const type = String(payment.type || "").trim();
      if (!type || type.toLowerCase() === "payment type") return;
      const subType = String(payment.subType || "").trim();
      const key = `${type}||${subType}`;
      if (!keyed[key]) {
        keyed[key] = { type, subType, count: 0, amount: 0, tips: 0, tax: 0, total: 0 };
      }
      keyed[key].count += currencyValue(payment.count);
      keyed[key].amount += currencyValue(payment.amount);
      keyed[key].tips += currencyValue(payment.tips || payment.legacyTips);
      keyed[key].tax += currencyValue(payment.tax);
      keyed[key].total += currencyValue(payment.total);
    });
  });

  return Object.values(keyed).map(payment => {
    const label = payment.subType ? `${payment.type} - ${payment.subType}` : payment.type;
    return detailRow(
      label,
      `Toast Payments Summary • Count ${Math.round(payment.count || 0)} • Amount ${money.format(payment.amount)} • Tips ${money.format(payment.tips)} • Tax ${money.format(payment.tax)}`,
      payment.total || payment.amount
    );
  });
}

function salesReportRows(salesItems) {
  const totals = salesTotals(salesItems);
  const paymentBreakdown = toastPaymentBreakdownReportRows(salesItems);
  return [
    detailRow("Gross Sales", `${salesItems.length} sales entries`, totals.grossSales),
    detailRow("Net Sales", "Toast report net sales", totals.netSales),
    detailRow("Toast Cash Collected", "Actual Toast closeout cash", totals.cashCollected),
    detailRow("Cash Sales", "Toast Payments Summary amount", totals.cashSales),
    detailRow("Credit/Debit Sales", "Toast Payments Summary amount", totals.cardSales),
    detailRow("Other Sales", "Toast Payments Summary amount", totals.otherSales),
    detailRow("DoorDash Sales", "Toast Payments Summary amount", totals.doorDashSales),
    detailRow("Gift Card Sales", "Toast Payments Summary amount", totals.giftCardSales),
    ...paymentBreakdown,
    detailRow("Discounts", "Toast net sales summary", totals.discounts),
    detailRow("Refunds", "Toast net sales summary", totals.refunds),
    detailRow("Tax", "Toast report tax amount", totals.tax),
    detailRow("Tips", "Toast report tips", totals.tips),
    detailRow("Guests", `${Math.round(totals.guests || 0)} guests`, totals.guests || 0),
    detailRow("Checks", `${Math.round(totals.checks || 0)} checks`, totals.checks || 0)
  ];
}

function profitLossRows(start = "", end = "") {
  const snapshot = profitSnapshot(start, end);
  return [
    detailRow("Net Sales", "Sales revenue", snapshot.sales.netSales),
    detailRow("Employee Payroll", "Labor cost", snapshot.expenses.employeePayroll),
    detailRow("Vendor Payroll", "Vendor payroll/payments", snapshot.expenses.vendorPayroll),
    detailRow("Invoice Expenses", "All saved invoices", snapshot.expenses.invoiceTotal),
    detailRow("Total Expenses", "Payroll + invoices + property expenses", snapshot.expenses.totalExpenses),
    detailRow("Net Profit", "Net sales minus total expenses", snapshot.netProfit)
  ];
}

function restaurantKpiRows(start = "", end = "") {
  const snapshot = profitSnapshot(start, end);
  return [
    detailRow("Profit Margin", `${percentText(snapshot.profitMargin)} of net sales`, snapshot.netProfit),
    detailRow("Labor %", `${percentText(snapshot.laborPercent)} of net sales`, snapshot.expenses.employeePayroll),
    detailRow("Food Cost %", `${percentText(snapshot.foodPercent)} of net sales`, snapshot.expenses.foodCost),
    detailRow("Prime Cost %", `${percentText(snapshot.primeCostPercent)} of net sales`, snapshot.expenses.employeePayroll + snapshot.expenses.foodCost)
  ];
}


function toastCashSalesInRange(start = "", end = "") {
  return toastCashCollectedInRange(start, end);
}

function toastCashSalesRows(start = "", end = "") {
  return toastCashCollectedRows(start, end);
}








function cashReportData(start = "", end = "") {
  const inRange = item => (!start || (item.date && item.date >= start)) && (!end || (item.date && item.date <= end));

  const cashCollections = toastCashCollectedRows(start, end);
  const payroll = state.payroll.filter(inRange);
  const invoices = state.invoices.filter(inRange);

  const cashCollectedTotal = toastCashCollectedInRange(start, end);

  const cashPayrollTotal = payroll
    .filter(entry => String(entry.personId).startsWith("employee:"))
    .filter(entry => String(entry.method || "").toLowerCase() === "cash")
    .reduce((sum, entry) => sum + payrollFinalCheckAmount(entry), 0);

  const cashVendorPayrollTotal = payroll
    .filter(entry => String(entry.personId).startsWith("vendor:"))
    .filter(entry => String(entry.method || "").toLowerCase() === "cash")
    .reduce((sum, entry) => sum + payrollFinalCheckAmount(entry), 0);

  const cashInvoiceTotal = invoices
    .filter(invoice => String(invoice.method || "").toLowerCase() === "cash")
    .reduce((sum, invoice) => sum + currencyValue(invoice.total), 0);

  const cashExpensesTotal = cashVendorPayrollTotal + cashInvoiceTotal;
  const cashBalance = cashCollectedTotal - cashPayrollTotal - cashExpensesTotal;

  return {
    cashCollections,
    cashCollectedTotal,
    cashPayrollTotal,
    cashVendorPayrollTotal,
    cashInvoiceTotal,
    cashExpensesTotal,
    cashBalance
  };
}

function removeById(collection, id) {
  const targetId = String(id || "");
  state[collection] = state[collection].filter(item => String(item.id || "") !== targetId);
  renderAll();
}


function chooseEmployeeDeleteAction(id, name) {
  const targetId = String(id || "");
  const employee = (state.employees || []).find(item => String(item.id || "") === targetId)
    || (state.employees || []).find(item => String(item.name || "").trim().toLowerCase() === String(name || "").trim().toLowerCase());
  if (!employee) return;
  const employeeName = String(employee.name || name || "this employee");

  const existing = document.getElementById("employeeDeleteChoiceModal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "employeeDeleteChoiceModal";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(15, 23, 42, 0.55)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "99999";

  const box = document.createElement("div");
  box.style.background = "#fff";
  box.style.borderRadius = "16px";
  box.style.padding = "22px";
  box.style.maxWidth = "460px";
  box.style.width = "calc(100% - 32px)";
  box.style.boxShadow = "0 20px 55px rgba(15, 23, 42, 0.35)";
  box.innerHTML = `
    <h3 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Delete employee?</h3>
    <p style="margin:0 0 16px;color:#475569;line-height:1.4;">What do you want to do with <strong>${esc(employeeName)}</strong>?</p>
    <div style="display:grid;gap:10px;">
      <button type="button" data-choice="archive" style="padding:12px 14px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer;">Archive employee - hide from active list, keep payroll history</button>
      <button type="button" data-choice="delete" style="padding:12px 14px;border:0;border-radius:10px;background:#dc2626;color:#fff;font-weight:700;cursor:pointer;">Delete permanently - remove from employee list</button>
      <button type="button" data-choice="cancel" style="padding:10px 14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;font-weight:700;cursor:pointer;">Cancel</button>
    </div>
  `;

  overlay.append(box);
  document.body.append(overlay);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) overlay.remove();
  });
  box.querySelectorAll("button[data-choice]").forEach(button => {
    button.addEventListener("click", () => {
      const choice = button.getAttribute("data-choice");
      overlay.remove();
      if (choice === "archive") archiveEmployee(employee.id, employeeName);
      if (choice === "delete") permanentlyDeleteEmployee(employee.id, employeeName);
    });
  });
}

function archiveEmployee(id, name) {
  const targetId = String(id || "");
  const targetName = String(name || "").trim().toLowerCase();
  const employee = (state.employees || []).find(item => String(item.id || "") === targetId)
    || (state.employees || []).find(item => String(item.name || "").trim().toLowerCase() === targetName);
  if (!employee) return;

  const employeeName = String(employee.name || name || "this employee");
  const linkedPayroll = (state.payroll || []).filter(entry => String(entry.personId || "") === `employee:${employee.id}`).length;
  const linkedToastPayroll = (state.toastPayroll || []).filter(entry => String(entry.personId || "") === `employee:${employee.id}` || String(entry.employee || "").trim().toLowerCase() === employeeName.trim().toLowerCase()).length;
  const message = linkedPayroll || linkedToastPayroll
    ? `Archive ${employeeName}?\n\nPayroll history will be kept for reports. This employee will be hidden from new payroll dropdowns. Linked rows: ${linkedPayroll + linkedToastPayroll}.`
    : `Archive ${employeeName}?`;
  if (!window.confirm(message)) return;

  (state.employees || []).forEach(item => {
    if (String(item.id || "") === String(employee.id || "") || String(item.name || "").trim().toLowerCase() === employeeName.trim().toLowerCase()) {
      item.inactive = true;
      item.deletedAt = today;
    }
  });
  renderAll();
}

function restoreEmployee(id) {
  const employee = (state.employees || []).find(item => String(item.id || "") === String(id || ""));
  if (!employee) return;
  employee.inactive = false;
  delete employee.deletedAt;
  renderAll();
}

function permanentlyDeleteEmployee(id, name) {
  const employee = (state.employees || []).find(item => String(item.id || "") === String(id || ""));
  const employeeName = String(employee?.name || name || "this employee");
  if (!window.confirm(`Permanently delete ${employeeName}?\n\nThis removes the employee from the employee list but keeps saved payroll history.`)) return;
  state.employees = (state.employees || []).filter(item => String(item.id || "") !== String(id || ""));
  renderAll();
}

function bulkArchiveVisibleEmployees() {
  const rows = visibleEmployeesForList().filter(employee => !employee.inactive && !employee.deletedAt);
  if (!rows.length) {
    window.alert("No active visible employees to archive.");
    return;
  }
  if (!window.confirm(`Archive ${rows.length} visible employee(s)? Payroll history will be kept.`)) return;
  const ids = new Set(rows.map(employee => String(employee.id || "")));
  (state.employees || []).forEach(employee => {
    if (ids.has(String(employee.id || ""))) {
      employee.inactive = true;
      employee.deletedAt = today;
    }
  });
  renderAll();
}

function removeOption(kind, value) {
  state.options[kind] = (state.options[kind] || []).filter(item => item !== value);
  renderAll();
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function showView(viewId) {
  const button = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  const view = document.getElementById(viewId);
  if (!button || !view) return;
  const sidebar = document.querySelector(".sidebar");
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  document.querySelectorAll(".view").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  view.classList.add("active");
  document.getElementById("viewTitle").textContent = button.textContent.trim();
  sidebar?.classList.add("is-collapsed");
  button.blur();
}

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.querySelectorAll("[data-go-view]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.goView));
});

document.querySelector(".sidebar").addEventListener("mouseenter", event => {
  event.currentTarget.classList.remove("is-collapsed");
});




document.getElementById("toastSalesEditForm")?.addEventListener("submit", saveToastSalesEdit);
document.getElementById("toastSalesEditForm")?.addEventListener("input", updateToastSalesEditReconcile);
document.getElementById("closeToastSalesEdit")?.addEventListener("click", closeToastSalesEdit);
document.getElementById("deleteToastSalesRow")?.addEventListener("click", deleteToastSalesSelectedRow);





document.getElementById("propertyExpenseForm")?.addEventListener("submit", savePropertyExpense);
document.getElementById("clearPropertyExpenseForm")?.addEventListener("click", clearPropertyExpenseForm);
document.getElementById("addPropertyVendorType")?.addEventListener("click", addPropertyVendorType);

document.getElementById("salesForm")?.addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  state.sales.push({
    id: uid("sales"),
    date: data.date || today,
    grossSales: data.grossSales || "0",
    netSales: data.netSales || "0",
    cashSales: data.cashSales || "0",
    cardSales: data.cardSales || "0",
    doorDashSales: data.doorDashSales || "0",
    uberEatsSales: data.uberEatsSales || "0",
    grubhubSales: data.grubhubSales || "0",
    giftCardSales: data.giftCardSales || "0",
    otherSales: data.otherSales || "0",
    discounts: data.discounts || "0",
    refunds: data.refunds || "0",
    tips: data.tips || "0"
  });
  event.currentTarget.reset();
  if (event.currentTarget.date) if (event.currentTarget.date) event.currentTarget.date.value = today;
  renderAll();
});



document.getElementById("toastPayrollEditForm")?.addEventListener("submit", saveToastPayrollEdit);
document.getElementById("closeToastPayrollEdit")?.addEventListener("click", closeToastPayrollEdit);
document.getElementById("deleteToastPayrollRow")?.addEventListener("click", deleteToastPayrollSelectedRow);
["totalTips", "tipsWithheld", "manualExtraPay", "paymentMethod"].forEach(name => {
  document.querySelector(`#toastPayrollEditForm [name="${name}"]`)?.addEventListener("input", () => {
    const form = document.getElementById("toastPayrollEditForm");
    const calc = document.getElementById("toastPayrollCalculation");
    if (!form || !calc) return;
    const temp = {
      totalTips: currencyValue(form.totalTips.value),
      tipsWithheld: currencyValue(form.tipsWithheld.value),
      manualExtraPay: currencyValue(form.manualExtraPay.value)
    };
    calc.innerHTML = toastPayrollCalculationHtml(temp);
  });
});


document.getElementById("toastSalesFile")?.addEventListener("change", async event => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  if (!window.XLSX) {
    setToastImportStatus("Missing XLSX library. Run npm install, restart the app, then try again.");
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const salesRows = parseToastSalesWorkbook(workbook, file.name);
    const result = upsertSalesRows(salesRows);
    const importedRange = salesRows.find(row => row.weekStart || row.weekEnd || row.date) || null;
    const cashStartInput = document.getElementById("cashStartDate");
    const cashEndInput = document.getElementById("cashEndDate");
    if (importedRange && cashStartInput && cashEndInput) {
      cashStartInput.value = importedRange.weekStart || importedRange.date || "";
      cashEndInput.value = importedRange.weekEnd || importedRange.date || importedRange.weekStart || "";
    }
    setToastImportStatus(`Imported Toast sales: ${result.added} added, ${result.updated} updated. Actual closeout cash ${money.format(salesRows.reduce((sum, row) => sum + toastCashCollectedAmount(row), 0))}.`);
    if (event.currentTarget) event.currentTarget.value = "";
    refreshAfterToastImport();
  } catch (error) {
    console.error(error);
    setToastImportStatus(`Toast sales import failed: ${error.message}`);
  }
});

document.getElementById("toastPayrollFile")?.addEventListener("change", async event => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const rows = parseToastPayrollCsv(text, file.name);
    state.toastPayroll = state.toastPayroll.filter(item => item.source !== "Toast Payroll CSV");
    state.toastPayroll.push(...rows);
    syncToastPayrollToPayroll();
    setToastPayrollImportStatus(`Imported Toast payroll: ${rows.length} employee rows and saved them to Payroll/Expenses as Check payments. Use Edit to change payment method.`);
    if (event.currentTarget) event.currentTarget.value = "";
    refreshAfterToastImport();
  } catch (error) {
    console.error(error);
    setToastPayrollImportStatus(`Toast payroll import failed: ${error.message}`);
  }
});

document.getElementById("cashCollectionForm")?.addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  if (!currencyValue(data.amount)) {
    document.getElementById("cashCollectionStatus").textContent = "Enter a cash collected amount.";
    return;
  }
  state.cashCollections.push({
    id: uid("cash"),
    date: data.date || today,
    amount: data.amount,
    note: data.note || ""
  });
  event.currentTarget.reset();
  if (event.currentTarget.date) if (event.currentTarget.date) event.currentTarget.date.value = today;
  document.getElementById("cashCollectionStatus").textContent = "Cash collected saved.";
  renderAll();
});

document.getElementById("applyCashRange")?.addEventListener("click", renderAll);
document.querySelectorAll("[data-cash-range]").forEach(button => {
  button.addEventListener("click", () => setCashDashboardRange(button.dataset.cashRange));
});

document.getElementById("vendorForm")?.addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formData(form);
  const existing = (state.vendors || []).find(item => String(item.id || "") === String(data.id || ""));
  const row = {
    id: data.id || uid("vendor"),
    name: String(data.name || "").trim(),
    type: data.type || "",
    category: data.category || "",
    contact: data.contact || ""
  };
  if (!row.name) return;
  if (existing) Object.assign(existing, row);
  else state.vendors.push(row);
  clearVendorForm();
  renderAll();
});

document.getElementById("clearVendorForm")?.addEventListener("click", clearVendorForm);

document.getElementById("employeeForm").addEventListener("submit", event => {
  event.preventDefault();
  state.employees.push({ id: uid("employee"), ...formData(event.currentTarget) });
  event.currentTarget.reset();
  renderAll();
});

document.getElementById("payrollForm").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formData(form);
  const row = { id: data.id || uid("payroll"), ...data, extra: data.extra || "0", reason: data.reason || "" };
  delete row.idValue;

  const index = (state.payroll || []).findIndex(item => String(item.id || "") === String(row.id || ""));
  if (index >= 0) {
    state.payroll[index] = { ...state.payroll[index], ...row };
  } else {
    state.payroll.push(row);
  }

  clearPayrollForm();
  renderAll();
});

document.getElementById("clearPayrollEdit")?.addEventListener("click", clearPayrollForm);
document.getElementById("weeklyCashEmployeeForm")?.addEventListener("submit", saveWeeklyCashEmployee);
document.getElementById("clearWeeklyCashEmployee")?.addEventListener("click", clearWeeklyCashEmployeeForm);
document.getElementById("autoAddWeeklyCashPayments")?.addEventListener("click", autoAddWeeklyCashPayments);

document.getElementById("invoiceForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  delete data.file;
  const lineItems = cleanInvoiceItems(currentInvoiceItems);
  const lineTotal = lineItems.reduce((sum, item) => sum + currencyValue(item.total), 0);
  if (!currencyValue(data.total) && lineTotal) data.total = String(lineTotal.toFixed(2));
  const priceAlerts = buildPriceAlertsForInvoice({ ...data, lineItems });
  state.priceAlerts = [...priceAlerts, ...(state.priceAlerts || [])].slice(0, 100);
  state.invoices.push({
    id: uid("invoice"),
    ...data,
    categoryTotals: invoiceCategoryTotals([{ ...data, lineItems }]),
    lineItems,
    ai: lastInvoiceRead ? { ...lastInvoiceRead, lineItems } : null,
    priceAlerts
  });
  event.currentTarget.reset();
  lastInvoiceRead = null;
  currentInvoiceItems = [];
  document.getElementById("invoiceFile") && (document.getElementById("invoiceFile").value = "");
  document.getElementById("invoiceCameraFile") && (document.getElementById("invoiceCameraFile").value = "");
  document.getElementById("localInvoiceFile") && (document.getElementById("localInvoiceFile").value = "");
  document.getElementById("invoiceStatus").textContent = "Invoice saved.";
  document.getElementById("invoicePreview").className = "invoice-preview empty";
  document.getElementById("invoicePreview").textContent = "No invoice read yet.";
  renderInvoiceLineEditor();
  renderAll();
});

document.querySelectorAll("[data-add-type]").forEach(button => {
  button.addEventListener("click", () => openOptionModal(button.dataset.addType));
});

function openOptionModal(kind) {
  const node = document.getElementById("typePrompt").content.cloneNode(true);
  const backdrop = node.querySelector(".modal-backdrop");
  const form = node.querySelector("form");
  form.querySelector("h2").textContent = `Add ${kind.replace(/([A-Z])/g, " $1").toLowerCase()}`;
  form.addEventListener("submit", event => {
    event.preventDefault();
    const value = form.value.value.trim();
    if (value && !state.options[kind].includes(value)) state.options[kind].push(value);
    backdrop.remove();
    renderAll();
  });
  node.querySelector("[data-close]").addEventListener("click", () => backdrop.remove());
  document.body.append(node);
  document.querySelector(".modal input").focus();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fileToLooseText(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let text = "";
  for (let index = 0; index < bytes.length; index += 1) {
    const code = bytes[index];
    if (code === 10 || code === 13) text += "\n";
    else text += code >= 32 && code <= 126 ? String.fromCharCode(code) : " ";
  }
  return text.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
}

function inferCategory(text) {
  const value = String(text || "").toLowerCase();
  const rules = [
    ["Cleaning", ["clean", "cleaner", "soap", "sanitizer", "sani", "degreaser", "bleach", "detergent", "mop", "broom", "disinfect", "chemical", "deodorizer", "scrub", "trash liner", "wiper"]],
    ["Packaging", ["clamshell", "to go", "takeout", "carryout", "container", "hinged", "foil pan", "film", "wrap", "bag", "box", "carton", "packaging"]],
    ["Supplies", ["supply", "supplies", "napkin", "straw", "glove", "paper", "cup", "lid", "utensil", "fork", "spoon", "knife", "plate", "receipt", "roll", "ticket", "register tape"]],
    ["Beverage", ["soda", "tea", "coffee", "juice", "beer", "wine", "drink", "beverage", "bar mix", "syrup", "water"]],
    ["Food", [
      "food", "us foods", "sysco", "pfg", "gfs", "beef", "steak", "brisket", "chicken", "pork", "bacon", "ham", "sausage", "turkey", "fish", "shrimp", "seafood",
      "produce", "lettuce", "tomato", "onion", "pepper", "cilantro", "avocado", "lime", "lemon", "potato", "bean", "beans", "pinto", "rice", "corn", "jalapeno",
      "cheese", "milk", "cream", "butter", "egg", "eggs", "flour", "tortilla", "chips", "bread", "bun", "roll", "oil", "sauce", "salsa", "seasoning", "salt",
      "sugar", "spice", "mix", "topping", "dressing", "mayo", "ketchup", "mustard", "frozen", "refrigerated", "dry goods"
    ]],
    ["Equipment", ["oven", "freezer", "cooler", "equipment", "machine"]],
    ["Maintenance", ["repair", "maintenance", "service call", "plumbing", "electric"]]
  ];
  return rules.find(([, words]) => words.some(word => value.includes(word)))?.[0] || "Other";
}

function parseAmount(text, labels) {
  for (const label of labels) {
    const match = String(text).match(new RegExp(`${label}[^0-9$-]*\\$?\\s*([0-9,]+(?:\\.\\d{2})?)`, "i"));
    if (match) return currencyValue(match[1].replace(/,/g, ""));
  }
  return 0;
}

function normalizeInvoiceDate(value) {
  const match = String(value || "").match(/^(\d{1,2})[-/](\d{1,2})[-/](20\d{2})$/);
  if (!match) return String(value || "");
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function largestMoneyAmount(text) {
  const amounts = [...String(text || "").matchAll(/\$?\s*(\(?-?[0-9,]+\.\d{2}\)?)/g)]
    .map(match => currencyValue(match[1]))
    .filter(amount => amount !== 0);
  if (!amounts.length) return 0;
  return amounts.reduce((best, amount) => Math.abs(amount) > Math.abs(best) ? amount : best, 0);
}

function isPdfInternalLine(line) {
  return /(?:\/Rect|\/Subtype|\/Annot|\/Font|\/XObject|endobj|obj\b|stream|xref|trailer|\/Type|\/Catalog|\/Page|BT|ET|\[[\d.\s]+\])/.test(line);
}

function isInvoiceLikeLine(line) {
  const value = String(line || "").toLowerCase();
  return /[a-z]{3,}/i.test(line)
    && !isPdfInternalLine(line)
    && !/[<>[\]{}]/.test(line)
    && /(food|beef|chicken|pork|fish|produce|clean|soap|supply|napkin|cup|container|invoice|total|tax|case|each|lb|oz|gal|us foods|sysco|item|qty|quantity)/i.test(value);
}

function hasUsefulInvoiceText(text) {
  const value = String(text || "").toLowerCase();
  const invoiceWords = ["invoice", "total", "amount due", "qty", "quantity", "item", "tax", "vendor", "us foods", "sysco"];
  const pdfNoise = (value.match(/\/rect|\/subtype|endobj|xref|\/font|\/xobject/g) || []).length;
  const wordHits = invoiceWords.filter(word => value.includes(word)).length;
  return wordHits >= 2 && pdfNoise < 8;
}

function parseLocalInvoice(file, text) {
  const usFoodsInvoice = parseUsFoodsInvoice(file, text);
  if (usFoodsInvoice) return usFoodsInvoice;

  const invoiceNumber = text.match(/(?:invoice|inv|big)[\s#:*-]*([A-Z0-9-]{3,})/i)?.[1] || "";
  const date = normalizeInvoiceDate(text.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b/)?.[1] || "");
  const total = parseAmount(text, ["invoice total", "amount due", "total due", "grand total", "total"]) || 0;
  const vendorGuess = state.vendors.find(vendor => text.toLowerCase().includes(vendor.name.toLowerCase()));
  const candidates = text.split(/(?:~|\n|\r| {2,})/).map(line => line.trim()).filter(Boolean);
  const lineItems = candidates
    .filter(isInvoiceLikeLine)
    .map(line => {
      const amount = line.match(/\$?\s*(\(?-?[0-9,]+\.\d{2}\)?)/);
      if (!amount || line.length < 5) return null;
      return {
        description: line.slice(0, 90),
        quantity: "",
        unitPrice: 0,
        total: currencyValue(amount[1]),
        category: inferCategory(line)
      };
    })
    .filter(Boolean)
    .slice(0, 20);
  const categoryTotals = groupTotals(lineItems, item => item.category, item => currencyValue(item.total));
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || inferCategory(text);

  return {
    vendorName: vendorGuess?.name || "",
    vendorId: vendorGuess?.id || "",
    invoiceNumber,
    invoiceDate: date,
    dueDate: "",
    total,
    tax: parseAmount(text, ["tax", "sales tax"]),
    category: topCategory,
    confidence: lineItems.length ? 0.55 : 0.2,
    summary: `Local-first import from ${file.name}. ${lineItems.length ? "Categorized readable lines locally." : "No readable line items found; AI fallback may be needed."}`,
    lineItems,
    localOnly: true
  };
}

function parseUsFoodsInvoice(file, text) {
  if (!/US Foods/i.test(text) && !/order\.usfoods\.com/i.test(text)) return null;
  const lines = String(text || "").split(/\n/).map(line => line.trim()).filter(Boolean);
  const invoiceDate = normalizeInvoiceDate(text.match(/(\d{2}\/\d{2}\/20\d{2})\s+INVOICE DATE/i)?.[1]
    || text.match(/SHIPPED DATE:\s*(\d{2}\/\d{2}\/20\d{2})/i)?.[1]
    || "");
  const invoiceNumber = text.match(/(\d{5,})\s+INVOICE NUMBERACCOUNT NUMBER/i)?.[1]
    || text.match(/INVOICE NUMBER\s*([0-9]+)/i)?.[1]
    || "";
  const total = largestMoneyAmount(text)
    || parseAmount(text, ["DELIVERED AMOUNT", "PLEASE REMIT THIS AMOUNT BY", "AS SHIPPED DELIVERY AMOUNT"])
    || currencyValue(text.match(/\$([0-9,]+\.\d{2})\s*TOTAL GROSS WEIGHT/i)?.[1]?.replace(/,/g, ""))
    || 0;

  const sections = new Set(["DRY", "REFRIGERATED", "FROZEN"]);
  let section = "Food";
  const lineItems = [];
  for (const line of lines) {
    if (sections.has(line)) {
      section = line === "DRY" ? "Supplies" : "Food";
      continue;
    }
    const match = line.match(/^\d+\s+\d+\s+\d+\s+\S+\s+(\d{4,})\s+(.+?)\s+\$?([0-9,]+\.\d{2,4})\s+\$?([0-9,]+\.\d{2})$/);
    if (!match) continue;
    const description = match[2].replace(/\s+/g, " ").trim();
    const amount = currencyValue(match[4].replace(/,/g, ""));
    if (!description || !amount) continue;
    lineItems.push({
      description,
      quantity: "",
      unitPrice: currencyValue(match[3].replace(/,/g, "")),
      total: amount,
      category: inferCategory(`${description} ${section}`)
    });
  }

  const categoryTotals = groupTotals(lineItems, item => item.category, item => currencyValue(item.total));
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "Food";
  return {
    vendorName: "US Foods",
    vendorId: state.vendors.find(vendor => /us foods/i.test(vendor.name))?.id || "",
    invoiceNumber,
    invoiceDate,
    dueDate: normalizeInvoiceDate(text.match(/(\d{2}\/\d{2}\/20\d{2})TOTAL GROSS WEIGHT/i)?.[1] || ""),
    total,
    tax: parseAmount(text, ["Sales Tax"]),
    category: topCategory,
    confidence: lineItems.length ? 0.8 : 0.35,
    summary: `US Foods invoice import from ${file.name}. Parsed ${lineItems.length} line items from invoice line details.`,
    lineItems,
    localOnly: true
  };
}

async function readLocalInvoiceFile(file, options = {}) {
  const status = document.getElementById("invoiceStatus");
  const preview = document.getElementById("invoicePreview");
  if (!file) {
    status.textContent = "Choose an EDI, PDF, image, text, or CSV invoice first.";
    return;
  }
  status.textContent = "Trying local invoice breakdown first...";
  preview.className = "invoice-preview";
  preview.textContent = "Reading available text and matching restaurant categories locally.";
  try {
    const text = file.type.startsWith("image/") ? "" : await fileToLooseText(file);
    const invoice = parseLocalInvoice(file, text);
    const needsAiFallback = !hasUsefulInvoiceText(text) || (!invoice.lineItems.length && !invoice.total && !invoice.invoiceNumber);
    if (needsAiFallback && !options.skipAiFallback) {
      status.textContent = "Local import could not read this invoice. Sending it to Gemini AI now...";
      preview.textContent = "This invoice needs AI reading, so Gemini will break it down into restaurant categories.";
      await readInvoiceFile(file);
      return;
    }
    lastInvoiceRead = invoice;
    applyInvoice(invoice);
    status.textContent = invoice.lineItems.length
      ? "Local invoice breakdown completed. Review it, then click Save Read Invoice or Delete / Clear Read Invoice."
      : "Local import found limited invoice details. Review it, then click Save Read Invoice or Delete / Clear Read Invoice.";
    updateInvoiceReadActions();
  } catch (error) {
    if (!options.skipAiFallback) {
      status.textContent = "Local reading failed. Trying Gemini AI now...";
      await readInvoiceFile(file);
      return;
    }
    status.textContent = "Local reading failed. You can still enter the invoice manually.";
    preview.className = "invoice-preview empty";
    preview.textContent = error.message;
  }
}

async function readInvoiceFile(file) {
  const status = document.getElementById("invoiceStatus");
  const preview = document.getElementById("invoicePreview");
  if (!file) {
    status.textContent = "Choose or capture an invoice first.";
    return;
  }
  if (window.location.protocol === "file:") {
    status.textContent = "The app is opened as a file, so AI upload cannot reach the server. Start it with Start Restaurant App.bat or npm start, then open http://localhost:4173.";
    preview.className = "invoice-preview empty";
    preview.textContent = "Do not double-click index.html for AI reading. The invoice API only works when the Node server is running.";
    return;
  }
  status.textContent = "Reading invoice with AI...";
  preview.className = "invoice-preview";
  preview.textContent = "Scanning vendor, total, categories, and line items.";
  try {
    const base64 = await fileToBase64(file);
    const response = await fetch("/api/read-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, mimeType: file.type || "image/jpeg" })
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = { error: "The invoice server returned an unreadable response. Make sure server.js is running from this project folder." };
    }
    if (!response.ok) {
      const error = new Error(data.error || "Invoice reading failed.");
      error.code = data.code;
      throw error;
    }
    lastInvoiceRead = data.invoice;
    applyInvoice(data.invoice);
    status.textContent = `Invoice read with ${Math.round((data.invoice.confidence || 0) * 100)}% confidence. Review it, then click Save Read Invoice or Delete / Clear Read Invoice.`;
    updateInvoiceReadActions();
  } catch (error) {
    const text = await fileToLooseText(file).catch(() => "");
    if (text && text.length > 40 && hasUsefulInvoiceText(text)) {
      const invoice = parseLocalInvoice(file, text);
      if (invoice.lineItems.length || invoice.total || invoice.invoiceNumber) {
        lastInvoiceRead = invoice;
        applyInvoice(invoice);
        status.textContent = "Gemini AI failed, but local text breakdown recovered invoice details. Review it, then click Save Read Invoice or Delete / Clear Read Invoice.";
        updateInvoiceReadActions();
        return;
      }
    }
    const failedToFetch = error instanceof TypeError || String(error.message || "").toLowerCase().includes("failed to fetch");
    if (failedToFetch) {
      status.textContent = "Cannot reach the invoice server. Start the app with Start Restaurant App.bat or npm start, then open http://localhost:4173.";
      preview.className = "invoice-preview empty";
      preview.textContent = "This usually happens when index.html is opened directly, the Node server is not running, the server crashed, or a firewall blocked localhost:4173.";
      return;
    }
    status.textContent = error.code === "GEMINI_QUOTA_EXCEEDED"
      ? "Gemini quota is exceeded. Manual entry is available, or try a readable text/EDI invoice with Local First Import."
      : `Gemini AI could not read this invoice: ${error.message}`;
    preview.className = "invoice-preview empty";
    preview.textContent = error.code === "GEMINI_QUOTA_EXCEEDED"
      ? "Gemini account limit is still blocking AI reading. Use manual fields below or try Local First Import for readable EDI/text invoices."
      : "AI and local fallback could not break this invoice down. Enter the invoice manually below.";
    updateInvoiceReadActions();
  }
}

function invoiceLineTotals(items = currentInvoiceItems) {
  return groupTotals(cleanInvoiceItems(items), item => item.category || "Other", item => currencyValue(item.total));
}

function updateInvoicePreview() {
  if (!lastInvoiceRead) return;
  const items = cleanInvoiceItems(currentInvoiceItems);
  const categoryTotals = invoiceLineTotals(items);
  const categoryRows = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, total]) => `<tr><td>${esc(category)}</td><td>${money.format(total)}</td></tr>`)
    .join("");
  const detailRows = items.slice(0, 18)
    .map(item => `<tr><td>${esc(item.description)}</td><td>${esc(item.category)}</td><td>${money.format(currencyValue(item.total))}</td></tr>`)
    .join("");
  const form = document.getElementById("invoiceForm");
  const total = currencyValue(form.total.value) || currencyValue(lastInvoiceRead.total);
  document.getElementById("invoicePreview").className = "invoice-preview";
  document.getElementById("invoicePreview").innerHTML = `
    <strong>${esc(lastInvoiceRead.vendorName || "Unknown vendor")}</strong><br>
    ${lastInvoiceRead.localOnly ? "Local-first breakdown" : "AI invoice breakdown"}: ${esc(lastInvoiceRead.summary || "Invoice breakdown")}<br>
    Total: <strong>${money.format(total)}</strong> • Category: <strong>${esc(form.category.value || lastInvoiceRead.category || "Other")}</strong> • Margin: <strong>${esc(marginText(form.manualProfitMargin?.value || categoryMargin(form.category.value || lastInvoiceRead.category || "Other")))}</strong>
    <div class="invoice-detail-title">Category totals</div>
    <table class="invoice-table">
      <thead><tr><th>Category</th><th>Total</th></tr></thead>
      <tbody>${categoryRows || '<tr><td>No category totals found</td><td>$0.00</td></tr>'}</tbody>
    </table>
    <div class="invoice-detail-title">Line details</div>
    <table class="invoice-table">
      <thead><tr><th>Item</th><th>Category</th><th>Total</th></tr></thead>
      <tbody>${detailRows || '<tr><td>No readable line details found</td><td>Manual</td><td>$0.00</td></tr>'}</tbody>
    </table>`;
  updateInvoiceReadActions();
}

function renderInvoiceLineEditor() {
  const editor = document.getElementById("invoiceLineEditor");
  const totals = document.getElementById("invoiceLineTotals");
  if (!editor || !totals) return;

  currentInvoiceItems = cleanInvoiceItems(currentInvoiceItems);
  if (!currentInvoiceItems.length) {
    editor.className = "invoice-line-editor empty";
    editor.textContent = "Read or enter an invoice to distribute item spending.";
    totals.innerHTML = "";
    return;
  }

  editor.className = "invoice-line-editor";
  editor.innerHTML = currentInvoiceItems.map((item, index) => {
    const options = state.options.categories
      .map(category => `<option value="${esc(category)}"${category === item.category ? " selected" : ""}>${esc(category)}</option>`)
      .join("");
    return `
      <div class="invoice-line-row" data-index="${index}">
        <input class="line-description" value="${esc(item.description)}" placeholder="Item name">
        <select class="line-category">${options}</select>
        <input class="line-total" type="number" min="0" step="0.01" value="${item.total || ""}" placeholder="0.00">
        <button class="delete-button line-delete" type="button" aria-label="Delete">${iconSvg("trash")}</button>
      </div>`;
  }).join("");

  const categoryTotals = Object.entries(invoiceLineTotals(currentInvoiceItems)).sort((a, b) => b[1] - a[1]);
  totals.innerHTML = categoryTotals.map(([category, total]) => `<span>${esc(category)} <strong>${money.format(total)}</strong></span>`).join("");

  editor.querySelectorAll(".invoice-line-row").forEach(row => {
    const index = Number(row.dataset.index);
    row.querySelector(".line-description").addEventListener("change", event => {
      currentInvoiceItems[index].description = event.currentTarget.value;
      if (!currentInvoiceItems[index].category || currentInvoiceItems[index].category === "Other") {
        currentInvoiceItems[index].category = inferCategory(event.currentTarget.value);
      }
      renderInvoiceLineEditor();
      updateInvoicePreview();
    });
    row.querySelector(".line-category").addEventListener("change", event => {
      currentInvoiceItems[index].category = event.currentTarget.value || "Other";
      renderInvoiceLineEditor();
      updateInvoicePreview();
    });
    row.querySelector(".line-total").addEventListener("change", event => {
      currentInvoiceItems[index].total = currencyValue(event.currentTarget.value);
      renderInvoiceLineEditor();
      updateInvoicePreview();
    });
    row.querySelector(".line-delete").addEventListener("click", () => {
      currentInvoiceItems.splice(index, 1);
      renderInvoiceLineEditor();
      updateInvoicePreview();
    });
  });
}

function applyInvoice(invoice) {
  const form = document.getElementById("invoiceForm");
  const vendor = state.vendors.find(item => item.name.toLowerCase() === String(invoice.vendorName || "").toLowerCase());
  if (invoice.vendorId) form.vendorId.value = invoice.vendorId;
  else if (vendor) form.vendorId.value = vendor.id;
  form.category.value = state.options.categories.includes(invoice.category) ? invoice.category : "Other";
  form.date.value = invoice.invoiceDate || "";
  form.number.value = invoice.invoiceNumber || "";
  form.total.value = invoice.total || "";
  if (form.manualProfitMargin) form.manualProfitMargin.value = invoice.manualProfitMargin || invoice.profitMargin || "";
  currentInvoiceItems = cleanInvoiceItems(Array.isArray(invoice.lineItems) ? invoice.lineItems : []);
  renderInvoiceLineEditor();
  updateInvoicePreview();
  updateInvoiceReadActions();
  updateCurrentInvoicePriceAlerts();
  return;

  const items = Array.isArray(invoice.lineItems) ? invoice.lineItems.slice(0, 12) : [];
  const categoryTotals = groupTotals(items, item => item.category || "Other", item => currencyValue(item.total));
  const categoryRows = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, total]) => `<tr><td>${category}</td><td>${money.format(total)}</td></tr>`)
    .join("");
  document.getElementById("invoicePreview").innerHTML = `
    <strong>${invoice.vendorName || "Unknown vendor"}</strong><br>
    ${invoice.localOnly ? "Local-first breakdown" : "AI invoice breakdown"}: ${invoice.summary || "Invoice breakdown"}<br>
    Total: <strong>${money.format(currencyValue(invoice.total))}</strong> • Category: <strong>${invoice.category || "Other"}</strong>
    <div class="invoice-detail-title">Category totals</div>
    <table class="invoice-table">
      <thead><tr><th>Category</th><th>Total</th></tr></thead>
      <tbody>${categoryRows || '<tr><td>No category totals found</td><td>$0.00</td></tr>'}</tbody>
    </table>
    <div class="invoice-detail-title">Line details</div>
    <table class="invoice-table">
      <thead><tr><th>Item</th><th>Category</th><th>Total</th></tr></thead>
      <tbody>${items.map(item => `<tr><td>${item.description || ""}</td><td>${item.category || ""}</td><td>${money.format(currencyValue(item.total))}</td></tr>`).join("") || '<tr><td>No readable line details found</td><td>Manual</td><td>$0.00</td></tr>'}</tbody>
    </table>`;
}


document.getElementById("saveSelectedInvoice")?.addEventListener("click", saveSelectedInvoiceChanges);
document.getElementById("closeSelectedInvoice")?.addEventListener("click", clearSelectedInvoice);
document.getElementById("deleteSelectedInvoice")?.addEventListener("click", deleteSelectedInvoice);
document.getElementById("exportReportPdf")?.addEventListener("click", exportReportPdf);

document.getElementById("saveReadInvoice").addEventListener("click", () => {
  const form = document.getElementById("invoiceForm");
  if (typeof form.requestSubmit === "function") form.requestSubmit();
  else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
});

document.getElementById("clearReadInvoice").addEventListener("click", () => {
  clearCurrentInvoiceRead();
});

["vendorId", "category", "date", "number", "total", "method", "manualProfitMargin"].forEach(name => {
  const field = document.getElementById("invoiceForm")?.elements[name];
  field?.addEventListener("input", updateInvoiceReadActions);
  field?.addEventListener("change", updateInvoiceReadActions);
});

document.getElementById("readInvoice").addEventListener("click", () => {
  const uploadFile = document.getElementById("invoiceFile").files[0];
  const cameraFile = document.getElementById("invoiceCameraFile").files[0];
  readInvoiceFile(uploadFile || cameraFile);
});

document.getElementById("invoiceFile").addEventListener("change", event => {
  document.getElementById("invoiceCameraFile") && (document.getElementById("invoiceCameraFile").value = "");
  readInvoiceFile(event.target.files[0]);
});

document.getElementById("invoiceCameraFile").addEventListener("change", event => {
  document.getElementById("invoiceFile") && (document.getElementById("invoiceFile").value = "");
  readInvoiceFile(event.target.files[0]);
});

document.getElementById("readLocalInvoice").addEventListener("click", () => {
  readLocalInvoiceFile(document.getElementById("localInvoiceFile").files[0]);
});

document.getElementById("localInvoiceFile").addEventListener("change", event => {
  document.getElementById("invoiceFile") && (document.getElementById("invoiceFile").value = "");
  document.getElementById("invoiceCameraFile") && (document.getElementById("invoiceCameraFile").value = "");
  readLocalInvoiceFile(event.target.files[0]);
});

document.getElementById("addInvoiceLine").addEventListener("click", () => {
  currentInvoiceItems.push({ description: "", quantity: "", unitPrice: 0, total: 0, category: "Other" });
  if (!lastInvoiceRead) {
    lastInvoiceRead = {
      vendorName: vendorName(document.getElementById("invoiceVendor").value),
      total: currencyValue(document.getElementById("invoiceForm").total.value),
      category: document.getElementById("invoiceForm").category.value || "Other",
      summary: "Manual invoice line entry.",
      lineItems: currentInvoiceItems,
      localOnly: true
    };
  }
  renderInvoiceLineEditor();
  updateInvoicePreview();
  updateInvoiceReadActions();
});

document.getElementById("invoiceForm").category.addEventListener("change", () => {
  const form = document.getElementById("invoiceForm");
  if (form?.manualProfitMargin) form.manualProfitMargin.placeholder = `Category default ${marginText(categoryMargin(form.category.value || "Other"))}`;
  updateInvoicePreview();
});
document.getElementById("invoiceForm").total.addEventListener("change", updateInvoicePreview);

document.getElementById("reportRange")?.addEventListener("change", event => {
  applyReportRange(event.currentTarget.value);
});

document.getElementById("savedReportSelect")?.addEventListener("change", event => {
  const report = state.customReports.find(item => item.id === event.currentTarget.value);
  if (!report) {
    updateCustomReportPanel();
    return;
  }
  const form = document.getElementById("reportForm");
  if (form?.type) form.type.value = "custom";
  const customNameInput = document.getElementById("reportName");
  if (customNameInput) customNameInput.value = report.name;
  setCustomReportFields(report.fields || []);
  updateCustomReportPanel();
});

document.querySelector('#reportForm [name="type"]')?.addEventListener("change", updateCustomReportPanel);

document.getElementById("saveReportDefinition")?.addEventListener("click", () => {
  const reportNameInput = document.getElementById("reportName");
  const name = reportNameInput ? reportNameInput.value.trim() : "";
  const fields = selectedCustomReportFields();
  if (!name || !fields.length) {
    document.getElementById("reportOutput").innerHTML = '<div class="status toast-status">Enter a custom report name and choose at least one field.</div>';
    return;
  }
  const existing = state.customReports.find(report => report.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.fields = fields;
  } else {
    state.customReports.push({ id: uid("report"), name, fields });
  }
  renderAll();
  document.getElementById("reportOutput").innerHTML = `<div class="status toast-status">Saved custom report: ${name}</div>`;
});






function setCustomReportPreset(fields) {
  setCustomReportFields(fields);
}

const dropdownReportFields = [
  "payroll",
  "invoices",
  "salesSummary",
  "profitLoss",
  "restaurantKpis",
  "employeeSalesTips",
  "categorySpending",
  "cashRemaining"
];

document.getElementById("selectDropdownReportsPreset")?.addEventListener("click", () => {
  setCustomReportPreset(dropdownReportFields);
});

document.getElementById("selectProfitPreset")?.addEventListener("click", () => {
  setCustomReportPreset(["salesSummary", "profitLoss", "restaurantKpis", "categorySpending", "cashRemaining"]);
});

document.getElementById("selectPayrollPreset")?.addEventListener("click", () => {
  setCustomReportPreset(["payroll", "employees", "employeeSalesTips", "waiterTips", "paymentMethods"]);
});

document.getElementById("selectExpensePreset")?.addEventListener("click", () => {
  setCustomReportPreset(["invoices", "vendors", "categorySpending", "categoryTotals", "paymentMethods"]);
});

document.getElementById("clearCustomFields")?.addEventListener("click", () => {
  setCustomReportPreset([]);
});


function clearGeneratedReport() {
  const reportOutput = document.getElementById("reportOutput");
  const reportSummary = document.getElementById("reportSummary");
  const reportTotal = document.getElementById("reportTotal");
  const reportForm = document.getElementById("reportForm");
  const savedReportSelect = document.getElementById("savedReportSelect");
  const reportName = document.getElementById("reportName");

  if (reportOutput) reportOutput.innerHTML = '<div class="status">Choose report options and click Generate Report.</div>';
  if (reportSummary) reportSummary.innerHTML = "";
  if (reportTotal) reportTotal.textContent = "$0.00";
  if (savedReportSelect) savedReportSelect.value = "";
  if (reportName) reportName.value = "";
  if (reportForm?.elements?.type) reportForm.elements.type.value = "payroll";
  if (reportForm?.elements?.range) reportForm.elements.range.value = "all";
  if (reportForm?.elements?.start) reportForm.elements.start.value = "";
  if (reportForm?.elements?.end) reportForm.elements.end.value = "";
  if (reportForm?.elements?.singleDate) reportForm.elements.singleDate.value = "";
  if (typeof setCustomReportFields === "function") setCustomReportFields([]);
  if (typeof updateCustomReportPanel === "function") updateCustomReportPanel();
}

document.getElementById("clearReport")?.addEventListener("click", clearGeneratedReport);


document.getElementById("reportForm")?.addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const range = data.range || "all";
  const selectedSavedReport = state.customReports.find(report => report.id === data.savedReport);
  let customFields = selectedCustomReportFields();

  if (selectedSavedReport) {
    customFields = selectedSavedReport.fields || [];
    document.getElementById("reportName").value = selectedSavedReport.name || "";
    setCustomReportFields(customFields);
  }

  let effectiveStart = data.start || "";
  let effectiveEnd = data.end || "";
  if (range === "single") {
    effectiveStart = data.singleDate || today;
    effectiveEnd = data.singleDate || today;
  }

  const payroll = state.payroll.filter(item => dateInRange(item.date, effectiveStart, effectiveEnd));
  const invoices = state.invoices.filter(item => dateInRange(item.date, effectiveStart, effectiveEnd));
  const salesItems = (state.sales || []).filter(item => dateInRange(item.date, effectiveStart, effectiveEnd));
  const toastPayrollItems = (state.toastPayroll || []).filter(item => dateInRange(item.date, effectiveStart, effectiveEnd));

  const personFilter = data.person || "";
  const categoryFilter = data.category || "";

  const filteredPayroll = personFilter ? payroll.filter(item => item.personId === personFilter) : payroll;
  const filteredInvoices = categoryFilter ? invoices.filter(invoice => invoiceMatchesCategory(invoice, categoryFilter)) : invoices;

  const payrollTotal = filteredPayroll.reduce((sum, item) => sum + payrollFinalCheckAmount(item), 0);
  const invoiceTotal = filteredInvoices.reduce((sum, item) => sum + currencyValue(item.total), 0);
  const extraTotal = filteredPayroll.reduce((sum, item) => sum + currencyValue(item.extra), 0);
  const tipDeductionTotal = filteredPayroll.reduce((sum, item) => sum + waiterTipDeduction(item), 0);
  const waiterTipsTotal = filteredPayroll.filter(isWaiterTipEntry).reduce((sum, item) => sum + currencyValue(item.amount), 0);
  const checkPayrollItems = filteredPayroll.filter(item => String(item.method || "").toLowerCase() === "check");
  const checkPayrollTotal = checkPayrollItems.reduce((sum, item) => sum + payrollFinalCheckAmount(item), 0);
  const employeePayrollReportTotal = filteredPayroll
    .filter(item => String(item.personId).startsWith("employee:"))
    .reduce((sum, item) => sum + payrollFinalCheckAmount(item), 0);
  const vendorPayrollReportTotal = filteredPayroll
    .filter(item => String(item.personId).startsWith("vendor:"))
    .reduce((sum, item) => sum + payrollFinalCheckAmount(item), 0);
  const vendorPaymentReportTotal = vendorPayrollReportTotal + invoiceTotal;

  const reportOutput = document.getElementById("reportOutput");
  const reportSummary = document.getElementById("reportSummary");
  const reportTotal = document.getElementById("reportTotal");
  reportOutput.innerHTML = "";
  reportSummary.innerHTML = "";

  const reportRowsByType = {
    payroll: filteredPayroll.map(item => detailRow(`${item.date} • ${personName(item.personId)}`, payrollMeta(item), payrollFinalCheckAmount(item))),
    checkPayrollExpense: checkPayrollItems.map(item => detailRow(`${item.date} • ${personName(item.personId)}`, payrollMeta(item), payrollFinalCheckAmount(item))),
    invoices: filteredInvoices.map(item => detailRow(`${item.date || "No date"} • ${vendorName(item.vendorId)}`, `${item.category || "No category"} • Invoice ${item.number || "blank"}`, currencyValue(item.total))),
    vendors: totalRows(groupTotals(filteredPayroll.filter(item => String(item.personId).startsWith("vendor:")), item => personName(item.personId), item => payrollFinalCheckAmount(item))),
    employees: totalRows(groupTotals(filteredPayroll.filter(item => String(item.personId).startsWith("employee:")), item => personName(item.personId), item => payrollFinalCheckAmount(item))),
    categoryTotals: totalRows(allCategorySpendingTotals(filteredInvoices)),
    categorySpending: Object.entries(allCategorySpendingTotals(filteredInvoices))
      .sort((a, b) => b[1] - a[1])
      .map(([category, total]) => {
        const percent = invoiceTotal ? Math.round((total / invoiceTotal) * 100) : 0;
        return detailRow(category, `${percent}% of invoice spending • ${categoryProfitMeta(category, total)}`, total);
      }),
    extraPay: filteredPayroll.filter(item => currencyValue(item.extra) > 0).map(item => detailRow(`${item.date} • ${personName(item.personId)}`, item.reason || "Extra pay", currencyValue(item.extra))),
    waiterTips: filteredPayroll.filter(isWaiterTipEntry).map(item => detailRow(`${item.date} • ${personName(item.personId)}`, `Tip amount ${money.format(currencyValue(item.amount))} • 3% deduction ${money.format(waiterTipDeduction(item))}`, currencyValue(item.amount))),
    paymentMethods: totalRows(groupTotals(filteredPayroll, item => item.method || "No method", item => payrollFinalCheckAmount(item))),
    salesSummary: typeof salesReportRows === "function" ? salesReportRows(salesItems) : [],
    profitLoss: typeof profitLossRows === "function" ? profitLossRows(effectiveStart, effectiveEnd) : [],
    restaurantKpis: typeof restaurantKpiRows === "function" ? restaurantKpiRows(effectiveStart, effectiveEnd) : [],
    employeeSalesTips: toastPayrollItems
      .slice()
      .sort((a, b) => currencyValue(b.netSales) - currencyValue(a.netSales))
      .map(item => detailRow(
        item.employee,
        `${item.date || "No date"} • ${item.jobTitle || "No job"} • Sales ${money.format(currencyValue(item.netSales))} • Total Tips ${money.format(currencyValue(item.totalTips))} • Withheld ${money.format(currencyValue(item.tipsWithheld))} • Final Tips ${money.format(toastPayrollFinalTips(item))} • Extra ${money.format(currencyValue(item.manualExtraPay))}${item.note ? ` • Reason: ${item.note}` : ""}`,
        toastPayrollFinalTotal(item)
      )),
    cashCollected: typeof cashReportData === "function" ? cashReportData(effectiveStart, effectiveEnd).cashCollections : [],
    cashRemaining: typeof cashReportData === "function" ? [
      detailRow("Toast Cash Collected", `${cashReportData(effectiveStart, effectiveEnd).cashCollections.length} cash entries`, cashReportData(effectiveStart, effectiveEnd).cashCollectedTotal),
      detailRow("Cash Paid Out", "Cash payroll + cash vendor payments + cash invoices", cashReportData(effectiveStart, effectiveEnd).cashPayrollTotal + cashReportData(effectiveStart, effectiveEnd).cashExpensesTotal),
      detailRow("Remaining Cash / Remaining Cash", "Toast cash collected minus all cash paid out", cashReportData(effectiveStart, effectiveEnd).cashBalance)
    ] : []
  };

  const labelMap = {
    payroll: "Payroll",
    checkPayrollExpense: "Check Payroll Expense",
    invoices: "Invoices",
    vendors: "Vendor Totals",
    employees: "Employee Totals",
    categoryTotals: "Expense By Category",
    categorySpending: "Category Spending Detail",
    extraPay: "Extra Pay",
    waiterTips: "Waiter Tips",
    paymentMethods: "Payment Methods",
    salesSummary: "Sales Summary",
    profitLoss: "Profit & Loss",
    restaurantKpis: "Restaurant KPIs",
    employeeSalesTips: "Employee Sales, Tips & Extra Pay",
    cashCollected: "Toast Cash Collected",
    cashRemaining: "Remaining Cash / Remaining Cash"
  };

  const activeType = selectedSavedReport ? "custom" : data.type;
  const activeCashReport = ["cashCollected", "cashRemaining"].includes(activeType) || (activeType === "custom" && customFields.some(field => ["cashCollected", "cashRemaining"].includes(field)));

  if (activeCashReport && typeof cashReportData === "function") {
    const cashData = cashReportData(effectiveStart, effectiveEnd);
    reportSummary.append(
      summaryCard("Toast Cash Collected", money.format(cashData.cashCollectedTotal), "green", cashData.cashCollections),
      summaryCard("Cash Payroll", money.format(cashData.cashPayrollTotal), "orange", filteredPayroll.filter(item => String(item.personId).startsWith("employee:") && String(item.method || "").toLowerCase() === "cash").map(item => detailRow(`${item.date} • ${personName(item.personId)}`, payrollMeta(item), payrollFinalCheckAmount(item)))),
      summaryCard("Cash Expenses", money.format(cashData.cashExpensesTotal), "pink", [
        ...filteredPayroll.filter(item => String(item.personId).startsWith("vendor:") && String(item.method || "").toLowerCase() === "cash").map(item => detailRow(`${item.date} • ${personName(item.personId)}`, payrollMeta(item), payrollFinalCheckAmount(item))),
        ...filteredInvoices.filter(invoice => String(invoice.method || "").toLowerCase() === "cash").map(invoice => detailRow(`${invoice.date || "No date"} • ${vendorName(invoice.vendorId)}`, `${invoice.category || "No category"} • Invoice ${invoice.number || "blank"}`, currencyValue(invoice.total)))
      ]),
      summaryCard("Remaining Cash", money.format(cashData.cashBalance), cashData.cashBalance < 0 ? "orange" : "blue", reportRowsByType.cashRemaining)
    );
  } else if (activeType === "salesSummary" || activeType === "profitLoss" || activeType === "restaurantKpis") {
    const snapshot = typeof profitSnapshot === "function" ? profitSnapshot(effectiveStart, effectiveEnd) : null;
    const sales = typeof salesTotals === "function" ? salesTotals(salesItems) : { netSales: 0 };
    reportSummary.append(
      summaryCard("Net Sales", money.format(sales.netSales), "green", reportRowsByType.salesSummary),
      summaryCard("Expenses", money.format(snapshot?.expenses?.totalExpenses || 0), "pink", [...reportRowsByType.payroll, ...reportRowsByType.invoices]),
      summaryCard("Net Profit", money.format(snapshot?.netProfit || 0), "blue", reportRowsByType.profitLoss),
      summaryCard("Margin", snapshot ? percentText(snapshot.profitMargin) : "0.0%", "orange", reportRowsByType.restaurantKpis)
    );
  } else {
    reportSummary.append(
      summaryCard("Payroll", money.format(payrollTotal), "blue", reportRowsByType.payroll),
      summaryCard("Invoices", money.format(invoiceTotal), "pink", reportRowsByType.invoices),
      summaryCard("Check Payroll Expense", money.format(checkPayrollTotal), "green", reportRowsByType.checkPayrollExpense),
      summaryCard("Tip Deduction", money.format(tipDeductionTotal), "orange", filteredPayroll.filter(isWaiterTipEntry).map(item => detailRow(`${item.date} • ${personName(item.personId)}`, `Tip amount ${money.format(currencyValue(item.amount))} • 3% deduction ${money.format(waiterTipDeduction(item))}`, waiterTipDeduction(item))))
    );
  }

  let rows = [];
  if (activeType === "custom") {
    customFields.forEach(field => {
      const fieldRows = reportRowsByType[field] || [];
      if (fieldRows.length) {
        rows.push(sectionHeader(labelMap[field] || field));
        rows.push(...fieldRows);
      }
    });
  } else {
    rows = reportRowsByType[activeType] || [];
  }

  if (!rows.length) {
    reportOutput.innerHTML = '<div class="status">No records found for this report.</div>';
  } else {
    rows.forEach(row => reportOutput.append(row));
  }

  const cashDataForTotal = typeof cashReportData === "function" ? cashReportData(effectiveStart, effectiveEnd) : null;
  const snapshotForTotal = typeof profitSnapshot === "function" ? profitSnapshot(effectiveStart, effectiveEnd) : null;
  let total = payrollTotal + invoiceTotal;

  if (activeType === "invoices" || activeType === "categoryTotals" || activeType === "categorySpending") total = invoiceTotal;
  else if (activeType === "cashCollected") total = cashDataForTotal?.cashCollectedTotal || 0;
  else if (activeType === "cashRemaining") total = cashDataForTotal?.cashBalance || 0;
  else if (activeType === "salesSummary") total = salesTotals(salesItems).netSales;
  else if (activeType === "profitLoss" || activeType === "restaurantKpis") total = snapshotForTotal?.netProfit || 0;
  else if (activeType === "employeeSalesTips") total = toastPayrollItems.reduce((sum, item) => sum + toastPayrollFinalTotal(item), 0);
  else if (activeType === "extraPay") total = extraTotal;
  else if (activeType === "waiterTips") total = waiterTipsTotal;

  reportTotal.textContent = money.format(total);
});


const salesDateInput = document.querySelector('#salesForm [name="date"]');
if (salesDateInput) salesDateInput.value = today;

document.querySelectorAll('input[type="date"]').forEach(input => {
  if (input.name === "date") input.value = today;
});

const cashCollectionDate = document.querySelector('#cashCollectionForm input[name="date"]');
if (cashCollectionDate) cashCollectionDate.value = today;
setCashDashboardRange("month");
applyReportRange("");
updateCustomReportPanel();
updateInvoiceReadActions();
initializeAppData();


window.addEventListener("error", event => {
  console.error("RestaPay runtime error:", event.error || event.message);
  const reportOutput = document.getElementById("reportOutput");
  if (reportOutput && document.getElementById("reports")?.classList.contains("active")) {
    reportOutput.innerHTML = `<div class="status toast-status">Report error: ${event.message}</div>`;
  }
});

/* HARD FIX 2026-06-15: dashboard card click reports and category spending */
(() => {
  const dollars = value => {
    try { return money.format(Number(value) || 0); } catch (_) { return `$${(Number(value) || 0).toFixed(2)}`; }
  };
  const asNum = value => {
    if (typeof currencyValue === "function") return currencyValue(value);
    const n = Number(String(value || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const txt = value => String(value == null ? "" : value);
  const escHtml = value => txt(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
  const rowHtml = (title, meta, amount) => `<div class="row-item report-row dashboard-click-row"><div><strong>${escHtml(title || "Line item")}</strong><small>${escHtml(meta || "")}</small></div><strong>${dollars(asNum(amount))}</strong></div>`;
  const cardTitle = card => txt(card?.querySelector("span, h2, strong")?.textContent || "Card details").trim() || "Card details";
  const cardAmountText = card => txt(card?.querySelector("strong, .pill")?.textContent || "$0.00").trim() || "$0.00";

  function payrollAmount(entry) {
    if (typeof payrollFinalCheckAmount === "function") return payrollFinalCheckAmount(entry);
    return asNum(entry?.finalTotal || entry?.total || entry?.amount);
  }
  function payrollName(entry) {
    try { if (typeof personName === "function") return personName(entry.personId); } catch (_) {}
    return entry?.employee || entry?.name || entry?.personId || "Payroll";
  }
  function invoiceName(invoice) {
    try { if (typeof vendorName === "function") return vendorName(invoice.vendorId); } catch (_) {}
    return invoice?.vendor || invoice?.vendorName || invoice?.vendorId || "Invoice";
  }
  function method(record) {
    try { if (typeof methodOf === "function") return methodOf(record); } catch (_) {}
    return txt(record?.method || record?.paymentMethod || record?.paymentType || "Check").trim() || "Check";
  }
  function employeePayroll() { return (state.payroll || []).filter(p => txt(p.personId).startsWith("employee:")); }
  function vendorPayroll() { return (state.payroll || []).filter(p => txt(p.personId).startsWith("vendor:")); }
  function invoiceRows() { return (state.invoices || []).map(inv => ({title:`Invoice: ${invoiceName(inv)}`, meta:`${inv.date || "No date"} • ${inv.number || "No invoice #"} • ${method(inv)}`, amount:asNum(inv.total)})); }
  function payrollRows(items) { return (items || []).map(p => ({title:`Payroll: ${payrollName(p)}`, meta:`${p.date || "No date"} • ${method(p)} • ${p.type || "Payroll"}`, amount:payrollAmount(p)})); }
  function toastRows() { return (state.toastPayroll || []).map(t => ({title:`Toast Tips: ${t.employee || t.name || "Employee"}`, meta:`${t.date || "No date"} • ${t.jobTitle || "Toast employee"} • Check`, amount: typeof toastPayrollFinalTotal === "function" ? toastPayrollFinalTotal(t) : asNum(t.finalTotal || t.finalTips || t.amount)})).filter(r => r.amount > 0); }
  function salesRows() { return (state.sales || []).map(s => ({title:`Sales: ${s.date || "No date"}`, meta:`Net sales ${dollars(asNum(s.netSales))} • Cash ${dollars(asNum(s.cashCollected || s.cashSales))}`, amount:asNum(s.netSales)})); }

  function allCategoryRows() {
    const rows = [];
    try {
      if (typeof categorySourceRows === "function") {
        categorySourceRows().forEach(r => rows.push({category:r.category || "Other", title:r.title, meta:r.meta, amount:asNum(r.amount)}));
      }
    } catch (_) {}
    if (!rows.length) {
      employeePayroll().forEach(p => rows.push({category: method(p).toLowerCase() === "cash" ? "Cash Payroll" : "Check Payroll", title:`Payroll: ${payrollName(p)}`, meta:`${p.date || "No date"} • ${method(p)}`, amount:payrollAmount(p)}));
      vendorPayroll().forEach(p => rows.push({category: "Vendor Payments", title:`Vendor Payment: ${payrollName(p)}`, meta:`${p.date || "No date"} • ${method(p)}`, amount:payrollAmount(p)}));
      (state.invoices || []).forEach(inv => rows.push({category: inv.category || "Invoices", title:`Invoice: ${invoiceName(inv)}`, meta:`${inv.date || "No date"} • ${inv.number || "No invoice #"} • ${method(inv)}`, amount:asNum(inv.total)}));
      toastRows().forEach(r => rows.push({category:"Check Payroll", ...r}));
    }
    return rows.filter(r => asNum(r.amount) > 0);
  }

  function rowsForKey(key, card) {
    const ep = employeePayroll();
    const vp = vendorPayroll();
    const inv = invoiceRows();
    const cats = allCategoryRows();
    const sales = salesRows();
    let rows = [];
    switch (key) {
      case "totalSpend": rows = [...payrollRows(ep), ...payrollRows(vp), ...inv]; break;
      case "payroll": rows = payrollRows(ep); break;
      case "vendorPayments": rows = [...payrollRows(vp), ...inv]; break;
      case "invoiceSpending": rows = inv; break;
      case "checkPayroll": rows = payrollRows((state.payroll || []).filter(p => method(p).toLowerCase() !== "cash")); break;
      case "cashPayroll": rows = payrollRows(ep.filter(p => method(p).toLowerCase() === "cash")); break;
      case "cashExpenses": rows = [...payrollRows(vp.filter(p => method(p).toLowerCase() === "cash")), ...inv.filter(r => /cash/i.test(r.meta))]; break;
      case "actualCash": rows = (state.sales || []).map(s => ({title:`Toast cash: ${s.date || "No date"}`, meta:"Actual closeout cash from Toast sales import", amount:asNum(s.cashCollected || s.actualCloseoutCash || s.cashSales)})).filter(r => r.amount > 0); break;
      case "leftoverCash": rows = [{title:"Leftover Cash", meta:"Toast cash collected minus cash payroll and cash expenses", amount:asNum(cardAmountText(card))}]; break;
      case "foodCost": rows = cats.filter(r => /food/i.test(r.category)); break;
      case "tipDeduction": rows = payrollRows((state.payroll || []).filter(p => asNum(p.withheld || p.tipDeduction) > 0)).map(r => ({...r, amount: asNum((state.payroll || []).find(p => `Payroll: ${payrollName(p)}` === r.title)?.withheld)})); break;
      default: rows = [];
    }
    if (!rows.length && key === "checkPayroll") rows = toastRows();
    if (!rows.length && /sales|net/i.test(cardTitle(card))) rows = sales;
    if (!rows.length) rows = [{title: cardTitle(card), meta:"Summary total from this dashboard card", amount:asNum(cardAmountText(card))}];
    return rows.filter(r => asNum(r.amount) !== 0);
  }

  function renderReport(title, totalText, rows) {
    const titleEl = document.getElementById("dashboardDetailTitle");
    const totalEl = document.getElementById("dashboardDetailTotal");
    const list = document.getElementById("dashboardDetailList");
    const panel = document.getElementById("dashboardDetailPanel");
    const html = rows && rows.length ? rows.map(r => rowHtml(r.title, r.meta, r.amount)).join("") : '<div class="status">No line items found for this total.</div>';
    if (titleEl) titleEl.textContent = title;
    if (totalEl) totalEl.textContent = totalText;
    if (list) list.innerHTML = html;
    if (panel) {
      panel.classList.add("has-report");
      panel.style.display = "block";
      panel.scrollIntoView({behavior:"smooth", block:"nearest"});
    }
    let modal = document.getElementById("dashboardReportModalHard");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "dashboardReportModalHard";
      modal.className = "dashboard-report-modal";
      modal.innerHTML = '<div class="dashboard-report-card"><button type="button" class="icon-button dashboard-report-close" aria-label="Close">×</button><div class="panel-head"><h2 id="dashboardReportHardTitle"></h2><span class="pill" id="dashboardReportHardTotal"></span></div><div id="dashboardReportHardList" class="data-list dashboard-detail-list"></div></div>';
      document.body.append(modal);
      modal.addEventListener("click", e => { if (e.target === modal || e.target.closest(".dashboard-report-close")) modal.classList.remove("open"); });
    }
    document.getElementById("dashboardReportHardTitle").textContent = title;
    document.getElementById("dashboardReportHardTotal").textContent = totalText;
    document.getElementById("dashboardReportHardList").innerHTML = html;
    modal.classList.add("open");
  }

  function renderCategoriesHard() {
    const rows = allCategoryRows();
    const totals = {};
    rows.forEach(r => { totals[r.category || "Other"] = (totals[r.category || "Other"] || 0) + asNum(r.amount); });
    const entries = Object.entries(totals).filter(([,v]) => v > 0).sort((a,b) => b[1] - a[1]);
    const total = entries.reduce((s, [,v]) => s + v, 0);
    const totalEl = document.getElementById("dashboardCategoryTotal");
    const countEl = document.getElementById("categoryCount");
    const cards = document.getElementById("dashboardCategorySpendingCards");
    const list = document.getElementById("categorySpendList");
    if (totalEl) totalEl.textContent = dollars(total);
    if (countEl) countEl.textContent = `${entries.length} categories`;
    const openCategory = cat => {
      const catRows = rows.filter(r => r.category === cat);
      renderReport(`Category: ${cat}`, dollars(catRows.reduce((s,r)=>s+asNum(r.amount),0)), catRows);
    };
    if (cards) {
      cards.innerHTML = entries.length ? entries.map(([cat, amt]) => `<article class="category-spending-card" data-hard-category="${escHtml(cat)}" tabindex="0" role="button"><div class="category-spending-top"><span>${escHtml(cat)}</span><strong>${dollars(amt)}</strong></div><small>Click for line items</small></article>`).join("") : '<div class="status">No category spending rows found yet.</div>';
      cards.querySelectorAll("[data-hard-category]").forEach(el => el.addEventListener("click", () => openCategory(el.dataset.hardCategory)));
    }
    if (list) {
      list.innerHTML = entries.length ? entries.map(([cat, amt]) => `<div class="category-row" data-hard-category="${escHtml(cat)}" tabindex="0" role="button"><div class="category-row-top"><strong>${escHtml(cat)}</strong><span>${dollars(amt)}</span></div><small>Click for line items</small></div>`).join("") : '<div class="status">No category spending rows found yet.</div>';
      list.querySelectorAll("[data-hard-category]").forEach(el => el.addEventListener("click", () => openCategory(el.dataset.hardCategory)));
    }
  }

  document.addEventListener("click", event => {
    const card = event.target.closest(".metric[data-metric-key], .profit-kpi, .final-cash-grid article");
    if (!card) return;
    if (!document.getElementById("dashboard")?.contains(card)) return;
    const key = card.dataset.metricKey || "";
    document.querySelectorAll(".metric.selected-detail-card, .profit-kpi.selected-detail-card, .final-cash-grid article.selected-detail-card").forEach(el => el.classList.remove("selected-detail-card"));
    card.classList.add("selected-detail-card");
    renderReport(cardTitle(card), cardAmountText(card), rowsForKey(key, card));
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".metric[data-metric-key], .profit-kpi, .final-cash-grid article");
    if (!card) return;
    event.preventDefault();
    renderReport(cardTitle(card), cardAmountText(card), rowsForKey(card.dataset.metricKey || "", card));
  }, true);

  const oldRenderDashboard = typeof renderDashboard === "function" ? renderDashboard : null;
  if (oldRenderDashboard) {
    renderDashboard = function(...args) {
      const result = oldRenderDashboard.apply(this, args);
      setTimeout(renderCategoriesHard, 0);
      return result;
    };
  }
  setTimeout(renderCategoriesHard, 0);
})();

/* FINAL VERIFIED FIX 2026-06-15: reliable dashboard click reports + category rebuild */
(() => {
  const toText = value => String(value == null ? "" : value);
  const num = value => {
    try { if (typeof currencyValue === "function") return currencyValue(value); } catch (_) {}
    const parsed = Number(toText(value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const fmt = value => {
    try { return money.format(num(value)); } catch (_) { return `$${num(value).toFixed(2)}`; }
  };
  const escapeHtml = value => toText(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
  const method = record => toText(record?.method || record?.paymentMethod || record?.paymentType || "Check").trim() || "Check";
  const payAmount = entry => {
    try { if (typeof payrollFinalCheckAmount === "function") return payrollFinalCheckAmount(entry); } catch (_) {}
    return num(entry?.finalTotal || entry?.total || entry?.amount) + num(entry?.extra);
  };
  const payName = entry => {
    try { if (typeof personName === "function") return personName(entry.personId); } catch (_) {}
    return entry?.name || entry?.employee || entry?.personId || "Payroll";
  };
  const invName = invoice => {
    try { if (typeof vendorName === "function") return vendorName(invoice.vendorId); } catch (_) {}
    return invoice?.vendorName || invoice?.vendor || invoice?.vendorId || "Vendor";
  };
  const cardLabel = card => toText(card?.querySelector("span")?.textContent || card?.querySelector("h2")?.textContent || card?.querySelector("strong")?.textContent || "Card report").trim();
  const cardTotal = card => toText(card?.querySelector("strong")?.textContent || card?.querySelector(".pill")?.textContent || "$0.00").trim();

  function row(title, meta, amount, category = "") {
    return { title: title || "Line item", meta: meta || "", amount: num(amount), category: category || "" };
  }
  function htmlRow(item) {
    return `<div class="row-item dashboard-click-row"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.meta)}</small></div><strong>${fmt(item.amount)}</strong></div>`;
  }
  function toastFinal(item) {
    try { if (typeof toastPayrollFinalTotal === "function") return toastPayrollFinalTotal(item); } catch (_) {}
    return num(item.finalTotal || item.finalTips || item.amount || item.totalTips) - num(item.tipsWithheld);
  }
  function employeePayrollRows() {
    return (state.payroll || []).filter(p => toText(p.personId).startsWith("employee:")).map(p => row(`Payroll: ${payName(p)}`, `${p.date || "No date"} • ${method(p)} • ${p.type || "Payroll"}`, payAmount(p), method(p).toLowerCase() === "cash" ? "Cash Payroll" : "Check Payroll"));
  }
  function vendorPayrollRows() {
    return (state.payroll || []).filter(p => toText(p.personId).startsWith("vendor:")).map(p => row(`Vendor Payment: ${payName(p)}`, `${p.date || "No date"} • ${method(p)} • ${p.type || "Vendor payment"}`, payAmount(p), p.category || "Vendor Payments"));
  }
  function invoiceLineRows() {
    const rows = [];
    (state.invoices || []).forEach(inv => {
      let lineItems = [];
      try { if (typeof invoiceCategoryEntries === "function") lineItems = invoiceCategoryEntries(inv) || []; } catch (_) {}
      lineItems = lineItems.filter(line => num(line.total) > 0);
      if (lineItems.length) {
        lineItems.forEach(line => rows.push(row(`Invoice: ${invName(inv)}`, `${inv.date || "No date"} • ${line.category || inv.category || "Invoices"} • ${inv.number || "No invoice #"} • ${method(inv)}`, num(line.total), line.category || inv.category || "Invoices")));
      } else if (num(inv.total) > 0) {
        rows.push(row(`Invoice: ${invName(inv)}`, `${inv.date || "No date"} • ${inv.category || "Invoices"} • ${inv.number || "No invoice #"} • ${method(inv)}`, num(inv.total), inv.category || "Invoices"));
      }
    });
    return rows;
  }
  function propertyExpenseRows() {
    return (state.propertyExpenses || []).map(expense => row(
      `Property Expense: ${expense.vendorName || expense.payee || expense.property || expense.type || "Property"}`,
      `${expense.date || "No date"} • ${expense.category || expense.type || "Property Expense"} • ${method(expense)} • included in Other Expenses`,
      num(expense.amount),
      expense.category || expense.type || "Property Expense"
    )).filter(r => r.amount > 0);
  }

  function toastPayrollRows() {
    return (state.toastPayroll || []).map(item => row(`Toast Tips: ${item.employee || item.name || "Employee"}`, `${item.date || "No date"} • ${item.jobTitle || "Toast employee"} • ${method(item)} • Toast Employee Sales & Tips`, toastFinal(item), method(item).toLowerCase() === "cash" ? "Cash Payroll" : "Check Payroll")).filter(r => r.amount > 0);
  }
  function salesRows() {
    return (state.sales || []).map(s => row(`Sales: ${s.date || "No date"}`, `Net sales ${fmt(s.netSales)} • cash ${fmt(s.cashCollected || s.actualCloseoutCash || s.cashSales)}`, num(s.netSales), "Sales")).filter(r => r.amount > 0);
  }
  function cashCollectionRows() {
    const fromSales = (state.sales || []).map(s => row(`Toast cash: ${s.date || "No date"}`, "Actual closeout cash from Toast sales import", num(s.cashCollected || s.actualCloseoutCash || s.cashSales), "Toast Cash")).filter(r => r.amount > 0);
    if (fromSales.length) return fromSales;
    return (state.cashCollections || []).map(c => row(`Cash: ${c.date || "No date"}`, c.source || "Cash collection", num(c.amount || c.cashCollected), "Cash Collections")).filter(r => r.amount > 0);
  }
  function categoryRows() {
    const rows = [...employeePayrollRows(), ...vendorPayrollRows(), ...invoiceLineRows(), ...propertyExpenseRows()];
    const syncedToastIds = new Set((state.payroll || []).map(p => p.sourceToastPayrollId).filter(Boolean));
    (state.toastPayroll || []).forEach(item => {
      if (!syncedToastIds.has(item.id)) {
        const r = toastPayrollRows().find(x => x.title.includes(item.employee || item.name || "Employee"));
        if (r) rows.push(r);
      }
    });
    return rows.filter(r => r.amount > 0);
  }
  function rowsForCard(card) {
    const key = card?.dataset?.metricKey || "";
    const emp = employeePayrollRows();
    const ven = vendorPayrollRows();
    const inv = invoiceLineRows();
    const prop = propertyExpenseRows();
    const cats = categoryRows();
    const cash = cashCollectionRows();
    let rows = [];
    if (key === "totalSpend") rows = [...emp, ...ven, ...inv, ...prop];
    else if (key === "payroll") rows = emp;
    else if (key === "vendorPayments") rows = [...ven, ...inv];
    else if (key === "invoiceSpending") rows = [...inv, ...prop];
    else if (key === "checkPayroll") rows = cats.filter(r => r.category === "Check Payroll" || /check/i.test(r.meta));
    else if (key === "cashPayroll") rows = emp.filter(r => /cash/i.test(r.meta));
    else if (key === "cashExpenses") rows = [...ven, ...inv, ...prop].filter(r => /cash/i.test(r.meta));
    else if (key === "actualCash") rows = cash;
    else if (key === "leftoverCash") rows = [row("Leftover Cash", "Toast actual closeout cash minus cash payroll and cash expenses", cardTotal(card), "Cash")];
    else if (key === "foodCost") rows = cats.filter(r => /food/i.test(r.category));
    else if (key === "tipDeduction") rows = (state.payroll || []).filter(p => num(p.withheld || p.tipDeduction) > 0).map(p => row(`Tip deduction: ${payName(p)}`, `${p.date || "No date"} • withheld/tip deduction`, num(p.withheld || p.tipDeduction), "Tip Deduction"));
    else if (/net sales|sales/i.test(cardLabel(card))) rows = salesRows();
    else if (/total expenses|spend/i.test(cardLabel(card))) rows = [...emp, ...ven, ...inv, ...prop];
    if (!rows.length) rows = [row(cardLabel(card), "Summary total from this card", cardTotal(card), "Summary")];
    return rows.filter(r => r.amount !== 0);
  }
  function ensureReportPanel() {
    let panel = document.getElementById("dashboardDetailPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "dashboardDetailPanel";
      panel.className = "panel dashboard-detail-panel";
      panel.innerHTML = '<div class="panel-head"><h2 id="dashboardDetailTitle">Card details</h2><span class="pill" id="dashboardDetailTotal">$0.00</span></div><div id="dashboardDetailList" class="data-list dashboard-detail-list"></div>';
      document.getElementById("dashboardMetricGrid")?.after(panel);
    }
    return panel;
  }
  function showReport(title, totalText, rows) {
    const panel = ensureReportPanel();
    const titleEl = document.getElementById("dashboardDetailTitle");
    const totalEl = document.getElementById("dashboardDetailTotal");
    const list = document.getElementById("dashboardDetailList");
    if (titleEl) titleEl.textContent = title || "Card details";
    if (totalEl) totalEl.textContent = totalText || fmt(rows.reduce((s, r) => s + r.amount, 0));
    if (list) list.innerHTML = rows.length ? rows.map(htmlRow).join("") : '<div class="status">No line items found.</div>';
    panel.classList.add("has-report");
    panel.style.display = "block";
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function rebuildCategories() {
    const rows = categoryRows();
    const totals = {};
    rows.forEach(r => { totals[r.category || "Other"] = (totals[r.category || "Other"] || 0) + r.amount; });
    const entries = Object.entries(totals).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, amount]) => s + amount, 0);
    const totalEl = document.getElementById("dashboardCategoryTotal");
    const countEl = document.getElementById("categoryCount");
    const cards = document.getElementById("dashboardCategorySpendingCards");
    const list = document.getElementById("categorySpendList");
    if (totalEl) totalEl.textContent = fmt(total);
    if (countEl) countEl.textContent = `${entries.length} categories`;
    const cardHtml = ([cat, amount]) => `<article class="category-spending-card dashboard-clickable-category" data-category-report="${escapeHtml(cat)}" tabindex="0" role="button"><div class="category-spending-top"><span>${escapeHtml(cat)}</span><strong>${fmt(amount)}</strong></div><small>Click for line items</small></article>`;
    const rowHtmlCat = ([cat, amount]) => `<div class="category-row dashboard-clickable-category" data-category-report="${escapeHtml(cat)}" tabindex="0" role="button"><div class="category-row-top"><strong>${escapeHtml(cat)}</strong><span>${fmt(amount)}</span></div><small>Click for line items</small></div>`;
    if (cards) cards.innerHTML = entries.length ? entries.map(cardHtml).join("") : '<div class="status">No category spending rows found yet.</div>';
    if (list) list.innerHTML = entries.length ? entries.map(rowHtmlCat).join("") : '<div class="status">No category spending rows found yet.</div>';
  }
  function openCategory(el) {
    const cat = el?.dataset?.categoryReport;
    if (!cat) return;
    const rows = categoryRows().filter(r => r.category === cat);
    showReport(`Category: ${cat}`, fmt(rows.reduce((s, r) => s + r.amount, 0)), rows);
  }
  let down = null;
  document.addEventListener("pointerdown", event => {
    const card = event.target.closest("#dashboard .metric[data-metric-key], #dashboard .profit-kpi, #dashboard .final-cash-grid article, #dashboard [data-category-report]");
    if (!card) return;
    down = { card, x: event.clientX, y: event.clientY, t: Date.now() };
  }, true);
  document.addEventListener("pointerup", event => {
    const target = event.target.closest("#dashboard .metric[data-metric-key], #dashboard .profit-kpi, #dashboard .final-cash-grid article, #dashboard [data-category-report]");
    const card = target || down?.card;
    if (!card || !document.getElementById("dashboard")?.contains(card)) return;
    const moved = down ? Math.hypot(event.clientX - down.x, event.clientY - down.y) : 0;
    const draggedRecently = card.dataset?.wasDragged === "1" || Date.now() - Number(document.getElementById("dashboardMetricGrid")?.dataset?.lastDragTime || 0) < 160;
    down = null;
    if (moved > 10 || draggedRecently) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (card.matches("[data-category-report]")) openCategory(card);
    else showReport(cardLabel(card), cardTotal(card), rowsForCard(card));
  }, true);
  document.addEventListener("click", event => {
    const card = event.target.closest("#dashboard .metric[data-metric-key], #dashboard .profit-kpi, #dashboard .final-cash-grid article, #dashboard [data-category-report]");
    if (!card) return;
    if (card.matches("[data-category-report]")) openCategory(card);
    else showReport(cardLabel(card), cardTotal(card), rowsForCard(card));
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("#dashboard .metric[data-metric-key], #dashboard .profit-kpi, #dashboard .final-cash-grid article, #dashboard [data-category-report]");
    if (!card) return;
    event.preventDefault();
    if (card.matches("[data-category-report]")) openCategory(card);
    else showReport(cardLabel(card), cardTotal(card), rowsForCard(card));
  }, true);
  const previousRenderDashboard = typeof renderDashboard === "function" ? renderDashboard : null;
  if (previousRenderDashboard && !previousRenderDashboard.__finalVerifiedWrapped) {
    const wrapped = function(...args) {
      const result = previousRenderDashboard.apply(this, args);
      setTimeout(rebuildCategories, 0);
      return result;
    };
    wrapped.__finalVerifiedWrapped = true;
    renderDashboard = wrapped;
  }
  window.__dashboardReportVerified = { rebuildCategories, showReport, rowsForCard, categoryRows };
  setTimeout(rebuildCategories, 0);
})();

/* FIX 2026-06-15: stabilize dashboard cards and reset reports on navigation */
(() => {
  function resetDashboardReport() {
    const panel = document.getElementById("dashboardDetailPanel");
    const title = document.getElementById("dashboardDetailTitle");
    const total = document.getElementById("dashboardDetailTotal");
    const list = document.getElementById("dashboardDetailList");
    if (title) title.textContent = "Click any card for line-wise details";
    if (total) total.textContent = "$0.00";
    if (list) list.innerHTML = '<div class="status">Tap a dashboard card to see every row included in that total.</div>';
    if (panel) {
      panel.classList.remove("has-report");
      panel.style.display = "none";
      panel.hidden = true;
    }
    document.querySelectorAll("#dashboard .selected-detail-card").forEach(card => card.classList.remove("selected-detail-card"));
    document.querySelectorAll(".dashboard-report-modal.open").forEach(modal => modal.classList.remove("open"));
  }

  function stabilizeDashboardCards() {
    const grid = document.getElementById("dashboardMetricGrid");
    if (!grid || grid.dataset.stableClickOnly === "1") return;

    // Replace the grid node once to remove older pointer-drag listeners that caused shaking/reordering.
    const cleanGrid = grid.cloneNode(true);
    cleanGrid.dataset.stableClickOnly = "1";
    cleanGrid.dataset.dragReady = "1";
    cleanGrid.dataset.clickReady = "1";
    cleanGrid.querySelectorAll(".metric[data-metric-key]").forEach(card => {
      card.draggable = false;
      card.removeAttribute("draggable");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.title = "Click for line-wise details";
      card.classList.remove("dragging", "selected-detail-card");
      delete card.dataset.wasDragged;
    });
    grid.replaceWith(cleanGrid);
  }

  function runDashboardStabilizer() {
    stabilizeDashboardCards();
    if (!document.getElementById("dashboard")?.classList.contains("active")) resetDashboardReport();
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      stabilizeDashboardCards();
      resetDashboardReport();
    }, 0);
  });

  document.addEventListener("click", event => {
    const nav = event.target.closest(".nav-item[data-view]");
    if (!nav) return;
    // Every screen change returns Dashboard to the normal no-report state.
    resetDashboardReport();
    setTimeout(() => {
      stabilizeDashboardCards();
      if (nav.dataset.view === "dashboard") resetDashboardReport();
    }, 50);
  }, true);

  const previousRenderAll = typeof renderAll === "function" ? renderAll : null;
  if (previousRenderAll && !previousRenderAll.__stableDashboardWrapped) {
    const wrappedRenderAll = function(...args) {
      const result = previousRenderAll.apply(this, args);
      setTimeout(runDashboardStabilizer, 0);
      return result;
    };
    wrappedRenderAll.__stableDashboardWrapped = true;
    renderAll = wrappedRenderAll;
  }

  const previousRenderDashboard = typeof renderDashboard === "function" ? renderDashboard : null;
  if (previousRenderDashboard && !previousRenderDashboard.__stableDashboardWrapped) {
    const wrappedRenderDashboard = function(...args) {
      const result = previousRenderDashboard.apply(this, args);
      setTimeout(stabilizeDashboardCards, 0);
      return result;
    };
    wrappedRenderDashboard.__stableDashboardWrapped = true;
    renderDashboard = wrappedRenderDashboard;
  }

  window.__resetDashboardReport = resetDashboardReport;
  window.__stabilizeDashboardCards = stabilizeDashboardCards;
  setTimeout(() => { stabilizeDashboardCards(); resetDashboardReport(); }, 100);
})();
