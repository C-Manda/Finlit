package expo.modules.finlitsms

import android.Manifest
import android.content.BroadcastReceiver
import android.content.ContentResolver
import android.os.Bundle
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Telephony
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FinlitSmsModule : Module() {
  private val context get()=requireNotNull(appContext.reactContext)
  private val prefs get()=context.getSharedPreferences("finlit_sms_settings",Context.MODE_PRIVATE)
  private fun owner(expected:String):String { require(prefs.getString("owner",null)==expected && expected.isNotBlank()) { "Account changed; reopen SMS tracking" };return expected }
  private fun granted()=listOf(Manifest.permission.READ_SMS,Manifest.permission.RECEIVE_SMS).all {context.checkSelfPermission(it)==PackageManager.PERMISSION_GRANTED}
  private val listener=object:BroadcastReceiver(){override fun onReceive(c:Context,i:Intent){sendEvent("onCandidate",emptyMap<String,Any>())}}
  override fun definition()=ModuleDefinition {
    Name("FinlitSms")
    Events("onCandidate")
    OnCreate {
      val filter=IntentFilter("expo.modules.finlitsms.CANDIDATE")
      if(Build.VERSION.SDK_INT>=33)context.registerReceiver(listener,filter,Context.RECEIVER_NOT_EXPORTED) else context.registerReceiver(listener,filter)
    }
    OnDestroy { try { context.unregisterReceiver(listener) } catch(_:IllegalArgumentException) {} }
    AsyncFunction("setOwner") { value:String? -> prefs.edit().apply {if(value==null)remove("owner")else putString("owner",value)}.commit();Unit }
    AsyncFunction("permissionStatus") { promise:Promise ->
      promise.resolve(mapOf(
        "granted" to granted(),
        "canAskAgain" to true,
        "readSms" to (context.checkSelfPermission(Manifest.permission.READ_SMS)==PackageManager.PERMISSION_GRANTED),
        "receiveSms" to (context.checkSelfPermission(Manifest.permission.RECEIVE_SMS)==PackageManager.PERMISSION_GRANTED)
      ))
    }
    AsyncFunction("requestPermissions") { promise:Promise -> Permissions.askForPermissionsWithPermissionsManager(appContext.permissions,promise,Manifest.permission.READ_SMS,Manifest.permission.RECEIVE_SMS) }
    AsyncFunction("settings") { expected:String ->
      val u=owner(expected)
      mapOf("enabled" to prefs.getBoolean("enabled_$u",false),"baseline" to prefs.getString("baseline_$u",null),"lastScan" to prefs.getString("lastScan_$u",null),"full" to prefs.getBoolean("full_$u",false),"cache" to prefs.getString("cache_$u",null))
    }
    AsyncFunction("diagnostics") { expected:String ->
      val u=owner(expected)
      val read=context.checkSelfPermission(Manifest.permission.READ_SMS)==PackageManager.PERMISSION_GRANTED
      val receive=context.checkSelfPermission(Manifest.permission.RECEIVE_SMS)==PackageManager.PERMISSION_GRANTED
      mapOf(
        "nativeAvailable" to true, "readSms" to read, "receiveSms" to receive,
        "trackingEnabled" to prefs.getBoolean("enabled_$u",false),
        "ownerInitialized" to (prefs.getString("owner",null)==u),
        "lastReceiverEvent" to prefs.getString("lastReceiver_$u",null),
        "lastScan" to prefs.getString("lastScan_$u",null),
        "messagesScanned" to prefs.getInt("scanned_$u",0),
        "candidatesQueued" to SmsQueue(context).use { it.pendingCount(u) },
        "pendingQueue" to SmsQueue(context).use { it.pendingCount(u) },
        "lastError" to prefs.getString("lastError_$u",null)
      )
    }
    AsyncFunction("setEnabled") { expected:String, enabled:Boolean ->
      val u=owner(expected);require(!enabled||granted()) {"SMS permissions are required"}
      prefs.edit().putBoolean("enabled_$u",enabled).apply { if(enabled&&!prefs.contains("baseline_$u"))putString("baseline_$u",smsIsoTime()) }.commit();Unit
    }
    AsyncFunction("saveCache") { expected:String,value:String -> require(value.length<=2000000);prefs.edit().putString("cache_${owner(expected)}",value).commit();Unit }
    AsyncFunction("candidates") { expected:String -> SmsQueue(context).use {it.list(owner(expected))} }
    AsyncFunction("saveCandidate") { expected:String,id:String,value:String -> SmsQueue(context).use {it.save(owner(expected),id,value)} }
    AsyncFunction("acknowledge") { expected:String,id:String -> SmsQueue(context).use {it.acknowledge(owner(expected),id)} }
    AsyncFunction("clearCandidates") { expected:String -> val u=owner(expected);SmsQueue(context).use {it.clear(u)};prefs.edit().putBoolean("full_$u",false).commit();Unit }
    AsyncFunction("scan") { expected:String,since:Double,before:Double,beforeId:String? ->
      val u=owner(expected)
      try {
      require(granted()) {"SMS permission was denied or revoked. Open Android settings to grant it."};require(prefs.getBoolean("enabled_$u",false)) {"SMS tracking is disabled"}
      require(since.isFinite()&&before.isFinite()&&since>=0&&before>since)
      var visited=0;var relevant=0;var added=0;var handled=0;var lastDate=before.toLong();var lastId=beforeId?:Long.MAX_VALUE.toString();var full=false
      val projection=arrayOf("_id","address","body","date","date_sent","sub_id")
      val selection="date>=? AND (date<? OR (date=? AND _id<?))"
      val args=arrayOf(since.toLong().toString(),before.toLong().toString(),before.toLong().toString(),beforeId?:Long.MAX_VALUE.toString())
      // Bounded query plus keyset cursor: at most 250 SMS rows per user action, no OFFSET scan.
      val cursor=if(Build.VERSION.SDK_INT>=26) {
        val queryArgs=Bundle().apply {
          putString(ContentResolver.QUERY_ARG_SQL_SELECTION,selection)
          putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS,args)
          putString(ContentResolver.QUERY_ARG_SQL_SORT_ORDER,"date DESC, _id DESC")
          putInt(ContentResolver.QUERY_ARG_LIMIT,250)
        }
        context.contentResolver.query(Telephony.Sms.Inbox.CONTENT_URI,projection,queryArgs,null)
      } else context.contentResolver.query(Telephony.Sms.Inbox.CONTENT_URI,projection,selection,args,"date DESC, _id DESC")
      // Some providers ignore QUERY_ARG_LIMIT; the cursor loop independently caps reads.
      requireNotNull(cursor) {"Android could not read the SMS inbox. Retry after checking permissions."}.use { c ->
        SmsQueue(context).use { q ->
          while(visited<250&&c.moveToNext()) {
            if(prefs.getString("owner",null)!=u||!prefs.getBoolean("enabled_$u",false)||!granted())break
            visited++;lastId=c.getString(0);lastDate=c.getLong(c.getColumnIndexOrThrow("date"))
            val senderIndex=c.getColumnIndex("address");val bodyIndex=c.getColumnIndex("body")
            require(senderIndex>=0&&bodyIndex>=0) {"Android SMS provider omitted required columns."}
            val sender=c.getString(senderIndex)?:"";val body=c.getString(bodyIndex)?:""
            if(SmsQueue.candidate(sender,body)) {
              relevant++
              val sentIndex=c.getColumnIndex("date_sent");val subIndex=c.getColumnIndex("sub_id")
              val sent=if(sentIndex>=0)c.getLong(sentIndex).takeIf {it>0}?:lastDate else lastDate
              val sub=if(subIndex<0||c.isNull(subIndex)||c.getString(subIndex)=="-1")null else c.getString(subIndex)
              when(q.enqueueResult(u,sender,body,lastDate,sent,sub)){
                SmsQueue.EnqueueResult.NEW->added++
                SmsQueue.EnqueueResult.ALREADY_PENDING, SmsQueue.EnqueueResult.ALREADY_HANDLED, SmsQueue.EnqueueResult.ALREADY_CLEARED->handled++
                SmsQueue.EnqueueResult.FULL->full=true
              }
            }
          }
        }
      }
      prefs.edit().putString("lastScan_$u",smsIsoTime()).putInt("scanned_$u",visited)
        .putInt("queued_$u",added).putString("lastError_$u",null).putBoolean("full_$u",full).commit()
      val pending=SmsQueue(context).use {it.pendingCount(u)}
      mapOf("visited" to visited,"relevant" to relevant,"newlyQueued" to added,"previouslyHandled" to handled,"unsupported" to 0,"pending" to pending,"before" to lastDate.toDouble(),"beforeId" to lastId,"more" to (visited==250),"full" to full)
      } catch(error:Exception) {
        prefs.edit().putString("lastError_$u",error.message ?: "Inbox scan failed").commit()
        throw error
      }
    }
  }
}
