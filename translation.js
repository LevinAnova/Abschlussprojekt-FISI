// Spezielle Sonderzeichen und Schriftgrößenanpassungen für Sprachen mit nicht-lateinischen Alphabeten
const fontSizeAdjustments = {
    ar: {
      title: '1.8rem',
      buttons: '0.9rem',
      text: '0.95rem'
    },
    ru: {
      title: '1.9rem',
      buttons: '0.85rem',
      text: '0.95rem'
    }
  };
  
  // Übersetzungen für die gesamte Seite
  const translations = {
    de: {
      pageTitle: "Volkswagen Ausbildungsberufe",
      backToHome: "Zurück zur Startseite",
      headerTitle: "Ausbildungsberufe",
      loadingText: "Daten werden geladen...",
      footerText: "© Volkswagen AG 2025 | Ausbildungsberufe",
      // Inaktivitätswarnung
      inactivityWarningTitle: "Aufgrund von Inaktivität werden Sie zur Startseite weitergeleitet.",
      stayButtonText: "Auf dieser Seite bleiben",
      // Detailseite
      detailCategory: "Kategorie",
      applyDirect: "Direkt bewerben",
      scanQR: "Scanne den QR-Code, um dich für diesen Ausbildungsberuf zu bewerben.",
      descriptionTitle: "Beschreibung",
      durationTitle: "Ausbildungsdauer",
      requirementsTitle: "Anforderungen",
      careerTitle: "Karrieremöglichkeiten",
      locationsTitle: "Standorte",
      noInfo: "Keine Angaben",
      // Filterkategorien
      allCategories: "Alle",
      productTechnic: "Produkt & Technik",
      itElectronics: "IT & Elektronik",
      service: "Service",
      organization: "Organisation",
      protectionSafety: "Schutz & Sicherheit",
      // Sonstiges
      duration: "Ausbildungsdauer:"
    },
    en: {
      pageTitle: "Volkswagen Apprenticeships",
      backToHome: "Back to Homepage",
      headerTitle: "Apprenticeships",
      loadingText: "Loading data...",
      footerText: "© Volkswagen AG 2025 | Apprenticeships",
      // Inactivity warning
      inactivityWarningTitle: "Due to inactivity, you will be redirected to the homepage.",
      stayButtonText: "Stay on this page",
      // Detail page
      detailCategory: "Category",
      applyDirect: "Apply directly",
      scanQR: "Scan the QR code to apply for this apprenticeship.",
      descriptionTitle: "Description",
      durationTitle: "Training Duration",
      requirementsTitle: "Requirements",
      careerTitle: "Career Options",
      locationsTitle: "Locations",
      noInfo: "No information available",
      // Filter categories
      allCategories: "All",
      productTechnic: "Product & Technology",
      itElectronics: "IT & Electronics",
      service: "Service",
      organization: "Organization",
      protectionSafety: "Protection & Safety",
      // Other
      duration: "Training duration:"
    },
    fr: {
      pageTitle: "Formations en Apprentissage Volkswagen",
      backToHome: "Retour à l'Accueil",
      headerTitle: "Formations en Apprentissage",
      loadingText: "Chargement des données...",
      footerText: "© Volkswagen AG 2025 | Formations en Apprentissage",
      // Inactivity warning
      inactivityWarningTitle: "En raison d'inactivité, vous serez redirigé vers la page d'accueil.",
      stayButtonText: "Rester sur cette page",
      // Detail page
      detailCategory: "Catégorie",
      applyDirect: "Postuler directement",
      scanQR: "Scannez le code QR pour postuler à cette formation.",
      descriptionTitle: "Description",
      durationTitle: "Durée de Formation",
      requirementsTitle: "Prérequis",
      careerTitle: "Opportunités de Carrière",
      locationsTitle: "Emplacements",
      noInfo: "Aucune information disponible",
      // Filter categories
      allCategories: "Tous",
      productTechnic: "Produit & Technique",
      itElectronics: "IT & Électronique",
      service: "Service",
      organization: "Organisation",
      protectionSafety: "Protection & Sécurité",
      // Other
      duration: "Durée de formation:"
    },
    es: {
      pageTitle: "Formación Profesional en Volkswagen",
      backToHome: "Volver a Inicio",
      headerTitle: "Formación Profesional",
      loadingText: "Cargando datos...",
      footerText: "© Volkswagen AG 2025 | Formación Profesional",
      // Inactivity warning
      inactivityWarningTitle: "Por inactividad, será redirigido a la página de inicio.",
      stayButtonText: "Permanecer en esta página",
      // Detail page
      detailCategory: "Categoría",
      applyDirect: "Solicitar directamente",
      scanQR: "Escanea el código QR para solicitar esta formación profesional.",
      descriptionTitle: "Descripción",
      durationTitle: "Duración de la Formación",
      requirementsTitle: "Requisitos",
      careerTitle: "Opciones de Carrera",
      locationsTitle: "Ubicaciones",
      noInfo: "No hay información disponible",
      // Filter categories
      allCategories: "Todos",
      productTechnic: "Producto y Técnica",
      itElectronics: "IT y Electrónica",
      service: "Servicio",
      organization: "Organización",
      protectionSafety: "Protección y Seguridad",
      // Other
      duration: "Duración de formación:"
    },
    it: {
      pageTitle: "Apprendistato Volkswagen",
      backToHome: "Torna alla Home",
      headerTitle: "Programmi di Apprendistato",
      loadingText: "Caricamento dati...",
      footerText: "© Volkswagen AG 2025 | Apprendistato",
      // Inactivity warning
      inactivityWarningTitle: "A causa di inattività, sarai reindirizzato alla homepage.",
      stayButtonText: "Rimani su questa pagina",
      // Detail page
      detailCategory: "Categoria",
      applyDirect: "Candidati direttamente",
      scanQR: "Scansiona il codice QR per candidarti a questo apprendistato.",
      descriptionTitle: "Descrizione",
      durationTitle: "Durata della Formazione",
      requirementsTitle: "Requisiti",
      careerTitle: "Opportunità di Carriera",
      locationsTitle: "Sedi",
      noInfo: "Nessuna informazione disponibile",
      // Filter categories
      allCategories: "Tutti",
      productTechnic: "Prodotto e Tecnica",
      itElectronics: "IT ed Elettronica",
      service: "Servizio",
      organization: "Organizzazione",
      protectionSafety: "Protezione e Sicurezza",
      // Other
      duration: "Durata della formazione:"
    },
    ar: {
      pageTitle: "التدريب المهني في فولكس فاجن",
      backToHome: "العودة إلى الصفحة الرئيسية",
      headerTitle: "برامج التدريب المهني",
      loadingText: "جاري تحميل البيانات...",
      footerText: "© فولكس فاجن 2025 | التدريب المهني",
      // Inactivity warning
      inactivityWarningTitle: "بسبب عدم النشاط، سيتم إعادة توجيهك إلى الصفحة الرئيسية.",
      stayButtonText: "البقاء في هذه الصفحة",
      // Detail page
      detailCategory: "الفئة",
      applyDirect: "تقدم بطلب مباشرة",
      scanQR: "امسح رمز الاستجابة السريعة للتقدم بطلب لهذا التدريب المهني.",
      descriptionTitle: "الوصف",
      durationTitle: "مدة التدريب",
      requirementsTitle: "المتطلبات",
      careerTitle: "فرص المسار المهني",
      locationsTitle: "المواقع",
      noInfo: "لا توجد معلومات متاحة",
      // Filter categories
      allCategories: "الكل",
      productTechnic: "المنتج والتقنية",
      itElectronics: "تكنولوجيا المعلومات والإلكترونيات",
      service: "الخدمة",
      organization: "التنظيم",
      protectionSafety: "الحماية والسلامة",
      // Other
      duration: "مدة التدريب:"
    },
    ru: {
      pageTitle: "Профессиональное обучение в Volkswagen",
      backToHome: "Вернуться на главную",
      headerTitle: "Программы обучения",
      loadingText: "Загрузка данных...",
      footerText: "© Volkswagen AG 2025 | Профессиональное обучение",
      // Inactivity warning
      inactivityWarningTitle: "Из-за неактивности вы будете перенаправлены на главную страницу.",
      stayButtonText: "Остаться на этой странице",
      // Detail page
      detailCategory: "Категория",
      applyDirect: "Подать заявку напрямую",
      scanQR: "Отсканируйте QR-код, чтобы подать заявку на это обучение.",
      descriptionTitle: "Описание",
      durationTitle: "Продолжительность обучения",
      requirementsTitle: "Требования",
      careerTitle: "Возможности карьерного роста",
      locationsTitle: "Места обучения",
      noInfo: "Информация отсутствует",
      // Filter categories
      allCategories: "Все",
      productTechnic: "Продукт и техника",
      itElectronics: "ИТ и электроника",
      service: "Сервис",
      organization: "Организация",
      protectionSafety: "Защита и безопасность",
      // Other
      duration: "Продолжительность обучения:"
    },
    pl: {
      pageTitle: "Szkolenia zawodowe Volkswagen",
      backToHome: "Powrót do strony głównej",
      headerTitle: "Szkolenia zawodowe",
      loadingText: "Ładowanie danych...",
      footerText: "© Volkswagen AG 2025 | Szkolenia zawodowe",
      // Inactivity warning
      inactivityWarningTitle: "Z powodu braku aktywności zostaniesz przekierowany na stronę główną.",
      stayButtonText: "Zostań na tej stronie",
      // Detail page
      detailCategory: "Kategoria",
      applyDirect: "Aplikuj bezpośrednio",
      scanQR: "Zeskanuj kod QR, aby aplikować na to szkolenie zawodowe.",
      descriptionTitle: "Opis",
      durationTitle: "Czas trwania szkolenia",
      requirementsTitle: "Wymagania",
      careerTitle: "Możliwości kariery",
      locationsTitle: "Lokalizacje",
      noInfo: "Brak dostępnych informacji",
      // Filter categories
      allCategories: "Wszystkie",
      productTechnic: "Produkt i technika",
      itElectronics: "IT i elektronika",
      service: "Serwis",
      organization: "Organizacja",
      protectionSafety: "Ochrona i bezpieczeństwo",
      // Other
      duration: "Czas trwania szkolenia:"
    },
    cz: {
      pageTitle: "Odborné vzdělávání Volkswagen",
      backToHome: "Zpět na úvodní stránku",
      headerTitle: "Odborné vzdělávání",
      loadingText: "Načítání dat...",
      footerText: "© Volkswagen AG 2025 | Odborné vzdělávání",
      // Inactivity warning
      inactivityWarningTitle: "Z důvodu neaktivity budete přesměrováni na úvodní stránku.",
      stayButtonText: "Zůstat na této stránce",
      // Detail page
      detailCategory: "Kategorie",
      applyDirect: "Podat přihlášku přímo",
      scanQR: "Naskenujte QR kód pro přihlášení na toto odborné vzdělávání.",
      descriptionTitle: "Popis",
      durationTitle: "Doba trvání vzdělávání",
      requirementsTitle: "Požadavky",
      careerTitle: "Možnosti kariéry",
      locationsTitle: "Lokality",
      noInfo: "Žádné dostupné informace",
      // Filter categories
      allCategories: "Všechny",
      productTechnic: "Produkt a technika",
      itElectronics: "IT a elektronika",
      service: "Služby",
      organization: "Organizace",
      protectionSafety: "Ochrana a bezpečnost",
      // Other
      duration: "Doba trvání vzdělávání:"
    },
    hu: {
      pageTitle: "Volkswagen szakképzés",
      backToHome: "Vissza a főoldalra",
      headerTitle: "Szakképzési programok",
      loadingText: "Adatok betöltése...",
      footerText: "© Volkswagen AG 2025 | Szakképzés",
      // Inactivity warning
      inactivityWarningTitle: "Inaktivitás miatt átirányítjuk a főoldalra.",
      stayButtonText: "Maradjon ezen az oldalon",
      // Detail page
      detailCategory: "Kategória",
      applyDirect: "Közvetlen jelentkezés",
      scanQR: "Olvassa be a QR-kódot, hogy jelentkezzen erre a szakképzésre.",
      descriptionTitle: "Leírás",
      durationTitle: "Képzés időtartama",
      requirementsTitle: "Követelmények",
      careerTitle: "Karrierlehetőségek",
      locationsTitle: "Helyszínek",
      noInfo: "Nincs elérhető információ",
      // Filter categories
      allCategories: "Összes",
      productTechnic: "Termék és technika",
      itElectronics: "IT és elektronika",
      service: "Szolgáltatás",
      organization: "Szervezet",
      protectionSafety: "Védelem és biztonság",
      // Other
      duration: "Képzés időtartama:"
    },
    ro: {
      pageTitle: "Formare profesională Volkswagen",
      backToHome: "Înapoi la pagina principală",
      headerTitle: "Programe de formare profesională",
      loadingText: "Se încarcă datele...",
      footerText: "© Volkswagen AG 2025 | Formare profesională",
      // Inactivity warning
      inactivityWarningTitle: "Din cauza inactivității, veți fi redirecționat către pagina principală.",
      stayButtonText: "Rămâneți pe această pagină",
      // Detail page
      detailCategory: "Categorie",
      applyDirect: "Aplicați direct",
      scanQR: "Scanați codul QR pentru a aplica la această formare profesională.",
      descriptionTitle: "Descriere",
      durationTitle: "Durata formării",
      requirementsTitle: "Cerințe",
      careerTitle: "Oportunități de carieră",
      locationsTitle: "Locații",
      noInfo: "Nu există informații disponibile",
      // Filter categories
      allCategories: "Toate",
      productTechnic: "Produs și tehnică",
      itElectronics: "IT și electronică",
      service: "Servicii",
      organization: "Organizație",
      protectionSafety: "Protecție și siguranță",
      // Other
      duration: "Durata formării:"
    },
    bg: {
      pageTitle: "Професионално обучение във Volkswagen",
      backToHome: "Обратно към началната страница",
      headerTitle: "Програми за професионално обучение",
      loadingText: "Зареждане на данни...",
      footerText: "© Volkswagen AG 2025 | Професионално обучение",
      // Inactivity warning
      inactivityWarningTitle: "Поради неактивност ще бъдете пренасочени към началната страница.",
      stayButtonText: "Останете на тази страница",
      // Detail page
      detailCategory: "Категория",
      applyDirect: "Кандидатствайте директно",
      scanQR: "Сканирайте QR кода, за да кандидатствате за това професионално обучение.",
      descriptionTitle: "Описание",
      durationTitle: "Продължителност на обучението",
      requirementsTitle: "Изисквания",
      careerTitle: "Възможности за кариера",
      locationsTitle: "Местоположения",
      noInfo: "Няма налична информация",
      // Filter categories
      allCategories: "Всички",
      productTechnic: "Продукт и техника",
      itElectronics: "ИТ и електроника",
      service: "Услуги",
      organization: "Организация",
      protectionSafety: "Защита и безопасност",
      // Other
      duration: "Продължителност на обучението:"
    }
  };
  
  // Kategorienamen übersetzen
  function translateCategories() {
    const currentLang = getCurrentLanguage();
    const categories = contentCache.categories;
    
    if (categories && categories.length > 0) {
      for (let i = 0; i < categories.length; i++) {
        const categoryId = categories[i].id;
        switch (categoryId) {
          case "all":
            categories[i].name = translations[currentLang].allCategories;
            break;
          case "produkt-technik":
            categories[i].name = translations[currentLang].productTechnic;
            break;
          case "it-elektronik":
            categories[i].name = translations[currentLang].itElectronics;
            break;
          case "service":
            categories[i].name = translations[currentLang].service;
            break;
          case "organisation":
            categories[i].name = translations[currentLang].organization;
            break;
          case "schutz-sicherheit":
            categories[i].name = translations[currentLang].protectionSafety;
            break;
        }
      }
    }
  }
  
  // Hilfsfunktion um aktuell ausgewählte Sprache zu bekommen
  function getCurrentLanguage() {
    return document.getElementById('language-select').value;
  }
  
  // Sprache ändern und Seite aktualisieren
  function changeLanguage(lang) {
    // Sprache im LocalStorage speichern
    localStorage.setItem('selectedLanguage', lang);
    
    // RTL Sprache erkennen und Seite entsprechend anpassen
   /* if (lang === 'ar') {
      document.body.classList.add('rtl-language');
      document.documentElement.setAttribute('dir', 'rtl');
    } else {
      document.body.classList.remove('rtl-language');
      document.documentElement.setAttribute('dir', 'ltr');
    } */
    
    // Seitentitel ändern
    document.title = translations[lang].pageTitle;
    
    // Zurück zur Startseite Button
    const backButton = document.querySelector('.back-to-landing span');
    if (backButton) backButton.textContent = translations[lang].backToHome;
    
    // Haupttitel
    const headerTitle = document.querySelector('.title');
    if (headerTitle) headerTitle.textContent = translations[lang].headerTitle;
    
    // Ladetext
    const loadingText = document.querySelector('#loadingIndicator p');
    if (loadingText) loadingText.textContent = translations[lang].loadingText;
    
    // Footer
    const footerText = document.querySelector('footer p');
    if (footerText) footerText.textContent = translations[lang].footerText;
    
    // Inaktivitätswarnung
    const warningText = document.querySelector('.warning-content p');
    if (warningText) warningText.textContent = translations[lang].inactivityWarningTitle;
    
    const stayButton = document.getElementById('stayButton');
    if (stayButton) stayButton.textContent = translations[lang].stayButtonText;
    
    // Detailseite
    const detailCategory = document.getElementById('detailCategory');
    if (detailCategory) detailCategory.textContent = translations[lang].detailCategory;
    
    const qrTitle = document.querySelector('.qr-title');
    if (qrTitle) qrTitle.textContent = translations[lang].applyDirect;
    
    const qrText = document.querySelector('.qr-text');
    if (qrText) qrText.textContent = translations[lang].scanQR;
    
    // Detailabschnitte Überschriften
    const detailSectionTitles = document.querySelectorAll('.detail-section h3');
    if (detailSectionTitles.length > 0) {
      detailSectionTitles[0].textContent = translations[lang].descriptionTitle;
      detailSectionTitles[1].textContent = translations[lang].durationTitle;
      detailSectionTitles[2].textContent = translations[lang].requirementsTitle;
      detailSectionTitles[3].textContent = translations[lang].careerTitle;
      detailSectionTitles[4].textContent = translations[lang].locationsTitle;
    }
    
    // "Keine Angaben" Text
    const noInfoTexts = document.querySelectorAll('.detail-section p');
    noInfoTexts.forEach(text => {
      if (text.textContent === 'Keine Angaben') {
        text.textContent = translations[lang].noInfo;
      }
    });
    
    // Filterkategorien übersetzen
    translateCategories();
    
    // Filter neu initialisieren
    const activeCategory = document.querySelector('.filter-btn.active').dataset.category;
    initializeFilters(contentCache.categories);
    
    // Karten neu erstellen mit übersetzten Kategorienamen
    createCards(contentCache.berufe);
    
    // Aktiven Filter wieder anwenden
    filterCards(activeCategory);
    
    // Wenn die Detailseite geöffnet ist, aktualisiere die Detailseite
    const detailPage = document.getElementById('detailPage');
    if (detailPage && detailPage.style.display === 'flex') {
      const berufId = document.querySelector('.detail-title').dataset.berufId;
      if (berufId) {
        closeDetailPage();
        setTimeout(() => {
          openDetailPage(berufId);
        }, 600);
      }
    }
  }
  
  // Erweiterte openDetailPage Funktion
  const originalOpenDetailPage = window.openDetailPage || function(){};
  window.openDetailPage = function(berufId) {
    const beruf = findBerufById(berufId);
    if (!beruf) return;
    
    originalOpenDetailPage(berufId);
    
    // Beruf-ID speichern für mögliche Aktualisierungen
    document.getElementById('detailTitle').dataset.berufId = berufId;
    
    // "Ausbildungsdauer:" Text übersetzen
    const currentLang = getCurrentLanguage();
    const durationElements = document.querySelectorAll('.card-duration');
    durationElements.forEach(elem => {
      const durationText = elem.textContent;
      if (durationText.startsWith('Ausbildungsdauer:')) {
        const duration = durationText.split(':')[1].trim();
        elem.textContent = `${translations[currentLang].duration} ${duration}`;
      }
    });
  };
  
  // Sprachauswahl für verschiedene Bildschirmgrößen anpassen
  function adjustLanguageSelector() {
    const selector = document.getElementById('language-select');
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
// Auf Mobilgeräten nur Sprachkürzel anzeigen
const options = selector.options;
    
// Aktuelle Werte sichern
const currentValue = selector.value;

// Neue Option erstellen und hinzufügen
if (options[0].textContent.length > 3) {
  for (let i = 0; i < options.length; i++) {
    const fullText = options[i].textContent;
    const shortCode = options[i].value.toUpperCase();
    options[i].dataset.fullText = fullText;
    options[i].textContent = shortCode;
  }
}

// Ausgewählten Wert wiederherstellen
selector.value = currentValue;
} else {
// Auf Desktop vollständige Sprachnamen anzeigen
const options = selector.options;

// Aktuelle Werte sichern
const currentValue = selector.value;

// Ursprünglichen Text wiederherstellen, falls vorhanden
if (options[0].dataset.fullText) {
  for (let i = 0; i < options.length; i++) {
    if (options[i].dataset.fullText) {
      options[i].textContent = options[i].dataset.fullText;
    }
  }
}

// Ausgewählten Wert wiederherstellen
selector.value = currentValue;
}
}

// Beim Laden der Seite gespeicherte Sprache wiederherstellen
document.addEventListener('DOMContentLoaded', function() {
// Hier nur die Sprachauswahl initialisieren, 
// da der Rest der Funktionen bereits in index.html vorhanden ist
/*const savedLanguage = localStorage.getItem('selectedLanguage');
if (savedLanguage) {
document.getElementById('language-select').value = savedLanguage;
changeLanguage(savedLanguage);
} */

// CSS für nicht-lateinische Schriftzeichen berücksichtigen
/*if (savedLanguage === 'ar' || savedLanguage === 'ru' || savedLanguage === 'bg') {
document.body.classList.add('non-latin-script');
}
*/
// Sprachspezifische Anpassungen für Mobile vornehmen
adjustLanguageSelector();
window.addEventListener('resize', adjustLanguageSelector);
});
