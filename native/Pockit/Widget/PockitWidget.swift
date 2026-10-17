import SwiftUI
import WidgetKit

struct PockitEntry: TimelineEntry { let date: Date; let snapshot: PockitSnapshot? }
struct PockitProvider: TimelineProvider {
    func placeholder(in context: Context) -> PockitEntry { PockitEntry(date: .now, snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (PockitEntry) -> Void) { completion(PockitEntry(date: .now, snapshot: PockitWidgetStore.snapshot)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PockitEntry>) -> Void) {
        completion(Timeline(entries: [PockitEntry(date: .now, snapshot: PockitWidgetStore.snapshot)], policy: .never))
    }
}
struct PockitWidgetView: View {
    let entry: PockitEntry
    @Environment(\.widgetFamily) var family
    func amount(_ value: Double, hidden: Bool) -> String { hidden ? "••••" : value.formatted(.currency(code: "CAD")) }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Image(systemName: "wallet.bifold.fill"); Text("Pockit").fontWeight(.bold); Spacer() }
                .foregroundStyle(Color(red: 0.72, green: 0.68, blue: 1))
            if let value = entry.snapshot {
                HStack(alignment: .top, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Spent · \(value.month)").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        Text(amount(value.spent, hidden: value.hideAmounts)).font(.title2.bold()).lineLimit(1).minimumScaleFactor(0.7).privacySensitive()
                    }
                    if family == .systemMedium, let bill = value.nextBill {
                        Spacer(minLength: 0)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Next bill").font(.caption).foregroundStyle(.secondary)
                            Text(bill.name).font(.callout.bold()).lineLimit(1).privacySensitive()
                            Text(bill.date).font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
                if let updated = ISO8601DateFormatter.fractional.date(from: value.updatedAt) ?? ISO8601DateFormatter().date(from: value.updatedAt) {
                    Text("Updated \(updated.formatted(date: .abbreviated, time: .shortened))").font(.caption2).foregroundStyle(.secondary).lineLimit(2)
                }
            } else {
                Text("Your next entry, one tap away.").font(.headline).lineLimit(2)
                Text("Enable the companion summary in Pockit’s Preferences.").font(.caption).foregroundStyle(.secondary).lineLimit(3)
            }
            if family == .systemMedium {
                HStack {
                    Link(destination: URL(string: "pockit://add")!) { Label("Add expense", systemImage: "plus") }
                    Spacer()
                    Link(destination: URL(string: "pockit://calendar")!) { Label("Calendar", systemImage: "calendar") }
                }.font(.caption.bold())
            }
        }
        .containerBackground(Color(red: 0.063, green: 0.075, blue: 0.137), for: .widget)
        .widgetURL(URL(string: "pockit://add"))
    }
}
@main
struct PockitWidget: Widget {
    let kind = "PockitSummary"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PockitProvider()) { entry in PockitWidgetView(entry: entry) }
            .configurationDisplayName("Pockit at a glance")
            .description("Recorded monthly spending and a shortcut to add an expense. Your summary updates when the app opens.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
