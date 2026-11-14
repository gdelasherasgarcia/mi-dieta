// Pantalla «Medicinas»: ficha de cada medicina (crear, modificar, desactivar o borrar) y cuándo se tomó por última vez.
import * as S from '../store.js';
import { esc, nuevoId, fechaCorta, hoy } from '../util.js';
import { abrirHoja, campo, avisar } from '../ui.js';
import { DIAS_CORTOS, esPeriodica, quedan, diasQueQuedan, avisoStock } from '../medicinas.js';

const textoDias = d => (!d || !d.length) ? 'todos los días' : DIAS_CORTOS.filter(([k]) => d.includes(Number(k))).map(([, t]) => t).join(' ');
const textoHora = (h, m) => esPeriodica(m) ? `cada ${m.cada_h} h desde ${h}${m.max_dia ? ', máx. ' + m.max_dia + ' al día' : ''}` : (h === '23:59' ? 'al acostarse' : h);

function ultimaToma(id) {                                   // fecha y hora de la última vez registrada
  const reg = S.datos().registro;
  const fecha = Object.keys(reg).filter(f => reg[f].meds && reg[f].meds[id]).sort().pop();
  if (!fecha) return 'sin tomas registradas';
  const t = reg[fecha].meds[id]; const h = (Array.isArray(t) ? t[t.length - 1] : t)?.h;
  return `última toma: ${fechaCorta(fecha)}${h ? ' ' + h : ''}`;
}

function textoStock(m) {
  if (m.sin_stock) return '';                                   // p. ej. el Mounjaro: no se lleva la cuenta de pastillas
  const q = quedan(m, S.datos().registro);
  if (q === null) return '<span class="det" style="display:block;color:var(--muted)">Pastillas: sin contar (edita la ficha)</span>';
  const dias = diasQueQuedan(m, q), poco = q <= avisoStock(m);
  return `<span class="det" style="display:block;${poco ? 'color:var(--bad);font-weight:700' : ''}">Quedan ${esc(String(q).replace('.', ','))}${dias !== null ? ' (≈ ' + dias + ' d)' : ''}${poco ? ' · ¡reponer!' : ''}</span>`;
}

export function render() {
  const lista = (S.datos().ajustes.medicinas || []).slice().sort((x, y) => x.hora.localeCompare(y.hora) || x.nombre.localeCompare(y.nombre, 'es'));
  return `
    <div class="fila sep"><div><h1>Medicinas</h1><p class="sub" style="margin:0">${lista.length} fichas</p></div>
      <button type="button" class="btn main" data-act="med-nueva">+ Añadir</button></div>
    <div style="height:14px"></div>
    ${lista.map(m => `
      <button type="button" class="item" data-act="med-editar" data-id="${esc(m.id)}" style="${m.activa === false ? 'opacity:.55' : ''}">
        <span class="grow"><span class="nom" style="display:block">${esc(m.nombre)}${m.dosis ? ' ' + esc(m.dosis) : ''}</span>
        <span class="det" style="display:block">${esc(textoHora(m.hora, m))} · ${esc(textoDias(m.dias))}${m.activa === false ? ' · desactivada' : ''}</span>
        <span class="det" style="display:block">${esc(ultimaToma(m.id))}${m.nota ? ' · ' + esc(m.nota) : ''}</span>
        ${textoStock(m)}</span>
        <span class="chip">Editar</span></button>
      ${m.sin_stock || m.activa === false ? '' : `<button type="button" class="btn" style="margin:2px 0 14px" data-act="med-caja" data-id="${esc(m.id)}">📦 He comprado una caja</button>`}`).join('') || '<div class="card vacio">No hay medicinas. Pulsa «Añadir».</div>'}
    <p class="nota-pie">Cambiar la hora o los días no altera lo ya registrado. Esta app no es un médico: no cambies una medicación sin hablarlo con tu enfermero o tu médico.</p>
  `;
}

function formulario(m) {
  const nuevo = !m, v = x => esc(x ?? '');
  m = m || { nombre: '', dosis: '', hora: '08:30', dias: [], nota: '', activa: true, cada_h: null, max_dia: null };
  const dias = DIAS_CORTOS.map(([k, t]) => `<label style="display:flex;flex-direction:column;align-items:center;gap:2px;min-width:40px"><span style="font-weight:700">${t}</span>
    <input type="checkbox" name="d${k}" value="1" ${(!m.dias.length || m.dias.includes(Number(k))) ? 'checked' : ''} style="width:26px;height:26px"></label>`).join('');
  return `<h1>${nuevo ? 'Añadir medicina' : 'Editar medicina'}</h1>
    ${campo('Nombre', `<input name="nombre" required value="${v(m.nombre)}" autocomplete="off">`)}
    <div class="dos">${campo('Dosis', `<input name="dosis" value="${v(m.dosis)}" autocomplete="off">`)}
      ${campo('Hora (primera toma)', `<input name="hora" type="time" value="${v(m.hora)}">`)}</div>
    <div class="dos">${campo('Repetir cada (horas)', `<input name="cada_h" type="number" inputmode="decimal" min="0" step="any" value="${v(m.cada_h)}" placeholder="vacío = una vez">`)}
      ${campo('Máximo al día', `<input name="max_dia" type="number" inputmode="numeric" min="1" step="1" value="${v(m.max_dia)}" placeholder="opcional">`)}</div>
    <span class="campo"><span>Días que toca</span><div class="fila" style="justify-content:space-between">${dias}</div></span>
    <h2>Pastillas</h2>
    <div class="dos">${campo('Pastillas por toma', `<input name="unidades" type="number" inputmode="decimal" min="0" step="any" value="${v(m.unidades ?? 1)}">`)}
      ${campo('Avisar si quedan', `<input name="aviso_stock" type="number" inputmode="numeric" min="0" step="1" value="${v(m.aviso_stock ?? 3)}">`)}</div>
    ${campo('Pastillas por caja', `<input name="caja_n" type="number" inputmode="numeric" min="1" step="1" value="${v(m.caja_n)}" placeholder="las que trae una caja; para «He comprado una caja»">`)}
    ${campo('Pastillas que hay ahora (cuéntalas)', `<input name="stock_ahora" type="number" inputmode="decimal" min="0" step="any" value="${v(m.id ? quedan(m, S.datos().registro) ?? '' : '')}" placeholder="vacío = no llevar la cuenta">`)}
    ${campo('Nota', `<input name="nota" value="${v(m.nota)}" autocomplete="off">`)}
    <label class="fila" style="min-height:44px;margin-bottom:8px"><input type="checkbox" name="activa" value="1" ${m.activa !== false ? 'checked' : ''} style="width:24px;height:24px"> Activa (si no, no aparece en Hoy)</label>
    <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
    ${nuevo ? '' : '<button class="btn peligro grande" style="margin-top:10px" type="submit" value="borrar">Borrar</button>'}`;
}

const numOrNull = x => (x === undefined || String(x).trim() === '') ? null : (Number(String(x).replace(',', '.')) || null);

// «He comprado una caja»: suma al stock las pastillas de la(s) caja(s) y recuerda cuántas trae una caja para la próxima vez.
function abrirCaja(d, m) {
  const q = quedan(m, d.registro);
  abrirHoja(`<h1>He comprado una caja</h1><p class="sub">${esc(m.nombre)}${m.dosis ? ' ' + esc(m.dosis) : ''}. ${q === null ? 'Aún no se llevaba la cuenta de las pastillas.' : 'Ahora quedan ' + esc(String(q).replace('.', ',')) + '.'}</p>
    <div class="dos">${campo('Cajas compradas', `<input name="cajas" type="number" inputmode="numeric" min="1" step="1" value="1">`)}
      ${campo('Pastillas por caja', `<input name="porcaja" type="number" inputmode="numeric" min="1" step="1" value="${esc(m.caja_n ?? '')}" placeholder="p. ej. 28">`)}</div>
    ${campo('Pastillas que quedaban (corrígelo si no cuadra con lo que cuentas)', `<input name="quedaban" type="number" inputmode="decimal" min="0" step="any" value="${esc(q ?? 0)}">`)}
    <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>`, (f) => {
    const num = x => Number(String(x ?? '').replace(',', '.'));
    const cajas = num(f.cajas), porcaja = num(f.porcaja), quedaban = String(f.quedaban ?? '').trim() === '' ? 0 : num(f.quedaban);
    if (!(cajas >= 1)) { avisar('Pon cuántas cajas has comprado.'); return false; }
    if (!(porcaja >= 1)) { avisar('Pon cuántas pastillas trae una caja (mira el envase).'); return false; }
    if (!(quedaban >= 0)) { avisar('Las pastillas que quedaban no son un número válido.'); return false; }
    const total = Math.round((quedaban + cajas * porcaja) * 100) / 100;
    m.caja_n = porcaja; m.stock_base = { n: total, fecha: hoy(), hora: new Date().toTimeString().slice(0, 5) };
    S.guardar(); avisar(`Anotado: ahora hay ${String(total).replace('.', ',')} pastillas de ${m.nombre}.`); return true;
  });
}

export function acciones(act, el) {
  if (act !== 'med-editar' && act !== 'med-nueva' && act !== 'med-caja') return false;
  const d = S.datos();
  if (act === 'med-caja') { const mc = d.ajustes.medicinas.find(x => x.id === el.dataset.id); if (mc) abrirCaja(d, mc); return true; }
  const m = act === 'med-editar' ? d.ajustes.medicinas.find(x => x.id === el.dataset.id) : null;
  abrirHoja(formulario(m), (f, accion) => {
    if (accion === 'borrar') { d.ajustes.medicinas = d.ajustes.medicinas.filter(x => x !== m); S.guardar(); avisar('Medicina borrada (lo registrado se conserva).'); return true; }
    const nombre = (f.nombre || '').trim();
    if (!nombre) { avisar('Falta el nombre.'); return false; }
    if (!f.hora) { avisar('Falta la hora.'); return false; }
    const marcados = DIAS_CORTOS.filter(([k]) => f['d' + k] === '1').map(([k]) => Number(k));
    if (!marcados.length) { avisar('Marca al menos un día.'); return false; }
    const datos = { nombre, dosis: (f.dosis || '').trim(), hora: f.hora, dias: marcados.length === 7 ? [] : marcados, nota: (f.nota || '').trim(), activa: f.activa === '1', cada_h: numOrNull(f.cada_h), max_dia: numOrNull(f.max_dia),
      unidades: numOrNull(f.unidades) || 1, caja_n: numOrNull(f.caja_n), aviso_stock: (f.aviso_stock === undefined || String(f.aviso_stock).trim() === '') ? 3 : Number(f.aviso_stock) };
    const obj = m || { id: nuevoId() }; const antes = m ? quedan(m, d.registro) : null;
    Object.assign(obj, datos); if (!m) d.ajustes.medicinas.push(obj);
    const nuevo = String(f.stock_ahora ?? '').trim() === '' ? null : Number(String(f.stock_ahora).replace(',', '.'));
    if (nuevo !== null && isFinite(nuevo) && nuevo !== antes) obj.stock_base = { n: nuevo, fecha: hoy(), hora: new Date().toTimeString().slice(0, 5) };
    else if (nuevo === null) delete obj.stock_base;
    S.guardar(); return true;
  });
  return true;
}
