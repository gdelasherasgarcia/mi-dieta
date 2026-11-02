// Conexión opcional con una IA (Gemini, Groq, Mistral, OpenRouter u otra compatible con OpenAI) para rellenar fichas, proponer menús, etc.
// Se puede poner una segunda IA de RESPALDO: si la primera falla (servidor caído, límite gratuito), la app pasa sola a la segunda.
// Las claves se guardan SOLO en este dispositivo, aparte de los datos: no van en las copias de seguridad ni en el informe.
import { esc } from './util.js';

const CLAVE = 'dieta_ia_v1';
// preset → cómo se habla con ella. El modelo y la dirección «habituales» se usan si el usuario los deja vacíos (los modelos cambian con el tiempo).
export const PRESETS = {
  gemini: { nombre: 'Gemini (Google)', proveedor: 'gemini', modelo: 'gemini-flash-latest', ayuda: 'Clave gratuita en aistudio.google.com/apikey, con tu cuenta de Google.' },
  groq: { nombre: 'Groq', proveedor: 'openai', url: 'https://api.groq.com/openai/v1', modelo: 'llama-3.3-70b-versatile', ayuda: 'Clave gratuita en console.groq.com.' },
  mistral: { nombre: 'Mistral', proveedor: 'openai', url: 'https://api.mistral.ai/v1', modelo: 'mistral-small-latest', ayuda: 'Clave en console.mistral.ai (plan gratuito de pruebas).' },
  openrouter: { nombre: 'OpenRouter', proveedor: 'openai', url: 'https://openrouter.ai/api/v1', modelo: '', ayuda: 'Clave en openrouter.ai; el modelo gratuito acaba en «:free» (míralo en su web).' },
  otra: { nombre: 'Otra (compatible con OpenAI)', proveedor: 'openai', url: '', modelo: '', ayuda: 'Pon la dirección base de su API, el modelo y tu clave.' },
};
export const AVISO_DATOS = 'Al usar una IA, lo que le envías (tus medicinas, comidas, recetas o listas) sale de tu móvil y lo trata el proveedor según sus condiciones. En las cuotas gratuitas puede usarse para mejorar sus productos y personas pueden llegar a leerlo. No envíes nada que no quieras compartir.';

export function config() { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; } }
export function guardarConfig(c) { try { if (c) localStorage.setItem(CLAVE, JSON.stringify(c)); else localStorage.removeItem(CLAVE); } catch (e) {} }
export const valida = c => !!(c && c.clave && (c.proveedor !== 'openai' || (c.url && c.modelo)));
export const configurada = () => valida(config());
export const presetDe = c => (c && (c.preset || (c.proveedor === 'openai' ? 'otra' : 'gemini'))) || 'gemini';
export const etiqueta = c => !c ? 'La IA' : (c.etiqueta || (PRESETS[presetDe(c)] || {}).nombre || 'La IA').replace(/ \(.*\)$/, '');
// Construye la configuración de una IA a partir de lo escrito en el formulario (vacío = se usan la dirección y el modelo habituales).
export function desdeFormulario(preset, clave, modelo, url) {
  const p = PRESETS[preset] || PRESETS.gemini;
  return { preset, proveedor: p.proveedor, clave: (clave || '').trim(), modelo: (modelo || '').trim() || p.modelo || '', url: (url || '').trim() || p.url || '', etiqueta: p.nombre };
}

let _usada = null;                                              // qué IA contestó la última vez (la principal o la de respaldo)
export const nombreIA = () => etiqueta(_usada || config());
// Línea que va al pie de las ventanas donde habla una IA.
export const pieIA = () => `<p class="det" style="margin:14px 0 0;text-align:center">⚠ ${esc(nombreIA())} es una IA y puede cometer errores. Revisa lo importante.</p>`;

function mensajeError(status, texto) {
  if (status === 400) return 'La IA no ha entendido la petición (¿modelo mal escrito?).';
  if (status === 401 || status === 403) return 'La clave no vale o no tiene permiso. Revísala en «Más».';
  if (status === 404) return 'No encuentro ese modelo o esa dirección. Revísalo en «Más».';
  if (status === 429) return 'Se ha alcanzado el límite gratuito de la IA. Prueba más tarde.';
  if (status >= 500) return 'Los servidores de la IA están saturados o caídos ahora mismo (error ' + status + '). No es tu clave ni la app: prueba en unos minutos o cambia de modelo en «Más».';
  return 'La IA ha respondido con un error' + (status ? ' (' + status + ')' : '') + (texto ? ': ' + String(texto).slice(0, 120) : '') + '.';
}
// «recuperable»: otra IA (la de respaldo) puede salvar la situación. «servidor»: merece un reintento con la misma.
const errorHttp = (status, texto) => { const e = new Error(mensajeError(status, texto)); e.servidor = status >= 500; e.recuperable = status === 429 || status >= 500; return e; };
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function unaVez(c, prompt, json) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 60000);
  try {
    let r, j;
    if (c.proveedor === 'openai') {
      r = await fetch(c.url.replace(/\/+$/, '') + '/chat/completions', { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.clave },
        body: JSON.stringify({ model: c.modelo, messages: [{ role: 'user', content: prompt }], ...(json ? { response_format: { type: 'json_object' } } : {}) }) });
      if (!r.ok) throw errorHttp(r.status, await r.text().catch(() => ''));
      j = await r.json(); const t1 = String(j.choices?.[0]?.message?.content || '').trim();
      if (!t1) { console.warn('IA: respuesta vacía', j); const e = new Error('La IA no ha devuelto texto' + (j.choices?.[0]?.finish_reason ? ' (' + j.choices[0].finish_reason + ')' : '') + '.'); e.recuperable = true; throw e; }
      return t1;
    }
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.modelo || PRESETS.gemini.modelo)}:generateContent`, { method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.clave },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}) }) });
    if (!r.ok) throw errorHttp(r.status, await r.text().catch(() => ''));
    j = await r.json();
    const t2 = String((j.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('')).trim();
    if (!t2) { console.warn('IA: respuesta vacía', j); const m = j.promptFeedback?.blockReason || j.candidates?.[0]?.finishReason; const e = new Error('La IA no ha devuelto texto' + (m ? ' (' + m + ')' : '') + '. Prueba otra vez o con otro modelo.'); e.recuperable = true; throw e; }
    return t2;
  } catch (e) {
    if (e.name === 'AbortError') { const x = new Error('La IA tarda demasiado. Prueba otra vez.'); x.recuperable = true; throw x; }
    if (e instanceof TypeError) { const x = new Error('No se pudo contactar con la IA (¿sin internet?).'); x.recuperable = true; throw x; }
    throw e;
  } finally { clearTimeout(t); }
}
// Una IA concreta: ante un error del servidor (5xx) reintenta dos veces antes de rendirse.
export async function preguntarA(c, prompt, { json = false, reintentos = 2 } = {}) {
  for (let intento = 0; ; intento++) {
    try { return await unaVez(c, prompt, json); }
    catch (e) { if (!e.servidor || intento >= reintentos) throw e; await dormir(intento === 0 ? 2500 : 6000); }
  }
}
// Pregunta a la IA principal; si falla por algo que otra IA puede salvar, prueba la de respaldo. Con {json:true} pide solo JSON.
export async function preguntar(prompt, { json = false } = {}) {
  const c = config(); if (!valida(c)) throw new Error('No hay ninguna IA conectada. Conéctala en «Más».');
  try { const t = await preguntarA(c, prompt, { json, reintentos: valida(c.respaldo) ? 0 : 2 }); _usada = c; return t; }          // con respaldo no se pierde tiempo reintentando
  catch (e) {
    if (!e.recuperable || !valida(c.respaldo)) throw e;
    try { const t = await preguntarA(c.respaldo, prompt, { json }); _usada = c.respaldo; return t; }
    catch (e2) { throw new Error(`${etiqueta(c)}: ${e.message}\n${etiqueta(c.respaldo)} (respaldo): ${e2.message}`); }
  }
}
