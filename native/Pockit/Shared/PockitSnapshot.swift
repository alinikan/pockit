import Foundation

struct PockitSnapshot: Codable, Equatable {
    struct Bill: Codable, Equatable { let name: String; let date: String; let amount: Double }
    let version: Int
    let enabled: Bool
    let month: String
    let updatedAt: String
    let spent: Double
    let hideAmounts: Bool
    let nextBill: Bill?

    static func validated(_ data: Data) -> PockitSnapshot? {
        guard data.count <= 16_384, let value = try? JSONDecoder().decode(Self.self, from: data),
              value.version == 1, value.enabled, value.month.count == 7,
              value.spent.isFinite,
              abs(value.spent) < 1_000_000_000,
              ISO8601DateFormatter().date(from: value.updatedAt) != nil || ISO8601DateFormatter.fractional.date(from: value.updatedAt) != nil,
              value.nextBill.map({ $0.name.count <= 100 && $0.amount.isFinite && $0.amount >= 0 }) ?? true else { return nil }
        return value
    }
}
extension ISO8601DateFormatter {
    static var fractional: ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }
}
enum PockitWidgetStore {
    static var group: String { Bundle.main.object(forInfoDictionaryKey: "PockitAppGroup") as? String ?? "group.com.alinikan.pockit" }
    static var defaults: UserDefaults? { UserDefaults(suiteName: group) }
    static var snapshot: PockitSnapshot? {
        guard let data = defaults?.data(forKey: "widgetSnapshot") else { return nil }
        return PockitSnapshot.validated(data)
    }
    static func clear() { defaults?.removeObject(forKey: "widgetSnapshot") }
}
