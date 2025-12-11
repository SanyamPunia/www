import { get } from "@vercel/edge-config";
import { getName } from "country-list";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function decodeString(str: string | null): string | null {
  if (!str) return null;
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

function getCountryName(countryCode: string | null): string | null {
  if (!countryCode) return null;

  if (countryCode.length > 2) {
    return countryCode;
  }

  const code = countryCode.toUpperCase();
  const countryName = getName(code);

  return countryName || countryCode;
}

async function getPublicIP(): Promise<string | null> {
  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });
    const data = (await response.json()) as { ip?: string };
    return data.ip || null;
  } catch (error) {
    console.error("Error fetching public IP:", error);
    return null;
  }
}

async function getLocationFromIP(ip: string): Promise<{
  city: string | null;
  country: string | null;
}> {
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      throw new Error("IP geolocation service failed");
    }

    const data = (await response.json()) as {
      city?: string;
      country_name?: string;
      error?: boolean;
    };

    if (data.error) {
      throw new Error("IP geolocation service returned error");
    }

    return {
      city: data.city || null,
      country: data.country_name || null,
    };
  } catch (error) {
    console.error("Error fetching location from IP:", error);
    try {
      const fallbackResponse = await fetch(`http://ip-api.com/json/${ip}`, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      if (!fallbackResponse.ok) {
        throw new Error("Fallback geolocation service failed");
      }

      const fallbackData = (await fallbackResponse.json()) as {
        city?: string;
        country?: string;
        status?: string;
      };

      if (fallbackData.status === "fail") {
        throw new Error("Fallback geolocation service returned fail");
      }

      return {
        city: fallbackData.city || null,
        country: fallbackData.country || null,
      };
    } catch (fallbackError) {
      console.error(
        "Error fetching location from fallback service:",
        fallbackError
      );
      return { city: null, country: null };
    }
  }
}

function getClientIP(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return null;
}

function isLocalhostIP(ip: string | null): boolean {
  if (!ip) return false;
  return (
    ip.startsWith("127.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.") ||
    ip === "::1" ||
    ip === "localhost"
  );
}

export async function GET() {
  try {
    const lastVisit = await get("lastVisit");

    if (!lastVisit || typeof lastVisit !== "object") {
      return NextResponse.json(
        { city: null, country: null },
        {
          headers: {
            "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
          },
        }
      );
    }

    const visitData = lastVisit as {
      city?: string;
      country?: string;
      timestamp?: number;
    };

    const city = decodeString(visitData.city || null);
    const country = getCountryName(visitData.country || null);

    return NextResponse.json(
      {
        city,
        country,
        timestamp: visitData.timestamp || null,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error: unknown) {
    console.error("Error fetching last visit:", error as Error);
    return NextResponse.json(
      {
        city: null,
        country: null,
        error: "Failed to fetch last visit",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let clientIP = getClientIP(request);

    if (isLocalhostIP(clientIP)) {
      // best-effort: grab the caller's public IP when developing locally
      const publicIP = await getPublicIP();
      if (publicIP) {
        clientIP = publicIP;
      }
    }

    if (!clientIP || isLocalhostIP(clientIP)) {
      return NextResponse.json(
        {
          error: "Client IP not available",
        },
        { status: 400 }
      );
    }

    const ipLocation = await getLocationFromIP(clientIP);
    const finalCity = decodeString(ipLocation.city);
    const finalCountry = getCountryName(ipLocation.country);

    if (!finalCity || !finalCountry) {
      return NextResponse.json(
        {
          error: "Location data not available",
          debug: {
            ip: clientIP,
          },
        },
        { status: 400 }
      );
    }

    const edgeConfig = process.env.EDGE_CONFIG;
    const vercelAccessToken = process.env.VERCEL_ACCESS_TOKEN;

    if (!edgeConfig) {
      console.error("EDGE_CONFIG env var is missing");
      return NextResponse.json(
        {
          error: "Server configuration error: EDGE_CONFIG not found",
        },
        { status: 500 }
      );
    }

    if (!vercelAccessToken) {
      console.error("VERCEL_ACCESS_TOKEN env var is missing");
      return NextResponse.json(
        {
          error: "Server configuration error: VERCEL_ACCESS_TOKEN not found",
        },
        { status: 500 }
      );
    }

    let edgeConfigId: string | undefined;
    try {
      const url = new URL(edgeConfig);
      const pathParts = url.pathname.split("/").filter(Boolean);
      edgeConfigId = pathParts[pathParts.length - 1];
    } catch (error) {
      console.error("Failed to parse EDGE_CONFIG URL:", error);
      edgeConfigId = edgeConfig.split("/")[1]?.split("?")[0];
    }

    if (!edgeConfigId) {
      console.error("Failed to extract Edge Config ID from:", edgeConfig);
      return NextResponse.json(
        {
          error: "Server configuration error: Invalid EDGE_CONFIG format",
        },
        { status: 500 }
      );
    }

    const updateData = {
      city: finalCity,
      country: finalCountry,
      timestamp: Date.now(),
    };

    // update edge config
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${vercelAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              operation: "upsert",
              key: "lastVisit",
              value: updateData,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to update edge config:", errorText);

      return NextResponse.json(
        { error: "Failed to update location", details: errorText },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        city: finalCity,
        country: finalCountry,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error("Error updating last visit:", error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
