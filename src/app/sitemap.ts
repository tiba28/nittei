import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = "https://nittei-green.vercel.app";

    return [
        {
            url: `${baseUrl}/`,
            lastModified: new Date(),
        },
    ];
}