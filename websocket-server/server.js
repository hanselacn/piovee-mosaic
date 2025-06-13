import { WebSocketServer } from "ws"
import http from "http"

const PORT = 8084

// Create HTTP server
const server = http.createServer()

// Create WebSocket server
const wss = new WebSocketServer({ server })

console.log(`WebSocket server starting on port ${PORT}...`)

// Store connected clients
const clients = new Set()

wss.on("connection", (ws, req) => {
  console.log(`New client connected from ${req.socket.remoteAddress}`)
  clients.add(ws)

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "welcome",
      message: "Connected to mosaic WebSocket server",
      clientCount: clients.size,
    }),
  )

  // Broadcast client count update to all clients
  broadcastToAll({
    type: "clientCount",
    count: clients.size,
  })

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString())
      console.log(`Received message type: ${message.type}`)

      if (message.type === "newPhoto") {
        console.log("Broadcasting new photo to all clients")
        // Broadcast the photo to all connected clients
        broadcastToAll(message)
      }
    } catch (error) {
      console.error("Error parsing message:", error)
    }
  })

  ws.on("close", () => {
    console.log("Client disconnected")
    clients.delete(ws)

    // Broadcast updated client count
    broadcastToAll({
      type: "clientCount",
      count: clients.size,
    })
  })

  ws.on("error", (error) => {
    console.error("WebSocket error:", error)
    clients.delete(ws)
  })
})

// Function to broadcast message to all connected clients
function broadcastToAll(message) {
  const messageString = JSON.stringify(message)

  clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      try {
        client.send(messageString)
      } catch (error) {
        console.error("Error sending message to client:", error)
        clients.delete(client)
      }
    } else {
      // Remove closed connections
      clients.delete(client)
    }
  })
}

// Start the server
server.listen(PORT, () => {
  console.log(`WebSocket server is running on ws://localhost:${PORT}`)
  console.log("Waiting for connections...")
})

// Handle server shutdown gracefully
process.on("SIGINT", () => {
  console.log("\nShutting down WebSocket server...")

  // Close all client connections
  clients.forEach((client) => {
    client.close()
  })

  // Close the server
  server.close(() => {
    console.log("WebSocket server closed")
    process.exit(0)
  })
})
