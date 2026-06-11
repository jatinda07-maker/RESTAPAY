const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const today = new Date().toISOString().slice(0, 10);

const defaults = {
  vendorTypes: ["Food Distributor", "Cleaning Service", "Supplies Vendor", "Maintenance", "Utilities", "Beverage"],
  employeeTypes: ["Kitchen Employee", "Waiter", "Cashier", "Manager", "Cleaner"],
  payTypes: ["Hourly", "Salary", "Tips", "Bonus", "Vendor Payment", "Cash", "Check"],
  paymentMethods: ["Cash", "Check", "Card", "ACH", "Other"],
  categories: ["Food", "Supplies", "Cleaning", "Equipment", "Maintenance", "Utilities", "Beverage", "Packaging", "Other"]
};

let state = loadState();
let lastInvoiceRead = null;
let currentInvoiceItems = [];
let selectedInvoiceId = null;

function loadState() {
  const saved = JSON.parse(localStorage.getItem("restaurant-payroll-vendor") || "{}");
  return {
    options: { ...defaults, ...(saved.options || {}) },
    vendors: saved.vendors || [],
    employees: saved.employees || [],
    payroll: saved.payroll || [],
    invoices: saved.invoices || [],
    cashCollections: saved.cashCollections || [],
    priceAlerts: saved.priceAlerts || [],
    customReports: saved.customReports || []
  };
}

function saveState() {
  localStorage.setItem("restaurant-payroll-vendor", JSON.stringify(state));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function currencyValue(value) {
  return Number.parseFloat(value || 0) || 0;
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
  state.employees.forEach(employee => payrollPerson.append(new Option(`Employee: ${employee.name}`, `employee:${employee.id}`)));
  state.vendors.forEach(vendor => payrollPerson.append(new Option(`Vendor: ${vendor.name}`, `vendor:${vendor.id}`)));

  const invoiceVendor = document.getElementById("invoiceVendor");
  invoiceVendor.innerHTML = '<option value="">Select vendor</option>';
  state.vendors.forEach(vendor => invoiceVendor.append(new Option(vendor.name, vendor.id)));

  const reportPerson = document.getElementById("reportPerson");
  reportPerson.innerHTML = '<option value="">All employees and vendors</option>';
  state.employees.forEach(employee => reportPerson.append(new Option(`Employee: ${employee.name}`, `employee:${employee.id}`)));
  state.vendors.forEach(vendor => reportPerson.append(new Option(`Vendor: ${vendor.name}`, `vendor:${vendor.id}`)));

  const savedReportSelect = document.getElementById("savedReportSelect");
  savedReportSelect.innerHTML = '<option value="">Select saved report</option>';
  state.customReports.forEach(report => savedReportSelect.append(new Option(report.name, report.id)));

  renderInvoiceLineEditor();
}

function renderList(elementId, rows, emptyText) {
  const element = document.getElementById(elementId);
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
  button.title = "Delete";
  button.innerHTML = iconSvg("trash");
  button.addEventListener("click", onDelete);
  row.append(button);
  return row;
}

function renderVendors() {
  renderList("vendorList", state.vendors.map(vendor => rowItem(
    vendor.name,
    `${vendor.type || "No type"} • ${vendor.category || "No category"} • ${vendor.contact || "No contact"}`,
    () => removeById("vendors", vendor.id),
    "vendor"
  )), "No vendors yet.");
}

function renderEmployees() {
  renderList("employeeList", state.employees.map(employee => rowItem(
    employee.name,
    `${employee.type || "No type"} • ${employee.payType || "No pay type"} • Rate ${money.format(currencyValue(employee.rate))}`,
    () => removeById("employees", employee.id),
    "employee"
  )), "No employees yet.");
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
  const base = `${entry.type} • ${entry.method} • Base ${money.format(currencyValue(entry.amount))} • Extra ${money.format(currencyValue(entry.extra))}`;
  const deduction = waiterTipDeduction(entry);
  if (!deduction) return `${base} • Final check ${money.format(payrollFinalCheckAmount(entry))}`;
  return `${base} • Waiter tip 3% deduction ${money.format(deduction)} • Final check ${money.format(payrollFinalCheckAmount(entry))}`;
}

function renderPayroll() {
  renderList("payrollList", state.payroll.map(entry => rowItem(
    `${entry.date} • ${personName(entry.personId)}`,
    `${payrollMeta(entry)} • ${entry.reason || "No reason"}`,
    () => removeById("payroll", entry.id),
    "payroll"
  )), "No payments saved yet.");
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
    .filter(item => item.description || item.total > 0)
    .map(item => ({ ...item, category: item.category || "Other" }));
}

function invoiceCategoryEntries(invoice) {
  const lineItems = cleanInvoiceItems(invoice.lineItems);
  const usableLines = lineItems
    .filter(item => item.total > 0)
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
      `${invoice.category || "No category"} • Invoice ${invoice.number || "blank"} • ${money.format(currencyValue(invoice.total))}`,
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

  header.innerHTML = `
    <div class="selected-invoice-title">
      <strong>${esc(vendorName(invoice.vendorId))}</strong>
      <span>${esc(invoice.date || "No date")} • Invoice ${esc(invoice.number || "blank")}</span>
    </div>
    <div class="selected-invoice-total">
      <span>Total</span>
      <strong>${money.format(currencyValue(invoice.total))}</strong>
    </div>
  `;

  const categoryOptions = state.options.categories
    .map(category => `<option value="${esc(category)}">${esc(category)}</option>`)
    .join("");

  if (!invoice.lineItems.length) {
    lines.innerHTML = '<div class="status">No line items saved for this invoice. Click Add Line Item below.</div>';
  } else {
    lines.innerHTML = invoice.lineItems.map((item, index) => `
      <div class="selected-invoice-line" data-index="${index}">
        <input class="selected-line-description" value="${esc(item.description)}" placeholder="Item description">
        <select class="selected-line-category">${categoryOptions}</select>
        <input class="selected-line-total" type="number" min="0" step="0.01" value="${currencyValue(item.total) || ""}" placeholder="0.00">
        <button class="delete-button selected-line-delete" type="button" title="Delete line">${iconSvg("trash")}</button>
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
  invoice.lineItems = cleanInvoiceItems(invoice.lineItems || []);
  const lineTotal = invoice.lineItems.reduce((sum, item) => sum + currencyValue(item.total), 0);
  if (lineTotal > 0) invoice.total = String(lineTotal.toFixed(2));
  invoice.category = topInvoiceCategory(invoice);
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
  document.getElementById("invoiceFile").value = "";
  document.getElementById("invoiceCameraFile").value = "";
  document.getElementById("localInvoiceFile").value = "";
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
    categories: "categoryOptions"
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
      summaryCard("Cash Collected", money.format(cashItems.reduce((sum, item) => sum + currencyValue(item.amount), 0)), "green"),
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
  const unit = currencyValue(item.unitPrice);
  if (unit > 0) return unit;
  const total = currencyValue(item.total);
  const qty = Number.parseFloat(String(item.quantity || "").replace(/[^0-9.]/g, ""));
  if (total > 0 && qty > 0) return total / qty;
  return total;
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
    const increase = currentPrice - baseline;
    const percent = baseline > 0 ? (increase / baseline) * 100 : 0;
    if (increase > 0) {
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
      <span>Current</span>
      <small>${esc(alert.date || today)}</small>
      <strong>${money.format(currencyValue(alert.currentPrice))}</strong>
    </div>

    <div class="price-alert-cell previous">
      <span>Previous</span>
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

function allCategorySpendingTotals(invoices = state.invoices) {
  const totals = invoiceCategoryTotals(invoices);
  (state.options.categories || []).forEach(category => {
    if (!(category in totals)) totals[category] = 0;
  });
  return totals;
}

function renderDashboardCategorySpending(categoryTotals, invoiceTotal) {
  const totalElement = document.getElementById("dashboardCategoryTotal");
  const cards = document.getElementById("dashboardCategorySpendingCards");
  if (!cards) return;

  const total = Object.values(categoryTotals).reduce((sum, value) => sum + currencyValue(value), 0);
  if (totalElement) totalElement.textContent = money.format(total);

  cards.innerHTML = "";
  const rows = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1]);

  if (!rows.length || total <= 0) {
    cards.innerHTML = '<div class="status">No category spending yet. Save invoices with categories to see Food, Supplies, Utilities, and more.</div>';
    return;
  }

  rows.forEach(([category, amount]) => {
    if (amount <= 0) return;
    const percent = total ? Math.round((amount / total) * 100) : 0;
    const card = document.createElement("article");
    card.className = `category-spending-card ${categoryColorClass(category)}`;
    card.innerHTML = `
      <div class="category-spending-top">
        <span>${esc(category)}</span>
        <strong>${money.format(amount)}</strong>
      </div>
      <div class="category-spending-bar"><i style="width:${percent}%"></i></div>
      <small>${percent}% of invoice spending</small>
    `;
    cards.append(card);
  });
}

function renderDashboard() {
  const employeePayrollTotal = state.payroll
    .filter(entry => String(entry.personId).startsWith("employee:"))
    .reduce((sum, entry) => sum + payrollFinalCheckAmount(entry), 0);
  const vendorPayrollTotal = state.payroll
    .filter(entry => String(entry.personId).startsWith("vendor:"))
    .reduce((sum, entry) => sum + payrollFinalCheckAmount(entry), 0);
  const invoiceTotal = state.invoices.reduce((sum, invoice) => sum + currencyValue(invoice.total), 0);
  const vendorPaymentTotal = vendorPayrollTotal + invoiceTotal;
  const totalSpend = employeePayrollTotal + vendorPaymentTotal;
  const categoryTotals = allCategorySpendingTotals(state.invoices);
  const foodCost = Object.entries(categoryTotals)
    .filter(([category]) => String(category || "").toLowerCase() === "food")
    .reduce((sum, [, total]) => sum + total, 0);
  const foodPercent = totalSpend ? Math.round((foodCost / totalSpend) * 100) : 0;
  const extraTotal = state.payroll.reduce((sum, entry) => sum + currencyValue(entry.extra), 0);
  const tipDeductionTotal = state.payroll.reduce((sum, entry) => sum + waiterTipDeduction(entry), 0);
  const { start: cashStart, end: cashEnd } = getCashDashboardRange();
  const cashCollections = state.cashCollections.filter(entry => dateInRange(entry.date, cashStart, cashEnd));
  const payrollInCashRange = state.payroll.filter(entry => dateInRange(entry.date, cashStart, cashEnd));
  const invoicesInCashRange = state.invoices.filter(invoice => dateInRange(invoice.date, cashStart, cashEnd));
  const cashCollectedTotal = cashCollections.reduce((sum, entry) => sum + currencyValue(entry.amount), 0);
  const cashPayrollTotal = payrollInCashRange
    .filter(entry => String(entry.personId).startsWith("employee:"))
    .filter(entry => String(entry.method || "").toLowerCase() === "cash")
    .reduce((sum, entry) => sum + payrollFinalCheckAmount(entry), 0);
  const cashExpenseTotal = payrollInCashRange
    .filter(entry => String(entry.personId).startsWith("vendor:"))
    .filter(entry => String(entry.method || "").toLowerCase() === "cash")
    .reduce((sum, entry) => sum + payrollFinalCheckAmount(entry), 0)
    + invoicesInCashRange
      .filter(invoice => String(invoice.method || "").toLowerCase() === "cash")
      .reduce((sum, invoice) => sum + currencyValue(invoice.total), 0);
  const cashBalance = cashCollectedTotal - cashPayrollTotal - cashExpenseTotal;

  document.getElementById("metricTotalSpend").textContent = money.format(totalSpend);
  document.getElementById("metricPayroll").textContent = money.format(employeePayrollTotal);
  document.getElementById("metricVendorPayments").textContent = money.format(vendorPaymentTotal);
  document.getElementById("metricFoodCost").textContent = money.format(foodCost);
  document.getElementById("metricFoodPercent").textContent = `${foodPercent}% of spending`;
  document.getElementById("metricInvoices").textContent = money.format(invoiceTotal);
  document.getElementById("metricExtra").textContent = money.format(extraTotal);
  document.getElementById("metricTipDeduction").textContent = money.format(tipDeductionTotal);
  const metricCashCollected = document.getElementById("metricCashCollected");
  const metricCashPayroll = document.getElementById("metricCashPayroll");
  const metricCashExpenses = document.getElementById("metricCashExpenses");
  const metricCashBalance = document.getElementById("metricCashBalance");
  if (metricCashCollected) metricCashCollected.textContent = money.format(cashCollectedTotal);
  if (metricCashPayroll) metricCashPayroll.textContent = money.format(cashPayrollTotal);
  if (metricCashExpenses) metricCashExpenses.textContent = money.format(cashExpenseTotal);
  if (metricCashBalance) metricCashBalance.textContent = money.format(cashBalance);
  renderCashCollections(cashCollections, cashPayrollTotal, cashExpenseTotal, cashBalance);
  document.getElementById("categoryCount").textContent = `${Object.values(categoryTotals).filter(total => total > 0).length} categories`;
  renderDashboardCategorySpending(categoryTotals, invoiceTotal);

  const categoryRows = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, total]) => {
      const percent = invoiceTotal ? Math.round((total / invoiceTotal) * 100) : 0;
      const row = document.createElement("div");
      row.className = "category-row";
      row.innerHTML = `
        <div class="category-row-top"><strong>${category}</strong><span>${money.format(total)}</span></div>
        <div class="category-bar"><i style="width: ${percent}%"></i></div>
        <small>${percent}% of invoice spending</small>`;
      return row;
    });
  renderList("categorySpendList", categoryRows, "No categorized invoice spending yet.");

  const recent = [
    ...state.payroll.map(item => ({ label: `Payment: ${personName(item.personId)}`, meta: `${item.date} • Final check ${money.format(payrollFinalCheckAmount(item))}` })),
    ...state.invoices.map(item => ({ label: `Invoice: ${vendorName(item.vendorId)}`, meta: `${item.date || "No date"} • ${money.format(currencyValue(item.total))}` }))
  ].slice(-6).reverse();
  document.getElementById("recentCount").textContent = `${recent.length} items`;
  renderList("recentList", recent.map(item => {
    const row = document.createElement("div");
    row.className = "row-item";
    row.innerHTML = `<div><strong>${item.label}</strong><small>${item.meta}</small></div>`;
    return row;
  }), "No activity yet.");
}

function renderAll() {
  renderSelects();
  renderVendors();
  renderEmployees();
  renderPayroll();
  renderInvoices();
  renderOptionManager();
  renderDashboard();
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

function summaryCard(label, value, tone) {
  const card = document.createElement("div");
  card.className = `summary-card ${tone || ""}`;
  card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
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
  return [...document.querySelectorAll('#customReportPanel input[type="checkbox"]:checked')].map(input => input.value);
}

function setCustomReportFields(fields) {
  document.querySelectorAll('#customReportPanel input[type="checkbox"]').forEach(input => {
    input.checked = fields.includes(input.value);
  });
}

function updateCustomReportPanel() {
  const form = document.getElementById("reportForm");
  const type = form.querySelector('[name="type"]').value;
  const saved = state.customReports.find(report => report.id === form.querySelector('[name="savedReport"]').value);
  document.getElementById("customReportPanel").classList.toggle("visible", type === "custom" || Boolean(saved));
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

function removeById(collection, id) {
  state[collection] = state[collection].filter(item => item.id !== id);
  renderAll();
}

function removeOption(kind, value) {
  state.options[kind] = (state.options[kind] || []).filter(item => item !== value);
  renderAll();
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    const sidebar = document.querySelector(".sidebar");
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.view).classList.add("active");
    document.getElementById("viewTitle").textContent = button.textContent.trim();
    sidebar.classList.add("is-collapsed");
    button.blur();
  });
});

document.querySelector(".sidebar").addEventListener("mouseenter", event => {
  event.currentTarget.classList.remove("is-collapsed");
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
  event.currentTarget.date.value = today;
  document.getElementById("cashCollectionStatus").textContent = "Cash collected saved.";
  renderAll();
});

document.getElementById("applyCashRange")?.addEventListener("click", renderAll);
document.querySelectorAll("[data-cash-range]").forEach(button => {
  button.addEventListener("click", () => setCashDashboardRange(button.dataset.cashRange));
});

document.getElementById("vendorForm").addEventListener("submit", event => {
  event.preventDefault();
  state.vendors.push({ id: uid("vendor"), ...formData(event.currentTarget) });
  event.currentTarget.reset();
  renderAll();
});

document.getElementById("employeeForm").addEventListener("submit", event => {
  event.preventDefault();
  state.employees.push({ id: uid("employee"), ...formData(event.currentTarget) });
  event.currentTarget.reset();
  renderAll();
});

document.getElementById("payrollForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  state.payroll.push({ id: uid("payroll"), ...data, extra: data.extra || "0", reason: data.reason || "" });
  event.currentTarget.reset();
  event.currentTarget.date.value = today;
  event.currentTarget.extra.value = "0";
  renderAll();
});

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
  document.getElementById("invoiceFile").value = "";
  document.getElementById("invoiceCameraFile").value = "";
  document.getElementById("localInvoiceFile").value = "";
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
  const amounts = [...String(text || "").matchAll(/\$([0-9,]+\.\d{2})/g)]
    .map(match => currencyValue(match[1].replace(/,/g, "")))
    .filter(amount => amount > 0);
  return Math.max(0, ...amounts);
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
      const amount = line.match(/\$?\s*([0-9,]+\.\d{2})\b/);
      if (!amount || line.length < 5) return null;
      return {
        description: line.slice(0, 90),
        quantity: "",
        unitPrice: 0,
        total: currencyValue(amount[1].replace(/,/g, "")),
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
    Total: <strong>${money.format(total)}</strong> • Category: <strong>${esc(form.category.value || lastInvoiceRead.category || "Other")}</strong>
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
        <button class="delete-button line-delete" type="button" title="Delete">${iconSvg("trash")}</button>
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

["vendorId", "category", "date", "number", "total"].forEach(name => {
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
  document.getElementById("invoiceCameraFile").value = "";
  readInvoiceFile(event.target.files[0]);
});

document.getElementById("invoiceCameraFile").addEventListener("change", event => {
  document.getElementById("invoiceFile").value = "";
  readInvoiceFile(event.target.files[0]);
});

document.getElementById("readLocalInvoice").addEventListener("click", () => {
  readLocalInvoiceFile(document.getElementById("localInvoiceFile").files[0]);
});

document.getElementById("localInvoiceFile").addEventListener("change", event => {
  document.getElementById("invoiceFile").value = "";
  document.getElementById("invoiceCameraFile").value = "";
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

document.getElementById("invoiceForm").category.addEventListener("change", updateInvoicePreview);
document.getElementById("invoiceForm").total.addEventListener("change", updateInvoicePreview);

document.getElementById("reportRange").addEventListener("change", event => {
  applyReportRange(event.currentTarget.value);
});

document.getElementById("savedReportSelect").addEventListener("change", event => {
  const report = state.customReports.find(item => item.id === event.currentTarget.value);
  if (!report) {
    updateCustomReportPanel();
    return;
  }
  const form = document.getElementById("reportForm");
  form.type.value = "custom";
  document.getElementById("customReportName").value = report.name;
  setCustomReportFields(report.fields || []);
  updateCustomReportPanel();
});

document.querySelector('#reportForm [name="type"]').addEventListener("change", updateCustomReportPanel);

document.getElementById("saveCustomReport").addEventListener("click", () => {
  const name = document.getElementById("customReportName").value.trim();
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

document.getElementById("reportForm").addEventListener("submit", event => {
  event.preventDefault();
  const { singleDate, start, end, type, category, person, savedReport } = formData(event.currentTarget);
  const reportPreset = state.customReports.find(report => report.id === savedReport);
  const activeType = reportPreset ? "custom" : type;
  const customFields = reportPreset ? reportPreset.fields : selectedCustomReportFields();
  const effectiveStart = singleDate || start;
  const effectiveEnd = singleDate || end;
  const inRange = item => (!effectiveStart || (item.date && item.date >= effectiveStart)) && (!effectiveEnd || (item.date && item.date <= effectiveEnd));
  const payroll = state.payroll
    .filter(inRange)
    .filter(item => !person || item.personId === person);
  const invoices = state.invoices
    .filter(inRange)
    .filter(item => invoiceMatchesCategory(item, category))
    .filter(item => !person || person === `vendor:${item.vendorId}`);

  const payrollTotal = payroll.reduce((sum, item) => sum + payrollFinalCheckAmount(item), 0);
  const invoiceTotal = invoices.reduce((sum, item) => sum + currencyValue(item.total), 0);
  const extraTotal = payroll.reduce((sum, item) => sum + currencyValue(item.extra), 0);
  const tipDeductionTotal = payroll.reduce((sum, item) => sum + waiterTipDeduction(item), 0);
  const cashCheckTotal = payroll
    .filter(item => ["Cash", "Check"].includes(item.method))
    .reduce((sum, item) => sum + payrollFinalCheckAmount(item), 0);

  const reportSummary = document.getElementById("reportSummary");
  reportSummary.innerHTML = "";
  reportSummary.append(
    summaryCard("Payroll", money.format(payrollTotal), "blue"),
    summaryCard("Invoices", money.format(invoiceTotal), "pink"),
    summaryCard("Extra Pay", money.format(extraTotal), "green"),
    summaryCard("Tip Deduction", money.format(tipDeductionTotal), "orange")
  );

  const reportRowsByType = {
    summary: [
      detailRow("Payroll total", `${payroll.length} payroll entries`, payrollTotal),
      detailRow("Invoice total", `${invoices.length} invoices`, invoiceTotal),
      detailRow("Extra pay total", "All extra pay and reasons", extraTotal),
      detailRow("Waiter tip deduction", "3% deducted from waiter tips", tipDeductionTotal),
      detailRow("Cash/check written", "Cash and check payroll final checks", cashCheckTotal)
    ],
    all: [
      ...payroll.map(item => detailRow(`${item.date} • ${personName(item.personId)}`, `${payrollMeta(item)} • ${item.reason || "No reason"}`, payrollFinalCheckAmount(item))),
      ...invoices.map(item => detailRow(`${item.date || "No date"} • ${vendorName(item.vendorId)}`, `${item.category || "No category"} • Invoice ${item.number || "blank"}`, currencyValue(item.total)))
    ],
    payroll: payroll.map(item => detailRow(`${item.date} • ${personName(item.personId)}`, payrollMeta(item), payrollFinalCheckAmount(item))),
    invoices: invoices.map(item => detailRow(`${item.date || "No date"} • ${vendorName(item.vendorId)}`, `${item.category || "No category"} • Invoice ${item.number || "blank"}`, currencyValue(item.total))),
    employeeTotals: totalRows(groupTotals(
      payroll.filter(item => String(item.personId).startsWith("employee:")),
      item => personName(item.personId),
      item => payrollFinalCheckAmount(item)
    )),
    vendorTotals: totalRows(mergeTotals(
      groupTotals(
        payroll.filter(item => String(item.personId).startsWith("vendor:")),
        item => personName(item.personId),
        item => payrollFinalCheckAmount(item)
      ),
      groupTotals(invoices, item => vendorName(item.vendorId), item => currencyValue(item.total))
    )),
    categoryTotals: totalRows(allCategorySpendingTotals(invoices)),
    categorySpending: Object.entries(allCategorySpendingTotals(invoices))
      .sort((a, b) => b[1] - a[1])
      .map(([category, total]) => {
        const percent = invoiceTotal ? Math.round((total / invoiceTotal) * 100) : 0;
        return detailRow(category, `${percent}% of invoice spending`, total);
      }),
    paymentMethods: totalRows(groupTotals(payroll, item => item.method || "No method", item => payrollFinalCheckAmount(item))),
    extraPay: payroll
      .filter(item => String(item.personId).startsWith("employee:"))
      .filter(item => currencyValue(item.extra) > 0)
      .map(item => detailRow(`${item.date} • ${personName(item.personId)}`, `Extra pay reason: ${item.reason || "No reason entered"}`, currencyValue(item.extra))),
    waiterTips: payroll
      .filter(isWaiterTipEntry)
      .map(item => detailRow(`${item.date} • ${personName(item.personId)}`, `Tips ${money.format(currencyValue(item.amount))} • 3% deduction ${money.format(waiterTipDeduction(item))} • Final check`, payrollFinalCheckAmount(item)))
  };

  let reportRows = reportRowsByType[activeType] || [];
  if (activeType === "custom") {
    const fields = customFields.length ? customFields : ["summary"];
    reportRows = fields.flatMap(field => [
      sectionHeader({
        summary: "Summary Totals",
        payroll: "Payroll Detail",
        invoices: "Invoice Detail",
        employeeTotals: "Employee Totals",
        vendorTotals: "Vendor Totals",
        categoryTotals: "Expense By Category",
        categorySpending: "Category Spending Detail",
        paymentMethods: "Payment Methods",
        extraPay: "Extra Pay Reasons",
        waiterTips: "Waiter Tips Final Checks"
      }[field] || field),
      ...(reportRowsByType[field] || [])
    ]);
  }

  const waiterTipsTotal = payroll.filter(isWaiterTipEntry).reduce((sum, item) => sum + payrollFinalCheckAmount(item), 0);
  const total = activeType === "invoices" || activeType === "categoryTotals" ? invoiceTotal : activeType === "extraPay" ? extraTotal : activeType === "waiterTips" ? waiterTipsTotal : payrollTotal + invoiceTotal;
  document.getElementById("reportTotal").textContent = money.format(total);
  renderList("reportOutput", reportRows, "No results for this report.");
});

document.querySelectorAll('input[type="date"]').forEach(input => {
  if (input.name === "date") input.value = today;
});

const cashCollectionDate = document.querySelector('#cashCollectionForm input[name="date"]');
if (cashCollectionDate) cashCollectionDate.value = today;
setCashDashboardRange("month");
applyReportRange("");
updateCustomReportPanel();
updateInvoiceReadActions();
renderAll();
