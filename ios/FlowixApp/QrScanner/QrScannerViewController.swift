import UIKit
import AVFoundation
import Vision

class QrScannerViewController: UIViewController {
  
  // MARK: - Properties
  var existingCodes: Set<String> = []
  var scannedCodes: Set<String> = []
  
  private var captureSession: AVCaptureSession?
  private var previewLayer: AVCaptureVideoPreviewLayer?
  private var videoOutput: AVCaptureVideoDataOutput?
  
  private var torchEnabled = false
  private var isScanningPaused = false
  
  // UI Elements
  private var closeButton: UIButton!
  private var torchButton: UIButton!
  private var overlayView: UIView!
  private var scanningAreaView: UIView!
  
  // MARK: - Lifecycle
  override func viewDidLoad() {
    super.viewDidLoad()
    setupUI()
    requestCameraPermission()
  }
  
  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    
    // Обновляем mask для overlay когда bounds определены
    let maskLayer = CAShapeLayer()
    let path = UIBezierPath(rect: view.bounds)
    let centerRect = CGRect(
      x: view.bounds.width * 0.1,
      y: (view.bounds.height - view.bounds.width * 0.8) / 2,
      width: view.bounds.width * 0.8,
      height: view.bounds.width * 0.8
    )
    path.append(UIBezierPath(roundedRect: centerRect, cornerRadius: 20).reversing())
    maskLayer.path = path.cgPath
    overlayView.layer.mask = maskLayer
    
    // Обновляем frame preview layer
    previewLayer?.frame = view.bounds
  }
  
  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    stopCamera()
  }
  
  // MARK: - Setup
  private func setupUI() {
    view.backgroundColor = .black
    
    // Overlay
    overlayView = UIView()
    overlayView.backgroundColor = UIColor.black.withAlphaComponent(0.5)
    view.addSubview(overlayView)
    overlayView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      overlayView.topAnchor.constraint(equalTo: view.topAnchor),
      overlayView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      overlayView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      overlayView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])
    
    // Scanning area (прозрачная область в центре)
    scanningAreaView = UIView()
    scanningAreaView.backgroundColor = .clear
    scanningAreaView.layer.borderColor = UIColor.white.cgColor
    scanningAreaView.layer.borderWidth = 2
    scanningAreaView.layer.cornerRadius = 20
    view.addSubview(scanningAreaView)
    scanningAreaView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      scanningAreaView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      scanningAreaView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      scanningAreaView.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.8),
      scanningAreaView.heightAnchor.constraint(equalTo: scanningAreaView.widthAnchor)
    ])
    
    // Mask будет создан в viewDidLayoutSubviews когда bounds будут определены
    
    // Close button
    closeButton = UIButton(type: .system)
    closeButton.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
    closeButton.tintColor = .white
    closeButton.backgroundColor = UIColor.black.withAlphaComponent(0.5)
    closeButton.layer.cornerRadius = 20
    closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
    view.addSubview(closeButton)
    closeButton.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
      closeButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      closeButton.widthAnchor.constraint(equalToConstant: 40),
      closeButton.heightAnchor.constraint(equalToConstant: 40)
    ])
    
    // Torch button
    torchButton = UIButton(type: .system)
    torchButton.setImage(UIImage(systemName: "bolt.slash.fill"), for: .normal)
    torchButton.tintColor = .white
    torchButton.backgroundColor = UIColor.black.withAlphaComponent(0.5)
    torchButton.layer.cornerRadius = 20
    torchButton.addTarget(self, action: #selector(torchTapped), for: .touchUpInside)
    view.addSubview(torchButton)
    torchButton.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      torchButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
      torchButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      torchButton.widthAnchor.constraint(equalToConstant: 60),
      torchButton.heightAnchor.constraint(equalToConstant: 60)
    ])
  }
  
  private func requestCameraPermission() {
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized:
      setupCamera()
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
        if granted {
          DispatchQueue.main.async {
            self?.setupCamera()
          }
        } else {
          DispatchQueue.main.async {
            self?.showPermissionAlert()
          }
        }
      }
    default:
      showPermissionAlert()
    }
  }
  
  private func showPermissionAlert() {
    let alert = UIAlertController(
      title: "Доступ к камере",
      message: "Для сканирования QR-кодов необходим доступ к камере",
      preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "Настройки", style: .default) { _ in
      if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
        UIApplication.shared.open(settingsURL)
      }
    })
    alert.addAction(UIAlertAction(title: "Отмена", style: .cancel) { [weak self] _ in
      self?.dismiss(animated: true)
    })
    present(alert, animated: true)
  }
  
  private func setupCamera() {
    let session = AVCaptureSession()
    session.sessionPreset = .high
    
    guard let videoDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
          let videoInput = try? AVCaptureDeviceInput(device: videoDevice) else {
      return
    }
    
    if session.canAddInput(videoInput) {
      session.addInput(videoInput)
    }
    
    // Video output for processing frames
    let output = AVCaptureVideoDataOutput()
    output.setSampleBufferDelegate(self, queue: DispatchQueue(label: "qr.scanner.queue"))
    output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
    
    if session.canAddOutput(output) {
      session.addOutput(output)
    }
    
    // Preview layer
    let previewLayer = AVCaptureVideoPreviewLayer(session: session)
    previewLayer.frame = view.bounds
    previewLayer.videoGravity = .resizeAspectFill
    view.layer.insertSublayer(previewLayer, at: 0)
    
    self.captureSession = session
    self.previewLayer = previewLayer
    self.videoOutput = output
    
    // Check torch availability
    DispatchQueue.main.async { [weak self] in
      self?.updateTorchButton()
    }
    
    startCamera()
  }
  
  private func startCamera() {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      self?.captureSession?.startRunning()
    }
  }
  
  private func stopCamera() {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      self?.captureSession?.stopRunning()
    }
  }
  
  private func updateTorchButton() {
    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
          device.hasTorch else {
      torchButton.isHidden = true
      return
    }
    torchButton.isHidden = false
    torchButton.setImage(
      UIImage(systemName: torchEnabled ? "bolt.fill" : "bolt.slash.fill"),
      for: .normal
    )
  }
  
  // MARK: - Actions
  @objc private func closeTapped() {
    dismiss(animated: true)
  }
  
  @objc private func torchTapped() {
    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
          device.hasTorch else {
      return
    }
    
    do {
      try device.lockForConfiguration()
      torchEnabled.toggle()
      try device.setTorchModeOn(level: torchEnabled ? 1.0 : 0.0)
      device.unlockForConfiguration()
      updateTorchButton()
    } catch {
      print("Error toggling torch: \(error)")
    }
  }
  
  // MARK: - QR Code Detection
  private func detectQRCode(in image: CIImage) {
    let request = VNDetectBarcodesRequest { [weak self] request, error in
      guard let self = self,
            let results = request.results as? [VNBarcodeObservation],
            !self.isScanningPaused else {
        return
      }
      
      for observation in results {
        guard let payload = observation.payloadStringValue else { continue }
        
        let isDuplicate = self.existingCodes.contains(payload) || self.scannedCodes.contains(payload)
        
        if !isDuplicate {
          self.scannedCodes.insert(payload)
          
          // Вибрация
          let generator = UIImpactFeedbackGenerator(style: .medium)
          generator.impactOccurred()
          
          // Отправляем событие в React Native
          QrScannerNativeModule.sendScanEvent(
            code: payload,
            isDuplicate: false,
            format: observation.symbology.rawValue
          )
          
          // Пауза сканирования на 2 секунды после успешного сканирования
          self.isScanningPaused = true
          DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.isScanningPaused = false
          }
        } else {
          // Дубликат
          QrScannerNativeModule.sendScanEvent(
            code: payload,
            isDuplicate: true,
            format: observation.symbology.rawValue
          )
        }
      }
    }
    
    request.symbologies = [.QR, .dataMatrix]
    
    let handler = VNImageRequestHandler(ciImage: image, options: [:])
    try? handler.perform([request])
  }
}

// MARK: - AVCaptureVideoDataOutputSampleBufferDelegate
extension QrScannerViewController: AVCaptureVideoDataOutputSampleBufferDelegate {
  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    
    let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
    detectQRCode(in: ciImage)
  }
}

