'use strict';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const STORAGE = { count: 'ashraf.tasbeeh.count', history: 'ashraf.tasbeeh.history' };

function readNumber(key, fallback = 0) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE.history) || '[]');
    return Array.isArray(value) ? value.filter((item) => item && typeof item.text === 'string' && Number.isFinite(Number(item.count))) : [];
  } catch {
    return [];
  }
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function showTab(id) {
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === id));
  $$('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$$('[data-tab]').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.tab)));

let count = readNumber(STORAGE.count);
let history = readHistory();
function currentDhikr() {
  const select = $('#dhikrSelect');
  return select.value === 'custom' ? ($('#customDhikr').value.trim() || 'ذكر مخصص') : select.value;
}
function renderCounter() {
  $('#count').textContent = count.toLocaleString('ar-EG');
  const goal = Math.min(100000, Math.max(1, Number($('#goal').value) || 100));
  $('#progressBar').style.width = `${Math.min(100, (count / goal) * 100)}%`;
  $('#goalMessage').textContent = count >= goal ? 'أحسنت، وصلت إلى الهدف. تقبّل الله منك.' : '';
  localStorage.setItem(STORAGE.count, String(count));
}
function renderHistory() {
  $('#history').innerHTML = history.length
    ? history.slice(0, 8).map((item) => `<div class="history-item">${escapeHtml(item.text)} — ${Number(item.count).toLocaleString('ar-EG')} مرة <small>(${new Date(item.date).toLocaleDateString('ar-EG')})</small></div>`).join('')
    : 'لا توجد تسبيحات محفوظة بعد.';
}
function saveHistory() {
  history = history.slice(0, 100);
  localStorage.setItem(STORAGE.history, JSON.stringify(history));
}

$('#countBtn').addEventListener('click', () => {
  count += 1;
  renderCounter();
  if ($('#vibrate').checked && typeof navigator.vibrate === 'function') navigator.vibrate(15);
});
$('#goal').addEventListener('input', renderCounter);
$('#dhikrSelect').addEventListener('change', () => {
  $('#customDhikr').hidden = $('#dhikrSelect').value !== 'custom';
});
$('#resetBtn').addEventListener('click', () => {
  if (!count || !window.confirm('حفظ جلسة الذكر وتصفير العداد؟')) return;
  history.unshift({ text: currentDhikr(), count, date: Date.now() });
  saveHistory();
  count = 0;
  renderCounter();
  renderHistory();
});
$('#clearHistory').addEventListener('click', () => {
  if (!history.length || !window.confirm('هل تريد مسح سجل التسبيحات المحفوظ على هذا الجهاز؟')) return;
  history = [];
  saveHistory();
  renderHistory();
});
$$('.add-dhikr').forEach((button) => button.addEventListener('click', () => {
  showTab('tasbeeh');
  const option = [...$('#dhikrSelect').options].find((item) => item.value === button.dataset.text || item.text === button.dataset.text);
  if (option) {
    $('#dhikrSelect').value = option.value;
    $('#customDhikr').hidden = true;
  } else {
    $('#dhikrSelect').value = 'custom';
    $('#customDhikr').hidden = false;
    $('#customDhikr').value = button.dataset.text;
  }
}));
renderCounter();
renderHistory();

async function loadSurahs() {
  const select = $('#surahSelect');
  try {
    const response = await fetch('https://api.alquran.cloud/v1/surah');
    if (!response.ok) throw new Error('Network response was not ok');
    const json = await response.json();
    if (json.code !== 200 || !Array.isArray(json.data)) throw new Error('Invalid Quran response');
    select.innerHTML = json.data.map((surah) => `<option value="${Number(surah.number)}">${Number(surah.number)}. ${escapeHtml(surah.name)} — ${escapeHtml(surah.englishName)}</option>`).join('');
    select.value = '1';
    await loadSurah();
  } catch {
    select.innerHTML = '<option value="">تعذر تحميل السور</option>';
    $('#quranContent').textContent = 'تعذر الاتصال بمصدر القرآن. تحقق من الإنترنت وحاول مرة أخرى.';
  }
}
async function loadSurah() {
  const number = Number($('#surahSelect').value);
  if (!Number.isInteger(number) || number < 1 || number > 114) return;
  $('#quranContent').textContent = 'جاري تحميل السورة…';
  try {
    const response = await fetch(`https://api.alquran.cloud/v1/surah/${number}`);
    if (!response.ok) throw new Error('Network response was not ok');
    const json = await response.json();
    if (json.code !== 200 || !json.data || !Array.isArray(json.data.ayahs)) throw new Error('Invalid surah response');
    $('#quranContent').innerHTML = json.data.ayahs.map((ayah) => `${escapeHtml(ayah.text)} <span class="ayah">﴿${Number(ayah.numberInSurah).toLocaleString('ar-EG')}﴾</span>`).join(' ');
  } catch {
    $('#quranContent').textContent = 'تعذر تحميل السورة. حاول مرة أخرى عند توفر الإنترنت.';
  }
}
$('#loadSurah').addEventListener('click', loadSurah);
loadSurahs();

$('#locateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    $('#locationText').textContent = 'المتصفح لا يدعم تحديد الموقع.';
    return;
  }
  $('#locationText').textContent = 'جارٍ تحديد الموقع…';
  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const { latitude, longitude } = position.coords;
      const url = `https://api.aladhan.com/v1/timings?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&method=${encodeURIComponent(prefs.method || "5")}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Prayer API unavailable');
      const json = await response.json();
      const timings = json.data && json.data.timings;
      if (!timings) throw new Error('Invalid prayer response');
      const prayers = [['الفجر', timings.Fajr], ['الظهر', timings.Dhuhr], ['العصر', timings.Asr], ['المغرب', timings.Maghrib], ['العشاء', timings.Isha]];
      $('#prayerTimes').innerHTML = prayers.map(([name, time]) => `<div><small>${name}</small><b>${escapeHtml(time)}</b></div>`).join('');
      $('#locationText').textContent = 'تم تحديد المواقيت حسب موقعك. راجع طريقة الحساب المعتمدة في منطقتك.';
    } catch {
      $('#locationText').textContent = 'تعذر جلب المواقيت. تحقق من الإنترنت وحاول لاحقًا.';
    }
  }, () => {
    $('#locationText').textContent = 'لم يتم منح إذن الموقع. يمكنك المحاولة مرة أخرى.';
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
});

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('#installBtn').hidden = true;
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

 
// Native Android controls are available only in the installed APK.
const nativeStatus = $('#nativeStatus');
function callAndroid(method, unavailableMessage) {
  if (window.AshrafAndroid && typeof window.AshrafAndroid[method] === 'function') {
    window.AshrafAndroid[method]();
    nativeStatus.textContent = 'تم إرسال طلب الإذن إلى إعدادات Android. أكمل الموافقة من شاشة النظام.';
  } else {
    nativeStatus.textContent = unavailableMessage || 'هذه الخاصية متاحة في نسخة Android المثبتة فقط، وليست في المتصفح.';
  }
}
$('#notifyPermission').addEventListener('click', () => callAndroid('requestNotifications'));
$('#overlayPermission').addEventListener('click', () => callAndroid('requestOverlay'));
$('#backgroundService').addEventListener('click', () => callAndroid('startBackgroundService', 'خدمة الخلفية ستعمل بعد تثبيت APK؛ المتصفح لا يستطيع تشغيل خدمة Android.'));
$('#stopBackgroundService').addEventListener('click', () => callAndroid('stopBackgroundService'));


// User settings and prayer/Quran experience
const PREF_KEY = 'ashraf.settings.v1';
const defaultPrefs = { language:'ar', theme:'green', adhanVoice:'makkah', method:'5', salawat:false, vibration:true, latitude:'', longitude:'' };
function loadPrefs(){ try { return {...defaultPrefs,...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}; } catch { return {...defaultPrefs}; } }
let prefs = loadPrefs();
function applyPrefs(){
  document.documentElement.lang = prefs.language;
  document.documentElement.dir = prefs.language === 'ar' ? 'rtl' : 'ltr';
  document.body.dataset.theme = prefs.theme;
  $('#languageSetting').value=prefs.language; $('#adhanTheme').value=prefs.theme;
  $('#adhanVoice').value=prefs.adhanVoice; $('#calcMethod').value=prefs.method;
  $('#salawatReminder').checked=!!prefs.salawat; $('#notificationVibration').checked=!!prefs.vibration;
  $('#manualLat').value=prefs.latitude; $('#manualLon').value=prefs.longitude;
}
applyPrefs();
$('#saveSettings').addEventListener('click',()=>{
  prefs={language:$('#languageSetting').value,theme:$('#adhanTheme').value,adhanVoice:$('#adhanVoice').value,method:$('#calcMethod').value,salawat:$('#salawatReminder').checked,vibration:$('#notificationVibration').checked,latitude:$('#manualLat').value.trim(),longitude:$('#manualLon').value.trim()};
  localStorage.setItem(PREF_KEY,JSON.stringify(prefs)); applyPrefs();
  $('#settingsStatus').textContent='تم حفظ الإعدادات على هذا الجهاز.';
  if(window.AshrafAndroid?.setReminderEnabled) window.AshrafAndroid.setReminderEnabled(prefs.salawat);
});
$('#openAdhanBtn').addEventListener('click',()=>{ $('#adhanPrayerName').textContent='مواقيت الصلاة'; showTab('adhanScreen'); });
$('#backFromAdhan').addEventListener('click',()=>showTab('home'));
$('#prayerNotifyBtn').addEventListener('click',async()=>{
  if(!('Notification' in window)){ $('#nativeStatus').textContent='الإشعارات غير مدعومة في هذا الجهاز.'; return; }
  const permission=await Notification.requestPermission();
  $('#nativeStatus').textContent=permission==='granted'?'تم السماح بإشعارات التطبيق. جدولة الأذان بالخلفية تتطلب نسخة Android الأصلية.':'لم يتم السماح بالإشعارات.';
  if(window.AshrafAndroid?.requestNotifications) window.AshrafAndroid.requestNotifications();
});
const originalLocate=$('#locateBtn').onclick;
$('#locateBtn').addEventListener('click',()=>{ /* location request remains user initiated */ });
async function refreshPrayerTimes(latitude,longitude){
  const url='https://api.aladhan.com/v1/timings?latitude='+encodeURIComponent(latitude)+'&longitude='+encodeURIComponent(longitude)+'&method='+encodeURIComponent(prefs.method);
  const response=await fetch(url); if(!response.ok) throw new Error('prayer api');
  const json=await response.json(); if(!json.data?.timings) throw new Error('invalid timings');
  const t=json.data.timings; const entries=[['الفجر',t.Fajr],['الظهر',t.Dhuhr],['العصر',t.Asr],['المغرب',t.Maghrib],['العشاء',t.Isha]];
  $('#prayerTimes').innerHTML=entries.map(([n,v])=>'<div><small>'+n+'</small><b>'+escapeHtml(v)+'</b></div>').join('');
  $('#locationText').textContent='تم تحديث المواقيت حسب الإعدادات.';
}
$('#saveSettings').addEventListener('click',async()=>{
  if(prefs.latitude && prefs.longitude && Number.isFinite(Number(prefs.latitude)) && Number.isFinite(Number(prefs.longitude))){
    try{await refreshPrayerTimes(prefs.latitude,prefs.longitude);}catch{$('#settingsStatus').textContent='حُفظت الإعدادات، لكن تعذر تحديث المواقيت. تحقق من الإحداثيات والإنترنت.';}
  }
});
$('#reciterSelect').addEventListener('change',()=>playSurahAudio());
async function playSurahAudio(){
  const number=Number($('#surahSelect').value); if(!number) return;
  const edition=$('#reciterSelect').value;
  $('#audioLabel').textContent='جاري تجهيز التلاوة…';
  try{
    const response=await fetch('https://api.alquran.cloud/v1/surah/'+number+'/'+encodeURIComponent(edition));
    if(!response.ok) throw new Error('audio api');
    const json=await response.json(); const first=json.data?.ayahs?.[0]?.audio;
    if(!first) throw new Error('no audio');
    $('#quranAudio').src=first; $('#audioLabel').textContent='تلاوة السورة — '+$('#reciterSelect').selectedOptions[0].textContent;
  }catch{$('#audioLabel').textContent='تعذر تحميل التلاوة حاليًا.';}
}
const previousLoadSurah=$('#loadSurah').onclick;
$('#loadSurah').addEventListener('click',()=>playSurahAudio());
