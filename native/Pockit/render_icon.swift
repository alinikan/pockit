// Render the existing public/icon.svg mark as an opaque, full-resolution iOS app icon.
// Run from the repository root: swift native/Pockit/render_icon.swift
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let output = URL(fileURLWithPath: "native/Pockit/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
guard let context = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 4096, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { fatalError("Cannot make the app icon context") }
context.setFillColor(CGColor(red: 16.0/255, green: 19.0/255, blue: 35.0/255, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
context.translateBy(x: 0, y: 1024)
context.scaleBy(x: 8, y: -8)
let mark = CGMutablePath()
mark.move(to: CGPoint(x:31,y:42))
mark.addCurve(to: CGPoint(x:45,y:28), control1: CGPoint(x:31,y:34), control2: CGPoint(x:37,y:28))
mark.addLine(to: CGPoint(x:77,y:28))
mark.addCurve(to: CGPoint(x:105,y:55), control1: CGPoint(x:94,y:28), control2: CGPoint(x:105,y:39))
mark.addCurve(to: CGPoint(x:77,y:83), control1: CGPoint(x:105,y:71), control2: CGPoint(x:94,y:83))
mark.addLine(to: CGPoint(x:51,y:83));mark.addLine(to: CGPoint(x:51,y:99));mark.addLine(to: CGPoint(x:31,y:99));mark.closeSubpath()
mark.move(to: CGPoint(x:51,y:46));mark.addLine(to: CGPoint(x:51,y:65));mark.addLine(to: CGPoint(x:75,y:65))
mark.addCurve(to: CGPoint(x:86,y:55), control1: CGPoint(x:82,y:65), control2: CGPoint(x:86,y:61))
mark.addCurve(to: CGPoint(x:75,y:46), control1: CGPoint(x:86,y:49), control2: CGPoint(x:82,y:46))
mark.addLine(to: CGPoint(x:51,y:46));mark.closeSubpath()
context.addPath(mark)
context.setFillColor(CGColor(red:185.0/255,green:180.0/255,blue:1,alpha:1))
context.drawPath(using: .eoFill)
guard let image = context.makeImage(), let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else { fatalError("Cannot write app icon") }
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("Could not finish app icon") }
print("Rendered opaque 1024×1024 Pockit app icon")
