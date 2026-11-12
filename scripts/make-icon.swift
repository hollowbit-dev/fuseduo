// Draws Fuseduo's app icon (1024x1024 PNG): a violet-to-aqua tile, two white drops melting
// into one (a metaball, drawn per pixel so the join is a true liquid curve), and the family sparkle.
// Run: swift scripts/make-icon.swift assets/icon.png
import AppKit
let size = 1024
let S = CGFloat(size)
let img = NSImage(size: NSSize(width: S, height: S))
img.lockFocus()
let ctx = NSGraphicsContext.current!.cgContext
let inset: CGFloat = 100
let rect = CGRect(x: inset, y: inset, width: S - inset * 2, height: S - inset * 2)
let tile = CGPath(roundedRect: rect, cornerWidth: 190, cornerHeight: 190, transform: nil)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -14), blur: 40, color: NSColor(white: 0, alpha: 0.35).cgColor)
ctx.addPath(tile); ctx.setFillColor(NSColor.black.cgColor); ctx.fillPath()
ctx.restoreGState()
ctx.saveGState()
ctx.addPath(tile); ctx.clip()
let cs = CGColorSpaceCreateDeviceRGB()
let g = CGGradient(colorsSpace: cs, colors: [
  NSColor(red: 0.66, green: 0.52, blue: 1.0, alpha: 1).cgColor,
  NSColor(red: 0.42, green: 0.36, blue: 0.98, alpha: 1).cgColor,
  NSColor(red: 0.10, green: 0.74, blue: 0.80, alpha: 1).cgColor] as CFArray, locations: [0, 0.5, 1])!
ctx.drawLinearGradient(g, start: CGPoint(x: inset, y: S - inset), end: CGPoint(x: S - inset, y: inset), options: [])
let glow = CGGradient(colorsSpace: cs, colors: [NSColor(white: 1, alpha: 0.30).cgColor, NSColor(white: 1, alpha: 0).cgColor] as CFArray, locations: [0, 1])!
ctx.drawRadialGradient(glow, startCenter: CGPoint(x: S * 0.38, y: S * 0.66), startRadius: 0, endCenter: CGPoint(x: S * 0.38, y: S * 0.66), endRadius: 440, options: [])
ctx.restoreGState()

// The melting drops: field = r1²/d1² + r2²/d2²; the surface is where it reaches 1.
let w = size, h = size
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4,
                           hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: w * 4, bitsPerPixel: 32)!
let px = rep.bitmapData!
let c1 = (x: 352.0, y: 566.0, r: 146.0), c2 = (x: 662.0, y: 428.0, r: 116.0)
for y in 0..<h {
  for x in 0..<w {
    let fy = Double(h - y), fx = Double(x)
    let d1 = (fx - c1.x) * (fx - c1.x) + (fy - c1.y) * (fy - c1.y)
    let d2 = (fx - c2.x) * (fx - c2.x) + (fy - c2.y) * (fy - c2.y)
    let f = c1.r * c1.r / max(d1, 1) + c2.r * c2.r / max(d2, 1)
    // soft edge about 1.5 px wide
    let a = min(1, max(0, (f - 0.985) / 0.03))
    let i = (y * w + x) * 4
    let shade = 1.0 - 0.07 * min(1, max(0, (c1.y + 160 - fy) / 420)) // a touch darker at the bottom
    px[i] = UInt8(255 * shade * a); px[i + 1] = UInt8(255 * shade * a); px[i + 2] = UInt8(255 * a); px[i + 3] = UInt8(255 * a)
  }
}
let drops = NSImage(size: NSSize(width: S, height: S)); drops.addRepresentation(rep)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -12), blur: 34, color: NSColor(red: 0.12, green: 0.06, blue: 0.4, alpha: 0.45).cgColor)
drops.draw(in: NSRect(x: 0, y: 0, width: S, height: S))
ctx.restoreGState()
// Sparkles: the family mark.
ctx.setFillColor(NSColor.white.cgColor)
func star(_ c: CGPoint, _ r: CGFloat) {
  let s = CGMutablePath()
  s.move(to: CGPoint(x: c.x, y: c.y + r))
  s.addQuadCurve(to: CGPoint(x: c.x + r, y: c.y), control: CGPoint(x: c.x + r * 0.16, y: c.y + r * 0.16))
  s.addQuadCurve(to: CGPoint(x: c.x, y: c.y - r), control: CGPoint(x: c.x + r * 0.16, y: c.y - r * 0.16))
  s.addQuadCurve(to: CGPoint(x: c.x - r, y: c.y), control: CGPoint(x: c.x - r * 0.16, y: c.y - r * 0.16))
  s.addQuadCurve(to: CGPoint(x: c.x, y: c.y + r), control: CGPoint(x: c.x - r * 0.16, y: c.y + r * 0.16))
  ctx.addPath(s); ctx.fillPath()
}
star(CGPoint(x: 700, y: 712), 80)
star(CGPoint(x: 790, y: 636), 36)
img.unlockFocus()
let out = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! out.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
