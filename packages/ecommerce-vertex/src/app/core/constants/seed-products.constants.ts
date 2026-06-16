export interface CatalogueItem {
  readonly name: string;
  readonly featured: boolean;
  readonly price: number;
  readonly discount: number;
  readonly desc: string;
  readonly imgs: readonly string[];
}

export interface CatalogueCategory {
  readonly slug: string;
  readonly variants: readonly string[];
  readonly items: readonly CatalogueItem[];
}

export const PRODUCT_CATALOGUE: readonly CatalogueCategory[] = [
  {
    slug: 'remeras',
    variants: ['talle', 'color'],
    items: [
      {
        name: 'Remera Básica Pima 180g',
        featured: true,
        price: 8500,
        discount: 0,
        desc: 'Confeccionada en algodón Pima 180 g/m² con certificado GOTS. Costuras reforzadas, cuello canalé y lavados garantizados sin deformación. La base ideal para cualquier look.',
        imgs: [
          '1521572163474-6864f9cf17ab',
          '1503342217505-b0a15ec3261c',
          '1523381240423-59b6e0c53abe',
          '1576566588028-4147f3842f27',
        ],
      },
      {
        name: 'Remera Oversize Drop Shoulder',
        featured: false,
        price: 10900,
        discount: 15,
        desc: 'Corte oversize con hombro caído y largo extendido. Tela jersey 220 g/m², efecto delavado suave. Ideal para combinar con joggers o jeans baggy.',
        imgs: [
          '1567113463300-102a7eb3cb26',
          '1503342217505-b0a15ec3261c',
          '1571945153237-4929e783af4a',
          '1523381240423-59b6e0c53abe',
        ],
      },
      {
        name: 'Remera Polo Piqué Premium',
        featured: false,
        price: 15200,
        discount: 10,
        desc: 'Polo de tela piqué doble torsión 240 g/m². Cuello y puños acanalados, botones de nácar en frente. Corte slim fit que moldea sin apretar. Disponible en cinco colores clásicos.',
        imgs: [
          '1576566588028-4147f3842f27',
          '1521572163474-6864f9cf17ab',
          '1503342217505-b0a15ec3261c',
          '1571945153237-4929e783af4a',
        ],
      },
      {
        name: 'Remera Manga Larga Térmica',
        featured: false,
        price: 13800,
        discount: 0,
        desc: 'Tejido térmico de doble cara (algodón exterior, poliéster termoaislante interior). Puños ajustados antipilling. La capa base perfecta para días fríos o actividades outdoor.',
        imgs: [
          '1571945153237-4929e783af4a',
          '1567113463300-102a7eb3cb26',
          '1521572163474-6864f9cf17ab',
          '1576566588028-4147f3842f27',
        ],
      },
      {
        name: 'Remera Estampada Artesanal',
        featured: false,
        price: 12400,
        discount: 0,
        desc: 'Serigrafía artesanal de cuatro colores sobre tela 100% algodón ring spun. Cada estampado es numerado. Diseños exclusivos de artistas locales en colaboración con nuestra tienda.',
        imgs: [
          '1523381240423-59b6e0c53abe',
          '1521572163474-6864f9cf17ab',
          '1567113463300-102a7eb3cb26',
          '1503342217505-b0a15ec3261c',
        ],
      },
    ],
  },
  {
    slug: 'pantalones',
    variants: ['talle', 'color'],
    items: [
      {
        name: 'Jean Slim Fit Índigo 12oz',
        featured: true,
        price: 22500,
        discount: 0,
        desc: 'Denim selvático 100% algodón 12 oz con lavado índigo profundo. Corte slim que abraza la silueta sin limitar el movimiento. Cinco bolsillos clásicos, costura naranja característica.',
        imgs: [
          '1542272604-787c3835535d',
          '1541099649105-f69ad21f3246',
          '1604176354204-9268737828e4',
          '1624378439575-d8705ad7ae80',
        ],
      },
      {
        name: 'Jean Recto Wide Leg',
        featured: false,
        price: 24800,
        discount: 0,
        desc: 'Corte recto amplio desde la cadera hasta el tobillo. Tela denim 380 g/m² de alta estabilidad. Versátil: queda bien con zapatillas, botas o mocasines.',
        imgs: [
          '1604176354204-9268737828e4',
          '1542272604-787c3835535d',
          '1624378439575-d8705ad7ae80',
          '1541099649105-f69ad21f3246',
        ],
      },
      {
        name: 'Jogger Premium Fleece 320g',
        featured: false,
        price: 18900,
        discount: 20,
        desc: 'Interior de felpa de algodón 320 g/m², exterior liso antipilling. Pretina ancha con cordón plano, puños con elástico doble. Dos bolsillos laterales profundos y bolsillo trasero con cierre.',
        imgs: [
          '1624378439575-d8705ad7ae80',
          '1541099649105-f69ad21f3246',
          '1604176354204-9268737828e4',
          '1542272604-787c3835535d',
        ],
      },
      {
        name: 'Pantalón Chino Gabardina Slim',
        featured: false,
        price: 19500,
        discount: 0,
        desc: 'Gabardina de algodón-elastano 260 g/m² con 4% stretch para mayor comodidad. Corte slim levemente cónico. Ideal para looks business casual o smartcasual. Cinco bolsillos.',
        imgs: [
          '1541099649105-f69ad21f3246',
          '1604176354204-9268737828e4',
          '1542272604-787c3835535d',
          '1624378439575-d8705ad7ae80',
        ],
      },
      {
        name: 'Pantalón Cargo Ripstop',
        featured: false,
        price: 26500,
        discount: 10,
        desc: 'Tela ripstop 65/35 poliéster-algodón, resistente al desgarro y a la humedad. Seis bolsillos funcionales con cierre YKK. Pretina elástica trasera. El utilitario que no sacrifica el estilo.',
        imgs: [
          '1624378439575-d8705ad7ae80',
          '1604176354204-9268737828e4',
          '1541099649105-f69ad21f3246',
          '1542272604-787c3835535d',
        ],
      },
    ],
  },
  {
    slug: 'zapatillas',
    variants: ['talle', 'color'],
    items: [
      {
        name: 'Zapatilla Running Air Zoom V3',
        featured: true,
        price: 52000,
        discount: 0,
        desc: 'Mediasuela de espuma EVA + cámara de aire en talón y antepié. Upper de malla 3D ultraliviana con refuerzos de TPU. Suela de goma con canales multidireccionales. Peso: 285 g (talle 42).',
        imgs: [
          '1542291026-7eec264c27ff',
          '1491553895911-0055eca6402d',
          '1539185441755-769473a23570',
          '1525966222134-fcfa99b8ae77',
        ],
      },
      {
        name: 'Zapatilla Urbana Canvas Vulc',
        featured: false,
        price: 32000,
        discount: 15,
        desc: 'Upper de lona canvas 100% algodón con refuerzo en puntera. Suela vulcanizada clásica con textura cuadriculada. La base del armario urbano desde 1960. Disponible en 5 colores.',
        imgs: [
          '1525966222134-fcfa99b8ae77',
          '1542291026-7eec264c27ff',
          '1491553895911-0055eca6402d',
          '1539185441755-769473a23570',
        ],
      },
      {
        name: 'Zapatilla Retro 94 Leather',
        featured: false,
        price: 58000,
        discount: 0,
        desc: 'Reedición limitada inspirada en clásicos de los 90. Upper de cuero full grain + panel de nylon. Amortiguación con tecnología vintage foam. Logo bordado lateral. Caja de edición coleccionable.',
        imgs: [
          '1491553895911-0055eca6402d',
          '1539185441755-769473a23570',
          '1525966222134-fcfa99b8ae77',
          '1542291026-7eec264c27ff',
        ],
      },
      {
        name: 'Zapatilla Training Functional',
        featured: false,
        price: 46000,
        discount: 0,
        desc: 'Construida para HIIT, functional training y crossfit. Suela plana de 4 mm para máxima estabilidad en sentadillas. Upper de malla de ventilación zonal. Cordones planos preatados.',
        imgs: [
          '1539185441755-769473a23570',
          '1491553895911-0055eca6402d',
          '1542291026-7eec264c27ff',
          '1525966222134-fcfa99b8ae77',
        ],
      },
      {
        name: 'Zapatilla Chunky Platform 4cm',
        featured: false,
        price: 44000,
        discount: 25,
        desc: 'Plataforma de 4 cm en suela de goma inyectada. Upper de cuero sintético premium con costuras decorativas. El modelo favorito del streetwear contemporáneo. Sin cordones, cierre velcro oculto.',
        imgs: [
          '1525966222134-fcfa99b8ae77',
          '1542291026-7eec264c27ff',
          '1539185441755-769473a23570',
          '1491553895911-0055eca6402d',
        ],
      },
    ],
  },
  {
    slug: 'accesorios',
    variants: ['color'],
    items: [
      {
        name: 'Gorra Snapback 6 Paneles',
        featured: true,
        price: 7500,
        discount: 0,
        desc: 'Six-panel en twill de algodón 100%. Visera plana pre-curvada. Panel frontal con bordado 3D. Cierre snapback metálico ajustable talla única. Transpirabilidad garantizada por malla lateral.',
        imgs: [
          '1534307671554-9a6d81f4d629',
          '1511499767150-a48a237f0083',
          '1548036328-c9fa89d128fa',
          '1553062407-98eeb64c6a62',
        ],
      },
      {
        name: 'Riñonera Crossbody 2L',
        featured: false,
        price: 9800,
        discount: 10,
        desc: 'Cuerpo principal + bolsillo frontal con cierre YKK y organizador interior. Correa ajustable doble uso: cintura o bandolera. Tela ripstop resistente al agua con cremalleras plastificadas.',
        imgs: [
          '1548036328-c9fa89d128fa',
          '1553062407-98eeb64c6a62',
          '1534307671554-9a6d81f4d629',
          '1511499767150-a48a237f0083',
        ],
      },
      {
        name: 'Cinturón Cuero Full Grain 35mm',
        featured: false,
        price: 14500,
        discount: 0,
        desc: 'Cuero full grain primera selección curtido al vegetal. Hebilla de zamak con acabado matte. Ancho 35 mm, largo ajustable hasta 120 cm. Incluye pasacinturón extra. Garantía de 3 años.',
        imgs: [
          '1553062407-98eeb64c6a62',
          '1534307671554-9a6d81f4d629',
          '1548036328-c9fa89d128fa',
          '1511499767150-a48a237f0083',
        ],
      },
      {
        name: 'Mochila Urban Tech 25L',
        featured: false,
        price: 38000,
        discount: 0,
        desc: 'Compartimento laptop hasta 16" con espuma protectora. Bolsa delantera organizada con 8 divisiones. Puerto USB integrado. Espalda ergonómica con malla 3D transpirable. Peso: 820 g.',
        imgs: [
          '1553062407-98eeb64c6a62',
          '1548036328-c9fa89d128fa',
          '1511499767150-a48a237f0083',
          '1534307671554-9a6d81f4d629',
        ],
      },
      {
        name: 'Gafas de Sol Polarizadas Wayfarer',
        featured: false,
        price: 19500,
        discount: 20,
        desc: 'Lentes polarizados CAT 3 con filtro UV400. Montura wayfarer de acetato italiano inyectado. Bisagras de primavera reforzadas. Incluye estuche rígido, paño microfibra y certificado de autenticidad.',
        imgs: [
          '1511499767150-a48a237f0083',
          '1534307671554-9a6d81f4d629',
          '1553062407-98eeb64c6a62',
          '1548036328-c9fa89d128fa',
        ],
      },
    ],
  },
  {
    slug: 'camperas',
    variants: ['talle', 'color'],
    items: [
      {
        name: 'Campera Rompevientos Packable',
        featured: true,
        price: 38000,
        discount: 0,
        desc: 'Membrana impermeabilizante 3.000 mm de presión hídrica. Costuras termoselladas. Empacable en su propio bolsillo trasero formando una pochette de 20×15 cm. Peso total: 340 g.',
        imgs: [
          '1551028719-00167b16eac5',
          '1551537482-f2075a1d41f2',
          '1495105787522-5334e3ffa0ef',
          '1520975661595-6453be3f7070',
        ],
      },
      {
        name: 'Campera Cuero Biker Matte',
        featured: false,
        price: 72000,
        discount: 10,
        desc: 'Cuero sintético PU de alta densidad con acabado matte. Forro de satín con bolsillos internos. Cierres metálicos YKK en diagonal, mangas y cuello. Hombros estructurados con padding.',
        imgs: [
          '1520975661595-6453be3f7070',
          '1551028719-00167b16eac5',
          '1551537482-f2075a1d41f2',
          '1495105787522-5334e3ffa0ef',
        ],
      },
      {
        name: 'Bomber Classic MA-1 Reversible',
        featured: false,
        price: 45000,
        discount: 0,
        desc: 'Reversible: cara exterior en nylon ripstop, cara interior en satín naranja. Inspirada en el MA-1 original. Puños, cuello y dobladillo trenzados. Logo bordado en pecho. Icónica y atemporal.',
        imgs: [
          '1551537482-f2075a1d41f2',
          '1495105787522-5334e3ffa0ef',
          '1520975661595-6453be3f7070',
          '1551028719-00167b16eac5',
        ],
      },
      {
        name: 'Campera Puffer 600 Fill DWR',
        featured: false,
        price: 62000,
        discount: 15,
        desc: 'Relleno de pluma sintética 600 fill power con tratamiento DWR (repelente al agua). Costuras de canalón para distribución uniforme del calor. Cremallera YKK doble tirador. Peso: 520 g.',
        imgs: [
          '1547949003-9792a18a2601',
          '1551028719-00167b16eac5',
          '1551537482-f2075a1d41f2',
          '1495105787522-5334e3ffa0ef',
        ],
      },
      {
        name: 'Campera Denim Sherpa Contrast',
        featured: false,
        price: 52000,
        discount: 0,
        desc: 'Denim 14 oz lavado a la piedra con cuello, solapa y forro de sherpa de 300 g/m². Botones metálicos envejecidos. Bolsillos pecho y laterales funcionales. El clásico que nunca se va.',
        imgs: [
          '1495105787522-5334e3ffa0ef',
          '1520975661595-6453be3f7070',
          '1547949003-9792a18a2601',
          '1551037482-f2075a1d41f2',
        ],
      },
    ],
  },
];
