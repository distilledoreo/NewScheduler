export async function loadExcelJS(): Promise<any> {
  if ((window as any).ExcelJS) return (window as any).ExcelJS;
  const sources = [
    "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
    "https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js",
    "/exceljs.min.js"
  ];
  for (const src of sources) {
    try {
      await loadScript(src);
      if ((window as any).ExcelJS) return (window as any).ExcelJS;
    } catch {
      // try next source
    }
  }
  throw new Error("Failed to load ExcelJS");
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('load error'));
    document.head.appendChild(s);
  });
}
