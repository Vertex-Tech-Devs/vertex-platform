export interface AboutUsFeatureCard {
  title: string;
  content: string;
}

export interface AboutUsData {
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImageUrl: string;

  centralTitle: string;
  centralImageUrl: string;
  centralDescription: string;

  cardsSectionTitle: string;
  featureCards: AboutUsFeatureCard[];
}
