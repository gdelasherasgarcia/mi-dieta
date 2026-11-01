// Piezas de interfaz comunes: hoja inferior (formularios) y avisos breves.
import { esc } from './util.js';
import * as S from './store.js';

const hoja = () => document.getElementById('hoja');
const aviso = () => document.getElementById('aviso');
let temporizador = null;

export function abrirHoja(html, alEnviar) {
  const h = hoja();
  h.innerHTML = `<div class="panel" role="dialog" aria-modal="true"><button type="button" class="cerrar-hoja" data-cerrar aria-label="Cerrar">✕</button><form novalidate>${html}</form></div>`;
  h.hidden = false;
  const form = h.querySelector('form');
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const accion = ev.submitter?.value || 'guardar';
    const datos = Object.fromEntries(new FormData(form).entries());
    const copia = /^(borrar|gastado|baja-|quitar)/.test(accion) ? S.exportar() : null;       // antes de borrar se guarda una copia para poder «Deshacer»
    if (alEnviar(datos, accion) !== false) { cerrarHoja(); if (copia) ofrecerDeshacer(copia); }
  });
  if (!h._cierre) {                                             // se engancha una sola vez: fuera de la ventana, ✕ o Esc la cierran
    h._cierre = true;
    h.addEventListener('click', ev => { if (ev.target === h || ev.target.closest('[data-cerrar]')) cerrarHoja(); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !h.hidden) cerrarHoja(); });
  }
  const primero = form.querySelector('input:not([type=hidden]), select, textarea');
  if (primero) primero.focus({ preventScroll: true });
}
export function cerrarHoja() { const h = hoja(); h.hidden = true; h.innerHTML = ''; }

export function avisar(texto) {
  const a = aviso(); a.textContent = texto; a.hidden = false;
  clearTimeout(temporizador); temporizador = setTimeout(() => { a.hidden = true; }, 2600);
}

// Tras borrar o dar de baja algo: el aviso de abajo lleva un botón «Deshacer» que restaura todo como estaba (unos segundos).
export function ofrecerDeshacer(copia) {
  const a = aviso(), texto = (!a.hidden && a.textContent) || 'Hecho.';
  a.textContent = texto + ' '; a.hidden = false;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn mini'; b.textContent = 'Deshacer';
  b.addEventListener('click', () => { S.importar(copia); clearTimeout(temporizador); a.textContent = 'Deshecho.'; temporizador = setTimeout(() => { a.hidden = true; }, 2600); });
  a.append(b);
  clearTimeout(temporizador); temporizador = setTimeout(() => { a.hidden = true; }, 9000);
}

// Pregunta de sí o no con el aspecto de la app (en vez del diálogo gris del navegador).
export function confirmar({ titulo, texto, si = 'Sí', no = 'No', alSi, alNo, peligro = false }) {
  setTimeout(() => abrirHoja(`<h1>${esc(titulo)}</h1><p style="white-space:pre-line">${esc(texto)}</p>
    <div class="pila"><button class="btn ${peligro ? 'peligro' : 'main'}" type="submit" value="si">${esc(si)}</button><button class="btn" type="submit" value="no">${esc(no)}</button></div>`,
    (f, acc) => { setTimeout(() => (acc === 'si' ? alSi : alNo)?.(), 0); return true; }), 0);       // se abre tras cerrarse la ventana desde la que se llama
}

export const campo = (etiqueta, control) => `<label class="campo"><span>${esc(etiqueta)}</span>${control}</label>`;

export const botonFoto = () => `<label class="btn grande" style="display:flex;align-items:center;justify-content:center;margin:-4px 0 12px;cursor:pointer">📷 Leer el código con una foto
  <input type="file" accept="image/*" capture="environment" data-ean-foto hidden></label>`;
