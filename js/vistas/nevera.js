// Pantalla «Almacén de comida»: lo que hay en casa, con caducidades. Ordena por lo que antes hay que gastar.
import * as S from '../store.js';
import { esc, diasHasta, fechaCorta, nuevoId, hoy } from '../util.js';
import { abrirHoja, campo, avisar, botonFoto, ofrecerDeshacer, confirmar } from '../ui.js';
import { caducidadEfectiva, caducaPorApertura, completar } from '../producto.js';
import * as IA from '../ia.js';
import { preguntarOrigen } from '../origen.js';

const UBIC = [['nevera', 'Nevera'], ['congelador', 'Congelador'], ['despensa', 'Despensa']];
const UNID = ['ud', 'g', 'kg', 'ml', 'l', 'lonchas', 'raciones', 'paquete', 'bote', 'bolsa'];
const CONTABLES = new Set(['ud', 'lonchas', 'raciones', 'paquete', 'bote', 'bolsa']);
let filtro = 'todo';

// ── Botiquín: medicamentos y productos de salud con caducidad. Va aparte de la comida (d.botiquin) para no mezclarse con los menús ni con «gastar primero». ──
const UNID_BOT = ['envase', 'ud', 'comprimidos', 'ml', 'g', 'sobres', 'bote'];
const SIGRE = 'Retirado. Llévalo al punto SIGRE de la farmacia; no lo tires a la basura.';
const activosBot = d => (d.botiquin || []).filter(x => !x.baja);
export function botiquinPendiente(d) {                                  // para Hoy: caducados y que caducan en 30 días
  return activosBot(d).map(p => ({ p, n: diasHasta(caducidadEfectiva(p)) })).filter(x => x.n !== null && x.n <= 30).sort((a, b) => a.n - b.n);
}
const CONTABLES_BOT = new Set(['comprimidos', 'ud', 'sobres']);                // se pueden ir gastando de uno en uno (−1)
const nrm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
function reponerEnCompra(d, p, motivo) {                                      // al gastarse un medicamento, queda anotado para comprarlo en la farmacia
  const nombre = 'Reponer ' + p.nombre, ya = (d.compra || []).some(x => nrm(x.nombre) === nrm(nombre));
  if (!ya) (d.compra ||= []).push({ id: nuevoId(), nombre, cantidad: null, unidad: '', seccion: 'farmacia', nota: motivo, hecho: false });
  return !ya;
}
export function altaBotiquin(d, datos) { (d.botiquin ||= []).push({ id: nuevoId(), tipo: 'sin', abierto: null, dias_abierto: null, nota: '', ...datos }); }
function etiquetaBot(p) {
  const f = caducidadEfectiva(p), n = diasHasta(f), ab = caducaPorApertura(p) ? 'abierto: ' : '';
  if (n === null) return { txt: 'sin fecha', clase: '' };
  if (n < 0) return { txt: `${ab}caducado hace ${-n} d`, clase: 'bad' };
  if (n === 0) return { txt: `${ab}caduca hoy`, clase: 'warn' };
  if (n <= 30) return { txt: `${ab}caduca en ${n} d`, clase: 'warn' };
  return { txt: ab + fechaCorta(f), clase: 'ok' };
}
function detalleBot(p) {
  const partes = [`${fmt(p.cantidad)} ${p.unidad}`, p.tipo === 'con' ? 'con receta' : 'sin receta'];
  if (p.abierto) partes.push(`abierto el ${fechaCorta(p.abierto)}${Number(p.dias_abierto) > 0 ? ` (consumir en ${p.dias_abierto} d)` : ''}`);
  if (p.nota) partes.push(p.nota);
  return partes.map(esc).join(' · ') + (p.para ? `<br><span style="opacity:.85">Para: ${esc(p.para.length > 90 ? p.para.slice(0, 90) + '…' : p.para)}</span>` : '');
}
function htmlBotiquin(d) {
  const lista = activosBot(d).sort((a, b) => cmp(diasHasta(caducidadEfectiva(a)), diasHasta(caducidadEfectiva(b))) || a.nombre.localeCompare(b.nombre, 'es'));
  const fila = p => {
    const c = etiquetaBot(p), n = diasHasta(caducidadEfectiva(p)), cad = n !== null && n < 0;
    return `<div class="item ${cad ? 'caducado' : n !== null && n <= 30 ? 'alerta' : ''}">
      <button type="button" class="grow" style="background:none;border:0;text-align:left;padding:0" data-act="bot-editar" data-id="${p.id}">
        <div class="nom">${esc(p.nombre)}</div><div class="det">${detalleBot(p)}</div></button>
      <span class="chip ${c.clase}">${esc(c.txt)}</span>${cad ? `<button type="button" class="btn mini" data-act="bot-baja" data-id="${p.id}">Retirar</button>` : ''}${CONTABLES_BOT.has(p.unidad) && Number(p.cantidad) > 0 ? `<button type="button" class="btn mini" data-act="bot-menos" data-id="${p.id}" aria-label="Gastar uno de ${esc(p.nombre)}">−1</button>` : ''}</div>`;
  };
  const bajas = (d.botiquin || []).filter(x => x.baja).sort((a, b) => b.baja.localeCompare(a.baja));
  return (lista.map(fila).join('') || '<div class="card vacio">El botiquín está vacío. Pulsa «Añadir».</div>')
    + '<p class="nota-pie">La app solo avisa de la fecha que escribes: ante la duda con un medicamento, pregunta en la farmacia. Lo caducado se lleva al punto SIGRE de la farmacia, no a la basura.</p>'
    + (bajas.length ? `<details style="margin-top:10px"><summary style="min-height:44px;display:flex;align-items:center;font-weight:700">Dados de baja (${bajas.length})</summary>${bajas.map(p => `<div class="item"><div class="grow"><div class="nom">${esc(p.nombre)}</div><div class="det">${esc(p.motivo || 'baja')} · ${esc(fechaCorta(p.baja))}</div></div></div>`).join('')}</details>` : '');
}
function formularioBot(p) {
  const nuevo = !p;
  p = p || { nombre: '', tipo: 'sin', cantidad: 1, unidad: 'envase', caducidad: '', abierto: '', dias_abierto: '', nota: '' };
  const v = x => esc(x ?? '');
  const opts = (lista, sel) => lista.map(x => { const [k, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(k)}" ${k === sel ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
  return `
    <h1>${nuevo ? 'Añadir al botiquín' : 'Editar'}</h1>
    ${campo('Producto', `<input name="nombre" required value="${v(p.nombre)}" autocomplete="off" list="lista-botiquin">`)}
    <datalist id="lista-botiquin">${[...new Set((S.datos().botiquin || []).map(x => x.nombre))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    ${campo('Tipo', `<select name="tipo">${opts([['sin', 'Sin receta'], ['con', 'Con receta']], p.tipo)}</select>`)}
    <div class="dos">
      ${campo('Cantidad', `<input name="cantidad" type="number" inputmode="decimal" min="0" step="any" value="${v(p.cantidad)}">`)}
      ${campo('Unidad', `<select name="unidad">${opts(UNID_BOT, p.unidad)}</select>`)}
    </div>
    ${campo('Caduca (fecha del envase)', `<input name="caducidad" type="date" value="${v(p.caducidad)}">`)}
    <details ${p.abierto ? 'open' : ''} style="margin-bottom:12px">
      <summary style="min-height:44px;display:flex;align-items:center;font-weight:700">Si caduca tras abrirlo (colirio, jarabe, pomada…)</summary>
      <div class="dos">
        ${campo('Abierto el', `<input name="abierto" type="date" value="${v(p.abierto)}">`)}
        ${campo('Consumir en (días)', `<input name="dias_abierto" type="number" inputmode="numeric" min="1" step="1" value="${v(p.dias_abierto)}">`)}
      </div>
    </details>
    <label class="campo"><span>Para qué sirve (ficha)</span><textarea name="para" rows="3" autocomplete="off" placeholder="p. ej. antiinflamatorio; 1 comprimido cada 8 h con comida…" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--card);padding:10px">${v(p.para)}</textarea></label>
    <div class="pila" style="margin:-4px 0 12px"><button type="button" class="btn" data-act="bot-google">🔎 Buscar en Google (se abre fuera de la app)</button>
    <button type="button" class="btn" data-act="bot-ia">🤖 ${IA.configurada() ? 'Rellenar con la IA' : 'Preguntar a una IA (copia la pregunta)'}</button></div>
    ${IA.configurada() ? IA.pieIA() : '<p class="det" style="margin:-6px 0 10px">Pega la pregunta en tu IA y copia aquí su respuesta. Es orientativo: manda el prospecto y lo que te diga el médico o la farmacia.</p>'}
    ${campo('Nota', `<input name="nota" value="${v(p.nota)}" autocomplete="off">`)}
    <div class="fila" style="margin-top:6px"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
    ${nuevo ? '' : '<div class="fila" style="margin-top:10px"><button class="btn grow" type="submit" value="baja-cad">Dar de baja: caducado</button><button class="btn grow" type="submit" value="baja-gast">Gastado</button></div><button class="btn peligro grande" style="margin-top:10px" type="submit" value="borrar">Borrar</button>'}`;
}

const cmp = (a, b) => (a === null ? 1 : b === null ? -1 : a - b);
const fmt = n => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 });

function etiquetaCaducidad(p) {
  const f = caducidadEfectiva(p), n = diasHasta(f), ab = caducaPorApertura(p) ? 'abierto: ' : '';
  if (n === null) return { txt: 'sin fecha', clase: '' };
  if (p.ubicacion === 'congelador') return { txt: fechaCorta(f), clase: '' };
  if (n < 0) return { txt: `${ab}caducado hace ${-n} d`, clase: 'bad' };
  if (n === 0) return { txt: `${ab}caduca hoy`, clase: 'warn' };
  if (n <= 3) return { txt: `${ab}caduca en ${n} d`, clase: 'warn' };
  return { txt: ab + fechaCorta(f), clase: 'ok' };
}

function detalle(p) {
  const partes = [p.sin_cuenta ? 'hay (sin cuenta)' : `${fmt(p.cantidad)} ${p.unidad}`, p.ubicacion];
  if (p.marca) partes.push(p.marca);
  if (p.envase) partes.push(`${fmt(p.envase)} g${p.escurrido ? ' escurrido' : ''}`);
  if (p.sal100 !== null && p.sal100 !== undefined && p.sal100 !== '') partes.push(`sal ${fmt(p.sal100)} g/100 g`);
  if (p.nota) partes.push(p.nota);
  return partes.map(esc).join(' · ');
}

export function render() {
  const d = S.datos();
  try { if (sessionStorage.getItem('ir_botiquin')) { filtro = 'botiquin'; sessionStorage.removeItem('ir_botiquin'); } } catch (e) {}   // Hoy → «Abrir el botiquín»
  const lista = d.nevera
    .filter(p => filtro === 'todo' || p.ubicacion === filtro)
    .sort((a, b) => cmp(diasHasta(caducidadEfectiva(a)), diasHasta(caducidadEfectiva(b))) || a.nombre.localeCompare(b.nombre, 'es'));
  const filtros = [['todo', 'Todo'], ...UBIC, ['botiquin', 'Botiquín']].map(([k, t]) =>
    `<button type="button" class="filtro" data-act="filtro" data-k="${k}" aria-pressed="${filtro === k}">${t}</button>`).join('');

  const tarjetas = lista.map(p => {
    const c = etiquetaCaducidad(p), n = diasHasta(caducidadEfectiva(p));
    const cls = n !== null && p.ubicacion !== 'congelador' ? (n < 0 ? 'caducado' : n <= 3 ? 'alerta' : '') : '';
    const enLista = (d.compra || []).some(x => nrm(x.nombre) === nrm(p.nombre));
    const menos = p.sin_cuenta ? `${enLista ? '<span class="chip">🛒 en la lista</span>' : `<button type="button" class="btn mini" data-act="sc-comprar" data-id="${p.id}" aria-label="Añadir ${esc(p.nombre)} a la lista de la compra">Comprar</button>`}<button type="button" class="btn mini" data-act="sc-baja" data-id="${p.id}" aria-label="Se acabó ${esc(p.nombre)}">Se acabó</button>` : CONTABLES.has(p.unidad) ? `<button type="button" class="btn mini" data-act="menos" data-id="${p.id}" aria-label="Gastar uno de ${esc(p.nombre)}">−1</button>` : '';
    return `<div class="item ${cls}" style="flex-wrap:wrap">
      <button type="button" style="background:none;border:0;text-align:left;padding:0;flex:1 1 100%;min-width:0" data-act="editar" data-id="${p.id}">
        <div class="nom">${esc(p.nombre)}</div>
        <div class="det">${detalle(p)}</div>
      </button>
      <div class="fila" style="flex:1 1 100%;flex-wrap:wrap"><span class="chip ${c.clase}">${esc(c.txt)}</span>${menos}</div></div>`;
  }).join('');

  return `
    <div class="fila sep"><div><h1>Almacén</h1><p class="sub" style="margin:0">${filtro === 'botiquin' ? activosBot(d).length + ' en el botiquín' : d.nevera.length + ' productos en casa'}</p></div>
      <button type="button" class="btn main" data-act="anadir">+ Añadir</button></div>
    <div style="height:12px"></div>
    <div class="filtros" role="group" aria-label="Filtrar por sitio">${filtros}</div>
    ${filtro === 'botiquin' ? htmlBotiquin(d) : (tarjetas || '<div class="card vacio">No hay nada aquí. Pulsa «Añadir».</div>')}
  `;
}

function formulario(p) {
  const nuevo = !p;
  p = p || { nombre: '', cantidad: 1, unidad: 'ud', ubicacion: filtro === 'todo' ? 'nevera' : filtro, caducidad: '', nota: '', marca: '', envase: null, escurrido: false, sal100: null, abierto: null, dias_abierto: null };
  const v = x => esc(x ?? '');
  const opts = (lista, sel) => lista.map(x => { const [k, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(k)}" ${k === sel ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
  const masDatos = p.marca || p.envase || p.sal100 !== null || p.abierto || nuevo === false;
  return `
    <h1>${nuevo ? 'Añadir producto' : 'Editar producto del almacén'}</h1>
    ${campo('Producto', `<input name="nombre" required value="${v(p.nombre)}" autocomplete="off" list="lista-catalogo">`)}
    ${campo('Código de barras (opcional)', `<input name="ean" inputmode="numeric" value="${v(p.ean)}" placeholder="si está en el catálogo, rellena el producto" autocomplete="off">`)}
    ${botonFoto()}
    <datalist id="lista-catalogo">${S.datos().catalogo.map(c => `<option value="${esc(c.nombre)}">`).join('')}</datalist>
    <div class="dos">
      ${campo('Cantidad', `<input name="cantidad" type="number" inputmode="decimal" min="0" step="any" value="${v(p.cantidad)}">`)}
      ${campo('Unidad', `<select name="unidad">${opts(UNID, p.unidad)}</select>`)}
    </div>
    <label class="fila" style="min-height:44px;margin-bottom:8px"><input type="checkbox" name="sin_cuenta" value="1" ${p.sin_cuenta ? 'checked' : ''} style="width:24px;height:24px"> <span>No llevo la cuenta (p. ej. la fruta): la doy de baja yo cuando se acabe</span></label>
    ${campo('Dónde está', `<select name="ubicacion">${opts(UBIC, p.ubicacion)}</select>`)}
    ${campo('Caduca (fecha del envase)', `<input name="caducidad" type="date" value="${v(p.caducidad)}">`)}
    <details ${masDatos ? 'open' : ''} style="margin-bottom:12px">
      <summary style="min-height:44px;display:flex;align-items:center;font-weight:700">Más datos (marca, envase, sal, apertura)</summary>
      ${campo('Marca', `<input name="marca" value="${v(p.marca)}" autocomplete="off">`)}
      <div class="dos">
        ${campo('Peso del envase (g)', `<input name="envase" type="number" inputmode="decimal" min="0" step="any" value="${v(p.envase)}">`)}
        ${campo('Ración habitual (g)', `<input name="racion" type="number" inputmode="decimal" min="0" step="any" value="${v(p.racion)}">`)}
        ${campo('Sal (g por 100 g)', `<input name="sal100" type="number" inputmode="decimal" min="0" step="any" value="${v(p.sal100)}">`)}
      </div>
      <label class="fila" style="min-height:44px;margin-bottom:8px"><input type="checkbox" name="escurrido" value="1" ${p.escurrido ? 'checked' : ''} style="width:24px;height:24px"> El peso es ya escurrido</label>
      <div class="dos">
        ${campo('Abierto el', `<input name="abierto" type="date" value="${v(p.abierto)}">`)}
        ${campo('Consumir en (días)', `<input name="dias_abierto" type="number" inputmode="numeric" min="1" step="1" value="${v(p.dias_abierto)}">`)}
      </div>
    </details>
    ${campo('Nota', `<input name="nota" value="${v(p.nota)}" autocomplete="off">`)}
    <div class="fila" style="margin-top:6px">
      <button class="btn main grow" type="submit" value="guardar">Guardar</button>
      ${nuevo ? '' : '<button class="btn" type="submit" value="gastado">Gastado</button>'}
    </div>
    ${nuevo ? '' : (p.unidad === 'raciones' ? '' : '<button class="btn grande" style="margin-top:10px" type="submit" value="dividir">✂ Dividir en raciones…</button>') + '<button class="btn peligro grande" style="margin-top:10px" type="submit" value="borrar">Borrar</button>'}
  `;
}

const numOrNull = s => (s === undefined || s === null || String(s).trim() === '') ? null : (Number(String(s).replace(',', '.')) || 0);

// Abrir un envase y repartirlo: unas raciones al congelador, otras se gastan ahora y el resto se queda en la nevera ya abierto.
function abrirDividir(p) {
  const d = S.datos();
  abrirHoja(`<h1>Dividir en raciones</h1><p class="sub">${esc(p.nombre)}</p>
    <div class="dos">${campo('Raciones que salen', `<input name="total" type="number" inputmode="numeric" min="1" step="1" value="4">`)}${campo('Peso de cada ración (g, opcional)', `<input name="g" type="number" inputmode="decimal" min="0" step="any" value="${p.envase ? Math.round(Number(p.envase) / 4) : ''}">`)}</div>
    <div class="dos">${campo('Van al congelador', `<input name="cong" type="number" inputmode="numeric" min="0" step="1" value="3">`)}${campo('Las gastas ahora', `<input name="gasto" type="number" inputmode="numeric" min="0" step="1" value="1">`)}</div>
    ${campo('Meses que aguanta congelado (estimación)', `<input name="meses" type="number" inputmode="decimal" min="0" step="any" value="2">`)}
    <p class="det">Las del congelador caducan en los meses que indiques (con 0, heredan la fecha del envase${p.caducidad ? ` — ${esc(fechaCorta(p.caducidad))}` : ', que no tiene'}). Lo que sobre se queda en la nevera, abierto hoy${p.dias_abierto ? ` (consumir en ${esc(p.dias_abierto)} d)` : ' (consumir en 2 d)'}.</p>
    ${Number(p.cantidad) > 1.0001 ? `<p class="det">Tienes ${fmt(p.cantidad)} ${esc(p.unidad)}: se divide uno y los demás se quedan como están.</p>` : ''}
    <div class="fila"><button class="btn main grow" type="submit" value="dividir">Dividir</button></div>`, f => {
    const total = Math.round(Number(f.total)), cong = Math.round(Number(f.cong) || 0), gasto = Math.round(Number(f.gasto) || 0), resto = total - cong - gasto;
    if (!(total >= 1) || cong < 0 || gasto < 0 || resto < 0) { avisar(`Las raciones no cuadran: salen ${total || 0} y repartes ${cong + gasto}.`); return false; }
    const g = numOrNull(f.g), cant = Number(p.cantidad);
    if (cant > 1.0001) p.cantidad = Math.round((cant - 1) * 1000) / 1000; else d.nevera = d.nevera.filter(x => x !== p);      // se abre un envase
    const poner = (cantidad, ubicacion, extra) => {
      const ya = !extra.abierto && d.nevera.find(x => x.nombre === p.nombre && x.unidad === 'raciones' && x.ubicacion === ubicacion && !x.abierto && (x.caducidad || null) === (extra.caducidad !== undefined ? extra.caducidad : (p.caducidad || null)));
      if (ya) ya.cantidad = Number(ya.cantidad) + cantidad;
      else d.nevera.push(completar({ id: nuevoId(), nombre: p.nombre, cantidad, unidad: 'raciones', ubicacion, caducidad: p.caducidad || null, nota: '', marca: p.marca || '', envase: g, escurrido: false,
        sal100: p.sal100 ?? null, ean: p.ean || null, racion: g, abierto: null, dias_abierto: null, v2: true, ...extra }));
    };
    const meses = Number(String(f.meses).replace(',', '.')) || 0;
    let cadCong = p.caducidad || null;
    if (meses > 0) { const t = new Date(); t.setDate(t.getDate() + Math.round(meses * 30.4)); cadCong = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }
    if (cong) poner(cong, 'congelador', { nota: 'congelado el ' + fechaCorta(hoy()), caducidad: cadCong });
    if (resto) poner(resto, 'nevera', { abierto: hoy(), dias_abierto: Number(p.dias_abierto) || 2 });
    S.guardar();
    avisar(`${total} raciones: ${cong} al congelador${gasto ? ` · ${gasto} gastada${gasto > 1 ? 's' : ''}` : ''}${resto ? ` · ${resto} en la nevera` : ''}.`); return true;
  });
}

export function acciones(act, el) {
  const d = S.datos();
  if (act === 'filtro') { filtro = el.dataset.k; return true; }
  if (act === 'anadir' && filtro === 'botiquin') act = 'bot-nuevo';
  if (act === 'bot-google') {                                              // último recurso: abre Google con la pregunta; se lee allí y se copia a la ficha
    const f = el.closest('form'), nombre = ((f && f.querySelector('[name="nombre"]')) || {}).value?.trim();
    if (!nombre) { avisar('Escribe primero el nombre del medicamento.'); return false; }
    window.open('https://www.google.com/search?q=' + encodeURIComponent('para qué sirve ' + nombre + ' medicamento'), '_blank', 'noopener'); return false;
  }
  if (act === 'bot-ia') {
    const f = el.closest('form'), nombre = ((f && f.querySelector('[name="nombre"]')) || {}).value?.trim();
    if (!nombre) { avisar('Escribe primero el nombre del medicamento.'); return false; }
    const q = `Explícame en español, en 3 líneas como máximo y con palabras sencillas, para qué sirve el medicamento «${nombre}» y sus precauciones básicas. Responde solo con ese texto; no sustituye al prospecto ni al médico.`;
    if (IA.configurada()) {                                                      // IA conectada: contesta ella y la respuesta va a la ficha, para revisarla
      const campoPara = f && f.querySelector('[name="para"]'), textoBoton = el.textContent; el.textContent = '⏳ Preguntando a ' + IA.nombreIA() + '…'; el.disabled = true; avisar('Preguntando a ' + IA.nombreIA() + '… puede tardar unos segundos.', 70000);
      const listo = () => { if (document.body.contains(el)) { el.textContent = textoBoton; el.disabled = false; } };
      IA.preguntar(q).then(t => { listo(); if (campoPara && document.body.contains(campoPara)) { campoPara.value = t; campoPara.scrollIntoView({ block: 'center', behavior: 'smooth' }); campoPara.style.borderColor = 'var(--ok)'; avisar(IA.nombreIA() + ' es una IA y puede cometer errores: revisa lo que ha escrito.', 6000); } else avisar('La ventana se cerró antes de recibir la respuesta.'); })
        .catch(e => { listo(); avisar(e.message, 7000); });
      return false;
    }
    (navigator.clipboard?.writeText(q) || Promise.reject()).then(() => avisar('Pregunta copiada: pégala en tu IA y trae aquí la respuesta.')).catch(() => { if (f) f.querySelector('[name="para"]').value = ''; avisar('No pude copiar. Pregunta: para qué sirve «' + nombre + '».'); });
    return false;
  }
  if (act === 'bot-menos') {
    const p = (d.botiquin || []).find(x => x.id === el.dataset.id); if (!p) return true;
    p.cantidad = Math.max(0, Math.round((Number(p.cantidad) - 1) * 1000) / 1000);
    if (p.cantidad === 0) { p.baja = hoy(); p.motivo = 'gastado'; avisar(reponerEnCompra(d, p, 'Se acabó en el botiquín') ? `«${p.nombre}» gastado: anotado en la lista de la compra (Farmacia).` : `«${p.nombre}» gastado.`); }
    S.guardar(); return true;
  }
  if (act === 'bot-baja') { const p = (d.botiquin || []).find(x => x.id === el.dataset.id); if (p) { p.baja = hoy(); p.motivo = 'caducado'; S.guardar(); avisar(SIGRE); } return true; }
  if (act === 'bot-nuevo' || act === 'bot-editar') {
    const p = act === 'bot-editar' ? (d.botiquin || []).find(x => x.id === el.dataset.id) : null;
    abrirHoja(formularioBot(p), (f, acc) => {
      if (acc === 'borrar') { d.botiquin = d.botiquin.filter(x => x !== p); S.guardar(); avisar('Borrado.'); return true; }
      if (acc === 'baja-cad' || acc === 'baja-gast') { p.baja = hoy(); p.motivo = acc === 'baja-cad' ? 'caducado' : 'gastado'; const anot = acc === 'baja-gast' && reponerEnCompra(d, p, 'Se acabó en el botiquín'); S.guardar(); avisar(acc === 'baja-cad' ? SIGRE : anot ? 'Gastado: anotado en la lista de la compra (Farmacia).' : 'Marcado como gastado.'); return true; }
      const nombre = (f.nombre || '').trim(); if (!nombre) { avisar('Falta el nombre del producto.'); return false; }
      const datos = { nombre, tipo: f.tipo === 'con' ? 'con' : 'sin', cantidad: Number(String(f.cantidad).replace(',', '.')) || 0, unidad: f.unidad,
        caducidad: f.caducidad || null, abierto: f.abierto || null, dias_abierto: numOrNull(f.dias_abierto), nota: (f.nota || '').trim(), para: (f.para || '').trim() };
      if (p) Object.assign(p, datos); else altaBotiquin(d, datos);
      S.guardar(); return true;
    });
    return true;
  }
  if (act === 'sc-comprar') {
    const p = d.nevera.find(x => x.id === el.dataset.id); if (!p) return true;
    if ((d.compra ||= []).some(x => nrm(x.nombre) === nrm(p.nombre))) { avisar(`«${p.nombre}» ya está en la lista de la compra.`); return true; }
    d.compra.push({ id: nuevoId(), nombre: p.nombre, cantidad: null, unidad: '', seccion: 'super', nota: '', hecho: false }); S.guardar(); avisar(`«${p.nombre}» añadido a la lista de la compra.`); return true;
  }
  if (act === 'sc-baja') {
    const p = d.nevera.find(x => x.id === el.dataset.id); if (!p) return true;
    const copia = S.exportar(), enLista = (d.compra ||= []).some(x => nrm(x.nombre) === nrm(p.nombre));
    const baja = comprar => {
      d.nevera = d.nevera.filter(x => x !== p);
      if (comprar && !enLista) d.compra.push({ id: nuevoId(), nombre: p.nombre, cantidad: null, unidad: '', seccion: 'super', nota: '', hecho: false });
      S.guardar(); ofrecerDeshacer(copia); avisar(comprar && !enLista ? `«${p.nombre}» dado de baja y apuntado en la compra.` : `«${p.nombre}» dado de baja.`);
    };
    if (enLista) baja(false);
    else confirmar({ titulo: 'Se acabó', texto: `«${p.nombre}» se da de baja del almacén.\n¿Lo apunto en la lista de la compra?`, si: 'Sí, a la lista', no: 'No, solo la baja', alSi: () => baja(true), alNo: () => baja(false) });
    return false;
  }
  if (act === 'menos') {
    const p = d.nevera.find(x => x.id === el.dataset.id); if (!p) return true;
    p.cantidad = Math.max(0, Number(p.cantidad) - 1);
    if (p.cantidad === 0) { d.nevera = d.nevera.filter(x => x !== p); avisar(`«${p.nombre}» gastado: fuera de la lista.`); }
    S.guardar(); return true;
  }
  if (act === 'anadir' || act === 'editar') {
    const p = act === 'editar' ? d.nevera.find(x => x.id === el.dataset.id) : null;
    abrirHoja(formulario(p), (f, accion) => {
      if (accion === 'dividir') { setTimeout(() => abrirDividir(p), 0); return true; }               // se abre otra ventana cuando esta se haya cerrado
      if (accion === 'borrar' || accion === 'gastado') {
        d.nevera = d.nevera.filter(x => x !== p); S.guardar(); avisar(accion === 'gastado' ? 'Marcado como gastado.' : 'Borrado.'); return true;
      }
      const ean = (f.ean || '').replace(/\D/g, '');
      const porEan = ean ? S.buscarCatalogoEan(ean) : null;
      const nombre = (f.nombre || '').trim() || (porEan ? porEan.nombre : '');
      if (!nombre) { avisar(ean ? 'Ese código no está en el catálogo: escribe el nombre.' : 'Falta el nombre del producto.'); return false; }
      const datos = {
        nombre, cantidad: Number(String(f.cantidad).replace(',', '.')) || 0, unidad: f.unidad, ubicacion: f.ubicacion,
        caducidad: f.caducidad || null, nota: (f.nota || '').trim(), marca: (f.marca || '').trim(),
        envase: numOrNull(f.envase), escurrido: f.escurrido === '1', sal100: numOrNull(f.sal100),
        ean: ean || null, sin_cuenta: f.sin_cuenta === '1', racion: numOrNull(f.racion), abierto: f.abierto || null, dias_abierto: numOrNull(f.dias_abierto), v2: true,
      };
      const cat = S.buscarCatalogo(nombre);                 // si está en el catálogo, completa lo que dejaste vacío
      if (cat) { cat.sin_cuenta = datos.sin_cuenta; if (datos.sal100 === null && cat.sal !== null && cat.sal !== undefined) datos.sal100 = cat.sal; if (!datos.marca && cat.marca) datos.marca = cat.marca; }
      if (p) Object.assign(p, datos); else d.nevera.push(completar({ id: nuevoId(), ...datos }));
      S.guardar();
      if (!p && !cat && !(ean && S.buscarCatalogoEan(ean))) setTimeout(() => preguntarOrigen({ nombre, ean: ean || null }), 0);       // producto nuevo: ¿de dónde viene?
      return true;
    });
    return true;
  }
  return false;
}
