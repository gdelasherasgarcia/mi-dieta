// «Elegir del recetario» para un día: las recetas ordenadas según tus criterios (ver ranking.js), cada una con sus motivos.
// Se elige una (se puede retocar el texto y completar la proteína con yogur o huevo), o se piden nuevas a la IA con lo que caduca.
import * as S from './store.js';
import { esc, diaSemana, fechaCorta } from './util.js';
import { abrirHoja, avisar } from './ui.js';
import * as IA from './ia.js';
import { GEN } from './nutri_generica.js';
import { ordenarParaDia, dePila } from './ranking.js';
import { caducidadEfectiva } from './producto.js';
import { diasHasta } from './util.js';

const APARATO = { sarten: 'sartén', horno: 'horno', microondas: 'microondas', freidora: 'freidora de aire', batidora: 'batidora', olla: 'olla', crudo: 'sin cocinar' };
const chip = c => `<span class="chip ${c.tipo === 'warn' ? 'warn' : ''}" style="margin:2px 4px 2px 0">${esc(c.t)}</span>`;
const plan = f => ((S.datos().plan ||= {})[f] ||= {});

export function abrirElegirReceta(f, despues, todas = false) {
  const lista = ordenarParaDia(f), buenas = lista.filter(x => !x.fallos.length), malas = lista.filter(x => x.fallos.length), ver = todas ? buenas : buenas.slice(0, 12);
  const fila = x => `<button type="submit" value="ver:${esc(x.rec.id)}" class="item" style="width:100%;text-align:left;margin-bottom:8px;display:block">
      <span class="nom" style="display:block">${esc(x.rec.nombre)}</span>
      <span class="det" style="display:block">${x.n.kcal} kcal · ${x.n.prot} g proteína · ${esc(x.rec.min)} min · ${esc((x.rec.aparatos || []).map(a => APARATO[a] || a).join(', '))}</span>
      <span style="display:block;margin-top:4px">${x.chips.slice(0, 5).map(chip).join('')}</span></button>`;
  abrirHoja(`<h1>Elegir del recetario</h1><p class="sub">${esc(diaSemana(f))} ${esc(fechaCorta(f))} · ordenadas por tus criterios: lo que caduca pronto y lo que está abierto primero.</p>
    ${IA.configurada() ? '<button type="submit" class="btn grande" value="ia" style="margin-bottom:10px">⚡ Pedir recetas nuevas a la IA (con lo que caduca)</button>' : ''}
    ${ver.map(fila).join('') || '<div class="card vacio">Ninguna receta cumple tus límites para ese día.</div>'}
    ${!todas && buenas.length > ver.length ? `<button type="submit" class="btn grande" value="todas" style="margin-bottom:10px">Ver las ${buenas.length} que cumplen</button>` : ''}
    ${malas.length ? `<details><summary style="min-height:44px;display:flex;align-items:center;font-weight:700">No cumplen tus límites (${malas.length})</summary>${malas.map(x => `<button type="submit" value="ver:${esc(x.rec.id)}" class="item" style="width:100%;text-align:left;margin-bottom:8px;display:block;opacity:.6"><span class="nom" style="display:block">${esc(x.rec.nombre)}</span><span class="chip warn">${esc(x.fallos.join(' · '))}</span></button>`).join('')}</details>` : ''}`,
    (g, acc) => {
      if (acc.startsWith('ver:')) setTimeout(() => abrirFicha(f, acc.slice(4), despues), 0);
      else if (acc === 'todas') setTimeout(() => abrirElegirReceta(f, despues, true), 0);
      else if (acc === 'ia') setTimeout(() => import('./recetas_ia.js').then(m => m.pedirNuevasPrioritarias(() => abrirElegirReceta(f, despues))), 0);
      return true;
    });
}

function abrirFicha(f, id, despues) {
  const d = S.datos(), x = ordenarParaDia(f).find(y => y.rec.id === id); if (!x) return;
  const rec = x.rec, usa = rec.ing.map(i => ({ i, p: dePila(i.k).slice().sort((a, b) => (diasHasta(caducidadEfectiva(a)) ?? 999) - (diasHasta(caducidadEfectiva(b)) ?? 999))[0] || null }));
  abrirHoja(`<h1>${esc(rec.nombre)}</h1><p class="sub">${x.n.kcal} kcal · ${x.n.prot} g de proteína (estimado) · ${esc(rec.min)} min</p>
    <div style="margin-bottom:8px">${x.chips.map(chip).join('')}</div>
    ${x.fallos.length ? `<div class="card" style="border-color:var(--bad)"><b>No cumple tus límites:</b> ${esc(x.fallos.join(' · '))}</div>` : ''}
    <h2>Ingredientes (por ración, en crudo)</h2><ul style="padding-left:20px">${usa.map(({ i, p }) => `<li>${esc(GEN[i.k]?.nom || i.k)}: ${i.g} g ${['aceite', 'ajo', 'cebolla'].includes(i.k) ? '' : p ? `<span class="det">· en casa (${esc(p.nombre.split(',')[0].slice(0, 30))})</span>` : '<span class="chip warn">no lo tienes</span>'}</li>`).join('')}</ul>
    <h2>Cómo se hace</h2><p>${esc(rec.pasos || '')}</p>
    ${x.compl ? `<label class="fila" style="min-height:44px"><input type="checkbox" name="compl" value="1" checked style="width:24px;height:24px"> <span>Completar con ${esc(x.compl.txt)} (+${x.compl.prot} g de proteína)</span></label>` : ''}
    <label class="campo"><span>Cómo lo apuntas (puedes cambiarlo)</span><input name="texto" value="${esc(rec.nombre)}" autocomplete="off"></label>
    <div class="fila" style="margin-top:10px"><button class="btn main grow" type="submit" value="usar">Usar ese día</button><button class="btn grow" type="submit" value="volver">Volver a la lista</button></div>
    ${rec.estado === 'pendiente' ? '<p class="det">Es nueva: al usarla se acepta en el recetario.</p><button class="btn peligro grande" type="submit" value="descartar" style="margin-top:6px">Descartar esta receta</button>' : ''}`,
    (g, acc) => {
      if (acc === 'volver') { setTimeout(() => abrirElegirReceta(f, despues), 0); return true; }
      if (acc === 'descartar') { rec.estado = 'descartada'; S.guardar(); setTimeout(() => abrirElegirReceta(f, despues), 0); return true; }
      const compl = x.compl && g.compl === '1' ? x.compl : null, ids = [...new Set([...usa.filter(u => u.p && !['aceite', 'ajo', 'cebolla'].includes(u.i.k)).map(u => u.p.id), ...(compl ? compl.ids : [])])];
      const texto = ((g.texto || '').trim() || rec.nombre) + (compl && !/yogur|huevo/i.test(g.texto || '') ? ` + ${compl.txt}` : '');
      if (rec.estado === 'pendiente') rec.estado = 'aceptada';
      plan(f).comida = { texto, ids, receta: rec.id, fuera: false }; S.guardar(); avisar('Comida apuntada en el menú.');
      if (despues) setTimeout(() => despues(plan(f).comida), 0);
      return true;
    });
}
