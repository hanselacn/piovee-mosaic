import PusherClient from "pusher-js"
import { getPusherConfig } from "@/app/actions/get-pusher-config"

let pusher: PusherClient | undefined

export const initializePusher = async () => {
  if (!pusher) {
    const config = await getPusherConfig()
    pusher = new PusherClient(config.key, {
      cluster: config.cluster,
    })
  }
  return pusher
}

export const getPusherClient = () => {
  if (!pusher) {
    throw new Error("Pusher not initialized. Call initializePusher() first.")
  }
  return pusher
}
