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
