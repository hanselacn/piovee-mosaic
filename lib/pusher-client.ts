import PusherClient from "pusher-js"

// Singleton pattern for Pusher client
let pusherInstance: PusherClient | null = null

export function getPusherClient() {
  if (!pusherInstance) {
    // Get Pusher credentials from environment variables
    const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

    if (!key || !cluster) {
      console.error("Pusher credentials not found in environment variables")
      throw new Error("Pusher credentials not found")
    }

    // Initialize Pusher
    pusherInstance = new PusherClient(key, {
      cluster,
      forceTLS: true,
    })

    // Add global error handler
    pusherInstance.connection.bind("error", (err: any) => {
      console.error("Pusher connection error:", err)
    })
  }

  return pusherInstance
}

// Helper function to subscribe to a channel with error handling
export function subscribeToPusherChannel(channelName: string) {
  try {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(channelName)

    // Add channel subscription error handler
    channel.bind("pusher:subscription_error", (error: any) => {
      console.error(`Error subscribing to ${channelName}:`, error)
    })

    return channel
  } catch (error) {
    console.error(`Failed to subscribe to ${channelName}:`, error)
    throw error
  }
}

// Helper to check connection state
export function isPusherConnected() {
  if (!pusherInstance) return false
  return pusherInstance.connection.state === "connected"
}
