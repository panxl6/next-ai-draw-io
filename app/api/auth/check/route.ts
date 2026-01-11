import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME } from "../login/route"

const SESSION_TOKEN = "authenticated-session-token-v1"

export async function GET() {
    const cookieStore = await cookies()
    const authCookie = cookieStore.get(AUTH_COOKIE_NAME)

    if (authCookie?.value === SESSION_TOKEN) {
        return NextResponse.json({ authenticated: true })
    }

    return NextResponse.json({ authenticated: false }, { status: 401 })
}
