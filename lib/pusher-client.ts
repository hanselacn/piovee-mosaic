import PusherClient from "pusher-js"

// Singleton pattern for Pusher client
let pusherInstance: PusherClient | null = null

export function getPusherClient() {
  if (!pusherInstance) {
    // Get Pusher credentials from environment variables
    const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

    console.log("Pusher environment check:", {
      key: key ? "Set" : "Not Set",
      cluster: cluster ? "Set" : "Not Set",
      keyLength: key?.length || 0,
      clusterValue: cluster,
    })

    if (!key || !cluster) {
      console.error("Pusher credentials missing:", {
        NEXT_PUBLIC_PUSHER_APP_KEY: key ? "Set" : "Missing",
        NEXT_PUBLIC_PUSHER_CLUSTER: cluster ? "Set" : "Missing",
      })
      throw new Error(
        `Pusher credentials not found. Key: ${key ? "Set" : "Missing"}, Cluster: ${cluster ? "Set" : "Missing"}`,
      )
    }

    console.log("Initializing Pusher with:", { key: key.substring(0, 10) + "...", cluster })

    // Initialize Pusher
    pusherInstance = new PusherClient(key, {
      cluster,
      forceTLS: true,
      enabledTransports: ["ws", "wss"],
    })

    // Add global error handler
    pusherInstance.connection.bind("error", (err: any) => {
      console.error("Pusher connection error:", err)
    })

    // Add state change logging
    pusherInstance.connection.bind("state_change", (states: any) => {
      console.log("Pusher state changed:", states.previous, "->", states.current)
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

    channel.bind("pusher:subscription_succeeded", () => {
      console.log(`Successfully subscribed to ${channelName}`)
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

// Helper to get connection state
export function getPusherConnectionState() {
  if (!pusherInstance) return "uninitialized"
  return pusherInstance.connection.state
}

// Helper to check if credentials are available
export function checkPusherCredentials() {
  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

  return {
    hasKey: !!key,
    hasCluster: !!cluster,
    key: key ? key.substring(0, 10) + "..." : "Missing",
    cluster: cluster || "Missing",
  }
}
