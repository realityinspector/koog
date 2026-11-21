import XCTest
import ProVizKit

final class RigTests: XCTestCase {
    @MainActor
    func testFactoryRig() {
        let failures = RigCheck.failures()
        XCTAssertEqual(failures, [], failures.joined(separator: "\n"))
    }
}
