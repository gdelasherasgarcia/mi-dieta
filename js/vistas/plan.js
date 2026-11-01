// «Mañana» en Hoy: lo que se piensa comer y el aviso de sacar del congelador a la nevera el día antes.
import * as S from '../store.js';
import { esc, hoy, desdeIso, iso, fechaCorta } from '../util.js';
import { abrirHoja, campo, avisar } from '../ui.js';

const sumaDias = (f, n) => iso(new Date(desdeIso(f).getTime() + n * 86400000));
const planDe = f => ((S.datos().plan ||= {})[f] ||= {});

// Productos congelados que hay que sacar hoy: los de la comida prevista para mañana (y los de hoy, si aún siguen congelados).
function porSacar() {
  const d = S.datos(), ids = new Set([...(planDe(sumaDias(hoy(), 1)).comida?.ids || []), ...(planDe(hoy()).comida?.ids || [])]);
  return d.nevera.filter(p => ids.has(p.id) && p.ubicacion === 'congelador');
}

// ¿A qué comida corresponde el aviso? (para que se vea si ya no es lo que has planeado)
function paraQue(p) {
  const man = sumaDias(hoy(), 1), pm = planDe(man).comida, ph = planDe(hoy()).comida;
  if (pm && (pm.ids || []).includes(p.id)) return `la comida de mañana («${(pm.texto || '').slice(0, 40)}»)`;
  if (ph && (ph.ids || []).includes(p.id)) return `la comida de hoy («${(ph.texto || '').slice(0, 40)}»)`;
  return 'la comida prevista';
}

export function render() {
  const man = sumaDias(hoy(), 1), pm = planDe(man).comida, sacar = porSacar();
  return `
    <h2>Mañana</h2>
    ${sacar.map(p => `<div class="item alerta"><div class="grow"><div class="nom">Saca del congelador: ${esc(p.nombre)}</div>
      <div class="det">Pásalo hoy a la nevera para ${esc(paraQue(p))}.</div></div>
      <button type="button" class="btn mini" data-act="plan-sacar" data-id="${esc(p.id)}">Ya lo saqué</button>
      <button type="button" class="btn mini" data-act="plan-nousar" data-id="${esc(p.id)}">No lo uso</button></div>`).join('')}
    <div class="item" style="display:block">
      <div class="fila sep"><span class="nom">Comida de mañana</span><span class="chip">${esc(fechaCorta(man))}</span></div>
      <div class="det" style="margin:2px 0 8px">${pm && pm.texto ? esc(pm.texto) : 'Sin planear. Si va a ser algo congelado, avísame aquí y te recuerdo sacarlo.'}</div>
      <button type="button" class="btn mini" style="width:100%" data-act="plan-comida">${pm && pm.texto ? 'Cambiar' : 'Planear la comida de mañana'}</button>
    </div>`;
}

export function acciones(act, el) {
  const d = S.datos(), man = sumaDias(hoy(), 1);
  if (act === 'plan-nousar') {                                                // ya no lo voy a usar: se quita de la comida de hoy y de mañana y deja de recordarlo
    for (const f of [man, hoy()]) { const c = planDe(f).comida; if (c && c.ids) c.ids = c.ids.filter(i => i !== el.dataset.id); }
    S.guardar(); avisar('Hecho: ya no te lo recordaré.'); return true;
  }
  if (act === 'plan-sacar') {
    const p = d.nevera.find(x => x.id === el.dataset.id); if (!p) return true;
    p.ubicacion = 'nevera'; p.caducidad = sumaDias(hoy(), 2); p.nota = [p.nota, `descongelado el ${fechaCorta(hoy())}`].filter(Boolean).join(' · ');
    S.guardar(); avisar(`«${p.nombre.slice(0, 30)}» pasa a la nevera: consúmelo en 2 días.`); return true;
  }
  if (act === 'plan-comida') {
    const pm = planDe(man).comida, marc = new Set(pm?.ids || []);
    const lista = d.nevera.slice().sort((a, b) => (a.ubicacion === 'congelador' ? 0 : 1) - (b.ubicacion === 'congelador' ? 0 : 1) || a.nombre.localeCompare(b.nombre, 'es'));
    abrirHoja(`<h1>Comida de mañana</h1><p class="sub">Elige lo de casa que vas a usar. Si algo está congelado, hoy te aviso para sacarlo.</p>
      ${campo('¿Qué vas a comer?', `<input name="texto" value="${esc(pm?.texto || '')}" autocomplete="off" placeholder="p. ej. contramuslo con ensalada">`)}
      <div class="card" style="max-height:38vh;overflow:auto">${lista.map(p => `<label class="fila" style="min-height:44px"><input type="checkbox" name="i_${esc(p.id)}" value="1" ${marc.has(p.id) ? 'checked' : ''} style="width:24px;height:24px"> <span>${esc(p.nombre.slice(0, 48))} <span class="det">(${esc(p.ubicacion)}, ${esc(p.cantidad)} ${esc(p.unidad)})</span></span></label>`).join('')}</div>
      <div class="fila" style="margin-top:10px"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
      ${pm ? '<button class="btn peligro grande" style="margin-top:10px" type="submit" value="borrar">Quitar el plan</button>' : ''}`, (f, acc) => {
      if (acc === 'borrar') { delete planDe(man).comida; S.guardar(); return true; }
      const ids = d.nevera.filter(p => f['i_' + p.id] === '1').map(p => p.id);
      const texto = (f.texto || '').trim() || ids.map(i => d.nevera.find(p => p.id === i)?.nombre.split(',')[0]).join(', ');
      if (!texto && !ids.length) { avisar('Apunta qué vas a comer o marca algo de casa.'); return false; }
      planDe(man).comida = { texto, ids }; S.guardar(); return true;
    });
    return true;
  }
  return false;
}
