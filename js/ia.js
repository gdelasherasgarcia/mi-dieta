// Conexión opcional con una IA (Gemini, Groq, Mistral, OpenRouter u otra compatible con OpenAI) para rellenar fichas, proponer menús, etc.
// Se puede poner una segunda IA de RESPALDO: si la primera falla (servidor caído, límite gratuito), la app pasa sola a la segunda.
// Las claves se guardan SOLO en este dispositivo, aparte de los datos: no van en las copias de seguridad ni en el informe.
import { esc } from './util.js';

const CLAVE = 'dieta_ia_v1';
// preset → cómo se habla con ella. El modelo y la dirección «habituales» se usan si el usuario los deja vacíos (los modelos cambian con el tiempo).
export const PRESETS = {
  gemini: { nombre: 'Gemini (Google)', proveedor: 'gemini', modelo: 'gemini-3.5-flash-lite', ayuda: 'Clave gratuita en aistudio.google.com/apikey, con tu cuenta de Google.' },
  groq: { nombre: 'Groq', proveedor: 'openai', url: 'https://api.groq.com/openai/v1', modelo: 'openai/gpt-oss-120b', ayuda: 'Clave gratuita en console.groq.com.' },
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
const errorHttp = (status, texto) => { const e = new Error(mensajeError(status, texto)); e.status = status; e.servidor = status >= 500; e.recuperable = status === 429 || status >= 500; return e; };
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
// Los nombres de modelo de Google cambian y los viejos dejan de existir: si el modelo dado da 404, se busca uno vigente (preferimos «flash-lite», más holgado en la capa gratuita) y se recuerda.
async function descubrirModeloGemini(c) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': c.clave } }); if (!r.ok) return null;
  const j = await r.json(), ver = n => Number((n.match(/^gemini-([\d.]+)/) || [])[1]) || 0, orden = (a, b) => ver(b) - ver(a);
  const lista = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name || '').replace(/^models\//, ''))
    .filter(n => /^gemini-[\d.]+-flash/.test(n) && !/preview|live|tts|image|audio|exp|thinking|8b|latest/.test(n));
  return lista.filter(n => /lite/.test(n)).sort(orden)[0] || lista.filter(n => !/lite/.test(n)).sort(orden)[0] || null;
}
// Igual para las IA compatibles con OpenAI (Groq, Mistral…): se pide su lista de modelos y se toma uno de chat (grande primero).
async function descubrirModeloOpenAI(c) {
  const r = await fetch(c.url.replace(/\/+$/, '') + '/models', { headers: { authorization: 'Bearer ' + c.clave } }); if (!r.ok) return null;
  const j = await r.json(), lista = (j.data || j.models || []).map(m => String(m.id || m.name || '')).filter(n => n && !/whisper|orpheus|guard|safeguard|embed|tts|allam|image|moderation|rerank/i.test(n));
  const tam = n => Number((n.match(/(\d+)b/i) || [])[1]) || 0;
  return lista.sort((a, b) => tam(b) - tam(a))[0] || null;
}
function recordarModelo(c, m) { const g = config(); if (!g) return; const x = [g, g.respaldo, g.respaldo2].find(y => y && y.clave === c.clave); if (x) { x.modelo = m; guardarConfig(g); } }
// Una IA concreta: ante un error del servidor (5xx) reintenta dos veces antes de rendirse.
export async function preguntarA(c, prompt, { json = false, reintentos = 2, _buscado = false } = {}) {
  for (let intento = 0; ; intento++) {
    try { return await unaVez(c, prompt, json); }
    catch (e) {
      if (e.status === 404 && !_buscado) {                        // ese modelo ya no existe: se busca otro y se vuelve a intentar
        const m = await (c.proveedor === 'gemini' ? descubrirModeloGemini(c) : c.url ? descubrirModeloOpenAI(c) : Promise.resolve(null)).catch(() => null);
        if (m && m !== c.modelo) { const t = await preguntarA({ ...c, modelo: m }, prompt, { json, reintentos, _buscado: true }); recordarModelo(c, m); return t; }
      }
      if (!e.servidor || intento >= reintentos) throw e; await dormir(intento === 0 ? 2500 : 6000); }
  }
}
// Pregunta a la IA principal; si falla por algo que otra IA puede salvar, prueba la primera de respaldo y después la segunda. Con {json:true} pide solo JSON.
export async function preguntar(prompt, { json = false } = {}) {
  const c = config(); if (!valida(c)) throw new Error('No hay ninguna IA conectada. Conéctala en «Más».');
  const cadena = [c, c.respaldo, c.respaldo2].filter(valida), fallos = [];
  for (let i = 0; i < cadena.length; i++) {
    const x = cadena[i], ultima = i === cadena.length - 1;
    try { const t = await preguntarA(x, prompt, { json, reintentos: ultima ? 2 : 0 }); _usada = x; return t; }          // con alguna IA de relevo detrás no se pierde tiempo reintentando
    catch (e) {
      if (e.status === 404) e.recuperable = true;                                           // modelo o dirección que no existen: que lo intente la siguiente
      fallos.push(`${etiqueta(x)}${i ? ' (respaldo' + (cadena.length > 2 ? ' ' + i : '') + ')' : ''} (modelo «${x.modelo}»): ${e.message}`);
      if (!e.recuperable || ultima) throw cadena.length === 1 ? Object.assign(e, { message: fallos[0] }) : new Error(fallos.join('\n'));
    }
  }
}
