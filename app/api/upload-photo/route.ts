import { type NextRequest, NextResponse } from "next/server"
import { uploadcollagePhotoWithServiceAccount, isServiceAccountConfigured } from "@/lib/google-service-account"
import { triggerPusherEvent } from "@/lib/pusher-server"

export async function POST(request: NextRequest) {
  try {
    console.log("📤 Processing camera photo upload request")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    const body = await request.json()
    const { photoData, fileName } = body

    if (!photoData || !fileName) {
      console.error("❌ Missing photo data or filename")
      return NextResponse.json({ error: "Missing photo data or filename" }, { status: 400 })
    }

    console.log(`📷 Uploading camera photo: ${fileName}`)

    // Upload to the "Camera Photos" folder using service account
    const fileId = await uploadcollagePhotoWithServiceAccount(photoData, fileName, "Camera Photos")

    console.log(`✅ Camera photo uploaded successfully: ${fileName} (${fileId})`)

    // Trigger Pusher event with the filename
    await triggerPusherEvent("camera-channel", "photo-uploaded", { fileName })
    console.log("📡 Pusher event triggered for:", fileName)

    return NextResponse.json({
      success: true,
      fileId,
      message: "Camera photo uploaded successfully",
      folder: "Camera Photos",
    })
  } catch (error: any) {
    console.error("❌ Error uploading camera photo:", error)

    return NextResponse.json(
      {
        error: "Failed to upload camera photo",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
