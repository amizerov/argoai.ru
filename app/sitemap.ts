import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://argoai.ru", lastModified: new Date(), changeFrequency: "monthly", priority: 1 }];
}
