// Pantalla «Hoy»: medicinas, agua y lo que hay que gastar primero.
import * as S from '../store.js';
import { esc, hoy, fechaLarga, diasHasta } from '../util.js';
import { caducidadEfectiva } from '../producto.js';
import { medicinasDeHoy, sumaHoras, esPeriodica, tomasDe, ahoraHM } from '../medicinas.js';
import { abrirHoja, campo, avisar } from '../ui.js';
import * as Comidas from './comidas.js';
import * as Plan from './plan.js';
import * as Avisos from '../avisos.js';
import * as Ejercicio from './ejercicio.js';
import { fraccion } from '../gasto.js';

const hbonita = h => h === '23:59' ? 'al acostarse' : h;

function filaMed(m, r, ahora) {
  const tomas = tomasDe(r, m.id), horas = tomas.map(t => t.h || 'sin hora').join(', ');
  let estilo = '', chip = '', clase = '', det = '', marca = '';
  if (esPeriodica(m)) {
    const max = Number(m.max_dia) || 0, completo = max > 0 && tomas.length >= max;
    const prox = tomas.length ? sumaHoras(tomas[tomas.length - 1].h || m.hora, m.cada_h) : { hm: m.hora, dia: 0 };
    const vencida = !completo && prox.dia === 0 && prox.hm <= ahora;
    det = `cada ${m.cada_h} h · hoy: ${horas || 'ninguna'}${max ? ` (${tomas.length}/${max})` : ''}`;
    chip = completo ? 'completo' : vencida ? 'toca ya' : `próxima ${prox.hm}${prox.dia ? ' (mañana)' : ''}`;
    clase = completo ? 'ok' : vencida ? 'warn' : '';
    estilo = completo ? 'border-color:var(--ok);background:var(--ok-soft)' : vencida ? 'border-color:var(--warn)' : '';
    marca = tomas.length ? `${tomas.length}× ` : '';
  } else {
    const t = tomas[0], tarde = !t && m.hora < ahora;
    det = hbonita(m.hora) + (m.nota ? ' · ' + m.nota : '');
    chip = t ? (t.h ? 'tomada ' + t.h : 'tomada') : tarde ? 'pendiente' : 'toca ' + hbonita(m.hora);
    clase = t ? 'ok' : tarde ? 'warn' : '';
    estilo = t ? 'border-color:var(--ok);background:var(--ok-soft)' : tarde ? 'border-color:var(--warn)' : '';
    marca = t ? '✓ ' : '';
  }
  return `<button type="button" class="item" data-act="med" data-id="${esc(m.id)}" style="${estilo}">
    <span class="grow"><span class="nom" style="display:block">${marca}${esc(m.nombre)}${m.dosis ? ' ' + esc(m.dosis) : ''}</span>
    <span class="det" style="display:block">${esc(det)}</span></span><span class="chip ${clase}">${esc(chip)}</span></button>`;
}

// Hoja para dar una medicina por tomada: ahora, a su hora o a otra hora; y quitar tomas ya apuntadas.
function abrirToma(m) {
  const r = S.dia(), tomas = tomasDe(r, m.id), ahora = ahoraHM(), ciclo = esPeriodica(m);
  const prevista = ciclo && tomas.length ? sumaHoras(tomas[tomas.length - 1].h || m.hora, m.cada_h).hm : m.hora;
  const max = Number(m.max_dia) || 0, lleno = ciclo && max > 0 && tomas.length >= max;
  const cambiar = !ciclo && tomas.length > 0;
  abrirHoja(`
    <h1>${esc(m.nombre)}${m.dosis ? ' ' + esc(m.dosis) : ''}</h1>
    <p class="sub">${ciclo ? `Cada ${esc(m.cada_h)} h` : 'Toca ' + esc(hbonita(m.hora))}${m.nota ? ' · ' + esc(m.nota) : ''}</p>
    ${lleno ? `<p><span class="chip bad">Hoy ya llevas el máximo (${max}). Compruébalo antes de otra toma.</span></p>` : ''}
    <button class="btn main grande" type="submit" value="ahora">${cambiar ? 'Cambiar a ahora' : 'Tomada ahora'} (${ahora})</button>
    <button class="btn grande" style="margin-top:10px" type="submit" value="prevista">${cambiar ? 'Cambiar a su hora' : 'Tomada a su hora'} (${esc(hbonita(prevista))})</button>
    <div style="height:14px"></div>
    ${campo('Otra hora', `<input name="hora" type="time" value="${ahora}">`)}
    <button class="btn grande" type="submit" value="otra">Guardar esa hora</button>
    ${tomas.length ? `<h2>Tomas de hoy</h2>` + tomas.map((t, i) => `<div class="fila sep" style="margin-bottom:8px"><span>✓ ${esc(t.h || 'sin hora')}</span>
      <button class="btn mini peligro" type="submit" value="quitar:${i}">Quitar</button></div>`).join('') : ''}
  `, (f, accion) => {
    const poner = h => {
      if (!h) { avisar('Falta la hora.'); return false; }
      r.meds[m.id] = (ciclo ? [...tomas, { h }] : [{ h }]).sort((x, y) => (x.h || '').localeCompare(y.h || ''));
      S.guardar(); return true;
    };
    if (accion === 'ahora') return poner(ahoraHM());
    if (accion === 'prevista') return poner(prevista);
    if (accion === 'otra') return poner(f.hora);
    if (accion.startsWith('quitar:')) {
      tomas.splice(Number(accion.slice(7)), 1);
      if (tomas.length) r.meds[m.id] = tomas; else delete r.meds[m.id];
      S.guardar(); return true;
    }
    return false;
  });
}

export function render() {
  const d = S.datos(), f = hoy(), r = S.dia(f), aj = d.ajustes;
  const meds = medicinasDeHoy(d.ajustes.medicinas, f), ahora = ahoraHM();
  const vasos = Array.from({ length: Math.max(aj.objetivo_vasos, r.agua) }, (_, i) =>
    `<button type="button" class="vaso ${i < r.agua ? 'lleno' : ''}" data-act="vaso" data-n="${i + 1}" aria-label="Vaso ${i + 1}"></button>`).join('');
  const litros = (r.agua * aj.vaso_ml / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 });

  const parcial = p => Math.abs(Number(p.cantidad) % 1) > 0.001;           // medio paquete, media bolsa…: hay que gastarlo primero
  const diasDe = p => { const n = diasHasta(caducidadEfectiva(p)); return n === null ? 99 : n; };
  const urgentes = d.nevera
    .filter(p => p.ubicacion !== 'congelador' && (diasDe(p) <= 3 || parcial(p)))
    .sort((a, b) => diasDe(a) - diasDe(b));

  return `
    <h1>Hoy</h1>
    <p class="sub">${esc(fechaLarga(f))} · v${esc(document.body.dataset.version || "?")}</p>

    ${Avisos.render()}
    <h2>Medicinas</h2>
    ${meds.length ? meds.map(m => filaMed(m, r, ahora)).join('') : '<div class="card vacio" style="margin:0">Hoy no toca ninguna medicina.</div>'}
    <button type="button" class="btn grande" style="margin-top:4px" data-nav="medicinas">Crear o modificar medicinas</button>

    <h2>Agua</h2>
    <div class="card">
      <div class="fila sep"><strong>${r.agua} de ${aj.objetivo_vasos} vasos</strong><span class="sub" style="margin:0">${litros} l</span></div>
      <div class="vasos">${vasos}</div>
      <div class="fila">
        <button type="button" class="btn main grow" data-act="agua+">+ Un vaso</button>
        <button type="button" class="btn mini" data-act="agua-" aria-label="Quitar un vaso">−</button>
      </div>
      <p class="nota-pie" style="margin-bottom:0">Un vaso de agua antes de cada comida.</p>
    </div>

    ${Ejercicio.render()}

    ${Plan.render()}

    ${Comidas.render()}

    <h2>Gastar primero</h2>
    ${urgentes.length ? urgentes.map(p => {
      const n = diasHasta(caducidadEfectiva(p)), par = parcial(p);
      const etiqueta = n === null ? '' : n < 0 ? `Caducado hace ${-n} d` : n === 0 ? 'Caduca hoy' : `Caduca en ${n} d`;
      return `<div class="item ${n !== null && n < 0 ? 'caducado' : 'alerta'}"><div class="grow"><div class="nom">${esc(p.nombre)}</div>
        <div class="det">${par ? `queda ${esc(fraccion(Number(p.cantidad)))}` : esc(p.cantidad)} ${par ? '' : esc(p.unidad)} · ${esc(p.ubicacion)}${par && p.abierto ? ' · abierto' : ''}</div></div>
        <span class="chip ${n !== null && n < 0 ? 'bad' : 'warn'}">${etiqueta || (par ? 'abierto' : '')}</span></div>`;
    }).join('') : '<div class="card vacio" style="margin:0">Nada a punto de caducar.</div>'}
  `;
}

export function acciones(act, el, redibujar) {
  if (act.startsWith('com-')) return Comidas.acciones(act, el);
  if (act.startsWith('plan-')) return Plan.acciones(act, el);
  if (act.startsWith('eje-')) return Ejercicio.acciones(act, el);
  const r = S.dia();
  if (act === 'med') { const m = S.datos().ajustes.medicinas.find(x => x.id === el.dataset.id); if (m) abrirToma(m); return true; }
  else if (act === 'agua+') r.agua += 1;
  else if (act === 'agua-') r.agua = Math.max(0, r.agua - 1);
  else if (act === 'vaso') { const n = Number(el.dataset.n); r.agua = (r.agua === n) ? n - 1 : n; }
  else return false;
  S.guardar();
  return true;
}
