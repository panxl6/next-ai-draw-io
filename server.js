/**
 * HTTP/HTTPS server for Next.js
 * Supports both HTTP and HTTPS modes via USE_HTTP environment variable
 * HTTPS mode uses self-signed certificates for development
 */

const { createServer: createHttpsServer } = require("https")
const { createServer: createHttpServer } = require("http")
const { parse } = require("url")
const next = require("next")
const fs = require("fs")
const path = require("path")

const port = parseInt(process.env.PORT || "6002", 10)
const dev = process.env.NODE_ENV !== "production"
// For server binding, use 0.0.0.0 to listen on all interfaces
const bindHostname = process.env.HOSTNAME || "0.0.0.0"
// For Next.js app, don't pass hostname - let it use request headers
// This prevents Next.js from generating URLs with 0.0.0.0
// Support HTTP mode via USE_HTTP environment variable
const useHttp = process.env.USE_HTTP === "true" || process.env.USE_HTTP === "1"
// Don't pass hostname to Next.js - it will use the Host header from requests
const app = next({ dev, port })
const handle = app.getRequestHandler()

const certDir = path.join(__dirname, ".cert")
const keyPath = path.join(certDir, "localhost-key.pem")
const certPath = path.join(certDir, "localhost.pem")

// Check if selfsigned module is available
function checkSelfsignedModule() {
    try {
        require.resolve("selfsigned")
        return true
    } catch (_e) {
        return false
    }
}

// Auto-generate certificates if they don't exist and not using HTTP mode
if (!useHttp && (!fs.existsSync(keyPath) || !fs.existsSync(certPath))) {
    console.log("🔐 SSL certificates not found. Attempting to generate...\n")

    // Check if selfsigned module is installed
    if (!checkSelfsignedModule()) {
        console.warn('⚠️  Missing dependency: "selfsigned"')
        console.warn("   Cannot generate SSL certificates in production.")
        console.warn("   Falling back to HTTP mode.\n")
        console.warn("   To use HTTPS in production:")
        console.warn("   1. Use a reverse proxy (Nginx) with Let's Encrypt")
        console.warn("   2. Or set USE_HTTP=true explicitly\n")
        // Fall back to HTTP mode
        process.env.USE_HTTP = "true"
        startServer()
        return
    }

    // Set environment variable to indicate auto-generation (prevents duplicate message)
    process.env.AUTO_GENERATE = "true"

    try {
        // Create .cert directory if it doesn't exist
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true })
        }

        // Check if scripts directory exists (for standalone builds)
        const scriptsPath = path.join(__dirname, "scripts", "generate-ssl-cert.js")
        if (!fs.existsSync(scriptsPath)) {
            console.warn("⚠️  Certificate generator script not found in standalone build")
            console.warn("   Falling back to HTTP mode.\n")
            console.warn("   For production HTTPS, use a reverse proxy (Nginx) with Let's Encrypt\n")
            process.env.USE_HTTP = "true"
            startServer()
            return
        }

        // Dynamically require and run the certificate generator
        require(scriptsPath)

        // Verify certificates were created
        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            console.log("✅ Certificates generated successfully!\n")
            startServer()
        } else {
            console.warn("⚠️  Failed to generate certificates - files not found")
            console.warn("   Falling back to HTTP mode.\n")
            process.env.USE_HTTP = "true"
            startServer()
        }
    } catch (error) {
        console.warn("⚠️  Failed to generate SSL certificates:", error.message)
        console.warn("   Falling back to HTTP mode.\n")
        console.warn("   For production HTTPS, use a reverse proxy (Nginx) with Let's Encrypt\n")
        process.env.USE_HTTP = "true"
        startServer()
    }
} else {
    startServer()
}

function startServer() {
    app.prepare().then(() => {
        const requestHandler = async (req, res) => {
            try {
                const parsedUrl = parse(req.url, true)
                await handle(req, res, parsedUrl)
            } catch (err) {
                console.error("Error occurred handling", req.url, err)
                res.statusCode = 500
                res.end("internal server error")
            }
        }

        if (useHttp) {
            // HTTP mode
            createHttpServer(requestHandler).listen(port, bindHostname, (err) => {
                if (err) throw err
                const protocol = "http"
                const displayHost = bindHostname === "0.0.0.0" 
                    ? (process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).hostname + ":" + port : "0.0.0.0:" + port)
                    : bindHostname + ":" + port
                console.log(`\n✅ Ready on ${protocol}://${displayHost}`)
                console.log(`   Listening on ${bindHostname}:${port}`)
            })
        } else {
            // HTTPS mode
            const options = {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath),
            }

            createHttpsServer(options, requestHandler).listen(port, bindHostname, (err) => {
                if (err) throw err
                const protocol = "https"
                const displayHost = bindHostname === "0.0.0.0" 
                    ? (process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).hostname + ":" + port : "0.0.0.0:" + port)
                    : bindHostname + ":" + port
                console.log(`\n✅ Ready on ${protocol}://${displayHost}`)
                console.log(`   Listening on ${bindHostname}:${port}`)
                console.log(
                    `\n⚠️  Using self-signed certificate - browser will show security warning`,
                )
                console.log(
                    `   Click "Advanced" → "Proceed to localhost" to continue`,
                )
                console.log(`\n   To use HTTP instead, set USE_HTTP=true\n`)
            })
        }
    })
}
