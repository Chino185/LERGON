// Translation dictionaries for the system to support any selected world language
export interface TranslationMap {
  [key: string]: string;
}

export const TRANSLATIONS: { [langCode: string]: TranslationMap } = {
  en: {
    dashboard: "Dashboard",
    inventory: "Inventory",
    creditManagement: "Credit",
    transactions: "Transactions",
    reports: "Reports",
    settings: "Settings",
    exportAuditExcel: "Export Audit Excel",
    "export audit excel": "Export Audit Excel",
    logOut: "Log Out",
    lowStock: "Low Stock",
    outOfStock: "Out of Stock",
    overdue: "Overdue",
    active: "Active",
    settled: "Settled",
    partiallyPaid: "Partially Paid",
    search: "Search",
    updateSettings: "Update Settings",
    profileSettings: "Profile Settings",
    systemSettings: "System Settings",
    securitySettings: "Security Settings",
    adminProfile: "Administrative Profile Details",
    securityCredentials: "Security Credentials",
    registeredTradeName: "Registered Trade Name",
    username: "Username",
    defaultCountry: "Default Country",
    systemBaseCurrency: "System Base Currency",
    contactPhone: "Contact Phone Callout",
    officialEmail: "Official Business Email",
    language: "System Language Default",
    allAlertsCleared: "All stock parameters meet reorder limits.",
    systemNotificationCenter: "System Notification Center",
    alerts: "Alerts",
    liveActivities: "Live Activities",
    ledgerManager: "AI BUSINESS PARTNER",
    viewFullAuditLedger: "View Full Audit Ledger",
    noAlertsPending: "No Alerts Pending",
    reorderLevel: "Reorder point",
    supplier: "Supplier",
    location: "Location",
    notes: "Notes",
    invoiceGenerator: "Invoice",
    date: "Date",
    "bill to": "Bill To",
    address: "Address",
    qty: "Qty",
    "item description": "Item Description",
    "unit price": "Unit Price",
    "total due": "Total Due",
    "grand total": "Grand Total"
  }
};

// Falls back to English
export function translate(key: string, langCode: string = "en"): string {
  if (TRANSLATIONS.en && TRANSLATIONS.en[key]) {
    return TRANSLATIONS.en[key];
  }

  // Fallback for custom labels
  const formatted = key.replace(/([A-Z])/g, " $1");
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
