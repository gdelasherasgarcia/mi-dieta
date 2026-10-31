// Generador de menús SIN IA: reglas de salud (duras) + puntuación con las prioridades de Gabriel:
// 1) salud · 2) lo que caduca / lo abierto · 3) lo que ya hay en casa · 4) lo que más tiempo lleva sin comer · 5) lo que habría que comprar.
import * as S from './store.js';
import { hoy, desdeIso, iso, diasHasta } from './util.js';
import { GEN } from './nutri_generica.js';
import { caducidadEfectiva } from './producto.js';

const PROT = new Set(['contramuslo', 'pechuga_pollo', 'muslo_pollo', 'conejo', 'pavo']);
const BASICOS = new Set(['aceite', 'ajo', 'cebolla']);                  // se supone que siempre hay en casa
const MAX_POR_PROTEINA = 3, KCAL = [500, 850], PROTE = [42, 70], IDEAL = [600, 800];
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const sumaDias = (f, n) => iso(new Date(desdeIso(f).getTime() + n * 86400000));

export function nutriReceta(rec) {
  let kcal = 0, prot = 0, sal = 0;
  for (const i of rec.ing) { const g = GEN[i.k]; if (!g) continue; kcal += g.kcal * i.g / 100; prot += g.prot * i.g / 100; sal += g.sal * i.g / 100; }
  return { kcal: Math.round(kcal), prot: Math.round(prot), sal: Math.round(sal * 10) / 10 };
}
export const enRango = n => n.kcal >= KCAL[0] && n.kcal <= KCAL[1] && n.prot >= PROTE[0] && n.prot <= PROTE[1];

const valeEseDia = (p, i) => { const c = diasHasta(caducidadEfectiva(p)); return c === null || c >= i; };   // un producto caducado ese día no sirve
function dePila(k) {                                    // productos de casa que sirven para este ingrediente
  const g = GEN[k]; if (!g) return [];
  return S.datos().nevera.filter(p => Number(p.cantidad) > 0 && g.re.test(p.nombre) && !(g.no && g.no.test(p.nombre)));
}
const usosDe = p => (p.racion && p.envase) ? Math.max(1, Math.floor((p.unidad === 'g' ? Number(p.cantidad) : Number(p.cantidad) * Number(p.envase)) / Number(p.racion))) : p.unidad === 'g' ? Math.floor(p.cantidad / 200) : p.unidad === 'kg' ? Math.floor(p.cantidad * 5) : Math.max(1, Math.floor(Number(p.cantidad) + 0.001) || 1);

// Última vez que se comió cada receta (por lo registrado o planeado en días pasados).
function ultimaVez() {
  const d = S.datos(), m = {}, f0 = hoy();
  for (const [f, p] of Object.entries(d.plan || {})) if (f < f0 && p.comida?.receta) m[p.comida.receta] = f > (m[p.comida.receta] || '') ? f : m[p.comida.receta];
  return m;
}

// Propone comida y cena para los días indicados. `dias`: lista de fechas. Devuelve [{f, comida, cena}] sin guardar nada.
export function proponer(dias) {
  const d = S.datos(), f0 = hoy(), recetas = d.recetas.filter(r => r.estado === 'aceptada');
  const ultima = ultimaVez(), usos = new Map(), primerUso = new Map(), propuestas = [], cuentaProt = {}, usadas = new Set();
  const prev = [...dias].map(f => d.plan?.[f]?.comida).filter(Boolean);
  for (const p of prev) if (p.receta) usadas.add(p.receta);
  let protAnt = null, rellenoAnt = null;
  dias.forEach((f, i) => {
    const plan = d.plan?.[f] || {}, reg = d.comidas?.[f] || {}, fijoCom = (plan.comida && !plan.comida.gen) || !!reg.comida?.estado, fijoCen = (plan.cena && !plan.cena.gen) || !!reg.cena?.estado;
    const out = { f, i };
    for (const k of ['comida', 'cena']) if (plan[k] && !plan[k].gen && plan[k].ids) for (const id of plan[k].ids) { const p = d.nevera.find(x => x.id === id); if (p) { usos.set(id, (usos.get(id) ?? usosDe(p)) - 1); if (!primerUso.has(id)) primerUso.set(id, i); } }   // lo fijado a mano también gasta
    // COMIDA
    if (fijoCom || plan.comida?.fuera) { out.comida = null; protAnt = null; }
    else {
      let mejor = null;
      for (const rec of recetas) {
        const n = nutriReceta(rec); if (!enRango(n)) continue;
        if (usadas.has(rec.id)) continue;
        if ((cuentaProt[rec.prot] || 0) >= MAX_POR_PROTEINA) continue;
        let pts = 0; const motivos = [], faltan = [], pilas = [];
        for (const ing of rec.ing) {
          const cand = dePila(ing.k).filter(p => !(p.ubicacion === 'congelador' && i === 0) && valeEseDia(p, i));
          const esProt = PROT.has(ing.k);
          const libre = cand.find(p => (usos.get(p.id) ?? usosDe(p)) > 0 || !esProt);
          if (!libre && BASICOS.has(ing.k)) continue;
          if (!libre) { pts -= esProt ? 14 : 8; faltan.push(GEN[ing.k]?.nom || ing.k); continue; }
          pilas.push({ k: ing.k, p: libre, prot: esProt });
          pts += esProt ? 10 : 6;
          const c = diasHasta(caducidadEfectiva(libre)), parcial = Math.abs(Number(libre.cantidad) % 1) > 0.001;
          if (c !== null && c <= i + 2) { pts += 12; motivos.push(`gasta ${libre.nombre.split(',')[0].toLowerCase()} (caduca pronto)`); }
          else if (libre.abierto || parcial) { pts += 10; motivos.push(`gasta ${libre.nombre.split(',')[0].toLowerCase()} (abierto)`); }
          else if (c !== null && c <= i + 5) pts += 4;
          if (libre.ubicacion === 'congelador' && esProt) { pts += 2; motivos.push(`sacar ${libre.nombre.split(',')[0].toLowerCase()} del congelador el día antes`); }
        }
        const dias_ = ultima[rec.id] ? Math.max(0, Math.round((desdeIso(f0) - desdeIso(ultima[rec.id])) / 86400000)) : 30;
        pts += Math.min(dias_, 30) / 3; if (!ultima[rec.id]) motivos.push('no lo has comido todavía');
        if (rec.prot === protAnt) pts -= 6;
        if (n.kcal >= IDEAL[0] && n.kcal <= IDEAL[1]) pts += 4;
        if (n.sal > 1.5) pts -= 4;
        if (!mejor || pts > mejor.pts) mejor = { rec, n, pts, motivos: [...new Set(motivos)].slice(0, 3), faltan, pilas };
      }
      if (mejor) {
        usadas.add(mejor.rec.id); cuentaProt[mejor.rec.prot] = (cuentaProt[mejor.rec.prot] || 0) + 1; protAnt = mejor.rec.prot;
        for (const x of mejor.pilas) if (x.prot) usos.set(x.p.id, (usos.get(x.p.id) ?? usosDe(x.p)) - 1);
        out.comida = { rec: mejor.rec, n: mejor.n, motivos: mejor.motivos, faltan: mejor.faltan, ids: [...new Set(mejor.pilas.map(x => x.p.id))] };
      } else out.comida = { sinOpcion: true };
    }
    // CENA (tortilla)
    if (fijoCen || plan.cena?.fuera) out.cena = null;
    else {
      const rell = String(d.ajustes.tortilla_rellenos || '').split(',').map(x => x.trim()).filter(Boolean);
      let mj = null;
      for (const nom of rell) {
        const k = /espinac/i.test(nom) ? 'espinacas' : /queso/i.test(nom) ? 'queso' : /jam[oó]n|pavo/i.test(nom) ? 'jamon_pavo' : null; if (!k) continue;
        const abiertoOk = p => { if (!p.dias_abierto || p.abierto) return true; const a = primerUso.get(p.id); return a === undefined || (i - a) < Number(p.dias_abierto); };   // sin abrir: su vida abierto empieza en el primer uso
        const pila = dePila(k).filter(p => valeEseDia(p, i) && (usos.get(p.id) ?? usosDe(p)) > 0 && abiertoOk(p))[0]; let pts = pila ? 6 : -6; const motivos = [];
        if (pila) { const c = diasHasta(caducidadEfectiva(pila)); if (c !== null && c <= i + 2) { pts += 12; motivos.push(`gasta ${pila.nombre.split(',')[0].toLowerCase()} (caduca pronto)`); } else if (pila.abierto) { pts += 10; motivos.push(`gasta ${pila.nombre.split(',')[0].toLowerCase()} (abierto)`); } }
        if (pila && pila.dias_abierto && primerUso.has(pila.id)) { pts += 10; motivos.push(`gasta ${pila.nombre.split(',')[0].toLowerCase()} ya abierto`); }
        if (nom === rellenoAnt) pts -= 8;
        if (!mj || pts > mj.pts) mj = { nom, k, pts, pila, motivos };
      }
      if (mj) { if (mj.pila) { usos.set(mj.pila.id, (usos.get(mj.pila.id) ?? usosDe(mj.pila)) - 1); if (!primerUso.has(mj.pila.id)) primerUso.set(mj.pila.id, i); } rellenoAnt = mj.nom; out.cena = { relleno: mj.nom, ids: mj.pila ? [mj.pila.id] : [], motivos: mj.motivos, faltan: mj.pila ? [] : [GEN[mj.k]?.nom || mj.k] }; }
    }
    propuestas.push(out);
  });
  return propuestas;
}

// Lo que falta en casa para lo que ya hay en el menú (platos con receta o relleno de tortilla), agrupado.
export function faltantes(dias) {
  const d = S.datos(), total = {};
  const add = (k, g, f) => { const t = (total[k] ||= { g: 0, dias: [] }); t.g += g; t.dias.push(f); };
  const gastado = new Map();
  for (const f of dias) {
    const p = d.plan?.[f] || {};
    const rec = p.comida?.receta && d.recetas.find(r => r.id === p.comida.receta);
    if (rec) for (const ing of rec.ing) { if (BASICOS.has(ing.k)) continue; const cand = dePila(ing.k); const tiene = cand.reduce((s, x) => s + 1, 0) > 0; if (!tiene && !(p.comida.ids || []).length) add(ing.k, ing.g, f); else if (!tiene) add(ing.k, ing.g, f); }
    if (p.cena?.relleno) { const k = /espinac/i.test(p.cena.relleno) ? 'espinacas' : /queso/i.test(p.cena.relleno) ? 'queso' : 'jamon_pavo'; if (!dePila(k).length) add(k, 100, f); if (!dePila('huevo').length) add('huevo', 60, f); if (!dePila('cherry').length) add('cherry', 100, f); }
  }
  return Object.entries(total).map(([k, v]) => ({ k, nombre: GEN[k]?.nom || k, g: v.g, dias: v.dias }));
}
