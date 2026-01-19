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

// Helper to build redirect URL using the Host header from the request
// This prevents redirects to 0.0.0.0 when server binds to that address
function buildRedirectUrl(request: NextRequest, pathname: string, searchParams?: URLSearchParams): URL {
    // Get the actual host from the request headers
    const host = request.headers.get("host") || request.headers.get("x-forwarded-host")
    // Get protocol from x-forwarded-proto or default to http
    const protocol = request.headers.get("x-forwarded-proto") || "http"
    
    if (host) {
        const url = new URL(`${protocol}://${host}${pathname}`)
        if (searchParams) {
            searchParams.forEach((value, key) => {
                url.searchParams.set(key, value)
            })
        }
        return url
    }
    
    // Fallback to nextUrl if host header is not available
    const url = request.nextUrl.clone()
    url.pathname = pathname
    if (searchParams) {
        url.search = searchParams.toString()
    }
    return url
}

export function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // Skip static files and Next.js internals
    if (
        pathname.startsWith("/_next/") ||
        pathname.includes("/favicon") ||
        /\.(.*)$/.test(pathname)
    ) {
        return
    }

    // HTTPS redirect is disabled by default
    // Application now uses HTTP by default
    // For production HTTPS, configure a reverse proxy (Nginx) with SSL certificates

    // Check authentication for protected routes
    // Skip API routes (except auth routes) and public paths
    const isApiRoute = pathname.startsWith("/api/")
    const isPublic = isPublicPath(pathname)

    if (!isApiRoute && !isPublic) {
        if (!isAuthenticated(request)) {
            // Redirect to login page with the original URL as a parameter
            const searchParams = new URLSearchParams()
            searchParams.set("from", pathname)
            const loginUrl = buildRedirectUrl(request, "/login", searchParams)
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
        const localizedPath = `/${locale}${pathname.startsWith("/") ? "" : "/"}${pathname}`
        const localizedUrl = buildRedirectUrl(request, localizedPath)
        return NextResponse.redirect(localizedUrl)
    }
}

export const config = {
    // Matcher ignoring `/_next/` and `/api/`
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
