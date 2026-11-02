// Pantalla «Compra»: lista de lo que hay que comprar, y registro de lo comprado (a mano o con la foto del código de barras).
import * as S from '../store.js';
import { esc, nuevoId } from '../util.js';
import { abrirHoja, campo, avisar } from '../ui.js';
import { fichaCatalogo } from './catalogo.js';
import { preguntarOrigen } from '../origen.js';
import { completar } from '../producto.js';
import { quedan } from '../medicinas.js';
import { hoy } from '../util.js';
import { altaBotiquin } from './nevera.js';

const UNID = ['ud', 'g', 'kg', 'ml', 'l', 'paquete', 'bolsa', 'bote', 'lonchas', 'raciones'];
const UBIC = [['nevera', 'Nevera'], ['congelador', 'Congelador'], ['despensa', 'Despensa']];
const SECCIONES = [['super', '🛒 Súper'], ['farmacia', '💊 Farmacia'], ['otros', '📦 Otros']];
const seccion = x => x.seccion || 'super';
const PERIODO = { 1: 'cada día', 3: 'cada 2-3 días', 7: 'cada semana', 14: 'cada 2 semanas' };
let quitado = null;                                                  // último artículo quitado de la lista, para poder deshacerlo
const ubicDe = c => !c ? 'nevera' : c.categoria === 'congelado' ? 'congelador' : c.categoria === 'despensa' ? 'despensa' : 'nevera';
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const opts = (lista, sel) => lista.map(x => { const [k, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(k)}" ${k === sel ? 'selected' : ''}>${esc(t)}</option>`; }).join('');

export function render() {
  const d = S.datos(), c = d.compra, hechos = c.filter(x => x.hecho);
  return `
    <div class="fila sep"><div><h1>Compra</h1><p class="sub" style="margin:0">${c.length} en la lista · ${esc(d.ajustes.supermercado || 'supermercado')}, ${PERIODO[d.ajustes.compra_dias] || 'cada día'}</p></div>
      <button type="button" class="btn main" data-act="comp-nuevo">+ Añadir</button></div>
    <div class="fila" style="margin:12px 0"><button type="button" class="btn grow" data-act="comp-super">🏪 Mi súper y mi compra</button><button type="button" class="btn grow" data-nav="catalogo">📖 Catálogo de productos</button></div>
    <label class="btn grande" style="display:flex;align-items:center;justify-content:center;cursor:pointer">📷 Registrar lo comprado con el código
      <input type="file" accept="image/*" capture="environment" data-ean-compra hidden></label>
    <p class="nota-pie" style="margin:6px 0 14px">Haz foto al código de barras: si el producto está en el catálogo entra en casa; si no, creas su ficha.</p>
    ${SECCIONES.map(([k, t]) => { const l = c.filter(x => seccion(x) === k); if (!l.length) return ''; return `<h2>${t} (${l.length})</h2>` + l.map(x => `<div class="item" style="${x.hecho ? 'opacity:.6' : ''}">
      <button type="button" class="btn mini" data-act="comp-marcar" data-id="${esc(x.id)}" aria-label="Marcar como comprado" aria-pressed="${!!x.hecho}">${x.hecho ? '✔' : '○'}</button>
      <button type="button" class="grow" style="background:none;border:0;text-align:left;padding:0" data-act="comp-editar" data-id="${esc(x.id)}">
        <div class="nom" style="${x.hecho ? 'text-decoration:line-through' : ''}">${esc(x.nombre)}</div>
        <div class="det">${esc([x.cantidad ? x.cantidad + ' ' + x.unidad : '', x.nota].filter(Boolean).join(' · '))}</div></button>
      <button type="button" class="btn mini" data-act="comp-quitar" data-id="${esc(x.id)}" aria-label="Quitar de la lista">✕</button></div>`).join(''); }).join('') || '<div class="card vacio">La lista está vacía. Pulsa «+ Añadir».</div>'}
    ${quitado ? `<div class="card"><div class="fila sep"><span>Quitado: <b>${esc(quitado.x.nombre)}</b></span><button type="button" class="btn mini" data-act="comp-deshacer">Deshacer</button></div></div>` : ''}
    ${hechos.length ? `<button type="button" class="btn ok grande" data-act="comp-pasar" style="margin-top:12px">Entrar en casa lo marcado (${hechos.length})</button>` : ''}
    <p class="nota-pie">«Pasar a casa» te va preguntando cantidad, sitio y caducidad de cada producto marcado; solo sale de la lista cuando lo guardas en casa.</p>`;
}

function aAlmacen({ nombre, cantidad, unidad, ubicacion, caducidad, sin_cuenta }, cat) {
  if (cat && sin_cuenta !== undefined) cat.sin_cuenta = !!sin_cuenta;       // el catálogo se acuerda para la próxima vez
  sin_cuenta = sin_cuenta !== undefined ? !!sin_cuenta : !!cat?.sin_cuenta;
  const d = S.datos();
  const ya = d.nevera.find(p => norm(p.nombre) === norm(nombre) && p.ubicacion === ubicacion && (p.caducidad || null) === (caducidad || null));
  if (ya) ya.cantidad = Number(ya.cantidad) + Number(cantidad);
  else d.nevera.push(completar({ id: nuevoId(), nombre, cantidad: Number(cantidad), unidad, ubicacion, caducidad: caducidad || null, nota: '', marca: cat?.marca || '',
    envase: null, escurrido: false, sal100: cat && cat.sal != null ? cat.sal : null, abierto: null, dias_abierto: null, ean: cat?.ean || null, sin_cuenta, v2: true }));
  if (cat) cat.en_tienda = 'si';
  const k = d.compra.findIndex(x => norm(x.nombre) === norm(nombre));      // si estaba en la lista, se tacha sola
  if (k >= 0) d.compra.splice(k, 1);
}

function hojaAlmacen(cat) {                                                  // «entra en casa»: cantidad, sitio y caducidad
  abrirHoja(`<h1>Entra en casa</h1><p class="sub">${esc(cat.nombre)}</p>
    <div class="dos">${campo('Cantidad', `<input name="cantidad" type="number" inputmode="decimal" min="0" step="any" value="1">`)}${campo('Unidad', `<select name="unidad">${opts(UNID, 'ud')}</select>`)}</div>
    ${campo('Dónde lo guardas', `<select name="ubicacion">${opts(UBIC, ubicDe(cat))}</select>`)}
    ${campo('Caduca (fecha del envase)', `<input name="caducidad" type="date">`)}
    <label class="fila" style="min-height:44px;margin-bottom:8px"><input type="checkbox" name="sin_cuenta" value="1" ${cat?.sin_cuenta ? 'checked' : ''} style="width:24px;height:24px"> <span>No llevo la cuenta (fruta, pan, leche…): la doy de baja yo</span></label>
    <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar en casa</button></div>`, f => {
    const cantidad = Number(String(f.cantidad).replace(',', '.'));
    if (!cantidad || cantidad <= 0) { avisar('Pon una cantidad.'); return false; }
    aAlmacen({ nombre: cat.nombre, cantidad, unidad: f.unidad, ubicacion: f.ubicacion, caducidad: f.caducidad, sin_cuenta: f.sin_cuenta === '1' }, cat);
    S.guardar(); avisar(`«${cat.nombre.slice(0, 40)}» ya está en casa.`); return true;
  });
}

// Llamado desde main.js cuando se lee un código de barras en esta pantalla.
export function registrarEan(code) {
  const cat = S.buscarCatalogoEan(code);
  if (cat) { hojaAlmacen(cat); return; }
  avisar('Código nuevo: crea su ficha.');
  fichaCatalogo(null, { borrador: { ean: code }, despues: nuevo => hojaAlmacen(nuevo) });
}

function formulario(x) {
  const d = S.datos(), v = y => esc(y ?? '');
  x = x || { nombre: '', cantidad: 1, unidad: 'ud', nota: '' };
  return `<h1>${x.id ? 'Editar' : 'Añadir a la lista'}</h1>
    ${campo('Producto', `<input name="nombre" required value="${v(x.nombre)}" list="lista-cat-compra" autocomplete="off">`)}
    <datalist id="lista-cat-compra">${d.catalogo.map(c => `<option value="${esc(c.nombre)}">`).join('')}</datalist>
    <div class="dos">${campo('Cantidad', `<input name="cantidad" type="number" inputmode="decimal" min="0" step="any" value="${v(x.cantidad)}">`)}${campo('Unidad', `<select name="unidad">${opts(UNID, x.unidad)}</select>`)}</div>
    ${campo('¿Dónde se compra?', `<select name="seccion">${opts(SECCIONES.map(([k, t]) => [k, t]), seccion(x))}</select>`)}
    ${campo('Nota', `<input name="nota" value="${v(x.nota)}" autocomplete="off">`)}
    <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
    ${x.id ? '<button class="btn peligro grande" style="margin-top:10px" type="submit" value="borrar">Quitar de la lista</button>' : ''}`;
}

// Asistente de ingreso en casa: una hoja por producto marcado. Un producto solo sale de la lista cuando se guarda en casa.
function asistente(ids, total, hechos) {
  const d = S.datos(), id = ids.shift();
  if (!id) { avisar(total ? `Ingreso terminado: ${hechos} de ${total} guardados en casa.` : 'No hay nada marcado.'); return; }
  const x = d.compra.find(y => y.id === id); if (!x) { asistente(ids, total, hechos); return; }
  if (seccion(x) !== 'super') {                                           // farmacia y otros: no entran al almacén
    const med = x.med_id && d.ajustes.medicinas.find(m => m.id === x.med_id);
    if (med) {                                                           // reposición de pastillas → actualiza el stock
      const q = quedan(med, d.registro) ?? 0;
      abrirHoja(`<h1>Reponer pastillas</h1><p class="sub">${esc(med.nombre)}${med.dosis ? ' ' + esc(med.dosis) : ''}. Ahora quedan ${esc(String(q).replace('.', ','))}.</p>
        ${campo('¿Cuántas pastillas has traído?', `<input name="n" type="number" inputmode="numeric" min="0" step="1" value="">`)}
        <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
        <div class="fila" style="margin-top:10px"><button class="btn grow" type="submit" value="nolo">No las traje</button><button class="btn grow" type="submit" value="saltar">Luego</button></div>`, (f, acc) => {
        let h = hechos;
        if (acc === 'guardar') {
          const nuevas = Number(String(f.n).replace(',', '.')); if (!nuevas || nuevas <= 0) { avisar('Pon cuántas pastillas has traído.'); return false; }
          med.stock_base = { n: q + nuevas, fecha: hoy(), hora: new Date().toTimeString().slice(0, 5) }; d.compra = d.compra.filter(y => y !== x); S.guardar(); h++;
        } else if (acc === 'nolo') { x.hecho = false; S.guardar(); }
        setTimeout(() => asistente(ids, total, h), 0); return true;
      });
      return;
    }
    if (seccion(x) === 'farmacia') {                                     // medicamento o producto de botiquín: entra al botiquín
      abrirHoja(`<h1>Entra al botiquín</h1><p class="sub">${esc(x.nombre)}</p>
        <div class="dos">${campo('Cantidad', `<input name="cantidad" type="number" inputmode="decimal" min="0" step="any" value="${esc(x.cantidad || 1)}">`)}${campo('Unidad', `<select name="unidad">${opts(['envase', 'ud', 'comprimidos', 'ml', 'g', 'sobres', 'bote'], 'envase')}</select>`)}</div>
        ${campo('Tipo', `<select name="tipo">${opts([['sin', 'Sin receta'], ['con', 'Con receta']], 'sin')}</select>`)}
        ${campo('Caduca (fecha del envase)', `<input name="caducidad" type="date">`)}
        <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar en el botiquín</button></div>
        <div class="fila" style="margin-top:10px"><button class="btn grow" type="submit" value="nolo">No lo traje</button><button class="btn grow" type="submit" value="saltar">Luego</button><button class="btn grow" type="submit" value="recado">Era un recado</button></div>`, (f, acc) => {
        let h = hechos;
        if (acc === 'guardar') {
          const cantidad = Number(String(f.cantidad).replace(',', '.')); if (!cantidad || cantidad <= 0) { avisar('Pon una cantidad.'); return false; }
          altaBotiquin(d, { nombre: x.nombre, tipo: f.tipo === 'con' ? 'con' : 'sin', cantidad, unidad: f.unidad, caducidad: f.caducidad || null }); d.compra = d.compra.filter(y => y !== x); S.guardar(); h++;
        } else if (acc === 'recado') { d.compra = d.compra.filter(y => y !== x); S.guardar(); h++; }
        else if (acc === 'nolo') { x.hecho = false; S.guardar(); }
        setTimeout(() => asistente(ids, total, h), 0); return true;
      });
      return;
    }
    d.compra = d.compra.filter(y => y !== x); S.guardar(); asistente(ids, total, hechos + 1); return;      // un recado normal: se tacha y listo
  }
  const cat = S.buscarCatalogo(x.nombre), n = total - ids.length;
  abrirHoja(`<h1>Entra en casa (${n} de ${total})</h1><p class="sub">${esc(x.nombre)}${x.nota ? ' · ' + esc(x.nota) : ''}</p>
    <div class="dos">${campo('Cantidad', `<input name="cantidad" type="number" inputmode="decimal" min="0" step="any" value="${esc(x.cantidad || 1)}">`)}${campo('Unidad', `<select name="unidad">${opts(UNID, x.unidad || 'ud')}</select>`)}</div>
    ${campo('Dónde lo guardas', `<select name="ubicacion">${opts(UBIC, ubicDe(cat))}</select>`)}
    ${campo('Caduca (fecha del envase)', `<input name="caducidad" type="date">`)}
    <label class="fila" style="min-height:44px;margin-bottom:8px"><input type="checkbox" name="sin_cuenta" value="1" ${cat?.sin_cuenta ? 'checked' : ''} style="width:24px;height:24px"> <span>No llevo la cuenta (fruta, pan, leche…): la doy de baja yo</span></label>
    <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar en casa</button></div>
    <div class="fila" style="margin-top:10px"><button class="btn grow" type="submit" value="nolo">No lo traje</button><button class="btn grow" type="submit" value="saltar">Luego</button></div>
    <p class="nota-pie">«No lo traje» lo deja en la lista sin marcar. «Luego» lo deja marcado para otro momento.</p>`, (f, acc) => {
    let h = hechos;
    if (acc === 'guardar') {
      const cantidad = Number(String(f.cantidad).replace(',', '.'));
      if (!cantidad || cantidad <= 0) { avisar('Pon una cantidad.'); return false; }
      aAlmacen({ nombre: x.nombre, cantidad, unidad: f.unidad, ubicacion: f.ubicacion, caducidad: f.caducidad, sin_cuenta: f.sin_cuenta === '1' }, cat); S.guardar(); h++;
    } else if (acc === 'nolo') { x.hecho = false; S.guardar(); }
    const sigue = () => asistente(ids, total, h);
    if (acc === 'guardar' && !cat) setTimeout(() => preguntarOrigen({ nombre: x.nombre }, sigue), 0);      // producto que no está en el catálogo: ¿de dónde viene?
    else setTimeout(sigue, 0);                                           // la hoja se cierra al volver; la siguiente se abre después
    return true;
  });
}

const SUPERS = ['Eroski', 'Mercadona', 'Carrefour', 'Dia', 'Alcampo', 'Lidl', 'Otro'];
const WEBS = { Eroski: 'https://supermercado.eroski.es', Mercadona: 'https://tienda.mercadona.es', Carrefour: 'https://www.carrefour.es/supermercado', Dia: 'https://www.dia.es/compra-online', Alcampo: 'https://www.alcampo.es', Lidl: 'https://www.lidl.es', Otro: '' };

export function acciones(act, el) {
  const d = S.datos();
  if (act === 'comp-super') {
    const aj = d.ajustes;
    abrirHoja(`<h1>Mi súper y mi compra</h1><p class="sub">Dónde compras y cada cuánto. Los menús y las cantidades se calculan para ese periodo.</p>
      ${campo('Supermercado', `<select name="supermercado">${opts(SUPERS, aj.supermercado)}</select>`)}
      ${campo('Web para consultar productos', `<input name="web_super" type="url" value="${esc(aj.web_super || '')}" placeholder="https://…" autocomplete="off">`)}
      ${campo('¿Cada cuánto haces la compra?', `<select name="compra_dias">${opts([['1', 'Cada día'], ['3', 'Cada 2-3 días'], ['7', 'Semanal'], ['14', 'Quincenal']], String(aj.compra_dias || 1))}</select>`)}
      <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>`, f => {
      const cambioSuper = f.supermercado !== aj.supermercado, webEditada = (f.web_super || '').trim() !== (aj.web_super || '');
      aj.supermercado = f.supermercado; aj.compra_dias = Number(f.compra_dias) || 1;
      aj.web_super = (cambioSuper && !webEditada) ? (WEBS[f.supermercado] ?? '') : (f.web_super || '').trim();
      S.guardar(); avisar('Guardado.'); return true;
    });
    return true;
  }
  if (act === 'comp-quitar') { const i = d.compra.findIndex(y => y.id === el.dataset.id); if (i >= 0) { quitado = { x: d.compra[i], i }; d.compra.splice(i, 1); S.guardar(); } return true; }
  if (act === 'comp-deshacer') { if (quitado) { d.compra.splice(Math.min(quitado.i, d.compra.length), 0, quitado.x); quitado = null; S.guardar(); } return true; }
  if (act === 'comp-marcar') { quitado = null; const x = d.compra.find(y => y.id === el.dataset.id); if (x) { x.hecho = !x.hecho; S.guardar(); } return true; }
  if (act === 'comp-pasar') {
    const ids = d.compra.filter(x => x.hecho).map(x => x.id);
    asistente(ids, ids.length, 0); return true;
  }
  if (act === 'comp-nuevo' || act === 'comp-editar') {
    const x = act === 'comp-editar' ? d.compra.find(y => y.id === el.dataset.id) : null;
    abrirHoja(formulario(x), (f, acc) => {
      if (acc === 'borrar') { d.compra = d.compra.filter(y => y !== x); S.guardar(); return true; }
      const nombre = (f.nombre || '').trim(); if (!nombre) { avisar('Falta el producto.'); return false; }
      const dato = { nombre, cantidad: Number(String(f.cantidad).replace(',', '.')) || 1, unidad: f.unidad, nota: (f.nota || '').trim(), seccion: f.seccion || 'super' };
      if (x) Object.assign(x, dato); else d.compra.push({ id: nuevoId(), hecho: false, ...dato });
      S.guardar(); return true;
    });
    return true;
  }
  return false;
}
