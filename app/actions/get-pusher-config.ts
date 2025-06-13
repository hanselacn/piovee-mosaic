"use server"

export async function getPusherConfig() {
  return {
    key: process.env.PUSHER_APP_KEY!,
    cluster: process.env.PUSHER_CLUSTER!,
  }
}
