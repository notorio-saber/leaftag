// ===== SERVICE WORKER LEAFTAG =====
// Cache offline para funcionamento sem internet

const CACHE_NAME = 'leaftag-v1.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  // Adicione outros arquivos que criar
  '/exports/kml-exporter.js',
  '/assets/images/logo.png',
  '/assets/images/icon-192.png',
  '/assets/images/icon-512.png'
];

// ===== INSTALAÇÃO =====
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker: Todos os arquivos em cache');
        return self.skipWaiting();
      })
  );
});

// ===== ATIVAÇÃO =====
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Ativando...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Remove caches antigos
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Ativado e controlando páginas');
      return self.clients.claim();
    })
  );
});

// ===== INTERCEPTAÇÃO DE REQUESTS =====
self.addEventListener('fetch', event => {
  // Estratégia: Cache First (prioriza cache, depois rede)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se encontrou no cache, retorna
        if (response) {
          console.log('📦 Cache hit:', event.request.url);
          return response;
        }
        
        // Se não encontrou, busca na rede
        console.log('🌐 Network fetch:', event.request.url);
        return fetch(event.request)
          .then(response => {
            // Verifica se é uma resposta válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clona a resposta (pois só pode ser consumida uma vez)
            const responseToCache = response.clone();
            
            // Adiciona ao cache para próximas vezes
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Se falhou na rede e não tem no cache
            console.log('❌ Offline e não encontrado no cache:', event.request.url);
            
            // Para páginas HTML, retorna página principal
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// ===== ATUALIZAÇÃO DO CACHE =====
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('🔄 Service Worker: Atualizando...');
    self.skipWaiting();
  }
});

console.log('📱 Service Worker LeafTag carregado!');