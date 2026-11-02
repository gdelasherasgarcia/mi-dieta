// Conexión opcional con una IA (Gemini por defecto, u otra compatible con OpenAI) para rellenar fichas, proponer menús, etc.
// La clave se guarda SOLO en este dispositivo, aparte de los datos: no va en las copias de seguridad ni en el informe.
import { esc } from './util.js';

const CLAVE = 'dieta_ia_v1';
export const PROVEEDORES = {
  gemini: { nombre: 'Gemini (Google)', modelo: 'gemini-flash-latest', ayuda: 'Clave gratuita en aistudio.google.com/apikey, con tu cuenta de Google.' },
  openai: { nombre: 'Otra IA (compatible con OpenAI)', modelo: '', ayuda: 'Pon la dirección base de su API (por ejemplo https://api.openai.com/v1), el modelo y tu clave.' },
};
export const AVISO_DATOS = 'Al usar una IA, lo que le envías (tus medicinas, comidas, recetas o listas) sale de tu móvil y lo trata el proveedor según sus condiciones. En las cuotas gratuitas puede usarse para mejorar sus productos y personas pueden llegar a leerlo. No envíes nada que no quieras compartir.';

export function config() { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; } }
export function guardarConfig(c) { try { if (c) localStorage.setItem(CLAVE, JSON.stringify(c)); else localStorage.removeItem(CLAVE); } catch (e) {} }
export const configurada = () => { const c = config(); return !!(c && c.clave && (c.proveedor !== 'openai' || (c.url && c.modelo))); };
export const nombreIA = () => { const c = config(); return c ? (c.proveedor === 'openai' ? (c.modelo || 'La IA') : 'Gemini') : 'La IA'; };
// Línea que va al pie de las ventanas donde habla una IA.
export const pieIA = () => `<p class="det" style="margin:14px 0 0;text-align:center">⚠ ${esc(nombreIA())} es una IA y puede cometer errores. Revisa lo importante.</p>`;

function mensajeError(status, texto) {
  if (status === 400) return 'La IA no ha entendido la petición (¿modelo mal escrito?).';
  if (status === 401 || status === 403) return 'La clave no vale o no tiene permiso. Revísala en «Más».';
  if (status === 404) return 'No encuentro ese modelo o esa dirección. Revísalo en «Más».';
  if (status === 429) return 'Se ha alcanzado el límite gratuito de la IA. Prueba más tarde.';
  return 'La IA ha respondido con un error' + (status ? ' (' + status + ')' : '') + (texto ? ': ' + String(texto).slice(0, 120) : '') + '.';
}

// Pregunta a la IA configurada y devuelve su texto. Con {json:true} pide que responda solo en JSON.
export async function preguntar(prompt, { json = false } = {}) {
  const c = config(); if (!configurada()) throw new Error('No hay ninguna IA conectada. Conéctala en «Más».');
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 60000);
  try {
    let r, j;
    if (c.proveedor === 'openai') {
      r = await fetch(c.url.replace(/\/+$/, '') + '/chat/completions', { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.clave },
        body: JSON.stringify({ model: c.modelo, messages: [{ role: 'user', content: prompt }], ...(json ? { response_format: { type: 'json_object' } } : {}) }) });
      if (!r.ok) throw new Error(mensajeError(r.status, await r.text().catch(() => '')));
      j = await r.json(); const t1 = String(j.choices?.[0]?.message?.content || '').trim();
      if (!t1) { console.warn('IA: respuesta vacía', j); throw new Error('La IA no ha devuelto texto' + (j.choices?.[0]?.finish_reason ? ' (' + j.choices[0].finish_reason + ')' : '') + '.'); }
      return t1;
    }
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.modelo || PROVEEDORES.gemini.modelo)}:generateContent`, { method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.clave },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}) }) });
    if (!r.ok) throw new Error(mensajeError(r.status, await r.text().catch(() => '')));
    j = await r.json();
    const t2 = String((j.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('')).trim();
    if (!t2) { console.warn('IA: respuesta vacía', j); const m = j.promptFeedback?.blockReason || j.candidates?.[0]?.finishReason; throw new Error('La IA no ha devuelto texto' + (m ? ' (' + m + ')' : '') + '. Prueba otra vez o con otro modelo.'); }
    return t2;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('La IA tarda demasiado. Prueba otra vez.');
    if (e instanceof TypeError) throw new Error('No se pudo contactar con la IA (¿sin internet?).');
    throw e;
  } finally { clearTimeout(t); }
}
