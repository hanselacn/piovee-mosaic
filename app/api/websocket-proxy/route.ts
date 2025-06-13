import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const wsUrl = process.env.WEBSOCKET_SERVICE_URL || "ws://localhost:8084"

  return new Response(JSON.stringify({ url: wsUrl }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  })
}
