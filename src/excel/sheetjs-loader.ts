// Loads the browser build of SheetJS (xlsx.full.min.js) and returns window.XLSX
export async function loadXLSX(): Promise<any> {
  // hard reset any stale globals
  (window as any).XLSX = undefined;

  const urls = [
    'https://cdn.jsdelivr.net/npm/xlsx@0.19.3/dist/xlsx.full.min.js',
    'https://unpkg.com/xlsx@0.19.3/dist/xlsx.full.min.js',
    '/xlsx.full.min.js', // optional local fallback
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
      const XLSX = (window as any).XLSX;
      if (XLSX && typeof XLSX.read === 'function') {
        console.info('[SheetJS] loaded from', url);
        return XLSX;
      }
    } catch {}
  }
  throw new Error('Failed to load SheetJS (xlsx.full.min.js)');
}
