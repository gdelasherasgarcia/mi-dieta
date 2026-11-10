// Pantalla «Más»: aspecto y copia de seguridad.
import * as S from '../store.js';
import { esc, hoy } from '../util.js';
import { avisar, confirmar, abrirHoja, campo } from '../ui.js';
import * as IA from '../ia.js';

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

    <h2>Inteligencia artificial</h2>
    <div class="card">
      <p style="margin-top:0">${IA.configurada() ? `Conectada: <b>${esc(IA.etiqueta(IA.config()))}</b>${[IA.config().respaldo, IA.config().respaldo2].filter(IA.valida).map(x => ` · respaldo: <b>${esc(IA.etiqueta(x))}</b>`).join('')}. Se usa para rellenar fichas de medicamentos y para proponer menús y recetas.` : 'Sin conectar. Si conectas una IA, la app puede rellenar fichas de medicamentos y proponer menús sola. Sin ella, sigues copiando y pegando a mano.'}</p>
      <button type="button" class="btn grande" data-act="ia-conectar">🤖 ${IA.configurada() ? 'Cambiar o desconectar la IA' : 'Conectar una IA'}</button>
    </div>

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
  if (act === 'ia-conectar') {
    const c = IA.config() || {}, r = c.respaldo || {}, r2 = c.respaldo2 || {}, ops = (sel, vacio) => (vacio ? `<option value="">${vacio}</option>` : '') + Object.entries(IA.PRESETS).map(([k, v]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${esc(v.nombre)}</option>`).join('');
    abrirHoja(`<h1>Conectar una IA</h1>
      <p class="det" style="white-space:pre-line">⚠ ${esc(IA.AVISO_DATOS)}</p>
      <h2>IA principal</h2>
      <label class="campo"><span>¿Qué IA?</span><select name="preset">${ops(IA.presetDe(c))}</select></label>
      ${campo('Clave de la IA (API key)', `<input name="clave" type="password" value="${esc(c.clave || '')}" autocomplete="off" placeholder="la que te da el proveedor">`)}
      ${campo('Modelo (vacío = el habitual de esa IA)', `<input name="modelo" value="${esc(c.modelo || '')}" autocomplete="off" placeholder="p. ej. gemini-2.5-flash">`)}
      ${campo('Dirección base (solo si es «otra»)', `<input name="url" value="${esc(c.url || '')}" autocomplete="off" placeholder="https://api.openai.com/v1">`)}
      <h2>IA de respaldo (opcional)</h2>
      <p class="det" style="margin:-4px 0 8px">Si la principal falla (servidor saturado, límite gratuito), la app prueba sola con esta. Lo mejor es que sea de otro proveedor.</p>
      <label class="campo"><span>¿Cuál?</span><select name="r_preset">${ops(r.preset || (IA.valida(r) ? IA.presetDe(r) : ''), 'Sin respaldo')}</select></label>
      ${campo('Clave del respaldo', `<input name="r_clave" type="password" value="${esc(r.clave || '')}" autocomplete="off">`)}
      ${campo('Modelo del respaldo (vacío = el habitual)', `<input name="r_modelo" value="${esc(r.modelo || '')}" autocomplete="off">`)}
      ${campo('Dirección base del respaldo (solo si es «otra»)', `<input name="r_url" value="${esc(r.url || '')}" autocomplete="off">`)}
      <h2>Segunda IA de respaldo (opcional)</h2>
      <p class="det" style="margin:-4px 0 8px">Si fallan la principal y la primera de respaldo, la app prueba con esta.</p>
      <label class="campo"><span>¿Cuál?</span><select name="r2_preset">${ops(r2.preset || (IA.valida(r2) ? IA.presetDe(r2) : ''), 'Sin segundo respaldo')}</select></label>
      ${campo('Clave del segundo respaldo', `<input name="r2_clave" type="password" value="${esc(r2.clave || '')}" autocomplete="off">`)}
      ${campo('Modelo del segundo respaldo (vacío = el habitual)', `<input name="r2_modelo" value="${esc(r2.modelo || '')}" autocomplete="off">`)}
      ${campo('Dirección base del segundo respaldo (solo si es «otra»)', `<input name="r2_url" value="${esc(r2.url || '')}" autocomplete="off">`)}
      <label class="fila" style="min-height:44px"><input type="checkbox" onchange="for (const n of ['clave', 'r_clave', 'r2_clave']) this.form[n].type = this.checked ? 'text' : 'password'"> Ver las claves (para comprobar que están bien pegadas)</label>
      <details style="margin-bottom:10px"><summary style="min-height:44px;display:flex;align-items:center;font-weight:700">Dónde conseguir cada clave</summary>${Object.values(IA.PRESETS).map(v => `<p class="det"><b>${esc(v.nombre)}:</b> ${esc(v.ayuda)}</p>`).join('')}<p class="det">Los límites y condiciones gratuitos los fija cada proveedor y pueden cambiar.</p></details>
      <p class="det">Las claves se guardan solo en este móvil, aparte de tus datos: no van en las copias de seguridad.</p>
      <div class="pila"><button class="btn main" type="submit" value="probar">Probar y guardar</button>${IA.configurada() ? '<button class="btn peligro" type="submit" value="desconectar-ia">Desconectar la IA</button>' : ''}</div>
      ${IA.pieIA()}`, (f, acc) => {
      if (acc === 'desconectar-ia') { IA.guardarConfig(null); avisar('IA desconectada.'); S.guardar(); return true; }
      for (const [k, n] of [['clave', 'de la IA principal'], ['r_clave', 'del respaldo'], ['r2_clave', 'del segundo respaldo']]) if (f[k] && IA.claveRara(f[k])) { avisar('La clave ' + n + ' tiene espacios, saltos de línea o signos raros (¿un «…» al copiar?). Pégala de nuevo.', 8000); return false; }
      const prin = IA.desdeFormulario(f.preset, f.clave, f.modelo, f.url);
      if (!prin.clave) { avisar('Falta la clave de la IA principal.'); return false; }
      if (!IA.valida(prin)) { avisar('Para esa IA hacen falta la dirección y el modelo.'); return false; }
      let resp = null;
      if (f.r_preset) {
        resp = IA.desdeFormulario(f.r_preset, f.r_clave, f.r_modelo, f.r_url);
        if (!resp.clave) { avisar('Falta la clave del respaldo (o elige «Sin respaldo»).'); return false; }
        if (!IA.valida(resp)) { avisar('Para la IA de respaldo hacen falta la dirección y el modelo.'); return false; }
      }
      let resp2 = null;
      if (f.r2_preset) {
        resp2 = IA.desdeFormulario(f.r2_preset, f.r2_clave, f.r2_modelo, f.r2_url);
        if (!resp2.clave) { avisar('Falta la clave del segundo respaldo (o elige «Sin segundo respaldo»).'); return false; }
        if (!IA.valida(resp2)) { avisar('Para el segundo respaldo hacen falta la dirección y el modelo.'); return false; }
      }
      IA.guardarConfig({ ...prin, respaldo: resp, respaldo2: resp2 }); avisar('Probando la conexión…', 40000);       // se guarda SIEMPRE: si la prueba falla (límite, red…) no hay que volver a pegar la clave
      const prueba = c2 => IA.preguntarA(c2, 'Responde solo con la palabra: ok');
      Promise.allSettled([prueba(prin), resp ? prueba(resp) : Promise.resolve(null), resp2 ? prueba(resp2) : Promise.resolve(null)]).then(([a, b, b2]) => {
        const txt = (cfg, x, extra = '') => `${IA.etiqueta(cfg)}${extra}: ${x.status === 'fulfilled' ? 'conectada' : 'falla (' + x.reason.message + ')'}`;
        avisar([txt(prin, a), resp ? txt(resp, b, ' (respaldo)') : '', resp2 ? txt(resp2, b2, ' (2.º respaldo)') : ''].filter(Boolean).join(' · ') + '. Guardado.', 11000); S.guardar();
      });
      return true;
    });
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
