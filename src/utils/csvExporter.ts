import {
  downloadExcel,
  formatExcelDateTime,
  formatExcelDate,
  formatExcelCurrency,
  formatExcelNumber,
  ExcelExportOptions
} from './excelExporter';

/**
 * Re-export Excel XLSX exporter under CSV aliases to guarantee that all export
 * callers across the application seamlessly produce true formatted .xlsx files.
 */
export const downloadCSV = (options: ExcelExportOptions): void => {
  downloadExcel(options);
};

export const formatCSVDateTime = formatExcelDateTime;
export const formatCSVDate = formatExcelDate;
export const formatCSVCurrency = formatExcelCurrency;
export const formatCSVNumber = formatExcelNumber;

export { downloadExcel, formatExcelDateTime, formatExcelDate, formatExcelCurrency, formatExcelNumber };
