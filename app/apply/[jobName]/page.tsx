"use client";

import React, { Suspense } from "react";
import { DynamicApplyForm } from "@/components/DynamicApplyForm";

interface DynamicJobApplyPageProps {
  params: {
    jobName: string;
  };
}

export default function DynamicJobApplyPage({ params }: DynamicJobApplyPageProps) {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-slate-500">
          Loading dynamic job application...
        </div>
      }
    >
      <DynamicApplyForm initialJobIdentifier={params.jobName} />
    </Suspense>
  );
}
