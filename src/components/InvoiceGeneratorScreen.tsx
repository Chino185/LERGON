import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Printer,
  Plus,
  Trash2,
  Eye,
  Edit3,
  RefreshCw,
  FileText,
  Sparkles,
  User,
  Calendar,
  DollarSign,
  CheckCircle2,
  ChevronDown,
  FileQuestion,
  HelpCircle,
  Undo2,
  Info,
  Upload,
  Search,
  X,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BusinessConfig, InventoryItem, CreditAccount, StockAdjustment, CreditTransaction } from '../types';
import { translate } from '../utils/translations';
import MaterialIcon from './MaterialIcon';
import NeumorphicSelect, { NeumorphicSelectOption } from './NeumorphicSelect';

interface InvoiceGeneratorScreenProps {
  inventory: InventoryItem[];
  creditAccounts: CreditAccount[];
  adjustments: StockAdjustment[];
  transactions: CreditTransaction[];
  config: BusinessConfig;
  currentOrgId?: string;
  currentUserUid?: string;
}

interface DocRow {
  id: string;
  type: 'billable' | 'question' | 'conjunction' | 'blank_lines';
  title: string;
  // For billable items
  qty?: number;
  rate?: number;
  sku?: string;
  // For conjunction or fill-in questions
  sentenceParts?: string[]; // e.g. ["He was tired after a long day,", "he washed all the dishes."]
  choices?: string[]; // choices displayed in brackets, e.g. ["and", "but", "so"]
  correctOption?: string;
  // For standard questions
  blankSpacingLines?: number; // e.g. 1 to 4 blank lines under question
  hasTrueFalse?: boolean; // displays "True / False" at the end
}

// Highly optimized local-state buffered input to prevent typing lag with heavy print sheets
interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (val: string) => void;
  debounceMs?: number;
}

function DebouncedInput({ value, onChange, debounceMs = 120, ...props }: DebouncedInputProps) {
  const [localVal, setLocalVal] = useState(value);

  // Synchronize when the value changes from the parent state (presets or manual reset)
  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localVal !== value) {
        onChange(localVal);
      }
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [localVal, debounceMs, onChange, value]);

  return (
    <input
      {...props}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
    />
  );
}

export default function InvoiceGeneratorScreen({
  inventory = [],
  creditAccounts = [],
  adjustments = [],
  transactions = [],
  config,
  currentOrgId,
  currentUserUid
}: InvoiceGeneratorScreenProps) {
  // Preset types
  type PresetType = 'invoice_credit' | 'custom';
  const [activePreset, setActivePreset] = useState<PresetType>('invoice_credit');

  // Page layout state
  const [companyName, setCompanyName] = useState(() => config?.businessName || '');
  const [companySubHeader, setCompanySubHeader] = useState('');
  const [companyAddress, setCompanyAddress] = useState(() => config?.address || '');
  const [companyContact, setCompanyContact] = useState(() => [config?.phone, config?.email].filter(Boolean).join('   '));
  const [professionalTag, setProfessionalTag] = useState('');
  const [documentTopic, setDocumentTopic] = useState('PROFORMA INVOICE');
  const [paymentInstructionsTitle, setPaymentInstructionsTitle] = useState('');
  const [paymentBankName, setPaymentBankName] = useState('');
  const [paymentAccountNumber, setPaymentAccountNumber] = useState('');
  const [paymentBranch, setPaymentBranch] = useState('');

  const [invoiceNo, setInvoiceNo] = useState(() => `INV-${Date.now().toString().slice(-8)}`);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase());
  const [billTo, setBillTo] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  // Sizing and scaling state
  const [showMetaBlock, setShowMetaBlock] = useState(true);
  const [spacingScale, setSpacingScale] = useState<number>(3); // 1 to 5 scale for spacing
  const [successAnimation, setSuccessAnimation] = useState(false);
  const [isPdfBusy, setIsPdfBusy] = useState(false);
  const persistedInvoiceFingerprint = useRef<string | null>(null);
  const persistedInvoiceId = useRef<string | null>(null);

  // Customizable Logo state (Custom files only + size adjustment)
  const [logoImage, setLogoImage] = useState<string>(''); // base64 uploaded image string
  const [logoWidth, setLogoWidth] = useState<number>(84); // logo display width in px
  const [logoHeight, setLogoHeight] = useState<number>(84); // logo display height in px

  // Sub-heading tag line customization (left aligned by default + size/width/height controls)
  const [professionalAlign, setProfessionalAlign] = useState<'left' | 'center' | 'right'>('left');
  const [professionalFontSize, setProfessionalFontSize] = useState<number>(13); // text size in px
  const [professionalPaddingY, setProfessionalPaddingY] = useState<number>(6); // controls tagline padding/height in px
  const [professionalWidthPct, setProfessionalWidthPct] = useState<number>(100); // controls tagline wrapper width %

  // Custom document rows state
  const [rows, setRows] = useState<DocRow[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');

  // Quantity prompt modal states
  const [qtyModalOpen, setQtyModalOpen] = useState(false);
  const [qtyModalItem, setQtyModalItem] = useState<InventoryItem | null>(null); // null if custom line
  const [qtyInputValue, setQtyInputValue] = useState('1');

  // Input autofocus ref
  const qtyInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (qtyModalOpen) {
      const timer = setTimeout(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [qtyModalOpen]);

  // UI States
  const [viewMode, setViewMode] = useState<'composer' | 'preview'>('composer');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [invoiceAccountId, setInvoiceAccountId] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState(config?.currencySymbol || 'GH₵');
  const [previewZoom, setPreviewZoom] = useState<number>(0.85); // default 0.85 scale for print preview fit
  const [sheetWidthMm, setSheetWidthMm] = useState<number>(210); // standard A4 sheet width (210mm)

  // Active credit account computing for autofills
  const activeUnpaidDetails = useMemo(() => {
    if (!invoiceAccountId) return null;
    const account = creditAccounts.find(acc => acc.id === invoiceAccountId);
    if (!account) return null;

    // Filter adjustments for this account that are sales or outstanding
    const relevantAdjs = adjustments.filter(adj => adj.creditAccountId === account.id && adj.type === 'sale_out');
    const relevantTxns = transactions.filter(txn => txn.creditAccountId === account.id);

    return {
      account,
      adjustments: relevantAdjs,
      transactions: relevantTxns,
      unpaidSummary: `${selectedCurrency}${(account.remainingAmount || 0).toLocaleString()}`
    };
  }, [invoiceAccountId, creditAccounts, adjustments, transactions, selectedCurrency]);

  // Load layout preset without inventing business or inventory records.
  // Billable rows are always selected from the live inventory search widget.
  const handleLoadPreset = (preset: PresetType, selectedAccId?: string) => {
    setActivePreset(preset);
    setCompanyName(config?.businessName || '');
    setCompanyAddress(config?.address || '');
    setCompanyContact([config?.phone, config?.email].filter(Boolean).join('   '));
    setCompanySubHeader('');
    setProfessionalTag('');
    setDocumentTopic(preset === 'invoice_credit' ? 'PROFORMA INVOICE' : 'INVOICE');
    setSelectedCurrency(config?.currencySymbol || '');

    setLogoWidth(preset === 'invoice_credit' ? 84 : 90);
    setLogoHeight(preset === 'invoice_credit' ? 84 : 90);
    setProfessionalAlign('left');
    setProfessionalFontSize(12);
    setProfessionalPaddingY(6);
    setProfessionalWidthPct(100);

    if (selectedAccId) {
      const acc = creditAccounts.find(a => a.id === selectedAccId);
      if (acc) {
        setBillTo(acc.name.toUpperCase());
        setClientAddress(acc.email || '');
        setInvoiceDate(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase());
        return;
      }
    }

    setBillTo('');
    setClientAddress('');
    setRows([]);
  };

  // Autofill selector change
  const handleAccountAutofill = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const accId = e.target.value;
    setInvoiceAccountId(accId);
    if (accId) {
      handleLoadPreset('invoice_credit', accId);
    }
  };

  const handleInvoiceAccountSelect = (accId: string) => {
    setInvoiceAccountId(accId);
    if (accId) {
      handleLoadPreset('invoice_credit', accId);
    }
  };

  const invoiceAccountOptions: NeumorphicSelectOption[] = useMemo(() => [
    { value: '', label: `-- ${translate('choose account to auto-populate', config.languageCode)} --` },
    ...(creditAccounts || []).map(acc => ({
      value: acc.id,
      label: `${acc.name.toUpperCase()} (Owes: ${selectedCurrency}${acc.remainingAmount.toLocaleString()})`
    }))
  ], [creditAccounts, config.languageCode, selectedCurrency]);

  // Add standard blank/question row
  const handleAddQuestionRow = () => {
    const newIdx = rows.length + 1;
    const newRow: DocRow = {
      id: `row-added-${Date.now()}`,
      type: 'question',
      title: `${newIdx}. Enter custom question or note line here`,
      blankSpacingLines: 3,
      hasTrueFalse: false
    };
    setRows(prev => [...prev, newRow]);
  };

  // Add billable item row from the live inventory list only.
  const handleAddBillableRow = (invItem: InventoryItem, qty: number = 1) => {
    if (!invItem || qty <= 0) return;

    const newRow: DocRow = {
      id: `row-added-bill-${invItem.id}-${Date.now()}`,
      type: 'billable',
      title: invItem.name.toUpperCase(),
      qty,
      rate: invItem.unitPrice,
      sku: invItem.sku
    };
    setRows(prev => [...prev, newRow]);

    // Quick success trigger
    setSuccessAnimation(true);
    setTimeout(() => setSuccessAnimation(false), 800);
  };

  // Initiate quantity modal prompt
  const handleInitiateAddPrompt = (item: InventoryItem) => {
    setQtyModalItem(item);
    setQtyInputValue('1');
    setQtyModalOpen(true);
  };

  // Confirm quantity and add/update row
  const handleConfirmAddQty = () => {
    const qty = parseInt(qtyInputValue, 10);
    if (isNaN(qty) || qty <= 0) {
      return;
    }

    if (!qtyModalItem) return;

    const item = qtyModalItem;
    const existingIdx = rows.findIndex(r => r.type === 'billable' && r.sku === item.sku);
    if (existingIdx !== -1) {
      const updatedRows = [...rows];
      updatedRows[existingIdx] = {
        ...updatedRows[existingIdx],
        qty: (updatedRows[existingIdx].qty || 0) + qty
      };
      setRows(updatedRows);
    } else {
      handleAddBillableRow(item, qty);
    }

    setQtyModalOpen(false);
    setQtyModalItem(null);
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConfirmAddQty();
    } else if (e.key === 'Escape') {
      setQtyModalOpen(false);
    }
  };

  // Delete specific row
  const handleDeleteRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Update specific row parameter
  const handleUpdateRow = (id: string, updatedParams: Partial<DocRow>) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, ...updatedParams };
      }
      return row;
    }));
  };

  // Move row in sequence
  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === rows.length - 1) return;

    const nextIdx = direction === 'up' ? index - 1 : index + 1;
    const swapped = [...rows];
    const temp = swapped[index];
    swapped[index] = swapped[nextIdx];
    swapped[nextIdx] = temp;
    setRows(swapped);
  };

  // Total calculation for billable items
  const invoiceCalculatedTotal = useMemo(() => {
    return rows.reduce((acc, row) => {
      if (row.type === 'billable') {
        const qty = row.qty || 0;
        const rate = row.rate || 0;
        return acc + (qty * rate);
      }
      return acc;
    }, 0);
  }, [rows]);

  // Split billable items into segments for pristine A4 pages. Page 1 (index 0) holds 18 items max, subsequent pages hold 26 items max.
  const billableItems = useMemo(() => rows.filter(r => r.type === 'billable'), [rows]);

  const itemsPages = useMemo(() => {
    const list = [...billableItems];
    if (list.length === 0) return [[] as DocRow[]];
    const chunks: DocRow[][] = [];

    const firstPageSize = 18;
    const subsequentPageSize = 26;

    // First chunk (Page 1)
    chunks.push(list.slice(0, firstPageSize));

    // Subsequent chunks (Page 2+)
    let remaining = list.slice(firstPageSize);
    while (remaining.length > 0) {
      chunks.push(remaining.slice(0, subsequentPageSize));
      remaining = remaining.slice(subsequentPageSize);
    }

    return chunks;
  }, [billableItems]);

  const invoiceFingerprint = useMemo(() => JSON.stringify({
    invoiceNo,
    billTo,
    clientAddress,
    companyName,
    companySubHeader,
    companyAddress,
    companyContact,
    professionalTag,
    documentTopic,
    paymentInstructionsTitle,
    paymentBankName,
    paymentAccountNumber,
    paymentBranch,
    logoImage,
    logoWidth,
    logoHeight,
    professionalAlign,
    professionalFontSize,
    professionalPaddingY,
    professionalWidthPct,
    showMetaBlock,
    rows,
    grandTotal: invoiceCalculatedTotal
  }), [
    invoiceNo,
    billTo,
    clientAddress,
    companyName,
    companySubHeader,
    companyAddress,
    companyContact,
    professionalTag,
    documentTopic,
    paymentInstructionsTitle,
    paymentBankName,
    paymentAccountNumber,
    paymentBranch,
    logoImage,
    logoWidth,
    logoHeight,
    professionalAlign,
    professionalFontSize,
    professionalPaddingY,
    professionalWidthPct,
    showMetaBlock,
    rows,
    invoiceCalculatedTotal
  ]);

  const clearPdfArtifacts = () => {
    document
      .querySelectorAll('.html2pdf__overlay, .html2pdf__container, .html2canvas-container, #invoice-pdf-capture-root')
      .forEach((node) => node.remove());
  };

  const setInvoicePrintContext = (enabled: boolean) => {
    document.documentElement.classList.toggle('invoice-printing', enabled);
    document.body?.classList.toggle('invoice-printing', enabled);
  };

  useEffect(() => {
    return () => {
      clearPdfArtifacts();
      setInvoicePrintContext(false);
    };
  }, []);

  const handleBackToEditor = () => {
    clearPdfArtifacts();
    setIsPdfBusy(false);
    setViewMode('composer');
    setIsPreviewMode(false);
  };

  const printInvoiceSheets = () => {
    setViewMode('preview');
    setIsPreviewMode(true);

    setTimeout(() => {
      const printableSheets = Array.from(document.querySelectorAll<HTMLElement>('.printable-sheet'));
      if (printableSheets.length === 0) return;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) return;

      const sheetsHtml = printableSheets.map(sheet => {
        const clone = sheet.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.no-print').forEach(el => el.remove());
        clone.style.zoom = '1';
        clone.style.transform = 'none';
        return clone.outerHTML;
      }).join('');

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${invoiceNo || 'Invoice'}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 0;
              }
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                margin: 0;
                padding: 0;
                background: #ffffff;
                color: #000000;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              }
              .printable-sheet {
                width: 210mm;
                min-height: 297mm;
                height: 297mm;
                max-width: 210mm;
                padding: 15mm;
                margin: 0 auto;
                background: #ffffff;
                color: #000000;
                box-sizing: border-box;
                position: relative;
                display: flex;
                flex-direction: column;
                page-break-after: always;
                break-after: page;
              }
              .printable-sheet:last-of-type {
                page-break-after: auto;
                break-after: auto;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
              }
              th, td {
                border: 1px solid #000000;
                padding: 4px 8px;
              }
              .bg-black { background-color: #000000 !important; color: #ffffff !important; }
              .bg-white { background-color: #ffffff !important; }
              .bg-slate-100 { background-color: #f1f5f9 !important; }
              .text-white { color: #ffffff !important; }
              .text-black { color: #000000 !important; }
              .text-slate-900 { color: #0f172a !important; }
              .text-slate-500 { color: #64748b !important; }
              .border-black { border-color: #000000 !important; }
              .border-slate-300 { border-color: #cbd5e1 !important; }
              .border { border: 1px solid #000000 !important; }
              .border-b { border-bottom: 1px solid #000000 !important; }
              .border-b-\\[5px\\] { border-bottom: 5px solid #000000 !important; }
              .border-t { border-top: 1px solid #000000 !important; }
              .border-2 { border: 2px solid #000000 !important; }
              .border-r-2 { border-right: 2px solid #000000 !important; }
              .grid { display: grid; }
              .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .gap-4 { gap: 16px; }
              .flex { display: flex; }
              .flex-col { flex-direction: column; }
              .items-center { align-items: center; }
              .justify-between { justify-content: space-between; }
              .justify-end { justify-content: flex-end; }
              .justify-center { justify-content: center; }
              .justify-start { justify-content: flex-start; }
              .text-center { text-align: center; }
              .text-left { text-align: left; }
              .text-right { text-align: right; }
              .font-extrabold, .font-black { font-weight: 800; }
              .uppercase { text-transform: uppercase; }
              .w-full { width: 100%; }
              .h-full { height: 100%; }
              .shrink-0 { flex-shrink: 0; }
              .whitespace-nowrap { white-space: nowrap; }
              .whitespace-pre-wrap { white-space: pre-wrap; }
              .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
              .relative { position: relative; }
              .absolute { position: absolute; }
              .mt-auto { margin-top: auto; }
              .rounded-lg { border-radius: 8px; }
              .rounded-xl { border-radius: 12px; }
              .rounded-2xl { border-radius: 16px; }
              .rounded-full { border-radius: 9999px; }
              .space-y-4 > * + * { margin-top: 16px; }
              .space-y-2 > * + * { margin-top: 8px; }
              .space-y-0\\.5 > * + * { margin-top: 2px; }
            </style>
          </head>
          <body>
            ${sheetsHtml}
          </body>
        </html>
      `);
      iframeDoc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          iframe.remove();
        }, 2500);
      }, 300);
    }, 150);
  };

  const handleShowPreview = () => {
    clearPdfArtifacts();
    setIsPdfBusy(false);
    setViewMode('preview');
    setIsPreviewMode(true);
  };

  const handlePrintInvoice = () => {
    setViewMode('preview');
    setIsPreviewMode(true);

    window.setTimeout(() => {
      window.focus();
      window.print();
    }, 150);
  };

  return (
    <div className="flex-1 w-full max-w-none xl:max-w-[1550px] mx-auto px-4 py-6 flex flex-col xl:flex-row gap-6 min-h-0 relative">

      {/* Dynamic print-targeted CSS style sheet override injected into DOM */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          /* Enforce standard A4 Portrait paper dimensions and page boundaries */
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }

          /* Completely collapse and remove non-print layout wrappers */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide all non-printable UI elements completely so they take 0 layout height */
          header, nav, footer, .no-print, [id*="sidebar"], [class*="no-print"], .lg\:col-span-5, [id*="floating-siri"] {
            display: none !important;
            height: 0 !important;
            width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            visibility: hidden !important;
          }

          /* Ensure root containers display cleanly from the very top of page 1 */
          #root, main, #root > div, [class*="max-w-"], [class*="flex-1"] {
            display: block !important;
            position: static !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
            max-width: none !important;
          }

          #invoice-print-root {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            padding: 0 !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            width: 210mm !important;
            max-width: 210mm !important;
          }

          /* Lock layout sheet to standard physical A4 paper dimensions */
          .printable-sheet {
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
            width: 210mm !important;
            max-width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            box-sizing: border-box !important;
            border: none !important;
            box-shadow: none !important;
            padding: 15mm 18mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            zoom: 1 !important;
            transform: none !important;
            visibility: visible !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .printable-sheet:last-of-type {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .printable-sheet * {
            visibility: visible !important;
            color: #000000 !important;
            border-color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .printable-sheet .bg-black,
          .printable-sheet tr.bg-black {
            background-color: #000000 !important;
            color: #ffffff !important;
          }

          .printable-sheet .bg-black * {
            color: #ffffff !important;
          }
        }
      `}} />

      {/* COMPOSER WORKSPACE LAYOUT */}
      <div className={`flex flex-col gap-5 no-print ${viewMode === 'preview' ? 'hidden' : 'w-full max-w-7xl mx-auto'}`}>

        {/* Composer Header & Preview Trigger (Crextio & Finnova Aesthetic) */}
        <div className="finnova-card p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 neumorphic-circle text-slate-900 flex items-center justify-center">
              <MaterialIcon name="receipt_long" size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-slate-900">{translate('invoice composer', config.languageCode)}</h2>
              <span className="text-xs text-slate-500 font-medium">{translate('search warehouse items, adjust quantities, and edit company details', config.languageCode)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleShowPreview}
              className="w-full sm:w-auto px-6 py-2.5 neumorphic-btn-dark font-black rounded-full flex items-center justify-center gap-2 cursor-pointer text-xs shadow-md hover:brightness-110 active:scale-95 transition"
            >
              <Eye size={14} />
              <span>{translate('preview invoice layout', config.languageCode)}</span>
            </button>
          </div>
        </div>

        {/* Two-Column Split: Controls on Left, Live-Added & Inventory Lists on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ================= LEFT COLUMN: DETAILS & CUSTOMIZATIONS ================= */}
          <div className="lg:col-span-5 flex flex-col gap-5 no-print">

            {/* Format Presets */}
            <div className="finnova-card p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 neumorphic-circle bg-[#ebf0f7] dark:bg-[#202225] text-slate-900 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <MaterialIcon name="tune" size={16} />
                  </span>
                  <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white">{translate('layout format presets', config.languageCode)}</h2>
                </div>

                <span className="text-[9px] neumorphic-btn text-slate-800 dark:text-white px-2.5 py-1 rounded-full font-extrabold">
                  {translate('pdf-style print', config.languageCode)}
                </span>
              </div>

              <p className="text-[10px] text-slate-600 dark:text-slate-300 mb-3 leading-relaxed font-bold">
                {translate('choose the pristine proforma invoice preset or standard custom drafting. supports live modifications.', config.languageCode)}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleLoadPreset('invoice_credit')}
                  className={`p-3.5 rounded-2xl transition flex flex-col justify-between cursor-pointer ${activePreset === 'invoice_credit'
                    ? 'neumorphic-inset border-2 border-sky-500 text-slate-900 dark:text-white font-black bg-sky-500/10'
                    : 'neumorphic-btn text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white'
                    }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <MaterialIcon name="description" size={16} className={activePreset === 'invoice_credit' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'} />
                    <span className="text-[8px] neumorphic-btn text-slate-800 dark:text-white font-extrabold px-2 py-0.5 rounded uppercase font-mono">{translate('image exact', config.languageCode)}</span>
                  </div>
                  <span className="text-[10px] mt-2 block font-black text-slate-900 dark:text-white">{companyName || translate('proforma invoice', config.languageCode)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadPreset('custom')}
                  className={`p-3.5 rounded-2xl transition flex flex-col justify-between cursor-pointer ${activePreset === 'custom'
                    ? 'neumorphic-inset border-2 border-sky-500 text-slate-900 dark:text-white font-black bg-sky-500/10'
                    : 'neumorphic-btn text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white'
                    }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <MaterialIcon name="edit" size={16} className={activePreset === 'custom' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'} />
                    <span className="text-[8px] neumorphic-btn text-slate-800 dark:text-white font-extrabold px-2 py-0.5 rounded uppercase font-mono">{translate('draft', config.languageCode)}</span>
                  </div>
                  <span className="text-[10px] mt-2 block font-black text-slate-900 dark:text-white">{translate('custom table template', config.languageCode)}</span>
                </button>
              </div>

              {/* Credit account integration: auto fill details */}
              {creditAccounts && creditAccounts.length > 0 && (
                <div className="pt-3 border-t border-slate-200/50">
                  <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">
                    {translate('autofill client account credit balance', config.languageCode)}
                  </label>
                  <NeumorphicSelect
                    value={invoiceAccountId}
                    onChange={handleInvoiceAccountSelect}
                    options={invoiceAccountOptions}
                    placeholder={`-- ${translate('choose account to auto-populate', config.languageCode)} --`}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* Enterprise settings card */}
            <div className="finnova-card p-4 sm:p-5 space-y-3.5">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-2">
                <span>{translate('enterprise identity', config.languageCode)}</span>
                <span className="text-[9px] text-slate-600 dark:text-slate-300 lowercase font-mono font-bold">{translate('logo & headers', config.languageCode)}</span>
              </h3>

              {/* Logo Setup */}
              <div className="bg-slate-50/50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200/85 dark:border-white/10 space-y-2.5">
                <label className="block text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>{translate('company logo image', config.languageCode)}</span>
                  <span className="text-[7.5px] px-2 py-0.5 text-slate-800 dark:text-white neumorphic-btn rounded uppercase font-extrabold font-mono">{translate('custom upload', config.languageCode)}</span>
                </label>

                <div className="text-[9px] space-y-2">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setLogoImage(event.target.result as string);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setLogoImage(event.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                    className="neumorphic-inset p-5 rounded-2xl border-2 border-dashed border-slate-300 text-center cursor-pointer transition flex flex-col items-center gap-1.5"
                  >
                    {logoImage ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <img
                          src={logoImage}
                          alt="Uploaded logo preview"
                          className="object-contain rounded border border-slate-100 bg-slate-50 p-0.5"
                          style={{ width: `${Math.min(60, logoWidth)}px`, height: `${Math.min(60, logoHeight)}px` }}
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-[7.5px] text-slate-900 font-extrabold uppercase font-sans">{translate('image ready &middot; click to change', config.languageCode)}</span>
                      </div>
                    ) : (
                      <>
                        <Upload size={14} className="text-slate-400 animate-pulse" />
                        <p className="text-[8px] font-black text-slate-700 font-sans">{translate('drag & drop logo image here', config.languageCode)}</p>
                        <p className="text-[7px] text-slate-400">{translate('or click to browse local files', config.languageCode)}</p>
                      </>
                    )}
                  </div>

                  {logoImage && (
                    <button
                      type="button"
                      onClick={() => setLogoImage('')}
                      className="w-full py-1 text-center font-extrabold text-red-500 bg-red-50 hover:bg-red-105 rounded-lg text-[7.5px] uppercase transition cursor-pointer border border-red-200/40"
                    >
                      {translate('remove logo image', config.languageCode)}
                    </button>
                  )}

                  {/* Logo Size Adjustment Sliders */}
                  <div className="pt-2 border-t border-slate-200/40 space-y-2">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[7.5px] font-black uppercase text-slate-500">
                        <span>{translate('logo display width', config.languageCode)}</span>
                        <span className="text-slate-900 font-mono text-[8px] font-black">{logoWidth}PX</span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={240}
                        step={2}
                        value={logoWidth}
                        onChange={(e) => setLogoWidth(Number(e.target.value))}
                        className="neumorphic-range cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[7.5px] font-black uppercase text-slate-500">
                        <span>{translate('logo display height', config.languageCode)}</span>
                        <span className="text-slate-900 font-mono text-[8px] font-black">{logoHeight}PX</span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={240}
                        step={2}
                        value={logoHeight}
                        onChange={(e) => setLogoHeight(Number(e.target.value))}
                        className="neumorphic-range cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Company / Client Identities */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">{translate('company / enterprise name', config.languageCode)}</label>
                  <DebouncedInput
                    type="text"
                    value={companyName}
                    onChange={(val) => setCompanyName(val.toUpperCase())}
                    placeholder="e.g. Your business name"
                    className="w-full text-xs text-slate-900 rounded-full px-4 py-2.5 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">{translate('store slogan banner', config.languageCode)}</label>
                  <DebouncedInput
                    type="text"
                    value={companySubHeader}
                    onChange={(val) => setCompanySubHeader(val.toUpperCase())}
                    className="w-full text-xs text-slate-900 rounded-full px-4 py-2.5 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">{translate('physical location address', config.languageCode)}</label>
                  <DebouncedInput
                    type="text"
                    value={companyAddress}
                    onChange={(val) => setCompanyAddress(val.toUpperCase())}
                    className="w-full text-xs text-slate-900 rounded-full px-4 py-2.5 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">{translate('store direct contact / phone / email', config.languageCode)}</label>
                  <DebouncedInput
                    type="text"
                    value={companyContact}
                    onChange={(val) => setCompanyContact(val)}
                    className="w-full text-xs text-slate-900 rounded-full px-4 py-2.5 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200/40 space-y-2">
                  <div className="text-[8.5px] font-black text-slate-500 uppercase">Payment instructions (optional)</div>
                  <DebouncedInput
                    type="text"
                    value={paymentInstructionsTitle}
                    onChange={(val) => setPaymentInstructionsTitle(val.toUpperCase())}
                    placeholder="e.g. Payment details"
                    className="w-full text-xs text-slate-900 rounded-full px-4 py-2.5 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                  />
                  <DebouncedInput
                    type="text"
                    value={paymentBankName}
                    onChange={(val) => setPaymentBankName(val.toUpperCase())}
                    placeholder="Bank or payment provider"
                    className="w-full text-xs text-slate-900 rounded-full px-4 py-2.5 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <DebouncedInput
                      type="text"
                      value={paymentAccountNumber}
                      onChange={setPaymentAccountNumber}
                      placeholder="Account / wallet number"
                      className="w-full text-xs text-slate-900 rounded-full px-4 py-2.5 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                    />
                    <DebouncedInput
                      type="text"
                      value={paymentBranch}
                      onChange={(val) => setPaymentBranch(val.toUpperCase())}
                      placeholder="Branch or payment note"
                      className="w-full text-xs text-slate-900 rounded-full px-4 py-2.5 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                    />
                  </div>
                </div>
              </div>

              {/* Subheading Alignment and Styling */}
              <div className="finnova-card p-3.5 space-y-2.5">
                <div>
                  <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">{translate('sub-heading label tagline', config.languageCode)}</label>
                  <DebouncedInput
                    type="text"
                    value={professionalTag}
                    onChange={(val) => setProfessionalTag(val.toUpperCase())}
                    className="w-full text-xs text-slate-900 rounded-full px-4 py-2.5 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <span className="block text-[7.5px] font-black text-slate-400 uppercase tracking-wider mb-1">{translate('tagline alignment', config.languageCode)}</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => setProfessionalAlign(align)}
                        className={`py-1.5 px-2 text-[8px] font-black rounded-full uppercase transition cursor-pointer ${professionalAlign === align
                          ? 'neumorphic-inset text-slate-900 font-extrabold bg-slate-200/50'
                          : 'finnova-card text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        {translate(align, config.languageCode)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-200/50">
                  <div>
                    <div className="flex justify-between items-center text-[7.5px] font-black uppercase text-slate-500">
                      <span>{translate('tag text font size', config.languageCode)}</span>
                      <span className="text-slate-900 font-mono text-[8px] font-black">{professionalFontSize}PX</span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={22}
                      step={1}
                      value={professionalFontSize}
                      onChange={(e) => setProfessionalFontSize(Number(e.target.value))}
                      className="neumorphic-range cursor-pointer mt-1"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-[7.5px] font-black uppercase text-slate-500 font-sans">
                      <span>{translate('tag padding vertical', config.languageCode)}</span>
                      <span className="text-slate-900 font-mono text-[8px] font-black">{professionalPaddingY}PX</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={1}
                      value={professionalPaddingY}
                      onChange={(e) => setProfessionalPaddingY(Number(e.target.value))}
                      className="neumorphic-range cursor-pointer mt-1"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-[7.5px] font-black uppercase text-slate-500 font-sans">
                      <span>{translate('tag border width span', config.languageCode)}</span>
                      <span className="text-slate-900 font-mono text-[8px] font-black">{professionalWidthPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      value={professionalWidthPct}
                      onChange={(e) => setProfessionalWidthPct(Number(e.target.value))}
                      className="neumorphic-range cursor-pointer mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Document Designation Badge and dates */}
            <div className="finnova-card p-4 sm:p-5 space-y-3.5">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
                <span>{translate('designation & dates', config.languageCode)}</span>
              </h3>

              <div>
                <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">{translate('invoice designation title badge', config.languageCode)}</label>
                <DebouncedInput
                  type="text"
                  value={documentTopic}
                  onChange={(val) => setDocumentTopic(val.toUpperCase())}
                  className="w-full text-xs text-slate-900 rounded-full px-4 py-2.5 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[8.0px] font-black text-slate-500 uppercase mb-0.5">{translate('invoice no', config.languageCode)}</label>
                  <DebouncedInput
                    type="text"
                    value={invoiceNo}
                    onChange={(val) => setInvoiceNo(val)}
                    className="w-full text-xs text-slate-900 rounded-full px-3 py-2 neumorphic-inset font-mono font-bold text-center focus:outline-hidden transition"
                  />
                </div>
                <div>
                  <label className="block text-[8.0px] font-black text-slate-500 uppercase mb-0.5">{translate('invoice date', config.languageCode)}</label>
                  <DebouncedInput
                    type="text"
                    value={invoiceDate}
                    onChange={(val) => setInvoiceDate(val)}
                    className="w-full text-xs text-slate-900 rounded-full px-3 py-2 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                  />
                </div>
              </div>

              {/* Bill To & Client Address */}
              <div className="grid grid-cols-2 gap-3 border-t border-slate-200/50 pt-3">
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase mb-1">{translate('bill to client', config.languageCode)}</label>
                  <DebouncedInput
                    type="text"
                    value={billTo}
                    onChange={(val) => setBillTo(val)}
                    placeholder="e.g. Samuel Zar"
                    className="w-full text-xs text-slate-900 rounded-full px-3 py-2 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase mb-1">{translate('client address location', config.languageCode)}</label>
                  <DebouncedInput
                    type="text"
                    value={clientAddress}
                    onChange={(val) => setClientAddress(val)}
                    placeholder="e.g. Accra, Ghana"
                    className="w-full text-xs text-slate-900 rounded-full px-3 py-2 neumorphic-inset font-bold text-center focus:outline-hidden transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-200/50 pt-3">
                {/* Currency Symbol change */}
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase mb-0.5 flex justify-between items-center">
                    <span>{translate('currency symbol', config.languageCode)}</span>
                    {config?.currencySymbol && selectedCurrency !== config.currencySymbol && (
                      <button
                        type="button"
                        onClick={() => setSelectedCurrency(config.currencySymbol)}
                        className="text-[7px] font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition uppercase shrink-0 border border-indigo-150 cursor-pointer"
                      >
                        {translate('reset', config.languageCode)}
                      </button>
                    )}
                  </label>
                  <DebouncedInput
                    type="text"
                    value={selectedCurrency}
                    onChange={(val) => setSelectedCurrency(val)}
                    placeholder={config?.currencySymbol || "GH₵ or $"}
                    className="w-full text-xs text-slate-900 rounded-full px-3 py-2 neumorphic-inset font-mono font-bold text-center focus:outline-hidden transition"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <span className="text-[8px] font-black text-slate-450 uppercase mb-1">{translate('display client address', config.languageCode)}</span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showMetaBlock}
                      onChange={(e) => setShowMetaBlock(e.target.checked)}
                      className="neumorphic-checkbox"
                    />
                    <span className="ml-1.5 text-[9px] font-bold text-slate-650">{translate('show borders on pdf', config.languageCode)}</span>
                  </label>
                </div>
              </div>
            </div>

          </div>

          {/* ================= RIGHT COLUMN: INTERACTIVE ITEMS & INVENTORY ================= */}
          <div className="lg:col-span-7 flex flex-col gap-5">

            {/* STORE WAREHOUSE INVENTORY FAST-ADD WIDGET */}
            <div className="finnova-card p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full neumorphic-circle text-slate-900 dark:text-white flex items-center justify-center font-bold shrink-0 border border-slate-300 dark:border-slate-700">
                    <Search size={14} className="text-slate-900 dark:text-white" />
                  </span>
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-950 dark:text-white font-jakarta">
                      {translate('store inventory search', config.languageCode)}
                    </h3>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-none mt-0.5 font-extrabold font-jakarta">
                      {translate('search hardware stock to instantly populate your invoice page', config.languageCode)}
                    </p>
                  </div>
                </div>

                <span className="text-[9px] neumorphic-btn text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 px-3 py-1 rounded-full font-extrabold font-jakarta uppercase">
                  {inventory.length} {translate('products', config.languageCode)}
                </span>
              </div>

              {/* SEARCH TEXTBOX */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
                  <Search size={13} />
                </span>
                <input
                  type="text"
                  placeholder={translate('type description, category or sku code to select...', config.languageCode)}
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="w-full text-xs text-slate-950 dark:text-white rounded-full pl-9 pr-4 py-2.5 neumorphic-inset focus:outline-hidden transition placeholder:text-slate-500 dark:placeholder:text-slate-400 font-extrabold font-jakarta"
                />
              </div>

              {/* MATCHED STOCK ITEMS GRID */}
              <div className="max-h-60 overflow-y-auto pr-1 [scrollbar-width:thin] space-y-2">
                {(() => {
                  const query = inventorySearch.trim().toLowerCase();
                  const filtered = inventory.filter(item =>
                    item.name.toLowerCase().includes(query) ||
                    item.sku.toLowerCase().includes(query) ||
                    (item.category || '').toLowerCase().includes(query)
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-6 neumorphic-inset rounded-2xl">
                        <p className="text-[10px] text-slate-700 dark:text-slate-300 font-extrabold uppercase tracking-wider font-jakarta">
                          {translate('no matching inventory goods found', config.languageCode)}
                        </p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold font-jakarta">
                          {translate('search the live inventory list above to add an item to this invoice.', config.languageCode)}
                        </p>
                      </div>
                    );
                  }

                  return filtered.slice(0, 10).map(item => {
                    // Check if this SKU is already added on our current invoice rows, and sum the quantity
                    const addedRowsOfItem = rows.filter(r => r.type === 'billable' && r.sku === item.sku);
                    const totalQtyAdded = addedRowsOfItem.reduce((acc, curr) => acc + (curr.qty || 0), 0);

                    return (
                      <div
                        key={item.id}
                        className="p-3 neumorphic-inset rounded-2xl flex items-center justify-between gap-3 text-[10.5px]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-950 dark:text-white uppercase block truncate font-jakarta" title={item.name}>
                              {item.name}
                            </span>
                            <span className="text-[8.5px] neumorphic-btn px-2 py-0.5 rounded text-slate-900 dark:text-white font-extrabold font-jakarta uppercase tracking-wider border border-slate-300 dark:border-slate-700 shrink-0">
                              SKU: {item.sku}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[9.5px] text-slate-700 dark:text-slate-300 font-extrabold font-jakarta mt-1">
                            <span>
                              {translate('stock', config.languageCode)}: <b className={`font-jakarta ${item.quantity <= item.reorderPoint ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-900 dark:text-white font-black'}`}>{item.quantity}</b> {translate('rem.', config.languageCode)}
                            </span>
                            <span>&middot;</span>
                            <span>
                              {translate('price', config.languageCode)}: <b className="text-slate-950 dark:text-white font-black font-jakarta">{selectedCurrency}{item.unitPrice.toFixed(2)}</b>
                            </span>
                          </div>
                        </div>

                        {/* Actions controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          {totalQtyAdded > 0 && (
                            <span className="text-[8.5px] bg-indigo-600 text-white font-extrabold font-jakarta px-2.5 py-0.5 rounded-full uppercase shadow-xs">
                              {translate('added', config.languageCode)}: {totalQtyAdded}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleInitiateAddPrompt(item)}
                            className="neumorphic-btn bg-slate-950 text-white dark:bg-slate-800 dark:text-white font-extrabold font-jakarta uppercase px-3.5 py-1.5 text-[9.5px] cursor-pointer flex items-center gap-1 rounded-xl shadow-sm hover:scale-[1.02] active:scale-[0.98] transition"
                          >
                            <Plus size={11} />
                            <span>{translate('add', config.languageCode)}</span>
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}

                {inventory.length > 10 && (
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 text-center italic pt-1.5 font-bold font-jakarta">
                    {translate('showing top matching items. use the search box above to narrow down results.', config.languageCode)}
                  </p>
                )}
              </div>
            </div>

            {/* BILL GOODS CURRENTLY ADDED PANEL */}
            <div className="finnova-card p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full neumorphic-circle text-slate-950 dark:text-white font-extrabold text-xs flex items-center justify-center font-jakarta shrink-0 border border-slate-300 dark:border-slate-700">
                    {rows.length}
                  </span>
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-950 dark:text-white font-jakarta">
                      {translate('invoice goods on sheet', config.languageCode)}
                    </h3>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 font-extrabold font-jakarta">
                      {translate('verify added store items and physical quantities below', config.languageCode)}
                    </p>
                  </div>
                </div>


              </div>

              {/* Added items list mapping */}
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 [scrollbar-width:thin]">
                {rows.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/20 dark:bg-slate-900/20">
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-extrabold uppercase tracking-wider font-jakarta">
                      {translate('no items added to invoice yet', config.languageCode)}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-normal font-bold font-jakarta">
                      {translate('search and click on live inventory goods in the panel above to populate this invoice.', config.languageCode)}
                    </p>
                  </div>
                ) : (
                  rows.map((row, index) => (
                    <div
                      key={row.id}
                      className="finnova-card p-4 space-y-3 relative group transition text-[10px] border border-slate-200/80 dark:border-slate-800"
                    >
                      {/* Row meta/header actions */}
                      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-extrabold text-slate-950 dark:text-white font-jakarta text-xs">
                            {translate('item #', config.languageCode)} {index + 1}
                          </span>
                          <span className="text-[8.5px] neumorphic-btn px-2.5 py-0.5 rounded-full text-slate-900 dark:text-white font-extrabold font-jakarta uppercase tracking-wider border border-slate-300 dark:border-slate-700">
                            {row.sku ? `SKU: ${row.sku}` : translate('custom', config.languageCode)}
                          </span>

                          {/* Subtotal calculation */}
                          <span className="text-[10.5px] text-slate-950 dark:text-white font-extrabold font-jakarta ml-1">
                            {translate('subtotal', config.languageCode)}: {selectedCurrency}{((row.qty || 0) * (row.rate || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Row reorder buttons */}
                          <button
                            type="button"
                            onClick={() => handleMoveRow(index, 'up')}
                            disabled={index === 0}
                            className="w-8 h-8 flex items-center justify-center neumorphic-circle disabled:opacity-30 text-slate-950 dark:text-white hover:text-black dark:hover:text-white font-extrabold cursor-pointer transition active:scale-95 border border-slate-300 dark:border-slate-700"
                            title={translate('move up', config.languageCode)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveRow(index, 'down')}
                            disabled={index === rows.length - 1}
                            className="w-8 h-8 flex items-center justify-center neumorphic-circle disabled:opacity-30 text-slate-950 dark:text-white hover:text-black dark:hover:text-white font-extrabold cursor-pointer transition active:scale-95 border border-slate-300 dark:border-slate-700"
                            title={translate('move down', config.languageCode)}
                          >
                            ↓
                          </button>

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="w-8 h-8 flex items-center justify-center neumorphic-circle text-slate-950 dark:text-white hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition active:scale-95 border border-slate-300 dark:border-slate-700"
                            title={translate('remove item', config.languageCode)}
                          >
                            <Trash2 size={13} className="text-slate-950 dark:text-white" />
                          </button>
                        </div>
                      </div>

                      {/* Inputs */}
                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[9px] text-slate-700 dark:text-slate-300 font-extrabold uppercase mb-1 text-left font-jakarta">{translate('item description / name', config.languageCode)}</label>
                          <DebouncedInput
                            type="text"
                            value={row.title}
                            onChange={(val) => handleUpdateRow(row.id, { title: val.toUpperCase() })}
                            className="w-full text-xs text-slate-950 dark:text-white rounded-full px-4 py-2.5 neumorphic-inset font-extrabold font-jakarta text-center uppercase focus:outline-hidden transition"
                            placeholder={translate('e.g. 8mm nuts', config.languageCode)}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] text-slate-700 dark:text-slate-300 font-extrabold uppercase mb-1 text-left font-jakarta">{translate('unit price', config.languageCode)}</label>
                            <input
                              type="number"
                              step="0.01"
                              value={row.rate || 0}
                              onChange={(e) => handleUpdateRow(row.id, { rate: Number(e.target.value) })}
                              className="w-full text-xs text-slate-950 dark:text-white rounded-full px-3 py-2.5 neumorphic-inset font-extrabold font-jakarta text-center focus:outline-hidden transition"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-700 dark:text-slate-300 font-extrabold uppercase mb-1 text-left font-jakarta">{translate('quantity', config.languageCode)}</label>
                            <input
                              type="number"
                              value={row.qty || 1}
                              onChange={(e) => handleUpdateRow(row.id, { qty: Number(e.target.value) })}
                              className="w-full text-xs text-slate-950 dark:text-white rounded-full px-3 py-2.5 neumorphic-inset font-extrabold font-jakarta text-center focus:outline-hidden transition"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-700 dark:text-slate-300 font-extrabold uppercase mb-1 text-left font-jakarta">{translate('sku / code', config.languageCode)}</label>
                            <DebouncedInput
                              type="text"
                              value={row.sku || ''}
                              onChange={(val) => handleUpdateRow(row.id, { sku: val })}
                              className="w-full text-xs text-slate-950 dark:text-white rounded-full px-3 py-2.5 neumorphic-inset font-extrabold font-jakarta text-center focus:outline-hidden transition"
                              placeholder={translate('optional', config.languageCode)}
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  ))
                )}
              </div>

              {/* Invoice Grand summary total */}
              {rows.length > 0 && (
                <div className="neumorphic-inset p-4 sm:p-5 rounded-2xl flex justify-between items-center text-xs">
                  <span className="font-extrabold uppercase tracking-wider text-slate-900 text-[11px]">
                    {translate('grand total balance added', config.languageCode)}:
                  </span>
                  <span className="font-mono text-sm font-black text-slate-900 tracking-wider">
                    {selectedCurrency}{invoiceCalculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Preview & Print navigation card */}
            <div className="finnova-card p-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-bold text-slate-700">
              <div className="flex flex-col text-left">
                <span>{translate('customization details complete?', config.languageCode)}</span>
                <span className="text-[9px] text-slate-440 font-normal leading-normal mt-0.5">
                  {translate('press below to build and verify the exact proforma layout format representation.', config.languageCode)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleShowPreview}
                className="w-full sm:w-auto px-7 py-3 neumorphic-btn-dark text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <Eye size={14} />
                <span>{translate('preview invoice layout', config.languageCode)}</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* RIGHT: A4 Printable Worksheet/Invoice Live Desk Layout Preview */}
      <div className={`flex-1 flex flex-col gap-5 overflow-hidden ${viewMode === 'composer' ? 'hidden' : 'w-full'}`}>

        {/* Render Live Top Bar Actions (Crextio & Finnova Aesthetic) */}
        <div className="finnova-card p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={handleBackToEditor}
              className="text-xs neumorphic-inset text-slate-900 font-extrabold uppercase tracking-wider px-4 py-2 rounded-full transition flex items-center gap-2 cursor-pointer hover:bg-slate-200/60 pointer-events-auto"
            >
              <Undo2 size={14} className="text-slate-700" />
              <span>{translate('back to editor', config.languageCode)}</span>
            </button>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900">{translate('proforma live preview', config.languageCode)}</span>
              <span className="text-[10px] text-slate-500 font-medium">{translate('exact standard layout template', config.languageCode)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handlePrintInvoice}
              disabled={isPdfBusy}
              className="text-xs neumorphic-btn-dark px-7 py-3 flex items-center gap-2 cursor-pointer font-sans font-black uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              <Printer size={15} />
              <span>{translate('print invoice', config.languageCode)}</span>
            </button>
          </div>
        </div>

        {/* The Digital Page Desktop canvas board */}
        <div id="invoice-print-root" className={`flex-1 overflow-auto px-2 py-6 finnova-card rounded-3xl flex flex-col items-center gap-6 [scrollbar-width:thin] ${isPreviewMode ? 'p-12 bg-slate-300' : ''
          }`}>

          {itemsPages.map((pageItems, pageIndex) => {
            const isFirstPage = pageIndex === 0;
            const isLastPage = pageIndex === itemsPages.length - 1;

            return (
              <div
                key={`page-${pageIndex}`}
                style={{
                  zoom: previewZoom,
                  maxWidth: `${sheetWidthMm}mm`
                }}
                className="printable-sheet bg-white text-black w-full min-h-[297mm] p-10 sm:p-14 shadow-xl border border-slate-300 relative flex flex-col select-all font-sans text-[12px] leading-relaxed transition-all duration-300 space-y-4 page-break"
              >

                {/* Top reference strip */}
                <div className="absolute top-2 left-0 right-0 flex justify-between items-center px-10 sm:px-14 opacity-20 select-none no-print text-[7.5px] font-mono uppercase tracking-widest text-slate-500">
                  <span>{companyName || translate('proforma invoice', config.languageCode)}</span>
                  <span>{translate('page', config.languageCode)} {pageIndex + 1} {translate('of', config.languageCode)} {itemsPages.length}</span>
                </div>

                {/* Header Area: logo and business text use independent positioning layers. */}
                {isFirstPage && (
                  <div
                    className="relative w-full border-b-[5px] border-black pb-3 select-text"
                    style={{ minHeight: `${Math.max(logoHeight + 12, 98)}px` }}
                  >
                    {/* Logo layer: does not participate in the text layout. */}
                    <div
                      className="absolute left-0 bottom-1 flex items-center justify-center p-0.5 bg-white overflow-hidden z-10"
                      style={{ width: `${logoWidth}px`, height: `${logoHeight}px` }}
                    >
                      {logoImage ? (
                        <img
                          src={logoImage}
                          alt={translate('company logo', config.languageCode)}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        // Standard Google MaterialIcon store badge fallback
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 border border-slate-300 rounded-xl text-slate-900">
                          <MaterialIcon name="storefront" size={Math.min(36, logoWidth * 0.5)} />
                          <span className="text-[7.5px] font-black uppercase text-slate-900 tracking-wider mt-0.5">
                            {translate('company', config.languageCode)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Text layer: always uses the full header width and remains centered. */}
                    <div className="w-full flex flex-col items-center text-center">
                      <h1 className="text-xl sm:text-2xl font-extrabold tracking-wider text-black uppercase" style={{ fontFamily: 'Arial, sans-serif' }}>
                        {companyName}
                      </h1>

                      {/* Black solid bar with white text */}
                      <div className="bg-black text-white px-2 sm:px-4 py-1 w-full text-[10px] sm:text-[11px] font-black uppercase text-center my-1 tracking-wider">
                        {companySubHeader}
                      </div>

                      <div className="text-[9px] sm:text-[10px] font-extrabold text-black uppercase tracking-wider leading-tight">
                        {companyAddress}
                      </div>

                      <div className="text-[8.5px] sm:text-[9.5px] font-extrabold text-black uppercase tracking-wide mt-0.5">
                        {companyContact}
                      </div>
                    </div>
                  </div>
                )}

                {/* Professional Subheading line */}
                {isFirstPage && (
                  <div
                    style={{
                      paddingTop: `${professionalPaddingY}px`,
                      paddingBottom: `${professionalPaddingY}px`,
                      width: `${professionalWidthPct}%`,
                      marginLeft: professionalAlign === 'center' ? 'auto' : professionalAlign === 'right' ? 'auto' : '0px',
                      marginRight: professionalAlign === 'center' ? 'auto' : professionalAlign === 'left' ? 'auto' : '0px',
                    }}
                    className=""
                  >
                    <h2
                      style={{
                        fontSize: `${professionalFontSize}px`,
                        textAlign: professionalAlign,
                      }}
                      className="font-black text-black uppercase tracking-wider leading-tight select-text"
                    >
                      {professionalTag}
                    </h2>
                  </div>
                )}

                {/* Proforma Invoice Rounded Black Pill */}
                {isFirstPage && (
                  <div className="flex justify-start pt-1">
                    <div className="bg-black text-white px-5 py-1.5 rounded-lg text-xs sm:text-xs font-black uppercase tracking-widest">
                      {documentTopic}
                    </div>
                  </div>
                )}

                {/* Metadata (Invoice No & Date) */}
                {isFirstPage && (
                  <div className="flex justify-between items-center text-xs sm:text-[13px] font-black text-black pt-1">
                    <div className="shrink-0 whitespace-nowrap">
                      {translate('invoice no', config.languageCode).toUpperCase()}: <span>{invoiceNo}</span>
                    </div>
                    <div className="shrink-0 whitespace-nowrap">
                      {translate('date', config.languageCode).toUpperCase()}: <span>{invoiceDate}</span>
                    </div>
                  </div>
                )}

                {/* Bill To & Address columns */}
                {showMetaBlock && isFirstPage && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-black bg-white flex flex-col font-black text-black">
                      <div className="border-b border-black px-2 py-0.5 bg-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-black">
                        {translate('bill to', config.languageCode).toUpperCase()}
                      </div>
                      <div className="p-2 min-h-[44px] text-xs font-extrabold text-black uppercase whitespace-pre-wrap select-text">
                        {billTo || <div className="h-4 border-b border-dashed border-gray-300 w-full mt-2" />}
                      </div>
                    </div>

                    <div className="border border-black bg-white flex flex-col font-black text-black">
                      <div className="border-b border-black px-2 py-0.5 bg-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-black">
                        {translate('address', config.languageCode).toUpperCase()} :
                      </div>
                      <div className="p-2 min-h-[44px] text-xs font-extrabold text-black uppercase whitespace-pre-wrap select-text">
                        {clientAddress || <div className="h-4 border-b border-dashed border-gray-300 w-full mt-2" />}
                      </div>
                    </div>
                  </div>
                )}

                {/* The High-Fidelity Items Grid Table */}
                <div className="w-full pt-2">
                  <table className="w-full border-collapse font-sans text-xs sm:text-[13px] text-black font-extrabold table-fixed">
                    <thead>
                      <tr className="bg-black text-white text-center">
                        <th className="border border-black px-2 py-1.5 text-center text-[10px] sm:text-[11px] font-black uppercase tracking-wider w-[12%]">{translate('qty', config.languageCode).toUpperCase()}</th>
                        <th className="border border-black px-2 py-1.5 text-center text-[10px] sm:text-[11px] font-black uppercase tracking-wider w-[52%]">{translate('item description', config.languageCode).toUpperCase()}</th>
                        <th className="border border-black px-2 py-1.5 text-center text-[10px] sm:text-[11px] font-black uppercase tracking-wider w-[18%]">{translate('unit price', config.languageCode).toUpperCase()}</th>
                        <th className="border border-black px-2 py-1.5 text-center text-[10px] sm:text-[11px] font-black uppercase tracking-wider w-[18%]">{translate('total due', config.languageCode).toUpperCase()}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Map actual rows for this page pageItems */}
                      {pageItems.map((row) => {
                        const qty = row.qty || 0;
                        const rate = row.rate || 0;
                        const total = qty * rate;
                        return (
                          <tr key={row.id} className="text-black font-black uppercase h-[32px]">
                            <td className="border border-black px-2 py-1 text-center font-mono text-[11px] sm:text-xs">
                              {qty}
                            </td>
                            <td className="border border-black px-3 py-1 font-sans truncate text-center" title={row.title}>
                              {row.title}
                            </td>
                            <td className="border border-black px-2 py-1 text-center font-mono text-[11px] sm:text-xs">
                              {selectedCurrency}{rate.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                            </td>
                            <td className="border border-black px-2 py-1 text-center font-mono text-[11px] sm:text-xs">
                              {selectedCurrency}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Unbreakable Payment Footer Container (Grand Total Box + Bank Details Block) */}
                {isLastPage && (
                  <div className="invoice-payment-footer-container w-full pt-2">
                    {/* Grand Total Box (aligned with right table columns) */}
                    <div className="flex justify-end mb-3">
                      <div className="flex border-2 border-black font-black bg-white select-text">
                        <div className="border-r-2 border-black px-4 py-1.5 text-center font-black uppercase tracking-wide text-[10.5px] sm:text-[11px] bg-white text-black">
                          {translate('grand total', config.languageCode).toUpperCase()}
                        </div>
                        <div className="px-5 py-1.5 text-center font-black font-mono text-xs sm:text-[13.5px] bg-white text-black min-w-[130px]">
                          {selectedCurrency}
                          {invoiceCalculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* Optional tenant-specific payment instructions. */}
                    {[paymentInstructionsTitle, paymentBankName, paymentAccountNumber, paymentBranch].some((value) => value.trim()) && (
                      <div className="text-left self-start max-w-sm select-text font-sans space-y-0.5">
                        {paymentInstructionsTitle.trim() && (
                          <div className="text-[11px] font-black text-black uppercase tracking-wider underline decoration-black decoration-1.5 underline-offset-2 mb-1">
                            {paymentInstructionsTitle}
                          </div>
                        )}
                        {paymentBankName.trim() && (
                          <div className="text-[11px] font-black text-black uppercase leading-snug">
                            {paymentBankName}
                          </div>
                        )}
                        {paymentAccountNumber.trim() && (
                          <div className="text-[11px] font-black text-black tracking-wide leading-snug select-all">
                            {paymentAccountNumber}
                          </div>
                        )}
                        {paymentBranch.trim() && (
                          <div className="text-[11px] font-black text-black uppercase leading-snug">
                            {paymentBranch}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Custom generic notes or non-billable rows helper */}
                {isLastPage && rows.filter(r => r.type !== 'billable').length > 0 && (
                  <div className="pt-2 space-y-2 border-t border-dashed border-gray-400 no-print">
                    {rows.filter(r => r.type !== 'billable').map((row, idx) => (
                      <div key={row.id} className="text-xs font-bold text-black uppercase">
                        <div>{idx + 1}. {row.title}</div>
                        {row.blankSpacingLines && row.blankSpacingLines > 0 ? (
                          <div className="space-y-2 pt-1">
                            {Array.from({ length: row.blankSpacingLines }).map((_, lIdx) => (
                              <div key={lIdx} className="h-0 border-b border-dashed border-gray-400 w-full" />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {/* Print Footer Details */}
                <div className="border-t border-black pt-2 text-[8px] sm:text-[9.5px] text-center font-mono uppercase tracking-widest text-black shrink-0 mt-auto flex justify-center select-none">
                  <span>{companyName}</span>
                </div>

              </div>
            );
          })}
        </div>

      </div>

      {/* POPUP QUANTITY PROMPT DIALOG overlay */}
      <AnimatePresence>
        {qtyModalOpen && (
          <div
            onClick={() => setQtyModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm no-print cursor-pointer"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="finnova-card rounded-3xl border border-slate-700/60 dark:border-slate-800 p-6 w-full max-w-sm shadow-2xl flex flex-col gap-5 relative cursor-default text-slate-900 dark:text-white"
            >
              {/* Header Badge & Title */}
              <div className="text-center space-y-1.5">
                <span className="neumorphic-btn px-3 py-1 rounded-full text-[9px] font-extrabold font-jakarta uppercase tracking-wider text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 inline-block">
                  {qtyModalItem ? translate('stock item quantity prompt', config.languageCode) : translate('custom line quantity prompt', config.languageCode)}
                </span>
                <h3 className="text-sm font-extrabold text-slate-950 dark:text-white uppercase tracking-wide pt-1 font-jakarta">
                  {qtyModalItem ? qtyModalItem.name : translate('custom good or credit line', config.languageCode)}
                </h3>
                {qtyModalItem && (
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-extrabold font-jakarta">
                    {translate('sku', config.languageCode)}: <b className="text-slate-900 dark:text-slate-200 font-bold uppercase">{qtyModalItem.sku}</b> &middot; {translate('price', config.languageCode)}: <b className="text-slate-900 dark:text-white font-bold">{selectedCurrency}{qtyModalItem.unitPrice.toFixed(2)}</b> &middot; {translate('stock', config.languageCode)}: <b className="text-slate-900 dark:text-white font-bold">{qtyModalItem.quantity}</b>
                  </p>
                )}
              </div>

              {/* STEPPER CONTAINER (INSET NEUMORPHIC TRACK WITH ZERO OVERFLOW) */}
              <div className="neumorphic-inset bg-slate-100/90 dark:bg-slate-950/80 p-3 rounded-2xl flex items-center justify-between gap-3 border border-slate-200/80 dark:border-slate-800 w-full overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(qtyInputValue, 10) || 0;
                    if (current > 1) {
                      setQtyInputValue(String(current - 1));
                    }
                  }}
                  className="w-11 h-11 rounded-xl neumorphic-btn text-slate-900 dark:text-white font-extrabold text-xl flex items-center justify-center cursor-pointer transition active:scale-95 shrink-0"
                >
                  -
                </button>

                <input
                  ref={qtyInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={qtyInputValue}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setQtyInputValue(val);
                  }}
                  onKeyDown={handleQtyKeyDown}
                  className="w-24 text-center bg-transparent text-3xl font-black font-jakarta text-slate-950 dark:text-white border-none outline-hidden focus:ring-0 select-all"
                />

                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(qtyInputValue, 10) || 0;
                    setQtyInputValue(String(current + 1));
                  }}
                  className="w-11 h-11 rounded-xl neumorphic-btn text-slate-900 dark:text-white font-extrabold text-xl flex items-center justify-center cursor-pointer transition active:scale-95 shrink-0"
                >
                  +
                </button>
              </div>

              {/* QUICK QUANTITY PRESETS */}
              <div className="space-y-2">
                <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block text-left font-jakarta">
                  {translate('quick quantity presets', config.languageCode)}
                </span>
                <div className="grid grid-cols-5 gap-2 font-jakarta">
                  {[1, 5, 10, 50, 100].map((presetVal) => {
                    const isSelected = parseInt(qtyInputValue, 10) === presetVal;
                    return (
                      <button
                        key={presetVal}
                        type="button"
                        onClick={() => setQtyInputValue(String(presetVal))}
                        className={`py-2 rounded-xl text-xs font-extrabold transition cursor-pointer text-center font-jakarta ${isSelected
                          ? 'neumorphic-btn bg-slate-950 text-white dark:bg-slate-800 dark:text-white border border-slate-700/60 shadow-md scale-105'
                          : 'neumorphic-btn text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white'
                          }`}
                      >
                        {presetVal}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CONFIRMATION ACTIONS */}
              <div className="grid grid-cols-2 gap-3 pt-1 font-jakarta">
                <button
                  type="button"
                  onClick={() => setQtyModalOpen(false)}
                  className="neumorphic-btn py-3 px-4 rounded-2xl text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer active:scale-95"
                >
                  {translate('cancel', config.languageCode)}
                </button>
                <button
                  type="button"
                  disabled={!qtyInputValue || parseInt(qtyInputValue, 10) <= 0}
                  onClick={handleConfirmAddQty}
                  className="neumorphic-btn bg-slate-950 text-white dark:bg-slate-800 dark:text-white py-3 px-4 rounded-2xl text-xs font-extrabold uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {translate('confirm add', config.languageCode)}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
