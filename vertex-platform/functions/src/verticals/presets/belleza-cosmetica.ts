import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const BELLEZA_COSMETICA_PRESET: BusinessVerticalDefinition = {
  id: 'BELLEZA_COSMETICA',
  name: 'Belleza & Cosmética',
  icon: 'bi-flower1',
  description: 'Skincare, maquillaje profesional, perfumes de autor y cuidado capilar.',
  bannerTitle: 'Cuidado Personal, Belleza & Bienestar',
  bannerSubtitle:
    'Fórmulas limpias, cosmética cruelty-free y tratamientos dermatológicos avanzados.',
  heroImages: [
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1920&h=700&fit=crop&q=80',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    {
      categoryId: 'skincare',
      name: 'Cuidado Facial',
      slug: 'skincare',
      imageUrl:
        'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'maquillaje',
      name: 'Maquillaje',
      slug: 'maquillaje',
      imageUrl:
        'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'capilar',
      name: 'Cuidado Capilar',
      slug: 'capilar',
      imageUrl:
        'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'fragancias',
      name: 'Perfumería',
      slug: 'fragancias',
      imageUrl:
        'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&h=400&fit=crop&q=80',
    },
  ],
  categories: [
    {
      id: 'skincare',
      name: 'Skincare & Tratamiento Facial',
      slug: 'skincare',
      order: 1,
      filterableAttributes: ['tipo-piel'],
    },
    {
      id: 'maquillaje',
      name: 'Maquillaje & Rostro',
      slug: 'maquillaje',
      order: 2,
      filterableAttributes: ['tono'],
    },
    {
      id: 'capilar',
      name: 'Cuidado Capilar Profesional',
      slug: 'capilar',
      order: 3,
      filterableAttributes: ['tipo-cabello'],
    },
    {
      id: 'fragancias',
      name: 'Perfumería & Fragancias',
      slug: 'fragancias',
      order: 4,
      filterableAttributes: ['volumen'],
    },
    {
      id: 'corporal',
      name: 'Cuidado Corporal & Baño',
      slug: 'corporal',
      order: 5,
      filterableAttributes: [],
    },
  ],
  attributes: [
    {
      id: 'tipo-piel',
      name: 'Tipo de Piel',
      code: 'tipo-piel',
      type: 'select',
      values: ['Todo Tipo de Piel', 'Piel Grasa / Mixta', 'Piel Seca', 'Piel Sensible'],
      required: false,
    },
    {
      id: 'tono',
      name: 'Tono',
      code: 'tono',
      type: 'color',
      values: ['Claro / Fair', 'Medio / Light-Medium', 'Bronce / Tan', 'Oscuro / Deep'],
      required: false,
    },
    {
      id: 'tipo-cabello',
      name: 'Tipo de Cabello',
      code: 'tipo-cabello',
      type: 'select',
      values: ['Todo Tipo', 'Seco / Dañado', 'Graso / Con Caspa', 'Rizado / Con Frizz'],
      required: false,
    },
    {
      id: 'volumen',
      name: 'Contenido',
      code: 'volumen',
      type: 'button',
      values: ['30 ml', '50 ml', '100 ml', '250 ml'],
      required: false,
    },
  ],
  colors: {
    primary: '#ec4899',
    accent: '#c084fc',
    background: '#ffffff',
  },
  featureCards: [
    {
      title: 'Cruelty Free & Dermatológico',
      content: 'Productos certificados, testeados y respetuosos con tu piel y el ambiente.',
    },
    {
      title: 'Muestras de Regalo',
      content: 'Incluimos mini-tallas y muestras en cada uno de tus pedidos.',
    },
    {
      title: 'Rutinas Personalizadas',
      content: 'Consultá a nuestras expertas en skincare para encontrar tu rutina ideal.',
    },
  ],
  sampleProducts: [
    {
      name: 'Serum Facial Ácido Hialurónico Puro 2% + B5 30ml',
      categorySlug: 'skincare',
      price: 24500,
      stock: 60,
      skuPrefix: 'SKN-HYA',
      description:
        'Fórmula hidratante profunda con tres pesos moleculares de hialurónico y provitamina B5 para rellenar líneas finas.',
      image:
        'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Serum Vitamina C Pura 15% Antioxidante Iluminador',
      categorySlug: 'skincare',
      price: 29000,
      stock: 45,
      skuPrefix: 'SKN-VITC',
      description:
        'Potente antioxidante con ácido ferúlico y vitamina E que unifica el tono y aporta luminosidad radiante.',
      image:
        'https://images.unsplash.com/photo-1608248597359-53e3d64cbb38?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Gel Limpiador Facial Espumoso Niacinamida & Zinc',
      categorySlug: 'skincare',
      price: 18900,
      stock: 50,
      skuPrefix: 'SKN-CLN',
      description:
        'Limpiador suave que remueve impurezas y exceso de oleosidad sin alterar la barrera cutánea natural.',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        {
          sku: 'SKN-CLN-GRS',
          price: 18900,
          stock: 25,
          attributes: { 'tipo-piel': 'Piel Grasa / Mixta' },
        },
        {
          sku: 'SKN-CLN-SNS',
          price: 18900,
          stock: 25,
          attributes: { 'tipo-piel': 'Piel Sensible' },
        },
      ],
    },
    {
      name: 'Crema Hidratante Ceramid Complex Reparadora 50ml',
      categorySlug: 'skincare',
      price: 26000,
      stock: 40,
      skuPrefix: 'SKN-CRM',
      description:
        'Crema nutritiva con 5 ceramidas esenciales y centella asiática para restaurar la barrera de la piel.',
      image:
        'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Protector Solar Facial Toque Seco FPS 50+ 50ml',
      categorySlug: 'skincare',
      price: 27500,
      stock: 70,
      skuPrefix: 'SKN-SPF',
      description:
        'Protección de amplio espectro UVA/UVB con acabado invisible mate anti-brillo y resistente al sudor.',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Contorno de Ojos con Cafeína 5% & Péptidos 15ml',
      categorySlug: 'skincare',
      price: 21000,
      stock: 35,
      skuPrefix: 'SKN-EYE',
      description:
        'Tratamiento descongestivo para bolsas y ojeras con aplicador cerámico efecto frío.',
      image:
        'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Base de Maquillaje Fluida Cobertura Media Luminosa',
      categorySlug: 'maquillaje',
      price: 32000,
      stock: 40,
      skuPrefix: 'MKP-FND',
      description:
        'Base de larga duración de 24 horas con acabado natural satinado y ácido hialurónico.',
      image:
        'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'MKP-FND-LGT', price: 32000, stock: 20, attributes: { tono: 'Claro / Fair' } },
        {
          sku: 'MKP-FND-MED',
          price: 32000,
          stock: 20,
          attributes: { tono: 'Medio / Light-Medium' },
        },
      ],
    },
    {
      name: 'Corrector de Ojeras e Imperfecciones Full Coverage',
      categorySlug: 'maquillaje',
      price: 19500,
      stock: 45,
      skuPrefix: 'MKP-CNC',
      description:
        'Corrector cremoso de alta pigmentación que no se cuartea en las líneas de expresión.',
      image:
        'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'MKP-CNC-LGT', price: 19500, stock: 25, attributes: { tono: 'Claro / Fair' } },
        {
          sku: 'MKP-CNC-MED',
          price: 19500,
          stock: 20,
          attributes: { tono: 'Medio / Light-Medium' },
        },
      ],
    },
    {
      name: 'Máscara de Pestañas Volumen Extremo Waterproof',
      categorySlug: 'maquillaje',
      price: 16500,
      stock: 55,
      skuPrefix: 'MKP-MSC',
      description:
        'Cepillo de silicona de cerdas escalonadas que alarga y engrosa las pestañas sin grumos.',
      image:
        'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Labial Líquido Mate Larga Duración Intransferible',
      categorySlug: 'maquillaje',
      price: 15900,
      stock: 60,
      skuPrefix: 'MKP-LIP',
      description:
        'Color intenso aterciopelado con aceite de jojoba que no reseca los labios durante 16 horas.',
      image:
        'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Paleta de Sombras Nude & Warm 12 Tonos',
      categorySlug: 'maquillaje',
      price: 36000,
      stock: 30,
      skuPrefix: 'MKP-PLT',
      description:
        'Sombras ultra pigmentadas de fácil difuminado con acabados mate, satinado y glitter prensado.',
      image:
        'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Shampoo Reparador con Queratina & Argán 400ml',
      categorySlug: 'capilar',
      price: 17500,
      stock: 50,
      skuPrefix: 'CAP-SHP',
      description:
        'Limpia suavemente sin sulfatos agresivos, reconstruyendo la fibra capilar de cabellos dañados.',
      image:
        'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        {
          sku: 'CAP-SHP-DAM',
          price: 17500,
          stock: 25,
          attributes: { 'tipo-cabello': 'Seco / Dañado' },
        },
        {
          sku: 'CAP-SHP-OIL',
          price: 17500,
          stock: 25,
          attributes: { 'tipo-cabello': 'Graso / Con Caspa' },
        },
      ],
    },
    {
      name: 'Máscara Capilar Nutrición Profunda 250g',
      categorySlug: 'capilar',
      price: 22000,
      stock: 40,
      skuPrefix: 'CAP-MSK',
      description:
        'Tratamiento intensivo con manteca de karité y aminoácidos que devuelve brillo y suavidad extrema.',
      image:
        'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Óleo Capilar Protector Térmico & Antifrizz 100ml',
      categorySlug: 'capilar',
      price: 19800,
      stock: 45,
      skuPrefix: 'CAP-OIL',
      description:
        'Mezcla de aceites de macadamia y camelia que protege del calor hasta 230°C y sella puntas abiertas.',
      image:
        'https://images.unsplash.com/photo-1608248597359-53e3d64cbb38?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Eau de Parfum Santal & Bergamota 100ml',
      categorySlug: 'fragancias',
      price: 85000,
      stock: 25,
      skuPrefix: 'FRG-SNT',
      description:
        'Fragancia unisex amaderada con notas de cardamomo, sándalo australiano, ámbar y cedro de Virginia.',
      image:
        'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'FRG-SNT-50ML', price: 58000, stock: 15, attributes: { volumen: '50 ml' } },
        { sku: 'FRG-SNT-100ML', price: 85000, stock: 10, attributes: { volumen: '100 ml' } },
      ],
    },
    {
      name: 'Eau de Parfum Flor de Azahar & Vainilla Bourbon',
      categorySlug: 'fragancias',
      price: 79000,
      stock: 25,
      skuPrefix: 'FRG-AZH',
      description:
        'Aroma floral gourmand con jazmín sambac, azahar fresco, mandarina dulce y vainilla cremosa.',
      image:
        'https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Exfoliante Corporal Café & Azúcar Orgánica 300g',
      categorySlug: 'corporal',
      price: 18000,
      stock: 35,
      skuPrefix: 'BOD-SCR',
      description:
        'Scrub energizante con café molido y aceite de almendras dulces para una piel sedosa y renovada.',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Loción Corporal Hidratante Manteca de Karité 400ml',
      categorySlug: 'corporal',
      price: 19500,
      stock: 40,
      skuPrefix: 'BOD-LOT',
      description:
        'Fórmula de rápida absorción con manteca pura de karité y glicerina vegetal para 48h de humectación.',
      image:
        'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Jabón Líquido Corporal Espumoso Verbena & Limón',
      categorySlug: 'corporal',
      price: 13500,
      stock: 50,
      skuPrefix: 'BOD-SOAP',
      description:
        'Gel de baño revitalizante libre de parabenos con extractos botánicos de cítricos mediterráneos.',
      image:
        'https://images.unsplash.com/photo-1608248597359-53e3d64cbb38?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Kit de 8 Brochas de Maquillaje de Pelo Sintético Pro',
      categorySlug: 'maquillaje',
      price: 28000,
      stock: 30,
      skuPrefix: 'MKP-BRS',
      description:
        'Set completo de pinceles con mango de madera ergonómico y estuche de viaje de ecocuero.',
      image:
        'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Agua Micelar Desmaquillante Calmante 400ml',
      categorySlug: 'skincare',
      price: 16000,
      stock: 45,
      skuPrefix: 'SKN-MCL',
      description:
        'Remueve el maquillaje a prueba de agua en un solo paso sin necesidad de enjuague ni frotar.',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
