import { type NextRequest, NextResponse } from "next/server"
import { writeFile, readFile, mkdir, unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

const PHOTOS_DIR = path.join(process.cwd(), "photos")
const PHOTOS_FILE = path.join(PHOTOS_DIR, "mosaic-photos.json")

interface PhotoData {
  dataUrl: string
  tileIndex: number
  timestamp: number
  id: string
}

// Ensure photos directory exists
async function ensurePhotosDir() {
  if (!existsSync(PHOTOS_DIR)) {
    await mkdir(PHOTOS_DIR, { recursive: true })
  }
}

// Read photos from file
async function readPhotos(): Promise<PhotoData[]> {
  try {
    await ensurePhotosDir()
    if (!existsSync(PHOTOS_FILE)) {
      return []
    }
    const data = await readFile(PHOTOS_FILE, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    console.error("Error reading photos:", error)
    return []
  }
}

// Write photos to file
async function writePhotos(photos: PhotoData[]) {
  try {
    await ensurePhotosDir()
    await writeFile(PHOTOS_FILE, JSON.stringify(photos, null, 2))
  } catch (error) {
    console.error("Error writing photos:", error)
  }
}

export async function GET() {
  try {
    const photos = await readPhotos()
    return NextResponse.json({ photos })
  } catch (error) {
    return NextResponse.json({ error: "Failed to read photos" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { dataUrl, tileIndex } = await request.json()

    const photos = await readPhotos()
    const newPhoto: PhotoData = {
      dataUrl,
      tileIndex,
      timestamp: Date.now(),
      id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }

    photos.push(newPhoto)
    await writePhotos(photos)

    return NextResponse.json({ success: true, photo: newPhoto })
  } catch (error) {
    return NextResponse.json({ error: "Failed to save photo" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    if (existsSync(PHOTOS_FILE)) {
      await unlink(PHOTOS_FILE)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to clear photos" }, { status: 500 })
  }
}
