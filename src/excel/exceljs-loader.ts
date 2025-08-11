export async function loadExcelJS(): Promise<{ Workbook: any }> {
  const urls = [
    'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
    'https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js',
    '/exceljs.min.js', // local fallback if you host it
  ];

  for (const url of urls) {
    try {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url; s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('failed ' + url));
        document.head.appendChild(s);
      });

      // Try all the common shapes the script might attach
      const g = window as any;
      const candidate =
        g.ExcelJS?.Workbook ||
        g.exceljs?.Workbook ||
        g.ExcelJS?.default?.Workbook ||
        g.exceljs?.default?.Workbook;

      if (typeof candidate === 'function') {
        console.info('[ExcelJS] loaded from', url);
        return { Workbook: candidate };
      } else {
        console.warn('[ExcelJS] unexpected shape from', url, {
          ExcelJS: !!g.ExcelJS, exceljs: !!g.exceljs,
          ExcelJS_keys: g.ExcelJS ? Object.keys(g.ExcelJS) : [],
        });
      }
    } catch {
      /* try next url */
    }
  }
  throw new Error('ExcelJS browser bundle not found/usable. Ensure dist/exceljs.min.js is used, not the Node build.');
}
