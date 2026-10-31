// Piezas de interfaz comunes: hoja inferior (formularios) y avisos breves.
import { esc } from './util.js';

const hoja = () => document.getElementById('hoja');
const aviso = () => document.getElementById('aviso');
let temporizador = null;

export function abrirHoja(html, alEnviar) {
  const h = hoja();
  h.innerHTML = `<div class="panel" role="dialog" aria-modal="true"><form novalidate>${html}</form></div>`;
  h.hidden = false;
  const form = h.querySelector('form');
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const accion = ev.submitter?.value || 'guardar';
    const datos = Object.fromEntries(new FormData(form).entries());
    if (alEnviar(datos, accion) !== false) cerrarHoja();
  });
  h.addEventListener('click', ev => { if (ev.target === h) cerrarHoja(); }, { once: true });
  const primero = form.querySelector('input:not([type=hidden]), select, textarea');
  if (primero) primero.focus({ preventScroll: true });
}
export function cerrarHoja() { const h = hoja(); h.hidden = true; h.innerHTML = ''; }

export function avisar(texto) {
  const a = aviso(); a.textContent = texto; a.hidden = false;
  clearTimeout(temporizador); temporizador = setTimeout(() => { a.hidden = true; }, 2600);
}

export const campo = (etiqueta, control) => `<label class="campo"><span>${esc(etiqueta)}</span>${control}</label>`;

export const botonFoto = () => `<label class="btn grande" style="display:flex;align-items:center;justify-content:center;margin:-4px 0 12px;cursor:pointer">📷 Leer el código con una foto
  <input type="file" accept="image/*" capture="environment" data-ean-foto hidden></label>`;
