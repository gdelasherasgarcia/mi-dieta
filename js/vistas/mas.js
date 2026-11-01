// Pantalla «Más»: aspecto y copia de seguridad.
import * as S from '../store.js';
import { esc, hoy } from '../util.js';
import { avisar, confirmar } from '../ui.js';

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
    <p class="sub">Aspecto, manual y copia de seguridad.</p>
    ${grupo('Tamaño de letra', 'fuente', [['normal', 'Normal'], ['grande', 'Grande'], ['enorme', 'Enorme']], a.fuente)}
    ${grupo('Tema', 'tema', [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']], a.tema)}

    <h2>Ayuda</h2>
    <div class="card"><button type="button" class="btn main grande" data-ayuda="manual">📖 Manual completo de la app</button>
      <p class="sub" style="margin:8px 0 0">Para qué sirve cada pantalla, cómo se usa y las rutinas del día, la semana y el mes.</p></div>

    <h2>Copia de seguridad</h2>
    ${location.hostname === 'localhost' ? `    <div class="card">
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
    confirmar({ titulo: 'Borrar todos los datos', texto: 'Se borran TODOS los datos de esta app y no se puede deshacer. Haz antes una copia.', si: 'Sí, borrar todo', no: 'No, conservar', peligro: true, alSi: () => { S.borrarTodo(); aplicarAspecto(); avisar('Datos borrados.'); } });
    return false;
  }
  return false;
}

export async function importarArchivo(input) {
  const f = input.files?.[0]; if (!f) return;
  try { S.importar(await f.text()); aplicarAspecto(); avisar('Copia recuperada.'); }
  catch (e) { avisar(e.message || 'No se pudo leer ese archivo.'); }
  input.value = '';
}
