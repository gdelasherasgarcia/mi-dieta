// Pantalla «Menú»: los próximos 6 días (desayuno, media mañana, comida, cena), con «Cambiar» por partes,
// y el puente con una IA: un prompt que la pone al día y una forma de pegar su respuesta y aplicarla tras revisarla.
import * as S from '../store.js';
import { esc, hoy, desdeIso, iso, diaSemana, fechaCorta } from '../util.js';
import { abrirHoja, campo, avisar } from '../ui.js';
import { proponer, faltantes } from '../generador.js';

const DIAS = 6;
const sumaDias = (f, n) => iso(new Date(desdeIso(f).getTime() + n * 86400000));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const plan = f => ((S.datos().plan ||= {})[f] ||= {});
const lista = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
// Palabras que no deben aparecer en un menú propuesto (no por ahora / sal). El enfermero decide cuándo se quitan.
const NO_POR_AHORA = ['ternera', 'cerdo', 'cordero', 'jamón serrano', 'jamon serrano', 'chorizo', 'salchicha', 'embutido', 'gamba', 'marisco', 'mejillón', 'mejillon', 'calamar', 'sardina', 'anchoa', 'alcohol', 'vino', 'cerveza', 'chuletón', 'chuleton', 'bacon', 'panceta'];

function franjaTexto(f, k) {
  const aj = S.datos().ajustes, p = plan(f)[k];
  if (p && p.fuera) return { txt: p.texto || 'Fuera de casa', fuera: true, ids: [] };
  if (p && (p.texto || p.ids?.length)) return { txt: p.texto, ids: p.ids || [], gen: !!p.gen };
  if (k === 'cena') return { txt: aj.comida_cena || '', fijo: true, ids: [] };
  return { txt: '', ids: [] };
}
const enCongelador = ids => ids.map(i => S.datos().nevera.find(p => p.id === i)).filter(p => p && p.ubicacion === 'congelador');

export function render() {
  const d = S.datos(), aj = d.ajustes, f0 = hoy();
  const dias = Array.from({ length: DIAS }, (_, i) => sumaDias(f0, i));
  return `
    <div class="fila sep"><div><h1>Menú</h1><p class="sub" style="margin:0">Próximos ${DIAS} días · ${esc(aj.supermercado || '')}, compra ${aj.compra_dias === 1 ? 'cada día' : 'cada ' + aj.compra_dias + ' días'}</p></div></div>
    <div style="height:10px"></div>
    <div class="fila"><button type="button" class="btn main grow" data-act="menu-proponer">✨ Proponer menú</button><button type="button" class="btn grow" data-nav="recetas">📖 Recetario (${d.recetas.filter(r => r.estado === 'aceptada').length})</button></div>
    <div class="fila" style="margin:8px 0 12px"><button type="button" class="btn grow" data-act="menu-fijas">🍽 Mis comidas fijas</button><button type="button" class="btn grow" data-act="menu-lista">🧺 Qué me falta para el menú</button></div>
    ${dias.map((f, i) => {
      const com = franjaTexto(f, 'comida'), cen = franjaTexto(f, 'cena');
      const sacar = [...enCongelador(com.ids), ...enCongelador(cen.ids)];
      const fila = (t, x, k) => `<div style="margin:8px 0">
        <div class="fila sep"><span class="det">${t}</span>${k ? `<button type="button" class="btn mini" data-act="menu-cambiar" data-f="${f}" data-k="${k}">Cambiar</button>` : ''}</div>
        <div style="${x.txt ? '' : 'color:var(--muted)'}">${x.txt ? esc(x.txt) : 'Sin planear'}${x.fuera ? ' <span class="chip warn">fuera</span>' : ''}${x.gen ? ' <span class="chip">propuesto</span>' : ''}${x.fijo ? ' <span class="chip">fijo</span>' : ''}</div></div>`;
      return `<div class="card" style="${i === 0 ? 'border-color:var(--accent)' : ''}">
        <div class="fila sep"><b>${i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : diaSemana(f)} <span class="det">${esc(fechaCorta(f))}</span></b></div>
        ${fila('Desayuno', { txt: aj.comida_desayuno, fijo: true })}${fila('Media mañana', { txt: aj.comida_media, fijo: true })}
        ${fila('Comida', com, 'comida')}${fila('Cena', cen, 'cena')}
        ${sacar.length ? `<div class="det" style="color:var(--warn);margin-top:4px">❄ Saca del congelador el ${i === 0 ? 'día anterior (ya)' : esc(diaSemana(sumaDias(f, -1)))}: ${esc(sacar.map(p => p.nombre.split(',')[0]).join(', '))}</div>` : ''}</div>`;
    }).join('')}
    <h2>Con una IA</h2>
    <div class="card">
      <p style="margin-top:0">La IA no ve la app: le das un texto que la pone al día de lo que tienes y lo que buscas, y luego pegas aquí lo que conteste. Antes de aplicar nada, lo reviso con las reglas de tu dieta.</p>
      <button type="button" class="btn grande" data-act="menu-prompt">1 · Copiar el texto para la IA</button>
      <button type="button" class="btn grande" style="margin-top:10px" data-act="menu-pegar">2 · Pegar la respuesta de la IA</button>
    </div>
    <p class="nota-pie">Esta app no es un médico. Las reglas de salud son tuyas y de tu enfermero; la IA no las cambia.</p>`;
}

function promptIA() {
  const d = S.datos(), aj = d.ajustes, f0 = hoy();
  const stock = d.nevera.slice().sort((a, b) => a.ubicacion.localeCompare(b.ubicacion)).map(p => `- ${p.nombre} | ${p.cantidad} ${p.unidad} | ${p.ubicacion}${p.caducidad ? ' | caduca ' + p.caducidad : ''}${p.abierto ? ' | ABIERTO ' + p.abierto + (p.dias_abierto ? ' (consumir en ' + p.dias_abierto + ' d)' : '') : ''}`).join('\n');
  const comido = [];
  for (let i = -6; i <= 0; i++) { const f = sumaDias(f0, i), r = d.comidas?.[f]; if (!r) continue; for (const [k, v] of Object.entries(r)) if (v.estado && v.estado !== 'no') comido.push(`${f} ${k}: ${v.texto}`); }
  const hecho = Array.from({ length: DIAS }, (_, i) => sumaDias(f0, i)).map(f => { const c = franjaTexto(f, 'comida'), n = franjaTexto(f, 'cena'); return `${f} (${diaSemana(f)}): comida=${c.txt || '—'}${c.fuera ? ' [FUERA]' : ''}; cena=${n.txt || '—'}${n.fuera ? ' [FUERA]' : ''}`; }).join('\n');
  const fechas = Array.from({ length: DIAS }, (_, i) => sumaDias(f0, i));
  return `Eres mi asistente de menús. Hablamos en español, claro y corto. Tu trabajo: proponerme la COMIDA y la CENA de los próximos ${DIAS} días. No eres médico: las reglas de salud son mías y de mi enfermero, tú no las cambias.

PRIORIDADES (en este orden): 1) salud (reglas duras de abajo), 2) gastar lo que caduca antes, 3) usar lo que ya tengo, 4) incluir habituales que llevo más tiempo sin comer, 5) solo entonces, cosas por comprar. Si hay fiestas o cenas fuera, ajusta la duración y el reparto, SIN recortar cantidades para compensar ni proponer ayunos.

REGLAS DURAS
- Sin sal añadida; evita embutidos, adobados salados y procesados. Nada de alcohol.
- Carnes permitidas hoy: pollo (sin piel), conejo y pavo. Pescado, ternera, cerdo magro, gambas y marisco: NO por ahora (en estudio con el enfermero).
- Desayuno fijo: ${aj.comida_desayuno}. Media mañana: ${aj.comida_media}. (No los toques.)
- Cena: ${aj.comida_cena}. Rellenos permitidos: ${aj.tortilla_rellenos}. Siempre lleva: ${aj.tortilla_siempre}. Aún NO: ${aj.tortilla_estudio}. Un solo huevo por la noche.
- Comida (la parte variable): comida de verdad, 600-800 kcal, 50-60 g de proteína (pollo/conejo/pavo + legumbres + verdura), con aceite de oliva en vaporizador. Patata pequeña al microondas (150-200 g) como guarnición posible.
- Objetivo del día 1.700-1.900 kcal y 90-100 g de proteína.
- Soy muy sensible a la comida emocional: prefiero reglas simples y fijas. Los fallos se resuelven volviendo a la siguiente comida, no compensando.
- Cocino con microondas, horno, sartén, freidora de aire y batidora de mano. Hago la compra a pie, cada ${aj.compra_dias === 1 ? 'día' : aj.compra_dias + ' días'}, en ${aj.supermercado}.
- Lo congelado hay que sacarlo a la nevera el día anterior.

LO QUE TENGO EN CASA AHORA (nombre exacto | cantidad | sitio | caducidad):
${stock}

LO QUE HE COMIDO ESTOS ÚLTIMOS DÍAS:
${comido.join('\n') || '(sin registro todavía)'}

MENÚ ACTUAL (puede haber cosas fijadas por mí; no las cambies si no te lo pido):
${hecho}

AHORA PROPÓN: la comida y la cena de estas fechas: ${fechas.join(', ')}.
Para cada plato di en "usa" los productos de casa que gastas, con el NOMBRE EXACTO de la lista de arriba. Si falta algo, ponlo en "comprar".
Responde SOLO con un bloque JSON, sin texto antes ni después, con esta forma:
{"menu":[{"fecha":"AAAA-MM-DD","comida":{"texto":"...","usa":["nombre exacto"],"comprar":["..."]},"cena":{"texto":"...","usa":["nombre exacto"],"comprar":["..."]}}],"notas":"una frase con lo más importante"}`;
}

const parsear = t => { const m = String(t).replace(/```(?:json)?/gi, '').match(/\{[\s\S]*\}/); if (!m) throw new Error('No encuentro un bloque JSON en la respuesta.'); return JSON.parse(m[0]); };

export function acciones(act, el) {
  const d = S.datos();
  if (act === 'menu-prompt') {
    abrirHoja(`<h1>Texto para la IA</h1><p class="sub">Cópialo entero (mantén pulsado → seleccionar todo → copiar) y pégalo en la IA.</p>
      <textarea readonly rows="16" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--card);padding:10px;font-family:monospace;font-size:.75rem">${esc(promptIA())}</textarea>`, () => true);
    return true;
  }
  if (act === 'menu-pegar') {
    abrirHoja(`<h1>Respuesta de la IA</h1><p class="sub">Pega aquí el JSON que te dé. Lo reviso antes de aplicar nada.</p>
      <textarea name="resp" rows="10" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--card);padding:10px;font-family:monospace;font-size:.75rem" placeholder='{"menu":[…]}'></textarea>
      <div class="fila" style="margin-top:10px"><button class="btn main grow" type="submit" value="revisar">Revisar</button></div>`, f => {
      let r; try { r = parsear(f.resp); } catch (e) { avisar('No he podido leerlo: ' + e.message); return false; }
      if (!Array.isArray(r.menu) || !r.menu.length) { avisar('La respuesta no trae «menu».'); return false; }
      setTimeout(() => revisar(r), 0); return true;
    });
    return true;
  }
  if (act === 'menu-cambiar') {
    const f = el.dataset.f, k = el.dataset.k, cur = plan(f)[k] || {}, marc = new Set(cur.ids || []);
    const stock = d.nevera.slice().sort((a, b) => (a.ubicacion === 'congelador' ? 0 : 1) - (b.ubicacion === 'congelador' ? 0 : 1) || a.nombre.localeCompare(b.nombre, 'es'));
    const rell = lista(d.ajustes.tortilla_rellenos);
    abrirHoja(`<h1>${k === 'comida' ? 'Comida' : 'Cena'} · ${esc(diaSemana(f))} ${esc(fechaCorta(f))}</h1>
      ${k === 'cena' ? `<label class="campo"><span>Tortilla de…</span><select name="relleno"><option value="">— otra cosa —</option>${rell.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>` : ''}
      ${campo('¿Qué vas a comer?', `<input name="texto" value="${esc(cur.texto || '')}" autocomplete="off" placeholder="${k === 'comida' ? 'p. ej. contramuslo con ensalada' : 'o deja la tortilla de arriba'}">`)}
      <label class="fila" style="min-height:44px"><input type="checkbox" name="fuera" value="1" ${cur.fuera ? 'checked' : ''} style="width:24px;height:24px"> Como fuera de casa</label>
      <p class="det" style="margin:4px 0">Lo de casa que vas a usar (si es del congelador, te aviso el día antes):</p>
      <div class="card" style="max-height:30vh;overflow:auto">${stock.map(p => `<label class="fila" style="min-height:44px"><input type="checkbox" name="i_${esc(p.id)}" value="1" ${marc.has(p.id) ? 'checked' : ''} style="width:24px;height:24px"> <span>${esc(p.nombre.slice(0, 48))} <span class="det">(${esc(p.ubicacion)}, ${esc(p.cantidad)} ${esc(p.unidad)})</span></span></label>`).join('')}</div>
      <div class="fila" style="margin-top:10px"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
      ${plan(f)[k] ? '<button class="btn grande" style="margin-top:10px" type="submit" value="quitar">Quitar lo planeado</button>' : ''}`, (g, acc) => {
      if (acc === 'quitar') { delete plan(f)[k]; S.guardar(); return true; }
      const ids = d.nevera.filter(p => g['i_' + p.id] === '1').map(p => p.id);
      let texto = (g.texto || '').trim();
      if (!texto && g.relleno) texto = `Tortilla de ${g.relleno.toLowerCase()} con ${(d.ajustes.tortilla_siempre || 'tomates cherry').toLowerCase()}`;
      if (!texto && g.fuera === '1') texto = 'Fuera de casa';
      if (!texto && !ids.length) { avisar('Apunta qué vas a comer.'); return false; }
      plan(f)[k] = { texto, ids, fuera: g.fuera === '1' }; S.guardar(); return true;
    });
    return true;
  }
  if (act === 'menu-proponer') {
    const dias = Array.from({ length: DIAS }, (_, i) => sumaDias(hoy(), i)), prop = proponer(dias);
    const filas = prop.map(p => {
      const com = p.comida === null ? '<span class="det">se queda como está (fijado o fuera)</span>' : p.comida.sinOpcion ? '<span class="chip warn">sin plato que encaje</span>' :
        `<b>${esc(p.comida.rec.nombre)}</b><div class="det">${p.comida.n.kcal} kcal · ${p.comida.n.prot} g proteína${p.comida.motivos.length ? ' · ' + esc(p.comida.motivos.join('; ')) : ''}${p.comida.faltan.length ? ' · falta: ' + esc(p.comida.faltan.join(', ')) : ''}</div>`;
      const cen = p.cena === null ? '<span class="det">se queda como está</span>' : !p.cena ? '' : `Tortilla de ${esc(p.cena.relleno.toLowerCase())} con ${esc((d.ajustes.tortilla_siempre || 'tomates cherry').toLowerCase())}${p.cena.motivos.length ? '<div class="det">' + esc(p.cena.motivos.join('; ')) + '</div>' : ''}`;
      return `<div class="card"><b>${p.i === 0 ? 'Hoy' : p.i === 1 ? 'Mañana' : esc(diaSemana(p.f))} <span class="det">${esc(fechaCorta(p.f))}</span></b><div style="margin-top:4px"><span class="det">Comida:</span> ${com}</div><div style="margin-top:4px"><span class="det">Cena:</span> ${cen}</div></div>`;
    }).join('');
    abrirHoja(`<h1>Propuesta de menú</h1><p class="sub">Salud primero, luego lo que caduca, lo que ya tienes, lo que hace más que no comes y, al final, lo que haya que comprar.</p>${filas}
      <div class="fila"><button class="btn main grow" type="submit" value="aplicar">Aplicar</button><button class="btn grow" type="submit" value="no">No aplicar</button></div>
      <p class="nota-pie">Aplicar no toca lo que ya fijaste a mano ni los días «fuera». Después puedes cambiar cualquier parte con «Cambiar».</p>`, (g, acc) => {
      if (acc !== 'aplicar') return true;
      let n = 0;
      for (const p of prop) {
        if (p.comida && p.comida.rec) { plan(p.f).comida = { texto: p.comida.rec.nombre, ids: p.comida.ids, fuera: false, gen: true, receta: p.comida.rec.id }; n++; }
        if (p.cena && p.cena.relleno) { plan(p.f).cena = { texto: `Tortilla de ${p.cena.relleno.toLowerCase()} con ${(d.ajustes.tortilla_siempre || 'tomates cherry').toLowerCase()}`, ids: p.cena.ids, fuera: false, gen: true, relleno: p.cena.relleno }; n++; }
      }
      S.guardar(); avisar(`${n} platos propuestos aplicados.`); return true;
    });
    return true;
  }
  if (act === 'menu-fijas') {
    const aj = d.ajustes, v = k => esc(aj[k] || '');
    abrirHoja(`<h1>Mis comidas fijas</h1><p class="sub">Lo que comes cada día igual. Sale en Hoy como lo previsto y el menú lo respeta; la comida es la parte variable y se apunta cada día.</p>
      ${campo('Desayuno', `<input name="comida_desayuno" value="${v('comida_desayuno')}" autocomplete="off">`)}
      ${campo('Media mañana', `<input name="comida_media" value="${v('comida_media')}" autocomplete="off">`)}
      ${campo('Cena', `<input name="comida_cena" value="${v('comida_cena')}" autocomplete="off">`)}
      ${campo('Tortilla: rellenos que ya puedo comer', `<input name="tortilla_rellenos" value="${v('tortilla_rellenos')}" autocomplete="off">`)}
      ${campo('Tortilla: siempre lleva', `<input name="tortilla_siempre" value="${v('tortilla_siempre')}" autocomplete="off">`)}
      ${campo('En estudio (aún no; preguntar al enfermero)', `<input name="tortilla_estudio" value="${v('tortilla_estudio')}" autocomplete="off">`)}
      <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>`, f => {
      for (const k of ['comida_desayuno', 'comida_media', 'comida_cena', 'tortilla_rellenos', 'tortilla_siempre', 'tortilla_estudio']) aj[k] = (f[k] || '').trim();
      S.guardar(); avisar('Comidas fijas guardadas.'); return true;
    });
    return true;
  }
  if (act === 'menu-lista') {
    const dias = Array.from({ length: DIAS }, (_, i) => sumaDias(hoy(), i)), fal = faltantes(dias);
    abrirHoja(`<h1>Qué me falta para el menú</h1><p class="det">Ayuda: la app compara los platos del menú de los próximos ${DIAS} días con lo que tienes en el almacén y te dice qué ingredientes faltan. Lo que dejes marcado se añade a la pestaña Compra.</p>${fal.length ? `<p class="sub">Esto falta en casa para los platos propuestos. Desmarca lo que no quieras comprar:</p>${fal.map((x, i) => `<label class="fila" style="min-height:44px;align-items:flex-start"><input type="checkbox" name="i${i}" value="1" checked> <span>${esc(x.nombre)} · unos ${Math.round(x.g / 10) * 10} g <span class="det">(${esc(x.dias.map(f => diaSemana(f)).join(', '))})</span></span></label>`).join('')}
      <div class="fila"><button class="btn main grow" type="submit" value="anadir">Añadir lo marcado a la lista</button><button class="btn grow" type="submit" value="no">Cerrar</button></div>` : '<div class="card vacio">No falta nada para lo que hay en el menú. O todavía no has propuesto ningún plato.</div>'}`, (g, acc) => {
      if (acc !== 'anadir') return true;
      let n = 0; for (const [i, x] of fal.entries()) { if (g['i' + i] !== '1') continue; if (d.compra.some(c => norm(c.nombre) === norm(x.nombre))) continue; d.compra.push({ id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), nombre: x.nombre, cantidad: Math.max(50, Math.round(x.g / 50) * 50), unidad: 'g', nota: 'Menú: ' + x.dias.map(f => diaSemana(f)).join(', '), hecho: false }); n++; }
      S.guardar(); avisar(`${n} productos añadidos a la lista de la compra.`); return true;
    });
    return true;
  }
  if (act === 'menu-aplicar') return false;
  return false;
}

function revisar(r) {
  const d = S.datos(), f0 = hoy(), validas = new Set(Array.from({ length: DIAS }, (_, i) => sumaDias(f0, i)));
  const filas = []; const aplicables = [];
  for (const dia of r.menu) {
    if (!validas.has(dia.fecha)) { filas.push(`<div class="card" style="border-color:var(--bad)"><b>${esc(dia.fecha || '?')}</b>: fecha fuera de los próximos ${DIAS} días. Se ignora.</div>`); continue; }
    for (const k of ['comida', 'cena']) {
      const p = dia[k]; if (!p || !p.texto) continue;
      const av = [], ids = [], texto = String(p.texto);
      const bajo = norm(texto + ' ' + (p.usa || []).join(' '));
      for (const mala of NO_POR_AHORA) if (bajo.includes(norm(mala))) av.push(`contiene «${mala}» (no por ahora)`);
      for (const n of (p.usa || [])) { const it = d.nevera.find(x => norm(x.nombre) === norm(n)) || d.nevera.find(x => norm(x.nombre).includes(norm(n)) && norm(n).length > 4); if (it) ids.push(it.id); else av.push(`«${n}» no está en el almacén`); }
      const bloqueo = av.some(a => /no por ahora/.test(a));
      filas.push(`<div class="card" style="${bloqueo ? 'border-color:var(--bad)' : av.length ? 'border-color:var(--warn)' : ''}"><div class="det">${esc(diaSemana(dia.fecha))} ${esc(fechaCorta(dia.fecha))} · ${k}</div><div>${esc(texto)}</div>
        ${(p.comprar || []).length ? `<div class="det">Comprar: ${esc(p.comprar.join(', '))}</div>` : ''}${av.map(a => `<div class="chip ${/no por ahora/.test(a) ? 'bad' : 'warn'}" style="margin-top:4px">${esc(a)}</div>`).join(' ')}</div>`);
      if (!bloqueo) aplicables.push({ f: dia.fecha, k, texto, ids });
    }
  }
  abrirHoja(`<h1>Revisión</h1><p class="sub">${esc(r.notas || '')}</p>${filas.join('') || '<div class="card vacio">No hay nada que aplicar.</div>'}
    <p class="det">Se pueden aplicar ${aplicables.length} platos. Los marcados en rojo no se aplican (no encajan con tus reglas). No pisa los que ya marcaste «fuera».</p>
    <div class="fila"><button class="btn main grow" type="submit" value="aplicar" ${aplicables.length ? '' : 'disabled'}>Aplicar ${aplicables.length}</button><button class="btn grow" type="submit" value="no">No aplicar</button></div>`, (g, acc) => {
    if (acc !== 'aplicar') return true;
    let n = 0; for (const a of aplicables) { const cur = plan(a.f)[a.k]; if (cur && cur.fuera) continue; plan(a.f)[a.k] = { texto: a.texto, ids: a.ids, fuera: false, ia: true }; n++; }
    S.guardar(); avisar(`${n} platos aplicados al menú.`); return true;
  });
}
