import {
    expect,
    getChatInput,
    getIframe,
    openSettings,
    sleep,
    test,
} from "./lib/fixtures"

test.describe("Language Switching", () => {
    test("loads English by default", async ({ page }) => {
        await page.goto("/", { waitUntil: "networkidle" })
        await getIframe(page).waitFor({ state: "visible", timeout: 30000 })

        const chatInput = getChatInput(page)
        await expect(chatInput).toBeVisible({ timeout: 10000 })

        await expect(page.locator('button:has-text("Send")')).toBeVisible()
    })

    test("can switch to Chinese", async ({ page }) => {
        await page.goto("/", { waitUntil: "networkidle" })
        await getIframe(page).waitFor({ state: "visible", timeout: 30000 })

        await test.step("open settings and select Chinese", async () => {
            await openSettings(page)
            const languageSelector = page.locator('button:has-text("English")')
            await languageSelector.first().click()
            await page.locator('text="中文"').click()
        })

        await test.step("verify UI is in Chinese", async () => {
            await expect(page.locator('button:has-text("发送")')).toBeVisible({
                timeout: 5000,
            })
        })
    })

    test("language persists after reload", async ({ page }) => {
        await page.goto("/", { waitUntil: "networkidle" })
        await getIframe(page).waitFor({ state: "visible", timeout: 30000 })

        await test.step("switch to Chinese", async () => {
            await openSettings(page)
            const languageSelector = page.locator('button:has-text("English")')
            await languageSelector.first().click()
            await page.locator('text="中文"').click()
            await page.keyboard.press("Escape")
            await sleep(500)
        })

        await test.step("verify Chinese before reload", async () => {
            await expect(page.locator('button:has-text("发送")')).toBeVisible({
                timeout: 10000,
            })
        })

        await test.step("reload and verify Chinese persists", async () => {
            await page.reload({ waitUntil: "networkidle" })
            await getIframe(page).waitFor({ state: "visible", timeout: 30000 })
            // Wait for hydration and localStorage to be read
            await sleep(1000)
            await expect(page.locator('button:has-text("发送")')).toBeVisible({
                timeout: 10000,
            })
        })
    })

    test("Chinese locale URL works", async ({ page }) => {
        await page.goto("/zh", { waitUntil: "networkidle" })
        await getIframe(page).waitFor({ state: "visible", timeout: 30000 })

        await expect(page.locator('button:has-text("发送")')).toBeVisible({
            timeout: 10000,
        })
    })
})
