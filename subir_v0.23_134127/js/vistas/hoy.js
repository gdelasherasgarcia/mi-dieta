// Pantalla «Hoy»: medicinas, agua y lo que hay que gastar primero.
import * as S from '../store.js';
import { esc, hoy, fechaLarga, fechaCorta, diasHasta, desdeIso, iso, diaVista, setDiaVista, esOtroDia } from '../util.js';
import { caducidadEfectiva } from '../producto.js';
import { medicinasDeHoy, sumaHoras, esPeriodica, tomasDe, ahoraHM } from '../medicinas.js';
import { abrirHoja, campo, avisar } from '../ui.js';
import * as Comidas from './comidas.js';
import * as Plan from './plan.js';
import * as Avisos from '../avisos.js';
import { botiquinPendiente } from './nevera.js';
import * as Ejercicio from './ejercicio.js';
import { fraccion } from '../gasto.js';

const hbonita = h => h === '23:59' ? 'al acostarse' : h;

export function filaMed(m, r, ahora) {
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
export function abrirToma(m) {
  const r = S.dia(), tomas = tomasDe(r, m.id), ahora = ahoraHM(), ciclo = esPeriodica(m);
  const prevista = ciclo && tomas.length ? sumaHoras(tomas[tomas.length - 1].h || m.hora, m.cada_h).hm : m.hora;
  const max = Number(m.max_dia) || 0, lleno = ciclo && max > 0 && tomas.length >= max;
  const cambiar = !ciclo && tomas.length > 0, otro = esOtroDia();
  const ayer = iso(new Date(desdeIso(hoy()).getTime() - 86400000)), madrugada = m.hora === '23:59' && ahora < '05:00';   // la de acostarse, tomada pasada la medianoche, es la de ayer
  abrirHoja(`
    <h1>${esc(m.nombre)}${m.dosis ? ' ' + esc(m.dosis) : ''}</h1>
    <p class="sub">${ciclo ? `Cada ${esc(m.cada_h)} h` : 'Toca ' + esc(hbonita(m.hora))}${m.nota ? ' · ' + esc(m.nota) : ''}</p>
    ${lleno ? `<p><span class="chip bad">Hoy ya llevas el máximo (${max}). Compruébalo antes de otra toma.</span></p>` : ''}
    ${otro ? `<p class="det">Estás apuntando el ${esc(fechaLarga(diaVista()))}.</p>` : `<button class="btn main grande" type="submit" value="ahora">${cambiar ? 'Cambiar a ahora' : 'Tomada ahora'} (${ahora})</button>`}
    <button class="btn ${otro ? 'main ' : ''}grande" style="margin-top:10px" type="submit" value="prevista">${cambiar ? 'Cambiar a su hora' : 'Tomada a su hora'} (${esc(hbonita(prevista))})</button>
    ${madrugada && !otro ? `<button class="btn grande" style="margin-top:10px" type="submit" value="ayer">Era la de ayer, al acostarse (${esc(fechaCorta(ayer))})</button>` : ''}
    <div style="height:14px"></div>
    ${campo('Otra hora', `<input name="hora" type="time" value="${ahora}">`)}
    <button class="btn grande" type="submit" value="otra">Guardar esa hora</button>
    ${otro ? '' : `<h2>¿Se te olvidó apuntarla otro día?</h2>
    ${campo('Día', `<input name="fecha" type="date" max="${hoy()}" value="${ayer}">`)}
    <button class="btn grande" type="submit" value="otrodia">Apuntarla en ese día (a la hora «Otra hora»)</button>`}
    ${tomas.length ? `<h2>Tomas de ${otro ? 'ese día' : 'hoy'}</h2>` + tomas.map((t, i) => `<div class="fila sep" style="margin-bottom:8px"><span>✓ ${esc(t.h || 'sin hora')}</span>
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
    if (accion === 'ayer' || accion === 'otrodia') {                       // apuntar la toma en OTRO día (cuenta para el stock de pastillas de ese día)
      const dia = accion === 'ayer' ? ayer : f.fecha, h = accion === 'ayer' ? '23:59' : f.hora;
      if (!dia || dia > hoy()) { avisar('Elige un día que no sea futuro.'); return false; }
      if (!h) { avisar('Falta la hora.'); return false; }
      const rd = S.dia(dia), prev = tomasDe(rd, m.id);
      rd.meds[m.id] = (ciclo ? [...prev, { h }] : [{ h }]).sort((x, y) => (x.h || '').localeCompare(y.h || ''));
      S.guardar(); avisar(`Toma apuntada el ${fechaCorta(dia)}.`); return true;
    }
    if (accion.startsWith('quitar:')) {
      tomas.splice(Number(accion.slice(7)), 1);
      if (tomas.length) r.meds[m.id] = tomas; else delete r.meds[m.id];
      S.guardar(); return true;
    }
    return false;
  });
}

// Hoja para ajustar el vaso (ml) y el objetivo diario (litros). El objetivo en vasos se calcula a partir de ambos.
export function abrirAjustesAgua() {
  const d = S.datos(), aj = d.ajustes, ml = Number(aj.vaso_ml) || 250, objL = (Number(aj.objetivo_ml) || (Number(aj.objetivo_vasos) || 8) * ml) / 1000;
  abrirHoja(`<h1>Agua</h1><p class="sub">Tamaño de tu vaso y cuánto quieres beber al día.</p>
    <p class="det" style="margin:0 0 6px">Tamaño del vaso (toca uno, o escribe otro abajo):</p>
    <div class="fila" style="flex-wrap:wrap;gap:8px;margin-bottom:8px">${[200, 250, 330, 500].map(v => `<button class="btn grow ${v === ml ? 'main' : ''}" type="submit" value="v${v}">${v} ml</button>`).join('')}</div>
    ${campo('Otro tamaño (ml)', `<input name="vaso" type="number" inputmode="numeric" min="50" max="2000" value="${ml}">`)}
    ${campo('Objetivo diario (litros)', `<input name="litros" type="number" inputmode="decimal" step="0.1" min="0.5" max="6" value="${String(objL).replace('.', ',')}">`)}
    <label class="fila" style="min-height:44px"><input type="checkbox" name="antes" value="1" checked> Aplicar también a los días ya anotados</label>
    <p class="det" style="margin:0 0 8px">Si lo desmarcas, los días anteriores conservan el vaso que tenían.</p>
    <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>`, (f, acc) => {
    const nuevo = acc.startsWith('v') ? Number(acc.slice(1)) : Number(String(f.vaso).replace(',', '.'));
    const litros = Number(String(f.litros).replace(',', '.'));
    if (!(nuevo >= 50 && nuevo <= 2000)) { avisar('El vaso debe estar entre 50 y 2000 ml.'); return false; }
    if (!(litros >= 0.5 && litros <= 6)) { avisar('El objetivo debe estar entre 0,5 y 6 litros.'); return false; }
    for (const r of Object.values(d.registro || {})) {
      if (f.antes === '1') delete r.vaso_ml;                       // todos los días pasan a usar el vaso nuevo
      else if (r.agua > 0 && !r.vaso_ml) r.vaso_ml = ml;           // los días ya anotados conservan el vaso que tenían
    }
    aj.vaso_ml = nuevo; aj.objetivo_ml = Math.round(litros * 1000); aj.objetivo_vasos = Math.max(1, Math.round(aj.objetivo_ml / nuevo));
    S.guardar(); avisar(`Vaso de ${nuevo} ml · objetivo ${litros.toLocaleString('es-ES')} l (${aj.objetivo_vasos} vasos).`); return true;
  });
}

export function render() {
  const d = S.datos(), f = diaVista(), r = S.dia(f), aj = d.ajustes, otro = esOtroDia();
  const meds = medicinasDeHoy(d.ajustes.medicinas, f), ahora = otro ? '23:59' : ahoraHM();
  const vasos = Array.from({ length: Math.max(aj.objetivo_vasos, r.agua) }, (_, i) =>
    `<button type="button" class="vaso ${i < r.agua ? 'lleno' : ''}" data-act="vaso" data-n="${i + 1}" aria-label="Vaso ${i + 1}"></button>`).join('');
  const mlVaso = Number(r.vaso_ml) || Number(aj.vaso_ml) || 250, fl = n => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
  const litros = fl(r.agua * mlVaso / 1000), objL = fl((Number(aj.objetivo_ml) || aj.objetivo_vasos * mlVaso) / 1000);

  const parcial = p => Math.abs(Number(p.cantidad) % 1) > 0.001;           // medio paquete, media bolsa…: hay que gastarlo primero
  const diasDe = p => { const n = diasHasta(caducidadEfectiva(p)); return n === null ? 99 : n; };
  const urgentes = d.nevera
    .filter(p => p.ubicacion !== 'congelador' && (diasDe(p) <= 3 || parcial(p)))
    .sort((a, b) => diasDe(a) - diasDe(b));

  return `
    <h1>${otro ? 'Otro día' : 'Hoy'}</h1>
    <p class="sub">${esc(fechaLarga(f))} · v${esc(document.body.dataset.version || "?")}</p>
    <div class="fila" style="margin-bottom:10px">
      <button type="button" class="btn mini" data-act="dia-prev" aria-label="Día anterior">‹</button>
      <button type="button" class="btn mini grow" data-act="dia-elegir">${otro ? '📅 Cambiar de día' : '📅 Ver o completar otro día'}</button>
      <button type="button" class="btn mini" data-act="dia-next" aria-label="Día siguiente" ${otro ? '' : 'disabled style="opacity:.4"'}>›</button>
    </div>
    ${otro ? `<div class="item alerta" style="display:block"><div class="nom">No es hoy: estás mirando el ${esc(fechaCorta(f))}</div><div class="det" style="margin:2px 0 8px">Aquí puedes completar medicinas, agua, ejercicio y comidas que no apuntaste ese día.</div><button type="button" class="btn mini" style="width:100%" data-act="dia-hoy">Volver a hoy</button></div>` : Avisos.render()}
    <h2>Medicinas</h2>
    ${meds.length ? meds.map(m => filaMed(m, r, ahora)).join('') : '<div class="card vacio" style="margin:0">Hoy no toca ninguna medicina.</div>'}
    <button type="button" class="btn grande" style="margin-top:4px" data-nav="medicinas">Crear o modificar medicinas</button>

    <h2>Agua</h2>
    <div class="card">
      <div class="fila sep"><strong>${r.agua} de ${aj.objetivo_vasos} vasos</strong><span class="sub" style="margin:0">${litros} de ${objL} l</span></div>
      <div class="vasos">${vasos}</div>
      <div class="fila">
        <button type="button" class="btn main grow" data-act="agua+">+ Un vaso</button>
        <button type="button" class="btn mini" data-act="agua-" aria-label="Quitar un vaso">−</button>
      </div>
      <button type="button" class="btn mini" data-act="agua-ajustes" style="margin-top:8px">Vaso de ${mlVaso} ml · cambiar vaso u objetivo</button>
      <p class="nota-pie" style="margin-bottom:0">Un vaso de agua antes de cada comida.</p>
    </div>

    ${Ejercicio.render()}

    ${otro ? '' : Plan.render()}

    ${Comidas.render()}

    ${otro ? '' : '<h2>Gastar primero</h2>'}
    ${otro ? '' : urgentes.length ? urgentes.map(p => {
      const n = diasHasta(caducidadEfectiva(p)), par = parcial(p);
      const etiqueta = n === null ? '' : n < 0 ? `Caducado hace ${-n} d` : n === 0 ? 'Caduca hoy' : `Caduca en ${n} d`;
      return `<div class="item ${n !== null && n < 0 ? 'caducado' : 'alerta'}"><div class="grow"><div class="nom">${esc(p.nombre)}</div>
        <div class="det">${p.sin_cuenta ? 'hay' : par ? `queda ${esc(fraccion(Number(p.cantidad)))}` : esc(p.cantidad)} ${par || p.sin_cuenta ? '' : esc(p.unidad)} · ${esc(p.ubicacion)}${par && p.abierto ? ' · abierto' : ''}</div></div>
        <span class="chip ${n !== null && n < 0 ? 'bad' : 'warn'}">${etiqueta || (par ? 'abierto' : '')}</span></div>`;
    }).join('') : '<div class="card vacio" style="margin:0">Nada a punto de caducar.</div>'}
    ${(() => { const bot = otro ? [] : botiquinPendiente(d); return bot.length ? `<h2>Botiquín</h2>${bot.map(({ p, n }) => `<div class="item ${n < 0 ? 'caducado' : 'alerta'}"><div class="grow"><div class="nom">${esc(p.nombre)}</div><div class="det">${n < 0 ? 'Caducado: retirar' : n === 0 ? 'Caduca hoy' : 'Caduca en ' + n + ' d'}</div></div><span class="chip ${n < 0 ? 'bad' : 'warn'}">${n < 0 ? 'retirar' : n + ' d'}</span></div>`).join('')}<button type="button" class="btn grande" data-nav="nevera" onclick="try{sessionStorage.setItem('ir_botiquin','1')}catch(e){}">Abrir el botiquín</button>` : ''; })()}
  `;
}

export function acciones(act, el, redibujar) {
  if (act === 'dia-prev' || act === 'dia-next') {
    const n = iso(new Date(desdeIso(diaVista()).getTime() + (act === 'dia-prev' ? -86400000 : 86400000)));
    if (n > hoy()) return false; setDiaVista(n); return true;
  }
  if (act === 'dia-hoy') { setDiaVista(null); return true; }
  if (act === 'dia-elegir') {
    abrirHoja(`<h1>Elegir día</h1><p class="sub">Puedes ver y completar medicinas, agua, ejercicio y comidas de un día pasado.</p>
      ${campo('Día', `<input name="fecha" type="date" max="${hoy()}" value="${diaVista()}" required>`)}
      <div class="fila"><button class="btn main grow" type="submit" value="ir">Ir a ese día</button></div>`, f => {
      if (!f.fecha || f.fecha > hoy()) { avisar('Elige un día que no sea futuro.'); return false; }
      setDiaVista(f.fecha); S.guardar(); return true;                       // guardar() sirve aquí para que se redibuje la pantalla
    });
    return true;
  }
  if (act.startsWith('com-')) return Comidas.acciones(act, el);
  if (act.startsWith('plan-')) return Plan.acciones(act, el);
  if (act.startsWith('eje-')) return Ejercicio.acciones(act, el);
  const r = S.dia();
  if (act === 'med') { const m = S.datos().ajustes.medicinas.find(x => x.id === el.dataset.id); if (m) abrirToma(m); return true; }
  else if (act === 'agua-ajustes') { abrirAjustesAgua(); return false; }
  else if (act === 'agua+') r.agua += 1;
  else if (act === 'agua-') r.agua = Math.max(0, r.agua - 1);
  else if (act === 'vaso') { const n = Number(el.dataset.n); r.agua = (r.agua === n) ? n - 1 : n; }
  else return false;
  S.guardar();
  return true;
}
