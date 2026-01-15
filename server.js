/**
 * HTTP server for Next.js
 * Uses HTTP mode by default for simplicity and compatibility
 * For production HTTPS, use a reverse proxy (Nginx) with SSL certificates
 */

const { createServer: createHttpServer } = require("http")
const { parse } = require("url")
const next = require("next")

const port = parseInt(process.env.PORT || "6002", 10)
const dev = process.env.NODE_ENV !== "production"
// For server binding, use 0.0.0.0 to listen on all interfaces
const bindHostname = process.env.HOSTNAME || "0.0.0.0"
// Don't pass hostname to Next.js - it will use the Host header from requests
// This prevents Next.js from generating URLs with 0.0.0.0
const app = next({ dev, port })
const handle = app.getRequestHandler()

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

    // HTTP mode (default)
    createHttpServer(requestHandler).listen(port, bindHostname, (err) => {
        if (err) throw err
        const protocol = "http"
        const displayHost = bindHostname === "0.0.0.0" 
            ? (process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).hostname + ":" + port : "localhost:" + port)
            : bindHostname + ":" + port
        console.log(`\n✅ Ready on ${protocol}://${displayHost}`)
        console.log(`   Listening on ${bindHostname}:${port}`)
        console.log(`\n💡 Tip: For production HTTPS, use a reverse proxy (Nginx) with SSL certificates\n`)
    })
})
