import { match as matchLocale } from "@formatjs/intl-localematcher"
import Negotiator from "negotiator"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { i18n } from "./lib/i18n/config"

// Authentication constants
const AUTH_COOKIE_NAME = "next-ai-drawio-auth"
const SESSION_TOKEN = "authenticated-session-token-v1"

// Paths that don't require authentication
const PUBLIC_PATHS = [
    "/login",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/check",
]

function getLocale(request: NextRequest): string | undefined {
    // Negotiator expects plain object so we need to transform headers
    const negotiatorHeaders: Record<string, string> = {}
    request.headers.forEach((value, key) => {
        negotiatorHeaders[key] = value
    })

    // @ts-expect-error locales are readonly
    const locales: string[] = i18n.locales

    // Use negotiator and intl-localematcher to get best locale
    const languages = new Negotiator({ headers: negotiatorHeaders }).languages(
        locales,
    )

    const locale = matchLocale(languages, locales, i18n.defaultLocale)

    return locale
}

function isPublicPath(pathname: string): boolean {
    return PUBLIC_PATHS.some(
        (path) => pathname === path || pathname.startsWith(path + "/"),
    )
}

function isAuthenticated(request: NextRequest): boolean {
    const authCookie = request.cookies.get(AUTH_COOKIE_NAME)
    return authCookie?.value === SESSION_TOKEN
}

export function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // Skip static files and Next.js internals
    if (
        pathname.startsWith("/_next/") ||
        pathname.includes("/favicon") ||
        /\.(.*)$/.test(pathname)
    ) {
        return
    }

    // Force HTTPS redirect - Security: Only allow HTTPS in production
    // In production, all HTTP requests must be redirected to HTTPS
    if (
        process.env.NODE_ENV === "production" ||
        process.env.FORCE_HTTPS === "true"
    ) {
        const protocol =
            request.headers.get("x-forwarded-proto") ||
            (request.url.startsWith("https://") ? "https" : "http")

        // If request is HTTP, redirect to HTTPS
        if (protocol === "http" || request.url.startsWith("http://")) {
            try {
                const url = new URL(request.url)
                url.protocol = "https"
                // If using standard HTTPS port, remove port number for cleaner URLs
                if (url.port === "443") {
                    url.port = ""
                }
                return NextResponse.redirect(url.toString(), 301)
            } catch {
                // If URL parsing fails, construct HTTPS URL
                const httpsUrl = request.url.replace("http://", "https://")
                return NextResponse.redirect(httpsUrl, 301)
            }
        }
    }

    // Check authentication for protected routes
    // Skip API routes (except auth routes) and public paths
    const isApiRoute = pathname.startsWith("/api/")
    const isPublic = isPublicPath(pathname)

    if (!isApiRoute && !isPublic) {
        if (!isAuthenticated(request)) {
            // Redirect to login page with the original URL as a parameter
            const loginUrl = new URL("/login", request.url)
            loginUrl.searchParams.set("from", pathname)
            return NextResponse.redirect(loginUrl)
        }
    }

    // Skip further processing for API routes and login page
    if (isApiRoute || pathname === "/login") {
        return
    }

    // Check if there is any supported locale in the pathname
    const pathnameIsMissingLocale = i18n.locales.every(
        (locale) =>
            !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`,
    )

    // Redirect if there is no locale
    if (pathnameIsMissingLocale) {
        const locale = getLocale(request)

        // Redirect to localized path
        return NextResponse.redirect(
            new URL(
                `/${locale}${pathname.startsWith("/") ? "" : "/"}${pathname}`,
                request.url,
            ),
        )
    }
}

export const config = {
    // Matcher ignoring `/_next/` and `/api/`
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
