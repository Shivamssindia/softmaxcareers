import React from "react";
import { Job } from "@/types";
import { getJobSlug } from "@/lib/slug";

interface StructuredDataProps {
  jobs?: Job[];
}

export const StructuredData: React.FC<StructuredDataProps> = ({ jobs = [] }) => {
  // 1. Organization Schema
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SoftMax Technologies",
    alternateName: ["SoftMax", "SoftMax Careers", "SoftMax IT Careers"],
    url: "https://softmax.in",
    logo: "https://softmax.in/logo.jpg",
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: "+91-800-123-4567",
        contactType: "customer service",
        areaServed: ["IN", "US", "AE", "GB"],
        availableLanguage: ["English", "Hindi"],
      },
      {
        "@type": "ContactPoint",
        email: "careers@softmax.in",
        contactType: "recruitment",
        areaServed: "IN",
        availableLanguage: "English",
      },
    ],
    sameAs: [
      "https://softmax.in",
      "https://linkedin.com/company/softmax-tech",
      "https://twitter.com/softmax_tech",
      "https://github.com/softmax-tech",
    ],
  };

  // 2. WebSite with SearchAction Schema
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "SoftMax IT Careers Platform",
    url: "https://softmax.in",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://softmax.in/openings?search={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  // 3. JobPosting Schema Array for Google Jobs Rich Snippets
  const jobPostingSchemas = jobs
    .filter((j) => j.status === "active")
    .map((job) => ({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: job.title,
      description: `
        <p><strong>Department:</strong> ${job.department} (${job.category} IT Role)</p>
        <p>${job.description}</p>
        <h4>Key Responsibilities:</h4>
        <ul>
          ${job.responsibilities.map((r) => `<li>${r}</li>`).join("")}
        </ul>
        <h4>Requirements:</h4>
        <ul>
          ${job.requirements.map((r) => `<li>${r}</li>`).join("")}
        </ul>
        <p><strong>Experience:</strong> ${job.experience}</p>
        <p><strong>Apply directly at:</strong> <a href="https://softmax.in/apply/${getJobSlug(job)}">https://softmax.in/apply/${getJobSlug(job)}</a></p>
      `,
      datePosted: `${job.postedDate}T09:00:00+05:30`,
      validThrough: `${job.validThrough || "2027-06-30"}T23:59:59+05:30`,
      employmentType: "FULL_TIME",
      hiringOrganization: {
        "@type": "Organization",
        name: "SoftMax Technologies",
        sameAs: "https://softmax.in",
        logo: "https://softmax.in/logo.jpg",
      },
      jobLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          streetAddress: "SoftMax Tech Park, Outer Ring Road, Bellandur",
          addressLocality: "Bengaluru",
          addressRegion: "Karnataka",
          postalCode: "560103",
          addressCountry: "IN",
        },
      },
      jobLocationType:
        job.type === "Remote" || job.location.toLowerCase().includes("remote")
          ? "TELECOMMUTE"
          : undefined,
      applicantLocationRequirements: {
        "@type": "Country",
        name: "India",
      },
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: job.salaryCurrency || "INR",
        value: {
          "@type": "QuantitativeValue",
          minValue: job.salaryMin || 1200000,
          maxValue: job.salaryMax || 2800000,
          unitText: "YEAR",
        },
      },
      industry: "Information Technology & Services",
      skills: job.tags.join(", "),
    }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      {jobPostingSchemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
};
