"use client"

import { AlertCircle, Loader2, Lock, User } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setIsLoading(true)

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            })

            const data = await response.json()

            if (response.ok) {
                // Redirect to the original page or home
                const redirectTo = searchParams.get("from") || "/en"
                router.push(redirectTo)
                router.refresh()
            } else {
                setError(data.error || "Login failed")
            }
        } catch (_err) {
            setError("An error occurred. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            {/* Animated background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
                <div
                    className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-accent/10 via-transparent to-transparent rounded-full blur-3xl animate-pulse"
                    style={{ animationDelay: "1s" }}
                />
            </div>

            <div className="w-full max-w-md relative">
                {/* Logo and title */}
                <div className="text-center mb-8 animate-fade-in">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg mb-4">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="w-8 h-8 text-primary-foreground"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-label="Diagram icon"
                        >
                            <title>Diagram Icon</title>
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M3 9h18" />
                            <path d="M9 21V9" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-semibold text-foreground mb-2">
                        Next AI Draw.io
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Sign in to access the diagram editor
                    </p>
                </div>

                {/* Login card */}
                <div
                    className="bg-card border border-border/50 rounded-2xl shadow-soft-lg p-8 animate-fade-in"
                    style={{ animationDelay: "100ms" }}
                >
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error message */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm animate-fade-in">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Username field */}
                        <div className="space-y-2">
                            <label
                                htmlFor="username"
                                className="block text-sm font-medium text-foreground"
                            >
                                Username
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    <User className="w-4 h-4" />
                                </div>
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) =>
                                        setUsername(e.target.value)
                                    }
                                    className="w-full h-11 pl-10 pr-4 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
                                    placeholder="Enter your username"
                                    required
                                    autoComplete="username"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* Password field */}
                        <div className="space-y-2">
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-foreground"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    className="w-full h-11 pl-10 pr-4 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
                                    placeholder="Enter your password"
                                    required
                                    autoComplete="current-password"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign in"
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p
                    className="text-center text-xs text-muted-foreground mt-6 animate-fade-in"
                    style={{ animationDelay: "200ms" }}
                >
                    AI-powered diagram generator
                </p>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    )
}
