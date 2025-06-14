import { NextResponse } from "next/server"
import { pusherServer } from "@/lib/pusher-server"

export async function POST(request: Request) {
  try {
    console.log("📸 Received photo upload request")

    const body = await request.json()
    const { photoData } = body

    console.log("📸 Photo data received:", {
      hasPhotoData: !!photoData,
      photoDataLength: photoData?.length || 0,
      photoDataPrefix: photoData?.substring(0, 50) || "none",
    })

    if (!photoData) {
      console.error("❌ No photo data provided")
      return NextResponse.json({ error: "Photo data is required" }, { status: 400 })
    }

    // Validate that it's a valid data URL
    if (!photoData.startsWith("data:image/")) {
      console.error("❌ Invalid photo data format")
      return NextResponse.json({ error: "Invalid photo data format" }, { status: 400 })
    }

    console.log("📡 Sending photo to Pusher...")

    // Send the photo data to all clients via Pusher
    const pusherResponse = await pusherServer.trigger("mosaic-channel", "new-photo", {
      photoData,
      timestamp: Date.now(),
      id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    })

    console.log("✅ Pusher response:", pusherResponse)

    return NextResponse.json({
      success: true,
      message: "Photo sent successfully",
      pusherResponse,
    })
  } catch (error) {
    console.error("❌ Error sending photo:", error)
    return NextResponse.json(
      {
        error: "Failed to send photo",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
