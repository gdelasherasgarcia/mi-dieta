// Recetas nuevas con ayuda de una IA: se piden en tandas de 10 con los criterios del formulario del Menú (salud, proteínas, aparatos, cantidades,
// exclusiones). La IA solo propone; el código comprueba cada receta (ingredientes conocidos, proteínas y alimentos permitidos, aparatos, tiempo,
// calorías y proteína calculadas, sal, duplicados) y las que pasan entran como «pendientes»: no se usan en el menú hasta que las aceptes.
import * as S from './store.js';
import { esc, nuevoId } from './util.js';
import { abrirHoja, avisar } from './ui.js';
import * as IA from './ia.js';
import { htmlCriterios, leerCriterios } from './criterios.js';
import { extraerLista } from './json_ia.js';
import { GEN } from './nutri_generica.js';
import { nutriReceta, enRango } from './generador.js';
import { diasHasta } from './util.js';
import { caducidadEfectiva } from './producto.js';
import { PROT, SALUD, APARATOS, armarOp, vigiladas, corto } from './vistas/menu.js';

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const GRUPO = { contramuslo: 'pollo', pechuga_pollo: 'pollo', muslo_pollo: 'pollo', conejo: 'conejo', pavo: 'pavo', ternera: 'ternera', cerdo: 'cerdo', cordero: 'cordero', merluza: 'pescado_blanco', salmon: 'pescado_azul', sardina: 'pescado_azul', gamba: 'marisco', huevo: 'huevos', lentejas: 'legumbres', garbanzos: 'legumbres', alubias: 'legumbres' };
const TANDA = 10;

function permitidas(F) { return new Set(PROT.map(x => x[0]).filter(k => !Array.isArray(F.prot) || F.prot.includes(k))); }

function promptRecetas(F, n, tanda, total, nombres, prefer = []) {
  const op = armarOp(F, [], ''), perm = permitidas(F), aps = APARATOS.filter(([k]) => !Array.isArray(F.aparatos) || F.aparatos.includes(k));
  const rg = (r, u) => { const [a, b] = (r || []).map(Number); return a && b ? `${a}-${b} ${u}` : a ? `al menos ${a} ${u}` : b ? `como máximo ${b} ${u}` : ''; };
  const ings = Object.entries(GEN).filter(([k]) => !GRUPO[k] || perm.has(GRUPO[k])).map(([k, g]) => `${k} = ${g.nom}`).join('\n');
  const lim = [
    op.salud.length ? `- Condiciones de salud que cumplen todas las recetas a la vez (si chocan, manda la más estricta):\n${op.salud.map(x => '   · ' + x).join('\n')}` : '',
    op.noProt.length ? `- Proteínas: solo ${op.prot.join(', ') || 'las permitidas'}. NO uses ${op.noProt.join(', ')}.` : '',
    op.excl.length ? `- NO uses nunca: ${op.excl.join(', ')}.` : '',
    op.aparatos.length ? `- Aparatos disponibles (solo estos): ${op.aparatos.join(', ')}.` : '',
    op.min ? `- Tiempo máximo: ${op.min} minutos.` : '',
    [rg(F.kcal_p, 'kcal'), rg(F.prot_p, 'de proteína')].filter(Boolean).length ? `- Cada ración: ${[rg(F.kcal_p, 'kcal'), rg(F.prot_p, 'de proteína')].filter(Boolean).join(', ')} (calculado con las cantidades que pongas).` : '',
    F.reglas ? `- Mis reglas propias:\n${String(F.reglas).split('\n').map(x => '   · ' + x.trim()).filter(x => x.length > 5).join('\n')}` : '',
  ].filter(Boolean).join('\n') || '- (sin límites marcados)';
  return `Eres mi asistente de cocina. Hablamos en español, claro y corto. No eres médico: las reglas de salud son mías y de mi profesional sanitario, tú no las cambias. Propón ${n} recetas NUEVAS de COMIDA (plato principal, una ración, para una persona que cocina en casa).

MIS LÍMITES (es todo lo que debes respetar; no añadas restricciones por tu cuenta)
${lim}
- Sin sal añadida en ninguna receta.

INGREDIENTES: solo puedes usar estas claves (clave = nombre). Cantidades en gramos, en crudo, por ración. Usa «aceite» si hay aceite.
${ings}

VARIEDAD: esta es la tanda ${tanda} de ${total}. Reparte proteínas, verduras, guarniciones y aparatos; como mucho 3 recetas con patata; evita platos casi iguales entre sí.
${prefer.length ? `PRIORIDAD: usa preferentemente estos productos que tengo en casa y que caducan pronto o ya están abiertos (en cada receta, al menos uno): ${prefer.join(', ')}. Si una clave de la lista de ingredientes no encaja con ellos, usa la más parecida.\n` : ''}YA TENGO ESTAS RECETAS (no las repitas ni hagas variantes mínimas): ${nombres.slice(-80).join('; ') || '(ninguna)'}.

Cada receta lleva: nombre corto, ingredientes (3 a 6, con clave y gramos), pasos (1 a 3 frases), aparatos (de: ${aps.map(x => x[0]).join(', ')}) y minutos.
Responde SOLO con un bloque JSON, sin texto antes ni después:
{"recetas":[{"nombre":"...","ing":[{"k":"clave","g":200}],"pasos":"...","aparatos":["sarten"],"min":25}]}`;
}

// Comprobación por código de una receta que propone la IA. Devuelve {rec} si vale o {motivo} si no.
export function validarReceta(x, F, existentes, vigil) {
  if (x && typeof x === 'object') x = { ...x, nombre: x.nombre || x.name, pasos: x.pasos || x.preparacion || x.steps || x.instrucciones, aparatos: x.aparatos || x.equipment, min: x.min || x.minutos || x.tiempo, ing: (x.ing || x.ingredientes || x.ingredients || []).map?.(i => i && ({ k: i.k || i.clave || i.key || i.ingrediente, g: i.g ?? i.gramos ?? i.cantidad ?? i.grams })) };
  if (!x || typeof x.nombre !== 'string' || x.nombre.trim().length < 3) return { motivo: 'sin nombre' };
  if (!Array.isArray(x.ing) || x.ing.length < 2 || x.ing.length > 10) return { motivo: 'ingredientes mal formados' };
  const perm = permitidas(F), ing = [];
  for (const i of x.ing) {
    const k = String(i && i.k || '').trim(), g = Number(i && i.g);
    if (!GEN[k]) return { motivo: 'ingrediente desconocido' };
    if (!(g >= 5 && g <= 600)) return { motivo: 'cantidad absurda' };
    if (GRUPO[k] && !perm.has(GRUPO[k])) return { motivo: 'proteína no permitida' };
    ing.push({ k, g: Math.round(g) });
  }
  const aps = Array.isArray(x.aparatos) ? x.aparatos.map(String) : [], validos = new Set(APARATOS.map(a => a[0])), okAp = new Set(APARATOS.filter(([k]) => !Array.isArray(F.aparatos) || F.aparatos.includes(k)).map(a => a[0]));
  if (!aps.length || aps.some(a => !validos.has(a))) return { motivo: 'aparatos mal indicados' };
  if (aps.some(a => !okAp.has(a))) return { motivo: 'aparato que no tienes' };
  const min = Number(x.min) || 30; if (F.min && min > Number(F.min)) return { motivo: 'tarda demasiado' };
  const texto = norm([x.nombre, x.pasos, ...ing.map(i => GEN[i.k].nom)].join(' '));
  for (const w of vigil) if (w.length > 2 && texto.includes(norm(w))) return { motivo: `lleva «${w}»` };
  const rec = { id: 'ia-' + nuevoId(), nombre: x.nombre.trim().slice(0, 90), tipo: 'comida', ing, pasos: String(x.pasos || '').trim().slice(0, 400), aparatos: aps, min, estado: 'pendiente', origen: 'ia' };
  const grupos = ing.filter(i => GRUPO[i.k]).sort((a, b) => b.g * GEN[b.k].prot - a.g * GEN[a.k].prot);
  rec.prot = grupos.length ? GRUPO[grupos[0].k] : 'otra';
  const n = nutriReceta(rec), [k0, k1] = (F.kcal_p || []).map(Number), [p0, p1] = (F.prot_p || []).map(Number), hayRango = k0 || k1 || p0 || p1;
  if (hayRango) { if ((k0 && n.kcal < k0) || (k1 && n.kcal > k1)) return { motivo: 'calorías fuera de rango' }; if ((p0 && n.prot < p0) || (p1 && n.prot > p1)) return { motivo: 'proteína fuera de rango' }; }
  else if (!enRango(n)) return { motivo: 'calorías o proteína fuera de rango' };
  const estricta = (F.salud || []).some(k => k === 'sal' || k === 'tension');
  if (n.sal > (estricta ? 1.5 : 3)) return { motivo: 'demasiada sal' };
  const clave = ing.map(i => i.k).sort().join('|');
  if (existentes.some(e => norm(e.nombre) === norm(rec.nombre) || (e.ing && e.ing.map(i => i.k).sort().join('|') === clave))) return { motivo: 'repetida' };
  return { rec };
}

export function abrirPedirRecetas(alTerminar) {
  const F = S.datos().ajustes.ia_form || {};
  abrirHoja(`<h1>Pedir recetas a la IA</h1>
    <p class="sub">Marca los criterios de la persona. La IA propone, el código comprueba cada receta y las que pasan quedan «pendientes» hasta que las aceptes. Lo que marques aquí se guarda y vale también para «Pedir menú a la IA».</p>
    ${htmlCriterios(F)}
    <h2>Cuántas</h2><div class="card"><label class="campo"><span>¿Cuántas recetas?</span><select name="n">${[10, 20, 30, 50].map(v => `<option value="${v}" ${v === 50 ? 'selected' : ''}>${v}${v === 50 ? ' (unas 5 peticiones, 2-5 minutos)' : ''}</option>`).join('')}</select></label></div>
    <div class="fila" style="margin-top:10px"><button class="btn main grow" type="submit" value="pedir">⚡ Pedir</button></div>${IA.pieIA()}`, f => {
    const r = leerCriterios(f, S.datos().ajustes.ia_form || {}); if (r.error) { avisar(r.error); return false; }
    S.datos().ajustes.ia_form = r.F; S.guardar();
    const n = Math.min(50, Math.max(TANDA, Number(f.n) || 50)); setTimeout(() => ejecutar(n, alTerminar), 0); return true;
  });
}

async function ejecutar(n, alTerminar, prefer = [], alFinal = null) {
  const d = S.datos(), F = d.ajustes.ia_form || {}, total = Math.ceil(n / TANDA), vigil = vigiladas(F), rechazos = {};
  let nuevas = 0, fallos = 0, recibidas = 0, parado = '';
  for (let t = 1; t <= total; t++) {
    avisar(`Recetas recibidas: ${recibidas} de ${n} · faltan ${Math.max(0, n - recibidas)} · válidas ${nuevas}. Pidiendo la tanda ${t} de ${total}…`, 90000);
    let r;
    try {
      const texto = await IA.preguntar(promptRecetas(F, TANDA, t, total, d.recetas.map(x => x.nombre), prefer), { json: true });
      const lista = extraerLista(texto, ['recetas', 'recipes', 'recetas_nuevas', 'platos'], x => x && typeof x === 'object' && (x.nombre || x.name) && (x.ing || x.ingredientes || x.ingredients));       // acepta la lista suelta, otra clave, una sola receta o una respuesta cortada
      if (!lista.length) throw new Error('La respuesta no trae recetas que pueda leer. Empieza así: «' + String(texto).replace(/\s+/g, ' ').slice(0, 160) + '»');
      r = { recetas: lista };
    } catch (e) { if (++fallos >= 2) { parado = `Se paró en la tanda ${t}: ${e.message}`; break; } t--; continue; }
    recibidas += r.recetas.length;
    for (const x of r.recetas) { const v = validarReceta(x, F, d.recetas, vigil); if (v.rec) { d.recetas.push(v.rec); nuevas++; } else rechazos[v.motivo] = (rechazos[v.motivo] || 0) + 1; }
    if (nuevas && alTerminar) { alTerminar(); alTerminar = null; }
    S.guardar();
  }
  const rech = Object.entries(rechazos).sort((a, b) => b[1] - a[1]), nrech = rech.reduce((s, x) => s + x[1], 0);
  if (alFinal) setTimeout(alFinal, 0);
  if (parado && !nuevas && !nrech) avisar(`${parado}. Llevas 0 recetas nuevas.`, 15000);
  else if (nuevas || nrech) avisar(`Pedidas ${n}, recibidas ${recibidas}${recibidas < n ? ` (faltan ${n - recibidas})` : ''}. ${nuevas} recetas válidas, pendientes de revisar.${nrech ? ` El código descartó ${nrech}: ${rech.slice(0, 3).map(x => `${x[0]} (${x[1]})`).join(', ')}.` : ''}${parado ? ' ' + parado + '.' : ''}`, 15000);
}

// Desde «Elegir del recetario»: pide una tanda de recetas pensadas para gastar lo que caduca pronto o está abierto.
export function pedirNuevasPrioritarias(alFinal) {
  const d = S.datos(), F = d.ajustes.ia_form || {}, N = Number(F.diasCaduca) > 0 ? Number(F.diasCaduca) : 14;
  if (!IA.configurada()) { avisar('Conecta una IA en Más para pedirle recetas.'); return; }
  const prefer = d.nevera.filter(p => Number(p.cantidad) > 0).map(p => ({ nom: corto(p.nombre), n: diasHasta(caducidadEfectiva(p)), ab: !!p.abierto || Math.abs(Number(p.cantidad) % 1) > 0.001 }))
    .filter(x => (x.n !== null && x.n >= 0 && x.n <= N) || x.ab).sort((a, b) => (a.n ?? 999) - (b.n ?? 999)).slice(0, 8).map(x => x.nom);
  setTimeout(() => ejecutar(TANDA, null, prefer, alFinal), 0);
}
