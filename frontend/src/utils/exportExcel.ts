import writeXlsxFile, { type SheetData } from 'write-excel-file/browser';

type CellValue = string | number | boolean | Date | null;

export type ExcelColumn<T> = {
  title: string;
  dataIndex: keyof T;
  render?: (value: T[keyof T], row: T) => CellValue | undefined;
};

export async function exportExcel<T extends object>(fileName: string, sheetName: string, columns: ExcelColumn<T>[], rows: T[]) {
  const data: SheetData = [
    columns.map((column) => column.title),
    ...rows.map((row) =>
      columns.map((column) => {
        const value = row[column.dataIndex];
        const rendered = column.render ? column.render(value, row) : normalizeCellValue(value);
        return normalizeCellValue(rendered);
      }),
    ),
  ];

  await writeXlsxFile(data, { sheet: sheetName }).toFile(ensureXlsx(fileName));
}

function normalizeCellValue(value: unknown): CellValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value;
  return String(value);
}

function ensureXlsx(fileName: string) {
  return fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
}
