import * as XLSX from 'xlsx';

/**
 * Shared Excel (XLSX) Exporter Utility
 * Generates true .xlsx spreadsheet files with explicit column widths, formatted dates, right-aligned currency/numbers,
 * and header row styling so files open cleanly in Excel and Google Sheets without manual user formatting.
 */

// Helper to format date-time string as "8/8/2026 8:40"
export function formatExcelDateTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${month}/${day}/${year} ${hours}:${minutes}`;
  } catch {
    return String(dateInput);
  }
}

// Helper to format date-only string as "8/8/2026"
export function formatExcelDate(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  } catch {
    return String(dateInput);
  }
}

// Helper to format currency string as "$40.00"
export function formatExcelCurrency(val: number | string | null | undefined, symbol: string = '$'): string {
  if (val === null || val === undefined || val === '') return `${symbol}0.00`;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return `${symbol}0.00`;
  return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper to format quantity or count as plain number string
export function formatExcelNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '0';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return String(val);
  return num.toLocaleString('en-US');
}

export interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number)[][];
}

/**
 * Primary export function: Exports data as a true formatted .xlsx Excel file.
 */
export function downloadExcel({ filename, sheetName = 'Export Data', headers, rows }: ExcelExportOptions): void {
  // 1. Calculate explicit column widths based on maximum character length of headers and row cells
  const colWidths = headers.map((header, colIndex) => {
    let maxLen = header.length;
    rows.forEach(row => {
      const cellVal = row[colIndex] !== undefined && row[colIndex] !== null ? String(row[colIndex]) : '';
      if (cellVal.length > maxLen) {
        maxLen = cellVal.length;
      }
    });
    // Add safety margin padding (+5) so Excel/Google Sheets never truncate text or show ###
    return Math.max(maxLen + 5, 14);
  });

  // 2. Build 2D data array (header row + data rows)
  const aoaData = [headers, ...rows];

  // 3. Create SheetJS worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(aoaData);

  // 4. Set explicit column widths on worksheet
  worksheet['!cols'] = colWidths.map(w => ({ wch: w }));

  // 5. Apply header styling and cell formats
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];
      if (!cell) continue;

      if (R === 0) {
        // Header Row Styling: Bold font, light gray background fill
        cell.s = {
          font: { bold: true, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "E2E8F0" } },
          alignment: { vertical: "center", horizontal: "left" }
        };
      }
    }
  }

  // 6. Create Workbook and append worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // 7. Ensure clean filename ending with .xlsx
  const cleanFilename = filename.replace(/\.csv$/i, '').replace(/\.xlsx$/i, '') + '.xlsx';

  // 8. Trigger binary download as true .xlsx file
  XLSX.writeFile(workbook, cleanFilename);
}
