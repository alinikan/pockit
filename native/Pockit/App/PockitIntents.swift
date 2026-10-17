import AppIntents

struct AddPockitExpense: AppIntent {
    static var title: LocalizedStringResource = "Add a Pockit expense"
    static var description = IntentDescription("Open Pockit’s quick entry screen. Review and save the entry yourself.")
    static var openAppWhenRun = true
    @MainActor func perform() async throws -> some IntentResult {
        PockitWidgetStore.defaults?.set("add", forKey: "pendingRoute")
        return .result()
    }
}
struct OpenPockitCalendar: AppIntent {
    static var title: LocalizedStringResource = "Open Pockit Calendar"
    static var openAppWhenRun = true
    @MainActor func perform() async throws -> some IntentResult {
        PockitWidgetStore.defaults?.set("calendar", forKey: "pendingRoute")
        return .result()
    }
}
struct PockitShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: AddPockitExpense(), phrases: ["Add an expense in \(.applicationName)"], shortTitle: "Add expense", systemImageName: "plus.circle")
        AppShortcut(intent: OpenPockitCalendar(), phrases: ["Open my calendar in \(.applicationName)"], shortTitle: "Open calendar", systemImageName: "calendar")
    }
}
