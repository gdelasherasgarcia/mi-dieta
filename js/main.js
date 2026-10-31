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
import { avisar } from './ui.js';
import { leerCodigo } from './escaner.js';
import { abrirAyuda } from './ayuda.js';
import { sincronizar } from './avisos.js';

const PANTALLAS = [
  { id: 'hoy', titulo: 'Hoy', icono: '☀', vista: Hoy },
  { id: 'menu', titulo: 'Menú', icono: '📅', vista: Menu },
  { id: 'nevera', titulo: 'Almacén', icono: '🧊', vista: Nevera },
  { id: 'compra', titulo: 'Compra', icono: '🧺', vista: Compra },
  { id: 'salud', titulo: 'Salud', icono: '❤', vista: Salud },
  { id: 'recetas', titulo: 'Recetario', icono: '📖', vista: Recetas, oculta: true },
  { id: 'catalogo', titulo: 'Catálogo', icono: '📖', vista: Catalogo, oculta: true },
  { id: 'medicinas', titulo: 'Medicinas', icono: '💊', vista: Medicinas, oculta: true },
  { id: 'mas', titulo: 'Más', icono: '⚙', vista: Mas },
];
const WEBS_SUPER = { Eroski: 'https://supermercado.eroski.es', Mercadona: 'https://tienda.mercadona.es', Carrefour: 'https://www.carrefour.es/supermercado', Dia: 'https://www.dia.es/compra-online', Alcampo: 'https://www.alcampo.es', Lidl: 'https://www.lidl.es', Otro: '' };
let actual = 'hoy';
try { actual = localStorage.getItem('dieta_pantalla') || 'hoy'; } catch (e) {}
if (!PANTALLAS.some(p => p.id === actual)) actual = 'hoy';

function dibujar() {
  if (sincronizar()) return;                                   // pone/quita peticiones de reposición de pastillas en la lista de la compra (guarda y vuelve a dibujar)
  const vista = document.getElementById('vista');
  const y = vista.scrollTop;
  const pant = PANTALLAS.find(p => p.id === actual) || PANTALLAS[0];
  vista.innerHTML = pant.vista.render();
  vista.scrollTop = y;
  const h1 = vista.querySelector('h1');                              // «?» junto al título: ayuda de la pantalla
  if (h1 && !h1.querySelector('.ayuda-btn')) h1.insertAdjacentHTML('beforeend', ` <button type="button" class="ayuda-btn" data-ayuda="${pant.id}" aria-label="Ayuda de esta pantalla">?</button>`);
  const activa = pant.oculta ? 'mas' : pant.id;                      // las pantallas ocultas cuelgan de «Más»
  document.getElementById('tabs').innerHTML = PANTALLAS.filter(p => !p.oculta).map(p =>
    `<button type="button" data-nav="${p.id}" ${p.id === activa ? 'aria-current="page"' : ''}><span class="ico" aria-hidden="true">${p.icono}</span>${p.titulo}</button>`).join('');
  if (S.ultimoError) avisar(S.ultimoError);
}

document.addEventListener('click', ev => {
  const ay = ev.target.closest('[data-ayuda]');
  if (ay) { ev.preventDefault(); abrirAyuda(ay.dataset.ayuda); return; }
  const nav = ev.target.closest('[data-nav]');
  if (nav) {
    actual = nav.dataset.nav;
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

S.cargar();
Mas.aplicarAspecto();
S.alCambiar(dibujar);
dibujar();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
