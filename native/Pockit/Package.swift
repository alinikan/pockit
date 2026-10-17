// swift-tools-version: 5.10
import PackageDescription
let package = Package(name: "PockitModels", platforms: [.macOS(.v14)], products: [.library(name: "PockitModels", targets: ["PockitModels"])], targets: [.target(name: "PockitModels", path: "Shared"), .testTarget(name: "PockitModelTests", dependencies: ["PockitModels"], path: "ModelTests")])
