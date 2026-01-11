import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import "../globals.css"

const plusJakarta = Plus_Jakarta_Sans({
    variable: "--font-sans",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
    title: "Login - Next AI Draw.io",
    description: "Sign in to access Next AI Draw.io",
}

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${plusJakarta.variable} antialiased`}>
                {children}
            </body>
        </html>
    )
}
