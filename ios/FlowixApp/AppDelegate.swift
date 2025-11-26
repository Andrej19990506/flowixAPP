import UIKit
import React

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  var bridge: RCTBridge!

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let jsCodeLocation: URL

    // Используем production bundle (не нужен Metro bundler)
    if let bundleURL = Bundle.main.url(forResource: "main", withExtension: "jsbundle") {
      jsCodeLocation = bundleURL
    } else {
      // Fallback: пытаемся подключиться к Metro только если bundle нет
      // Но лучше собрать bundle заранее
      jsCodeLocation = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index") ?? 
                      URL(string: "http://localhost:8082/index.bundle?platform=ios")!
    }

    let rootView = RCTRootView(bundleURL: jsCodeLocation, moduleName: "FlowixApp", initialProperties: nil, launchOptions: launchOptions)
    
    let rootViewController = UIViewController()
    rootViewController.view = rootView

    window = UIWindow(frame: UIScreen.main.bounds)
    window?.rootViewController = rootViewController
    window?.makeKeyAndVisible()
    
    return true
  }
}
