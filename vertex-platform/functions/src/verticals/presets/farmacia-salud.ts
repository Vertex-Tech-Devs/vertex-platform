import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const FARMACIA_SALUD_PRESET: BusinessVerticalDefinition = {
  id: 'FARMACIA_SALUD',
  name: 'Farmacia & Salud',
  icon: 'bi-bandaid',
  description: 'Dermocosmética, suplementos dietarios, botiquín, ortopedia y cuidado personal.',
  bannerTitle: 'Tu Salud y Bienestar en Manos Expertas',
  bannerSubtitle:
    'Medicamentos de venta libre, suplementos nutricionales y productos ortopédicos certificados.',
  heroImages: [
    'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1920&h=700&fit=crop&q=80',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    {
      categoryId: 'suplementos',
      name: 'Suplementos & Vitaminas',
      slug: 'suplementos',
      imageUrl:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'dermocosmetica',
      name: 'Dermocosmética',
      slug: 'dermocosmetica',
      imageUrl:
        'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'botiquin',
      name: 'Primeros Auxilios',
      slug: 'botiquin',
      imageUrl:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'cuidado-personal',
      name: 'Higiene & Cuidado',
      slug: 'cuidado-personal',
      imageUrl:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&h=400&fit=crop&q=80',
    },
  ],
  categories: [
    {
      id: 'suplementos',
      name: 'Suplementos & Vitaminas',
      slug: 'suplementos',
      order: 1,
      filterableAttributes: ['formato'],
    },
    {
      id: 'dermocosmetica',
      name: 'Dermocosmética Especializada',
      slug: 'dermocosmetica',
      order: 2,
      filterableAttributes: [],
    },
    {
      id: 'botiquin',
      name: 'Botiquín & Primeros Auxilios',
      slug: 'botiquin',
      order: 3,
      filterableAttributes: [],
    },
    {
      id: 'ortopedia',
      name: 'Ortopedia & Rehabilitación',
      slug: 'ortopedia',
      order: 4,
      filterableAttributes: ['talle-ortopedia'],
    },
    {
      id: 'cuidado-personal',
      name: 'Higiene & Cuidado Personal',
      slug: 'cuidado-personal',
      order: 5,
      filterableAttributes: [],
    },
  ],
  attributes: [
    {
      id: 'formato',
      name: 'Presentación',
      code: 'formato',
      type: 'select',
      values: ['30 Cápsulas', '60 Cápsulas', '90 Comprimidos', 'Polvo 300g'],
      required: false,
    },
    {
      id: 'talle-ortopedia',
      name: 'Talle',
      code: 'talle-ortopedia',
      type: 'button',
      values: ['S', 'M', 'L', 'Universal Regulable'],
      required: false,
    },
  ],
  colors: {
    primary: '#059669',
    accent: '#0284c7',
    background: '#ffffff',
  },
  featureCards: [
    {
      title: 'Farmacia Certificada',
      content: 'Productos aprobados por ANMAT con riguroso control de trazabilidad.',
    },
    {
      title: 'Envíos Seguros y Climatizados',
      content: 'Transporte adecuado para la correcta conservación de suplementos y dermocosmética.',
    },
    {
      title: 'Atención Farmacéutica',
      content: 'Asesoramiento profesional para el cuidado de tu salud y bienestar familiar.',
    },
  ],
  sampleProducts: [
    {
      name: 'Vitamina C 1000mg + Zinc + Vitamina D3 (60 Comprimidos)',
      categorySlug: 'suplementos',
      price: 18500,
      stock: 50,
      skuPrefix: 'FAR-VITC',
      description:
        'Triple fórmula para el fortalecimiento del sistema inmunológico y acción antioxidante celular.',
      image:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Colágeno Hidrolizado Puro con Ácido Hialurónico & CoQ10 300g',
      categorySlug: 'suplementos',
      price: 29000,
      stock: 40,
      skuPrefix: 'FAR-COL',
      description:
        'Péptidos bioactivos de colágeno sabor frutos del bosque para articulaciones, piel, pelo y uñas.',
      image:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Magnesio Citrato Puro 400mg (60 Cápsulas)',
      categorySlug: 'suplementos',
      price: 21000,
      stock: 45,
      skuPrefix: 'FAR-MAG',
      description:
        'Alta biodisponibilidad para la relajación muscular, descanso nocturno y salud ósea.',
      image:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Omega 3 Ultra Puro EPA 400 / DHA 200 (60 Softgels)',
      categorySlug: 'suplementos',
      price: 26000,
      stock: 35,
      skuPrefix: 'FAR-OMG',
      description:
        'Aceite de pescado destilado molecularmente libre de metales pesados para salud cardiovascular y cerebral.',
      image:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Protector Solar Dermatológico Toque Seco FPS 50+ 50ml',
      categorySlug: 'dermocosmetica',
      price: 32000,
      stock: 55,
      skuPrefix: 'FAR-SPF',
      description:
        'Fórmula no comedogénica con agua termal y antioxidantes para pieles con tendencia grasa o acné.',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Agua Termal Mineralizante Calmante Spray 150ml',
      categorySlug: 'dermocosmetica',
      price: 19500,
      stock: 40,
      skuPrefix: 'FAR-AGU',
      description:
        'Rica en 15 minerales esenciales para calmar rojeces, irritaciones post-afeitado o exposición solar.',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Bálsamo Reparador Intensivo Cicatrizante B5 40ml',
      categorySlug: 'dermocosmetica',
      price: 22500,
      stock: 50,
      skuPrefix: 'FAR-CIC',
      description: 'Acelera la regeneración epidérmica con madecassoside, cobre, zinc y pantenol.',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Tensiómetro Digital de Brazo Automático con Memoria',
      categorySlug: 'ortopedia',
      price: 58000,
      stock: 20,
      skuPrefix: 'FAR-TNS',
      description:
        'Medición precisa y rápida de presión arterial y pulso con detector de arritmia y pantalla LCD grande.',
      image:
        'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Oxímetro de Pulso Saturómetro Digital de Dedo',
      categorySlug: 'ortopedia',
      price: 24000,
      stock: 30,
      skuPrefix: 'FAR-OXI',
      description:
        'Lectura instantánea de SpO2 y frecuencia cardíaca con pantalla OLED a color multidireccional.',
      image:
        'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Termómetro Infrarrojo Digital sin Contacto',
      categorySlug: 'botiquin',
      price: 29000,
      stock: 25,
      skuPrefix: 'FAR-TRM',
      description:
        'Medición en 1 segundo a 3-5cm de distancia con alarma sonora y lumínica de fiebre.',
      image:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Nebulizador a Pistón Familiar Ultracompacto',
      categorySlug: 'ortopedia',
      price: 68000,
      stock: 15,
      skuPrefix: 'FAR-NEB',
      description:
        'Alto flujo de niebla medicinal con kit completo de máscaras adulto y pediátrico.',
      image:
        'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Botiquín de Primeros Auxilios Completo (40 Piezas)',
      categorySlug: 'botiquin',
      price: 28000,
      stock: 35,
      skuPrefix: 'FAR-BOT',
      description:
        'Gazas estériles, vendas, alcohol, apósitos adhesivos, tijera, pinza, guantes y antiséptico.',
      image:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Alcohol en Gel Sanitizante 70% 500ml con Válvula',
      categorySlug: 'botiquin',
      price: 4900,
      stock: 80,
      skuPrefix: 'FAR-ALC',
      description:
        'Fórmula hidratante con aloe vera y glicerina que elimina el 99.9% de gérmenes sin resecar.',
      image:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Apósitos Adhesivos Curitas Transparentes x40',
      categorySlug: 'botiquin',
      price: 5200,
      stock: 90,
      skuPrefix: 'FAR-CUR',
      description:
        'Tiras impermeables y respirables con almohadilla central antiadherente para pequeñas heridas.',
      image:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Rodillera Neoprene con Soporte Patelar Centrado',
      categorySlug: 'ortopedia',
      price: 32000,
      stock: 25,
      skuPrefix: 'FAR-ROD',
      description:
        'Compresión térmica y estabilidad ligamentaria con anillo de silicona y ballenas laterales flexibles.',
      image:
        'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'FAR-ROD-M', price: 32000, stock: 12, attributes: { 'talle-ortopedia': 'M' } },
        { sku: 'FAR-ROD-L', price: 32000, stock: 13, attributes: { 'talle-ortopedia': 'L' } },
      ],
    },
    {
      name: 'Faja Lumbar Ortopédica con 4 Ballenas de Acero',
      categorySlug: 'ortopedia',
      price: 42000,
      stock: 20,
      skuPrefix: 'FAR-FAJ',
      description:
        'Doble ajuste elástico cruzado para soporte de columna en lumbalgias o esfuerzo laboral.',
      image:
        'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'FAR-FAJ-M', price: 42000, stock: 10, attributes: { 'talle-ortopedia': 'M' } },
        { sku: 'FAR-FAJ-L', price: 42000, stock: 10, attributes: { 'talle-ortopedia': 'L' } },
      ],
    },
    {
      name: 'Cepillo Dental Eléctrico Sónico Recargable',
      categorySlug: 'cuidado-personal',
      price: 49000,
      stock: 30,
      skuPrefix: 'FAR-CEP',
      description:
        '40.000 microvibraciones por minuto con temporizador de 2 minutos y 3 cabezales de repuesto.',
      image:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Pasta Dental Blanqueadora con Enzimas Naturales 100g',
      categorySlug: 'cuidado-personal',
      price: 8500,
      stock: 60,
      skuPrefix: 'FAR-PAS',
      description:
        'Blanqueamiento progresivo seguro sin dañar el esmalte dental con flúor activo anticaries.',
      image:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Almohadilla Térmica Eléctrica Lumbar & Cervical',
      categorySlug: 'ortopedia',
      price: 39000,
      stock: 20,
      skuPrefix: 'FAR-ALM',
      description:
        '3 niveles de temperatura con control digital y funda lavable suave de microfibra.',
      image:
        'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Jabón Líquido Antibacterial pH Balanceado 250ml',
      categorySlug: 'cuidado-personal',
      price: 6200,
      stock: 75,
      skuPrefix: 'FAR-JAB',
      description:
        'Higiene profunda diaria para manos y cuerpo con agentes humectantes que cuidan la piel.',
      image:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Gel Descongestivo Piernas Cansadas con Castaño de Indias',
      categorySlug: 'dermocosmetica',
      price: 17000,
      stock: 35,
      skuPrefix: 'FAR-GEL',
      description:
        'Efecto frío inmediato que estimula la circulación y alivia la pesadez tras largas jornadas.',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
