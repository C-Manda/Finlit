package expo.modules.finlitsms

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

internal fun smsIsoTime(value:Long=System.currentTimeMillis()):String = SimpleDateFormat("yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'",Locale.US).apply { timeZone=TimeZone.getTimeZone("UTC") }.format(Date(value))

/** App-private, account-partitioned inbox. No raw SMS is uploaded by this module. */
class SmsQueue(context: Context) : SQLiteOpenHelper(context, "finlit_sms.db", null, 1) {
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE candidates(owner TEXT NOT NULL,id TEXT NOT NULL,sender TEXT NOT NULL,body TEXT NOT NULL,received INTEGER NOT NULL,subscription TEXT,payload TEXT,done INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner,id))")
  }
  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
  fun enqueue(owner: String, sender: String, body: String, received: Long, sent: Long, subscription: String?): Boolean {
    val id = MessageDigest.getInstance("SHA-256").digest((sender.trim().lowercase(Locale.ROOT)+"|"+body.trim().replace(Regex("\\s+")," ")+"|"+sent+"|"+(subscription?:"")).toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    val db=writableDatabase
    db.beginTransaction()
    try {
      db.rawQuery("SELECT id FROM candidates WHERE owner=? AND id=?",arrayOf(owner,id)).use { if(it.moveToFirst())return true }
      db.rawQuery("SELECT count(*) FROM candidates WHERE owner=? AND done=0",arrayOf(owner)).use { it.moveToFirst();if(it.getInt(0)>=1000)return false }
      val values=ContentValues().apply { put("owner",owner);put("id",id);put("sender",sender);put("body",body);put("received",received);if(subscription!=null)put("subscription",subscription) }
      db.insertOrThrow("candidates",null,values)
      db.execSQL("DELETE FROM candidates WHERE owner=? AND done=1 AND id NOT IN (SELECT id FROM candidates WHERE owner=? AND done=1 ORDER BY received DESC LIMIT 5000)",arrayOf(owner,owner))
      db.setTransactionSuccessful();return true
    } finally { db.endTransaction() }
  }
  fun list(owner:String):List<Map<String,Any?>> {
    return readableDatabase.rawQuery("SELECT id,sender,body,received,subscription,payload FROM candidates WHERE owner=? AND done=0 ORDER BY received LIMIT 1000",arrayOf(owner)).use { c ->
      val rows=mutableListOf<Map<String,Any?>>()
      while(c.moveToNext())rows.add(mapOf("id" to c.getString(0),"fingerprint" to c.getString(0),"sender" to c.getString(1),"body" to c.getString(2),"receivedAt" to smsIsoTime(c.getLong(3)),"subscriptionId" to if(c.isNull(4))null else c.getString(4),"payload" to if(c.isNull(5))null else c.getString(5)))
      rows
    }
  }
  fun save(owner:String,id:String,payload:String) {
    require(payload.length<=20000) { "Candidate too large" };JSONObject(payload)
    writableDatabase.update("candidates",ContentValues().apply {put("payload",payload)},"owner=? AND id=? AND done=0",arrayOf(owner,id))
  }
  fun acknowledge(owner:String,id:String?) {
    val v=ContentValues().apply {put("done",1);put("body","");put("sender","");putNull("payload");putNull("subscription")}
    writableDatabase.update("candidates",v,if(id==null)"owner=?" else "owner=? AND id=?",if(id==null)arrayOf(owner)else arrayOf(owner,id))
  }
  companion object {
    fun candidate(sender:String,body:String):Boolean {
      if(body.length>4096 || Regex("(?i)\\bOTP\\b|one[- ]time|verification code|\\bPIN\\b|special offer|promotion").containsMatchIn(body))return false
      val branded=Regex("(?i)MTN|Airtel|Zamtel|Yello|Financial Transaction Id|Txn\\.?\\s*ID|\\bTID\\s*:").containsMatchIn(sender+" "+body)
      return branded && Regex("(?i)\\bZMW\\b|\\bK[0-9]").containsMatchIn(body) && Regex("(?i)received|sent|withdrawn|payment|transaction|balance|bal is").containsMatchIn(body)
    }
  }
}
