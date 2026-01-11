/**
 * Generate self-signed SSL certificate for local development
 * This creates a certificate valid for localhost and 127.0.0.1
 */

const fs = require("fs")
const path = require("path")
const selfsigned = require("selfsigned")

const certDir = path.join(__dirname, "..", ".cert")
const keyPath = path.join(certDir, "localhost-key.pem")
const certPath = path.join(certDir, "localhost.pem")

// Create .cert directory if it doesn't exist
if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true })
}

// Check if certificates already exist
// If called from server.js (auto-generation), skip this check and regenerate
const isAutoGeneration = process.env.AUTO_GENERATE === "true"

if (!isAutoGeneration && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log("✅ SSL certificates already exist at:", certDir)
    console.log(
        "   To regenerate, delete the .cert folder and run this script again.\n",
    )
    process.exit(0)
}

if (!isAutoGeneration) {
    console.log("🔐 Generating self-signed SSL certificate for localhost...")
}

try {
    // Generate certificate attributes
    const attrs = [{ name: "commonName", value: "localhost" }]

    // Certificate extensions
    const pems = selfsigned.generate(attrs, {
        keySize: 2048,
        days: 365,
        algorithm: "sha256",
        extensions: [
            {
                name: "basicConstraints",
                cA: false,
            },
            {
                name: "keyUsage",
                keyCertSign: false,
                digitalSignature: true,
                nonRepudiation: false,
                keyEncipherment: true,
                dataEncipherment: false,
            },
            {
                name: "subjectAltName",
                altNames: [
                    {
                        type: 2, // DNS
                        value: "localhost",
                    },
                    {
                        type: 2, // DNS
                        value: "*.localhost",
                    },
                    {
                        type: 7, // IP
                        ip: "127.0.0.1",
                    },
                    {
                        type: 7, // IP
                        ip: "::1",
                    },
                ],
            },
        ],
    })

    // Write key and certificate to files
    fs.writeFileSync(keyPath, pems.private)
    fs.writeFileSync(certPath, pems.cert)

    if (!isAutoGeneration) {
        console.log("✅ SSL certificate generated successfully!")
        console.log(`   Key: ${keyPath}`)
        console.log(`   Cert: ${certPath}`)
        console.log(
            "\n⚠️  This is a self-signed certificate for development only.",
        )
        console.log(
            "   Your browser will show a security warning - this is normal.",
        )
        console.log(
            '   Click "Advanced" and then "Proceed to localhost" to continue.\n',
        )
    }
} catch (error) {
    console.error("❌ Failed to generate SSL certificate:", error.message)
    console.error('\nMake sure "selfsigned" package is installed:')
    console.error("   npm install --save-dev selfsigned")
    process.exit(1)
}
