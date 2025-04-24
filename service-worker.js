// service-worker.js
const CACHE_NAME = 'vw-ausbildung-cache-v2'; // Versionsnummer erhöht
const API_CACHE_NAME = 'vw-ausbildung-api-cache';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html', // CMS-Frontend
  '/css/styles.css',
  '/js/cms.js',
  '/js/main.js',
  // Weitere statische Assets
];

// Installation - Cache mit statischen Assets füllen
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

// Aktivierung - Alte Caches löschen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('Service Worker: Alter Cache wird gelöscht', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch-Event-Handler - Netzwerk-Requests abfangen
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // API-Anfragen behandeln
  if (url.pathname.startsWith('/api/')) {
    // Network-first Strategie für API
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Erfolgreiche Antwort im API-Cache speichern
          const clonedResponse = response.clone();
          caches.open(API_CACHE_NAME).then(cache => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          // Bei Netzwerkfehler aus dem Cache bedienen
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              
              // Wenn keine Kategorie-Anfrage im Cache ist, leeres Array zurückgeben
              if (url.pathname === '/api/categories') {
                return new Response(JSON.stringify([]), {
                  headers: { 'Content-Type': 'application/json' }
                });
              }
              
              // Wenn keine Berufe-Anfrage im Cache ist, leeres Array zurückgeben
              if (url.pathname === '/api/professions') {
                return new Response(JSON.stringify([]), {
                  headers: { 'Content-Type': 'application/json' }
                });
              }
              
              // Fallback für andere API-Anfragen
              return new Response(JSON.stringify({ error: 'Offline und nicht im Cache' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
  } 
  // Hochgeladene Bilder behandeln
  else if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Versuchen, das Bild zu laden und zu cachen
          return fetch(event.request)
            .then(response => {
              if (!response || response.status !== 200) {
                return response;
              }
              
              const clonedResponse = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, clonedResponse);
              });
              return response;
            })
            .catch(() => {
              // Wenn Bild nicht geladen werden kann, Platzhalter zurückgeben
              return caches.match('/img/placeholder.jpg');
            });
        })
    );
  }
  // Andere Anfragen (statische Assets, etc.)
  else {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then(response => {
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              const clonedResponse = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, clonedResponse);
              });
              return response;
            })
            .catch(error => {
              // Bei HTML-Anfragen zur Offline-Seite weiterleiten
              if (event.request.headers.get('Accept')?.includes('text/html')) {
                return caches.match('/offline.html');
              }
              throw error;
            });
        })
    );
  }
});

// Hintergrund-Synchronisierung einrichten
self.addEventListener('sync', event => {
  if (event.tag === 'sync-cms-data') {
    event.waitUntil(syncCmsData());
  }
});

// Funktion zur Synchronisierung der CMS-Daten
async function syncCmsData() {
  try {
    const cache = await caches.open(API_CACHE_NAME);
    
    // Daten synchronisieren
    const categoryRequest = new Request('/api/categories');
    const professionsRequest = new Request('/api/professions');
    
    // Kategorien abrufen und cachen
    const categoriesResponse = await fetch(categoryRequest);
    if (categoriesResponse.ok) {
      await cache.put(categoryRequest, categoriesResponse.clone());
    }
    
    // Berufe abrufen und cachen
    const professionsResponse = await fetch(professionsRequest);
    if (professionsResponse.ok) {
      await cache.put(professionsRequest, professionsResponse.clone());
    }
    
    console.log('Service Worker: CMS-Daten wurden erfolgreich synchronisiert');
  } catch (error) {
    console.error('Service Worker: Fehler bei der Synchronisierung von CMS-Daten', error);
    throw error;
  }
}

// Automatisches Caching von neu hochgeladenen Bildern
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_NEW_IMAGE') {
    const imageUrl = event.data.url;
    
    caches.open(CACHE_NAME).then(cache => {
      fetch(imageUrl).then(response => {
        cache.put(imageUrl, response);
        console.log('Neues Bild gecacht:', imageUrl);
      });
    });
  }
});

// Verbesserte Installation mit Fehlerprotokollierung
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Statische Assets werden gecached');
        // Versuche, jeden Asset einzeln zu cachen und Fehler abzufangen
        return Promise.allSettled(
          STATIC_ASSETS.map(asset => 
            cache.add(asset).catch(error => {
              console.warn(`Konnte ${asset} nicht cachen:`, error);
              // Fehlgeschlagene Assets protokollieren, aber Installation fortsetzen
              return Promise.resolve();
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Verbesserte fetch-Eventbehandlung mit Fehlermanagement
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Ignoriere Chrome-Extensions und andere externe Anfragen
  if (!url.origin.includes(self.location.origin)) {
    return;
  }
  
  // API-Anfragen mit besserer Fehlerbehandlung
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (!response.ok) {
            console.warn(`API-Antwort nicht OK: ${url.pathname} (${response.status})`);
            // Trotzdem weitermachen und Cache aktualisieren, wenn möglich
          }
          
          // Erfolgreiche Antwort im API-Cache speichern
          const clonedResponse = response.clone();
          caches.open(API_CACHE_NAME).then(cache => {
            cache.put(event.request, clonedResponse).catch(err => {
              console.warn('Cache-Speicherfehler:', err);
            });
          });
          return response;
        })
        .catch(error => {
          console.warn(`Fetch-Fehler für ${url.pathname}:`, error);
          // Bei Netzwerkfehler aus dem Cache bedienen
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              
              // Spezifische Offline-Fallbacks für API-Endpunkte
              if (url.pathname.includes('/quiz/')) {
                return new Response(JSON.stringify({ 
                  error: 'offline',
                  message: 'Quiz ist im Offline-Modus nicht verfügbar.' 
                }), { headers: { 'Content-Type': 'application/json' } });
              }
              
              // Allgemeiner Fallback für andere API-Anfragen
              return new Response(JSON.stringify({ 
                error: 'Offline und nicht im Cache' 
              }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
  } 
  // Bilder und Assets mit Fehlertoleranz
  else if (url.pathname.includes('/img/') || 
           url.pathname.includes('/uploads/') || 
           url.pathname.endsWith('.jpg') || 
           url.pathname.endsWith('.png')) {
    
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then(response => {
              if (!response || response.status !== 200) {
                console.warn(`Bild konnte nicht geladen werden: ${url.pathname}`);
                // Versuchen, ein Platzhalterbild zurückzugeben
                return caches.match('/img/placeholder.jpg')
                  .then(placeholder => {
                    return placeholder || response;
                  });
              }
              
              const clonedResponse = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, clonedResponse).catch(err => {
                    console.warn('Fehler beim Cachen eines Bildes:', err);
                  });
                });
              return response;
            })
            .catch(() => {
              console.warn(`Netzwerkfehler beim Laden des Bildes: ${url.pathname}`);
              // Platzhalterbild aus dem Cache zurückgeben
              return caches.match('/img/placeholder.jpg');
            });
        })
    );
  }
  // HTML-Seiten mit verbesserten Fallbacks
  else if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.includes('/tests/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch ${url.pathname}: ${response.status}`);
          }
          
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, clonedResponse).catch(err => {
                console.warn('Fehler beim Cachen von HTML:', err);
              });
            });
          return response;
        })
        .catch(error => {
          console.warn('HTML Fetch Error:', error);
          return caches.match(event.request)
            .then(cachedResponse => {
              return cachedResponse || caches.match('/offline.html');
            });
        })
    );
  }
  // Für alle anderen Anfragen
  else {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then(response => {
              if (!response || response.status !== 200) {
                return response;
              }
              
              // Nur basics cachen
              if (response.type === 'basic') {
                const clonedResponse = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, clonedResponse).catch(err => {
                      console.warn('Cache-Fehler:', err);
                    });
                  });
              }
              return response;
            })
            .catch(error => {
              console.warn('Genereller Fetch-Fehler:', error);
              
              if (event.request.headers.get('Accept')?.includes('text/html')) {
                return caches.match('/offline.html');
              }
              
              return new Response('Offline-Fehler', { 
                status: 503,
                headers: { 'Content-Type': 'text/plain' }
              });
            });
        })
    );
  }
});