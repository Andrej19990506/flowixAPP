package com.flowix.app.qrscanner

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class QrScannerNativeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  init {
    Companion.moduleInstance = this
  }

  override fun getName(): String = "QrScannerNativeModule"
  
  fun sendEventToJS(code: String, isDuplicate: Boolean, format: String? = null) {
    val params = Arguments.createMap().apply {
      putString("code", code)
      putBoolean("isDuplicate", isDuplicate)
      if (format != null) {
        putString("format", format)
      }
    }
    
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("onQrCodeScanned", params)
  }

  @ReactMethod
  fun openQrScanner(existingCodes: ReadableArray?, promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Current Activity is null")
      return
    }

    val intent = Intent(activity, QrScannerNativeActivity::class.java)
    
    // Передаем список уже сканированных кодов
    if (existingCodes != null && existingCodes.size() > 0) {
      val codesList = ArrayList<String>()
      for (i in 0 until existingCodes.size()) {
        existingCodes.getString(i)?.let { codesList.add(it) }
      }
      intent.putStringArrayListExtra(QrScannerNativeActivity.EXTRA_EXISTING_CODES, codesList)
    }
    
    // Открываем Activity обычным способом (не через startActivityForResult)
    // так как результаты приходят через события, а не через onActivityResult
    activity.startActivity(intent)
    
    // Резолвим Promise сразу после открытия Activity, так как камера остается открытой
    // Результаты сканирования приходят через события onQrCodeScanned
    promise.resolve(null)
  }

  @ReactMethod
  fun closeQrScanner(promise: Promise) {
    try {
      val currentInstance = QrScannerNativeActivity.getCurrentInstance()
      if (currentInstance != null) {
        currentInstance.finish()
        promise.resolve(true)
      } else {
        promise.resolve(false)
      }
    } catch (e: Exception) {
      promise.reject("ERROR", "Failed to close QR scanner: ${e.message}")
    }
  }

  companion object {
    private var moduleInstance: QrScannerNativeModule? = null
    
    fun sendScanEvent(code: String, isDuplicate: Boolean, format: String? = null) {
      moduleInstance?.sendEventToJS(code, isDuplicate, format)
    }
  }
}
