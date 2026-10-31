// Catálogo inicial (de «Mis productos comprados» del Eroski online, 24-10-2026). Precios orientativos, pueden cambiar.
// Nutrición por 100 g: kcal, grasas, sat (saturadas), hidratos, azucares, prot, sal. null = pendiente (se rellena desde la etiqueta; no inventar).
const N = { kcal: null, grasas: null, sat: null, hidratos: null, azucares: null, prot: null, sal: null };
const p = (categoria, nombre, formato, precio, notas = '', extra = {}) =>
  ({ categoria, nombre, marca: /Eroski/i.test(nombre) ? 'Eroski' : '', formato, precio, notas, ...N, fuente: '', verificado: false, ...extra });

export const CATALOGO = [
  p('carne', 'Pechugas enteras de pollo, formato ahorro XXL Eroski', '~1,1 kg', 6.82, 'Quitar la piel si la lleva; porcionar y congelar'),
  p('carne', 'Contramuslo deshuesado de pollo sin piel, Eroski Natur', '~500 g', 5.00, 'Encaja con su receta de sartén tapada'),
  p('carne', 'Filetes de pechuga de pavo al ajillo, Eroski', '~500 g', 4.50, 'Mirar la sal del adobo'),
  p('carne', 'Filete de pechuga de pavo pimentón, Eroski', '~520 g', 5.19, 'Mirar la sal del adobo (4,67 € en oferta)'),
  p('carne', '1/2 conejo troceado, Eroski', '~670 g', 7.14),
  p('carne', 'Chuletitas de muslo de conejo, Eroski', '~330 g', 5.47, '4,92 € en oferta'),
  p('carne', 'Solomillo de cerdo al vacío', '~500 g', 4.25, 'Cerdo magro; no es de sus tres carnes habituales'),
  p('carne', 'Lomo de cerdo trozo XXL, Eroski', '~1,2 kg', 5.40, 'No es de sus tres carnes habituales'),
  p('congelado', 'Espinacas cortadas, Eroski', '1 kg', 2.60, 'Comprobar «sin sal añadida»'),
  p('congelado', 'Judías verdes redondas, Eroski', '1 kg', 1.30),
  p('congelado', 'Menestra de verduras, Eroski', '1 kg', 2.09, 'Su base para guisos (1,80 € en oferta)'),
  p('congelado', 'Alcachofas cortadas, Eroski', '450 g', 2.87),
  p('congelado', 'Mezcla para sofrito, Eroski', '450 g', 1.39),
  p('congelado', 'Filete de merluza sin piel, Eroski', '540 g', 5.95, 'Pescado blanco, sencillo'),
  p('congelado', 'Arroz con verduras, Eroski', '500 g', 1.90, 'Gastarlo antes de comprar más (ocupa sitio)'),
  p('congelado', 'Arroz negro, Eroski', '500 g', 2.49),
  p('despensa', 'Aceite de oliva 0,4º, Eroski', '1 l', 3.75, 'En spray para el desayuno'),
  p('despensa', 'Zumo de limón exprimido, Eroski', '250 ml', 1.25, 'Aliño sin sal'),
  p('despensa', 'Vinagre de vino blanco, Eroski basic', '1 l', 0.65, 'Aliño sin sal'),
  p('despensa', 'Garbanzos cocidos, Eroski', '', null, 'Sal según web Eroski (24-10); confirmar formato (bote)', { sal: 0.49, fuente: 'Web Eroski, 24-10-2026' }),
  p('despensa', 'Lentejas cocidas, Eroski', '', null, 'Sal según web Eroski (24-10); confirmar formato (bote)', { sal: 0.61, fuente: 'Web Eroski, 24-10-2026' }),
  p('despensa', 'Alubias cocidas, Eroski', '', null, 'Sal según web Eroski (24-10); confirmar formato (bote)', { sal: 0.64, fuente: 'Web Eroski, 24-10-2026' }),
  p('despensa', 'Panecillos integrales', '', null, 'Su desayuno de siempre'),
  p('despensa', 'Nueces', '', null, 'Cinco en el desayuno'),
  p('fresco', 'Ensalada 4 estaciones, Eroski', '250 g', null),
  p('fresco', 'Ensalada César, Florette', '', null),
  p('fresco', 'Ensalada de atún, Eroski', '250 g', null, 'Dato de sal por confirmar (apuntado 2,1 g, sin saber si por 100 g o por envase). Media salsa o nada; quitar aceitunas'),
  p('fresco', 'Lechuga en sobre', '', null),
  p('fresco', 'Yogur proteico natural, Eroski', 'pack de 4', null, '12 g de proteína por yogur (dato de etiqueta, por unidad)'),
  p('fresco', 'Pavo reducido en sal, Eroski', '150 g', null, 'Una vez abierto, 48 h'),
  p('fresco', 'Queso tierno', '', null),
  p('fresco', 'Huevos', 'docena', null, 'Máximo 1 por la noche'),
  p('fresco', 'Danacol (marca Eroski)', '', null, 'Con una comida principal'),
  p('bebida', 'Bebida de avena, Eroski', '1 l', null),
  p('bebida', 'Leche desnatada', '1 l', null),
];

export const CATEGORIAS = [['carne', 'Carnes'], ['pescado', 'Pescado'], ['lacteo', 'Lácteos y huevos'], ['congelado', 'Congelados'], ['fresco', 'Frescos'], ['despensa', 'Despensa'], ['bebida', 'Bebidas']];
