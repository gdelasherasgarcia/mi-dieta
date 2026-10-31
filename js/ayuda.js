// Ayuda de la app: una explicación corta por pantalla (el «?» junto al título) y el manual completo (en Más).
import { esc } from './util.js';
import { abrirHoja } from './ui.js';

const ul = l => `<ul style="margin:6px 0 12px;padding-left:20px">${l.map(x => `<li style="margin:4px 0">${x}</li>`).join('')}</ul>`;

export const AYUDA = {
  hoy: { t: 'Hoy', para: 'Es tu panel del día: qué medicinas tocan, cuánta agua llevas, qué hay que sacar del congelador, qué has comido y qué conviene gastar primero en casa.',
    uso: ['Arriba salen los avisos que tengas activados (pastillas, citas, agua, comidas, ejercicio).', 'En «Ejercicio de hoy» apunta lo que hagas con un toque.', 'Toca una medicina para registrar que la has tomado (con su hora).', 'Pulsa «+ Un vaso» cada vez que bebas agua.', 'En «Comidas de hoy» pulsa «✔ Lo previsto» si comiste lo de siempre, o «Comí otra cosa» y apunta qué comiste: después te pregunta qué has gastado del almacén.', 'En «Mañana» planea la comida de mañana; si lleva algo del congelador, hoy te avisa para sacarlo.', '«Gastar primero» lista lo que caduca pronto y lo que ya está abierto o a medias.'],
    datos: ['Tus medicinas (pantalla Medicinas).', 'El almacén al día (pantalla Almacén).', 'Lo que comes (se apunta aquí mismo).'] },
  menu: { t: 'Menú', para: 'Muestra los próximos 6 días con desayuno, media mañana, comida y cena. Desayuno y media mañana son fijos; la comida y la cena se pueden cambiar.',
    uso: ['«✨ Proponer menú» calcula comida y cena para los días sin planear, con tus prioridades; revisa la propuesta y aplícala.', '«🧺 Lista de la compra del menú» pasa lo que falta en casa a la lista de la compra.', 'Pulsa «Cambiar» en la comida o la cena de un día: escribe qué vas a comer, elige los productos de casa que usarás o marca «como fuera de casa».', 'Si usas algo del congelador, la app te avisa el día antes de sacarlo.', 'Con una IA: «Copiar el texto para la IA» la pone al día; pega su respuesta con «Pegar la respuesta» y revisa antes de aplicarla.'],
    datos: ['El almacén con cantidades y caducidades.', 'Las comidas fijas y las reglas de la tortilla (Más).', 'Lo que has comido estos días (Hoy).'] },
  nevera: { t: 'Almacén', para: 'Es lo que tienes en casa: nevera, congelador y despensa, con cantidades y caducidades. De aquí salen los avisos y los menús.',
    uso: ['«+ Añadir» da de alta un producto: nombre, cantidad, sitio y caducidad. Puedes escribir el código de barras o hacer una foto de él.', 'Toca un producto para editarlo, gastarlo o borrarlo; «−1» gasta una unidad.', 'Si lo pones en el congelador, no te avisará de caducidad; sí te recordará sacarlo si está en el menú.'],
    datos: ['Nombre y cantidad.', 'Sitio (nevera, congelador o despensa).', 'Caducidad del envase, y si está abierto, desde cuándo y cuánto dura abierto.'] },
  compra: { t: 'Compra', para: 'Es la lista de lo que hay que comprar, pensada para llevarla en la tienda, y el registro de lo que has traído a casa.',
    uso: ['«+ Añadir» pone algo en la lista: de súper, de farmacia o cualquier otro recado.', 'Cuando a una medicina le quedan pocas pastillas, la app pone sola «Reponer …» en Farmacia. Al marcarla y pasarla a casa te pregunta cuántas has traído y actualiza el stock.', 'En la tienda marca con el círculo lo que vas cogiendo.', 'En casa pulsa «Entrar en casa lo marcado»: te va preguntando cantidad, sitio y caducidad de cada producto. Solo sale de la lista al guardarlo en casa.', '«📷 Registrar lo comprado con el código» lee el código de barras de un producto: si está en el catálogo entra directo; si no, creas su ficha.'],
    datos: ['Los productos a comprar.', 'En casa: la cantidad real, el sitio y la caducidad.'] },
  salud: { t: 'Salud', para: 'Guarda tu tensión (Omron) y tu peso, con medias, gráficas y una tabla para enseñar al enfermero.',
    uso: ['«+ Tensión»: alta, baja, pulso y hora. Mide en ayunas antes de las pastillas y por la noche.', '«+ Peso»: los lunes en ayunas.', '«Ver tabla de los últimos 30 días» para copiarla o enseñarla en la consulta.', 'En «Citas» apunta médico, enfermero, analíticas… con fecha y hora. «📅 Añadir al calendario» descarga un archivo que, abierto en el móvil, crea la cita con sus avisos (una semana, un día y dos horas antes, a tu elección). Las citas de hoy y de mañana salen arriba en Hoy.', '«Revisar» marca lecturas fuera de tus umbrales de aviso; si hay síntomas, llama al 112.'],
    datos: ['Lecturas del Omron M4 (no las del reloj, que solo estiman).', 'Peso en kg.', 'Para las citas: con quién, fecha, hora y lugar.'] },
  recetas: { t: 'Recetario', para: 'Es la colección de platos sencillos de comida (con pollo, conejo o pavo) de la que sale el menú. Cada plato tiene sus ingredientes por ración, los pasos y los aparatos.',
    uso: ['Toca un plato para ver ingredientes y pasos.', 'Descarta los que no te gusten: no volverán a salir en el menú. Puedes recuperarlos en «Descartadas».', 'Las calorías y la proteína son estimaciones con valores medios.'],
    datos: ['Nada: son platos ya escritos. Cuando se añadan recetas nuevas, vendrán de una IA y las aceptarás tú.'] },
  catalogo: { t: 'Catálogo', para: 'Es el listado de productos que compras, con su nutrición por 100 g, su código de barras y si los encuentras en tu tienda.',
    uso: ['Busca por nombre o filtra por tipo, «En mi tienda» o «Sin nutrición».', 'Toca un producto para editarlo: nutrición, código, marca, si está en tu tienda.', '«+ Añadir» crea una ficha. Puedes leer el código de barras con una foto.', 'Guardar o fusionar el catálogo en un archivo sirve para copiarlo o ampliarlo.'],
    datos: ['Nombre y tipo.', 'Nutrición por 100 g tal como sale en la etiqueta (kcal, grasas, saturadas, hidratos, azúcares, proteínas, sal).', 'Código de barras (opcional).'] },
  medicinas: { t: 'Medicinas', para: 'Son las fichas de tus medicinas: cuándo se toman y cada cuánto. Alimentan los avisos de la pantalla Hoy.',
    uso: ['«+ Añadir» crea una medicina: nombre, dosis, hora, repetición y días.', 'Toca una ficha para modificarla, desactivarla o borrarla.', 'Cambiar la hora no altera lo ya registrado.', 'En cada ficha anota las pastillas que hay ahora y cuántas tomas por vez: la app resta una cada vez que registras la toma y te avisa en Hoy cuando queden pocas (por defecto, 3 o menos). Cuando repongas, vuelve a contarlas en la ficha.'],
    datos: ['Nombre, dosis y hora de la primera toma.', 'Repetición y máximo diario, si procede.', 'Qué días toca.'] },
  mas: { t: 'Más', para: 'Ajustes de la app: aspecto, comidas fijas, supermercado y periodicidad de la compra, copias de seguridad y el manual.',
    uso: ['Cambia el tamaño de letra y el tema.', 'En «Avisos» activa o apaga cada tipo y fija sus horas; descarga el archivo de calendario de cada tipo para que suenen en el móvil sin internet (impórtalo en un calendario propio para silenciarlo entero).', 'Edita tus comidas fijas y las reglas de la tortilla.', 'Elige tu supermercado y cada cuánto compras.', 'La app hace sola una copia diaria en la carpeta «copias»; «Hacer una copia ahora» la fuerza. Además, «Guardar copia (archivo)» baja un archivo que puedes llevarte a otro sitio.'],
    datos: ['Nada obligatorio: son preferencias.'] },
};

const bloque = a => `<p style="margin:0 0 10px">${esc(a.para)}</p><h2>Cómo se usa</h2>${ul(a.uso.map(esc))}<h2>Qué datos necesita</h2>${ul(a.datos.map(esc))}`;

export function abrirAyuda(id) {
  if (id === 'manual') return abrirManual();
  const a = AYUDA[id]; if (!a) return;
  abrirHoja(`<h1>${esc(a.t)}: para qué sirve</h1>${bloque(a)}<div class="fila"><button class="btn main grow" type="submit" value="ok">Entendido</button></div>
    <button type="button" class="btn grande" style="margin-top:10px" data-ayuda="manual">Ver el manual completo</button>`, () => true);
}

function abrirManual() {
  const rut = (t, l) => `<h2>${t}</h2>${ul(l)}`;
  abrirHoja(`<h1>Manual de la app</h1>
    <h2>Qué es</h2><p>Una app para comer bien, sin tirar comida y con tus datos de salud a mano. Todo lo que apuntas se guarda en este dispositivo (en el navegador). No es un médico: no cambia medicación ni diagnostica.</p>
    <h2>Pantallas</h2>${ul(Object.entries(AYUDA).map(([k, a]) => `<b>${esc(a.t)}</b>: ${esc(a.para)}`))}
    ${rut('Rutina de cada día', ['Por la mañana, en ayunas: mide la tensión y apúntala en Salud; luego, las medicinas en Hoy.', 'Durante el día: agua (un vaso antes de cada comida) y apunta cada comida en Hoy («Lo previsto» o «Comí otra cosa»).', 'Cuando comes algo de casa, responde a «¿Qué has gastado?»: así el almacén está siempre al día.', 'Por la tarde: mira «Mañana». Si va a haber algo del congelador, sácalo hoy.', 'Por la noche: tensión, y la medicina de acostarse.'])}
    ${rut('Rutina de cada semana', ['Lunes en ayunas: pesarte y apuntarlo en Salud.', 'Revisar el menú de los próximos días y cambiar lo que haga falta.', 'Preparar la lista de la compra.', 'Comprobar en Más que la copia automática es de hoy, y guardar de vez en cuando la carpeta «copias» fuera del portátil (USB o nube).'])}
    ${rut('Cuando vas a comprar y cuando vuelves', ['En la tienda: abre Compra y marca lo que cojas.', 'En casa: «Entrar en casa lo marcado», y rellena cantidad, sitio y caducidad.', 'Un producto nuevo: «📷 Registrar lo comprado con el código». Si no está, crea su ficha con la nutrición de la etiqueta.'])}
    ${rut('Una vez al mes', ['Revisa el catálogo: filtra por «Sin nutrición» y completa lo que compres más.', 'Lleva al enfermero la tabla de tensión y peso.', 'Repasa «En estudio» de las tortillas y los alimentos con tu enfermero.'])}
    <h2>Si algo falla</h2>${ul(['Si ves una versión vieja de la app: abre «localhost:8810/diag.html» y pulsa «Limpiar páginas viejas». No borra tus datos.', 'Si la app no abre: el servidor debe estar en marcha (arranca solo al iniciar Windows).', 'Si no se lee un código de barras: acércalo, que se vea entero y sin reflejos; o escríbelo a mano.', 'Tus datos están en el navegador de este dispositivo: haz copias de seguridad.'])}
    <div class="fila"><button class="btn main grow" type="submit" value="ok">Cerrar</button></div>`, () => true);
}
