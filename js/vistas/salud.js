// Pantalla «Salud»: tensión (Omron) y peso semanal, con historial, medias, gráficas pequeñas y tabla para el enfermero.
import * as S from '../store.js';
import { esc, nuevoId, hoy, fechaCorta, diaSemana, desdeIso, iso } from '../util.js';
import { abrirHoja, campo, avisar, confirmar } from '../ui.js';
import { eventoCita, calendario, descargar } from '../ics.js';
import { diasHasta } from '../util.js';
import { filaMed, abrirToma } from './hoy.js';
import { medicinasDeHoy, tomasDe, ahoraHM } from '../medicinas.js';

const ahora = () => new Date().toTimeString().slice(0, 5);
const fmt = (n, d = 1) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: d });
const num = x => { const n = Number(String(x ?? '').replace(',', '.')); return String(x ?? '').trim() === '' || !isFinite(n) ? null : n; };
const fuera = r => r.sis < 90 || r.sis > 180 || r.pulso < 50 || r.pulso > 110;   // umbrales de aviso acordados (carta de dieta)
const porFecha = (a, b) => (b.fecha + (b.hora || '')).localeCompare(a.fecha + (a.hora || ''));
const media = l => l.length ? l.reduce((s, x) => s + x, 0) / l.length : null;

// ── Interpretación MECÁNICA de las lecturas (rangos generales y comparación con las anteriores; NO es una valoración médica) ──
const RANGO = { ok: 0, warn: 1, bad: 2 };
function catTension(r) {
  if (r.sis >= 180 || r.dia >= 110) return { cat: 'Muy alta', nivel: 'bad' };
  if (r.sis >= 160 || r.dia >= 100) return { cat: 'Alta (grado 2)', nivel: 'bad' };
  if (r.sis >= 140 || r.dia >= 90) return { cat: 'Alta (grado 1)', nivel: 'warn' };
  if (r.sis >= 130 || r.dia >= 85) return { cat: 'Normal-alta', nivel: 'warn' };
  if (r.sis < 90 || r.dia < 60) return { cat: 'Baja', nivel: r.sis < 80 || r.dia < 50 ? 'bad' : 'warn' };
  if (r.sis >= 120 || r.dia >= 80) return { cat: 'Normal', nivel: 'ok' };
  return { cat: 'Óptima', nivel: 'ok' };
}
function catPulso(p) {
  if (p < 40 || p > 130) return { txt: p < 40 ? 'muy bajo' : 'muy alto', nivel: 'bad' };
  if (p < 50 || p > 100) return { txt: p < 50 ? 'bajo' : 'alto', nivel: 'warn' };
  return { txt: 'normal', nivel: 'ok' };
}
function evalTension(r, previas) {
  const c = catTension(r), p = catPulso(r.pulso), lineas = [], h = previas.slice(0, 10);
  let nivel = RANGO[p.nivel] > RANGO[c.nivel] ? p.nivel : c.nivel;
  if (h.length >= 3) {
    const ms = media(h.map(x => x.sis)), md = media(h.map(x => x.dia)), mp = media(h.map(x => x.pulso));
    const atip = Math.abs(r.sis - ms) >= 25 || Math.abs(r.dia - md) >= 15 || Math.abs(r.pulso - mp) >= 25;
    lineas.push(`${atip ? 'Se aparta de' : 'En línea con'} tus lecturas habituales (media ${fmt(ms, 0)}/${fmt(md, 0)}, pulso ${fmt(mp, 0)}).`);
    if (atip && nivel === 'ok') nivel = 'warn';
  }
  return { cat: c.cat + (p.nivel !== 'ok' ? ' · pulso ' + p.txt : ''), nivel, lineas };
}
function textoAlerta(r, ev) {
  return `${r.sis}/${r.dia}, pulso ${r.pulso}: ${ev.cat}.\n${ev.lineas.join('\n')}\n\nRecomendación: repite la medida sentado, tras 5 minutos de reposo y con el brazo a la altura del corazón.`
    + (ev.nivel === 'bad' ? '\n\nSi se confirma, avisa al sanitario. Si hay síntomas (mareo, dolor de pecho, falta de aire…), llama al 112.' : '')
    + '\n\nEs una interpretación mecánica con rangos generales, no una valoración médica.\n\n¿Guardar la lectura de todos modos?';
}
function evalPeso(d, previos) {
  const prev = previos[0]; if (!prev) return { nivel: 'ok', linea: '' };
  const dias = Math.max(1, Math.round((desdeIso(d.fecha) - desdeIso(prev.fecha)) / 86400000)), dif = d.kg - prev.kg;
  const salto = Math.abs(dif) > Math.min(5, 1.5 + 0.3 * dias);
  return { nivel: salto ? 'bad' : 'ok', prev, dias, dif, linea: `${dif <= 0 ? '▼' : '▲'} ${fmt(Math.abs(dif))} kg en ${dias} ${dias === 1 ? 'día' : 'días'} desde la pesada anterior (${fmt(prev.kg)} kg, ${fechaCorta(prev.fecha)}).` };
}

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
  const diaP = Number(d.ajustes.dia_peso ?? 2), NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], lunes = new Date().getDay() === diaP, pesadoHoy = pes.some(p => p.fecha === hoy());
  const corte = iso(new Date(Date.now() - 7 * 86400000)), ult = ten.filter(r => r.fecha >= corte);
  const man = ult.filter(r => r.hora && r.hora < '12:00'), noc = ult.filter(r => r.hora && r.hora >= '12:00');
  const m = (l, k) => l.length ? fmt(media(l.map(x => x[k])), 0) : '—';
  const imc = pes.length ? pes[0].kg / Math.pow((d.ajustes.estatura_cm || 172) / 100, 2) : null;

  return `
    <h1>Salud</h1><p class="sub">Tensión (Omron) y peso. Anota lo que midas.</p>
    ${lunes && !pesadoHoy ? '<div class="card" style="border-color:var(--warn)"><b>Hoy es ' + NOMBRES[diaP] + ': toca pesarte en ayunas, a la vez que la tensión.</b></div>' : ''}
    <div class="fila"><button type="button" class="btn main grow" data-act="sal-tension">+ Tensión</button><button type="button" class="btn main grow" data-act="sal-peso">+ Peso</button></div>

    <h2>Medicinas de hoy</h2>
    ${(() => { const ms = medicinasDeHoy(d.ajustes.medicinas, hoy()), r = S.dia(), a = ahoraHM(); return ms.length ? ms.map(m => filaMed(m, r, a)).join('') : '<div class="card vacio" style="margin:0">Hoy no toca ninguna medicina.</div>'; })()}
    <button type="button" class="btn grande" style="margin-top:4px" data-nav="medicinas">💊 Crear o modificar medicinas</button>

    <h2>Tensión</h2>
    <div class="card">
      <div class="dos"><div><div class="det">Media 7 días · mañana (${man.length})</div><div style="font-size:1.4rem;font-weight:700">${m(man, 'sis')}/${m(man, 'dia')} <span class="det">pulso ${m(man, 'pulso')}</span></div></div>
      <div><div class="det">Media 7 días · noche (${noc.length})</div><div style="font-size:1.4rem;font-weight:700">${m(noc, 'sis')}/${m(noc, 'dia')} <span class="det">pulso ${m(noc, 'pulso')}</span></div></div></div>
      ${chispa(ten.slice(0, 30).reverse().map(r => r.sis))}
      <div class="det">Sistólica de las últimas ${Math.min(30, ten.length)} lecturas.</div>
    </div>
    ${ten.slice(0, 20).map((r, i) => { const ev = evalTension(r, ten.slice(i + 1, i + 11)); return `<button type="button" class="item" data-act="sal-edit-t" data-id="${esc(r.id)}">
      <span class="grow"><span class="nom" style="display:block">${r.sis}/${r.dia} · pulso ${r.pulso}</span>
      <span class="det" style="display:block">${esc(fechaCorta(r.fecha))} ${esc(r.hora || '')}${r.nota ? ' · ' + esc(r.nota) : ''}</span></span>
      <span class="chip ${ev.nivel}">${esc(ev.cat)}</span></button>`; }).join('') || '<div class="card vacio">Sin lecturas. Pulsa «+ Tensión».</div>'}
    <p class="nota-pie">La etiqueta de cada lectura es una interpretación mecánica con rangos generales y con tus lecturas anteriores: no es una valoración médica. Si una medida te parece rara, repítela tras 5 minutos de reposo.</p>

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
    <p class="det" style="margin:12px 0 6px"><b>📄 Informe en PDF</b> con tablas y gráficas (tensión, peso, medicación, agua, ejercicio y dieta). Elige el periodo:</p>
    <div class="fila"><button type="button" class="btn main grow" data-act="sal-informe" data-dias="7">7 días</button><button type="button" class="btn main grow" data-act="sal-informe" data-dias="30">30 días</button><button type="button" class="btn main grow" data-act="sal-informe" data-dias="90">90 días</button></div>
    <p class="nota-pie">Esta app no es un médico: guarda tus datos, no los interpreta ni cambia tu medicación.</p>`;
}

const formT = (r, b = r) => `<h1>${r ? 'Editar' : 'Anotar'} tensión</h1>
  <div class="dos">${campo('Fecha', `<input name="fecha" type="date" value="${esc(b?.fecha || hoy())}">`)}${campo('Hora', `<input name="hora" type="time" value="${esc(b?.hora || ahora())}">`)}</div>
  <div class="dos">${campo('Sistólica (alta)', `<input name="sis" type="number" inputmode="numeric" value="${esc(b?.sis ?? '')}">`)}${campo('Diastólica (baja)', `<input name="dia" type="number" inputmode="numeric" value="${esc(b?.dia ?? '')}">`)}</div>
  ${campo('Pulso', `<input name="pulso" type="number" inputmode="numeric" value="${esc(b?.pulso ?? '')}">`)}
  ${campo('Nota', `<input name="nota" value="${esc(b?.nota || '')}" placeholder="en ayunas, tras cenar…" autocomplete="off">`)}
  <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
  ${r ? '<button class="btn peligro grande" style="margin-top:10px" type="submit" value="borrar">Borrar</button>' : ''}`;
const formP = (r, b = r) => `<h1>${r ? 'Editar' : 'Anotar'} peso</h1>
  <div class="dos">${campo('Fecha', `<input name="fecha" type="date" value="${esc(b?.fecha || hoy())}">`)}${campo('Peso (kg)', `<input name="kg" type="number" inputmode="decimal" step="0.1" value="${esc(b?.kg ?? '')}">`)}</div>
  ${campo('Nota', `<input name="nota" value="${esc(b?.nota || '')}" placeholder="en ayunas…" autocomplete="off">`)}
  <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
  ${r ? '<button class="btn peligro grande" style="margin-top:10px" type="submit" value="borrar">Borrar</button>' : ''}`;

function tabla() {
  const s = S.datos().salud, corte = iso(new Date(Date.now() - 30 * 86400000));
  const t = s.tension.filter(r => r.fecha >= corte).sort(porFecha).reverse(), p = s.peso.filter(r => r.fecha >= corte).sort(porFecha).reverse();
  return ['TENSIÓN (Omron M4)', 'Fecha | Hora | Sist/Diast | Pulso | Nota', ...t.map(r => `${r.fecha} | ${r.hora || ''} | ${r.sis}/${r.dia} | ${r.pulso} | ${r.nota || ''}`), '', 'PESO', 'Fecha | Kg | Nota', ...p.map(r => `${r.fecha} | ${r.kg} | ${r.nota || ''}`)].join('\n');
}

function informe(dias) {
  const d = S.datos(), sa = d.salud, aj = d.ajustes, fin = hoy(), ini = iso(new Date(Date.now() - (dias - 1) * 86400000));
  const enP = r => r.fecha >= ini && r.fecha <= fin;
  const t = sa.tension.filter(enP).sort(porFecha).reverse(), p = sa.peso.filter(enP).sort(porFecha).reverse();
  const L = [], f1 = n => fmt(n, 1), f0 = n => fmt(n, 0);
  L.push('INFORME DE SEGUIMIENTO', `Periodo: ${ini} a ${fin} (${dias} días)${aj.nombre ? ' · ' + aj.nombre : ''}`, 'Datos anotados por el propio paciente. No sustituyen a una valoración clínica.', '');
  // Peso
  L.push('PESO');
  if (p.length) {
    const a = p[0], b = p[p.length - 1], est = (aj.estatura_cm || 172) / 100;
    L.push(`Primera lectura: ${f1(a.kg)} kg (${a.fecha}) · Última: ${f1(b.kg)} kg (${b.fecha}) · Variación: ${b.kg - a.kg > 0 ? '+' : ''}${f1(b.kg - a.kg)} kg · IMC actual: ${f1(b.kg / (est * est))} (estatura ${f0(est * 100)} cm)`);
    L.push('Fecha | Kg | Nota', ...p.map(r => `${r.fecha} | ${f1(r.kg)} | ${r.nota || ''}`));
  } else L.push('Sin pesadas en el periodo.');
  L.push('');
  // Tensión
  L.push('TENSIÓN ARTERIAL (tensiómetro de brazo Omron M4)');
  if (t.length) {
    const man = t.filter(r => r.hora && r.hora < '12:00'), noc = t.filter(r => r.hora && r.hora >= '12:00');
    const m = (l, k) => l.length ? f0(media(l.map(x => x[k]))) : '—';
    const sis = t.map(r => r.sis), dia = t.map(r => r.dia);
    L.push(`Lecturas: ${t.length} · Media global: ${m(t, 'sis')}/${m(t, 'dia')} (pulso ${m(t, 'pulso')})`);
    L.push(`Media por la mañana (${man.length}): ${m(man, 'sis')}/${m(man, 'dia')} · Media por la tarde-noche (${noc.length}): ${m(noc, 'sis')}/${m(noc, 'dia')}`);
    L.push(`Sistólica mín–máx: ${Math.min(...sis)}–${Math.max(...sis)} · Diastólica mín–máx: ${Math.min(...dia)}–${Math.max(...dia)}`);
    const fu = t.filter(fuera); L.push(fu.length ? `Lecturas fuera de los umbrales de aviso (sistólica <90 o >180, pulso <50 o >110): ${fu.length}` : 'Ninguna lectura fuera de los umbrales de aviso.');
    const cnt = {}; for (const r of t) { const c = catTension(r).cat; cnt[c] = (cnt[c] || 0) + 1; }
    L.push('Clasificación mecánica con rangos generales (no es una valoración médica): ' + Object.entries(cnt).map(([k, v]) => `${k} ${v}`).join(' · '));
    L.push('Fecha | Hora | Sist/Diast | Pulso | Clasificación | Nota', ...t.map(r => `${r.fecha} | ${r.hora || ''} | ${r.sis}/${r.dia} | ${r.pulso} | ${catTension(r).cat} | ${r.nota || ''}`));
  } else L.push('Sin lecturas en el periodo.');
  L.push('');
  // Medicación
  L.push('MEDICACIÓN (tomas anotadas / días en que tocaba)');
  const meds = (aj.medicinas || []).filter(m => m.activa !== false), dd = [];
  for (let i = 0; i < dias; i++) dd.push(iso(new Date(Date.now() - i * 86400000)));
  const primero = Object.keys(d.registro || {}).sort()[0], desde = primero && primero > ini ? primero : ini;   // antes de usar la app no hay tomas anotadas: no cuentan como olvidadas
  const ddA = dd.filter(f => f >= desde);
  if (desde > ini) L.push(`Tomas anotadas en esta app desde el ${desde}; antes de esa fecha no hay datos de tomas (no significa que no se tomaran).`);
  for (const m of meds) {
    let previstos = 0, conToma = 0, tomas = 0;
    for (const f of ddA) {
      if (!medicinasDeHoy([m], f).length) continue;
      previstos++; const r = (d.registro || {})[f] || { meds: {} }, n = tomasDe({ meds: r.meds || {} }, m.id).length;
      if (n) conToma++; tomas += n;
    }
    L.push(`${m.nombre}${m.dosis ? ' ' + m.dosis : ''} · ${m.hora}${Number(m.cada_h) > 0 ? ' · cada ' + m.cada_h + ' h' : ''}: ${conToma}/${previstos} días con toma anotada${tomas !== conToma ? ` (${tomas} tomas)` : ''}`);
  }
  if (!meds.length) L.push('Sin medicinas configuradas.');
  L.push('');
  // Hábitos
  const regs = ddA.map(f => (d.registro || {})[f]).filter(Boolean);
  const agua = regs.filter(r => r.agua > 0), ej = regs.filter(r => (r.ejercicio || []).length);
  L.push('HÁBITOS');
  const mlD = r => (Number(r.agua) || 0) * (Number(r.vaso_ml) || Number(aj.vaso_ml) || 250) / 1000;
  L.push(`Agua: ${agua.length ? f1(media(agua.map(mlD))) : '—'} litros/día de media en ${agua.length} días con registro (objetivo ${f1((Number(aj.objetivo_ml) || (aj.objetivo_vasos || 8) * (Number(aj.vaso_ml) || 250)) / 1000)} l; vaso de ${aj.vaso_ml || 250} ml)`);
  // Ejercicio
  L.push('', 'EJERCICIO');
  const ejs = ddA.flatMap(f => (((d.registro || {})[f] || {}).ejercicio || []).map(e => ({ f, nombre: e.nombre || 'Ejercicio', min: Number(e.min) || 0 })));
  if (!ejs.length) L.push('Sin ejercicio anotado en el periodo.');
  else {
    const tot = ejs.reduce((a, e) => a + e.min, 0), diasE = new Set(ejs.map(e => e.f)).size;
    L.push(`Días con ejercicio: ${diasE} de ${ddA.length} · Total: ${f0(tot)} min · Media: ${f0(tot / Math.max(1, ddA.length / 7))} min por semana`, 'Actividad | Veces | Minutos');
    const por = {}; for (const e of ejs) { const o = (por[e.nombre] ||= { n: 0, m: 0 }); o.n++; o.m += e.min; }
    L.push(...Object.entries(por).sort((a, b) => b[1].m - a[1].m).map(([n, v]) => `${n} | ${v.n} | ${v.m}`));
  }
  // Dieta
  const FR = [['desayuno', 'Desayuno'], ['media', 'Media mañana'], ['comida', 'Comida'], ['cena', 'Cena']];
  L.push('', 'DIETA (lo anotado en la app)');
  const com = d.comidas || {}, diasCom = ddA.filter(f => com[f] && Object.keys(com[f]).length);
  if (!diasCom.length) L.push('Sin comidas anotadas en el periodo.');
  else {
    L.push(`Días con comidas anotadas: ${diasCom.length}`, 'Franja | Como estaba previsto | Distinto de lo previsto | No comió');
    for (const [k, t] of FR) { const e = diasCom.map(f => (com[f] || {})[k]).filter(Boolean); L.push(`${t} | ${e.filter(x => x.estado === 'comi').length} | ${e.filter(x => x.estado === 'cambie').length} | ${e.filter(x => x.estado === 'no').length}`); }
    const camb = []; for (const f of diasCom.slice().reverse()) for (const [k, t] of FR) { const x = (com[f] || {})[k]; if (x && x.estado === 'cambie') camb.push(`${f} | ${t} | ${x.texto}`); }
    if (camb.length) L.push('', 'Comidas distintas de lo previsto:', 'Fecha | Franja | Qué comió', ...camb);
  }
  const pauta = FR.filter(([k]) => aj['comida_' + k]).map(([k, t]) => `${t} | ${aj['comida_' + k]}`);
  if (pauta.length) L.push('', 'Pauta habitual prevista:', 'Franja | Menú', ...pauta);
  L.push('', 'PREGUNTAS O COMENTARIOS PARA LA CONSULTA', '- ', '- ', '');
  return L.join('\n');
}

// Gráfica de líneas en SVG para el informe impreso. series = [{ nombre, color, pts: [[tiempo_ms, valor], …] }]; refs = [{ y, txt }] líneas de referencia.
function graficaSVG(series, refs = [], unidad = '') {
  const todos = series.flatMap(x => x.pts); if (todos.length < 2) return '';
  const W = 700, H = 210, mi = 46, md = 14, ms = 12, mb = 28;
  const xs = todos.map(p => p[0]), ys = [...todos.map(p => p[1]), ...refs.map(q => q.y)];
  const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  const y0 = Math.floor((Math.min(...ys) - 2) / 5) * 5, paso = Math.max(5, Math.ceil((Math.max(...ys) + 2 - y0) / 4 / 5) * 5), y1 = y0 + 4 * paso;       // marcas del eje en números redondos
  const X = t => mi + (x1 === x0 ? 0.5 : (t - x0) / (x1 - x0)) * (W - mi - md), Y = v => ms + (1 - (v - y0) / (y1 - y0)) * (H - ms - mb);
  const f = n => n.toFixed(1), fd = t => fechaCorta(iso(new Date(t)));
  const ticks = [0, 1, 2, 3, 4].map(i => y0 + (y1 - y0) * i / 4);
  let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width:700px;font:10px Arial,sans-serif">`;
  g += ticks.map(v => `<line x1="${mi}" x2="${W - md}" y1="${f(Y(v))}" y2="${f(Y(v))}" stroke="#e3ddd0"/><text x="${mi - 6}" y="${f(Y(v) + 3)}" text-anchor="end" fill="#555">${Math.round(v * 10) / 10}</text>`).join('');
  g += refs.map(q => `<line x1="${mi}" x2="${W - md}" y1="${f(Y(q.y))}" y2="${f(Y(q.y))}" stroke="#999" stroke-dasharray="5 4"/><text x="${W - md}" y="${f(Y(q.y) - 3)}" text-anchor="end" fill="#777">${q.txt}</text>`).join('');
  for (const se of series) {
    const pts = se.pts.slice().sort((a, b) => a[0] - b[0]);
    g += `<polyline fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" points="${pts.map(p => f(X(p[0])) + ',' + f(Y(p[1]))).join(' ')}"/>`;
    g += pts.map(p => `<circle cx="${f(X(p[0]))}" cy="${f(Y(p[1]))}" r="2.6" fill="${se.color}"/>`).join('');
  }
  g += `<text x="${mi}" y="${H - 8}" fill="#555">${fd(x0)}</text><text x="${W - md}" y="${H - 8}" text-anchor="end" fill="#555">${fd(x1)}</text>`;
  g += `</svg><div style="font-size:9pt;color:#444;margin-bottom:6px">${series.map(se => `<span style="color:${se.color};font-weight:700">●</span> ${se.nombre}`).join(' &nbsp; ')}${unidad ? ' · ' + unidad : ''}</div>`;
  return g;
}
// Las gráficas del informe impreso (periodo de «dias» días): tensión (alta y baja con sus referencias), pulso y peso.
function graficasInforme(dias) {
  const sa = S.datos().salud, fin = hoy(), ini = iso(new Date(Date.now() - (dias - 1) * 86400000)), enP = r => r.fecha >= ini && r.fecha <= fin;
  const ms = r => desdeIso(r.fecha).getTime() + (r.hora ? (Number(r.hora.slice(0, 2)) * 60 + Number(r.hora.slice(3, 5)) - 720) * 60000 : 0);
  const t = sa.tension.filter(enP), p = sa.peso.filter(enP);
  return {
    tension: graficaSVG([{ nombre: 'Sistólica (alta)', color: '#c0392b', pts: t.map(r => [ms(r), r.sis]) }, { nombre: 'Diastólica (baja)', color: '#1f5fa8', pts: t.map(r => [ms(r), r.dia]) }], [{ y: 130, txt: '130' }, { y: 85, txt: '85' }], 'mmHg; líneas de puntos: referencia general, no médica')
      + graficaSVG([{ nombre: 'Pulso', color: '#2e7d4f', pts: t.map(r => [ms(r), r.pulso]) }], [], 'latidos por minuto'),
    peso: graficaSVG([{ nombre: 'Peso', color: '#6a4c93', pts: p.map(r => [ms(r), r.kg]) }], [], 'kg'),
  };
}

function htmlInforme(texto, graficas = {}) {
  const out = [], lineas = texto.split('\n'); let fila = [], seccion = '';
  const cierraSeccion = () => { const g = /^TENSI/.test(seccion) ? graficas.tension : /^PESO/.test(seccion) ? graficas.peso : ''; if (g) out.push(`<div class="grafica">${g}</div>`); };
  const cierra = () => { if (!fila.length) return; const [cab, ...cuerpo] = fila; out.push('<table><thead><tr>' + cab.map(c => `<th>${esc(c)}</th>`).join('') + '</tr></thead><tbody>' + cuerpo.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>'); fila = []; };
  lineas.forEach((l, i) => {
    if (l.includes(' | ')) { fila.push(l.split(' | ').map(x => x.trim())); return; }
    cierra();
    if (!l.trim()) return;
    if (i === 0) out.push(`<h1>${esc(l)}</h1>`);
    else if (/^[A-ZÁÉÍÓÚÑ ]{4,}$/.test(l.replace(/\s*\(.*\)\s*$/, ''))) { cierraSeccion(); seccion = l; out.push(`<h2>${esc(l)}</h2>`); }
    else if (/^- ?/.test(l)) out.push(`<p class="pregunta">${esc(l.replace(/^- ?/, ''))}&nbsp;</p>`);
    else out.push(`<p>${esc(l)}</p>`);
  });
  cierra(); cierraSeccion();
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de seguimiento</title><style>
    @page { size: A4; margin: 16mm 14mm; }
    body { font: 11pt/1.4 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1c1c1c; }
    h1 { font-size: 18pt; margin: 0 0 4px; } h2 { font-size: 12pt; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 2px solid #d61e28; color: #8a1118; break-after: avoid; }
    p { margin: 3px 0; } p.pregunta { border-bottom: 1px solid #999; min-height: 22px; margin-top: 10px; }
    table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 10pt; break-inside: auto; } tr { break-inside: avoid; }
    th, td { border: 1px solid #c9c2b3; padding: 4px 7px; text-align: left; vertical-align: top; } th { background: #e8e1d2; } tbody tr:nth-child(even) td { background: #faf7f0; }
    .grafica { break-inside: avoid; margin: 8px 0 12px; padding: 8px 10px; border: 1px solid #d8d1c2; border-radius: 6px; }
    h1 { border-bottom: 3px solid #d61e28; padding-bottom: 6px; }
  </style></head><body>${out.join('\n')}</body></html>`;
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

// Anotar o editar una tensión. Si la lectura parece rara, antes de guardarla se pregunta (guardar tal cual o repetir la medida con los datos ya puestos).
function abrirT(r, borrador) {
  const s = S.datos().salud;
  abrirHoja(formT(r, borrador), (f, acc) => {
    if (acc === 'borrar') { s.tension = s.tension.filter(x => x !== r); S.guardar(); avisar('Lectura borrada.'); return true; }
    const sis = num(f.sis), dia = num(f.dia), pulso = num(f.pulso);
    if (sis === null || dia === null || pulso === null) { avisar('Faltan datos: alta, baja y pulso.'); return false; }
    if (sis < 60 || sis > 260 || dia < 30 || dia > 160 || pulso < 25 || pulso > 220 || dia >= sis) { avisar('Revisa los números: no parecen una lectura válida.'); return false; }
    const dato = { fecha: f.fecha || hoy(), hora: f.hora || ahora(), sis, dia, pulso, nota: (f.nota || '').trim() };
    const previas = s.tension.filter(x => x !== r && (x.fecha + (x.hora || '')) < (dato.fecha + (dato.hora || ''))).sort(porFecha);
    const ev = evalTension(dato, previas);
    const guardar = () => { if (r) Object.assign(r, dato); else s.tension.push({ id: nuevoId(), ...dato }); S.guardar(); avisar(`${ev.cat}.${ev.lineas[0] ? ' ' + ev.lineas[0] : ''}`); };
    if (ev.nivel !== 'ok') { confirmar({ titulo: 'Revisa esta lectura', texto: textoAlerta(dato, ev), si: 'Guardar de todos modos', no: 'Repetir la medida', alSi: guardar, alNo: () => abrirT(r, dato) }); return true; }
    guardar(); return true;
  });
}
function abrirP(r, borrador) {
  const s = S.datos().salud;
  abrirHoja(formP(r, borrador), (f, acc) => {
    if (acc === 'borrar') { s.peso = s.peso.filter(x => x !== r); S.guardar(); avisar('Peso borrado.'); return true; }
    const kg = num(f.kg); if (kg === null || kg < 30 || kg > 300) { avisar('Revisa el peso en kg.'); return false; }
    const dato = { fecha: f.fecha || hoy(), kg, nota: (f.nota || '').trim() };
    const ep = evalPeso(dato, s.peso.filter(x => x !== r && x.fecha <= dato.fecha).sort(porFecha));
    const guardar = () => { if (r) Object.assign(r, dato); else s.peso.push({ id: nuevoId(), ...dato }); S.guardar(); if (ep.linea) avisar(ep.linea); };
    if (ep.nivel === 'bad') { confirmar({ titulo: 'Revisa este peso', texto: `Peso ${fmt(kg)} kg. ${ep.linea}\n\nEs un cambio muy grande para ese tiempo: puede ser un error (báscula, ropa, hora del día, un decimal mal puesto). Repite la pesada, en ayunas y con la misma báscula, antes de fiarte.\n\nEs una interpretación mecánica, no médica.\n\n¿Guardarlo de todos modos?`, si: 'Guardar de todos modos', no: 'Repetir la pesada', alSi: guardar, alNo: () => abrirP(r, dato) }); return true; }
    guardar(); return true;
  });
}

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
  if (act === 'med') { const m = (S.datos().ajustes.medicinas || []).find(x => x.id === el.dataset.id); if (m) abrirToma(m); return true; }
  if (act === 'sal-informe') {
    const dias = Number(el.dataset.dias) || 30;
    abrirHoja(`<h1>Informe de ${dias} días</h1><p class="sub">Puedes escribir tus preguntas al final antes de copiar o imprimir.</p>
      <textarea name="texto" rows="16" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--card);padding:10px;font-family:monospace;font-size:.78rem">${esc(informe(dias))}</textarea>
      <div class="pila" style="margin-top:8px"><button class="btn main" type="submit" value="imprimir">📄 Guardar como PDF / imprimir (con gráficas)</button><button class="btn" type="submit" value="copiar">Copiar el texto</button></div>
      <p class="det">En «Imprimir», elige «Guardar como PDF» como destino para tenerlo en un archivo.</p>`, (f, acc) => {
      if (acc === 'copiar') { (navigator.clipboard?.writeText(f.texto) || Promise.reject()).then(() => avisar('Informe copiado.')).catch(() => avisar('No se pudo copiar: selecciona el texto a mano.')); return false; }
      if (acc === 'imprimir') { const w = window.open('', '_blank'); if (!w) { avisar('El navegador bloqueó la ventana de impresión.'); return false; } w.document.write(htmlInforme(f.texto, graficasInforme(dias))); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); return false; }
      return true;
    });
    return true;
  }
  if (act === 'sal-tabla') { abrirHoja(`<h1>Últimos 30 días</h1><p class="sub">Selecciona y copia, o enséñalo tal cual.</p><textarea readonly rows="14" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--card);padding:10px;font-family:monospace;font-size:.8rem">${esc(tabla())}</textarea>`, () => true); return true; }
  if (act === 'sal-tension' || act === 'sal-edit-t') { abrirT(act === 'sal-edit-t' ? s.tension.find(x => x.id === el.dataset.id) : null); return true; }
  if (act === 'sal-peso' || act === 'sal-edit-p') { abrirP(act === 'sal-edit-p' ? s.peso.find(x => x.id === el.dataset.id) : null); return true; }
  return false;
}
