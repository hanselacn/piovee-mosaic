import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  // Get the pathname
  const path = request.nextUrl.pathname

  // Define public paths that don't require authentication
  const isPublicPath =
    path.startsWith("/auth") ||
    path.startsWith("/camera") ||
    path.startsWith("/upload") ||
    path === "/" ||
    path === "/api/websocket-proxy" ||
    path === "/api/collage-photos" ||
    path === "/api/main-image" ||
    path === "/api/camera-photos" ||
    path === "/api/upload-photo" ||
    path === "/api/camera-auth"

  // Get the token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Redirect logic - only for non-public paths
  if (!token && !isPublicPath) {
    const url = new URL("/auth/signin", request.url)
    url.searchParams.set("callbackUrl", encodeURI(request.url))
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

// Configure which paths the middleware runs on
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|camera-shutter.mp3).*)"],
}
