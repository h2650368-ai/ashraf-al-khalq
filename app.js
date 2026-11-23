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
      const url = `https://api.aladhan.com/v1/timings?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&method=5`;
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
