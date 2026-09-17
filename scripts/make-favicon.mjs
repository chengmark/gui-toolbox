import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

async function ensureDeps() {
  try {
    require.resolve("sharp")
    require.resolve("png-to-ico")
  } catch {
    const { execSync } = await import("node:child_process")
    execSync("bun add -d sharp png-to-ico", { stdio: "inherit" })
  }
}

async function main() {
  await ensureDeps()
  const sharp = (await import("sharp")).default
  const pngToIco = (await import("png-to-ico")).default

  const src = process.argv[2]
  if (!src) throw new Error("Usage: bun scripts/make-favicon.mjs <source>")

  const png256 = await sharp(src).resize(256, 256, { fit: "cover" }).png().toBuffer()
  fs.mkdirSync("public", { recursive: true })
  fs.writeFileSync("public/favicon-source.png", png256)

  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const buffers = await Promise.all(
    sizes.map((s) => sharp(src).resize(s, s, { fit: "cover" }).png().toBuffer()),
  )
  const ico = await pngToIco(buffers)
  fs.writeFileSync("public/favicon.ico", ico)
  console.log("OK", {
    favicon: fs.statSync("public/favicon.ico").size,
    png: fs.statSync("public/favicon-source.png").size,
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
