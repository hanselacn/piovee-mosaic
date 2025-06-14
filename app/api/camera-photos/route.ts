import { NextResponse } from "next/server"
import { list } from "@vercel/blob"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const prefix = searchParams.get("prefix") || undefined

    const { blobs } = await list({ prefix: prefix })

    // Filter out files with "main-image" prefix
    const files = blobs.filter((file) => !file.name?.startsWith("main-image"))

    return NextResponse.json(files)
  } catch (error) {
    console.error("Error fetching camera photos:", error)
    return NextResponse.json({ error: "Failed to fetch camera photos" }, { status: 500 })
  }
}
