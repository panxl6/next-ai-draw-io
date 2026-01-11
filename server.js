/**
 * HTTPS development server for Next.js
 * This script creates an HTTPS server using self-signed certificates
 */

const { createServer } = require("https")
const { parse } = require("url")
const next = require("next")
const fs = require("fs")
const path = require("path")

const port = parseInt(process.env.PORT || "6002", 10)
const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME || "localhost"
const app = next({ dev, hostname, port })
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

// Auto-generate certificates if they don't exist
if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log("🔐 SSL certificates not found. Generating now...\n")

    // Check if selfsigned module is installed
    if (!checkSelfsignedModule()) {
        console.error('❌ Missing required dependency: "selfsigned"')
        console.error("\nPlease install dependencies first:")
        console.error("   npm install\n")
        console.error("Or install it specifically:")
        console.error("   npm install --save-dev selfsigned\n")
        process.exit(1)
    }

    // Set environment variable to indicate auto-generation (prevents duplicate message)
    process.env.AUTO_GENERATE = "true"

    try {
        // Create .cert directory if it doesn't exist
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true })
        }

        // Dynamically require and run the certificate generator
        require("./scripts/generate-ssl-cert.js")

        // Verify certificates were created
        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            console.log("✅ Certificates generated successfully!\n")
            startServer()
        } else {
            console.error(
                "❌ Failed to generate certificates - files not found",
            )
            process.exit(1)
        }
    } catch (error) {
        console.error("❌ Failed to generate SSL certificates:", error.message)
        console.error("\nTroubleshooting:")
        console.error("1. Ensure dependencies are installed: npm install")
        console.error('2. Check that "selfsigned" is in devDependencies')
        console.error(
            "3. Try manually generating certificates: npm run generate-cert\n",
        )
        process.exit(1)
    }
} else {
    startServer()
}

function startServer() {
    app.prepare().then(() => {
        const options = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
        }

        createServer(options, async (req, res) => {
            try {
                const parsedUrl = parse(req.url, true)

                // Redirect HTTP to HTTPS if accessed via HTTP
                if (req.headers["x-forwarded-proto"] === "http") {
                    res.writeHead(301, {
                        Location: `https://${req.headers.host}${req.url}`,
                    })
                    res.end()
                    return
                }

                await handle(req, res, parsedUrl)
            } catch (err) {
                console.error("Error occurred handling", req.url, err)
                res.statusCode = 500
                res.end("internal server error")
            }
        }).listen(port, hostname, (err) => {
            if (err) throw err
            console.log(`\n✅ Ready on https://${hostname}:${port}`)
            console.log(
                `\n⚠️  Using self-signed certificate - browser will show security warning`,
            )
            console.log(
                `   Click "Advanced" → "Proceed to localhost" to continue`,
            )
            console.log(`\n   To use HTTP instead, run: npm run dev:http\n`)
        })
    })
}
