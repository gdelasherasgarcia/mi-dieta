// Arranque y navegación. Cada pantalla vive en js/vistas/ y exporta render() y acciones().
import * as S from './store.js';
import * as Hoy from './vistas/hoy.js';
import * as Nevera from './vistas/nevera.js';
import * as Medicinas from './vistas/medicinas.js';
import * as Catalogo from './vistas/catalogo.js';
import * as Salud from './vistas/salud.js';
import * as Compra from './vistas/compra.js';
import * as Menu from './vistas/menu.js';
import * as Recetas from './vistas/recetas.js';
import * as Mas from './vistas/mas.js';
import * as AvisosV from './vistas/avisos.js';
import { avisar } from './ui.js';
import { leerCodigo } from './escaner.js';
import { abrirAyuda } from './ayuda.js';
import { sincronizar } from './avisos.js';
import { hoy } from './util.js';
import { setDiaVista } from './util.js';

const svg = d => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONOS = {
  hoy: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'),
  menu: svg('<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>'),
  nevera: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>'),
  compra: svg('<path d="M5 9h14l-1.4 9a2 2 0 0 1-2 1.7H8.4a2 2 0 0 1-2-1.7z"/><path d="M9 9l3-5 3 5"/>'),
  salud: svg('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>'),
  mas: svg('<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="var(--card)"/><circle cx="15" cy="12" r="2" fill="var(--card)"/><circle cx="8" cy="17" r="2" fill="var(--card)"/>'),
};
const PANTALLAS = [
  { id: 'hoy', titulo: 'Hoy', icono: ICONOS.hoy, vista: Hoy },
  { id: 'menu', titulo: 'Menú', icono: ICONOS.menu, vista: Menu },
  { id: 'nevera', titulo: 'Almacén', icono: ICONOS.nevera, vista: Nevera },
  { id: 'compra', titulo: 'Compra', icono: ICONOS.compra, vista: Compra },
  { id: 'salud', titulo: 'Salud', icono: ICONOS.salud, vista: Salud },
  { id: 'recetas', titulo: 'Recetario', icono: '📖', vista: Recetas, oculta: true, padre: 'menu' },
  { id: 'catalogo', titulo: 'Catálogo', icono: '📖', vista: Catalogo, oculta: true, padre: 'compra' },
  { id: 'medicinas', titulo: 'Medicinas', icono: '💊', vista: Medicinas, oculta: true, padre: 'salud' },
  { id: 'avisos', titulo: 'Avisos', icono: '🔔', vista: AvisosV, oculta: true, padre: 'hoy' },
  { id: 'mas', titulo: 'Más', icono: ICONOS.mas, vista: Mas },
];
const WEBS_SUPER = { Eroski: 'https://supermercado.eroski.es', Mercadona: 'https://tienda.mercadona.es', Carrefour: 'https://www.carrefour.es/supermercado', Dia: 'https://www.dia.es/compra-online', Alcampo: 'https://www.alcampo.es', Lidl: 'https://www.lidl.es', Otro: '' };
let actual = 'hoy';
let pila = [];                                               // pantallas por las que se ha pasado hasta llegar a una secundaria (para «← Volver»)
try { actual = localStorage.getItem('dieta_pantalla') || 'hoy'; } catch (e) {}
if (!PANTALLAS.some(p => p.id === actual)) actual = 'hoy';

function dibujar() {
  if (sincronizar()) return;                                   // pone/quita peticiones de reposición de pastillas en la lista de la compra (guarda y vuelve a dibujar)
  const vista = document.getElementById('vista');
  const y = vista.scrollTop;
  const pant = PANTALLAS.find(p => p.id === actual) || PANTALLAS[0];
  vista.innerHTML = pant.vista.render();
  if (pant.oculta) {                                                   // pantallas secundarias: botón para volver a la que se venía
    const vuelta = PANTALLAS.find(p => p.id === (pila[pila.length - 1] || pant.padre || 'mas')) || PANTALLAS[0];
    vista.insertAdjacentHTML('afterbegin', `<div class="cab-cerrar"><button type="button" class="cerrar-hoja" data-volver aria-label="Cerrar y volver a ${vuelta.titulo}">✕</button></div>`);
  }
  vista.scrollTop = y;
  const h1 = vista.querySelector('h1');                              // «?» junto al título: ayuda de la pantalla
  if (h1 && !h1.querySelector('.ayuda-btn')) h1.insertAdjacentHTML('beforeend', ` <button type="button" class="ayuda-btn" data-ayuda="${pant.id}" aria-label="Ayuda de esta pantalla">?</button>`);
  const activa = pant.oculta ? (pant.padre || 'mas') : pant.id;                      // las pantallas ocultas cuelgan de «Más»
  document.getElementById('tabs').innerHTML = PANTALLAS.filter(p => !p.oculta).map(p =>
    `<button type="button" data-nav="${p.id}" ${p.id === activa ? 'aria-current="page"' : ''}><span class="ico" aria-hidden="true">${p.icono}</span>${p.titulo}</button>`).join('');
  if (S.ultimoError) avisar(S.ultimoError);
}

document.addEventListener('click', ev => {
  const ay = ev.target.closest('[data-ayuda]');
  if (ay) { ev.preventDefault(); abrirAyuda(ay.dataset.ayuda); return; }
  const vb = ev.target.closest('[data-volver]');
  if (vb) {                                                     // «← Volver»: a la pantalla de la que se venía
    const pant = PANTALLAS.find(p => p.id === actual) || PANTALLAS[0];
    actual = pila.pop() || pant.padre || 'mas';
    try { localStorage.setItem('dieta_pantalla', actual); } catch (e) {}
    document.getElementById('vista').scrollTop = 0; dibujar(); return;
  }
  const nav = ev.target.closest('[data-nav]');
  if (nav) {
    const destino = PANTALLAS.find(p => p.id === nav.dataset.nav);
    if (destino && destino.oculta) { if (destino.id !== actual) pila.push(actual); } else pila = [];
    actual = nav.dataset.nav; setDiaVista(null);                // al cambiar de pantalla se vuelve al día de hoy
    try { localStorage.setItem('dieta_pantalla', actual); } catch (e) {}
    document.getElementById('vista').scrollTop = 0; dibujar(); return;
  }
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  const p = (PANTALLAS.find(x => x.id === actual) || PANTALLAS[0]).vista;
  if (p.acciones(el.dataset.act, el)) dibujar();
});
document.addEventListener('change', async ev => {
  if (ev.target.matches('input[data-ean-compra]')) {               // foto del código en la pantalla Compra
    const f = ev.target.files?.[0]; if (!f) return; avisar('Leyendo el código…');
    try {
      const cods = await leerCodigo(f);
      if (!cods.length) avisar('No he podido leer el código. Acércalo, que se vea entero y sin brillos.');
      else Compra.registrarEan(cods[0]);
    } catch (e) { avisar('No se pudo leer la foto: ' + (e.message || 'error')); }
    ev.target.value = ''; return;
  }
  if (ev.target.matches('input[data-ean-foto]')) {                 // foto de un código de barras dentro de un formulario
    const f = ev.target.files?.[0]; if (!f) return;
    const form = ev.target.closest('form'); avisar('Leyendo el código…');
    try {
      const cods = await leerCodigo(f);
      if (!cods.length) { avisar('No he podido leer el código. Acércalo, que se vea entero y sin brillos, o escríbelo.'); }
      else {
        const ean = form.querySelector('[name="ean"]'); if (ean) ean.value = cods[0];
        const cat = S.buscarCatalogoEan(cods[0]), nom = form.querySelector('[name="nombre"]');
        if (cat && nom && !nom.value.trim()) nom.value = cat.nombre;
        avisar(cat ? `Código ${cods[0]}: ${cat.nombre}` : `Código leído: ${cods[0]} (no está en el catálogo)`);
      }
    } catch (e) { avisar('No se pudo leer la foto: ' + (e.message || 'error')); }
    ev.target.value = ''; return;
  }
  if (ev.target.matches('[data-ajtxt]')) {                       // ajustes de texto (supermercado, web)
    const a = S.datos().ajustes, k = ev.target.dataset.ajtxt; a[k] = ev.target.value.trim();
    if (k === 'supermercado' && WEBS_SUPER[a[k]] !== undefined) a.web_super = WEBS_SUPER[a[k]];
    S.guardar(); return;
  }
  if (ev.target.matches('input[data-act="importar"]')) Mas.importarArchivo(ev.target).then(dibujar);
  if (ev.target.matches('input[data-act="cat-importar"]')) Catalogo.importarArchivo(ev.target).then(dibujar);
});

// Copia diaria automática: el navegador solo permite descargar tras un toque del usuario,
// así que se hace con el primer toque del día y con el primero a partir de las 21:00. Va a Descargas.
document.addEventListener('click', () => {
  try {
    if (location.hostname === 'localhost') return;
    const dia = hoy(), noche = new Date().getHours() >= 21, clave = dia + (noche ? '_noche' : '');
    if (localStorage.getItem('dieta_copia_auto') === clave) return;
    localStorage.setItem('dieta_copia_auto', clave);
    const blob = new Blob([S.exportar()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dieta_auto_${clave}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    avisar('Copia automática guardada en Descargas.');
  } catch (e) {}
});

S.cargar();
Mas.aplicarAspecto();
S.alCambiar(dibujar);
dibujar();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
