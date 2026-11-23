import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const manifestPath=path.join(root,'android/app/src/main/AndroidManifest.xml');
let manifest=fs.readFileSync(manifestPath,'utf8');
const permissions=[
 '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
 '<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />',
 '<uses-permission android:name="android.permission.VIBRATE" />',
 '<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />',
 '<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />',
];
for(const p of permissions){const n=p.match(/android:name="([^"]+)"/)[1];if(!manifest.includes(n))manifest=manifest.replace('<application',p+'\n    <application');}
const receivers=[
 '        <receiver android:name=".PrayerAlarmReceiver" android:enabled="true" android:exported="false" />',
 '        <receiver android:name=".SalawatAlarmReceiver" android:enabled="true" android:exported="false" />',
 '        <receiver android:name=".BootReceiver" android:enabled="true" android:exported="true">',
 '            <intent-filter><action android:name="android.intent.action.BOOT_COMPLETED" /></intent-filter>',
 '        </receiver>'
].join('\n');
if(!manifest.includes('PrayerAlarmReceiver'))manifest=manifest.replace('</application>',receivers+'\n    </application>');
fs.writeFileSync(manifestPath,manifest);
const dir=path.join(root,'android/app/src/main/java/com/ashrafalkhalq/app');
fs.mkdirSync(dir,{recursive:true});
function write(name,lines){fs.writeFileSync(path.join(dir,name),lines.join('\n'));}
write('MainActivity.java',[
'package com.ashrafalkhalq.app;',
'import android.Manifest;','import android.content.Intent;','import android.net.Uri;','import android.os.Build;','import android.os.PowerManager;','import android.provider.Settings;','import android.media.RingtoneManager;','import android.webkit.JavascriptInterface;','import android.widget.Toast;','import com.getcapacitor.BridgeActivity;','import org.json.JSONObject;',
'public class MainActivity extends BridgeActivity {',
' @Override public void onStart(){super.onStart();if(getBridge()!=null&&getBridge().getWebView()!=null)getBridge().getWebView().addJavascriptInterface(new NativeControls(),"AshrafAndroid");}',
' @Override public void onResume(){super.onResume();deliverPrayerIntent();}',
' @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode==4104&&resultCode==RESULT_OK&&data!=null){Uri uri=data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);String value=uri==null?null:uri.toString();getSharedPreferences("ashraf_schedule",0).edit().putString("adhan_sound_uri",value).apply();if(getBridge()!=null&&getBridge().getWebView()!=null){String js="if(window.onAdhanSoundPicked)window.onAdhanSoundPicked("+JSONObject.quote(value)+")";getBridge().getWebView().post(()->getBridge().getWebView().evaluateJavascript(js,null));}}}',
' @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);deliverPrayerIntent();}',
' private void deliverPrayerIntent(){if(getIntent()==null||!getIntent().hasExtra("ashraf_prayer")||getBridge()==null||getBridge().getWebView()==null)return;String p=getIntent().getStringExtra("ashraf_prayer");getIntent().removeExtra("ashraf_prayer");String safe=JSONObject.quote(p==null?"":p);getBridge().getWebView().postDelayed(()->getBridge().getWebView().evaluateJavascript("if(window.onNativePrayerOpen)window.onNativePrayerOpen("+safe+")",null),1000);}',
' public class NativeControls {',
'  @JavascriptInterface public void requestNotifications(){runOnUiThread(()->{if(Build.VERSION.SDK_INT>=33)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},4101);else Toast.makeText(MainActivity.this,"إذن الإشعارات من إعدادات التطبيق",Toast.LENGTH_SHORT).show();});}',
'  @JavascriptInterface public void schedulePrayerAlarms(String raw){try{PrayerScheduler.saveAndSchedule(MainActivity.this,new JSONObject(raw));}catch(Exception e){runOnUiThread(()->Toast.makeText(MainActivity.this,"تعذر جدولة مواقيت الصلاة",Toast.LENGTH_SHORT).show());}}',
'  @JavascriptInterface public void cancelPrayerAlarms(){PrayerScheduler.cancel(MainActivity.this);}',
'  @JavascriptInterface public void requestBackgroundPermission(){runOnUiThread(()->{try{PowerManager pm=(PowerManager)getSystemService(POWER_SERVICE);if(Build.VERSION.SDK_INT>=23&&!pm.isIgnoringBatteryOptimizations(getPackageName())){Intent i=new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,Uri.parse("package:"+getPackageName()));startActivity(i);}else Toast.makeText(MainActivity.this,"السماح بالعمل في الخلفية مفعّل بالفعل",Toast.LENGTH_SHORT).show();}catch(Exception e){startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));}});}',
'  @JavascriptInterface public void requestOverlayPermission(){runOnUiThread(()->{if(Build.VERSION.SDK_INT>=23&&!Settings.canDrawOverlays(MainActivity.this)){Intent i=new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getPackageName()));startActivity(i);}else Toast.makeText(MainActivity.this,"إذن الظهور فوق التطبيقات مفعّل بالفعل",Toast.LENGTH_SHORT).show();});}',
'  @JavascriptInterface public void pickAdhanSound(){runOnUiThread(()->{Intent i=new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);i.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE,RingtoneManager.TYPE_NOTIFICATION|RingtoneManager.TYPE_ALARM);i.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE,"اختر صوت الأذان");startActivityForResult(i,4104);});}',
'  @JavascriptInterface public void setSalawatReminder(boolean enabled){PrayerScheduler.setSalawat(MainActivity.this,enabled);}',
' }','}'
]);
write('PrayerScheduler.java',[
'package com.ashrafalkhalq.app;','import android.app.AlarmManager;','import android.app.PendingIntent;','import android.content.Context;','import android.content.Intent;','import android.content.SharedPreferences;','import org.json.JSONObject;','import java.util.Calendar;',
'public final class PrayerScheduler {',
' private static final String PREF="ashraf_schedule"; private static final String PRAYERS="prayers"; private static final String SALAWAT="salawat";',
' private static final String[] NAMES={"الفجر","الظهر","العصر","المغرب","العشاء"}; private static final String[] KEYS={"Fajr","Dhuhr","Asr","Maghrib","Isha"};',
' private PrayerScheduler(){}',
' static void saveAndSchedule(Context c,JSONObject data)throws Exception{JSONObject t=data.getJSONObject("timings");c.getSharedPreferences(PREF,0).edit().putString(PRAYERS,t.toString()).putString("adhan_voice",data.optString("sound","system")).putBoolean("vibration",data.optBoolean("vibration",true)).apply();schedule(c,t);}',
' static void schedule(Context c,JSONObject t){cancel(c);AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);for(int i=0;i<KEYS.length;i++){String s=t.optString(KEYS[i],"");if(s.length()<5)continue;try{int h=Integer.parseInt(s.substring(0,2)),m=Integer.parseInt(s.substring(3,5));Calendar cal=Calendar.getInstance();cal.set(Calendar.HOUR_OF_DAY,h);cal.set(Calendar.MINUTE,m);cal.set(Calendar.SECOND,0);cal.set(Calendar.MILLISECOND,0);if(cal.getTimeInMillis()<=System.currentTimeMillis())cal.add(Calendar.DAY_OF_YEAR,1);Intent in=new Intent(c,PrayerAlarmReceiver.class);in.putExtra("prayer",NAMES[i]);in.putExtra("request",700+i);PendingIntent pi=PendingIntent.getBroadcast(c,700+i,in,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,cal.getTimeInMillis(),pi);}catch(Exception ignored){}}}',
' static void cancel(Context c){AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);for(int i=0;i<KEYS.length;i++){PendingIntent pi=PendingIntent.getBroadcast(c,700+i,new Intent(c,PrayerAlarmReceiver.class),PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE);if(pi!=null){am.cancel(pi);pi.cancel();}}}',
' static void setSalawat(Context c,boolean enabled){c.getSharedPreferences(PREF,0).edit().putBoolean(SALAWAT,enabled).apply();Intent in=new Intent(c,SalawatAlarmReceiver.class);PendingIntent pi=PendingIntent.getBroadcast(c,900,in,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);if(!enabled){am.cancel(pi);pi.cancel();return;}am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,System.currentTimeMillis()+30L*60L*1000L,pi);}',
' static void restore(Context c){SharedPreferences p=c.getSharedPreferences(PREF,0);String raw=p.getString(PRAYERS,null);if(raw!=null)try{schedule(c,new JSONObject(raw));}catch(Exception ignored){}if(p.getBoolean(SALAWAT,false))setSalawat(c,true);}',
' static void scheduleNextPrayer(Context c,int request){int i=request-700;if(i<0||i>=KEYS.length)return;String raw=c.getSharedPreferences(PREF,0).getString(PRAYERS,null);if(raw==null)return;try{String s=new JSONObject(raw).optString(KEYS[i],"");if(s.length()<5)return;Calendar cal=Calendar.getInstance();cal.set(Calendar.HOUR_OF_DAY,Integer.parseInt(s.substring(0,2)));cal.set(Calendar.MINUTE,Integer.parseInt(s.substring(3,5)));cal.set(Calendar.SECOND,0);cal.set(Calendar.MILLISECOND,0);cal.add(Calendar.DAY_OF_YEAR,1);Intent in=new Intent(c,PrayerAlarmReceiver.class);in.putExtra("prayer",NAMES[i]);in.putExtra("request",request);PendingIntent pi=PendingIntent.getBroadcast(c,request,in,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);((AlarmManager)c.getSystemService(Context.ALARM_SERVICE)).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,cal.getTimeInMillis(),pi);}catch(Exception ignored){}}',
'}'
]);
write('PrayerAlarmReceiver.java',[
'package com.ashrafalkhalq.app;','import android.app.*;','import android.content.*;','import android.net.Uri;','import android.media.AudioAttributes;','import android.os.Build;',
'public class PrayerAlarmReceiver extends BroadcastReceiver {',
' static final String CHANNEL="ashraf_prayer";',
' @Override public void onReceive(Context c,Intent in){String prayer=in.getStringExtra("prayer");if(prayer==null)prayer="الصلاة";NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);android.content.SharedPreferences prefs=c.getSharedPreferences("ashraf_schedule",0);boolean vibration=prefs.getBoolean("vibration",true);String voice=prefs.getString("adhan_voice","system");String soundUri=prefs.getString("adhan_sound_uri",null);String channelId=CHANNEL+(("silent".equals(voice))?"_silent":soundUri!=null?"_custom_"+Integer.toHexString(soundUri.hashCode()):"_system")+(vibration?"_vibrate":"_no_vibrate");if(Build.VERSION.SDK_INT>=26){NotificationChannel ch=new NotificationChannel(channelId,"تنبيهات الصلاة",NotificationManager.IMPORTANCE_HIGH);ch.setDescription("تنبيه عند دخول وقت الصلاة");ch.enableVibration(vibration);if("silent".equals(voice))ch.setSound(null,null);else if(soundUri!=null)ch.setSound(Uri.parse(soundUri),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());nm.createNotificationChannel(ch);}Intent open=new Intent(c,MainActivity.class);open.putExtra("ashraf_prayer",prayer);open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);PendingIntent content=PendingIntent.getActivity(c,1200+in.getIntExtra("request",0),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(c,channelId):new Notification.Builder(c);b.setSmallIcon(c.getApplicationInfo().icon).setContentTitle("حان الآن موعد صلاة "+prayer).setContentText("حيّ على الصلاة — حيّ على الفلاح").setAutoCancel(true).setContentIntent(content).setCategory(Notification.CATEGORY_ALARM).setPriority(Notification.PRIORITY_HIGH);if(Build.VERSION.SDK_INT<26){if("silent".equals(voice))b.setSound(null);else if(soundUri!=null)b.setSound(Uri.parse(soundUri));else b.setDefaults(Notification.DEFAULT_SOUND|(vibration?Notification.DEFAULT_VIBRATE:0));if(!vibration)b.setVibrate(new long[]{0});}nm.notify(700+in.getIntExtra("request",0),b.build());PrayerScheduler.scheduleNextPrayer(c,in.getIntExtra("request",0));}',
'}'
]);
write('SalawatAlarmReceiver.java',[
'package com.ashrafalkhalq.app;','import android.app.*;','import android.content.*;','import android.os.Build;','import android.speech.tts.TextToSpeech;','import java.util.Locale;',
'public class SalawatAlarmReceiver extends BroadcastReceiver {',
' @Override public void onReceive(Context c,Intent in){if(!c.getSharedPreferences("ashraf_schedule",0).getBoolean("salawat",false))return;NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);if(Build.VERSION.SDK_INT>=26)nm.createNotificationChannel(new NotificationChannel("ashraf_salawat","الصلاة على النبي ﷺ",NotificationManager.IMPORTANCE_DEFAULT));Intent open=new Intent(c,MainActivity.class);open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);PendingIntent pi=PendingIntent.getActivity(c,1900,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(c,"ashraf_salawat"):new Notification.Builder(c);b.setSmallIcon(c.getApplicationInfo().icon).setContentTitle("صلّوا على النبي ﷺ").setContentText("صَلِّ على محمد").setAutoCancel(true).setContentIntent(pi);nm.notify(1900,b.build());try{final TextToSpeech[] holder=new TextToSpeech[1];holder[0]=new TextToSpeech(c,status->{if(status==TextToSpeech.SUCCESS&&holder[0]!=null){int result=holder[0].setLanguage(new Locale("ar"));if(result>=0)holder[0].speak("صلي على محمد",TextToSpeech.QUEUE_FLUSH,null,"salawat");}});}catch(Exception ignored){}PrayerScheduler.setSalawat(c,true);}',
'}'
]);
write('BootReceiver.java',[
'package com.ashrafalkhalq.app;','import android.content.BroadcastReceiver;','import android.content.Context;','import android.content.Intent;',
'public class BootReceiver extends BroadcastReceiver { @Override public void onReceive(Context c,Intent i){if(Intent.ACTION_BOOT_COMPLETED.equals(i.getAction()))PrayerScheduler.restore(c);} }'
]);
