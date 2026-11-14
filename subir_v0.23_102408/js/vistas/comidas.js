// «Comidas de hoy» (se muestra dentro de Hoy): lo previsto en cada franja y lo que se comió de verdad.
// Guarda, por fecha y franja, el estado y el texto; de ahí saldrán «lo que hace más tiempo que no como» y la comparación con el menú.
import * as S from '../store.js';
import { esc, diaVista, esOtroDia } from '../util.js';
import { abrirHoja, campo, avisar } from '../ui.js';
import { abrirGasto, candidatos } from '../gasto.js';
import { abrirCambiar } from './menu.js';

const PLANEABLES = new Set(['comida', 'cena']);                 // estas dos se planean en la pestaña Menú

export const FRANJAS = [['desayuno', 'Desayuno', 'comida_desayuno'], ['media', 'Media mañana', 'comida_media'], ['comida', 'Comida', 'comida_comida'], ['cena', 'Cena', 'comida_cena']];
const ahora = () => esOtroDia() ? '' : new Date().toTimeString().slice(0, 5);          // en otro día no se apunta la hora de ahora
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
// Lo previsto de cada franja: si en la pestaña Menú has planeado la comida o la cena de ese día, eso; si no, lo fijo de «Mis comidas fijas».
const previsto = (k, clave) => { const d = S.datos(), p = (d.plan || {})[diaVista()]?.[k]; return (p && p.texto) ? p.texto : (d.ajustes[clave] || ''); };
const diaCom = f => ((S.datos().comidas ||= {})[f] ||= {});

export function render() {
  const aj = S.datos().ajustes, reg = diaCom(diaVista());
  const hechas = FRANJAS.filter(([k]) => reg[k] && reg[k].estado).length;
  return `
    <h2>Comidas <span class="chip ${hechas === 4 ? 'ok' : ''}" style="text-transform:none;letter-spacing:0">${hechas} de 4</span></h2>
    ${FRANJAS.map(([k, t, clave]) => {
      const r = reg[k], prev = previsto(k, clave);
      const estado = !r ? '' : r.estado === 'comi' ? `<span class="chip ok">comido${r.hora ? ' ' + esc(r.hora) : ''}</span>` : r.estado === 'cambie' ? `<span class="chip warn">cambiado${r.hora ? ' ' + esc(r.hora) : ''}</span>` : `<span class="chip">no comí</span>`;
      return `<div class="item" style="display:block;${r && (r.estado === 'comi' || r.estado === 'cambie') ? 'border-color:var(--ok);background:var(--ok-soft)' : ''}">
        <div class="fila sep"><span class="nom">${t}</span>${estado}</div>
        <div class="det" style="margin:2px 0 8px">${r && r.texto && r.estado !== 'no' ? esc(r.texto) : prev ? 'Previsto: ' + esc(prev) : 'Sin menú fijo: apunta lo que comas'}</div>
        <div class="fila">
          ${prev && !r ? `<button type="button" class="btn mini grow" data-act="com-ok" data-k="${k}">✔ Lo previsto</button>` : ''}
          <button type="button" class="btn mini grow" data-act="com-otro" data-k="${k}">${r ? 'Cambiar' : prev ? 'Comí otra cosa' : 'Apuntar'}</button>
          ${!r ? `<button type="button" class="btn mini" data-act="com-no" data-k="${k}" aria-label="No comí">✕</button>` : `<button type="button" class="btn mini" data-act="com-borrar" data-k="${k}" aria-label="Borrar registro">↺</button>`}
        </div></div>`;
    }).join('')}`;
}

function productosDe(texto) {                                   // ids del catálogo que coinciden con lo escrito (separado por comas)
  const cat = S.datos().catalogo, ids = [];
  for (const parte of String(texto).split(/,| con | y /)) { const k = norm(parte); if (k.length < 3) continue; const c = cat.find(p => norm(p.nombre) === k); if (c) ids.push(c.id); }
  return ids;
}

export function acciones(act, el) {
  const d = S.datos(), reg = diaCom(diaVista()), k = el.dataset.k, fr = FRANJAS.find(x => x[0] === k);
  if (!fr) return false;
  if (act === 'com-ok') {                                   // comí lo previsto: se apunta y se ofrece descontar del almacén lo que estaba previsto
    reg[k] = { estado: 'comi', texto: previsto(k, fr[2]), hora: ahora(), prods: [] }; S.guardar();
    const pl = ((d.plan || {})[diaVista()] || {})[k];
    if (PLANEABLES.has(k) && !(pl && pl.fuera)) {
      if (pl && (pl.ids || []).length) setTimeout(() => abrirGasto(reg[k].texto, pl.ids), 0);
      else if (/tortilla|huevo/i.test(reg[k].texto) || candidatos(reg[k].texto).length) setTimeout(() => abrirGasto(reg[k].texto), 0);      // la cena fija (tortilla) también gasta del almacén
    }
    return true;
  }
  if (act === 'com-no') { reg[k] = { estado: 'no', texto: '', hora: ahora(), prods: [] }; S.guardar(); return true; }
  if (act === 'com-borrar') { delete reg[k]; S.guardar(); return true; }
  if (act === 'com-otro' && PLANEABLES.has(k)) {              // comida y cena: se corrige lo real en la misma ventana del Menú y se descuenta lo que se usó
    const antes = ((d.plan || {})[diaVista()] || {})[k] || {}, textoAntes = antes.texto || previsto(k, fr[2]), idsAntes = (antes.ids || []).slice().sort().join();
    abrirCambiar(diaVista(), k, hecho => {
      const igual = norm(hecho.texto) === norm(textoAntes) && (hecho.ids || []).slice().sort().join() === idsAntes;
      reg[k] = { estado: igual ? 'comi' : 'cambie', texto: hecho.texto, hora: ahora(), prods: productosDe(hecho.texto) }; S.guardar();
      if (!hecho.fuera && (hecho.ids || []).length) abrirGasto(hecho.texto, hecho.ids); else if (!hecho.fuera) abrirGasto(hecho.texto);
    });
    return false;
  }
  if (act === 'com-otro') {
    const r = reg[k];
    abrirHoja(`<h1>${esc(fr[1])}</h1><p class="sub">Lo que comiste de verdad.</p>
      ${campo('¿Qué comiste?', `<input name="texto" required value="${esc(r?.texto || '')}" list="lista-com" autocomplete="off" placeholder="p. ej. contramuslo con media ensalada de sobre">`)}
      <datalist id="lista-com">${d.catalogo.map(c => `<option value="${esc(c.nombre)}">`).join('')}</datalist>
      ${campo('Hora', `<input name="hora" type="time" value="${esc(r?.hora || ahora())}">`)}
      <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>`, f => {
      const texto = (f.texto || '').trim(); if (!texto) { avisar('Apunta qué comiste.'); return false; }
      reg[k] = { estado: 'cambie', texto, hora: f.hora || ahora(), prods: productosDe(texto) };
      if (norm(texto) === norm(previsto(k, fr[2]))) reg[k].estado = 'comi';
      S.guardar(); setTimeout(() => abrirGasto(texto), 0); return true;
    });
    return true;
  }
  return false;
}
