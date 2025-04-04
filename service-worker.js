// service-worker.js
const CACHE_NAME = 'vw-ausbildung-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/landing.html',
  '/style/styles.css',
  '/style/landing-styles.css',
  '/style/test-styles.css',
  '/translation.js',
  '/img/vwlogo.png',
  '/img/vwlogoweiß.png',
  '/img/placeholder.jpg',
  // Standard-Bilder für die Galerie
  '/img/gallery/default1.png',
  '/img/gallery/default2.png',
  '/img/gallery/default3.png',
  '/img/gallery/default4.jpg',
  // Wissenstests
  '/tests/chemielaborant.html',
  '/tests/metalltechnik.html',
  '/tests/eat.html',
  '/tests/blank.html'
];

// Installationsphase - Cache mit statischen Assets füllen
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Statische Assets werden gecached');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Aktivierungsphase - Alte Caches löschen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Alter Cache wird gelöscht', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch-Event-Handler - Netzwerk-Requests abfangen und aus dem Cache bedienen
self.addEventListener('fetch', event => {
  // Anfragen an die CMS-API
  if (event.request.url.includes('/api/')) {
    // Netzwerk-First-Strategie für API-Anfragen
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache-Copy erstellen und ins Cache schreiben
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          // Bei Netzwerkfehler aus dem Cache bedienen
          return caches.match(event.request);
        })
    );
  } 
  // Bilder-Anfragen
  else if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
    // Cache-First-Strategie für Bilder
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then(response => {
            // Cache-Copy erstellen und ins Cache schreiben
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clonedResponse);
            });
            return response;
          })
          .catch(error => {
            // Fehlerbehandlung: Placeholder-Bild anzeigen
            if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
              return caches.match('/img/placeholder.jpg');
            }
            throw error;
          });
      })
    );
  }
  // HTML, CSS, JS und andere statische Assets
  else {
    // Cache-First-Strategie für statische Assets
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then(response => {
            // Nur erfolgreiche Antworten cachen
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Cache-Copy erstellen und ins Cache schreiben
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clonedResponse);
            });
            return response;
          });
      })
      .catch(error => {
        // Bei HTML-Anfragen zur Offline-Seite weiterleiten
        if (event.request.headers.get('Accept').includes('text/html')) {
          return caches.match('/offline.html');
        }
        throw error;
      })
    );
  }
});

// Hintergrund-Synchronisierung für Offline-Modus
self.addEventListener('sync', event => {
  if (event.tag === 'sync-cms-data') {
    event.waitUntil(syncCmsData());
  }
});

// Funktion zur Synchronisierung von CMS-Daten
async function syncCmsData() {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Kategorien abrufen und cachen
    const categoriesResponse = await fetch('/api/items/categories');
    if (categoriesResponse.ok) {
      await cache.put('/api/items/categories', categoriesResponse.clone());
    }
    
    // Berufe abrufen und cachen
    const professionsResponse = await fetch('/api/items/professions?fields=*.*');
    if (professionsResponse.ok) {
      await cache.put('/api/items/professions?fields=*.*', professionsResponse.clone());
    }
    
    console.log('Service Worker: CMS-Daten wurden erfolgreich synchronisiert');
  } catch (error) {
    console.error('Service Worker: Fehler bei der Synchronisierung von CMS-Daten', error);
    throw error;
  }
}