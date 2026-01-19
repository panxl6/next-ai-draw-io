import { cookies } from "next/headers"
import { NextResponse } from "next/server"

// Hardcoded credentials
const VALID_USERNAME = "admin"
const VALID_PASSWORD = "Kx9#mP2$vL8@nQ5!wR3&tY7"

// Session cookie name
export const AUTH_COOKIE_NAME = "next-ai-drawio-auth"
// Session token (simple implementation - in production use JWT or similar)
const SESSION_TOKEN = "authenticated-session-token-v1"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { username, password } = body

        if (!username || !password) {
            return NextResponse.json(
                { error: "Username and password are required" },
                { status: 400 },
            )
        }

        if (username === VALID_USERNAME && password === VALID_PASSWORD) {
            const cookieStore = await cookies()

            // Check if request is actually over HTTPS
            // Only set secure flag when the connection is truly HTTPS
            // This allows the cookie to work over HTTP in production if needed
            const isSecure =
                request.headers.get("x-forwarded-proto") === "https" ||
                request.headers.get("x-forwarded-ssl") === "on" ||
                process.env.HTTPS === "true"

            // Set authentication cookie
            cookieStore.set(AUTH_COOKIE_NAME, SESSION_TOKEN, {
                httpOnly: true,
                secure: isSecure, // Only use secure flag when actually using HTTPS
                sameSite: "lax",
                maxAge: 60 * 60 * 24 * 30, // 30 days
                path: "/",
            })

            return NextResponse.json({ success: true })
        }

        return NextResponse.json(
            { error: "Invalid username or password" },
            { status: 401 },
        )
    } catch (_error) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
}
