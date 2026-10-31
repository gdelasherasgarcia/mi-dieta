// Pantalla «Catálogo»: los productos que Gabriel compra (Eroski) con su nutrición por 100 g. Alimenta el almacén y, más adelante, los menús.
import * as S from '../store.js';
import { esc, nuevoId, hoy } from '../util.js';
import { abrirHoja, campo, avisar, botonFoto } from '../ui.js';
import { CATEGORIAS } from '../catalogo_semilla.js';

let filtro = 'todo', q = '';
const NUTR = [['kcal', 'Energía (kcal)'], ['prot', 'Proteínas (g)'], ['grasas', 'Grasas (g)'], ['sat', 'Saturadas (g)'], ['hidratos', 'Hidratos (g)'], ['azucares', 'Azúcares (g)'], ['sal', 'Sal (g)']];
const fmt = n => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 });
const tiene = v => v !== null && v !== undefined && v !== '';
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const TIENDA = [['?', 'Sin comprobar'], ['si', 'Sí, está'], ['no', 'No está']];
const enTienda = p => p.en_tienda || '?';
const faltan = p => NUTR.filter(([k]) => !tiene(p[k])).length;

function lineaNutricion(p) {
  const f = faltan(p);
  if (f === NUTR.length) return '<span class="chip warn">Falta nutrición</span>';
  const partes = [];
  if (tiene(p.kcal)) partes.push(`${fmt(p.kcal)} kcal`);
  if (tiene(p.prot)) partes.push(`prot ${fmt(p.prot)}`);
  if (tiene(p.sal)) partes.push(`sal ${fmt(p.sal)}`);
  if (tiene(p.azucares)) partes.push(`azúcar ${fmt(p.azucares)}`);
  return `<span class="det">${esc(partes.join(' · '))} /100 g</span>` + (f ? ` <span class="chip warn">faltan ${f}</span>` : '') + (p.verificado ? ' <span class="chip ok">etiqueta</span>' : '');
}

function listaHtml() {
  const c = S.datos().catalogo;
  const lista = c.filter(p => filtro === 'todo' || (filtro === 'sin' ? faltan(p) > 0 : filtro === 'tienda' ? enTienda(p) === 'si' : filtro === 'nohay' ? enTienda(p) === 'no' : p.categoria === filtro))
    .filter(p => !q || norm(p.nombre + ' ' + p.marca + ' ' + p.notas).includes(norm(q)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return lista.map(p => `
    <button type="button" class="item" data-act="cat-editar" data-id="${esc(p.id)}" style="${enTienda(p) === 'no' ? 'opacity:.5' : ''}">
      <span class="grow"><span class="nom" style="display:block">${esc(p.nombre)}</span>
      <span class="det" style="display:block">${esc([p.formato, tiene(p.precio) ? fmt(p.precio) + ' €' : ''].filter(Boolean).join(' · '))}${p.notas ? (p.formato || tiene(p.precio) ? ' · ' : '') + esc(p.notas) : ''}</span>
      <span style="display:block">${lineaNutricion(p)}</span></span>
      <span class="chip ${enTienda(p) === 'si' ? 'ok' : enTienda(p) === 'no' ? 'bad' : ''}">${enTienda(p) === 'si' ? 'En mi tienda' : enTienda(p) === 'no' ? 'No está' : 'Sin comprobar'}</span></button>`).join('') || '<div class="card vacio">Nada con ese filtro.</div>';
}

export function render() {
  const c = S.datos().catalogo, sin = c.filter(p => faltan(p) > 0).length;
  const filtros = [['todo', 'Todo'], ...CATEGORIAS, ['tienda', `En mi tienda (${c.filter(p => enTienda(p) === 'si').length})`], ['nohay', 'No están'], ['sin', `Sin nutrición (${sin})`]].map(([k, t]) =>
    `<button type="button" class="filtro" data-act="cat-filtro" data-k="${k}" aria-pressed="${filtro === k}">${esc(t)}</button>`).join('');
  return `
    <div class="fila sep"><div><h1>Catálogo</h1><p class="sub" style="margin:0">${c.length} productos · ${c.length - sin} con nutrición completa</p></div>
      <button type="button" class="btn main" data-act="cat-nuevo">+ Añadir</button></div>
    <div style="height:12px"></div>
    <input id="cat-q" type="search" placeholder="Buscar producto…" value="${esc(q)}" autocomplete="off" style="width:100%;min-height:50px;padding:8px 12px;border-radius:12px;border:1px solid var(--line);background:var(--card)">
    <div class="filtros" role="group" aria-label="Filtrar catálogo" style="margin-top:10px">${filtros}</div>
    <div id="cat-lista">${listaHtml()}</div>
    <h2>Compartir el catálogo</h2>
    <div class="card">
      <p style="margin-top:0">Guarda el catálogo en un archivo, o fusiona uno (por ejemplo con datos de etiquetas): solo rellena lo que falta o cambia, no borra nada.</p>
      <button type="button" class="btn grande" data-act="cat-exportar">Guardar catálogo (archivo)</button>
      <label class="btn grande" style="display:flex;align-items:center;justify-content:center;margin-top:10px">
        Fusionar un catálogo<input type="file" accept="application/json,.json" data-act="cat-importar" hidden></label>
    </div>
    <p class="nota-pie">Valores por 100 g, tal como salen en la etiqueta. «etiqueta» = revisado con la etiqueta del envase. Los datos de bases públicas (Open Food Facts) no están verificados: se comprueban antes de marcarlos.</p>`;
}

document.addEventListener('input', ev => {                       // buscar sin redibujar toda la pantalla (así no se pierde el cursor)
  if (!ev.target.matches('#cat-q')) return;
  q = ev.target.value; const l = document.getElementById('cat-lista'); if (l) l.innerHTML = listaHtml();
});

function formulario(p, nuevo = !p) {
  const v = x => esc(x ?? '');
  p = p || { nombre: '', marca: '', categoria: 'fresco', en_tienda: '?', formato: '', precio: null, notas: '', fuente: '', verificado: false };
  const cats = CATEGORIAS.map(([k, t]) => `<option value="${k}" ${p.categoria === k ? 'selected' : ''}>${t}</option>`).join('');
  const num = ([k, t]) => campo(t, `<input name="${k}" type="number" inputmode="decimal" min="0" step="any" value="${v(p[k])}">`);
  return `<h1>${nuevo ? 'Añadir al catálogo' : 'Editar producto'}</h1>
    ${campo('Producto', `<input name="nombre" required value="${v(p.nombre)}" autocomplete="off">`)}
    <div class="dos">${campo('Marca', `<input name="marca" value="${v(p.marca)}" autocomplete="off">`)}
      ${campo('Tipo', `<select name="categoria">${cats}</select>`)}</div>
    <div class="dos">${campo('Formato', `<input name="formato" value="${v(p.formato)}" placeholder="p. ej. 500 g" autocomplete="off">`)}
      ${campo('Precio (€)', `<input name="precio" type="number" inputmode="decimal" min="0" step="any" value="${v(p.precio)}">`)}</div>
    ${campo('¿Está en mi tienda?', `<select name="en_tienda">${TIENDA.map(([k, t]) => `<option value="${k}" ${enTienda(p) === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
    <h2>Nutrición por 100 g</h2>
    <div class="dos">${NUTR.map(num).join('')}</div>
    ${campo('Código de barras (EAN)', `<input name="ean" inputmode="numeric" value="${v(p.ean)}" placeholder="13 cifras, opcional" autocomplete="off">`)}
    ${botonFoto()}
    ${campo('Notas', `<input name="notas" value="${v(p.notas)}" autocomplete="off">`)}
    ${p.url ? `<p class="det" style="margin:0 0 8px"><a href="${esc(p.url)}" target="_blank" rel="noopener">Ver en la web del Eroski</a></p>` : ''}
    ${campo('De dónde sale el dato', `<input name="fuente" value="${v(p.fuente)}" placeholder="etiqueta, web Eroski…" autocomplete="off">`)}
    <label class="fila" style="min-height:44px;margin-bottom:8px"><input type="checkbox" name="verificado" value="1" ${p.verificado ? 'checked' : ''} style="width:24px;height:24px"> Comprobado con la etiqueta del envase</label>
    <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
    ${nuevo ? '' : '<button class="btn peligro grande" style="margin-top:10px" type="submit" value="borrar">Borrar</button>'}`;
}

const numOrNull = x => (x === undefined || x === null || String(x).trim() === '') ? null : (Number(String(x).replace(',', '.')) ?? null);

// Abre la ficha de un producto del catálogo (alta o edición). `borrador` rellena los datos de un alta (p. ej. el EAN leído);
// `despues(producto)` se llama cuando se guarda un alta (la hoja se cierra antes, por eso va en un temporizador).
export function fichaCatalogo(p, { borrador, despues } = {}) {
  const d = S.datos();
  const base = p || { nombre: '', marca: '', categoria: 'fresco', en_tienda: 'si', formato: '', precio: null, notas: '', fuente: '', verificado: false, ...(borrador || {}) };
  abrirHoja(formulario(base, !p), (f, accion) => {
    if (accion === 'borrar') { d.catalogo = d.catalogo.filter(x => x !== p); S.guardar(); avisar('Producto borrado del catálogo.'); return true; }
    const nombre = (f.nombre || '').trim();
    if (!nombre) { avisar('Falta el nombre.'); return false; }
    const datos = { nombre, marca: (f.marca || '').trim(), categoria: f.categoria, formato: (f.formato || '').trim(), precio: numOrNull(f.precio),
      en_tienda: f.en_tienda || '?', ean: (f.ean || '').replace(/\D/g, '') || null, notas: (f.notas || '').trim(), fuente: (f.fuente || '').trim(), verificado: f.verificado === '1' };
    for (const [k] of NUTR) datos[k] = numOrNull(f[k]);
    let prod = p;
    if (p) Object.assign(p, datos); else { prod = { id: nuevoId(), ...datos }; d.catalogo.push(prod); }
    S.guardar();
    if (despues && !p) setTimeout(() => despues(prod), 0);
    return true;
  });
}

export function acciones(act, el) {
  const d = S.datos();
  if (act === 'cat-filtro') { filtro = el.dataset.k; return true; }
  if (act === 'cat-exportar') {
    const blob = new Blob([JSON.stringify(d.catalogo, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `catalogo_${hoy()}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    avisar('Catálogo guardado en Descargas.'); return true;
  }
  if (act === 'cat-nuevo' || act === 'cat-editar') {
    fichaCatalogo(act === 'cat-editar' ? d.catalogo.find(x => x.id === el.dataset.id) : null);
    return true;
  }
  return false;
}

export async function importarArchivo(input) {
  const f = input.files?.[0]; if (!f) return;
  try { const r = S.fusionarCatalogo(await f.text()); avisar(`Catálogo fusionado: ${r.nuevos} nuevos, ${r.cambiados} actualizados.`); }
  catch (e) { avisar(e.message || 'No se pudo leer ese archivo.'); }
  input.value = '';
}
