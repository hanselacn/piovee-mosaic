import { NextResponse } from "next/server"
import { pusherServer } from "@/lib/pusher-server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { photoData } = body

    if (!photoData) {
      return NextResponse.json({ error: "Photo data is required" }, { status: 400 })
    }

    // Send the photo data to all clients via Pusher
    await pusherServer.trigger("mosaic-channel", "new-photo", {
      photoData,
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending photo:", error)
    return NextResponse.json({ error: "Failed to send photo" }, { status: 500 })
  }
}
