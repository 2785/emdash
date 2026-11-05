// Renders Emjosh's icons from src/assets/images/emjosh/*.svg:
//   emjosh.icns (app icon) and trayTemplate.png / trayTemplate@2x.png (menu bar).
// Usage: swift scripts/render-emjosh-icons.swift   (from apps/emdash-desktop)
import AppKit

let dir = "src/assets/images/emjosh"

func render(_ svg: String, size: Int, to path: String) {
  guard let image = NSImage(contentsOfFile: "\(dir)/\(svg)") else { fatalError("cannot read \(svg)") }
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  NSColor.clear.set()
  NSRect(x: 0, y: 0, width: size, height: size).fill()
  image.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
  NSGraphicsContext.restoreGraphicsState()
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

let iconset = NSTemporaryDirectory() + "emjosh.iconset"
try? FileManager.default.removeItem(atPath: iconset)
try! FileManager.default.createDirectory(atPath: iconset, withIntermediateDirectories: true)
for base in [16, 32, 128, 256, 512] {
  render("emjosh.svg", size: base, to: "\(iconset)/icon_\(base)x\(base).png")
  render("emjosh.svg", size: base * 2, to: "\(iconset)/icon_\(base)x\(base)@2x.png")
}
let iconutil = Process()
iconutil.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
iconutil.arguments = ["-c", "icns", iconset, "-o", "\(dir)/emjosh.icns"]
try! iconutil.run()
iconutil.waitUntilExit()

render("emjosh-glyph.svg", size: 18, to: "\(dir)/trayTemplate.png")
render("emjosh-glyph.svg", size: 36, to: "\(dir)/trayTemplate@2x.png")
render("emjosh.svg", size: 512, to: "\(dir)/emjosh.png")
print("rendered icons into \(dir)")
