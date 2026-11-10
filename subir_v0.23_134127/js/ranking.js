// Ordena el recetario para un día concreto según los criterios del formulario del Menú y lo que hay en casa.
// Cada receta recibe puntos por lo que cumple (con el motivo, para enseñarlo) y las que no cumplen tus límites van al final.
// Criterios por orden de peso: caduca pronto · envase abierto / legumbres a medias · lo que ya hay en casa · variedad · gustos.
import * as S from './store.js';
import { hoy, desdeIso, iso, diasHasta } from './util.js';
import { GEN } from './nutri_generica.js';
import { nutriReceta, enRango } from './generador.js';
import { caducidadEfectiva } from './producto.js';
import { PROT, APARATOS, vigiladas, corto } from './vistas/menu.js';

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const sumaDias = (f, n) => iso(new Date(desdeIso(f).getTime() + n * 86400000));
const BASICOS = new Set(['aceite', 'ajo', 'cebolla']);
const GRUPO = { contramuslo: 'pollo', pechuga_pollo: 'pollo', muslo_pollo: 'pollo', conejo: 'conejo', pavo: 'pavo', ternera: 'ternera', cerdo: 'cerdo', cordero: 'cordero', merluza: 'pescado_blanco', salmon: 'pescado_azul', sardina: 'pescado_azul', gamba: 'marisco', huevo: 'huevos', lentejas: 'legumbres', garbanzos: 'legumbres', alubias: 'legumbres' };
const LEGUMBRES = new Set(['lentejas', 'garbanzos', 'alubias']);

export const dePila = k => { const g = GEN[k]; if (!g) return []; return S.datos().nevera.filter(p => Number(p.cantidad) > 0 && g.re.test(p.nombre) && !(g.no && g.no.test(p.nombre))); };
const parcial = p => Math.abs(Number(p.cantidad) % 1) > 0.001;
const grupoDe = rec => { const g = rec.ing.filter(i => GRUPO[i.k]).sort((a, b) => b.g * GEN[b.k].prot - a.g * GEN[a.k].prot)[0]; return g ? GRUPO[g.k] : (rec.prot || null); };
const tiene = (rec, k) => rec.ing.some(i => i.k === k);

// Complementos que suben la proteína de un plato con lo que hay en casa (yogur de proteína, huevo duro).
export function complementosPara(rec, minProt) {
  const n = nutriReceta(rec); if (!minProt || n.prot >= minProt) return null;
  const opciones = [];
  const yog = dePila('yogur_prot')[0], hue = dePila('huevo').filter(p => Number(p.cantidad) >= 1)[0];
  if (yog) opciones.push({ txt: 'yogur de proteína', prot: 12, kcal: 75, ids: [yog.id] });
  if (hue) opciones.push({ txt: 'un huevo duro', prot: 8, kcal: 80, ids: [hue.id] });
  if (yog && hue) opciones.push({ txt: 'yogur de proteína y un huevo duro', prot: 20, kcal: 155, ids: [yog.id, hue.id] });
  return opciones.find(o => n.prot + o.prot >= minProt) || null;
}

// Devuelve las recetas (aceptadas y pendientes) ordenadas para el día f: [{rec, n, pts, chips:[{t, tipo}], falla, compl}]
export function ordenarParaDia(f) {
  const d = S.datos(), F = d.ajustes.ia_form || {}, f0 = hoy(), i = Math.max(0, Math.round((desdeIso(f) - desdeIso(f0)) / 86400000));
  const N = Number(F.diasCaduca) > 0 ? Number(F.diasCaduca) : 14, vigil = vigiladas(F), perm = new Set(PROT.map(x => x[0]).filter(k => !Array.isArray(F.prot) || F.prot.includes(k)));
  const okAp = new Set(APARATOS.filter(([k]) => !Array.isArray(F.aparatos) || F.aparatos.includes(k)).map(a => a[0]));
  const cat = d.catalogo || [], gustan = (F.gustan || []).map(id => cat.find(p => p.id === id)).filter(Boolean).map(p => norm(corto(p.nombre)));
  const recetas = d.recetas.filter(r => r.estado === 'aceptada' || r.estado === 'pendiente');
  const porId = new Map(d.recetas.map(r => [r.id, r]));
  const ayer = porId.get(d.plan?.[sumaDias(f, -1)]?.comida?.receta), grupoAyer = ayer ? grupoDe(ayer) : null;
  const periodo = []; for (let j = 0; j < 7; j++) { const dia = sumaDias(f0, j); if (dia === f) continue; const r = porId.get(d.plan?.[dia]?.comida?.receta); if (r) periodo.push(r); }
  const ultima = {}; for (const [dia, p] of Object.entries(d.plan || {})) if (dia < f0 && p.comida?.receta) ultima[p.comida.receta] = dia > (ultima[p.comida.receta] || '') ? dia : ultima[p.comida.receta];
  const patataEnPeriodo = periodo.filter(r => tiene(r, 'patata')).length;
  const minProt = Number((F.prot_p || [])[0]) || 0;
  const [k0, k1] = (F.kcal_p || []).map(Number), [p0, p1] = (F.prot_p || []).map(Number), hayRango = k0 || k1 || p0 || p1;
  const estricta = (F.salud || []).some(k => k === 'sal' || k === 'tension');
  const salida = [];
  for (const rec of recetas) {
    const n = nutriReceta(rec), chips = [], fallos = []; let pts = 0;
    // — límites duros —
    const g = grupoDe(rec); if (rec.ing.some(x => GRUPO[x.k] && !perm.has(GRUPO[x.k]))) fallos.push('proteína que no quieres');
    const texto = norm([rec.nombre, rec.pasos, ...rec.ing.map(x => GEN[x.k]?.nom)].join(' ')); const mala = vigil.find(w => w.length > 2 && texto.includes(norm(w))); if (mala) fallos.push(`lleva «${mala}»`);
    if ((rec.aparatos || []).some(a => !okAp.has(a))) fallos.push('aparato que no tienes');
    if (F.min && Number(rec.min) > Number(F.min)) fallos.push('tarda demasiado');
    const compl = complementosPara(rec, minProt);
    const protOk = hayRango ? !((p0 && n.prot < p0 && !compl) || (p1 && n.prot > p1)) : enRango(n);
    const kcalOk = hayRango ? !((k0 && n.kcal < k0) || (k1 && n.kcal > k1)) : (n.kcal >= 500 && n.kcal <= 850);
    if (!protOk) fallos.push('proteína fuera de rango'); if (!kcalOk) fallos.push('calorías fuera de rango');
    if (n.sal > (estricta ? 1.5 : 3)) fallos.push('mucha sal');
    // — caducidad, abiertos y casa —
    const usados = new Set(); let faltan = [], casa = 0;
    for (const ing of rec.ing) {
      if (BASICOS.has(ing.k)) continue;
      const stock = dePila(ing.k).filter(p => { const c = diasHasta(caducidadEfectiva(p)); return c === null || c >= i; });
      if (!stock.length) { faltan.push(GEN[ing.k].nom.split(' (')[0].toLowerCase()); pts -= GRUPO[ing.k] ? 8 : 3; continue; }
      casa++; pts += 4;
      const p = stock.slice().sort((a, b) => (diasHasta(caducidadEfectiva(a)) ?? 999) - (diasHasta(caducidadEfectiva(b)) ?? 999))[0], c = diasHasta(caducidadEfectiva(p)), nom = corto(p.nombre).toLowerCase().slice(0, 28);
      if (c !== null && c <= N && !usados.has('c' + p.id)) { usados.add('c' + p.id); pts += 12 + Math.round(24 * (N - c) / N); chips.push({ t: `gasta ${nom} (caduca en ${c} d)`, tipo: c <= 3 ? 'warn' : 'ok' }); }
      if ((p.abierto || parcial(p)) && !usados.has('a' + p.id)) { usados.add('a' + p.id); pts += 20; chips.push({ t: `gasta ${nom} (abierto)`, tipo: 'ok' }); }
    }
    if (faltan.length) chips.push({ t: `falta: ${faltan.slice(0, 3).join(', ')}`, tipo: 'warn' }); else chips.push({ t: 'todo en casa', tipo: 'ok' });
    // — legumbres: si ayer se abrió un bote, hoy toca la otra mitad —
    if (ayer && ayer.ing.some(x => LEGUMBRES.has(x.k)) && rec.ing.some(x => LEGUMBRES.has(x.k))) { pts += 25; chips.push({ t: 'termina el bote de legumbres de ayer', tipo: 'ok' }); }
    else if (rec.ing.some(x => LEGUMBRES.has(x.k)) && !(ayer && ayer.ing.some(x => LEGUMBRES.has(x.k))) && F.envases !== false) { const sigueDia = porId.get(d.plan?.[sumaDias(f, 1)]?.comida?.receta); if (!(sigueDia && sigueDia.ing.some(x => LEGUMBRES.has(x.k)))) chips.push({ t: 'abre un bote: falta la otra mitad mañana', tipo: 'warn' }); }
    // — variedad —
    if (F.protDistinta !== false && g && g === grupoAyer) { pts -= 30; chips.push({ t: 'misma proteína que ayer', tipo: 'warn' }); }
    if (F.variar !== false && tiene(rec, 'patata')) {
      if (ayer && tiene(ayer, 'patata')) { pts -= 15; chips.push({ t: 'patata dos días seguidos', tipo: 'warn' }); }
      else if (patataEnPeriodo >= 3) { pts -= 10; chips.push({ t: 'ya hay mucha patata esta semana', tipo: 'warn' }); }
    }
    if (periodo.some(r => r.id === rec.id)) { pts -= 40; chips.push({ t: 'ya está en otro día', tipo: 'warn' }); }
    const dias_ = ultima[rec.id] ? Math.round((desdeIso(f0) - desdeIso(ultima[rec.id])) / 86400000) : 30; pts += Math.min(dias_, 30) / 3;
    // — gustos —
    const gu = gustan.filter(x => x.length > 3 && texto.includes(x)).length; if (gu) { pts += Math.min(gu, 2) * 4; chips.push({ t: 'lleva algo que te gusta', tipo: 'ok' }); }
    if (compl) chips.push({ t: `completa con ${compl.txt} (+${compl.prot} g de proteína)`, tipo: 'ok' });
    if (rec.estado === 'pendiente') chips.push({ t: 'nueva (sin aceptar)', tipo: 'warn' });
    salida.push({ rec, n, pts: fallos.length ? -1000 + pts : pts, chips, fallos, compl });
  }
  return salida.sort((a, b) => b.pts - a.pts || a.rec.nombre.localeCompare(b.rec.nombre, 'es'));
}
