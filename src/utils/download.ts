export type Cell = string | number | null;

export interface SheetSpec {
  sheet: string;
  data: Cell[][];
}

/** Save rows as .xlsx (library loaded on demand to keep the first page light). */
export async function downloadExcel(rows: Cell[][] | SheetSpec[], fileName: string): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const isMulti = rows.length > 0 && !Array.isArray(rows[0]);
  const writer = isMulti ? writeExcelFile(rows as SheetSpec[]) : writeExcelFile(rows as Cell[][]);
  await writer.toFile(fileName);
}

export function downloadText(text: string, fileName: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** A ready-to-fill workbook: yearly target, monthly indicator and drivers, instructions. */
export async function downloadTemplate(): Promise<void> {
  const months: Cell[][] = [];
  for (let y = 2015; y <= 2024; y++) {
    for (let m = 1; m <= 12; m++) months.push([`${y}-${String(m).padStart(2, '0')}`, null, null, null]);
  }
  await downloadExcel(
    [
      {
        sheet: 'Nam',
        data: [['Năm', 'Bien_can_du_bao'], ...Array.from({ length: 10 }, (_, i): Cell[] => [2015 + i, null])],
      },
      {
        sheet: 'Thang',
        data: [['Tháng', 'Chi_bao_thang', 'Bien_ngoai_sinh_1', 'Bien_ngoai_sinh_2'], ...months],
      },
      {
        sheet: 'Huong_dan',
        data: [
          ['Cách điền'],
          [
            '1. Sheet Nam: số liệu năm của biến cần dự báo (số dương). Nếu đã có số tháng, điền thẳng vào sheet Thang và bỏ trống sheet Nam.',
          ],
          [
            '2. Sheet Thang: một chỉ báo theo tháng tương quan cao với biến cần dự báo (dùng để phân rã), và các biến có thể ảnh hưởng.',
          ],
          [
            '3. Cần ít nhất 6 năm. Mỗi năm có đủ 12 tháng. Thời gian ghi dạng 2024 (năm), 2024Q1 (quý) hoặc 2024-01 (tháng).',
          ],
          ['4. Đổi tên cột tùy ý; trên web bạn sẽ chọn cột nào đóng vai trò gì.'],
        ],
      },
    ],
    'foresight-lab-file-mau.xlsx',
  );
}
