import { type NextRequest, NextResponse } from "next/server"
import { writeFile, readFile, mkdir, unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

const PHOTOS_DIR = path.join(process.cwd(), "photos")
const MAIN_IMAGE_FILE = path.join(PHOTOS_DIR, "main-image.json")

interface MainImageData {
  dataUrl: string
  filename: string
  uploadedAt: number
  requestedTiles: number
  actualTiles: number
  tileSize: number
  cols: number
  rows: number
}

// Ensure photos directory exists
async function ensurePhotosDir() {
  if (!existsSync(PHOTOS_DIR)) {
    await mkdir(PHOTOS_DIR, { recursive: true })
  }
}

// Calculate optimal tile settings that fill the entire canvas
function calculateOptimalTileSettings(requestedTiles: number) {
  const width = 800
  const height = 600

  // Find the best tile size that divides evenly into both dimensions
  let bestTileSize = 1
  let bestTileCount = 0
  let bestCols = 0
  let bestRows = 0
  let smallestDifference = Number.POSITIVE_INFINITY

  // Try different tile sizes from 1 to min(width, height)
  for (let tileSize = 1; tileSize <= Math.min(width, height); tileSize++) {
    const cols = Math.floor(width / tileSize)
    const rows = Math.floor(height / tileSize)
    const actualTiles = cols * rows

    // Calculate how close this is to the requested number
    const difference = Math.abs(actualTiles - requestedTiles)

    // Prefer this tile size if it's closer to the requested count
    if (difference < smallestDifference) {
      smallestDifference = difference
      bestTileSize = tileSize
      bestTileCount = actualTiles
      bestCols = cols
      bestRows = rows
    }
  }

  // Ensure we have at least some reasonable minimum
  if (bestTileCount < 4) {
    bestTileSize = Math.min(width, height) / 2
    bestCols = Math.floor(width / bestTileSize)
    bestRows = Math.floor(height / bestTileSize)
    bestTileCount = bestCols * bestRows
  }

  return {
    tileSize: bestTileSize,
    actualTiles: bestTileCount,
    cols: bestCols,
    rows: bestRows,
    canvasWidth: bestCols * bestTileSize,
    canvasHeight: bestRows * bestTileSize,
  }
}

// Read main image from file
async function readMainImage(): Promise<MainImageData | null> {
  try {
    await ensurePhotosDir()
    if (!existsSync(MAIN_IMAGE_FILE)) {
      return null
    }
    const data = await readFile(MAIN_IMAGE_FILE, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    console.error("Error reading main image:", error)
    return null
  }
}

// Write main image to file
async function writeMainImage(imageData: MainImageData) {
  try {
    await ensurePhotosDir()
    await writeFile(MAIN_IMAGE_FILE, JSON.stringify(imageData, null, 2))
  } catch (error) {
    console.error("Error writing main image:", error)
  }
}

export async function GET() {
  try {
    const mainImage = await readMainImage()
    return NextResponse.json({ mainImage })
  } catch (error) {
    return NextResponse.json({ error: "Failed to read main image" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { dataUrl, filename, minTiles = 192 } = await request.json()

    const { tileSize, actualTiles, cols, rows } = calculateOptimalTileSettings(minTiles)

    const imageData: MainImageData = {
      dataUrl,
      filename,
      uploadedAt: Date.now(),
      requestedTiles: minTiles,
      actualTiles,
      tileSize,
      cols,
      rows,
    }

    await writeMainImage(imageData)

    console.log(`Optimal tile calculation:`)
    console.log(`- Requested: ${minTiles} tiles`)
    console.log(`- Actual: ${actualTiles} tiles`)
    console.log(`- Tile size: ${tileSize}x${tileSize}px`)
    console.log(`- Grid: ${cols}x${rows}`)
    console.log(`- Canvas coverage: ${cols * tileSize}x${rows * tileSize}px`)

    return NextResponse.json({ success: true, mainImage: imageData })
  } catch (error) {
    return NextResponse.json({ error: "Failed to save main image" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    if (existsSync(MAIN_IMAGE_FILE)) {
      await unlink(MAIN_IMAGE_FILE)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete main image" }, { status: 500 })
  }
}
