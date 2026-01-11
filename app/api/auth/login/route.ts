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

            // Check if request is over HTTPS
            // In production, always use secure flag
            // In development, use secure flag if HTTPS is enabled
            const isSecure =
                process.env.NODE_ENV === "production" ||
                process.env.HTTPS === "true" ||
                request.headers.get("x-forwarded-proto") === "https" ||
                request.headers.get("x-forwarded-ssl") === "on"

            // Set authentication cookie
            cookieStore.set(AUTH_COOKIE_NAME, SESSION_TOKEN, {
                httpOnly: true,
                secure: isSecure, // Use secure flag in production or when HTTPS is enabled
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
