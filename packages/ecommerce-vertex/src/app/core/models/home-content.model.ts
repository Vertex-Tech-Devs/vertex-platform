export interface FeaturedCategory {
  categoryId: string;
  name: string;
  slug: string;
  imageUrl: string;
}

export interface CarouselSettings {
  interval: number;
  showIndicators: boolean;
}

export interface HeroImage {
  imageUrl: string;
  linkType?: 'product' | 'category' | 'none';
  linkId?: string;
}

export interface HeroBanner {
  id?: string;
  imageUrl?: string;

  heroImages?: HeroImage[];

  carouselSettings?: CarouselSettings;
  title?: string;
  buttonText?: string;
  buttonLink?: string;
  featuredCategories?: FeaturedCategory[];
  lastUpdated?: Date;
}
