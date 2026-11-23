import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'android/app/src/main/AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
const permissions = [
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />',
  '<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />'
];
for (const permission of permissions) {
  const name = permission.match(/android:name="([^"]+)"/)[1];
  if (!manifest.includes(name)) manifest = manifest.replace('<application', permission + '\n    <application');
}
const service = '<service android:name=".AshrafKeepAliveService" android:exported="false" android:foregroundServiceType="specialUse"><property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="User-enabled prayer reminder support" /></service>';
if (!manifest.includes('AshrafKeepAliveService')) manifest = manifest.replace('</application>', service + '\n    </application>');
fs.writeFileSync(manifestPath, manifest);

const javaDir = path.join(root, 'android/app/src/main/java/com/ashrafalkhalq/app');
fs.mkdirSync(javaDir, { recursive: true });
fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), `package com.ashrafalkhalq.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override public void onStart() {
    super.onStart();
    if (getBridge() != null && getBridge().getWebView() != null) {
      getBridge().getWebView().addJavascriptInterface(new NativeControls(), "AshrafAndroid");
    }
  }
  public class NativeControls {
    @JavascriptInterface public void requestNotifications() {
      runOnUiThread(() -> {
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4101);
        else Toast.makeText(MainActivity.this, "الإشعارات مدعومة على هذا الإصدار", Toast.LENGTH_SHORT).show();
      });
    }
    @JavascriptInterface public void requestOverlay() {
      runOnUiThread(() -> {
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(MainActivity.this)) {
          Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
          startActivity(intent);
        } else Toast.makeText(MainActivity.this, "إذن الظهور فوق التطبيقات مفعّل", Toast.LENGTH_SHORT).show();
      });
    }
    @JavascriptInterface public void startBackgroundService() {
      runOnUiThread(() -> {
        Intent intent = new Intent(MainActivity.this, AshrafKeepAliveService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent); else startService(intent);
        Toast.makeText(MainActivity.this, "تم تشغيل خدمة التطبيق", Toast.LENGTH_SHORT).show();
      });
    }
    @JavascriptInterface public void stopBackgroundService() {
      runOnUiThread(() -> stopService(new Intent(MainActivity.this, AshrafKeepAliveService.class)));
    }
  }
}`);

fs.writeFileSync(path.join(javaDir, 'AshrafKeepAliveService.java'), `package com.ashrafalkhalq.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public class AshrafKeepAliveService extends Service {
  private static final String CHANNEL = "ashraf_background";
  @Override public void onCreate() {
    super.onCreate();
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationManager manager = getSystemService(NotificationManager.class);
      manager.createNotificationChannel(new NotificationChannel(CHANNEL, "خدمة أشرف الخلق", NotificationManager.IMPORTANCE_LOW));
      Notification notification = new Notification.Builder(this, CHANNEL)
        .setSmallIcon(getApplicationInfo().icon)
        .setContentTitle("أشرف الخلق")
        .setContentText("خدمة التذكير مفعّلة — يمكنك إيقافها من داخل التطبيق")
        .setOngoing(true)
        .build();
      startForeground(4102, notification);
    }
  }
  @Override public int onStartCommand(Intent intent, int flags, int startId) { return START_STICKY; }
  @Override public IBinder onBind(Intent intent) { return null; }
}`);
console.log('Android permissions, native bridge, and foreground service prepared.');
