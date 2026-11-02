// Producto nuevo: si lo que acabas de comprar no está en el catálogo (ni por nombre ni por código de barras), pregunta de dónde viene
// y lo apunta con el nombre del comercio. Así el catálogo crece con lo que compras de verdad, sea del Eroski, del Dia o del comercio de la esquina.
// (La app no puede consultar la web del Eroski: la comprobación es contra tu propio catálogo.)
import * as S from './store.js';
import { esc, nuevoId } from './util.js';
import { abrirHoja, avisar } from './ui.js';
import { CATEGORIAS } from './catalogo_semilla.js';

const N = { kcal: null, grasas: null, sat: null, hidratos: null, azucares: null, prot: null, sal: null };
const conocido = ({ nombre, ean }) => S.buscarCatalogo(nombre) || (ean ? S.buscarCatalogoEan(ean) : null);

// `despues` se llama al terminar (con el producto del catálogo, o null si no se apunta).
export function preguntarOrigen({ nombre, ean = null, categoria = 'fresco' }, despues = () => {}) {
  const ya = conocido({ nombre, ean }); if (ya) { despues(ya); return; }
  const d = S.datos(), comercios = [...new Set(d.catalogo.map(p => p.comercio).filter(c => c && c !== 'Eroski'))];
  abrirHoja(`<h1>Producto nuevo</h1><p class="sub">«${esc(nombre)}» no está en tu catálogo.</p>
    <p>¿De dónde viene?</p>
    <button class="btn main grande" type="submit" value="eroski">Es del Eroski</button>
    <h2>Si es de otro sitio</h2>
    <label class="campo"><span>¿En qué comercio lo has comprado?</span><input name="comercio" list="lista-comercios" autocomplete="off" placeholder="p. ej. Dia, la tienda de la esquina">
      <datalist id="lista-comercios">${comercios.map(c => `<option value="${esc(c)}">`).join('')}<option value="Dia"></datalist></label>
    <label class="campo"><span>Tipo</span><select name="categoria">${CATEGORIAS.map(([k, t]) => `<option value="${k}" ${k === categoria ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    <div class="fila"><button class="btn main grow" type="submit" value="otro">Apuntarlo con ese comercio</button></div>
    <button class="btn grande" style="margin-top:10px" type="submit" value="no">No apuntarlo en el catálogo</button>`, (f, acc) => {
    if (acc === 'no') { setTimeout(() => despues(null), 0); return true; }
    const otro = acc === 'otro', comercio = otro ? (f.comercio || '').trim() : 'Eroski';
    if (otro && !comercio) { avisar('Escribe en qué comercio lo has comprado.'); return false; }
    const prod = { id: nuevoId(), nombre, marca: '', categoria: f.categoria || categoria, formato: '', precio: null, en_tienda: otro ? 'no' : 'si', ean: ean || null, notas: '', ...N, fuente: 'apuntado al comprarlo', verificado: false, comercio };
    d.catalogo.push(prod); S.guardar(); avisar(`«${nombre.slice(0, 40)}» apuntado en el catálogo (${comercio}).`);
    setTimeout(() => despues(prod), 0); return true;
  });
}
