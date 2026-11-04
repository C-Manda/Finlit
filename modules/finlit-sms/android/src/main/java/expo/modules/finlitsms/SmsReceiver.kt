package expo.modules.finlitsms

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Telephony
import java.util.concurrent.Executors

class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context:Context,intent:Intent) {
    if(intent.action!=Telephony.Sms.Intents.SMS_RECEIVED_ACTION || (context.checkSelfPermission(Manifest.permission.RECEIVE_SMS)!=PackageManager.PERMISSION_GRANTED || context.checkSelfPermission(Manifest.permission.READ_SMS)!=PackageManager.PERMISSION_GRANTED))return
    val prefs=context.getSharedPreferences("finlit_sms_settings",Context.MODE_PRIVATE)
    val owner=prefs.getString("owner",null)?:return
    if(!prefs.getBoolean("enabled_$owner",false))return
    val segments=Telephony.Sms.Intents.getMessagesFromIntent(intent)?:return
    if(segments.isEmpty())return
    val sender=segments[0].originatingAddress?:""
    // Android supplies the multipart PDUs in their sequence order for this broadcast.
    if(segments.any { (it.originatingAddress?:"")!=sender })return
    val body=segments.joinToString("") { it.messageBody?:"" }
    if(!SmsQueue.candidate(sender,body))return
    val sent=segments[0].timestampMillis
    val subscription=intent.extras?.get("subscription")?.toString()?.takeIf { it!="-1" }
    val pending=goAsync()
    worker.execute {
      try {
        // Recheck after handoff so disabling/signing out stops a queued callback too.
        if(prefs.getString("owner",null)==owner && prefs.getBoolean("enabled_$owner",false) && context.checkSelfPermission(Manifest.permission.READ_SMS)==PackageManager.PERMISSION_GRANTED && context.checkSelfPermission(Manifest.permission.RECEIVE_SMS)==PackageManager.PERMISSION_GRANTED) {
          SmsQueue(context).use { q ->
            if(!q.enqueue(owner,sender,body,System.currentTimeMillis(),sent,subscription))prefs.edit().putBoolean("full_$owner",true).apply()
          }
          context.sendBroadcast(Intent("expo.modules.finlitsms.CANDIDATE").setPackage(context.packageName))
        }
      } catch (_:Exception) {
        // Never log message text. A failed capture can be recovered by a manual inbox scan.
        prefs.edit().putBoolean("full_$owner",true).apply()
      } finally { pending.finish() }
    }
  }
  companion object { private val worker=Executors.newSingleThreadExecutor() }
}
