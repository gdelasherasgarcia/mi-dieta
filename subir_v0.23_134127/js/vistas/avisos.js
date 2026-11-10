// Pantalla «Avisos»: lo pendiente de hoy (en rojo) con sus salidas, tus avisos propios (crear, editar, borrar) y los ajustes de avisos.
// Todo esto solo avisa con la app abierta; para que suene con la app cerrada, cada aviso se puede llevar al calendario del móvil (.ics).
import * as S from '../store.js';
import * as A from '../avisos.js';
import { esc, hoy, iso, fechaCorta } from '../util.js';
import { abrirHoja, campo, avisar } from '../ui.js';
import { DIAS_CORTOS as DIAS } from '../medicinas.js';
import { eventoDiario, eventoPropio, calendario, descargar } from '../ics.js';
import { abrirAjustesAgua } from './hoy.js';

const dos = n => String(n).padStart(2, '0');
const aISO = d => iso(d) + 'T' + dos(d.getHours()) + ':' + dos(d.getMinutes());
const tipoNombre = k => (A.TIPOS.find(t => t[0] === k) || [k, k])[1];
const diasTexto = p => p.unico ? 'solo el ' + fechaCorta(p.unico) : (!p.dias || !p.dias.length || p.dias.length === 7) ? 'cada día' : DIAS.filter(([k]) => p.dias.includes(Number(k))).map(([, t]) => t).join(' ');

// Los avisos propios creados desde Agua, Comidas o Ejercicio se listan dentro de su desplegable (grupo); el resto, en «Mis avisos».
const EMO_GRUPO = [['💧', 'agua'], ['🍽', 'comidas'], ['🚴', 'ejercicio']];
const grupoDe = p => p.grupo || (EMO_GRUPO.find(([e]) => String(p.titulo || '').startsWith(e)) || [])[1] || '';
const filaPropio = p => `<button type="button" class="item" data-act="av-edit" data-id="${esc(p.id)}" style="${p.activo === false ? 'opacity:.6' : ''}">
        <span class="grow"><span class="nom" style="display:block">${esc(p.titulo)}</span><span class="det" style="display:block">${esc(p.hora)} · ${esc(diasTexto(p))}${p.nota ? ' · ' + esc(p.nota) : ''}</span></span>
        <span class="chip ${p.activo === false ? '' : 'ok'}">${p.activo === false ? 'apagado' : 'activado'}</span></button>`;
const listaGrupo = (k, propios) => { const l = propios.filter(p => grupoDe(p) === k); return l.length ? `<p class="det" style="margin:10px 0 6px">Tus avisos de este tipo:</p>` + l.map(filaPropio).join('') : ''; };
const abierto = k => { try { return sessionStorage.getItem('av_ab_' + k) === '1'; } catch (e) { return false; } };
const acordeon = (k, a, cuerpo, extra = '') => {
  const act = A.estaActivo(a, k);
  return `<details class="card" data-k="${k}" ${abierto(k) ? 'open' : ''} ontoggle="try{this.open?sessionStorage.setItem('av_ab_'+this.dataset.k,'1'):sessionStorage.removeItem('av_ab_'+this.dataset.k)}catch(e){}" style="margin-bottom:8px">
    <summary style="min-height:44px;display:flex;align-items:center;gap:8px;font-weight:700;cursor:pointer"><span class="grow">${esc(tipoNombre(k))}</span>${extra}<span class="chip ${act ? 'ok' : ''}">${act ? 'activado' : 'apagado'}</span></summary>
    <div style="padding-top:8px"><button type="button" class="btn grande" data-act="aviso-tipo" data-k="${k}" style="margin-bottom:10px">${act ? 'Apagar este aviso' : 'Activar este aviso'}</button>${cuerpo}</div></details>`;
};

export function render() {
  const { pend, posp, anul } = A.clasificar();
  const a = S.datos().ajustes, propios = A.propios().slice().sort((x, y) => (x.hora || '').localeCompare(y.hora || ''));
  const botones = x => `<div class="fila" style="margin-top:8px">
        ${x.tipo === 'propios' ? `<button type="button" class="btn mini grow main" data-act="av-hecho" data-k="${esc(x.clave)}">Hecho</button>` : ''}
        <button type="button" class="btn mini grow" data-act="av-posp" data-k="${esc(x.clave)}">Posponer</button>
        <button type="button" class="btn mini grow" data-act="av-anular" data-k="${esc(x.clave)}">Anular</button>
        <button type="button" class="btn mini grow" data-act="av-cancelar" data-t="${esc(x.tipo)}" data-k="${esc(x.clave)}">Cancelar</button></div>`;
  return `
    <div class="fila sep"><div><h1>Avisos</h1><p class="sub" style="margin:0">${pend.length} pendientes${posp.length ? ` · ${posp.length} pospuestos` : ''}${anul.length ? ` · ${anul.length} anulados hoy` : ''}</p></div></div>
    <div style="height:10px"></div>
    ${pend.map(x => `<div class="item caducado" style="display:block"><div class="nom">${esc(x.texto)}</div>${botones(x)}</div>`).join('') || '<div class="card vacio">No hay avisos pendientes.</div>'}
    ${posp.length ? '<h2>Pospuestos</h2>' + posp.map(x => `<div class="item" style="display:block;opacity:.8"><div class="nom">${esc(x.texto)}</div>
      <div class="det">Vuelve a avisar a partir de las ${esc(x.hasta.slice(11))}${x.hasta.slice(0, 10) !== hoy() ? ' del ' + esc(fechaCorta(x.hasta.slice(0, 10))) : ''}</div>
      <div class="fila" style="margin-top:6px"><button type="button" class="btn mini grow" data-act="av-deshacer" data-k="${esc(x.clave)}">Quitar el aplazamiento</button></div></div>`).join('') : ''}
    ${anul.length ? '<h2>Anulados hoy</h2>' + anul.map(x => `<div class="item" style="display:block;opacity:.8"><div class="nom" style="text-decoration:line-through">${esc(x.texto)}</div>
      <div class="fila" style="margin-top:6px"><button type="button" class="btn mini grow" data-act="av-deshacer" data-k="${esc(x.clave)}">Deshacer</button></div></div>`).join('') : ''}

    <h2>Configurar avisos</h2>
    <p class="sub" style="margin-top:0">Toca cada tipo para activarlo, ajustarlo o crear avisos de ese tipo.</p>
    ${acordeon('meds', a, `<p class="sub">Salta cuando una medicina de hora fija lleva retraso sin darla por tomada. Las medicinas y sus horas se editan en Medicinas.</p>
      <div class="dos"><label class="campo"><span>Avisar tras (minutos)</span><input type="number" min="5" step="5" inputmode="numeric" data-ajtxt="aviso_meds_min" value="${esc(a.aviso_meds_min || 30)}"></label>
        <label class="campo"><span>Poner en rojo tras (min)</span><input type="number" min="5" step="5" inputmode="numeric" data-ajtxt="aviso_meds_rojo" value="${esc(a.aviso_meds_rojo || 120)}"></label></div>
      <button type="button" class="btn grande" data-nav="medicinas">💊 Abrir Medicinas</button>`)}
    ${acordeon('propios', a, `<p class="sub">Avisos que creas tú, con su hora y sus días. Vencen a su hora y siguen en rojo hasta que los marcas como hechos.</p>
      <button type="button" class="btn main grande" data-act="av-nuevo" style="margin-bottom:10px">+ Nuevo aviso</button>
      ${propios.filter(p => !grupoDe(p)).map(filaPropio).join('') || '<div class="card vacio" style="margin:0">Aún no has creado ninguno.</div>'}`, `<span class="det">${propios.filter(p => !grupoDe(p)).length}</span>`)}
    ${acordeon('stock', a, `<p class="sub">Avisa cuando quedan pocas pastillas de una medicina y pone «Reponer…» en la lista de la compra (sección Farmacia). Cuántas son «pocas» se ajusta en cada medicina.</p>
      <button type="button" class="btn grande" data-nav="medicinas">💊 Abrir Medicinas</button>`)}
    ${acordeon('citas', a, `<p class="sub">Avisa unos días antes de cada cita con el médico o el enfermero. Las citas se crean y se editan en Salud.</p>
      <label class="campo"><span>Días de antelación</span><input type="number" min="1" max="14" step="1" inputmode="numeric" data-ajtxt="aviso_citas_dias" value="${esc(a.aviso_citas_dias || 2)}"></label>
      <button type="button" class="btn grande" data-nav="salud">❤ Abrir Salud</button>`)}
    ${acordeon('agua', a, `<p class="sub">Avisa si vas por detrás del ritmo de agua del día (de 11:00 a 22:00). Ahora: vaso de ${esc(Number(a.vaso_ml) || 250)} ml.</p>
      <div class="fila" style="flex-wrap:wrap;gap:8px"><button type="button" class="btn grow" data-act="agua-ajustes">💧 Vaso y objetivo</button><button type="button" class="btn grow" data-act="aviso-ics" data-k="agua">📅 Al calendario del móvil</button></div>
      <button type="button" class="btn grande" style="margin-top:8px" data-act="av-nuevo" data-pre="💧 Un vaso de agua" data-grupo="agua">+ Otro aviso a una hora</button>${listaGrupo('agua', propios)}`)}
    ${acordeon('comidas', a, `<p class="sub">Avisa una hora después de cada comida si aún no la has apuntado.</p>
      <div class="dos">${[['hora_desayuno', 'Desayuno'], ['hora_media', 'Media mañana'], ['hora_comida', 'Comida'], ['hora_cena', 'Cena']].map(([k, t]) => `<label class="campo"><span>${t} a las</span><input type="time" data-ajtxt="${k}" value="${esc(a[k] || '')}"></label>`).join('')}</div>
      <div class="fila" style="flex-wrap:wrap;gap:8px"><button type="button" class="btn grow" data-act="aviso-ics" data-k="comidas">📅 Al calendario del móvil</button><button type="button" class="btn grow" data-act="av-nuevo" data-pre="🍽 Apunta lo que has comido" data-grupo="comidas">+ Otro aviso</button></div>${listaGrupo('comidas', propios)}`)}
    ${acordeon('ejercicio', a, `<p class="sub">Avisa a esa hora si hoy aún no has apuntado ejercicio.</p>
      <label class="campo"><span>Ejercicio a las</span><input type="time" data-ajtxt="hora_ejercicio" value="${esc(a.hora_ejercicio || '')}"></label>
      <div class="fila" style="flex-wrap:wrap;gap:8px"><button type="button" class="btn grow" data-act="aviso-ics" data-k="ejercicio">📅 Al calendario del móvil</button><button type="button" class="btn grow" data-act="av-nuevo" data-pre="🚴 Ejercicio" data-grupo="ejercicio">+ Otro aviso</button></div>${listaGrupo('ejercicio', propios)}`)}
    ${acordeon('peso', a, `<p class="sub">Una vez por semana, en ayunas y a la vez que la tensión. Avisa ese día desde la hora que pongas hasta que apuntes el peso en Salud, donde también ves la gráfica.</p>
      <label class="campo"><span>Día de la semana</span><select data-ajtxt="dia_peso">${[[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']].map(([k, t]) => `<option value="${k}" ${Number(a.dia_peso ?? 2) === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="campo"><span>Avisar desde las</span><input type="time" data-ajtxt="hora_peso" value="${esc(a.hora_peso || '08:00')}"></label>
      <button type="button" class="btn grande" data-nav="salud">❤ Abrir Salud</button>`)}
    <p class="nota-pie"><b>Hecho</b>: marca un aviso tuyo como cumplido hoy. <b>Posponer</b>: vuelve a avisar dentro de 1 hora, 3 horas o mañana. <b>Anular</b>: no avisa más por hoy. <b>Cancelar</b>: apaga ese aviso (o ese tipo) hasta que lo actives otra vez. Solo se ven con la app abierta; con la app cerrada avisa el calendario del móvil.</p>`;
}

function formPropio(p, pre = '', grupo = '') {
  const nuevo = !p; p = p || { titulo: pre, hora: '', dias: [], unico: '', nota: '', activo: true };
  return `<h1>${nuevo ? 'Nuevo aviso' : 'Editar aviso'}</h1><input type="hidden" name="grupo" value="${esc(nuevo ? grupo : (p.grupo || ''))}">
    ${campo('¿Qué te aviso?', `<input name="titulo" required value="${esc(p.titulo)}" autocomplete="off" placeholder="p. ej. Llamar a la farmacia">`)}
    ${campo('A las', `<input name="hora" type="time" required value="${esc(p.hora)}">`)}
    <p class="det" style="margin:0 0 6px">Días (si no marcas ninguno, todos los días):</p>
    <div class="fila" style="flex-wrap:wrap;gap:6px;margin-bottom:8px">${DIAS.map(([k, t]) => `<label class="btn mini" style="display:flex;align-items:center;gap:6px;min-height:44px"><input type="checkbox" name="d${k}" value="1" ${(p.dias || []).includes(Number(k)) ? 'checked' : ''}> ${t}</label>`).join('')}</div>
    ${campo('O solo una vez, el día (opcional)', `<input name="unico" type="date" value="${esc(p.unico || '')}">`)}
    ${campo('Nota (opcional)', `<input name="nota" value="${esc(p.nota || '')}" autocomplete="off">`)}
    <label class="fila" style="min-height:44px"><input type="checkbox" name="activo" value="1" ${p.activo !== false ? 'checked' : ''}> Aviso activado</label>
    <div class="fila" style="margin-top:6px"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
    <button class="btn grande" style="margin-top:10px" type="submit" value="ics">📅 Llevar al calendario del móvil (suena con la app cerrada)</button>
    ${nuevo ? '' : '<button class="btn peligro grande" style="margin-top:10px" type="submit" value="borrar">Borrar</button>'}`;
}

export function acciones(act, el) {
  const d = S.datos();
  if (act === 'agua-ajustes') { abrirAjustesAgua(); return false; }
  if (act === 'av-anular') { A.anular(el.dataset.k); avisar('Anulado por hoy.'); return true; }
  if (act === 'av-hecho') { A.hecho(el.dataset.k); avisar('Hecho.'); return true; }
  if (act === 'av-deshacer') { A.deshacer(el.dataset.k); return true; }
  if (act === 'aviso-tipo') { (d.ajustes.avisos ||= {})[el.dataset.k] = !A.estaActivo(d.ajustes, el.dataset.k); S.guardar(); return true; }
  if (act === 'aviso-ics') {
    const aj = d.ajustes, k = el.dataset.k; let ev = [], nombre = '';
    if (k === 'agua') { nombre = 'Dieta · Agua'; ev = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'].map(h => eventoDiario({ id: 'agua-' + h.replace(':', ''), titulo: '💧 Un vaso de agua', hora: h })); }
    if (k === 'comidas') { nombre = 'Dieta · Comidas'; ev = [['desayuno', 'Desayuno', aj.hora_desayuno], ['media', 'Media mañana: una fruta', aj.hora_media], ['comida', 'Comida', aj.hora_comida], ['cena', 'Cena (tortilla)', aj.hora_cena]].map(([id, t, h]) => eventoDiario({ id: 'com-' + id, titulo: '🍽 ' + t, hora: h || '12:00' })); }
    if (k === 'ejercicio') { nombre = 'Dieta · Ejercicio'; ev = [eventoDiario({ id: 'eje-pedal', titulo: '🚴 Ejercicio: pedaleadora 15 min', hora: aj.hora_ejercicio || '18:00', minutos: 15 }), ...['12:00', '13:00', '16:00', '17:00', '19:00'].map(h => eventoDiario({ id: 'eje-pie-' + h.replace(':', ''), titulo: '🧍 Levántate y haz puntillas', hora: h }))]; }
    descargar(`avisos_${k}.ics`, calendario(ev, nombre)); avisar(`Archivo de avisos de ${k} descargado.`); return false;
  }
  if (act === 'av-nuevo' || act === 'av-edit') {
    const p = act === 'av-edit' ? A.propios().find(x => x.id === el.dataset.id) : null;
    abrirHoja(formPropio(p, el.dataset.pre || '', el.dataset.grupo || ''), (f, acc) => {
      if (acc === 'borrar') { A.borrarPropio(p.id); avisar('Aviso borrado.'); return true; }
      const titulo = (f.titulo || '').trim(), hora = f.hora || '';
      if (!titulo || !/^\d\d:\d\d$/.test(hora)) { avisar('Faltan el texto y la hora.'); return false; }
      const datos = { titulo, hora, dias: DIAS.filter(([k]) => f['d' + k] === '1').map(([k]) => Number(k)), unico: f.unico || null, nota: (f.nota || '').trim(), activo: f.activo === '1', grupo: f.grupo || (p && p.grupo) || '' };
      if (acc === 'ics') {
        descargar(`aviso_${titulo.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 30) || 'aviso'}.ics`, calendario([eventoPropio({ id: p ? p.id : 'nuevo-' + Date.now(), ...datos })], 'Dieta · Mis avisos'));
        avisar('Archivo descargado: ábrelo en el móvil y se añade al calendario.'); return false;
      }
      A.guardarPropio(datos, p ? p.id : null); return true;
    });
    return true;
  }
  if (act === 'av-posp') {
    const k = el.dataset.k;
    abrirHoja(`<h1>Posponer</h1><p class="sub">¿Cuándo vuelvo a avisarte?</p>
      <div class="fila"><button class="btn main grow" type="submit" value="1">En 1 hora</button><button class="btn main grow" type="submit" value="3">En 3 horas</button></div>
      <button class="btn grande" style="margin-top:10px" type="submit" value="man">Mañana por la mañana (08:00)</button>`, (f, acc) => {
      const dt = new Date();
      if (acc === 'man') { dt.setDate(dt.getDate() + 1); dt.setHours(8, 0, 0, 0); } else dt.setHours(dt.getHours() + Number(acc));
      A.posponer(k, aISO(dt)); avisar('Pospuesto hasta las ' + aISO(dt).slice(11) + '.'); return true;
    });
    return true;
  }
  if (act === 'av-cancelar') {
    const t = el.dataset.t, k = el.dataset.k || '', propio = k.startsWith('propio:') ? A.propios().find(x => x.id === k.slice(7)) : null;
    abrirHoja(propio
      ? `<h1>Apagar este aviso</h1><p class="sub">Dejaré de avisarte de: <b>${esc(propio.titulo)}</b>. No se borra: lo puedes volver a activar en «Mis avisos».</p>
         <div class="fila"><button class="btn peligro grow" type="submit" value="si">Sí, apagar</button><button class="btn grow" type="submit" value="no">No</button></div>`
      : `<h1>Cancelar este tipo de aviso</h1><p class="sub">Dejaré de avisarte de: <b>${esc(tipoNombre(t))}</b>. Lo puedes volver a activar más abajo en esta pantalla.</p>
         <div class="fila"><button class="btn peligro grow" type="submit" value="si">Sí, apagar</button><button class="btn grow" type="submit" value="no">No</button></div>`, (f, acc) => {
      if (acc === 'si') { if (propio) A.apagarPropio(propio.id); else A.apagarTipo(t); avisar('Aviso apagado.'); }
      return true;
    });
    return true;
  }
  return false;
}
