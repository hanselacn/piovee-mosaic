import { NextResponse } from "next/server";
import { isServiceAccountConfigured, uploadPhotoWithServiceAccount } from "@/lib/google-service-account";

export async function POST(request: Request) {
  try {
    if (!isServiceAccountConfigured()) {
      return NextResponse.json(
        { error: "Google Drive service account not configured" },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Google Drive
    const fileId = await uploadPhotoWithServiceAccount(
      buffer.toString("base64"),
      file.name,
      "Mosaics" // Folder name
    );

    return NextResponse.json({
      success: true,
      fileId,
      message: "Mosaic saved to Google Drive",
    });
  } catch (error: any) {
    console.error("Error saving mosaic:", error);
    return NextResponse.json(
      {
        error: "Failed to save mosaic",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
