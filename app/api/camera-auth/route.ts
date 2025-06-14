import { type NextRequest, NextResponse } from "next/server"
import { isServiceAccountConfigured } from "@/lib/google-service-account"

export async function POST(request: NextRequest) {
  try {
    console.log("🔐 Camera authentication request")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    // For camera authentication, we just need to verify service account is available
    // The actual Google Drive operations will use the service account directly
    console.log("✅ Service account authentication verified")

    return NextResponse.json({
      success: true,
      message: "Camera authentication successful",
      authenticated: true,
    })
  } catch (error: any) {
    console.error("❌ Camera authentication error:", error)

    return NextResponse.json(
      {
        error: "Camera authentication failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
