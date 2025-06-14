import { type NextRequest, NextResponse } from "next/server"
import { uploadPhotoWithServiceAccount, isServiceAccountConfigured } from "@/lib/google-service-account"

export async function POST(request: NextRequest) {
  try {
    console.log("📤 API: Photo upload request received")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ API: Service account not configured")
      return NextResponse.json(
        {
          error: "Service account not configured",
          message: "Please configure Google Service Account environment variables",
        },
        { status: 503 },
      )
    }

    // Parse request body
    const body = await request.json()
    const { photoData } = body

    if (!photoData) {
      console.error("❌ API: No photo data provided")
      return NextResponse.json({ error: "No photo data provided" }, { status: 400 })
    }

    // Enhanced validation for iPhone compatibility
    if (!photoData.startsWith("data:image/jpeg;base64,")) {
      console.error("❌ API: Invalid photo data format:", photoData.substring(0, 50))
      return NextResponse.json(
        {
          error: "Invalid photo data format",
          details: "Photo must be in JPEG base64 format",
        },
        { status: 400 },
      )
    }

    // Validate base64 content
    const base64Content = photoData.split(",")[1]
    if (!base64Content || base64Content.length < 100) {
      console.error("❌ API: Base64 content too short:", base64Content?.length || 0)
      return NextResponse.json(
        {
          error: "Invalid photo data",
          details: "Base64 content is too short or missing",
        },
        { status: 400 },
      )
    }

    // Test base64 validity
    try {
      const testDecode = Buffer.from(base64Content.substring(0, 100), "base64")
      console.log("✅ API: Base64 validation passed, test decode length:", testDecode.length)
    } catch (decodeError) {
      console.error("❌ API: Base64 decode test failed:", decodeError)
      return NextResponse.json(
        {
          error: "Invalid base64 encoding",
          details: "Photo data contains invalid base64 characters",
        },
        { status: 400 },
      )
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fileName = `camera-photo-${timestamp}.jpg`

    console.log(`📤 API: Uploading photo: ${fileName}, size: ${Math.round(photoData.length / 1024)}KB`)

    // Upload to Google Drive using service account
    const fileId = await uploadPhotoWithServiceAccount(photoData, fileName, "Mosaic Camera Photos")

    console.log(`✅ API: Photo uploaded successfully: ${fileName} (${fileId})`)

    return NextResponse.json({
      success: true,
      message: "Photo uploaded successfully",
      fileId: fileId,
      fileName: fileName,
      photoSize: `${Math.round(photoData.length / 1024)}KB`,
    })
  } catch (error) {
    console.error("❌ API: Error uploading photo:", error)

    return NextResponse.json(
      {
        error: "Failed to upload photo",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// GET endpoint for testing
export async function GET() {
  try {
    const isConfigured = isServiceAccountConfigured()

    return NextResponse.json({
      message: "Camera photo upload API",
      serviceAccountConfigured: isConfigured,
      timestamp: new Date().toISOString(),
      requiredEnvVars: ["GOOGLE_PROJECT_ID", "GOOGLE_PRIVATE_KEY", "GOOGLE_CLIENT_EMAIL"],
      optionalEnvVars: ["GOOGLE_DRIVE_FOLDER_ID"],
    })
  } catch (error) {
    return NextResponse.json(
      { error: "API test failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
