import Foundation
import React

@objc(QrScannerNativeModule)
class QrScannerNativeModule: RCTEventEmitter {
  
  private static var moduleInstance: QrScannerNativeModule?
  
  override init() {
    super.init()
    QrScannerNativeModule.moduleInstance = self
  }
  
  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  override func supportedEvents() -> [String]! {
    return ["onQrCodeScanned"]
  }
  
  // Отправка события в JS
  static func sendScanEvent(code: String, isDuplicate: Bool, format: String? = nil) {
    moduleInstance?.sendEvent(withName: "onQrCodeScanned", body: [
      "code": code,
      "isDuplicate": isDuplicate,
      "format": format ?? ""
    ])
  }
  
  // Открытие нативного QR-сканера
  @objc
  func openQrScanner(_ existingCodes: NSArray?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      // Получаем root view controller
      var rootViewController: UIViewController?
      
      if #available(iOS 13.0, *) {
        let scenes = UIApplication.shared.connectedScenes
        let windowScene = scenes.first as? UIWindowScene
        rootViewController = windowScene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
      } else {
        rootViewController = UIApplication.shared.keyWindow?.rootViewController
      }
      
      guard let rootVC = rootViewController else {
        reject("NO_VIEW_CONTROLLER", "Root view controller not found", nil)
        return
      }
      
      // Находим самый верхний presented view controller
      var topViewController = rootVC
      while let presented = topViewController.presentedViewController {
        topViewController = presented
      }
      
      // Создаем ViewController для сканера
      let scannerVC = QrScannerViewController()
      
      // Передаем уже сканированные коды
      if let codes = existingCodes as? [String], !codes.isEmpty {
        scannerVC.existingCodes = Set(codes)
      }
      
      // Презентуем модально
      scannerVC.modalPresentationStyle = .fullScreen
      topViewController.present(scannerVC, animated: true) {
        resolve(nil)
      }
    }
  }
  
  // Закрытие QR-сканера
  @objc
  func closeQrScanner(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      var rootViewController: UIViewController?
      
      if #available(iOS 13.0, *) {
        let scenes = UIApplication.shared.connectedScenes
        let windowScene = scenes.first as? UIWindowScene
        rootViewController = windowScene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
      } else {
        rootViewController = UIApplication.shared.keyWindow?.rootViewController
      }
      
      // Находим самый верхний presented view controller
      var topViewController = rootViewController
      while let presented = topViewController?.presentedViewController {
        topViewController = presented
      }
      
      if let scannerVC = topViewController as? QrScannerViewController {
        scannerVC.dismiss(animated: true) {
          resolve(true)
        }
      } else {
        resolve(false)
      }
    }
  }
}

