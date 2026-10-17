import XCTest
@testable import PockitModels
final class PockitModelTests: XCTestCase {
    func testValidSummaryDecodes() {
        let json = #"{"version":1,"enabled":true,"month":"2026-10","updatedAt":"2026-10-17T12:00:00.000Z","spent":120.25,"recordedIncome":2000,"hideAmounts":true,"nextBill":null}"#
        XCTAssertEqual(PockitSnapshot.validated(Data(json.utf8))?.spent, 120.25)
    }
    func testRejectsUnapprovedOrUnsupportedSummary() {
        for version in [0, 2] {
            let json = "{\"version\":\(version),\"enabled\":true}"
            XCTAssertNil(PockitSnapshot.validated(Data(json.utf8)))
        }
        XCTAssertNil(PockitSnapshot.validated(Data(#"{"version":1,"enabled":false}"#.utf8)))
        XCTAssertNil(PockitSnapshot.validated(Data(repeating: 0, count: 20_000)))
    }
    func testRejectsMissingPrivacyAndInvalidDate() {
        XCTAssertNil(PockitSnapshot.validated(Data(#"{"version":1,"enabled":true,"month":"2026-10","updatedAt":"bad","spent":1,"recordedIncome":1,"hideAmounts":false}"#.utf8)))
    }
}
