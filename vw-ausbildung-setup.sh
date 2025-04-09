#!/bin/bash
# Verbessertes Setup-Skript für Volkswagen Ausbildungsberufe CMS auf dem Raspberry Pi 5
# Mit Fehlerbehandlung und verbesserter Direktus-Konfiguration

echo "======================================================================"
echo "  Volkswagen Ausbildungsberufe CMS - Raspberry Pi 5 Setup"
echo "======================================================================"
echo ""

# Prüfen, ob das Skript als Root ausgeführt wird
if [ "$EUID" -ne 0 ]; then
  echo "Dieses Skript muss mit Root-Rechten ausgeführt werden (sudo)."
  exit 1
fi

# Variablen und Konfiguration
WEBSITE_DIR="/var/www/html/vw-ausbildung"
CMS_DIR="/opt/vw-ausbildung-cms"
NGINX_SITE_CONFIG="/etc/nginx/sites-available/vw-ausbildung"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/vw-ausbildung"
DB_FILE="${CMS_DIR}/data.db"
CURRENT_DIR=$(pwd)
USERNAME=$(logname || echo "$SUDO_USER")
GIT_REPO="https://github.com/LevinAnova/Abschlussprojekt-FISI.git"

# Funktion für Fehlerbehandlung
handle_error() {
    echo "FEHLER: $1" >&2
    echo "Das Skript wird beendet. Bitte beheben Sie das Problem und versuchen Sie es erneut."
    exit 1
}

# Basis-Systempakete installieren
echo "[1/10] System wird aktualisiert und benötigte Pakete werden installiert..."
apt update || handle_error "System-Update fehlgeschlagen"
apt upgrade -y || handle_error "System-Upgrade fehlgeschlagen"
apt install -y nginx nodejs npm sqlite3 git zip unzip curl wget nano build-essential htop || handle_error "Paketinstallation fehlgeschlagen"

# Node.js auf aktuelle LTS-Version aktualisieren
echo "[2/10] Node.js wird auf LTS-Version aktualisiert..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - || handle_error "NodeSource-Setup fehlgeschlagen"
apt install -y nodejs || handle_error "Node.js-Installation fehlgeschlagen"

# Prüfen der Node.js und NPM Version
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo "Node.js Version: $NODE_VERSION"
echo "NPM Version: $NPM_VERSION"

# Überprüfen, ob die Node.js-Version mindestens 16 ist
NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f 1 | tr -d 'v')
if [ $NODE_MAJOR_VERSION -lt 16 ]; then
    handle_error "Node.js-Version ist zu niedrig. Mindestens v16 wird für Direktus benötigt."
fi

# Website-Verzeichnis anlegen
echo "[3/10] Website-Verzeichnis wird vorbereitet..."
mkdir -p "$WEBSITE_DIR" || handle_error "Website-Verzeichnis konnte nicht angelegt werden"
chown -R $USERNAME:$USERNAME "$WEBSITE_DIR" || handle_error "Berechtigungsänderung für Website-Verzeichnis fehlgeschlagen"

# Direktus CMS installieren
echo "[4/10] Direktus CMS wird installiert..."
mkdir -p "$CMS_DIR" || handle_error "CMS-Verzeichnis konnte nicht angelegt werden"
cd "$CMS_DIR" || handle_error "Konnte nicht ins CMS-Verzeichnis wechseln"

# Sicherheitsschlüssel generieren
SECURE_KEY=$(openssl rand -hex 32)
SECURE_SECRET=$(openssl rand -hex 64)
ADMIN_PASSWORD_SECURE="Admin$(openssl rand -hex 4)123!"

# package.json erstellen
cat > package.json << EOF
{
  "name": "vw-ausbildung-cms",
  "version": "1.0.0",
  "description": "CMS für Volkswagen Ausbildungsberufe",
  "main": "index.js",
  "scripts": {
    "start": "directus start"
  },
  "dependencies": {
    "directus": "^9.26.0",
    "sqlite3": "^5.1.6"
  }
}
EOF

# Direktus und Abhängigkeiten installieren
echo "NPM-Pakete werden installiert (dies kann einige Minuten dauern)..."
npm install --no-audit --no-fund || handle_error "NPM-Installation fehlgeschlagen"

# Konfiguration für Direktus
echo "Direktus-Konfiguration wird erstellt..."
cat > .env << EOF
PORT=8055
PUBLIC_URL="http://localhost:8055"
LOG_LEVEL="info"

# Direktus mit SQLite konfigurieren
DB_CLIENT="sqlite3"
DB_FILENAME="$DB_FILE"

# Admin-Benutzer
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="$ADMIN_PASSWORD_SECURE"

# Geheimer Schlüssel für Tokens
KEY="$SECURE_KEY"
SECRET="$SECURE_SECRET"

# Erweiterte Konfiguration für bessere Stabilität
CORS_ENABLED=true
CORS_ORIGIN="*"
CACHE_ENABLED=true
CACHE_STORE=memory
CACHE_AUTO_PURGE=true
MAX_PAYLOAD_SIZE="10mb"
RATE_LIMITER_ENABLED=false
TELEMETRY="false"
EOF

# Berechtigungen für CMS-Verzeichnis und Dateien setzen
echo "Setze Berechtigungen für das CMS-Verzeichnis..."
chown -R $USERNAME:$USERNAME "$CMS_DIR" || handle_error "Berechtigungsänderung für CMS-Verzeichnis fehlgeschlagen"
chmod -R 755 "$CMS_DIR" || handle_error "Berechtigungsänderung für CMS-Verzeichnis fehlgeschlagen"

# Direktus initialisieren
echo "[5/10] Direktus wird initialisiert..."
echo "Datenbank wird vorbereitet (dies kann einen Moment dauern)..."
su - $USERNAME -c "cd $CMS_DIR && npx directus bootstrap" || handle_error "Direktus-Bootstrap fehlgeschlagen"

# Überprüfen, ob die Direktus-Datenbank erfolgreich erstellt wurde
if [ ! -f "$DB_FILE" ]; then
    handle_error "Direktus-Datenbank konnte nicht erstellt werden"
fi

# Überprüfe die Datenbankberechtigungen
chown $USERNAME:$USERNAME "$DB_FILE" || handle_error "Datenbank-Berechtigungen konnten nicht gesetzt werden"
chmod 664 "$DB_FILE" || handle_error "Datenbank-Berechtigungen konnten nicht gesetzt werden"

# Autostart für Direktus einrichten
echo "[6/10] Autostart für Direktus wird eingerichtet..."
cat > /etc/systemd/system/directus.service << EOF
[Unit]
Description=Direktus CMS für Volkswagen Ausbildungsberufe
After=network.target

[Service]
Type=simple
User=$USERNAME
WorkingDirectory=$CMS_DIR
ExecStart=$(which npx) directus start
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=directus
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload || handle_error "Systemd Daemon-Reload fehlgeschlagen"
systemctl enable directus || handle_error "Direktus-Service konnte nicht aktiviert werden"
systemctl start directus || handle_error "Direktus-Service konnte nicht gestartet werden"

# Überprüfen, ob Direktus erfolgreich gestartet wurde
sleep 5
systemctl is-active directus >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "WARNUNG: Direktus konnte nicht gestartet werden."
    echo "Prüfe die Logs mit: sudo journalctl -u directus"
    echo "Das Skript wird fortgesetzt, aber möglicherweise müssen Sie Direktus manuell konfigurieren."
fi

# Nginx für die Website und CMS konfigurieren
echo "[7/10] Nginx wird konfiguriert..."
cat > "$NGINX_SITE_CONFIG" << EOF
# Datei: /etc/nginx/sites-available/vw-ausbildung

server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root $WEBSITE_DIR;
    index index.html;

    server_name _;

    # Gzip-Kompression aktivieren für bessere Performance auf dem Pi
    gzip on;
    gzip_disable "msie6";
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_buffers 16 8k;
    gzip_http_version 1.1;
    gzip_min_length 256;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript application/vnd.ms-fontobject application/x-font-ttf font/opentype image/svg+xml image/x-icon;

    # Caching-Header für statische Assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Frontendanwendung
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Proxy für Direktus CMS API
    location /api/ {
        proxy_pass http://localhost:8055/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
        proxy_send_timeout 90s;
        
        # Cache-Kontrolle für API-Antworten
        proxy_cache_valid 200 301 302 10m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    }
    
    # Direktus Admin-Oberfläche
    location /admin {
        proxy_pass http://localhost:8055/admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering off;
        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
        proxy_send_timeout 90s;
    }
    
    # Assets vom Direktus CMS
    location /assets/ {
        proxy_pass http://localhost:8055/assets/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_buffering off;
        
        # Caching für Assets
        proxy_cache_valid 200 301 302 30d;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
    
    # Wissenstests
    location /tests/ {
        try_files \$uri \$uri/ =404;
    }
    
    # Fehlerbehebung
    error_page 404 /404.html;
    location = /404.html {
        root $WEBSITE_DIR;
        internal;
    }
    
    # Offline-Seite
    location = /offline.html {
        root $WEBSITE_DIR;
        internal;
    }
}
EOF

# Nginx-Site aktivieren und Standardseite deaktivieren
ln -sf "$NGINX_SITE_CONFIG" "$NGINX_SITE_ENABLED" || handle_error "Nginx-Site konnte nicht aktiviert werden"
rm -f /etc/nginx/sites-enabled/default || handle_error "Nginx-Standard-Site konnte nicht deaktiviert werden"
systemctl restart nginx || handle_error "Nginx konnte nicht neu gestartet werden"

# Website-Dateien einrichten
echo "[8/10] Website wird eingerichtet..."
cd "$CURRENT_DIR" || handle_error "Konnte nicht ins aktuelle Verzeichnis wechseln"

# Website-Dateien aus dem Git-Repository klonen
echo "Website-Dateien werden aus dem GitHub-Repository heruntergeladen..."
TMP_DIR=$(mktemp -d) || handle_error "Temporäres Verzeichnis konnte nicht erstellt werden"
git clone "$GIT_REPO" "$TMP_DIR" || handle_error "GitHub-Repository konnte nicht geklont werden"

# Website-Dateien in das Zielverzeichnis kopieren
echo "Kopiere Website-Dateien in das Webverzeichnis..."
cp -r "$TMP_DIR"/* "$WEBSITE_DIR/" || handle_error "Website-Dateien konnten nicht kopiert werden"

# Temporäres Verzeichnis aufräumen
rm -rf "$TMP_DIR" || handle_error "Temporäres Verzeichnis konnte nicht gelöscht werden"

# Konfiguration der Website für den lokalen CMS-Betrieb anpassen
echo "Konfiguration wird für lokales CMS angepasst..."

# Datei index.html bearbeiten, um lokale CMS-URLs zu verwenden
if [ -f "$WEBSITE_DIR/index.html" ]; then
    echo "Passe index.html für lokales CMS an..."
    # Ersetze die API-URLs
    sed -i 's|useMockData: true|useMockData: false|g' "$WEBSITE_DIR/index.html" || handle_error "index.html konnte nicht angepasst werden (useMockData)"
    sed -i 's|apiUrl: .*|apiUrl: "http://localhost/api",|g' "$WEBSITE_DIR/index.html" || handle_error "index.html konnte nicht angepasst werden (apiUrl)"
    sed -i 's|imageBasePath: .*|imageBasePath: "http://localhost/assets",|g' "$WEBSITE_DIR/index.html" || handle_error "index.html konnte nicht angepasst werden (imageBasePath)"
fi

# Überprüfen, ob service-worker.js und manifest.json aus dem Repository vorhanden sind
echo "Überprüfe PWA-Dateien..."
if [ -f "$WEBSITE_DIR/service-worker.js" ]; then
    echo "Service Worker ist vorhanden und wird verwendet."
    # Passe den Service Worker an lokale Pfade an
    sed -i "s|'/api/|'http://localhost/api/|g" "$WEBSITE_DIR/service-worker.js" || handle_error "service-worker.js konnte nicht angepasst werden"
else
    echo "WARNUNG: Service Worker nicht gefunden. Offline-Funktionalität wird eingeschränkt sein."
fi

if [ -f "$WEBSITE_DIR/manifest.json" ]; then
    echo "Web App Manifest ist vorhanden und wird verwendet."
else
    echo "WARNUNG: Web App Manifest nicht gefunden. PWA-Installation wird nicht möglich sein."
fi

# Erstelle das Verzeichnis für die Icons, falls nicht vorhanden
if [ ! -d "$WEBSITE_DIR/img" ]; then
    mkdir -p "$WEBSITE_DIR/img" || handle_error "img-Verzeichnis konnte nicht erstellt werden"
fi

# Installiere ImageMagick für Icon-Erstellung, falls nicht vorhanden
if ! command -v convert &> /dev/null; then
    echo "Installiere ImageMagick für PWA-Icons..."
    apt install -y imagemagick || handle_error "ImageMagick konnte nicht installiert werden"
fi

# Überprüfen, ob die PWA-Icons vorhanden sind
if [ ! -f "$WEBSITE_DIR/img/vw-icon-192.png" ] || [ ! -f "$WEBSITE_DIR/img/vw-icon-512.png" ]; then
    echo "PWA-Icons werden erstellt..."
    
    # Erstelle einfache VW-Icons als Platzhalter
    convert -size 192x192 xc:white -font Arial -pointsize 48 -fill "#001e50" -gravity center -annotate 0 "VW" "$WEBSITE_DIR/img/vw-icon-192.png" || handle_error "PWA-Icon (192px) konnte nicht erstellt werden"
    convert -size 512x512 xc:white -font Arial -pointsize 128 -fill "#001e50" -gravity center -annotate 0 "VW" "$WEBSITE_DIR/img/vw-icon-512.png" || handle_error "PWA-Icon (512px) konnte nicht erstellt werden"
    echo "Platzhalter-Icons wurden erstellt."
fi

# Berechtigungen setzen
echo "Setze Berechtigungen für das Webverzeichnis..."
chown -R $USERNAME:$USERNAME "$WEBSITE_DIR" || handle_error "Berechtigungsänderung für Website-Verzeichnis fehlgeschlagen"
chmod -R 755 "$WEBSITE_DIR" || handle_error "Berechtigungsänderung für Website-Verzeichnis fehlgeschlagen"

# Optional: Lokale DNS-Einträge für einfacheren Zugriff
echo "[9/10] Lokale DNS-Einträge werden konfiguriert..."
cat >> /etc/hosts << EOF

# Lokale Einträge für Volkswagen Ausbildungsberufe
127.0.0.1 vw-ausbildung.local cms.vw-ausbildung.local
EOF

# Raspberry Pi-Optimierungen
echo "[10/10] Raspberry Pi wird optimiert..."

# Swap-Größe erhöhen für bessere Performance
if [ -f /etc/dphys-swapfile ]; then
    sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/g' /etc/dphys-swapfile || handle_error "Swap-Größe konnte nicht angepasst werden"
    /etc/init.d/dphys-swapfile restart || handle_error "Swap-Dienst konnte nicht neu gestartet werden"
else
    echo "WARNUNG: /etc/dphys-swapfile nicht gefunden. Die Swap-Größe konnte nicht angepasst werden."
fi

# CPU-Governeur auf Performance setzen
if [ -d /sys/devices/system/cpu/cpu0/cpufreq ]; then
    echo "performance" > /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor || handle_error "CPU-Governeur konnte nicht gesetzt werden"
    echo 'GOVERNOR="performance"' > /etc/default/cpufrequtils || handle_error "CPU-Governeur-Einstellung konnte nicht gespeichert werden"
else
    echo "WARNUNG: CPU-Frequenzsteuerung nicht verfügbar. Der CPU-Governeur konnte nicht gesetzt werden."
fi

# Bonjour/Avahi-Service für einfache Erreichbarkeit im lokalen Netzwerk
if [ -d /etc/avahi/services ]; then
    cat > /etc/avahi/services/vw-ausbildung.service << EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <n>Volkswagen Ausbildungsberufe</n>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
  </service>
</service-group>
EOF
    systemctl restart avahi-daemon || handle_error "Avahi-Daemon konnte nicht neu gestartet werden"
else
    echo "WARNUNG: Avahi-Dienste sind nicht verfügbar. Der Bonjour-Dienst konnte nicht konfiguriert werden."
fi

# Direktus-API überprüfen
echo "Überprüfe die Direktus-API..."
sleep 5
DIREKTUS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8055/server/ping || echo "Fehler")

if [ "$DIREKTUS_STATUS" = "200" ]; then
    echo "Direktus-API ist erreichbar und antwortet korrekt."
else
    echo "WARNUNG: Direktus-API ist nicht erreichbar oder antwortet nicht korrekt (Status: $DIREKTUS_STATUS)."
    echo "Überprüfe die Logs mit: sudo journalctl -u directus"
fi

# Abschluss
echo ""
echo "======================================================================"
echo "  Installation abgeschlossen!"
echo "======================================================================"
echo ""
echo "Die Volkswagen Ausbildungsberufe-Anwendung und das CMS wurden erfolgreich installiert."
echo ""
echo "Zugriff auf die Webseite: http://localhost oder http://$(hostname).local"
echo "Zugriff auf das CMS: http://localhost/admin"
echo ""
echo "CMS Admin-Zugangsdaten:"
echo "E-Mail: admin@example.com"
echo "Passwort: $ADMIN_PASSWORD_SECURE"
echo ""
echo "WICHTIG: Bitte notieren Sie sich das generierte Passwort für den Admin-Zugang!"
echo "======================================================================"
echo ""
echo "Sollte das CMS nicht sofort funktionieren, versuchen Sie Folgendes:"
echo "1. Starten Sie Direktus neu: sudo systemctl restart directus"
echo "2. Prüfen Sie die Logs: sudo journalctl -u directus -n 50"
echo "3. Browser-Cache leeren und neu laden"
echo "======================================================================"

# Das Passwort in einer Datei im Home-Verzeichnis des Benutzers speichern
echo "Das Admin-Passwort wird in Ihrem Home-Verzeichnis gespeichert..."
echo "Admin-E-Mail: admin@example.com" > "/home/$USERNAME/vw-cms-admin-credentials.txt"
echo "Admin-Passwort: $ADMIN_PASSWORD_SECURE" >> "/home/$USERNAME/vw-cms-admin-credentials.txt"
chown "$USERNAME:$USERNAME" "/home/$USERNAME/vw-cms-admin-credentials.txt"
chmod 600 "/home/$USERNAME/vw-cms-admin-credentials.txt"

echo "Die Zugangsdaten wurden in /home/$USERNAME/vw-cms-admin-credentials.txt gespeichert."

exit 0