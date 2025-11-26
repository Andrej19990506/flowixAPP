package com.flowix.app.qrscanner

import android.Manifest
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.animation.AnimatorSet
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.*
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.SystemClock
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.view.WindowManager
import android.graphics.Outline
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.flowix.app.R
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.min
import kotlin.math.abs

/**
 * Полноценный нативный экран QR-сканера.
 * Использует CameraX + ML Kit для максимально быстрой и стабильной работы.
 *
 * Возвращает результат сканирования через setResult(RESULT_OK, Intent().putExtra(EXTRA_QR_CODE, value)).
 */
class QrScannerNativeActivity : AppCompatActivity() {

  private lateinit var previewView: PreviewView
  private lateinit var cameraExecutor: ExecutorService
  private var camera: androidx.camera.core.Camera? = null
  private var cameraProvider: ProcessCameraProvider? = null
  private var torchEnabled = false
  private var lastCode: String? = null
  private val scannedCodes = mutableListOf<String>()
  private val existingCodes = mutableListOf<String>() // Коды, которые уже были сканированы раньше
  private var currentZoomLinear: Float = 0.0f
  private var targetZoomLinear: Float = 0.0f
  private lateinit var successBanner: View
  private lateinit var successTextView: TextView
  private var lastFeedbackCode: String? = null
  private var lastFeedbackTime: Long = 0L
  private lateinit var overlayView: QrScannerOverlayView
  private val vibrator by lazy {
    getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
  }
  
  private lateinit var mainContainer: FrameLayout
  private lateinit var controlsContainer: View
  private var isScanningPaused = false // Флаг для паузы сканирования после успешного результата
  private lateinit var rootContainer: FrameLayout

  // Пределы цифрового зума (0f..1f для linearZoom)
  private val minZoomLinear = 0.20f   // минимальное приближение
  private val maxZoomLinear = 0.85f   // максимальный зум для плохо читаемых кодов
  private val baseZoomLinear = 0.55f  // базовый зум БЛИЖЕ для лучшего распознавания мелких кодов (Data Matrix, QR на сигаретах)

  // Для плавной анимации зума
  private val zoomHandler = Handler(Looper.getMainLooper())
  private var zoomAnimator: Runnable? = null

  // Для возврата зума, когда код исчез
  private var lastBarcodeDetectedAt: Long = 0L

  private val scanner by lazy {
    // Поддерживаем ВСЕ распространенные форматы штрихкодов + QR/DataMatrix
    BarcodeScanning.getClient(
      com.google.mlkit.vision.barcode.BarcodeScannerOptions.Builder()
        .setBarcodeFormats(
          // QR и DataMatrix коды
          Barcode.FORMAT_QR_CODE,
          Barcode.FORMAT_DATA_MATRIX,
          // Европейские штрихкоды
          Barcode.FORMAT_EAN_13,  // Стандартный на большинстве товаров
          Barcode.FORMAT_EAN_8,   // Короткий вариант
          // Американские штрихкоды (тоже встречаются)
          Barcode.FORMAT_UPC_A,
          Barcode.FORMAT_UPC_E,
          // Промышленные и логистические
          Barcode.FORMAT_CODE_128, // Маркировка товаров, DataMatrix
          Barcode.FORMAT_CODE_39,  // Старый стандарт, но все еще используется
          Barcode.FORMAT_CODE_93,
          Barcode.FORMAT_ITF,      // Interleaved 2 of 5 (логистика)
          Barcode.FORMAT_CODABAR   // Библиотеки, банки крови, курьерская доставка
        )
        .build()
    )
  }

  private val requestPermissionLauncher =
    registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted: Boolean ->
      if (isGranted) {
        startCamera()
      } else {
        finishWithResult(null)
      }
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    // Сохраняем ссылку на текущий экземпляр
    Companion.currentInstance = this

    // Получаем список уже сканированных кодов из Intent
    intent.getStringArrayListExtra(EXTRA_EXISTING_CODES)?.let { codes ->
      existingCodes.addAll(codes)
      Log.d(TAG, "Получен список из ${codes.size} уже сканированных кодов")
    }

    // Делаем экран полноэкранным и не гасим его во время сканирования
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    previewView = PreviewView(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      scaleType = PreviewView.ScaleType.FILL_CENTER
    }

    overlayView = QrScannerOverlayView(this)
    
    mainContainer = FrameLayout(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      addView(previewView)
      addView(overlayView)
    }
    
    controlsContainer = buildControlsOverlay()
    
    rootContainer = FrameLayout(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      // Изначально прозрачный фон
      setBackgroundColor(0x00000000)
      addView(mainContainer)
      addView(controlsContainer)
    }

    setContentView(rootContainer)
    
    // В развернутом состоянии делаем черный фон
    rootContainer.setBackgroundColor(0xFF000000.toInt())

    cameraExecutor = Executors.newSingleThreadExecutor()

    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
      == PackageManager.PERMISSION_GRANTED
    ) {
      startCamera()
    } else {
      requestPermissionLauncher.launch(Manifest.permission.CAMERA)
    }
  }

  private fun buildControlsOverlay(): View {
    val density = resources.displayMetrics.density
    val sidePadding = (24 * density).toInt() // Как в ProfilePanel
    val buttonSize = (48 * density).toInt() // Стандартный размер как в ProfilePanel

    val container = FrameLayout(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      isClickable = false
    }

    val topBar = FrameLayout(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.TOP
      )
      // Поднимаем кнопки выше
      setPadding(sidePadding, (60 * density).toInt(), sidePadding, (20 * density).toInt())
    }

    // Минималистичная кнопка "Назад" со стрелкой - без фона, только иконка
    val backButton = ImageButton(this).apply {
      layoutParams = FrameLayout.LayoutParams(buttonSize, buttonSize, Gravity.START or Gravity.TOP)
      setImageResource(R.drawable.ic_arrow_back) // Кастомная стрелка назад
      
      // Убираем фон - только иконка
      background = null
      
      setColorFilter(0xFFFFFFFF.toInt(), PorterDuff.Mode.SRC_IN)
      scaleType = ImageView.ScaleType.CENTER_INSIDE
      contentDescription = "Назад"
      
      setOnClickListener {
        alpha = 0.6f
        animate().alpha(1f).setDuration(150).start()
        finishWithResult(lastCode)
      }
    }

    // Минималистичная кнопка фонарика с иконкой молнии - без фона, только иконка
    val torchButtonTop = ImageButton(this).apply {
      layoutParams = FrameLayout.LayoutParams(buttonSize, buttonSize, Gravity.END or Gravity.TOP)
      
      // Убираем фон - только иконка
      background = null
      
      scaleType = ImageView.ScaleType.CENTER_INSIDE
      contentDescription = "Фонарик"
      
      // Устанавливаем иконку в зависимости от состояния
      fun updateIcon() {
        if (torchEnabled) {
          // Активная молния - БЕЗ зачеркивания
          setImageResource(R.drawable.ic_flash_on)
          setColorFilter(0xFFFF6B35.toInt(), PorterDuff.Mode.SRC_IN) // Оранжевый когда включен
        } else {
          // Неактивная молния - ЗАЧЕРКНУТАЯ
          setImageResource(R.drawable.ic_flash_off)
          setColorFilter(0xFFFFFFFF.toInt(), PorterDuff.Mode.SRC_IN) // Белый когда выключен
        }
      }
      
      updateIcon()
      
      setOnClickListener { button ->
        toggleTorch(button as ImageButton)
        updateIcon()
        alpha = 0.6f
        animate().alpha(1f).setDuration(150).start()
      }
    }

    // Кнопка "Свернуть" УДАЛЕНА - теперь управляется из React Native футера

    topBar.addView(backButton)
    topBar.addView(torchButtonTop)

    // Кнопка галереи УДАЛЕНА - как ты просил!

    // Простой баннер успеха - минималистичный стиль
    successBanner = FrameLayout(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.TOP or Gravity.CENTER_HORIZONTAL
      ).apply {
        topMargin = (60 * density).toInt()
      }
      
      // Простой фон
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = 8f * density
        setColor(0xEE4CAF50.toInt()) // Зеленый для успеха
      }
      elevation = 6f * density
      visibility = View.GONE
      alpha = 0f
      translationY = -60f
    }

    successTextView = TextView(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
      )
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
      setTextColor(0xFFFFFFFF.toInt())
      typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL)
      gravity = Gravity.CENTER
      setPadding(
        (20 * density).toInt(),
        (12 * density).toInt(),
        (20 * density).toInt(),
        (12 * density).toInt()
      )
    }

    (successBanner as FrameLayout).addView(successTextView)

    container.addView(topBar)
    container.addView(successBanner)
   

    return container
  }


  private fun toggleTorch(button: ImageButton) {
    val cam = camera ?: return
    if (!cam.cameraInfo.hasFlashUnit()) return

    torchEnabled = !torchEnabled
    cam.cameraControl.enableTorch(torchEnabled)
  }

  private fun setZoomLinear(target: Float) {
    val value = target.coerceIn(minZoomLinear, maxZoomLinear)
    currentZoomLinear = value
    try {
      camera?.cameraControl?.setLinearZoom(value)
    } catch (e: Exception) {
      Log.w(TAG, "Failed to set zoom: ${e.message}")
    }
  }

  private fun animateZoomTo(target: Float) {
    val clamped = target.coerceIn(minZoomLinear, maxZoomLinear)
    targetZoomLinear = clamped

    // отменяем предыдущую анимацию
    zoomAnimator?.let { zoomHandler.removeCallbacks(it) }

    zoomAnimator = object : Runnable {
      override fun run() {
        val cam = camera ?: return
        val diff = clamped - currentZoomLinear
        if (kotlin.math.abs(diff) < 0.01f) {
          currentZoomLinear = clamped
          cam.cameraControl.setLinearZoom(clamped)
          return
        }

        // Двигаемся к цели маленькими шагами для плавности
        val step = diff * 0.2f // 20% пути за кадр
        currentZoomLinear += step
        cam.cameraControl.setLinearZoom(currentZoomLinear.coerceIn(minZoomLinear, maxZoomLinear))

        zoomHandler.postDelayed(this, 16L) // ~60 FPS
      }
    }

    zoomHandler.post(zoomAnimator!!)
  }

  private fun playFeedback() {
    // Вибрация
    try {
      if (vibrator.hasVibrator()) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
          vibrator.vibrate(VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
          @Suppress("DEPRECATION")
          vibrator.vibrate(40)
        }
      }
    } catch (e: Exception) {
      Log.w(TAG, "Vibration failed: ${e.message}")
    }

    // Звук: простой системный «бип», чтобы не зависеть от наличия кастомного mp3
    try {
      val tone = android.media.ToneGenerator(android.media.AudioManager.STREAM_MUSIC, 80)
      tone.startTone(android.media.ToneGenerator.TONE_PROP_BEEP, 150)
    } catch (e: Exception) {
      Log.w(TAG, "Sound playback failed: ${e.message}")
    }
  }
  private var lastScannedFormat: Int? = null
  
  private fun showSuccessBanner(code: String, format: Int? = null) {
    // Сохраняем формат для использования в sendScanResult
    if (format != null) {
      lastScannedFormat = format
    }
    // Игнорируем повторные сканирования того же кода
    if (lastFeedbackCode == code && SystemClock.elapsedRealtime() - lastFeedbackTime < 2000) {
      return
    }
    
    // Ставим сканирование на паузу
    isScanningPaused = true
    lastCode = code
    
    // ПРОВЕРКА НА ДУБЛИКАТ
    if (existingCodes.contains(code)) {
      Log.i(TAG, "ДУБЛИКАТ! Код '$code' уже был сканирован ранее")
      
      // Показываем баннер с предупреждением о дубликате
      val displayCode = if (code.length > 30) {
        code.substring(0, 27) + "..."
      } else {
        code
      }
      
      // Меняем цвет баннера на оранжевый для дубликата
      (successBanner.background as? GradientDrawable)?.setColor(0xEEFF9800.toInt()) // Оранжевый
      successTextView.text = "⚠️ Код уже был сканирован: $displayCode"
      
      // Отправляем результат дубликата
      sendScanResult(code, isDuplicate = true)
      playFeedback() // Вибрация и звук для дубликата
      
      // Показываем баннер
      successBanner.visibility = View.VISIBLE
      successBanner.animate()
        .translationY(0f)
        .alpha(1f)
        .setDuration(250)
        .withEndAction {
          // Прячем баннер через 2 секунды, камера остается открытой
          Handler(Looper.getMainLooper()).postDelayed({
            successBanner.animate()
              .translationY(-60f)
              .alpha(0f)
              .setDuration(200)
              .withEndAction {
                successBanner.visibility = View.GONE
                // Возвращаем зеленый цвет для следующего успешного сканирования
                (successBanner.background as? GradientDrawable)?.setColor(0xEE4CAF50.toInt())
              }
              .start()
            isScanningPaused = false // Возобновляем сканирование
          }, 2000)
        }
        .start()
      return
    }
    
    if (!scannedCodes.contains(code)) {
      scannedCodes.add(code)
    }
    
    // ВАЖНО: Добавляем код в existingCodes, чтобы при следующем сканировании он считался дубликатом
    if (!existingCodes.contains(code)) {
      existingCodes.add(code)
      Log.d(TAG, "Код '$code' добавлен в existingCodes для проверки дубликатов")
    }

    // Debounce, чтобы не спамить звуком/вибрацией
    val now = SystemClock.elapsedRealtime()
    if (lastFeedbackCode != code || now - lastFeedbackTime > 800) {
      lastFeedbackCode = code
      lastFeedbackTime = now
      playFeedback()
    }

    // Простой текст без лишнего
    val displayCode = if (code.length > 30) {
      code.substring(0, 27) + "..."
    } else {
      code
    }
    
    successTextView.text = "✓ $displayCode"

    successBanner.visibility = View.VISIBLE
    
    // Простая плавная анимация
    successBanner.animate()
      .translationY(0f)
      .alpha(1f)
      .setDuration(250)
      .withEndAction {
        // Через короткое время отправляем результат (камера остается открытой)
        successBanner.postDelayed({
          Log.i(TAG, "Отправляем результат, камера остается открытой")
          sendScanResult(code, isDuplicate = false)
          
          // Прячем баннер
          successBanner.animate()
            .translationY(-60f)
            .alpha(0f)
            .setDuration(200)
            .withEndAction {
              successBanner.visibility = View.GONE
            }
            .start()
          
          // Возобновляем сканирование через небольшую задержку
          Handler(Looper.getMainLooper()).postDelayed({
            isScanningPaused = false
          }, 500)
        }, 500) 
      }
      .start()
  }
  
  private fun sendScanResult(code: String, isDuplicate: Boolean) {
    // Отправляем событие в React Native через QrScannerNativeModule
    try {
      // Получаем формат кода для передачи в React Native
      val format = lastScannedFormat
      val formatName = when (format) {
        Barcode.FORMAT_QR_CODE -> "QR_CODE"
        Barcode.FORMAT_DATA_MATRIX -> "DATA_MATRIX"
        Barcode.FORMAT_EAN_13 -> "EAN_13"
        Barcode.FORMAT_EAN_8 -> "EAN_8"
        Barcode.FORMAT_UPC_A -> "UPC_A"
        Barcode.FORMAT_UPC_E -> "UPC_E"
        Barcode.FORMAT_CODE_128 -> "CODE_128"
        Barcode.FORMAT_CODE_39 -> "CODE_39"
        Barcode.FORMAT_CODE_93 -> "CODE_93"
        Barcode.FORMAT_ITF -> "ITF"
        Barcode.FORMAT_CODABAR -> "CODABAR"
        else -> null
      }
      
      QrScannerNativeModule.sendScanEvent(code, isDuplicate, formatName)
      Log.i(TAG, "Событие сканирования отправлено в React Native: code=$code, isDuplicate=$isDuplicate, format=$formatName")
    } catch (e: Exception) {
      Log.e(TAG, "Ошибка при отправке события в React Native", e)
    }
    
    // Также сохраняем результат в Intent на случай закрытия Activity кнопкой "Назад"
    val data = Intent().apply {
      putExtra(EXTRA_QR_CODE, code)
      if (scannedCodes.isNotEmpty()) {
        putStringArrayListExtra(EXTRA_QR_CODES, ArrayList(scannedCodes))
      }
      if (isDuplicate) {
        putExtra(EXTRA_DUPLICATE_CODE, code)
      }
    }
    setResult(if (isDuplicate) RESULT_DUPLICATE else RESULT_OK, data)
    
    // НЕ ЗАКРЫВАЕМ Activity! Пользователь может продолжить сканирование
    Log.i(TAG, "Результат сохранен, камера остается открытой")
  }

  private fun startCamera() {
    val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
    cameraProviderFuture.addListener(
      {
        cameraProvider = cameraProviderFuture.get()

        val preview = Preview.Builder()
          .build()
          .also { it.setSurfaceProvider(previewView.surfaceProvider) }

        val analysis = ImageAnalysis.Builder()
          .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
          // МАКСИМАЛЬНОЕ РАЗРЕШЕНИЕ для распознавания даже плохо читаемых кодов (Data Matrix, мелкие QR)
          // Используем максимальное доступное разрешение камеры для лучшего качества
          .setTargetResolution(android.util.Size(1920, 1080)) // Full HD для максимального качества
          .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
          .build()

        analysis.setAnalyzer(cameraExecutor) { imageProxy ->
          processImageProxy(imageProxy)
        }

        val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

        try {
          cameraProvider?.unbindAll()
          camera = cameraProvider?.bindToLifecycle(
            this,
            cameraSelector,
            preview,
            analysis
          )

          // Базовое плавное приближение, чтобы код был «крупнее», как в Честном знаке
          currentZoomLinear = minZoomLinear
          animateZoomTo(baseZoomLinear)

          // Тап‑фокус
          previewView.setOnTouchListener { _, event ->
            if (event.action != MotionEvent.ACTION_UP) return@setOnTouchListener true
            val factory = previewView.meteringPointFactory
            val point = factory.createPoint(event.x, event.y)
            val action = FocusMeteringAction.Builder(point, FocusMeteringAction.FLAG_AF)
              .setAutoCancelDuration(3, TimeUnit.SECONDS)
              .build()
            camera?.cameraControl?.startFocusAndMetering(action)

            // При тап‑фокусе слегка приближаем, затем через пару секунд возвращаем назад к базовому
            animateZoomTo(currentZoomLinear + 0.15f)
            previewView.postDelayed({
              animateZoomTo(baseZoomLinear)
            }, 2000)
            true
          }
        } catch (e: Exception) {
          Log.e(TAG, "Failed to bind camera use cases", e)
          finishWithResult(null)
        }
      },
      ContextCompat.getMainExecutor(this)
    )
  }

  private fun processImageProxy(imageProxy: ImageProxy) {
    // Игнорируем кадры если сканирование на паузе (после успешного сканирования)
    if (isScanningPaused) {
      imageProxy.close()
      return
    }
    
    val mediaImage = imageProxy.image
    if (mediaImage == null) {
      imageProxy.close()
      return
    }

    val image = InputImage.fromMediaImage(
      mediaImage,
      imageProxy.imageInfo.rotationDegrees
    )

    Log.d(TAG, "Analyzing frame: w=${imageProxy.width}, h=${imageProxy.height}, rot=${imageProxy.imageInfo.rotationDegrees}")

    scanner.process(image)
      .addOnSuccessListener { barcodes ->
        Log.d(TAG, "ML Kit returned ${barcodes.size} barcodes")

        // Берём первый найденный код любого поддерживаемого формата
        val first = barcodes.firstOrNull()
        val rawValue = first?.rawValue

        if (first != null) {
          val formatName = when (first.format) {
            Barcode.FORMAT_QR_CODE -> "QR_CODE"
            Barcode.FORMAT_DATA_MATRIX -> "DATA_MATRIX"
            Barcode.FORMAT_EAN_13 -> "EAN-13"
            Barcode.FORMAT_EAN_8 -> "EAN-8"
            Barcode.FORMAT_UPC_A -> "UPC-A"
            Barcode.FORMAT_UPC_E -> "UPC-E"
            Barcode.FORMAT_CODE_128 -> "CODE-128"
            Barcode.FORMAT_CODE_39 -> "CODE-39"
            Barcode.FORMAT_CODE_93 -> "CODE-93"
            Barcode.FORMAT_ITF -> "ITF"
            Barcode.FORMAT_CODABAR -> "CODABAR"
            else -> "UNKNOWN(${first.format})"
          }
          Log.i(
            TAG,
            "Обнаружен штрихкод: format=$formatName, value=${first.rawValue?.take(64)}, size=${first.boundingBox?.width()}x${first.boundingBox?.height()}"
          )
          
          // updateDetectedCode УДАЛЕН - красный квадратик больше не нужен

          // Авто‑зум: если код маленький на кадре — плавно чуть приближаем,
          // если очень крупный — немного отдаляем.
          val box = first.boundingBox
          if (box != null) {
            val frameArea = (mediaImage.width * mediaImage.height).toFloat().coerceAtLeast(1f)
            val boxArea = (box.width() * box.height()).toFloat().coerceAtLeast(1f)
            val ratio = boxArea / frameArea
            Log.d(TAG, "Barcode area ratio=$ratio")

            when {
              ratio < 0.005f -> {
                // Код ОЧЕНЬ маленький (Data Matrix на сигаретах, поврежденные коды) -> максимальное приближение
                Log.d(TAG, "Очень маленький код (ratio=$ratio), применяем максимальный зум")
                runOnUiThread { animateZoomTo(maxZoomLinear) }
              }
              ratio < 0.01f -> {
                // Код ОЧЕНЬ маленький (плохо читаемые/поврежденные коды) -> максимальное приближение
                Log.d(TAG, "Маленький код (ratio=$ratio), применяем максимальный зум")
                runOnUiThread { animateZoomTo(maxZoomLinear) }
              }
              ratio < 0.025f -> {
                // Код очень маленький (штрихкоды на товарах) -> сильное приближение
                Log.d(TAG, "Маленький код (ratio=$ratio), применяем сильное приближение")
                runOnUiThread { animateZoomTo(baseZoomLinear + 0.35f) }
              }
              ratio in 0.025f..0.06f -> {
                // Код маленький (обычные штрихкоды/QR) -> умеренное приближение
                Log.d(TAG, "Средний код (ratio=$ratio), применяем умеренное приближение")
                runOnUiThread { animateZoomTo(baseZoomLinear + 0.20f) }
              }
              ratio > 0.30f -> {
                // Код уже крупный -> отъезжаем назад к базовому
                Log.d(TAG, "Крупный код (ratio=$ratio), возвращаемся к базовому зуму")
                runOnUiThread { animateZoomTo(baseZoomLinear) }
              }
              else -> {
                // Нормальный размер — оставляем зум как есть
                Log.d(TAG, "Нормальный размер кода (ratio=$ratio), зум не меняем")
              }
            }
          }

          // запоминаем момент, когда видели код, чтобы потом вернуть зум, если код исчезнет
          lastBarcodeDetectedAt = SystemClock.elapsedRealtime()
        } else {
          // updateDetectedCode УДАЛЕН - красный квадратик больше не нужен
          
          // Если кодов нет и давно ничего не видели — плавно вернёмся к базовому зуму
          val now = SystemClock.elapsedRealtime()
          if (now - lastBarcodeDetectedAt > 1000L) {
            runOnUiThread { animateZoomTo(baseZoomLinear) }
          }
        }

        if (!rawValue.isNullOrEmpty() && first != null) {
          Log.i(TAG, "QR/Barcode detected, showing success banner")
          val barcodeFormat = first.format
          imageProxy.close()
          runOnUiThread { showSuccessBanner(rawValue, barcodeFormat) }
        } else {
          Log.d(TAG, "No valid barcode in this frame")
          imageProxy.close()
        }
      }
      .addOnFailureListener { e ->
        Log.e(TAG, "Barcode scan failed: ${e.message}", e)
        imageProxy.close()
      }
  }

  // translateBarcodeRect и Tuple4 УДАЛЕНЫ - больше не нужны
  
  private fun finishWithResult(code: String?) {
    // Закрываем сканер полностью (используется только для кнопки "Назад")
    val data = Intent().apply {
      putExtra(EXTRA_QR_CODE, code)
      if (scannedCodes.isNotEmpty()) {
        putStringArrayListExtra(EXTRA_QR_CODES, ArrayList(scannedCodes))
      }
    }
    setResult(RESULT_OK, data)
    finish()
  }


  override fun onDestroy() {
    super.onDestroy()
    
    // Освобождаем камеру перед уничтожением Activity
    try {
      cameraProvider?.unbindAll()
      camera = null
      Log.d(TAG, "Камера освобождена в onDestroy")
    } catch (e: Exception) {
      Log.e(TAG, "Ошибка при освобождении камеры", e)
    }
    
    // Останавливаем executor (проверяем, что он инициализирован)
    if (::cameraExecutor.isInitialized) {
      try {
        cameraExecutor.shutdown()
        if (!cameraExecutor.awaitTermination(1, java.util.concurrent.TimeUnit.SECONDS)) {
          cameraExecutor.shutdownNow()
        }
      } catch (e: Exception) {
        Log.e(TAG, "Ошибка при остановке executor", e)
        try {
          cameraExecutor.shutdownNow()
        } catch (e2: Exception) {
          Log.e(TAG, "Ошибка при принудительной остановке executor", e2)
        }
      }
    }
    
    // Очищаем ссылку на экземпляр
    Companion.currentInstance = null
  }

  companion object {
    private const val TAG = "QrScannerNative"
    const val EXTRA_QR_CODE = "qrCode"
    const val EXTRA_QR_CODES = "qrCodes"
    const val EXTRA_EXISTING_CODES = "existingCodes" // Коды, которые уже сканированы
    const val EXTRA_DUPLICATE_CODE = "duplicateCode" // Код дубликата
    const val RESULT_DUPLICATE = 100 // Результат когда нашли дубликат
    
    // Статическая ссылка на текущий экземпляр Activity
    private var currentInstance: QrScannerNativeActivity? = null
    
    fun getCurrentInstance(): QrScannerNativeActivity? = currentInstance
  }
}

/**
 * Минималистичный оверлей со сканирующей рамкой - чистый и простой дизайн.
 * + Красная рамка вокруг обнаруженного QR-кода как в "Честном знаке".
 */
private class QrScannerOverlayView(context: Context) : View(context) {
  private val density = resources.displayMetrics.density
  
  private val maskPaint = Paint().apply {
    color = 0x66000000.toInt() // ЛЕГКОЕ затемнение - чуть темнее чем внутри рамки
    style = Paint.Style.FILL
  }
  
  // Тонкие оранжевые углы - фирменный цвет приложения
  private val cornerPaint = Paint().apply {
    color = 0xFFFF6B35.toInt() // #FF6B35 - фирменный оранжевый цвет
    style = Paint.Style.STROKE
    strokeWidth = 3f * density // Чуть толще для видимости
    isAntiAlias = true
    strokeCap = Paint.Cap.ROUND // ЗАКРУГЛЕННЫЕ углы как на скрине
  }
  
  // detectedCodePaint и detectedCodeRect УДАЛЕНЫ - больше не нужны

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    
    val w = width.toFloat()
    val h = height.toFloat()

    // ПРЯМОУГОЛЬНАЯ зона сканирования - вытянутая по ВЕРТИКАЛИ как на скрине
    val frameWidth = w * 0.85f // 85% ширины экрана
    val frameHeight = h * 0.80f // 85% высоты 
    val left = (w - frameWidth) / 2f
    val top = (h - frameHeight) / 2f
    val right = left + frameWidth
    val bottom = top + frameHeight

    // Затемняем всё вокруг рамки
    canvas.drawRect(0f, 0f, w, top, maskPaint)
    canvas.drawRect(0f, bottom, w, h, maskPaint)
    canvas.drawRect(0f, top, left, bottom, maskPaint)
    canvas.drawRect(right, top, w, bottom, maskPaint)

    // Рисуем ЗАКРУГЛЕННЫЕ угловые скобки - увеличенный радиус для плавных углов
    val cornerLength = 50f * density // Длина линий углов
    val cornerRadius = 32f * density // увеличенный радиус закругления углов для плавности

    // Верхний левый угол - ЗАКРУГЛЕННЫЙ
    val topLeftPath = Path().apply {
      moveTo(left, top + cornerLength)
      lineTo(left, top + cornerRadius)
      quadTo(left, top, left + cornerRadius, top)
      lineTo(left + cornerLength, top)
    }
    canvas.drawPath(topLeftPath, cornerPaint)

    // Верхний правый угол - ЗАКРУГЛЕННЫЙ
    val topRightPath = Path().apply {
      moveTo(right - cornerLength, top)
      lineTo(right - cornerRadius, top)
      quadTo(right, top, right, top + cornerRadius)
      lineTo(right, top + cornerLength)
    }
    canvas.drawPath(topRightPath, cornerPaint)

    // Нижний левый угол - ЗАКРУГЛЕННЫЙ
    val bottomLeftPath = Path().apply {
      moveTo(left, bottom - cornerLength)
      lineTo(left, bottom - cornerRadius)
      quadTo(left, bottom, left + cornerRadius, bottom)
      lineTo(left + cornerLength, bottom)
    }
    canvas.drawPath(bottomLeftPath, cornerPaint)

    // Нижний правый угол - ЗАКРУГЛЕННЫЙ
    val bottomRightPath = Path().apply {
      moveTo(right - cornerLength, bottom)
      lineTo(right - cornerRadius, bottom)
      quadTo(right, bottom, right, bottom - cornerRadius)
      lineTo(right, bottom - cornerLength)
    }
    canvas.drawPath(bottomRightPath, cornerPaint)
  }
}



