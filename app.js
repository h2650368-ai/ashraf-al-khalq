'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const KEY = { count:'ashraf.count.v2', history:'ashraf.history.v2', settings:'ashraf.settings.v2' };
const defaults = { language:'ar', theme:'green', adhanVoice:'system', method:'5', salawat:false, prayerAlerts:true, vibration:true, latitude:'', longitude:'' };
let prefs = loadPrefs(), count = readCount(), history = readHistory(), prayerData = null, recitationQueue = [], recitationIndex = 0;
function loadPrefs(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY.settings)||'{}')}}catch{return {...defaults}}}
function readCount(){const n=Number(localStorage.getItem(KEY.count));return Number.isFinite(n)&&n>=0?n:0}
function readHistory(){try{const v=JSON.parse(localStorage.getItem(KEY.history)||'[]');return Array.isArray(v)?v.filter(x=>x&&typeof x.text==='string'&&Number.isFinite(Number(x.count))):[]}catch{return []}}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function showTab(id){const target=document.getElementById(id);if(!target||!target.classList.contains('view'))return;$$('.view').forEach(v=>v.classList.toggle('active',v===target));$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));if(id==='tasbeeh'){$$('.tas-page').forEach(p=>p.hidden=true);$('#tasbeehMenu').hidden=false}window.scrollTo({top:0,behavior:'smooth'})}
$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
function showTasPage(name){const pages={counter:'#tasCounterPage',dhikr:'#tasDhikrPage',history:'#tasHistoryPage'};$('#tasbeehMenu').hidden=true;Object.values(pages).forEach(sel=>$(sel).hidden=true);if(pages[name])$(pages[name]).hidden=false;window.scrollTo({top:0,behavior:'smooth'});}
$$('[data-tas-page]').forEach(b=>b.addEventListener('click',()=>showTasPage(b.dataset.tasPage)));
$$('.tas-back').forEach(b=>b.addEventListener('click',()=>{$$('.tas-page').forEach(p=>p.hidden=true);$('#tasbeehMenu').hidden=false;window.scrollTo({top:0,behavior:'smooth'})}));
$('#useDhikr').addEventListener('click',()=>{const name=currentDhikr();$('#activeDhikrTitle').textContent=name;showTasPage('counter')});
function applyPrefs(){
 document.documentElement.lang=prefs.language;document.documentElement.dir=prefs.language==='ar'?'rtl':'ltr';document.body.dataset.theme=prefs.theme;
 [['languageSetting',prefs.language],['adhanTheme',prefs.theme],['adhanVoice',prefs.adhanVoice],['calcMethod',prefs.method]].forEach(([id,val])=>{const e=document.getElementById(id);if(e)e.value=val});
 $('#salawatReminder').checked=!!prefs.salawat;$('#prayerAlerts').checked=!!prefs.prayerAlerts;$('#notificationVibration').checked=!!prefs.vibration;
 $('#manualLat').value=prefs.latitude||'';$('#manualLon').value=prefs.longitude||'';
}
function renderCounter(){ $('#count').textContent=count.toLocaleString('ar-EG');const goal=Math.min(100000,Math.max(1,Number($('#goal').value)||100));$('#progressBar').style.width=Math.min(100,count/goal*100)+'%';$('#goalMessage').textContent=count>=goal?'أحسنت، وصلت إلى الهدف. تقبّل الله منك.':'';localStorage.setItem(KEY.count,String(count));}
function renderHistory(){ $('#history').innerHTML=history.length?history.slice(0,10).map(x=>'<div class="history-item">'+esc(x.text)+' — '+Number(x.count).toLocaleString('ar-EG')+' مرة <small>('+new Date(x.date).toLocaleDateString('ar-EG')+')</small></div>').join(''):'لا توجد تسبيحات محفوظة بعد.';}
function saveHistory(){history=history.slice(0,100);localStorage.setItem(KEY.history,JSON.stringify(history))}
function currentDhikr(){return $('#dhikrSelect').value==='custom'?($('#customDhikr').value.trim()||'ذكر مخصص'):$('#dhikrSelect').value}
$('#countBtn').addEventListener('click',()=>{count++;renderCounter();if(prefs.vibration&&$('#vibrate').checked&&navigator.vibrate)navigator.vibrate(15)});
$('#goal').addEventListener('input',renderCounter);
$('#dhikrSelect').addEventListener('change',()=>{$('#customDhikr').hidden=$('#dhikrSelect').value!=='custom'});
$('#resetBtn').addEventListener('click',()=>{if(!count||!confirm('حفظ جلسة الذكر وتصفير العداد؟'))return;history.unshift({text:currentDhikr(),count,date:Date.now()});saveHistory();count=0;renderCounter();renderHistory()});
$('#clearHistory').addEventListener('click',()=>{if(!history.length||!confirm('هل تريد مسح سجل التسبيحات من هذا الجهاز؟'))return;history=[];saveHistory();renderHistory()});
$$('.add-dhikr').forEach(b=>b.addEventListener('click',()=>{showTab('tasbeeh');const o=[...$('#dhikrSelect').options].find(x=>x.value===b.dataset.text||x.text===b.dataset.text);if(o){$('#dhikrSelect').value=o.value;$('#customDhikr').hidden=true}else{$('#dhikrSelect').value='custom';$('#customDhikr').hidden=false;$('#customDhikr').value=b.dataset.text}$('#activeDhikrTitle').textContent=b.dataset.text;showTasPage('counter')}));
renderCounter();renderHistory();
async function loadSurahs(){const s=$('#surahSelect');try{const r=await fetch('https://api.alquran.cloud/v1/surah');if(!r.ok)throw Error();const j=await r.json();if(j.code!==200||!Array.isArray(j.data))throw Error();s.innerHTML=j.data.map(x=>'<option value="'+Number(x.number)+'">'+Number(x.number)+'. '+esc(x.name)+' — '+esc(x.englishName)+'</option>').join('');s.value='1'}catch{s.innerHTML='<option value="">تعذر تحميل السور</option>';$('#quranContent').textContent='تعذر الاتصال بمصدر القرآن. تحقق من الإنترنت.'}}
async function loadSurah(){const n=Number($('#surahSelect').value);if(!Number.isInteger(n)||n<1||n>114)return;$('#quranContent').textContent='جاري تحميل السورة…';try{const r=await fetch('https://api.alquran.cloud/v1/surah/'+n);if(!r.ok)throw Error();const j=await r.json();if(j.code!==200||!Array.isArray(j.data?.ayahs))throw Error();$('#quranContent').innerHTML=j.data.ayahs.map(a=>esc(a.text)+' <span class="ayah">﴿'+Number(a.numberInSurah).toLocaleString('ar-EG')+'﴾</span>').join(' ');await playSurahAudio()}catch{$('#quranContent').textContent='تعذر تحميل السورة. حاول مرة أخرى عند توفر الإنترنت.'}}
const audioDbName='ashraf-audio-v1';
function openAudioDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(audioDbName,1);req.onupgradeneeded=()=>req.result.createObjectStore('surahs',{keyPath:'key'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function getSavedAudio(key){const db=await openAudioDb();return new Promise((resolve,reject)=>{const r=db.transaction('surahs').objectStore('surahs').get(key);r.onsuccess=()=>resolve(r.result?.blob||null);r.onerror=()=>reject(r.error)})}
async function saveAudio(key,blob){const db=await openAudioDb();return new Promise((resolve,reject)=>{const r=db.transaction('surahs','readwrite').objectStore('surahs').put({key,blob,savedAt:Date.now()});r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
function surahAudioUrl(n,edition){return 'https://cdn.islamic.network/quran/audio-surah/128/'+encodeURIComponent(edition)+'/'+n+'.mp3'}
async function playSurahAudio(){const n=Number($('#surahSelect').value);if(!n)return;const edition=$('#reciterSelect').value,key=edition+':'+n;$('#audioLabel').textContent='جاري تجهيز التلاوة…';try{let blob=await getSavedAudio(key);if(blob){const url=URL.createObjectURL(blob);$('#quranAudio').src=url;$('#audioLabel').textContent='تشغيل محفوظ دون إنترنت — '+$('#reciterSelect').selectedOptions[0].textContent;$('#quranAudio').play().catch(()=>{});return}const url=surahAudioUrl(n,edition);$('#quranAudio').src=url;$('#audioLabel').textContent='استماع عبر الإنترنت — '+$('#reciterSelect').selectedOptions[0].textContent;$('#quranAudio').play().catch(()=>{$('#audioLabel').textContent+=' — اضغط تشغيل لبدء الصوت'})}catch{const url=surahAudioUrl(n,edition);$('#quranAudio').src=url;$('#audioLabel').textContent='استماع عبر الإنترنت';}}
$('#downloadSurah').addEventListener('click',async()=>{const n=Number($('#surahSelect').value);if(!n)return;const key=$('#reciterSelect').value+':'+n;$('#downloadSurah').disabled=true;$('#downloadStatus').textContent='جاري تنزيل السورة وحفظها على الجهاز…';try{const r=await fetch(surahAudioUrl(n,$('#reciterSelect').value));if(!r.ok)throw Error();const blob=await r.blob();if(!blob.size)throw Error();await saveAudio(key,blob);$('#downloadStatus').textContent='تم حفظ السورة. ستعمل لاحقًا دون إنترنت على هذا الجهاز.';if($('#quranAudio').getAttribute('src'))await playSurahAudio()}catch{$('#downloadStatus').textContent='لم يكتمل التنزيل. تحقق من الإنترنت ومساحة الجهاز ثم حاول مرة أخرى.'}finally{$('#downloadSurah').disabled=false}});
$('#loadSurah').addEventListener('click',loadSurah);$('#reciterSelect').addEventListener('change',playSurahAudio);
$('#quranAudio').addEventListener('ended',()=>{recitationIndex++;if(recitationIndex<recitationQueue.length){$('#quranAudio').src=recitationQueue[recitationIndex];$('#quranAudio').play().catch(()=>{})}else $('#audioLabel').textContent='انتهت التلاوة. تقبّل الله.'});
loadSurahs();
function validCoords(a,b){return a!==''&&b!==''&&Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a))<=90&&Math.abs(Number(b))<=180}
async function fetchPrayerTimes(lat,lon){
 if(!validCoords(lat,lon))throw Error('invalid coordinates');
 const r=await fetch('https://api.aladhan.com/v1/timings?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&method='+encodeURIComponent(prefs.method));if(!r.ok)throw Error('network');
 const j=await r.json();if(j.code!==200||!j.data?.timings)throw Error('invalid timings');prayerData=j.data;
 const t=j.data.timings, rows=[['الفجر',t.Fajr],['الظهر',t.Dhuhr],['العصر',t.Asr],['المغرب',t.Maghrib],['العشاء',t.Isha]];
 $('#prayerTimes').innerHTML=rows.map(x=>'<div><small>'+x[0]+'</small><b>'+esc(String(x[1]).slice(0,5))+'</b></div>').join('');
 $('#locationText').textContent='تم تحديث المواقيت '+(j.data.date?.readable?'ليوم '+j.data.date.readable:'')+(j.data.meta?.timezone?' — '+j.data.meta.timezone:'')+'.';
 if(prefs.prayerAlerts&&window.AshrafAndroid?.schedulePrayerAlarms)window.AshrafAndroid.schedulePrayerAlarms(JSON.stringify({timings:t,enabled:true,sound:prefs.adhanVoice,vibration:prefs.vibration}));
 return j.data;
}
function locate(){if(!navigator.geolocation){$('#locationText').textContent='تحديد الموقع غير مدعوم.';return}$('#locationText').textContent='جارٍ تحديد موقعك…';navigator.geolocation.getCurrentPosition(async p=>{prefs.latitude=String(p.coords.latitude);prefs.longitude=String(p.coords.longitude);localStorage.setItem(KEY.settings,JSON.stringify(prefs));applyPrefs();try{await fetchPrayerTimes(prefs.latitude,prefs.longitude)}catch{$('#locationText').textContent='تعذر جلب المواقيت. تحقق من الإنترنت.'}},()=>{$('#locationText').textContent='لم يتم السماح بالموقع. أدخل الإحداثيات يدويًا من الإعدادات.'},{enableHighAccuracy:false,timeout:15000,maximumAge:600000})}
$('#locateBtn').addEventListener('click',locate);
function requestNotifications(){if(window.AshrafAndroid?.requestNotifications){window.AshrafAndroid.requestNotifications();return}if(!('Notification'in window)){$('#nativeStatus').textContent='الإشعارات غير مدعومة في هذا المتصفح.';return}Notification.requestPermission().then(p=>{$('#nativeStatus').textContent=p==='granted'?'تم السماح بإشعارات المتصفح؛ الجدولة عند إغلاقه غير مضمونة.':'لم يتم السماح بالإشعارات.'})}
$('#notifyPermission').addEventListener('click',requestNotifications);$('#prayerNotifyBtn').addEventListener('click',requestNotifications);
$('#enablePrayerAlerts').addEventListener('click',()=>{requestNotifications();if(!prefs.latitude||!prefs.longitude){locate();return}fetchPrayerTimes(prefs.latitude,prefs.longitude).then(()=>{$('#nativeStatus').textContent='تم تحديث مواقيت الصلاة وإرسالها لجدولة التنبيهات.'}).catch(()=>{$('#nativeStatus').textContent='تعذر تحديث المواقيت. تحقق من الموقع والإنترنت.'})});

$('#openAdhanBtn').addEventListener('click',()=>{$('#adhanPrayerName').textContent='مواقيت الصلاة';showTab('adhanScreen')});$('#backFromAdhan').addEventListener('click',()=>showTab('home'));
window.onNativePrayerOpen=name=>{$('#adhanPrayerName').textContent='حان الآن موعد صلاة '+String(name||'');showTab('adhanScreen')};
$('#saveSettings').addEventListener('click',async()=>{
 const enteredLat=$('#manualLat').value.trim(),enteredLon=$('#manualLon').value.trim();
 const nextLat=enteredLat||prefs.latitude||'',nextLon=enteredLon||prefs.longitude||'';
 prefs={language:$('#languageSetting').value,theme:$('#adhanTheme').value,adhanVoice:$('#adhanVoice').value,method:$('#calcMethod').value,salawat:$('#salawatReminder').checked,prayerAlerts:$('#prayerAlerts').checked,vibration:$('#notificationVibration').checked,latitude:nextLat,longitude:nextLon};
 if((prefs.latitude||prefs.longitude)&&!validCoords(prefs.latitude,prefs.longitude)){$('#settingsStatus').textContent='أدخل خط العرض والطول بشكل صحيح، أو اتركهما فارغين.';return}
 localStorage.setItem(KEY.settings,JSON.stringify(prefs));applyPrefs();
 if(window.AshrafAndroid?.setSalawatReminder){window.AshrafAndroid.setSalawatReminder(prefs.salawat)}else if(prefs.salawat){$('#settingsStatus').textContent='تم حفظ الاختيار، لكن التذكير الدوري بالصوت متاح في نسخة Android فقط.'}
 if(prefs.prayerAlerts&&validCoords(prefs.latitude,prefs.longitude)){try{await fetchPrayerTimes(prefs.latitude,prefs.longitude);$('#settingsStatus').textContent='تم حفظ الإعدادات وتحديث تنبيهات الصلاة.'}catch{$('#settingsStatus').textContent='حُفظت الإعدادات، لكن تعذر تحديث المواقيت.'}}
 else{if(window.AshrafAndroid?.cancelPrayerAlarms)window.AshrafAndroid.cancelPrayerAlarms();$('#settingsStatus').textContent='تم حفظ الإعدادات على هذا الجهاز.'}
});
applyPrefs();
if(prefs.salawat&&window.AshrafAndroid?.setSalawatReminder)window.AshrafAndroid.setSalawatReminder(true);
if(prefs.prayerAlerts&&validCoords(prefs.latitude,prefs.longitude))fetchPrayerTimes(prefs.latitude,prefs.longitude).catch(()=>{});
let deferredPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});
$('#installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

// Wallpaper cards apply and persist the selected Adhan screen palette.
$$$('[data-wallpaper]').forEach(button=>button.addEventListener('click',()=>{const theme=button.dataset.wallpaper;if(!['green','night','light'].includes(theme))return;prefs.theme=theme;localStorage.setItem(KEY.settings,JSON.stringify(prefs));applyPrefs();$('#settingsStatus').textContent='تم تطبيق خلفية واجهة الأذان وحفظها.';showTab('settings')}));
// Keep the memorial panel graceful if the owner's original photo has not yet been added.
const memorialImage=$('.memorial-photo img');if(memorialImage){memorialImage.addEventListener('error',()=>{const box=memorialImage.parentElement;box.innerHTML='<div class="photo-placeholder"><span>۞</span><b>رحم الله أشرف</b><small>اللهم اغفر له وارحمه</small></div>'},{once:true})}
