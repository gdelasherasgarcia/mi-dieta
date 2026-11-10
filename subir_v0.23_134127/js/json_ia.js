// Lectura tolerante de lo que contesta una IA cuando se le pide JSON: coge el PRIMER objeto completo (aunque detrás haya más texto u otra llave),
// quita las marcas ```json y, si la respuesta viene cortada, rescata los elementos de una lista que sí llegaron enteros.
export function primerObjeto(t, desde = 0) {
  const s = String(t); const i = s.indexOf('{', desde); if (i < 0) return null;
  let prof = 0, cadena = false, esc = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (cadena) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') cadena = false; continue; }
    if (c === '"') cadena = true; else if (c === '{') prof++; else if (c === '}' && --prof === 0) return { texto: s.slice(i, j + 1), fin: j + 1 };
  }
  return null;
}
export function parsearJSON(t) {
  const s = String(t).replace(/```(?:json)?/gi, ''), o = primerObjeto(s);
  if (!o) throw new Error('No encuentro un bloque JSON completo en la respuesta (¿vino cortada?).');
  return JSON.parse(o.texto);
}
// Elementos (objetos) de la lista `clave` que están completos, aunque el resto de la respuesta esté mal o cortado.
export function rescatarLista(t, clave) {
  const s = String(t).replace(/```(?:json)?/gi, ''), k = s.indexOf('"' + clave + '"'); if (k < 0) return [];
  let pos = s.indexOf('[', k); if (pos < 0) return []; pos++;
  const out = [];
  for (;;) { const o = primerObjeto(s, pos); if (!o) break; try { out.push(JSON.parse(o.texto)); } catch (e) { /* uno malo no tira los demás */ } pos = o.fin; }
  return out;
}

// Primer bloque equilibrado entre `abre` y `cierra` (llaves o corchetes), respetando las comillas.
function bloque(t, abre, cierra, desde = 0) {
  const s = String(t), i = s.indexOf(abre, desde); if (i < 0) return null;
  let prof = 0, cadena = false, esc = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (cadena) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') cadena = false; continue; }
    if (c === '"') cadena = true; else if (c === abre) prof++; else if (c === cierra && --prof === 0) return { texto: s.slice(i, j + 1), fin: j + 1, ini: i };
  }
  return null;
}
// Saca la lista de elementos de una respuesta, sea cual sea su forma: {"recetas":[…]}, otra clave, una lista suelta […], o una sola receta.
// `esElemento` decide qué objeto cuenta como elemento (por ejemplo, el que tiene «nombre» e «ing»).
export function extraerLista(t, claves, esElemento) {
  const s = String(t).replace(/```(?:json)?/gi, ''), ia = s.indexOf('['), io = s.indexOf('{');
  const intentos = [];
  if (io >= 0 && (ia < 0 || io < ia)) { const o = bloque(s, '{', '}'); if (o) intentos.push(() => { const r = JSON.parse(o.texto); for (const k of claves) if (Array.isArray(r[k])) return r[k]; const arr = Object.values(r).find(v => Array.isArray(v) && v.some(esElemento)); if (arr) return arr; return null; }); }                // una receta suelta se recoge más abajo, junto con las demás si hay varias
  if (ia >= 0) { const a = bloque(s, '[', ']'); if (a) intentos.push(() => JSON.parse(a.texto)); }
  for (const f of intentos) { try { const l = f(); if (Array.isArray(l) && l.some(esElemento)) return l; } catch (e) { /* se prueba lo siguiente */ } }
  for (const k of claves) { const l = rescatarLista(s, k); if (l.some(esElemento)) return l; }
  const sueltos = []; let pos = 0;                                               // último recurso: todos los objetos de primer nivel que parezcan elementos
  for (;;) { const o = primerObjeto(s, pos); if (!o) break; try { const r = JSON.parse(o.texto); if (esElemento(r)) sueltos.push(r); } catch (e) { /* se ignora */ } pos = o.fin; }
  return sueltos;
}
