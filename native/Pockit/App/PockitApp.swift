import SwiftUI

@main
struct PockitApp: App {
    @Environment(\.scenePhase) private var phase
    @AppStorage("pockitTheme") private var theme = "dark"
    @State private var route = "home"
    @State private var routeVersion = 0
    var body: some Scene {
        WindowGroup {
            WebContainer(route: route, routeVersion: routeVersion)
                .ignoresSafeArea(.container, edges: .bottom)
                .background(theme == "light" ? Color.white : Color(red: 0.063, green: 0.075, blue: 0.137))
                .preferredColorScheme(theme == "light" ? .light : .dark)
                .onOpenURL { url in
                    guard url.scheme == "pockit", let target = url.host,
                          ["home", "add", "calendar", "goals"].contains(target) else { return }
                    route = target
                    routeVersion += 1
                }
                .task { consumePendingRoute() }
                .onChange(of: phase) { _, value in if value == .active { consumePendingRoute() } }
                .onReceive(NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)) { _ in consumePendingRoute() }
        }
    }
    @MainActor private func consumePendingRoute() {
        guard let pending = PockitWidgetStore.defaults?.string(forKey: "pendingRoute") else { return }
        PockitWidgetStore.defaults?.removeObject(forKey: "pendingRoute")
        guard ["home", "add", "calendar", "goals"].contains(pending) else { return }
        route = pending
        routeVersion += 1
    }
}
