// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ProViz",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "ProVizKit", targets: ["ProVizKit"])
    ],
    targets: [
        .target(name: "ProVizKit"),
        .executableTarget(name: "ProViz", dependencies: ["ProVizKit"]),
        .testTarget(name: "ProVizTests", dependencies: ["ProVizKit"])
    ]
)
