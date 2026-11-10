// Gasto del almacén: al comer algo de casa, se descuenta (todo, la mitad, un cuarto o una cantidad). Lo que queda se marca como abierto.
import * as S from './store.js';
import { esc, hoy } from './util.js';
import { abrirHoja, avisar } from './ui.js';

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const STOP = new Set(['bolsa', 'paquete', 'sobre', 'eroski', 'natur', 'natural', 'fresco', 'fresca', 'media', 'medio', 'bandeja', 'botella']);
const toks = s => norm(s).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(t => t.length >= 5 && !STOP.has(t)).map(t => t.slice(0, 5));
const OPC = [['0', 'Nada'], ['u', 'Una unidad (1)'], ['1', 'Todo'], ['0.5', 'La mitad'], ['0.25', 'Un cuarto'], ['x', 'Otra cantidad']];
const diasAbierto = n => /ensalada|lechuga|sobre|bolsa|pavo|pollo|conejo|carne|pescado|merluza|brocoli|brócoli|yogur|queso/i.test(n) ? (/ensalada|lechuga|sobre/i.test(n) ? 1 : 3) : 5;

export const fraccion = n => { const x = Number(n); if (Math.abs(x - 0.5) < 0.01) return 'la mitad'; if (Math.abs(x - 0.25) < 0.01) return 'un cuarto'; if (Math.abs(x - 0.75) < 0.01) return 'tres cuartos'; return String(Math.round(x * 100) / 100).replace('.', ','); };

export function candidatos(texto) {
  const t = new Set(toks(texto));
  return S.datos().nevera.filter(p => !p.sin_cuenta && p.ubicacion !== 'congelador' && toks(p.nombre).some(x => t.has(x)));
}

const UNIDADES = new Set(['ud', 'lonchas', 'raciones', 'paquete', 'bote', 'bolsa']);
const defecto = p => UNIDADES.has(p.unidad) ? 'u' : '1';                  // lo previsto: una unidad si se cuenta por unidades; si no, todo
const fila = (p, pref) => `<div class="card" style="margin-bottom:8px"><div class="fila sep"><b>${esc(p.nombre)}</b><span class="det">${esc(p.cantidad)} ${esc(p.unidad)}</span></div>
  <div class="dos"><label class="campo" style="margin:6px 0 0"><span>¿Cuánto has gastado?</span><select name="g_${esc(p.id)}">${OPC.map(([v, t]) => `<option value="${v}" ${v === pref ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
  <label class="campo" style="margin:6px 0 0"><span>Cantidad exacta (${esc(p.unidad)})</span><input name="q_${esc(p.id)}" type="number" inputmode="decimal" min="0" step="any" placeholder="solo si «Otra»"></label></div></div>`;

// Pregunta qué se gastó del almacén al comer `texto`. Si no hay nada que encaje, no molesta (solo ofrece elegir uno).
// Con `ids` (los productos que se habían previsto en el menú) salen ya elegidos; sin ellos se buscan por el nombre de lo comido.
export function abrirGasto(texto, ids = null) {
  const d = S.datos(), previstos = ids ? ids.map(i => d.nevera.find(p => p.id === i)).filter(p => p && !p.sin_cuenta) : null;
  const huevos = /tortilla|huevo/i.test(texto) ? d.nevera.filter(p => !p.sin_cuenta && /huevo/i.test(p.nombre)).sort((a, b) => String(a.caducidad || '9999').localeCompare(String(b.caducidad || '9999'))) : [];          // una tortilla gasta huevo aunque el menú no lo tuviera previsto
  const cands = previstos ? [...previstos, ...huevos.filter(h => !previstos.includes(h))] : [...new Set([...huevos, ...candidatos(texto)])].slice(0, 5);
  const otros = d.nevera.filter(p => !p.sin_cuenta && p.ubicacion !== 'congelador' && !cands.includes(p)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  abrirHoja(`<h1>${previstos ? '¿Descontamos lo previsto?' : '¿Qué has gastado de casa?'}</h1><p class="sub">${esc(texto)}</p>${previstos ? '<p class="det">Esto es lo que tenías previsto usar del almacén. Confirma o ajusta las cantidades.</p>' : ''}
    ${cands.map(p => fila(p, huevos[0] === p ? 'u' : huevos.includes(p) ? '0' : previstos ? defecto(p) : '0')).join('') || '<div class="card vacio" style="margin:0 0 8px">No veo nada del almacén en lo que comiste.</div>'}
    <label class="campo"><span>Otro producto de casa (opcional)</span><select name="otro"><option value="">— ninguno —</option>${otros.map(p => `<option value="${esc(p.id)}">${esc(p.nombre.slice(0, 50))} (${esc(p.cantidad)} ${esc(p.unidad)})</option>`).join('')}</select></label>
    <label class="campo"><span>¿Cuánto del otro?</span><select name="g_otro">${OPC.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
    <label class="campo"><span>Cantidad exacta del otro</span><input name="q_otro" type="number" inputmode="decimal" min="0" step="any"></label>
    <div class="fila"><button class="btn main grow" type="submit" value="guardar">Descontar del almacén</button><button class="btn grow" type="submit" value="nada">No descontar</button></div>`, (f, acc) => {
    if (acc === 'nada') return true;
    const partes = [], lista = cands.map(p => [p, f['g_' + p.id], f['q_' + p.id]]);
    if (f.otro) { const p = d.nevera.find(x => x.id === f.otro); if (p) lista.push([p, f.g_otro, f.q_otro]); }
    for (const [p, op, q] of lista) {
      const cant = Number(p.cantidad); let usado = op === 'x' ? Number(String(q || '').replace(',', '.')) || 0 : op === 'u' ? 1 : Number(op) * cant;
      if (!usado) continue;
      if (usado >= cant - 0.0001) { d.nevera = d.nevera.filter(x => x !== p); partes.push(`${p.nombre.slice(0, 28)}: todo`); }
      else { p.cantidad = Math.round((cant - usado) * 1000) / 1000; if (!p.abierto) p.abierto = hoy(); if (!p.dias_abierto) p.dias_abierto = diasAbierto(p.nombre); partes.push(`${p.nombre.slice(0, 28)}: queda ${fraccion(p.cantidad / cant)}`); }
    }
    S.guardar(); if (partes.length) avisar(partes.join(' · ')); return true;
  });
}
