"use client";

import React, { Suspense } from "react";
import { DynamicApplyForm } from "@/components/DynamicApplyForm";

export default function ApplyPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-slate-500">
          Loading dynamic application form...
        </div>
      }
    >
      <DynamicApplyForm />
    </Suspense>
  );
}
