import Pusher from "pusher"

// Create a Pusher instance for server-side usage
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

// Test function to verify Pusher server configuration
export async function testPusherServer() {
  try {
    console.log("🔧 Testing Pusher server configuration...")
    console.log("Environment variables:", {
      PUSHER_APP_ID: process.env.PUSHER_APP_ID ? "Set" : "Missing",
      PUSHER_APP_KEY: process.env.PUSHER_APP_KEY ? "Set" : "Missing",
      PUSHER_SECRET: process.env.PUSHER_SECRET ? "Set" : "Missing",
      PUSHER_CLUSTER: process.env.PUSHER_CLUSTER || "Missing",
    })

    const response = await pusherServer.trigger("test-channel", "test-event", {
      message: "Test message",
      timestamp: Date.now(),
    })

    console.log("✅ Pusher server test successful:", response)
    return { success: true, response }
  } catch (error) {
    console.error("❌ Pusher server test failed:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
