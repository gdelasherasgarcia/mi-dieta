// Lector de códigos de barras a partir de una FOTO (sirve en cualquier navegador y sin conexión segura: no usa la cámara en vivo).
// Usa zxing-wasm (licencia en js/vendor). Se carga solo la primera vez que se pide un código.
let lib = null;
function cargarLib() {
  if (lib) return lib;
  lib = new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/zxing-reader.js';
    s.onload = () => {
      try { ZXingWASM.setZXingModuleOverrides({ locateFile: (p, pre) => p.endsWith('.wasm') ? 'js/vendor/zxing_reader.wasm' : pre + p }); ok(ZXingWASM); }
      catch (e) { ko(e); }
    };
    s.onerror = () => { lib = null; ko(new Error('No se pudo cargar el lector de códigos.')); };
    document.head.append(s);
  });
  return lib;
}

async function aImagen(file, lado) {                 // reduce las fotos enormes del móvil antes de leerlas
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.(); return g.getImageData(0, 0, c.width, c.height);
}

// Devuelve la lista de códigos numéricos (EAN/UPC) que encuentra en la foto, o [].
export async function leerCodigo(file) {
  const Z = await cargarLib();
  for (const lado of [2000, 1400, 2800]) {
    const r = await Z.readBarcodes(await aImagen(file, lado), { tryHarder: true, maxNumberOfSymbols: 4 });
    const t = r.map(x => String(x.text || '').replace(/\s/g, '')).filter(x => /^\d{8,14}$/.test(x));
    if (t.length) return [...new Set(t)];
  }
  return [];
}
