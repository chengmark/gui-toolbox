/**
 * Favicon A cleanup:
 * keep only window stroke / wrench / blue bar; transparent everything else;
 * enlarge onto a transparent square.
 *
 * Usage: bun scripts/process-favicon-a.mjs [source]
 */
import fs from "node:fs"
import crypto from "node:crypto"
import sharp from "sharp"
import pngToIco from "png-to-ico"

const src =
  process.argv[2] ??
  "C:/Users/cheng/.cursor/projects/c-repo-gui-toolbox/assets/gui-toolbox-favicon-a.png"

const FILL = 0.97

function isAccentBlue(r, g, b) {
  return b >= 120 && b - r >= 30 && b > g + 10
}

function isLightStroke(r, g, b) {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const span = Math.max(r, g, b) - Math.min(r, g, b)
  // mid/light neutral gray (window outline + wrench), exclude white matte
  return span <= 28 && luma >= 105 && luma <= 235
}

function keepPixel(r, g, b) {
  return isAccentBlue(r, g, b) || isLightStroke(r, g, b)
}

async function extractMark(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (!keepPixel(r, g, b)) {
      data[i + 3] = 0
    }
  }

  return sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer()
}

async function main() {
  const punched = await extractMark(src)
  const trimmed = await sharp(punched).trim({ threshold: 0 }).png().toBuffer()
  const trimMeta = await sharp(trimmed).metadata()

  const size = 512
  const target = Math.round(size * FILL)
  const fitted = await sharp(trimmed)
    .resize(target, target, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const finalPng = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: fitted, gravity: "centre" }])
    .png()
    .toBuffer()

  fs.mkdirSync("public", { recursive: true })
  fs.writeFileSync("public/favicon-source.png", finalPng)

  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const buffers = await Promise.all(
    sizes.map((s) =>
      sharp(finalPng)
        .resize(s, s, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer(),
    ),
  )

  const pngToIcoFn = pngToIco.default ?? pngToIco
  const ico = Buffer.from(await pngToIcoFn(buffers))
  fs.writeFileSync("public/favicon.ico", ico)

  console.log("OK", {
    trimmed: `${trimMeta.width}x${trimMeta.height}`,
    canvas: `${size}x${size}`,
    fill: FILL,
    pngBytes: finalPng.length,
    pngSha: crypto.createHash("sha1").update(finalPng).digest("hex").slice(0, 10),
    icoBytes: ico.length,
    icoSha: crypto.createHash("sha1").update(ico).digest("hex").slice(0, 10),
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
