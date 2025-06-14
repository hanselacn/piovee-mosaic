import { NextResponse } from "next/server"

// Simple version without Pusher first to test basic functionality
export async function POST(request: Request) {
  try {
    console.log("📸 API Route: Received photo upload request")

    // Check if we can parse the request body
    let body
    try {
      body = await request.json()
      console.log("📸 API Route: Successfully parsed request body")
    } catch (parseError) {
      console.error("❌ API Route: Failed to parse request body:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { photoData } = body

    console.log("📸 API Route: Photo data received:", {
      hasPhotoData: !!photoData,
      photoDataLength: photoData?.length || 0,
      photoDataPrefix: photoData?.substring(0, 50) || "none",
    })

    if (!photoData) {
      console.error("❌ API Route: No photo data provided")
      return NextResponse.json({ error: "Photo data is required" }, { status: 400 })
    }

    // Validate that it's a valid data URL
    if (!photoData.startsWith("data:image/")) {
      console.error("❌ API Route: Invalid photo data format")
      return NextResponse.json({ error: "Invalid photo data format" }, { status: 400 })
    }

    // Check environment variables
    console.log("🔧 API Route: Checking environment variables...")
    const envCheck = {
      PUSHER_APP_ID: process.env.PUSHER_APP_ID ? "Set" : "Missing",
      PUSHER_APP_KEY: process.env.PUSHER_APP_KEY ? "Set" : "Missing",
      PUSHER_SECRET: process.env.PUSHER_SECRET ? "Set" : "Missing",
      PUSHER_CLUSTER: process.env.PUSHER_CLUSTER || "Missing",
    }
    console.log("🔧 API Route: Environment variables:", envCheck)

    // Check if any required env vars are missing
    const missingVars = Object.entries(envCheck)
      .filter(([key, value]) => value === "Missing")
      .map(([key]) => key)

    if (missingVars.length > 0) {
      console.error("❌ API Route: Missing environment variables:", missingVars)
      return NextResponse.json(
        {
          error: "Server configuration error",
          details: `Missing environment variables: ${missingVars.join(", ")}`,
        },
        { status: 500 },
      )
    }

    // Try to initialize Pusher
    let pusherServer
    try {
      const Pusher = require("pusher")
      pusherServer = new Pusher({
        appId: process.env.PUSHER_APP_ID!,
        key: process.env.PUSHER_APP_KEY!,
        secret: process.env.PUSHER_SECRET!,
        cluster: process.env.PUSHER_CLUSTER!,
        useTLS: true,
      })
      console.log("✅ API Route: Pusher server initialized successfully")
    } catch (pusherError) {
      console.error("❌ API Route: Failed to initialize Pusher:", pusherError)
      return NextResponse.json(
        {
          error: "Failed to initialize Pusher",
          details: pusherError instanceof Error ? pusherError.message : "Unknown Pusher error",
        },
        { status: 500 },
      )
    }

    console.log("📡 API Route: Sending photo to Pusher...")

    // Send the photo data to all clients via Pusher
    let pusherResponse
    try {
      pusherResponse = await pusherServer.trigger("mosaic-channel", "new-photo", {
        photoData,
        timestamp: Date.now(),
        id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      })
      console.log("✅ API Route: Pusher response:", pusherResponse)
    } catch (pusherSendError) {
      console.error("❌ API Route: Failed to send to Pusher:", pusherSendError)
      return NextResponse.json(
        {
          error: "Failed to send photo via Pusher",
          details: pusherSendError instanceof Error ? pusherSendError.message : "Unknown Pusher send error",
        },
        { status: 500 },
      )
    }

    console.log("✅ API Route: Photo sent successfully")
    return NextResponse.json({
      success: true,
      message: "Photo sent successfully",
      pusherResponse,
      envCheck, // Include env check in response for debugging
    })
  } catch (error) {
    console.error("❌ API Route: Unexpected error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

// Add a GET method for testing
export async function GET() {
  try {
    console.log("🔧 API Route: GET request for testing")

    const envCheck = {
      PUSHER_APP_ID: process.env.PUSHER_APP_ID ? "Set" : "Missing",
      PUSHER_APP_KEY: process.env.PUSHER_APP_KEY ? "Set" : "Missing",
      PUSHER_SECRET: process.env.PUSHER_SECRET ? "Set" : "Missing",
      PUSHER_CLUSTER: process.env.PUSHER_CLUSTER || "Missing",
      NODE_ENV: process.env.NODE_ENV,
    }

    return NextResponse.json({
      message: "Send photo API is working",
      timestamp: new Date().toISOString(),
      environmentVariables: envCheck,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to check API status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
