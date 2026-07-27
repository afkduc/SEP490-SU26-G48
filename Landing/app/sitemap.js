const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://autogara.vn";

export default function sitemap() {
  return [
    {
      url: `${SITE_URL}/gioi-thieu`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/gioi-thieu/tra-cuu`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
