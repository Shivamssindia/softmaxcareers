import { Job } from "@/types";

/**
 * Converts a job title or name into a clean, URL-safe slug
 * Example: "Senior Full Stack Engineer" -> "senior-full-stack-engineer"
 */
export function getJobSlug(jobOrTitle: { title?: string; id?: string } | string): string {
  if (typeof jobOrTitle === "string") {
    return jobOrTitle
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  if (jobOrTitle?.title) {
    const slug = jobOrTitle.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug) return slug;
  }

  return (jobOrTitle?.id || "job").toLowerCase();
}

/**
 * Finds a job from the jobs list by either its URL slug, title, or ID.
 */
export function findJobBySlugOrId(
  identifier: string | undefined | null,
  jobs: Job[]
): Job | undefined {
  if (!identifier || !jobs || jobs.length === 0) return undefined;

  const rawDecoded = decodeURIComponent(identifier).trim().toLowerCase();
  const slugified = getJobSlug(rawDecoded);

  // 1. Direct slug match on job title
  const matchBySlug = jobs.find((j) => getJobSlug(j) === slugified);
  if (matchBySlug) return matchBySlug;

  // 2. Direct title match (case-insensitive)
  const matchByTitle = jobs.find(
    (j) => j.title.toLowerCase().trim() === rawDecoded
  );
  if (matchByTitle) return matchByTitle;

  // 3. Fallback to job.id match (e.g. "job-1")
  const matchById = jobs.find((j) => j.id.toLowerCase() === rawDecoded);
  if (matchById) return matchById;

  // 4. Partial / fuzzy match if exact match wasn't found
  const partialMatch = jobs.find((j) => {
    const jSlug = getJobSlug(j);
    return jSlug.includes(slugified) || slugified.includes(jSlug);
  });
  if (partialMatch) return partialMatch;

  return undefined;
}
