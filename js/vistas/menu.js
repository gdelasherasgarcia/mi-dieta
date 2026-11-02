// Pantalla «Menú»: los próximos 6 días (desayuno, media mañana, comida, cena), con «Cambiar» por partes,
// y el puente con una IA: un prompt que la pone al día y una forma de pegar su respuesta y aplicarla tras revisarla.
import * as S from '../store.js';
import { esc, hoy, desdeIso, iso, diaSemana, fechaCorta, diasHasta } from '../util.js';
import { caducidadEfectiva } from '../producto.js';
import { abrirHoja, campo, avisar } from '../ui.js';
import { proponer, faltantes } from '../generador.js';
import * as IA from '../ia.js';

const DIAS = 6;
const sumaDias = (f, n) => iso(new Date(desdeIso(f).getTime() + n * 86400000));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const plan = f => ((S.datos().plan ||= {})[f] ||= {});
const lista = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

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
      ${IA.configurada() ? `<button type="button" class="btn main grande" data-act="menu-ia">⚡ Pedir menú a la IA (eliges las opciones)</button>${IA.pieIA()}<p class="det" style="margin:12px 0 4px">O, a mano:</p>` : ''}
      <button type="button" class="btn grande" data-act="menu-prompt">1 · Copiar el texto para la IA</button>
      <button type="button" class="btn grande" style="margin-top:10px" data-act="menu-pegar">2 · Pegar la respuesta de la IA</button>
    </div>
    <p class="nota-pie">Esta app no es un médico. Las reglas de salud son tuyas y de tu enfermero; la IA no las cambia.</p>`;
}

function promptIA(op = null) {
  const d = S.datos(), aj = d.ajustes, f0 = hoy();
  op ||= armarOp(aj.ia_form || {}, Array.from({ length: DIAS }, (_, i) => sumaDias(f0, i)), '');
  const stock = d.nevera.slice().sort((a, b) => a.ubicacion.localeCompare(b.ubicacion)).map(p => `- ${p.nombre} | ${p.cantidad} ${p.unidad} | ${p.ubicacion}${p.caducidad ? ' | caduca ' + p.caducidad : ''}${p.abierto ? ' | ABIERTO ' + p.abierto + (p.dias_abierto ? ' (consumir en ' + p.dias_abierto + ' d)' : '') : ''}`).join('\n');
  const comido = [];
  for (let i = -6; i <= 0; i++) { const f = sumaDias(f0, i), r = d.comidas?.[f]; if (!r) continue; for (const [k, v] of Object.entries(r)) if (v.estado && v.estado !== 'no') comido.push(`${f} ${k}: ${v.texto}`); }
  const hecho = Array.from({ length: DIAS }, (_, i) => sumaDias(f0, i)).map(f => { const c = franjaTexto(f, 'comida'), n = franjaTexto(f, 'cena'); return `${f} (${diaSemana(f)}): comida=${c.txt || '—'}${c.fuera ? ' [FUERA]' : ''}; cena=${n.txt || '—'}${n.fuera ? ' [FUERA]' : ''}`; }).join('\n');
  const fechas = op.dias, F = aj.ia_form || {};
  const que = op.comidas.length > 1 ? 'la COMIDA y la CENA' : op.comidas[0] === 'comida' ? 'solo la COMIDA (no la cena)' : 'solo la CENA (no la comida)';
  const rg = (r, u) => { const [a, b] = (r || []).map(Number); return a && b ? `${a}-${b} ${u}` : a ? `al menos ${a} ${u}` : b ? `como máximo ${b} ${u}` : ''; };
  const plato = [rg(F.kcal_p, 'kcal'), rg(F.prot_p, 'de proteína')].filter(Boolean).join(', '), dia = [rg(F.kcal_d, 'kcal'), rg(F.prot_d, 'de proteína')].filter(Boolean).join(', ');
  const fijas = [
    (aj.comida_desayuno || aj.comida_media) && `- ${[aj.comida_desayuno && 'Desayuno fijo: ' + aj.comida_desayuno, aj.comida_media && 'Media mañana: ' + aj.comida_media].filter(Boolean).join('. ')}. (No los toques.)`,
    aj.comida_cena && `- Cena habitual: ${aj.comida_cena}.${aj.tortilla_rellenos ? ' Rellenos permitidos: ' + aj.tortilla_rellenos + '.' : ''}${aj.tortilla_siempre ? ' Siempre lleva: ' + aj.tortilla_siempre + '.' : ''}${aj.tortilla_estudio ? ' Aún NO: ' + aj.tortilla_estudio + '.' : ''}`,
    plato && `- Cada plato: ${plato}.`, dia && `- Objetivo del día completo: ${dia}.`,
    F.reglas && `- Mis reglas propias (respétalas):\n${String(F.reglas).split('\n').map(x => '   · ' + x.trim()).filter(x => x.length > 5).join('\n')}`,
    `- Hago la compra ${aj.compra_dias === 1 ? 'cada día' : 'cada ' + aj.compra_dias + ' días'}${aj.supermercado ? ', en ' + aj.supermercado : ''}.`,
  ].filter(Boolean).join('\n');
  const pronto = d.nevera.filter(p => Number(p.cantidad) > 0 && !(op.reserva || []).includes(corto(p.nombre))).map(p => ({ nombre: corto(p.nombre), n: diasHasta(caducidadEfectiva(p)) })).filter(x => x.n !== null && x.n >= 0 && x.n <= op.diasCaduca).sort((a, b) => a.n - b.n);
  const extra = `PETICIÓN DE ESTA VEZ (junto con mis límites fijos, es todo lo que debes respetar; no añadas restricciones por tu cuenta)
- Fechas y platos: ${que} de las fechas indicadas abajo. Lo que no te pido, no lo pongas en el JSON.
${op.salud.length ? `- CONDICIONES DE SALUD que cumples a la vez (si chocan, manda la más estricta):\n${op.salud.map(x => '   · ' + x).join('\n')}\n` : ''}${op.min ? `- Tiempo máximo: ${op.min} minutos de preparación por plato.\n` : ''}${op.aparatos.length ? `- Aparatos que usaré esta vez (solo estos): ${op.aparatos.join(', ')}.\n` : ''}${op.prot.length ? `- Proteínas: solo puedes usar ${op.prot.join(', ')}. NO uses ${op.noProt.join(', ')}.\n` : ''}${op.gustan.length ? `- Me gustan y quiero que salgan si encajan: ${op.gustan.join(', ')}.\n` : ''}${op.excl.length ? `- NO USES NUNCA estos alimentos, ni como acompañamiento: ${op.excl.join(', ')}.\n` : ''}- ${op.caducar ? (pronto.length ? `PRIORIDAD ALTA: lo que caduca en los próximos ${op.diasCaduca} días. Úsalo en estas fechas, empezando por lo que antes caduca: ${pronto.map(x => `${x.nombre} (en ${x.n} d)`).join('; ')}.` : 'Gasta primero lo que caduca antes.') : 'Lo que caduca no es prioridad esta vez.'}
${op.envases ? '- Aprovecha los envases: un bote de legumbres (o un paquete que ya abro) da dos raciones. Si un día uso medio bote, el día siguiente usa la otra mitad, y dilo en el texto.\n' : ''}
${op.usarCasa ? '- Usa primero las proteínas que ya tengo en casa (también las del congelador) antes de proponer otras; si hay una en mi lista de casa y las fechas lo permiten, que salga al menos una vez.\n' : ''}${op.protDistinta ? '- No pongas la misma proteína dos días seguidos (salvo para gastar lo que ya hay).\n' : ''}${op.variar ? '- Varía guarniciones y verduras: no repitas patata, arroz o pasta más de 2 días seguidos ni más de 3 veces en estas fechas.\n' : ''}${op.completar ? '- Si un plato no llega a la proteína pedida (p. ej. legumbres sin carne), complétalo con otro producto de mi lista de casa (huevo duro, yogur de proteína…) y escríbelo en el plato y en "usa".\n' : ''}${op.reserva.length ? `- RESERVA para un día que no pueda cocinar (NO los uses en el menú normal): ${op.reserva.join(', ')}.\n` : ''}- ${op.repetir ? 'Puedes cocinar una vez y repetir el plato en dos días seguidos (lo digo si me conviene).' : 'No repitas platos en estas fechas.'}
${op.notas ? `- Además: ${op.notas}\n` : ''}
`;  return `Eres mi asistente de menús. Hablamos en español, claro y corto. Tu trabajo: proponerme ${que} de las fechas que te indico al final. No eres médico: las reglas de salud son mías y de mi profesional sanitario, tú no las cambias.

PRIORIDADES (en este orden): 1) mis condiciones y límites (los de abajo y los de la petición de esta vez), 2) usar lo que ya tengo, 3) incluir habituales que llevo más tiempo sin comer, 4) solo entonces, cosas por comprar. Si hay fiestas o cenas fuera, ajusta la duración y el reparto, SIN recortar cantidades para compensar ni proponer ayunos.

MIS LÍMITES FIJOS
${fijas}
- Lo congelado hay que sacarlo a la nevera el día anterior.

LO QUE TENGO EN CASA AHORA (nombre exacto | cantidad | sitio | caducidad):
${stock}

LO QUE HE COMIDO ESTOS ÚLTIMOS DÍAS:
${comido.join('\n') || '(sin registro todavía)'}

MENÚ ACTUAL (puede haber cosas fijadas por mí; no las cambies si no te lo pido):
${hecho}

${extra}AHORA PROPÓN: ${que} de estas fechas: ${fechas.join(', ')}.
Para cada plato di en "usa" los productos de casa que gastas, con el NOMBRE EXACTO de la lista de arriba. Si falta algo, ponlo en "comprar".
Responde SOLO con un bloque JSON, sin texto antes ni después, con esta forma:
{"menu":[{"fecha":"AAAA-MM-DD","comida":{"texto":"...","usa":["nombre exacto"],"comprar":["..."]},"cena":{"texto":"...","usa":["nombre exacto"],"comprar":["..."]}}],"notas":"una frase con lo más importante"}`;
}

export const APARATOS = [['microondas', 'Microondas'], ['horno', 'Horno'], ['sarten', 'Sartén'], ['freidora', 'Freidora de aire (airfryer)'], ['batidora', 'Batidora de mano'], ['olla', 'Olla o cazuela'], ['crudo', 'Sin cocinar (ensaladas, bocadillos)']];
// Proteínas: lo que se desmarca no puede salir; las palabras son las que vigila la pantalla de revisión.
export const PROT = [['pollo', 'Pollo', ['pollo']], ['conejo', 'Conejo', ['conejo']], ['pavo', 'Pavo', ['pavo']], ['ternera', 'Ternera', ['ternera', 'vacuno', 'chuletón', 'chuleton']],
  ['cerdo', 'Cerdo', ['cerdo', 'jamón serrano', 'jamon serrano', 'chorizo', 'salchicha', 'panceta']], ['cordero', 'Cordero', ['cordero']],
  ['pescado_blanco', 'Pescado blanco', ['merluza', 'bacalao', 'lubina', 'dorada', 'pescado blanco']], ['pescado_azul', 'Pescado azul', ['sardina', 'salmón', 'salmon', 'atún', 'atun', 'caballa', 'anchoa', 'boquerón', 'boqueron']],
  ['marisco', 'Marisco', ['gamba', 'marisco', 'mejillón', 'mejillon', 'calamar', 'langostino', 'pulpo', 'almeja']], ['huevos', 'Huevos', ['huevo', 'tortilla']], ['legumbres', 'Legumbres', ['lenteja', 'garbanzo', 'alubia', 'judía', 'judia']]];
// Condiciones de salud combinables: la regla que se pasa a la IA y las palabras que vigila la revisión. Todo parte de cero: solo cuenta lo que marcas tú.
export const SALUD = [
  ['sal', 'Sin sal / poca sal', 'sin sal añadida; evita embutidos, conservas, salsas y quesos salados, caldos de pastilla y procesados; no juntes en un mismo plato dos productos procesados salados (tomate frito, albóndigas, conservas, embutidos, quesos curados…)', ['embutido', 'jamón serrano', 'jamon serrano', 'chorizo', 'salchicha']],
  ['tension', 'Tensión alta', 'cuida la tensión: muy poca sal, nada de procesados salados, más verdura y fruta', []],
  ['colesterol', 'Colesterol alto', 'poca grasa saturada: sin fritos, mantequilla, nata, panceta, bacon ni vísceras; prioriza legumbres, verdura, fibra y aceite de oliva en poca cantidad', ['mantequilla', 'nata', 'panceta', 'bacon', 'frito', 'foie']],
  ['urico', 'Ácido úrico alto', 'evita vísceras, extractos de carne, marisco, pescado azul y alcohol; nada de bebidas azucaradas; más agua y verdura', ['hígado', 'higado', 'mollejas', 'riñón', 'riñon', 'anchoa', 'sardina']],
  ['azucar', 'Azúcar / diabetes', 'sin azúcar añadido ni zumos; hidratos de absorción lenta (legumbres, integrales) y en cantidad moderada', ['azúcar', 'azucar', 'miel', 'zumo']],
  ['alcohol', 'Sin alcohol', 'nada de alcohol, ni siquiera para cocinar', ['vino', 'cerveza', 'alcohol']],
];
export const corto = n => String(n).split(',')[0].trim();
const on = (arr, k, def) => Array.isArray(arr) ? arr.includes(k) : def;
const caja = (n, t, marcada) => `<label class="fila" style="min-height:44px"><input type="checkbox" name="${n}" value="1" ${marcada ? 'checked' : ''} style="width:24px;height:24px"> <span>${t}</span></label>`;

// De lo que has marcado (F, que se guarda) sale la petición. Sin marcas no hay límites: todo lo que limita viene del formulario.
export function armarOp(F, dias, notas) {
  const cat = S.datos().catalogo || [], nom = ids => (ids || []).map(i => cat.find(p => p.id === i)).filter(Boolean).map(p => corto(p.nombre));
  const sal = SALUD.filter(([k]) => on(F.salud, k, false)), ap = APARATOS.filter(([k]) => on(F.aparatos, k, true)), pr = PROT.filter(([k]) => on(F.prot, k, true));
  return { dias, notas: notas || '', comidas: F.comidas && F.comidas.length ? F.comidas : ['comida'], min: Number(F.min) || 0,
    salud: [...sal.map(x => `${x[1]}: ${x[2]}`), ...(F.salud_txt ? ['Otra condición: ' + F.salud_txt] : [])],
    aparatos: ap.length < APARATOS.length ? ap.map(x => x[1]) : [], prot: pr.length < PROT.length ? pr.map(x => x[1]) : [], noProt: PROT.filter(([k]) => !on(F.prot, k, true)).map(x => x[1]),
    gustan: nom(F.gustan), excl: [...nom(F.excl), ...lista(F.excl_txt)], caducar: F.caducar !== false, repetir: !!F.repetir,
    diasCaduca: Number(F.diasCaduca) > 0 ? Number(F.diasCaduca) : 14, envases: F.envases !== false, usarCasa: F.usarCasa !== false, protDistinta: F.protDistinta !== false, variar: F.variar !== false, completar: F.completar !== false, reserva: nom(F.reserva) };
}
// Palabras que la revisión busca en la respuesta: lo que el formulario prohíbe.
function reservadas(F) { const cat = S.datos().catalogo || []; return (F.reserva || []).map(i => cat.find(x => x.id === i)).filter(Boolean).map(p => corto(p.nombre)); }
const PROT_PAL = PROT.filter(([k]) => k !== 'huevos' && k !== 'legumbres');
// Resumen de lo que no cumple el menú con lo que se pidió (solo avisa; no bloquea nada).
function avisosMenu(menu, F, validas) {
  const d = S.datos(), dias = menu.filter(x => validas.has(x.fecha) && x.comida && x.comida.texto).sort((a, b) => a.fecha.localeCompare(b.fecha)), nota = [];
  const txt = x => norm(x.comida.texto + ' ' + (x.comida.usa || []).join(' ')), por = dias.map(txt), tiene = (t, re) => re.test(t);
  if (F.variar !== false) {
    const pat = por.filter(t => tiene(t, /patata|boniato/)).length;
    if (pat > 3 || por.some((t, i) => i && tiene(t, /patata|boniato/) && tiene(por[i - 1], /patata|boniato/))) nota.push(`Hay patata en ${pat} de ${por.length} días${por.some((t, i) => i && tiene(t, /patata|boniato/) && tiene(por[i - 1], /patata|boniato/)) ? ', y algunos seguidos' : ''}.`);
  }
  if (F.caducar !== false) {
    const N = Number(F.diasCaduca) > 0 ? Number(F.diasCaduca) : 14, aj = d.ajustes, fijo = norm([aj.comida_desayuno, aj.comida_media, aj.comida_cena, aj.tortilla_rellenos, aj.tortilla_siempre].join(' ')), res = reservadas(F).map(norm);
    const sin = d.nevera.filter(p => Number(p.cantidad) > 0).map(p => ({ nom: corto(p.nombre), n: diasHasta(caducidadEfectiva(p)) })).filter(x => x.n !== null && x.n >= 0 && x.n <= N && !res.includes(norm(x.nom)))
      .filter(x => { const k = (norm(x.nom).split(/\s+/).find(w => w.length >= 4) || norm(x.nom)).slice(0, 5); return !fijo.includes(k) && !por.some(t => t.includes(k)); }).sort((a, b) => a.n - b.n);
    if (sin.length) nota.push(`Caduca pronto y el menú no lo usa: ${sin.slice(0, 6).map(x => `${x.nom} (en ${x.n} d)`).join(', ')}${sin.length > 6 ? '…' : ''}.`);
  }
  if (F.envases !== false) dias.forEach((x, i) => { if (!/lenteja|garbanzo|alubia/.test(por[i])) return; const sig = por[i + 1], ant = por[i - 1], ok = re => re.test(sig || '') || re.test(ant || ''); if (i < dias.length - 1 && !ok(/lenteja|garbanzo|alubia/)) nota.push(`Legumbres el ${diaSemana(x.fecha)}: si abres un bote, la otra mitad no se usa al día siguiente.`); });
  const protDe = t => (PROT_PAL.find(([, , pal]) => pal.some(w => t.includes(norm(w)))) || [])[0];
  if (F.protDistinta !== false) dias.forEach((x, i) => { const a = protDe(por[i]), b = i ? protDe(por[i - 1]) : null; if (a && a === b) nota.push(`Misma proteína («${PROT_PAL.find(y => y[0] === a)[1].toLowerCase()}») el ${diaSemana(dias[i - 1].fecha)} y el ${diaSemana(x.fecha)}.`); });
  if (F.usarCasa !== false) {
    const sinUsar = [];
    for (const [k, nombre, pal] of PROT_PAL) {
      const stock = d.nevera.filter(p => Number(p.cantidad) > 0 && pal.some(w => norm(p.nombre).includes(norm(w))) && !/loncha|jam[oó]n|embutido/i.test(p.nombre));
      if (stock.length && !por.some(t => pal.some(w => t.includes(norm(w))))) sinUsar.push(`${nombre.toLowerCase()} (${stock.map(p => corto(p.nombre).slice(0, 30)).join(', ')})`);
    }
    if (sinUsar.length) nota.push(`No usa nada de lo que tienes en casa de: ${sinUsar.join('; ')}.`);
  }
  return nota;
}
export function vigiladas(F) {
  const cat = S.datos().catalogo || [], w = [];
  for (const [k, , pal] of PROT) if (!on(F.prot, k, true)) w.push(...pal);
  for (const [k, , , pal] of SALUD) if (on(F.salud, k, false)) w.push(...pal);
  for (const i of F.excl || []) { const p = cat.find(x => x.id === i); if (p) w.push(corto(p.nombre)); }
  return [...w, ...lista(F.excl_txt)];
}

// Formulario para pedir platos a la IA: lo que marcas se convierte en la petición. Las elecciones (menos fechas y nota) se recuerdan.
function abrirFormIA() {
  const d = S.datos(), f0 = hoy(), g0 = d.ajustes.ia_form || {};
  const dias = Array.from({ length: DIAS }, (_, i) => sumaDias(f0, i));
  const cat = (d.catalogo || []).filter(p => p.categoria !== 'bebida').sort((a, b) => corto(a.nombre).localeCompare(corto(b.nombre), 'es'));
  const lst = (pref, sel) => `<div style="max-height:30vh;overflow:auto;margin-top:6px">${cat.map(p => caja(pref + p.id, esc(corto(p.nombre)), (sel || []).includes(p.id))).join('') || '<p class="det">No hay productos en tu súper.</p>'}</div>`;
  const par = (t, a, b, v) => campo(t, `<div class="fila"><input name="${a}" type="number" inputmode="numeric" min="0" placeholder="de" value="${v && v[0] ? v[0] : ''}" style="width:48%"><input name="${b}" type="number" inputmode="numeric" min="0" placeholder="a" value="${v && v[1] ? v[1] : ''}" style="width:48%"></div>`);
  abrirHoja(`<h1>Pedir platos a la IA</h1><p class="sub">Lo que marques aquí es lo único que limita a la IA. Con esto armo la petición y luego revisas la respuesta antes de aplicarla.</p>
    <h2>Qué días</h2><div class="card">${dias.map((f, i) => { const c = franjaTexto(f, 'comida'); return caja('d' + i, `${i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : esc(diaSemana(f))} <span class="det">${esc(fechaCorta(f))}${c.txt ? ' · ya tiene: ' + esc(c.txt.slice(0, 26)) : ''}</span>`, !c.txt && !c.fuera); }).join('')}</div>
    <h2>Qué platos</h2><div class="card">${caja('k_comida', 'Comida', on(g0.comidas, 'comida', true))}${caja('k_cena', 'Cena', on(g0.comidas, 'cena', false))}</div>
    <h2>Salud</h2><div class="card"><p class="det" style="margin:0">Marca las que coincidan; se combinan. Sin marcas, no hay restricciones de salud.</p>${SALUD.map(([k, t]) => caja('s_' + k, t, on(g0.salud, k, false))).join('')}
      ${campo('Otra condición (opcional)', `<input name="salud_txt" value="${esc(g0.salud_txt || '')}" autocomplete="off" placeholder="p. ej. riñón, gluten">`)}</div>
    <h2>Qué puedo comer</h2><div class="card"><p class="det" style="margin:0">Desmarca lo que NO quieras que salga.</p>${PROT.map(([k, t]) => caja('p_' + k, t, on(g0.prot, k, true))).join('')}</div>
    <h2>Cómo</h2><div class="card">${campo('Tiempo máximo por plato', `<select name="min">${[[0, 'Sin límite'], [15, '15 minutos'], [30, '30 minutos'], [45, '45 minutos'], [60, '1 hora']].map(([v, t]) => `<option value="${v}" ${Number(g0.min || 0) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
      <p class="det" style="margin:6px 0 0">Con qué cocino:</p>${APARATOS.map(([k, t]) => caja('a_' + k, t, on(g0.aparatos, k, true))).join('')}
      ${caja('caducar', 'Gastar primero lo que caduca antes', g0.caducar !== false)}${campo('Dar prioridad a lo que caduca en los próximos (días)', `<input name="diasCaduca" type="number" inputmode="numeric" min="1" max="90" value="${esc(g0.diasCaduca || 14)}">`)}${caja('envases', 'Aprovechar los envases (un bote de legumbres = dos días seguidos)', g0.envases !== false)}${caja('usarCasa', 'Usar primero las proteínas que ya tengo (también el congelador)', g0.usarCasa !== false)}${caja('protDistinta', 'No repetir la misma proteína dos días seguidos', g0.protDistinta !== false)}${caja('variar', 'Variar guarniciones (no patata, arroz o pasta todos los días)', g0.variar !== false)}${caja('completar', 'Completar la proteína si un plato se queda corto (huevo duro, yogur…)', g0.completar !== false)}${caja('repetir', 'Puede repetir un plato dos días (cocino una vez)', !!g0.repetir)}</div>
    <h2>Cantidades <span class="det">(vacío = sin límite)</span></h2><div class="card">${par('Calorías por plato', 'kp0', 'kp1', g0.kcal_p)}${par('Proteína por plato (g)', 'pp0', 'pp1', g0.prot_p)}${par('Calorías al día', 'kd0', 'kd1', g0.kcal_d)}${par('Proteína al día (g)', 'pd0', 'pd1', g0.prot_d)}</div>
    <h2>Alimentos</h2><div class="card">
      <details><summary><b>Me gustan</b> <span class="det">(de tu súper; que salgan si encajan)</span></summary>${lst('g_', g0.gustan)}</details>
      <details style="margin-top:8px"><summary><b>Reservar</b> <span class="det">(para un día de apuro; fuera del menú normal)</span></summary>${lst('r_', g0.reserva)}</details>
      <details style="margin-top:8px"><summary><b>Excluir</b> <span class="det">(que no salgan nunca)</span></summary>${lst('x_', g0.excl)}</details>
      ${campo('Otros excluidos (separados por comas)', `<input name="excl_txt" value="${esc(g0.excl_txt || '')}" autocomplete="off" placeholder="p. ej. coliflor, lentejas">`)}</div>
    <h2>Mis reglas propias</h2><div class="card">${campo('Una por línea (se guardan)', `<textarea name="reglas" rows="4" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--card);padding:10px" placeholder="p. ej. aceite de oliva en vaporizador&#10;patata pequeña al microondas">${esc(g0.reglas || '')}</textarea>`)}
      ${campo('Algo más (solo esta vez)', `<input name="notas" autocomplete="off" placeholder="p. ej. algo ligero, viene mi hija">`)}</div>
    <div class="fila" style="margin-top:10px">${IA.configurada() ? `<button class="btn main grow" type="submit" value="pedir">⚡ Pedir a la IA</button>` : ''}<button class="btn grow" type="submit" value="copiar">Solo copiar el texto</button></div>${IA.configurada() ? IA.pieIA() : ''}`, (g, acc) => {
    const sel = dias.filter((f, i) => g['d' + i] === '1'), comidas = ['comida', 'cena'].filter(k => g['k_' + k] === '1');
    if (!sel.length || !comidas.length) { avisar('Marca al menos un día y un plato.'); return false; }
    const prot = PROT.filter(([k]) => g['p_' + k] === '1').map(x => x[0]), aparatos = APARATOS.filter(([k]) => g['a_' + k] === '1').map(x => x[0]);
    if (!prot.length || !aparatos.length) { avisar('Deja al menos una proteína y una forma de cocinar.'); return false; }
    const ids = pref => cat.filter(p => g[pref + p.id] === '1').map(p => p.id), par2 = (a, b) => [Number(g[a]) || 0, Number(g[b]) || 0];
    d.ajustes.ia_form = { comidas, salud: SALUD.filter(([k]) => g['s_' + k] === '1').map(x => x[0]), salud_txt: (g.salud_txt || '').trim(), prot, aparatos, min: Number(g.min) || 0, caducar: g.caducar === '1', repetir: g.repetir === '1',
      gustan: ids('g_'), excl: ids('x_'), reserva: ids('r_'), diasCaduca: Number(g.diasCaduca) > 0 ? Number(g.diasCaduca) : 14, envases: g.envases === '1', usarCasa: g.usarCasa === '1', protDistinta: g.protDistinta === '1', variar: g.variar === '1', completar: g.completar === '1', excl_txt: (g.excl_txt || '').trim(), reglas: (g.reglas || '').trim(), kcal_p: par2('kp0', 'kp1'), prot_p: par2('pp0', 'pp1'), kcal_d: par2('kd0', 'kd1'), prot_d: par2('pd0', 'pd1') };
    S.guardar();
    const op = armarOp(d.ajustes.ia_form, sel, (g.notas || '').trim());
    if (acc === 'copiar') { setTimeout(() => abrirHoja(`<h1>Texto para la IA</h1><p class="sub">Cópialo entero (mantén pulsado → seleccionar todo → copiar) y pégalo en la IA.</p><textarea readonly rows="16" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--card);padding:10px;font-family:monospace;font-size:.75rem">${esc(promptIA(op))}</textarea>`, () => true), 0); return true; }
    setTimeout(() => {
      avisar('Pidiendo los platos a la IA… puede tardar unos segundos.', 70000);
      IA.preguntar(promptIA(op), { json: true }).then(t => { const r = parsear(t); if (!Array.isArray(r.menu) || !r.menu.length) throw new Error('La respuesta no trae «menu».'); revisar(r); })
        .catch(e => avisar('No se pudo: ' + e.message, 7000));
    }, 0);
    return true;
  });
}

const parsear = t => { const m = String(t).replace(/```(?:json)?/gi, '').match(/\{[\s\S]*\}/); if (!m) throw new Error('No encuentro un bloque JSON en la respuesta.'); return JSON.parse(m[0]); };

// Ventana para fijar/cambiar la comida o la cena de un día (la usan Menú y, para apuntar lo real, Hoy). `despues` se llama con lo guardado.
export function abrirCambiar(f, k, despues) {
    const d = S.datos(), cur = plan(f)[k] || {}, marc = new Set(cur.ids || []);
    const stock = d.nevera.slice().sort((a, b) => (a.ubicacion === 'congelador' ? 0 : 1) - (b.ubicacion === 'congelador' ? 0 : 1) || a.nombre.localeCompare(b.nombre, 'es'));
    const rell = lista(d.ajustes.tortilla_rellenos);
    abrirHoja(`<h1>${k === 'comida' ? 'Comida' : 'Cena'} · ${esc(diaSemana(f))} ${esc(fechaCorta(f))}</h1>
      ${k === 'cena' ? `<label class="campo"><span>Tortilla de…</span><select name="relleno"><option value="">— otra cosa —</option>${rell.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>` : ''}
      ${campo(despues ? '¿Qué has comido (o vas a comer)?' : '¿Qué vas a comer?', `<input name="texto" value="${esc(cur.texto || '')}" autocomplete="off" placeholder="${k === 'comida' ? 'p. ej. contramuslo con ensalada' : 'o deja la tortilla de arriba'}">`)}
      ${k === 'comida' ? '<button class="btn grande" type="submit" value="receta" style="margin-bottom:10px">📖 Elegir del recetario (ordenado por tus criterios)</button>' : ''}
      <label class="fila" style="min-height:44px"><input type="checkbox" name="fuera" value="1" ${cur.fuera ? 'checked' : ''} style="width:24px;height:24px"> Como fuera de casa</label>
      <p class="det" style="margin:4px 0">Lo de casa que vas a usar (si es del congelador, te aviso el día antes):</p>
      <div class="card" style="max-height:30vh;overflow:auto">${stock.map(p => `<label class="fila" style="min-height:44px"><input type="checkbox" name="i_${esc(p.id)}" value="1" ${marc.has(p.id) ? 'checked' : ''} style="width:24px;height:24px"> <span>${esc(p.nombre.slice(0, 48))} <span class="det">(${esc(p.ubicacion)}, ${esc(p.cantidad)} ${esc(p.unidad)})</span></span></label>`).join('')}</div>
      <div class="fila" style="margin-top:10px"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>
      ${plan(f)[k] ? '<button class="btn grande" style="margin-top:10px" type="submit" value="quitar">Quitar lo planeado</button>' : ''}`, (g, acc) => {
      if (acc === 'quitar') { delete plan(f)[k]; S.guardar(); return true; }
      if (acc === 'receta') { setTimeout(() => import('../elegir_receta.js').then(m => m.abrirElegirReceta(f, despues)), 0); return true; }
      const ids = d.nevera.filter(p => g['i_' + p.id] === '1').map(p => p.id);
      let texto = (g.texto || '').trim();
      if (!texto && g.relleno) texto = `Tortilla de ${g.relleno.toLowerCase()} con ${(d.ajustes.tortilla_siempre || 'tomates cherry').toLowerCase()}`;
      if (!texto && g.fuera === '1') texto = 'Fuera de casa';
      if (!texto && !ids.length) { avisar('Apunta qué vas a comer.'); return false; }
      plan(f)[k] = { texto, ids, fuera: g.fuera === '1' }; S.guardar();
      if (despues) { const hecho = plan(f)[k]; setTimeout(() => despues(hecho), 0); }
      return true;
    });
}

export function acciones(act, el) {
  const d = S.datos();
  if (act === 'menu-prompt') {
    abrirHoja(`<h1>Texto para la IA</h1><p class="sub">Cópialo entero (mantén pulsado → seleccionar todo → copiar) y pégalo en la IA.</p>
      <textarea readonly rows="16" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--card);padding:10px;font-family:monospace;font-size:.75rem">${esc(promptIA())}</textarea>`, () => true);
    return true;
  }
  if (act === 'menu-ia') {
    abrirFormIA();
    return false;
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
  if (act === 'menu-cambiar') { abrirCambiar(el.dataset.f, el.dataset.k); return true; }
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
  const d = S.datos(), f0 = hoy(), FF = S.datos().ajustes.ia_form || {}, vigil = vigiladas(FF), reserva = reservadas(FF), validas = new Set(Array.from({ length: DIAS }, (_, i) => sumaDias(f0, i)));
  const filas = []; const aplicables = [];
  for (const dia of r.menu) {
    if (!validas.has(dia.fecha)) { filas.push(`<div class="card" style="border-color:var(--bad)"><b>${esc(dia.fecha || '?')}</b>: fecha fuera de los próximos ${DIAS} días. Se ignora.</div>`); continue; }
    for (const k of ['comida', 'cena']) {
      const p = dia[k]; if (!p || !p.texto) continue;
      const av = [], ids = [], texto = String(p.texto);
      const bajo = norm(texto + ' ' + (p.usa || []).join(' '));
      for (const x of reserva) if (x.length > 2 && bajo.includes(norm(x))) av.push(`usa «${x}», que tienes en tu reserva`);
      for (const x of vigil) if (x.length > 2 && bajo.includes(norm(x))) av.push(`contiene «${x}» (excluido en el formulario)`);
      for (const n of (p.usa || [])) { const it = d.nevera.find(x => norm(x.nombre) === norm(n)) || d.nevera.find(x => norm(x.nombre).includes(norm(n)) && norm(n).length > 4); if (it) ids.push(it.id); else av.push(`«${n}» no está en el almacén`); }
      const bloqueo = av.some(a => /no por ahora|excluido/.test(a));
      filas.push(`<div class="card" style="${bloqueo ? 'border-color:var(--bad)' : av.length ? 'border-color:var(--warn)' : ''}"><div class="det">${esc(diaSemana(dia.fecha))} ${esc(fechaCorta(dia.fecha))} · ${k}</div><div>${esc(texto)}</div>
        ${(p.comprar || []).length ? `<div class="det">Comprar: ${esc(p.comprar.join(', '))}</div>` : ''}${av.map(a => `<div class="chip ${/no por ahora|excluido/.test(a) ? 'bad' : 'warn'}" style="margin-top:4px">${esc(a)}</div>`).join(' ')}</div>`);
      if (!bloqueo) aplicables.push({ f: dia.fecha, k, texto, ids });
    }
  }
  const notasMenu = avisosMenu(r.menu, FF, validas);
  abrirHoja(`<h1>Revisión</h1><p class="sub">${esc(r.notas || '')}</p>${IA.configurada() ? IA.pieIA() : ''}${notasMenu.length ? `<div class="card" style="border-color:var(--warn)"><b>A tener en cuenta</b>${notasMenu.map(x => `<div class="det" style="margin-top:4px">· ${esc(x)}</div>`).join('')}</div>` : ''}${filas.join('') || '<div class="card vacio">No hay nada que aplicar.</div>'}
    <p class="det">Se pueden aplicar ${aplicables.length} platos. Los marcados en rojo no se aplican (no encajan con tus reglas). No pisa los que ya marcaste «fuera».</p>
    <div class="fila"><button class="btn main grow" type="submit" value="aplicar" ${aplicables.length ? '' : 'disabled'}>Aplicar ${aplicables.length}</button><button class="btn grow" type="submit" value="no">No aplicar</button></div>`, (g, acc) => {
    if (acc !== 'aplicar') return true;
    let n = 0; for (const a of aplicables) { const cur = plan(a.f)[a.k]; if (cur && cur.fuera) continue; plan(a.f)[a.k] = { texto: a.texto, ids: a.ids, fuera: false, ia: true }; n++; }
    S.guardar(); avisar(`${n} platos aplicados al menú.`); return true;
  });
}
