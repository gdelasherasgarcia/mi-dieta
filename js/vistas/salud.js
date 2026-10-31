// Pantalla «Salud»: tensión (Omron) y peso semanal, con historial, medias, gráficas pequeñas y tabla para el enfermero.
import * as S from '../store.js';
import { esc, nuevoId, hoy, fechaCorta, diaSemana, desdeIso, iso } from '../util.js';
import { abrirHoja, campo, avisar } from '../ui.js';
import { eventoCita, calendario, descargar } from '../ics.js';
import { diasHasta } from '../util.js';

const ahora = () => new Date().toTimeString().slice(0, 5);
const fmt = (n, d = 1) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: d });
const num = x => { const n = Number(String(x ?? '').replace(',', '.')); return String(x ?? '').trim() === '' || !isFinite(n) ? null : n; };
const fuera = r => r.sis < 90 || r.sis > 180 || r.pulso < 50 || r.pulso > 110;   // umbrales de aviso acordados (carta de dieta)
const porFecha = (a, b) => (b.fecha + (b.hora || '')).localeCompare(a.fecha + (a.hora || ''));
const media = l => l.length ? l.reduce((s, x) => s + x, 0) / l.length : null;

function chispa(valores, color = 'var(--accent)') {              // gráfica pequeña en SVG, sin librerías
  if (valores.length < 2) return '';
  const w = 300, h = 54, mn = Math.min(...valores), mx = Math.max(...valores), r = mx - mn || 1;
  const pts = valores.map((v, i) => `${(i / (valores.length - 1) * (w - 8) + 4).toFixed(1)},${(h - 6 - (v - mn) / r * (h - 12)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="gráfica"><polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" points="${pts}"/></svg>
    <div class="det" style="display:flex;justify-content:space-between"><span>mín ${fmt(mn)}</span><span>máx ${fmt(mx)}</span></div>`;
}

export function render() {
  const d = S.datos(), s = d.salud;
  const ten = s.tension.slice().sort(porFecha), pes = s.peso.slice().sort(porFecha);
  const lunes = diaSemana(hoy()) === 'lunes', pesadoHoy = pes.some(p => p.fecha === hoy());
  const corte = iso(new Date(Date.now() - 7 * 86400000)), ult = ten.filter(r => r.fecha >= corte);
  const man = ult.filter(r => r.hora && r.hora < '12:00'), noc = ult.filter(r => r.hora && r.hora >= '12:00');
  const m = (l, k) => l.length ? fmt(media(l.map(x => x[k])), 0) : '—';
  const imc = pes.length ? pes[0].kg / Math.pow((d.ajustes.estatura_cm || 172) / 100, 2) : null;

  return `
    <h1>Salud</h1><p class="sub">Tensión (Omron) y peso. Anota lo que midas.</p>
    ${lunes && !pesadoHoy ? '<div class="card" style="border-color:var(--warn)"><b>Hoy es lunes: toca pesarte en ayunas.</b></div>' : ''}
    <div class="fila"><button type="button" class="btn main grow" data-act="sal-tension">+ Tensión</button><button type="button" class="btn main grow" data-act="sal-peso">+ Peso</button></div>

    <h2>Tensión</h2>
    <div class="card">
      <div class="dos"><div><div class="det">Media 7 días · mañana (${man.length})</div><div style="font-size:1.4rem;font-weight:700">${m(man, 'sis')}/${m(man, 'dia')} <span class="det">pulso ${m(man, 'pulso')}</span></div></div>
      <div><div class="det">Media 7 días · noche (${noc.length})</div><div style="font-size:1.4rem;font-weight:700">${m(noc, 'sis')}/${m(noc, 'dia')} <span class="det">pulso ${m(noc, 'pulso')}</span></div></div></div>
      ${chispa(ten.slice(0, 30).reverse().map(r => r.sis))}
      <div class="det">Sistólica de las últimas ${Math.min(30, ten.length)} lecturas.</div>
    </div>
    ${ten.slice(0, 20).map(r => `<button type="button" class="item" data-act="sal-edit-t" data-id="${esc(r.id)}">
      <span class="grow"><span class="nom" style="display:block">${r.sis}/${r.dia} · pulso ${r.pulso}</span>
      <span class="det" style="display:block">${esc(fechaCorta(r.fecha))} ${esc(r.hora || '')}${r.nota ? ' · ' + esc(r.nota) : ''}</span></span>
      ${fuera(r) ? '<span class="chip bad">revisar</span>' : '<span class="chip">Editar</span>'}</button>`).join('') || '<div class="card vacio">Sin lecturas. Pulsa «+ Tensión».</div>'}
    ${ten.some(fuera) ? '<p class="nota-pie">«Revisar» = fuera de tus umbrales de aviso (sistólica &lt;90 o &gt;180, pulso &lt;50 o &gt;110). Si hay síntomas, 112.</p>' : ''}

    <h2>Peso</h2>
    <div class="card">
      <div style="font-size:1.6rem;font-weight:700">${pes.length ? fmt(pes[0].kg) + ' kg' : '—'} <span class="det">${pes.length ? esc(fechaCorta(pes[0].fecha)) : ''}${imc ? ' · IMC ' + fmt(imc) : ''}</span></div>
      ${pes.length > 1 ? `<div class="det">${pes[0].kg - pes[1].kg <= 0 ? '▼' : '▲'} ${fmt(Math.abs(pes[0].kg - pes[1].kg))} kg desde la anterior (${esc(fechaCorta(pes[1].fecha))})</div>` : ''}
      ${chispa(pes.slice(0, 30).reverse().map(p => p.kg), 'var(--ok)')}
    </div>
    ${pes.slice(0, 12).map(p => `<button type="button" class="item" data-act="sal-edit-p" data-id="${esc(p.id)}">
      <span class="grow"><span class="nom" style="display:block">${fmt(p.kg)} kg</span><span class="det" style="display:block">${esc(fechaCorta(p.fecha))}${p.nota ? ' · ' + esc(p.nota) : ''}</span></span><span class="chip">Editar</span></button>`).join('')}

    <h2>Citas</h2>
    <button type="button" class="btn main grande" data-act="cit-nueva" style="margin-bottom:10px">+ Cita (médico, enfermero…)</button>
    ${(d.citas || []).slice().sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)).filter(c => diasHasta(c.fecha) >= -1).map(c => { const n = diasHasta(c.fecha); return `<div class="item" style="display:block">
      <div class="fila sep"><span class="nom">${esc(c.con || 'Cita')}</span><span class="chip ${n <= 2 ? 'warn' : ''}">${n === 0 ? 'hoy' : n === 1 ? 'mañana' : n < 0 ? 'ayer' : 'en ' + n + ' d'}</span></div>
      <div class="det" style="margin:2px 0 8px">${esc(fechaCorta(c.fecha))}${c.hora ? ' · ' + esc(c.hora) : ' · sin hora'}${c.lugar ? ' · ' + esc(c.lugar) : ''}${c.nota ? ' · ' + esc(c.nota) : ''}</div>
      <div class="fila"><button type="button" class="btn mini grow" data-act="cit-edit" data-id="${esc(c.id)}">Editar</button><button type="button" class="btn mini grow" data-act="cit-ics" data-id="${esc(c.id)}">📅 Añadir al calendario</button></div></div>`; }).join('') || '<div class="card vacio">No hay citas próximas.</div>'}

    <h2>Para el enfermero</h2>
    <button type="button" class="btn grande" data-act="sal-tabla">Ver tabla de los últimos 30 días</button>
    <p class="nota-pie">Esta app no es un médico: guarda tus datos, no los interpreta ni cambia tu medicación.</p>`;
}

const formT = r => `<h1>${r ? 'Editar' : 'Anotar'} tensión</h1>
  <div class="dos">${campo('Fecha', `<input name="fecha" type="date" value="${esc(r?.fecha || hoy())}">`)}${campo('Hora', `<input name="hora" type="time" value="${esc(r?.hora || ahora())}">`)}</div>
  <div class="dos">${campo('Sistólica (alta)', `<input name="sis" type="number" inputmode="numeric" value="${esc(r?.sis ?? '')}">`)}${campo('Diastólica (baja)', `<input name="dia" type="number" inputmode="numeric" value="${esc(r?.dia ?? '')}">`)}</div>
  ${campo('Pulso', `<input name="pulso" type="number" inputmode="numeric" value="${esc(r?.pulso ?? '')}">`)}
  ${campo('Nota', `<input name="nota" value="${esc(r?.nota || '')}" placeholder="en ayunas, tras cenar…" autocomplete="off">`)}
  <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
  ${r ? '<button class="btn peligro grande" style="margin-top:10px" type="submit" value="borrar">Borrar</button>' : ''}`;
const formP = r => `<h1>${r ? 'Editar' : 'Anotar'} peso</h1>
  <div class="dos">${campo('Fecha', `<input name="fecha" type="date" value="${esc(r?.fecha || hoy())}">`)}${campo('Peso (kg)', `<input name="kg" type="number" inputmode="decimal" step="0.1" value="${esc(r?.kg ?? '')}">`)}</div>
  ${campo('Nota', `<input name="nota" value="${esc(r?.nota || '')}" placeholder="en ayunas…" autocomplete="off">`)}
  <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
  ${r ? '<button class="btn peligro grande" style="margin-top:10px" type="submit" value="borrar">Borrar</button>' : ''}`;

function tabla() {
  const s = S.datos().salud, corte = iso(new Date(Date.now() - 30 * 86400000));
  const t = s.tension.filter(r => r.fecha >= corte).sort(porFecha).reverse(), p = s.peso.filter(r => r.fecha >= corte).sort(porFecha).reverse();
  return ['TENSIÓN (Omron M4)', 'Fecha | Hora | Sist/Diast | Pulso | Nota', ...t.map(r => `${r.fecha} | ${r.hora || ''} | ${r.sis}/${r.dia} | ${r.pulso} | ${r.nota || ''}`), '', 'PESO', 'Fecha | Kg | Nota', ...p.map(r => `${r.fecha} | ${r.kg} | ${r.nota || ''}`)].join('\n');
}

const formCita = c => `<h1>${c ? 'Editar' : 'Nueva'} cita</h1>
  ${campo('¿Con quién?', `<input name="con" required value="${esc(c?.con || '')}" list="lista-citas" autocomplete="off" placeholder="médico, enfermero, cardiología, analítica…">`)}
  <datalist id="lista-citas"><option>Médico</option><option>Enfermero</option><option>Cardiología</option><option>Analítica</option><option>Electrocardiograma</option><option>Dentista</option></datalist>
  <div class="dos">${campo('Fecha', `<input name="fecha" type="date" value="${esc(c?.fecha || '')}">`)}${campo('Hora', `<input name="hora" type="time" value="${esc(c?.hora || '')}">`)}</div>
  ${campo('Lugar', `<input name="lugar" value="${esc(c?.lugar || '')}" autocomplete="off">`)}
  ${campo('Nota (qué llevar, qué preguntar)', `<input name="nota" value="${esc(c?.nota || '')}" autocomplete="off">`)}
  <p class="det" style="margin:4px 0">Avisos en el calendario del móvil:</p>
  ${[[10080, '1 semana antes'], [1440, '1 día antes'], [120, '2 horas antes'], [30, '30 minutos antes']].map(([m, t]) => `<label class="fila" style="min-height:44px"><input type="checkbox" name="a${m}" value="1" ${((c?.avisos || [1440, 120]).includes(m)) ? 'checked' : ''} style="width:24px;height:24px"> ${t}</label>`).join('')}
  <div class="fila" style="margin-top:8px"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
  ${c ? '<button class="btn peligro grande" style="margin-top:10px" type="submit" value="borrar">Borrar</button>' : ''}`;

export function acciones(act, el) {
  const s = S.datos().salud, dd = S.datos();
  if (act === 'cit-ics') {
    const c = dd.citas.find(x => x.id === el.dataset.id); if (!c) return true;
    if (!c.hora) { avisar('Pon primero la hora de la cita (Editar) para crear el aviso.'); return true; }
    descargar(`cita_${c.fecha}.ics`, calendario([eventoCita(c)], 'Citas')); avisar('Archivo descargado: ábrelo en el móvil y se añade al calendario con sus avisos.'); return true;
  }
  if (act === 'cit-nueva' || act === 'cit-edit') {
    const c = act === 'cit-edit' ? dd.citas.find(x => x.id === el.dataset.id) : null;
    abrirHoja(formCita(c), (f, acc) => {
      if (acc === 'borrar') { dd.citas = dd.citas.filter(x => x !== c); S.guardar(); return true; }
      if (!(f.con || '').trim() || !f.fecha) { avisar('Faltan la persona y la fecha.'); return false; }
      const dato = { con: f.con.trim(), fecha: f.fecha, hora: f.hora || '', lugar: (f.lugar || '').trim(), nota: (f.nota || '').trim(), avisos: [10080, 1440, 120, 30].filter(m => f['a' + m] === '1') };
      if (c) Object.assign(c, dato); else dd.citas.push({ id: nuevoId(), ...dato });
      S.guardar(); return true;
    });
    return true;
  }
  if (act === 'sal-tabla') { abrirHoja(`<h1>Últimos 30 días</h1><p class="sub">Selecciona y copia, o enséñalo tal cual.</p><textarea readonly rows="14" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--card);padding:10px;font-family:monospace;font-size:.8rem">${esc(tabla())}</textarea>`, () => true); return true; }
  if (act === 'sal-tension' || act === 'sal-edit-t') {
    const r = act === 'sal-edit-t' ? s.tension.find(x => x.id === el.dataset.id) : null;
    abrirHoja(formT(r), (f, acc) => {
      if (acc === 'borrar') { s.tension = s.tension.filter(x => x !== r); S.guardar(); avisar('Lectura borrada.'); return true; }
      const sis = num(f.sis), dia = num(f.dia), pulso = num(f.pulso);
      if (sis === null || dia === null || pulso === null) { avisar('Faltan datos: alta, baja y pulso.'); return false; }
      if (sis < 60 || sis > 260 || dia < 30 || dia > 160 || pulso < 25 || pulso > 220 || dia >= sis) { avisar('Revisa los números: no parecen una lectura válida.'); return false; }
      const dato = { fecha: f.fecha || hoy(), hora: f.hora || ahora(), sis, dia, pulso, nota: (f.nota || '').trim() };
      if (r) Object.assign(r, dato); else s.tension.push({ id: nuevoId(), ...dato });
      S.guardar(); if (fuera(dato)) avisar('Fuera de tus umbrales: si tienes síntomas, 112; si no, avisa al enfermero.'); return true;
    });
    return true;
  }
  if (act === 'sal-peso' || act === 'sal-edit-p') {
    const r = act === 'sal-edit-p' ? s.peso.find(x => x.id === el.dataset.id) : null;
    abrirHoja(formP(r), (f, acc) => {
      if (acc === 'borrar') { s.peso = s.peso.filter(x => x !== r); S.guardar(); avisar('Peso borrado.'); return true; }
      const kg = num(f.kg); if (kg === null || kg < 30 || kg > 300) { avisar('Revisa el peso en kg.'); return false; }
      const dato = { fecha: f.fecha || hoy(), kg, nota: (f.nota || '').trim() };
      if (r) Object.assign(r, dato); else s.peso.push({ id: nuevoId(), ...dato });
      S.guardar(); return true;
    });
    return true;
  }
  return false;
}
