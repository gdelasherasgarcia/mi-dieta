// Reglas comunes de un producto de la despensa: caducidad real (la más cercana entre la del envase y la de «abierto hace N días»)
// y migración de las notas escritas a mano (tamaño del envase y sal por 100 g) a campos propios.
import { desdeIso, iso } from './util.js';

export function caducidadEfectiva(p) {
  const c = [];
  if (p.caducidad) c.push(p.caducidad);
  if (p.abierto && Number(p.dias_abierto) > 0) {
    const d = desdeIso(p.abierto); d.setDate(d.getDate() + Number(p.dias_abierto)); c.push(iso(d));
  }
  return c.length ? c.sort()[0] : null;
}
export const caducaPorApertura = p => !!(p.abierto && Number(p.dias_abierto) > 0 && caducidadEfectiva(p) !== p.caducidad);

const num = s => Number(String(s).replace(',', '.'));

export function completar(p) {                       // añade los campos nuevos y, la primera vez, los saca de la nota
  if (p.v2) return p;
  p.marca ??= ''; p.envase ??= null; p.escurrido ??= false; p.sal100 ??= null; p.abierto ??= null; p.dias_abierto ??= null;
  let n = ' ' + (p.nota || '') + ' ', tocado = false;
  const sal = n.match(/(\d+[.,]?\d*)\s*g?\s*(?:de\s+)?sal(?:\s+(?:por|cada)\s+100\s*g)?/i) || n.match(/sal\s+(\d+[.,]?\d*)(?:\s*g)?(?:\s+(?:por|cada)(?:\s+cada)?\s+100\s*g)?/i);
  if (sal) { p.sal100 = num(sal[1]); n = n.replace(sal[0], ' '); tocado = true; }
  const env = n.match(/(\d+[.,]?\d*)\s*(?:g|gr|gramos)\b/i);
  if (env) { p.envase = num(env[1]); n = n.replace(env[0], ' '); tocado = true; }
  if (/escurrid/i.test(n)) p.escurrido = true;
  if (tocado) {                                       // deja en la nota solo lo que no se ha pasado a campos
    p.nota = n.replace(/\b(neto|peso|escurrid[oa]s?|y|de|brick|latas?|paquete|gramos)\b/gi, ' ').replace(/[,;.]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  p.v2 = true;
  return p;
}
