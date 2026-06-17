import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = "https://nittei-green.vercel.app";

    return {
        rules: {
            userAgent: "*",
            allow: "/",
            // 個別イベントや管理系はインデックス不要
            disallow: ["/event/", "/api/"],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
