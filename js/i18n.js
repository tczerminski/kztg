var SUPPORTED_LANGS = ['pl', 'en', 'uk', 'ta'];
var LANG_STORAGE_KEY = 'kztg-lang';

var translations = {
  pl: {
    'page.title': 'Kościół Zmartwychwstałego w Tarnowskich Górach | Kościół Zmartwychwstałego w Tarnowskich Górach',
    'site.name': 'Kościół Zmartwychwstałego w Tarnowskich Górach',
    'site.name.mobile': 'Kościół Zmartwychwstałego<br />w<br />Tarnowskich Górach',
    'radio.label': 'Radio Internetowe',
    'radio.heading': 'Słuchaj o dowolnej porze',
    'radio.desc': 'Muzyka uwielbieniowa, kazania oraz transmisje na żywo z Tarnowskich Gór. Pozostań w kontakcie z naszym zgromadzeniem, niezależnie od miejsca i czasu.',
    'radio.live': 'Transmisja na żywo',
    'radio.playAriaLabel': 'Odtwórz lub zatrzymaj transmisję na żywo',
    'services.label': 'Nabożeństwa',
    'services.heading': 'Spotkajmy się',
    'services.sunday': 'Niedziela',
    'services.wednesday': 'Środa',
    'scroll.down': 'Przewiń w dół',
    'sermons.label': 'Kazania',
    'sermons.heading': 'Ostatnie kazania',
    'sermons.desc': 'Posłuchaj najnowszych kazań z naszych nabożeństw.',
    'sermons.searchLabel': 'Szukaj kazań',
    'sermons.searchPlaceholder': 'Szukaj kazania...',
    'sermons.noTitle': 'Brak tytułu',
    'sermons.play': 'Odtwórz kazanie',
    'sermons.progress': 'Postęp odtwarzania kazania',
    'sermons.cover': 'Okładka kazania',
    'sermons.newer': '← Nowsze',
    'sermons.older': 'Starsze →',
    'sermons.page': 'Strona {page} z {total}',
    'sermons.noResults': 'Brak wyników wyszukiwania.',
    'donations.label': 'Wsparcie',
    'donations.heading': 'Przekaż darowiznę',
    'donations.desc': 'Twoje wsparcie pomaga nam głosić Ewangelię i służyć społeczności. Dziękujemy za Wasze darowizny!',
    'donations.recipient': 'Odbiorca',
    'donations.account': 'Numer konta',
    'donations.transferTitle': 'Tytuł przelewu',
    'donations.purpose': 'Darowizna na cele Kościoła',
    'contact.label': 'Kontakt',
    'contact.heading': 'Pozostańmy w kontakcie',
    'contact.desc': 'Napisz do nas lub odwiedź nas podczas najbliższego nabożeństwa.',
    'contact.nameLabel': 'Imię i nazwisko',
    'contact.namePlaceholder': 'Jan Kowalski',
    'contact.emailLabel': 'E-mail',
    'contact.emailPlaceholder': 'twoj@email.pl',
    'contact.messageLabel': 'Wiadomość',
    'contact.messagePlaceholder': 'W czym możemy pomóc?',
    'contact.success': '✓ Wiadomość wysłana! Odezwiemy się wkrótce.',
    'contact.error': '✗ Coś poszło nie tak. Spróbuj ponownie lub napisz bezpośrednio na <a href="mailto:info@kztg.pl" class="underline">info@kztg.pl</a>.',
    'contact.submit': 'Wyślij wiadomość',
    'contact.sending': 'Wysyłanie...',
    'contact.sendError': 'Błąd wysyłki',
    'contact.mapNav': 'Nawiguj w Google Maps',
    'contact.mapCookieTitle': 'Mapa Google wymaga opcjonalnych cookie',
    'contact.mapCookieDesc': 'Jeśli się nie zgadzasz, mapa nie zostanie załadowana. Nadal możesz użyć przycisku nawigacji poniżej.',
    'contact.mapAccept': 'Akceptuj i pokaż mapę',
    'contact.mapIframeTitle': 'Mapa Google',
    'footer.copyright': '© 2026 Kościół Zmartwychwstałego w Tarnowskich Górach',
    'cookie.settings': 'Zmień ustawienia cookie',
    'cookie.bannerTitle': 'Używamy plików cookie',
    'cookie.bannerDesc': 'Korzystamy z niezbędnych cookie do działania strony oraz opcjonalnych (np. mapa Google), aby ją ulepszać.',
    'cookie.reject': 'Nie zgadzam się',
    'cookie.accept': 'Akceptuję',
  },
  en: {
    'page.title': 'Church of the Risen One in Tarnowskie Góry | Church of the Risen One in Tarnowskie Góry',
    'site.name': 'Church of the Risen One in Tarnowskie Góry',
    'site.name.mobile': 'Church of the Risen One<br />in Tarnowskie Góry',
    'radio.label': 'Internet Radio',
    'radio.heading': 'Listen anytime',
    'radio.desc': 'Worship music, sermons and live streams from Tarnowskie Góry. Stay connected with our congregation, wherever you are.',
    'radio.live': 'Live Stream',
    'radio.playAriaLabel': 'Play or pause the live stream',
    'services.label': 'Services',
    'services.heading': "Let's meet",
    'services.sunday': 'Sunday',
    'services.wednesday': 'Wednesday',
    'scroll.down': 'Scroll down',
    'sermons.label': 'Sermons',
    'sermons.heading': 'Latest Sermons',
    'sermons.desc': 'Listen to the latest sermons from our services.',
    'sermons.searchLabel': 'Search sermons',
    'sermons.searchPlaceholder': 'Search sermon...',
    'sermons.noTitle': 'No title',
    'sermons.play': 'Play sermon',
    'sermons.progress': 'Sermon playback progress',
    'sermons.cover': 'Sermon cover',
    'sermons.newer': '← Newer',
    'sermons.older': 'Older →',
    'sermons.page': 'Page {page} of {total}',
    'sermons.noResults': 'No search results.',
    'donations.label': 'Support',
    'donations.heading': 'Make a donation',
    'donations.desc': 'Your support helps us spread the Gospel and serve the community. Thank you for your donations!',
    'donations.recipient': 'Recipient',
    'donations.account': 'Account number',
    'donations.transferTitle': 'Transfer title',
    'donations.purpose': 'Donation for Church purposes',
    'contact.label': 'Contact',
    'contact.heading': "Let's stay in touch",
    'contact.desc': 'Write to us or visit us at our next service.',
    'contact.nameLabel': 'Full name',
    'contact.namePlaceholder': 'John Smith',
    'contact.emailLabel': 'E-mail',
    'contact.emailPlaceholder': 'your@email.com',
    'contact.messageLabel': 'Message',
    'contact.messagePlaceholder': 'How can we help you?',
    'contact.success': "✓ Message sent! We'll get back to you soon.",
    'contact.error': '✗ Something went wrong. Please try again or write directly to <a href="mailto:info@kztg.pl" class="underline">info@kztg.pl</a>.',
    'contact.submit': 'Send message',
    'contact.sending': 'Sending...',
    'contact.sendError': 'Send error',
    'contact.mapNav': 'Navigate in Google Maps',
    'contact.mapCookieTitle': 'Google Maps requires optional cookies',
    'contact.mapCookieDesc': 'If you disagree, the map will not be loaded. You can still use the navigation button below.',
    'contact.mapAccept': 'Accept and show map',
    'contact.mapIframeTitle': 'Google Map',
    'footer.copyright': '© 2026 Church of the Risen One in Tarnowskie Góry',
    'cookie.settings': 'Change cookie settings',
    'cookie.bannerTitle': 'We use cookies',
    'cookie.bannerDesc': 'We use necessary cookies for the site to work and optional cookies (e.g. Google Maps) to improve it.',
    'cookie.reject': 'I disagree',
    'cookie.accept': 'Accept',
  },
  uk: {
    'page.title': 'Церква Воскреслого в Тарновських Горах | Церква Воскреслого в Тарновських Горах',
    'site.name': 'Церква Воскреслого в Тарновських Горах',
    'site.name.mobile': 'Церква Воскреслого<br />в Тарновських Горах',
    'radio.label': 'Інтернет-радіо',
    'radio.heading': 'Слухайте будь-коли',
    'radio.desc': "Музика прославлення, проповіді та пряма трансляція з Тарновських Гір. Залишайтесь на зв'язку з нашою громадою, незалежно від місця і часу.",
    'radio.live': 'Пряма трансляція',
    'radio.playAriaLabel': 'Відтворити або зупинити пряму трансляцію',
    'services.label': 'Богослужіння',
    'services.heading': 'Зустрінемось',
    'services.sunday': 'Неділя',
    'services.wednesday': 'Середа',
    'scroll.down': 'Прокрутіть вниз',
    'sermons.label': 'Проповіді',
    'sermons.heading': 'Останні проповіді',
    'sermons.desc': 'Послухайте найновіші проповіді з наших богослужінь.',
    'sermons.searchLabel': 'Пошук проповідей',
    'sermons.searchPlaceholder': 'Пошук проповіді...',
    'sermons.noTitle': 'Без назви',
    'sermons.play': 'Відтворити проповідь',
    'sermons.progress': 'Прогрес відтворення проповіді',
    'sermons.cover': 'Обкладинка проповіді',
    'sermons.newer': '← Новіші',
    'sermons.older': 'Старіші →',
    'sermons.page': 'Сторінка {page} з {total}',
    'sermons.noResults': 'Немає результатів пошуку.',
    'donations.label': 'Підтримка',
    'donations.heading': 'Зробити пожертву',
    'donations.desc': 'Ваша підтримка допомагає нам проповідувати Євангеліє і служити громаді. Дякуємо за ваші пожертви!',
    'donations.recipient': 'Одержувач',
    'donations.account': 'Номер рахунку',
    'donations.transferTitle': 'Призначення платежу',
    'donations.purpose': 'Пожертва для цілей Церкви',
    'contact.label': 'Контакт',
    'contact.heading': "Залишаймося на зв'язку",
    'contact.desc': 'Напишіть нам або відвідайте нас під час найближчого богослужіння.',
    'contact.nameLabel': "Ім'я та прізвище",
    'contact.namePlaceholder': 'Іван Іваненко',
    'contact.emailLabel': 'E-mail',
    'contact.emailPlaceholder': 'вашпошта@email.com',
    'contact.messageLabel': 'Повідомлення',
    'contact.messagePlaceholder': 'Як ми можемо допомогти?',
    'contact.success': '✓ Повідомлення надіслано! Незабаром відповімо.',
    'contact.error': '✗ Щось пішло не так. Спробуйте ще раз або напишіть безпосередньо на <a href="mailto:info@kztg.pl" class="underline">info@kztg.pl</a>.',
    'contact.submit': 'Надіслати повідомлення',
    'contact.sending': 'Надсилання...',
    'contact.sendError': 'Помилка надсилання',
    'contact.mapNav': 'Навігація в Google Maps',
    'contact.mapCookieTitle': "Google Maps потребує необов'язкових cookie",
    'contact.mapCookieDesc': 'Якщо ви не погоджуєтесь, карта не буде завантажена. Ви все одно можете скористатися кнопкою навігації нижче.',
    'contact.mapAccept': 'Прийняти і показати карту',
    'contact.mapIframeTitle': 'Карта Google',
    'footer.copyright': '© 2026 Церква Воскреслого в Тарновських Горах',
    'cookie.settings': 'Змінити налаштування cookie',
    'cookie.bannerTitle': 'Ми використовуємо файли cookie',
    'cookie.bannerDesc': 'Ми використовуємо необхідні cookie для роботи сайту та необов\'язкові (наприклад, Google Maps) для його покращення.',
    'cookie.reject': 'Не погоджуюсь',
    'cookie.accept': 'Приймаю',
  },
  ta: {
    'page.title': 'டர்னோவ்ஸ்கி கோரியில் உயிர்த்தெழுந்தவர் திருச்சபை | டர்னோவ்ஸ்கி கோரியில் உயிர்த்தெழுந்தவர் திருச்சபை',
    'site.name': 'டர்னோவ்ஸ்கி கோரியில் உயிர்த்தெழுந்தவர் திருச்சபை',
    'site.name.mobile': 'டர்னோவ்ஸ்கி கோரியில்<br />உயிர்த்தெழுந்தவர் திருச்சபை',
    'radio.label': 'இணைய வானொலி',
    'radio.heading': 'எந்நேரமும் கேளுங்கள்',
    'radio.desc': 'டர்னோவ்ஸ்கி கோரியிலிருந்து வழிபாட்டு இசை, பிரசங்கங்கள் மற்றும் நேரடி ஒளிபரப்பு. எங்கிருந்தாலும் எங்கள் சபையுடன் தொடர்பில் இருங்கள்.',
    'radio.live': 'நேரடி ஒளிபரப்பு',
    'radio.playAriaLabel': 'நேரடி ஒளிபரப்பை இயக்கு அல்லது நிறுத்து',
    'services.label': 'வழிபாட்டு நேரங்கள்',
    'services.heading': 'சந்திப்போம்',
    'services.sunday': 'ஞாயிறு',
    'services.wednesday': 'புதன்',
    'scroll.down': 'கீழே உருட்டுங்கள்',
    'sermons.label': 'பிரசங்கங்கள்',
    'sermons.heading': 'சமீபத்திய பிரசங்கங்கள்',
    'sermons.desc': 'எங்கள் வழிபாட்டிலிருந்து சமீபத்திய பிரசங்கங்களைக் கேளுங்கள்.',
    'sermons.searchLabel': 'பிரசங்கங்களை தேடுங்கள்',
    'sermons.searchPlaceholder': 'பிரசங்கம் தேடு...',
    'sermons.noTitle': 'தலைப்பு இல்லை',
    'sermons.play': 'பிரசங்கத்தை இயக்கு',
    'sermons.progress': 'பிரசங்க இயக்க முன்னேற்றம்',
    'sermons.cover': 'பிரசங்க அட்டை',
    'sermons.newer': '← புதியவை',
    'sermons.older': 'பழையவை →',
    'sermons.page': 'பக்கம் {page} / {total}',
    'sermons.noResults': 'தேடல் முடிவுகள் இல்லை.',
    'donations.label': 'ஆதரவு',
    'donations.heading': 'நன்கொடை வழங்குங்கள்',
    'donations.desc': 'உங்கள் ஆதரவு நற்செய்தியை பிரசங்கிக்க மற்றும் சமுதாயத்திற்கு சேவை செய்ய உதவுகிறது. உங்கள் நன்கொடைகளுக்கு நன்றி!',
    'donations.recipient': 'பெறுநர்',
    'donations.account': 'கணக்கு எண்',
    'donations.transferTitle': 'பரிமாற்ற தலைப்பு',
    'donations.purpose': 'திருச்சபை நோக்கங்களுக்கான நன்கொடை',
    'contact.label': 'தொடர்பு',
    'contact.heading': 'தொடர்பில் இருப்போம்',
    'contact.desc': 'எங்களுக்கு எழுதுங்கள் அல்லது அடுத்த வழிபாட்டின்போது வாருங்கள்.',
    'contact.nameLabel': 'பெயர்',
    'contact.namePlaceholder': 'உங்கள் பெயர்',
    'contact.emailLabel': 'மின்னஞ்சல்',
    'contact.emailPlaceholder': 'உங்கள்@email.com',
    'contact.messageLabel': 'செய்தி',
    'contact.messagePlaceholder': 'உங்களுக்கு எவ்வாறு உதவலாம்?',
    'contact.success': '✓ செய்தி அனுப்பப்பட்டது! விரைவில் பதில் அளிப்போம்.',
    'contact.error': '✗ ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும் அல்லது நேரடியாக <a href="mailto:info@kztg.pl" class="underline">info@kztg.pl</a> என்ற முகவரியில் எழுதவும்.',
    'contact.submit': 'செய்தி அனுப்பு',
    'contact.sending': 'அனுப்புகிறது...',
    'contact.sendError': 'அனுப்பு பிழை',
    'contact.mapNav': 'Google Maps இல் வழிசெலுத்துங்கள்',
    'contact.mapCookieTitle': 'Google Maps விருப்பத்தேர்வு குக்கீகளை தேவைப்படுகிறது',
    'contact.mapCookieDesc': 'நீங்கள் ஒப்புக்கொள்ளவில்லை என்றால், வரைபடம் ஏற்றப்படாது. கீழே உள்ள வழிசெலுத்தல் பொத்தானை பயன்படுத்தலாம்.',
    'contact.mapAccept': 'ஏற்றுக்கொண்டு வரைபடம் காட்டு',
    'contact.mapIframeTitle': 'Google வரைபடம்',
    'footer.copyright': '© 2026 டர்னோவ்ஸ்கி கோரியில் உயிர்த்தெழுந்தவர் திருச்சபை',
    'cookie.settings': 'குக்கி அமைப்புகளை மாற்றுங்கள்',
    'cookie.bannerTitle': 'நாங்கள் குக்கீகளை பயன்படுத்துகிறோம்',
    'cookie.bannerDesc': 'தளம் செயல்படுவதற்கு தேவையான குக்கீகளையும் மேம்படுத்துவதற்கு விருப்பத்தேர்வான குக்கீகளையும் (எ.கா. Google Maps) பயன்படுத்துகிறோம்.',
    'cookie.reject': 'ஒப்புக்கொள்ளவில்லை',
    'cookie.accept': 'ஏற்றுக்கொள்கிறேன்',
  },
};

function detectLang() {
  try {
    var saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && translations[saved]) {
      return saved;
    }
  } catch (e) { /* ignore */ }

  var browser = (navigator.language || '').split('-')[0].toLowerCase();
  if (translations[browser]) {
    return browser;
  }

  return 'pl';
}

var currentLang = detectLang();

function t(key, vars) {
  var str = (translations[currentLang] && translations[currentLang][key])
    || translations.pl[key]
    || key;

  if (vars) {
    str = str.replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] !== undefined ? vars[k] : '{' + k + '}';
    });
  }

  return str;
}

function loadTamilFont() {
  if (document.querySelector('link[data-tamil-font]')) {
    return;
  }
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;600&display=swap';
  link.dataset.tamilFont = '1';
  document.head.appendChild(link);
}

function applyTranslations() {
  document.title = t('page.title');
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    el.textContent = t(el.getAttribute('data-i18n'));
  });

  document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
  });

  document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });

  updateLangSwitcher();
  document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: currentLang } }));
}

function updateLangSwitcher() {
  document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
    var isActive = btn.getAttribute('data-lang-btn') === currentLang;
    btn.classList.toggle('lang-btn--active', isActive);
    btn.setAttribute('aria-current', isActive ? 'true' : 'false');
  });
}

function setLang(lang) {
  if (!translations[lang]) {
    return;
  }
  currentLang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (e) { /* ignore */ }

  if (lang === 'ta') {
    loadTamilFont();
  }

  applyTranslations();
}

if (currentLang === 'ta') {
  loadTamilFont();
}

applyTranslations();

window.i18n = { t: t, setLang: setLang, currentLang: function () { return currentLang; } };
