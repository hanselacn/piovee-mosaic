import { type NextRequest, NextResponse } from "next/server"
import { pusherServer } from "@/lib/pusher-server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { photoData, tileIndex } = body

    // Validate the request
    if (!photoData) {
      return NextResponse.json({ error: "Photo data is required" }, { status: 400 })
    }

    // Send the photo data to all clients via Pusher
    await pusherServer.trigger("mosaic-channel", "new-photo", {
      photoData,
      tileIndex,
      timestamp: Date.now(),
    })

    // Also save to Google Drive if needed
    // ... your existing Google Drive save logic ...

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending photo:", error)
    return NextResponse.json({ error: "Failed to send photo" }, { status: 500 })
  }
}
