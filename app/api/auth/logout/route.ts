import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME } from "../login/route"

export async function POST() {
    const cookieStore = await cookies()

    // Clear authentication cookie
    cookieStore.delete(AUTH_COOKIE_NAME)

    return NextResponse.json({ success: true })
}
