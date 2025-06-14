import { NextResponse } from "next/server"
import { testPusherServer } from "@/lib/pusher-server"

export async function GET() {
  try {
    const result = await testPusherServer()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
