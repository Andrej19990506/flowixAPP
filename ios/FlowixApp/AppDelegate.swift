import UIKit
import React

@main
class AppDelegate: UIResponder, UIApplicationDelegate, RCTBridgeDelegate {
  var window: UIWindow?
  var bridge: RCTBridge?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Создаем bridge асинхронно - это правильно зарегистрирует все модули через autolinking
    bridge = RCTBridge(delegate: self, launchOptions: launchOptions)!
    
    // Дожидаемся инициализации bridge
    if bridge == nil {
      return false
    }
    
    let rootView = RCTRootView(
      bridge: bridge!,
      moduleName: "FlowixApp",
      initialProperties: nil
    )
    
    rootView.backgroundColor = UIColor.white
    
    let rootViewController = UIViewController()
    rootViewController.view = rootView

    window = UIWindow(frame: UIScreen.main.bounds)
    window?.rootViewController = rootViewController
    window?.makeKeyAndVisible()
    
    return true
  }
  
  // MARK: - RCTBridgeDelegate
  
  func sourceURL(for bridge: RCTBridge?) -> URL? {
    #if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index") ?? 
           URL(string: "http://localhost:8082/index.bundle?platform=ios")
    #else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
