// Capa de datos. Hoy guarda en el navegador (localStorage); más adelante se cambia por Google Sheets
// tocando SOLO este archivo: el resto de la app llama a datos()/guardar() y no sabe dónde viven los datos.
import { nuevoId, hoy } from './util.js';
import { SEMILLA, MEDICINAS } from './semilla.js';
import { completar } from './producto.js';
import { CATALOGO } from './catalogo_semilla.js';
import { TENSION_SEMILLA, PESO_SEMILLA } from './salud_semilla.js';
import { COMPRA_SEMILLA } from './compra_semilla.js';
import { RECETAS_BASE } from './recetas_semilla.js';

const CLAVE = 'dieta_app_v1';
let _datos = null;
const oyentes = new Set();
export let ultimoError = null;

function vacio() {
  return {
    version: 1,
    creado: new Date().toISOString(),
    ajustes: { hora_desayuno: '09:00', hora_media: '12:00', hora_comida: '14:30', hora_cena: '21:00', hora_ejercicio: '18:00', avisos: { stock: true, citas: true, agua: false, comidas: false, ejercicio: false }, tortilla_rellenos: 'Espinacas, queso, jamón de pavo', tortilla_siempre: 'Tomates cherry', tortilla_estudio: 'Atún, gambas peladas, setas congeladas', comida_desayuno: 'Café con leche desnatada, mini tostadas con ajo y aceite (vaporizador), 5 nueces', comida_media: 'Una fruta entera', comida_comida: '', comida_cena: 'Tortilla de 1 huevo (microondas) de espinacas, queso o jamón de pavo, con tomates cherry, entre dos tostadas de pan de payés integral', supermercado: 'Eroski', web_super: 'https://supermercado.eroski.es', compra_dias: 1, vaso_ml: 250, objetivo_vasos: 8, estatura_cm: 172, fuente: 'normal', tema: 'auto', medicinas: MEDICINAS.map(m => ({ ...m })) },
    nevera: [],          // productos en casa
    catalogo: [],        // productos que compra, con nutrición por 100 g
    registro: {},        // por fecha: { agua: n, meds_manana: bool, mounjaro: bool }
    semilla: false,
  };
}

export function cargar() {
  try { const t = localStorage.getItem(CLAVE); _datos = t ? JSON.parse(t) : null; } catch (e) { _datos = null; ultimoError = 'No se pudo leer lo guardado.'; }
  if (!_datos || typeof _datos !== 'object') _datos = vacio();
  const v = vacio();                                   // rellena lo que falte si la versión es antigua
  _datos.ajustes = { ...v.ajustes, ...(_datos.ajustes || {}) };
  _datos.nevera ||= []; _datos.registro ||= {};
  if (!_datos.meds_v2) {                               // las casillas antiguas (mañana / mounjaro) pasan a medicinas sueltas
    for (const r of Object.values(_datos.registro)) {
      r.meds ||= {};
      if (r.meds_manana) { r.meds.atorvastatina ||= [{ h: '' }]; r.meds.enalapril ||= [{ h: '' }]; }
      if (r.mounjaro) r.meds.mounjaro ||= [{ h: '' }];
      delete r.meds_manana; delete r.mounjaro;
    }
    _datos.meds_v2 = true; if (_datos.semilla) guardar();
  }
  let cambioTomas = false;                              // cada medicina puede tomarse varias veces al día: tomas = lista [{h:'HH:MM'}]
  for (const r of Object.values(_datos.registro)) for (const [id, t] of Object.entries(r.meds || {})) if (!Array.isArray(t)) { r.meds[id] = t ? [t] : []; cambioTomas = true; }
  if (cambioTomas && _datos.semilla) guardar();
  const migrar = _datos.nevera.some(p => !p.v2);
  _datos.nevera.forEach(completar);
  if (migrar && _datos.semilla) guardar();
  if (!_datos.semilla) {
    _datos.nevera = SEMILLA.map(p => completar({ id: nuevoId(), ...p }));
    _datos.semilla = true;
    guardar();
  }
  _datos.salud ||= { tension: [], peso: [] }; _datos.salud.tension ||= []; _datos.salud.peso ||= [];
  if (!_datos.salud_v1) {                              // primera vez con salud: lecturas ya anotadas en la carta de dieta
    TENSION_SEMILLA.forEach(r => _datos.salud.tension.push({ id: nuevoId(), ...r }));
    PESO_SEMILLA.forEach(r => _datos.salud.peso.push({ id: nuevoId(), ...r }));
    _datos.salud_v1 = true; guardar();
  }
  _datos.compra ||= []; _datos.comidas ||= {}; _datos.plan ||= {};
  if (!_datos.compra_v1) { COMPRA_SEMILLA.forEach(x => _datos.compra.push({ id: nuevoId(), hecho: false, ...x })); _datos.compra_v1 = true; guardar(); }
  _datos.citas ||= [];
  if (!_datos.citas_v1) { _datos.citas.push({ id: nuevoId(), fecha: '2026-11-24', hora: '', con: 'Médico', lugar: '', nota: 'Derivación a cardiología; llevar preguntas del electro y de la analítica', avisos: [1440, 120] }); _datos.citas_v1 = true; guardar(); }
  _datos.recetas ||= [];
  { const nuevas = RECETAS_BASE.filter(r => !_datos.recetas.some(x => x.id === r.id));       // las recetas base nuevas se añaden sin tocar las que ya hay
    if (nuevas.length) { nuevas.forEach(r => _datos.recetas.push(JSON.parse(JSON.stringify(r)))); _datos.recetas_v1 = true; guardar(); } }
  _datos.catalogo ||= [];
  if (!_datos.catalogo_v1) {                           // primera vez con catálogo: carga el inicial (sin pisar nada si ya hubiera)
    const ya = new Set(_datos.catalogo.map(p => clave(p)));
    for (const p of CATALOGO) if (!ya.has(clave(p))) _datos.catalogo.push({ id: nuevoId(), ...p });
    _datos.catalogo_v1 = true; guardar();
  }
  return _datos;
}

const sinAcentos = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const clave = p => sinAcentos(p.nombre);
export const buscarCatalogo = nombre => { const k = sinAcentos(nombre); return k ? (_datos.catalogo || []).find(p => clave(p) === k) || null : null; };

// Los códigos que empiezan por 2 (peso variable: carne o fruta al peso) llevan el peso o el precio en las últimas cifras: solo vale el principio (7 cifras).
const clavePesoVariable = e => (e.length === 13 && e[0] === '2') ? e.slice(0, 7) : e;
export const buscarCatalogoEan = ean => { const e = String(ean || '').replace(/\D/g, ''); const k = clavePesoVariable(e); return e ? (_datos.catalogo || []).find(p => { const x = String(p.ean || '').replace(/\D/g, ''); return x && clavePesoVariable(x) === k; }) || null : null; };

// Fusiona un catálogo de un archivo: añade los nuevos y rellena/actualiza los campos que traen valor. Nunca borra.
export function fusionarCatalogo(texto) {
  let a = JSON.parse(texto); if (a && !Array.isArray(a)) a = a.catalogo;
  if (!Array.isArray(a)) throw new Error('El archivo no es un catálogo válido.');
  let nuevos = 0, cambiados = 0;
  for (const n of a) {
    if (!n || !n.nombre) continue;
    const p = buscarCatalogo(n.nombre);
    if (!p) { _datos.catalogo.push({ id: nuevoId(), ...n }); nuevos++; continue; }
    let toco = false;
    for (const [k, val] of Object.entries(n)) if (k !== 'id' && val !== null && val !== '' && val !== undefined && p[k] !== val) { p[k] = val; toco = true; }
    if (toco) cambiados++;
  }
  guardar(); return { nuevos, cambiados };
}

export const datos = () => _datos;

// Copia automática: unos segundos después de guardar, la app manda sus datos al servidor local, que los deja en la carpeta «copias» (una por día, las últimas 30).
let _tCopia = null;
export let ultimaCopia = null; try { ultimaCopia = JSON.parse(localStorage.getItem('dieta_ultima_copia') || 'null'); } catch (e) {}
export async function copiarAhora() {
  try {
    const r = await fetch('/api/copia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(_datos) });
    const j = await r.json();
    if (j.ok) { ultimaCopia = { hora: j.hora, dia: j.dia }; try { localStorage.setItem('dieta_ultima_copia', JSON.stringify(ultimaCopia)); } catch (e) {} oyentes.forEach(f => f()); }
    return j;
  } catch (e) { return { ok: false, error: 'el servidor no responde (¿versión antigua del servidor?)' }; }
}
const programarCopia = () => { clearTimeout(_tCopia); _tCopia = setTimeout(() => { copiarAhora(); }, 30000); };

export function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(_datos)); ultimoError = null; }
  catch (e) { ultimoError = 'No se pudo guardar (¿almacenamiento lleno o bloqueado?). Haz una copia desde «Más».'; }
  oyentes.forEach(f => f());
  if (location.hostname === 'localhost') programarCopia();
}
export const alCambiar = f => { oyentes.add(f); return () => oyentes.delete(f); };

export function dia(fecha = hoy()) {                    // registro del día (se crea al pedirlo)
  const r = (_datos.registro[fecha] ||= { agua: 0, meds: {} });
  r.meds ||= {}; return r;
}

export function exportar() { return JSON.stringify(_datos, null, 2); }
export function importar(texto) {
  const d = JSON.parse(texto);
  if (!d || typeof d !== 'object' || !Array.isArray(d.nevera)) throw new Error('El archivo no es una copia válida de esta app.');
  d.semilla = true; _datos = d; guardar(); cargar();
}
export function borrarTodo() { localStorage.removeItem(CLAVE); _datos = null; cargar(); }
