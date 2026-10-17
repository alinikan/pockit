import SwiftUI
import WebKit
import WidgetKit

struct WebContainer: UIViewRepresentable {
    let route: String
    let routeVersion: Int
    static let allowedHost = "pockit-budget.vercel.app"
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(context.coordinator, name: "pockitWidget")
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.scrollView.pinchGestureRecognizer?.isEnabled = false
        view.isOpaque = false
        view.backgroundColor = UIColor(red: 0.063, green: 0.075, blue: 0.137, alpha: 1)
        return view
    }
    func updateUIView(_ view: WKWebView, context: Context) {
        guard context.coordinator.version != routeVersion else { return }
        context.coordinator.version = routeVersion
        var url = URLComponents(string: "https://\(Self.allowedHost)/")!
        if route == "add" { url.queryItems = [.init(name: "open", value: "activity"), .init(name: "add", value: "expense")] }
        else if route != "home" { url.queryItems = [.init(name: "open", value: route)] }
        view.load(URLRequest(url: url.url!))
    }
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "pockitWidget")
    }
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var version = -1
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "pockitWidget", message.frameInfo.isMainFrame,
                  message.frameInfo.securityOrigin.protocol == "https",
                  message.frameInfo.securityOrigin.host == WebContainer.allowedHost,
                  let body = message.body as? [String: Any],
                  body["version"] as? Int == 1 else { return }
            if let theme = body["theme"] as? String, ["dark", "light"].contains(theme) { UserDefaults.standard.set(theme, forKey: "pockitTheme") }
            if body["enabled"] as? Bool == false { PockitWidgetStore.clear(); WidgetCenter.shared.reloadAllTimelines(); return }
            guard let data = try? JSONSerialization.data(withJSONObject: body), PockitSnapshot.validated(data) != nil else { return }
            PockitWidgetStore.defaults?.set(data, forKey: "widgetSnapshot")
            WidgetCenter.shared.reloadAllTimelines()
        }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if url.scheme == "https" && url.host == WebContainer.allowedHost { decisionHandler(.allow); return }
            // Only deliberate external links open outside Pockit; subframes cannot send widget data.
            if action.navigationType == .linkActivated && ["https", "mailto"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }
    }
}
