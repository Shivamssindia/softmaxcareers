import { MetadataRoute } from "next";
import { getJobsFromFirestore } from "@/lib/firestore";
import { getJobSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://softmax.in"
  ).replace(/\/+$/, "");

  const now = new Date();

  // 1. Core static routes with SEO priorities & change frequencies
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/openings`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/technologies`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/apply`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/candidate`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.75,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // 2. Fetch active job postings dynamically from Firestore
  const jobRoutes: MetadataRoute.Sitemap = [];
  const seenUrls = new Set<string>(staticRoutes.map((r) => r.url));

  try {
    const jobs = await getJobsFromFirestore();

    // Include only active job openings
    const activeJobs = jobs.filter((job) => job.status === "active" || !job.status);

    for (const job of activeJobs) {
      const slug = getJobSlug(job);
      if (!slug) continue;

      const jobUrl = `${baseUrl}/apply/${slug}`;
      const detailUrl = `${baseUrl}/detail/${slug}`;

      // Parse postedDate or fallback to current time
      let lastModified = now;
      if (job.postedDate) {
        const parsed = new Date(job.postedDate);
        if (!isNaN(parsed.getTime())) {
          lastModified = parsed;
        }
      }

      // Add detail page
      if (!seenUrls.has(detailUrl)) {
        seenUrls.add(detailUrl);
        jobRoutes.push({
          url: detailUrl,
          lastModified,
          changeFrequency: "daily",
          priority: 0.85,
        });
      }

      // Add apply page
      if (!seenUrls.has(jobUrl)) {
        seenUrls.add(jobUrl);
        jobRoutes.push({
          url: jobUrl,
          lastModified,
          changeFrequency: "daily",
          priority: 0.8,
        });
      }
    }
  } catch (error) {
    console.error("Error generating dynamic job sitemap entries:", error);
  }

  return [...staticRoutes, ...jobRoutes];
}
