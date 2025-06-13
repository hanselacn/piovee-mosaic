import { google } from "googleapis"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

// Create a folder in Google Drive if it doesn't exist
export async function createFolderIfNotExists(folderName: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new Error("No access token found")
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })

  const drive = google.drive({ version: "v3", auth })

  // Check if folder exists
  const response = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  })

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id
  }

  // Create folder if it doesn't exist
  const fileMetadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  }

  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: "id",
  })

  return folder.data.id
}

// Upload a file to Google Drive
export async function uploadFile(base64Data: string, fileName: string, folderId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new Error("No access token found")
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })

  const drive = google.drive({ version: "v3", auth })

  // Remove data URL prefix if present
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "")
  const buffer = Buffer.from(base64Content, "base64")

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  }

  const media = {
    mimeType: "image/jpeg",
    body: buffer,
  }

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: "id,webContentLink",
  })

  return file.data
}

// List files in a folder
export async function listFiles(folderId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new Error("No access token found")
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })

  const drive = google.drive({ version: "v3", auth })

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id, name, webContentLink, thumbnailLink)",
    spaces: "drive",
  })

  return response.data.files || []
}

// Get file content
export async function getFileContent(fileId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new Error("No access token found")
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })

  const drive = google.drive({ version: "v3", auth })

  const response = await drive.files.get(
    {
      fileId: fileId,
      alt: "media",
    },
    { responseType: "arraybuffer" },
  )

  return Buffer.from(response.data as ArrayBuffer).toString("base64")
}
