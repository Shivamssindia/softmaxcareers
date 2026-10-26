import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.CONSULTANT_API_URL;
    const apiKey = process.env.CONSULTANT_API_KEY;

    if (!apiUrl || !apiKey) {
      console.error("Missing CONSULTANT_API_URL or CONSULTANT_API_KEY");

      return NextResponse.json(
        { error: "Consultant API configuration is missing" },
        { status: 500 }
      );
    }

    const candidate: unknown = await request.json();

    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("uid" in candidate) ||
      !("name" in candidate) ||
      !("email" in candidate) ||
      typeof (candidate as any).uid !== "string" ||
      typeof (candidate as any).name !== "string" ||
      typeof (candidate as any).email !== "string" ||
      !(candidate as any).uid.trim() ||
      !(candidate as any).name.trim() ||
      !(candidate as any).email.trim()
    ) {
      return NextResponse.json(
        { error: "Candidate uid, name and email are required" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${apiUrl.replace(/\/+$/, "")}/api/v1/external/consultant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify(candidate),
        cache: "no-store",
      }
    );

    const responseText = await response.text();

    let data: unknown = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { message: responseText };
    }

    if (!response.ok) {
      const errorMessage =
        typeof data === "object" && data !== null && "message" in data
          ? String((data as any).message)
          : typeof data === "object" && data !== null && "error" in data
            ? String((data as any).error)
            : `Consultant API returned status ${response.status}`;

      console.error("Consultant API failed:", response.status);

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Consultant route error:", error);

    return NextResponse.json(
      { error: "Failed to connect to consultant service" },
      { status: 502 }
    );
  }
}