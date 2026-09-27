import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://argoai.ru", lastModified: new Date(), changeFrequency: "monthly", priority: 1 }, { url: "https://argoai.ru/transcribe", lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 }];
}
