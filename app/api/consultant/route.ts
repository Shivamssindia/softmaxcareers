import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRUSTED_ORIGIN = "https://careers.softmax.in";
const TRUSTED_REFERER = "https://careers.softmax.in/";

export async function POST(request: Request) {
  try {
    const apiUrl = process.env.CONSULTANT_API_URL;
    const apiKey = process.env.CONSULTANT_API_KEY;

    if (!apiUrl || !apiKey) {
      console.error(
        "[consultant-route] Missing CONSULTANT_API_URL or CONSULTANT_API_KEY"
      );
      return NextResponse.json(
        { error: "Consultant API configuration is missing" },
        { status: 500 }
      );
    }

    let candidate: any;
    try {
      candidate = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate) ||
      typeof candidate.uid !== "string" ||
      typeof candidate.name !== "string" ||
      typeof candidate.email !== "string" ||
      !candidate.uid.trim() ||
      !candidate.name.trim() ||
      !candidate.email.trim()
    ) {
      return NextResponse.json(
        { error: "Candidate uid, name and email are required" },
        { status: 400 }
      );
    }

    const department = String(
      candidate.department ||
        candidate.jobDepartment ||
        candidate.job_department ||
        (Array.isArray(candidate.departments)
          ? candidate.departments[0]
          : candidate.departments) ||
        ""
    );

    const role = String(
      candidate.role ||
        candidate.jobRole ||
        candidate.job_role ||
        candidate.jobTitle ||
        (Array.isArray(candidate.roles) ? candidate.roles[0] : candidate.roles) ||
        ""
    );

    const nexusPayload = {
      ...candidate,
      candidateId: candidate.candidateId || undefined,
      department,
      role,
      jobDepartment: candidate.jobDepartment || department,
      jobRole: candidate.jobRole || role,
      job_department: candidate.job_department || department,
      job_role: candidate.job_role || role,
      departments: candidate.departments || (department ? [department] : []),
      roles: candidate.roles || (role ? [role] : []),
    };

    const endpoint = `${apiUrl.replace(/\/+$/, "")}/api/v1/external/consultant`;

    console.log("[consultant-route] Sending candidate to Nexus:", {
      uid: nexusPayload.uid,
      candidateId: nexusPayload.candidateId,
      name: nexusPayload.name,
      email: nexusPayload.email,
      department,
      role,
      origin: TRUSTED_ORIGIN,
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: apiKey,
        Origin: TRUSTED_ORIGIN,
        Referer: TRUSTED_REFERER,
      },
      body: JSON.stringify(nexusPayload),
      cache: "no-store",
    });

    const responseText = await response.text();
    let responseData: any = {};
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { message: responseText || "Empty response from Nexus API" };
    }

    if (!response.ok) {
      const errorMessage =
        responseData?.message ||
        responseData?.error ||
        `Nexus API returned HTTP ${response.status}`;

      console.error("[consultant-route] Nexus API rejected request:", {
        status: response.status,
        message: errorMessage,
        uid: nexusPayload.uid,
        candidateId: nexusPayload.candidateId,
      });

      return NextResponse.json(
        {
          success: false,
          error: String(errorMessage),
          upstreamStatus: response.status,
        },
        { status: response.status }
      );
    }

    console.log("[consultant-route] Candidate successfully synced:", {
      uid: nexusPayload.uid,
      candidateId: nexusPayload.candidateId,
      upstreamStatus: response.status,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Candidate successfully synced with Nexus",
        data: responseData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[consultant-route] Nexus connection failed:", {
      message: error instanceof Error ? error.message : String(error),
      cause:
        error instanceof Error && error.cause ? String(error.cause) : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to connect to Nexus consultant service",
      },
      { status: 502 }
    );
  }
}