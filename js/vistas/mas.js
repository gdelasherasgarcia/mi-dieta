// Pantalla «Más»: aspecto y copia de seguridad.
import * as S from '../store.js';
import { esc, hoy } from '../util.js';
import { avisar } from '../ui.js';

import { abrirAjustesAgua } from './hoy.js';

export function aplicarAspecto() {
  const a = S.datos().ajustes, r = document.documentElement;
  r.dataset.fuente = a.fuente; r.dataset.tema = a.tema;
}

const grupo = (titulo, clave, opciones, actual) => `
  <h2>${titulo}</h2><div class="filtros" role="group" aria-label="${titulo}">
  ${opciones.map(([v, t]) => `<button type="button" class="filtro" data-act="aj" data-clave="${clave}" data-v="${v}" aria-pressed="${actual === v}">${t}</button>`).join('')}</div>`;

const SUPERS = ['Eroski', 'Mercadona', 'Carrefour', 'Dia', 'Alcampo', 'Lidl', 'Otro'];
const WEBS = { Eroski: 'https://supermercado.eroski.es', Mercadona: 'https://tienda.mercadona.es', Carrefour: 'https://www.carrefour.es/supermercado', Dia: 'https://www.dia.es/compra-online', Alcampo: 'https://www.alcampo.es', Lidl: 'https://www.lidl.es', Otro: '' };

export function render() {
  const a = S.datos().ajustes;
  return `
    <h1>Más</h1>
    <p class="sub">Aspecto, compra y copia de seguridad.</p>
    ${grupo('Tamaño de letra', 'fuente', [['normal', 'Normal'], ['grande', 'Grande'], ['enorme', 'Enorme']], a.fuente)}
    ${grupo('Tema', 'tema', [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']], a.tema)}
    <h2>Avisos</h2>
    <div class="card">
      <p style="margin-top:0" class="sub">Crear tus avisos, activar o apagar cada tipo, las horas y los archivos de calendario del móvil están ahora en su propia pantalla.</p>
      <button type="button" class="btn grande" data-nav="avisos">🔔 Abrir Avisos</button>
    </div>

    <h2>Mis comidas fijas</h2>
    <div class="card">
      ${[['comida_desayuno', 'Desayuno'], ['comida_media', 'Media mañana'], ['comida_cena', 'Cena']].map(([k, t]) => `<label class="campo"><span>${t}</span><input data-ajtxt="${k}" value="${esc(a[k] || '')}" autocomplete="off"></label>`).join('')}
      <label class="campo"><span>Tortilla: rellenos que ya puedo comer</span><input data-ajtxt="tortilla_rellenos" value="${esc(a.tortilla_rellenos || '')}" autocomplete="off"></label>
      <label class="campo"><span>Tortilla: siempre lleva</span><input data-ajtxt="tortilla_siempre" value="${esc(a.tortilla_siempre || '')}" autocomplete="off"></label>
      <label class="campo"><span>En estudio (aún no; preguntar al enfermero)</span><input data-ajtxt="tortilla_estudio" value="${esc(a.tortilla_estudio || '')}" autocomplete="off"></label>
      <p class="sub" style="margin:0">Lo previsto sale en Hoy. La comida es variable: se apunta cada día.</p>
    </div>

    <h2>Mi compra</h2>
    <div class="card">
      <label class="campo"><span>Supermercado</span><select data-ajtxt="supermercado">${SUPERS.map(x => `<option ${a.supermercado === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="campo"><span>Web para consultar productos</span><input type="url" data-ajtxt="web_super" value="${esc(a.web_super || '')}" placeholder="https://…" autocomplete="off"></label>
      <p class="sub" style="margin:0 0 4px">¿Cada cuánto haces la compra? Los menús y las cantidades se calculan para ese periodo.</p>
    </div>
    ${grupo('Periodicidad de la compra', 'compra_dias', [['1', 'Cada día'], ['3', 'Cada 2-3 días'], ['7', 'Semanal'], ['14', 'Quincenal']], String(a.compra_dias || 1))}
    <h2>Agua</h2>
    <div class="card"><p style="margin:0 0 8px">Vaso de <b>${Number(a.vaso_ml) || 250} ml</b> · objetivo <b>${(((Number(a.objetivo_ml) || a.objetivo_vasos * (Number(a.vaso_ml) || 250)) / 1000)).toLocaleString('es-ES', { maximumFractionDigits: 2 })} l</b> al día (${a.objetivo_vasos} vasos).</p>
      <button type="button" class="btn grande" data-act="agua-ajustes">Cambiar el vaso o el objetivo</button></div>

    <h2>Más pantallas</h2>
    <div class="card">
      <button type="button" class="btn grande" data-nav="catalogo">📖 Catálogo de productos</button>
      <button type="button" class="btn grande" data-nav="medicinas" style="margin-top:10px">💊 Medicinas</button>
    </div>

    <h2>Ayuda</h2>
    <div class="card"><button type="button" class="btn main grande" data-ayuda="manual">📖 Manual completo de la app</button>
      <p class="sub" style="margin:8px 0 0">Para qué sirve cada pantalla, cómo se usa y las rutinas del día, la semana y el mes.</p></div>

    <h2>Copia de seguridad</h2>
    ${location.hostname === 'localhost' ? `    <div class="card">
      <p style="margin-top:0"><b>Prueba en el móvil:</b> si estás en casa con el portátil encendido, trae aquí sus datos de un toque (sustituye los de este dispositivo).</p>
      <button type="button" class="btn grande" data-act="traer-portatil">📥 Traer los datos del portátil</button>
    </div>
    <div class="card">
      <p style="margin-top:0"><b>Copia automática:</b> ${S.ultimaCopia ? 'última ' + esc(S.ultimaCopia.dia) + ' a las ' + esc(S.ultimaCopia.hora) : 'todavía ninguna'}.<br><span class="sub" style="margin:0">Se guarda sola en la carpeta «copias» de la app (una por día, las últimas 30).</span></p>
      <button type="button" class="btn grande" data-act="copia-ahora">Hacer una copia ahora</button>
    </div>` : ''}
    <div class="card">
      <p style="margin-top:0">Todo lo que apuntas se guarda en este dispositivo. Haz una copia de vez en cuando. Además, la app guarda sola una copia en Descargas con tu primer toque del día y con el primero después de las 21:00.<br><span class="sub" style="margin:0">Última copia automática: ${esc(String((() => { try { return localStorage.getItem('dieta_copia_auto') || 'ninguna todavía'; } catch (e) { return 'ninguna todavía'; } })()).replace('_noche', ' (noche)'))}</span></p>
      <button type="button" class="btn main grande" data-act="exportar">Guardar copia (archivo)</button>
      <label class="btn grande" style="display:flex;align-items:center;justify-content:center;margin-top:10px">
        Recuperar una copia<input type="file" data-act="importar" hidden>
      </label>
    </div>
    <button type="button" class="btn peligro grande" data-act="borrar-todo">Borrar todos los datos</button>
    <p class="nota-pie">Esta app no es un médico: orienta, no cambia tu medicación. Versión 0.23.</p>
  `;
}

export function acciones(act, el) {
  const d = S.datos();
  if (act === 'traer-portatil') {
    if (!confirm('Esto sustituye TODOS los datos de este dispositivo por los del portátil (la última copia). ¿Seguimos?')) return false;
    fetch('/_traer_datos.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('El portátil no tiene preparada esa copia.'); return r.text(); })
      .then(t => { S.importar(t); aplicarAspecto(); avisar('Datos del portátil cargados.'); })
      .catch(e => avisar(e.message || 'No se pudo traer la copia.'));
    return false;
  }
  if (act === 'copia-ahora') { S.copiarAhora().then(j => avisar(j.ok ? `Copia hecha (${j.dia} ${j.hora}).` : 'No se pudo: ' + (j.error || 'error'))); return false; }
  if (act === 'agua-ajustes') { abrirAjustesAgua(); return false; }
  if (act === 'aj') {
    const v = ['objetivo_vasos', 'compra_dias'].includes(el.dataset.clave) ? Number(el.dataset.v) : el.dataset.v;
    d.ajustes[el.dataset.clave] = v; S.guardar(); aplicarAspecto(); return true;
  }
  if (act === 'exportar') {
    const blob = new Blob([S.exportar()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dieta_copia_${hoy()}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    avisar('Copia guardada en Descargas.'); return true;
  }
  if (act === 'borrar-todo') {
    if (confirm('¿Borrar TODOS los datos de esta app? No se puede deshacer (haz antes una copia).')) { S.borrarTodo(); aplicarAspecto(); avisar('Datos borrados.'); }
    return true;
  }
  return false;
}

export async function importarArchivo(input) {
  const f = input.files?.[0]; if (!f) return;
  try { S.importar(await f.text()); aplicarAspecto(); avisar('Copia recuperada.'); }
  catch (e) { avisar(e.message || 'No se pudo leer ese archivo.'); }
  input.value = '';
}
