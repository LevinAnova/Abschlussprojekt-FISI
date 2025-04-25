#!/bin/bash
# VW Ausbildungsberufe Setup-Skript v2
# Verbesserte Version mit Unterstützung für Wissenstests, Kiosk-Modus und mehr
# Für Raspberry Pi und andere Debian-basierte Systeme

# Farben für Ausgaben
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# ASCII-Art Logo
cat << "EOF"
██╗   ██╗██╗    ██╗      █████╗ ██╗   ██╗███████╗██████╗ ██╗██╗     ██████╗ ██╗   ██╗███╗   ██╗ ██████╗ 
██║   ██║██║    ██║     ██╔══██╗██║   ██║██╔════╝██╔══██╗██║██║     ██╔══██╗██║   ██║████╗  ██║██╔════╝ 
██║   ██║██║ █╗ ██║     ███████║██║   ██║███████╗██████╔╝██║██║     ██║  ██║██║   ██║██╔██╗ ██║██║  ███╗
╚██╗ ██╔╝██║███╗██║     ██╔══██║██║   ██║╚════██║██╔══██╗██║██║     ██║  ██║██║   ██║██║╚██╗██║██║   ██║
 ╚████╔╝ ╚███╔███╔╝     ██║  ██║╚██████╔╝███████║██████╔╝██║███████╗██████╔╝╚██████╔╝██║ ╚████║╚██████╔╝
  ╚═══╝   ╚══╝╚══╝      ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═════╝ ╚═╝╚══════╝╚═════╝  ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ 
                                                                                                         
EOF

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}  VW Ausbildungsberufe Kiosk-System - Installation v2.0${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Prüfen, ob das Skript als Root ausgeführt wird
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Dieses Skript muss mit Root-Rechten ausgeführt werden (sudo).${NC}"
  exit 1
fi

# Basisverzeichnisse
BASE_DIR="/opt/vw-ausbildung"
WEBSITE_DIR="/var/www/html/vw-ausbildung"
SERVER_DIR="$BASE_DIR/server"
LOGS_DIR="$BASE_DIR/logs"
BACKUP_DIR="$BASE_DIR/backups"
DB_DIR="$BASE_DIR/database"
CONFIG_DIR="$BASE_DIR/config"

# GitHub-Repository
GIT_REPO="https://github.com/LevinAnova/Abschlussprojekt-FISI.git"
GIT_BRANCH="main"

# Server- und Datenbank-Konfiguration
DB_HOST="localhost"
DB_USER="vwapp"
DB_PASS="fisi"
DB_NAME="vw_ausbildung"
SERVER_PORT="4848"
KIOSK_URL="http://localhost/landing.html"

# Systembenutzer 
CURRENT_USER=$(logname || echo "$SUDO_USER") # Aktueller Benutzer, der sudo verwendet
RPI_USER="pi" # Standard-Benutzer für den Kiosk-Modus

# Log-Datei einrichten
LOGFILE="$BASE_DIR/install_log.txt"
mkdir -p "$(dirname "$LOGFILE")"
touch "$LOGFILE"
exec > >(tee -a "$LOGFILE") 2>&1

# Funktionen
# ==========

# Allgemeine Hilfsfunktionen
# --------------------------
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[ERFOLG]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNUNG]${NC} $1"
}

log_error() {
  echo -e "${RED}[FEHLER]${NC} $1"
}

show_progress() {
  echo -e "${BLUE}[${1}%]${NC} $2"
}

confirm_continue() {
  read -p "Möchten Sie fortfahren? (j/N): " CONFIRM
  if [ "$CONFIRM" != "j" ] && [ "$CONFIRM" != "J" ]; then
    log_info "Installation abgebrochen."
    exit 0
  fi
}

handle_error() {
  log_error "$1"
  
  if [ "$2" == "critical" ]; then
    log_error "Kritischer Fehler: Die Installation wird abgebrochen."
    exit 1
  else
    log_warning "Die Installation wird fortgesetzt, es könnten jedoch Probleme auftreten."
    sleep 2
  fi
}

# System-Funktionen
# ----------------
check_system() {
  log_info "Prüfe System-Kompatibilität..."
  
  # Distributionsinformationen abrufen
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=$NAME
    OS_VERSION=$VERSION_ID
    OS_ID=$ID
  else
    OS_NAME=$(uname -s)
    OS_VERSION=$(uname -r)
    OS_ID="unknown"
  fi
  
  log_info "Erkanntes Betriebssystem: $OS_NAME $OS_VERSION"
  
  # Prüfen, ob es sich um ein Debian-basiertes System handelt
  if [[ "$OS_ID" == "debian" || "$OS_ID" == "ubuntu" || "$OS_ID" == "raspbian" ]]; then
    log_success "Kompatibles Betriebssystem erkannt."
  else
    log_warning "Unbekanntes Betriebssystem. Dieses Skript wurde für Debian-basierte Systeme wie Raspberry Pi OS, Debian oder Ubuntu optimiert."
    log_warning "Die Installation könnte auf diesem System nicht korrekt funktionieren."
    
    read -p "Trotzdem fortfahren? (j/N): " CONFIRM
    if [ "$CONFIRM" != "j" ] && [ "$CONFIRM" != "J" ]; then
      log_info "Installation abgebrochen."
      exit 0
    fi
  fi
  
  # Prüfen, ob die Hardware ein Raspberry Pi ist
  if [ -f /proc/device-tree/model ] && grep -q "Raspberry Pi" /proc/device-tree/model; then
    RPI_MODEL=$(tr -d '\0' < /proc/device-tree/model)
    IS_RPI=true
    log_success "Raspberry Pi erkannt: $RPI_MODEL"
    
    # Prüfen, ob der Pi-Benutzer existiert
    if id "$RPI_USER" &>/dev/null; then
      log_success "Raspberry Pi-Benutzer '$RPI_USER' gefunden."
    else
      log_warning "Raspberry Pi-Benutzer '$RPI_USER' nicht gefunden. Kiosk-Modus könnte beeinträchtigt sein."
      read -p "Bitte alternativen Benutzernamen eingeben (oder leer lassen für '$CURRENT_USER'): " NEW_RPI_USER
      RPI_USER=${NEW_RPI_USER:-$CURRENT_USER}
      log_info "Verwende '$RPI_USER' für den Kiosk-Modus."
    fi
  else
    IS_RPI=false
    log_info "Kein Raspberry Pi erkannt. Kiosk-Modus wird nicht konfiguriert."
  fi
  
  # Verfügbaren Speicherplatz prüfen
  FREE_SPACE=$(df -h / | awk 'NR==2 {print $4}')
  log_info "Verfügbarer Speicherplatz: $FREE_SPACE"
  
  FREE_SPACE_MB=$(df / | awk 'NR==2 {print $4}')
  if [ "$FREE_SPACE_MB" -lt 1000000 ]; then # Weniger als 1GB
    log_warning "Wenig freier Speicherplatz. Mindestens 1GB wird empfohlen."
    read -p "Trotzdem fortfahren? (j/N): " CONFIRM
    if [ "$CONFIRM" != "j" ] && [ "$CONFIRM" != "J" ]; then
      log_info "Installation abgebrochen."
      exit 0
    fi
  fi
  
  # RAM-Menge prüfen
  TOTAL_MEM=$(free -m | awk 'NR==2 {print $2}')
  log_info "Verfügbarer Arbeitsspeicher: ${TOTAL_MEM}MB"
  
  if [ "$TOTAL_MEM" -lt 1000 ]; then # Weniger als 1GB
    log_warning "Wenig Arbeitsspeicher. Das System könnte langsam laufen."
    log_info "Empfohlen werden mindestens 2GB RAM für optimale Performance."
  fi
}

update_system() {
  log_info "Aktualisiere System-Pakete..."
  apt update -q || handle_error "Fehler beim Aktualisieren der Paketlisten"
  apt upgrade -y -q || handle_error "Fehler beim Aktualisieren der Systempakete"
  log_success "Systempakete wurden aktualisiert."
}

install_base_packages() {
  log_info "Installiere grundlegende Pakete..."
  apt install -y curl wget git unzip apt-transport-https ca-certificates gnupg lsb-release htop || handle_error "Fehler bei der Installation grundlegender Pakete"
  log_success "Grundlegende Pakete wurden installiert."
}

setup_directories() {
  log_info "Erstelle Verzeichnisstruktur..."
  
  mkdir -p "$BASE_DIR" || handle_error "Konnte Basisverzeichnis nicht erstellen" "critical"
  mkdir -p "$WEBSITE_DIR" || handle_error "Konnte Website-Verzeichnis nicht erstellen" "critical"
  mkdir -p "$SERVER_DIR" || handle_error "Konnte Server-Verzeichnis nicht erstellen" "critical"
  mkdir -p "$LOGS_DIR" || handle_error "Konnte Logs-Verzeichnis nicht erstellen"
  mkdir -p "$BACKUP_DIR" || handle_error "Konnte Backup-Verzeichnis nicht erstellen"
  mkdir -p "$DB_DIR" || handle_error "Konnte Datenbank-Verzeichnis nicht erstellen"
  mkdir -p "$CONFIG_DIR" || handle_error "Konnte Konfigurations-Verzeichnis nicht erstellen"
  
  # Website-Unterverzeichnisse
  mkdir -p "$WEBSITE_DIR/uploads/gallery" || handle_error "Konnte Galerie-Upload-Verzeichnis nicht erstellen"
  mkdir -p "$WEBSITE_DIR/uploads/qr_codes" || handle_error "Konnte QR-Code-Upload-Verzeichnis nicht erstellen"
  mkdir -p "$WEBSITE_DIR/img" || handle_error "Konnte Bilder-Verzeichnis nicht erstellen"
  mkdir -p "$WEBSITE_DIR/js" || handle_error "Konnte JS-Verzeichnis nicht erstellen"
  mkdir -p "$WEBSITE_DIR/style" || handle_error "Konnte Style-Verzeichnis nicht erstellen"
  mkdir -p "$WEBSITE_DIR/tests" || handle_error "Konnte Tests-Verzeichnis nicht erstellen"
  mkdir -p "$WEBSITE_DIR/fonts" || handle_error "Konnte Fonts-Verzeichnis nicht erstellen"
  
  # Berechtigungen setzen
  chown -R "$CURRENT_USER:$CURRENT_USER" "$BASE_DIR" || handle_error "Konnte Berechtigungen für Basisverzeichnis nicht setzen"
  chown -R www-data:www-data "$WEBSITE_DIR" || handle_error "Konnte Berechtigungen für Website-Verzeichnis nicht setzen"
  
  log_success "Verzeichnisstruktur wurde erstellt."
}

# Installation von Komponenten
# ---------------------------
install_mariadb() {
  log_info "Installiere MariaDB-Server..."
  apt install -y mariadb-server || handle_error "Fehler bei der Installation von MariaDB" "critical"

  # Prüfen, ob MariaDB läuft
  if ! systemctl is-active --quiet mariadb; then
    systemctl start mariadb || handle_error "Konnte MariaDB-Dienst nicht starten" "critical"
  fi
  
  systemctl enable mariadb || handle_error "Konnte MariaDB-Dienst nicht aktivieren"

  log_success "MariaDB wurde installiert und aktiviert."
  
  # Datenbank und Benutzer einrichten
  log_info "Richte Datenbank und Benutzer ein..."
  
  # Prüfen, ob Datenbank bereits existiert
  DB_EXISTS=$(mysql -e "SHOW DATABASES LIKE '$DB_NAME';" | grep -c "$DB_NAME")
  
  if [ "$DB_EXISTS" -eq 0 ]; then
    mysql -e "CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || handle_error "Konnte Datenbank nicht erstellen" "critical"
    
    # Benutzer anlegen und Rechte erteilen
    mysql -e "CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';" || handle_error "Konnte Datenbankbenutzer nicht erstellen" "critical"
    mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';" || handle_error "Konnte Benutzerrechte nicht setzen" "critical"
    mysql -e "FLUSH PRIVILEGES;" || handle_error "Konnte Benutzerrechte nicht aktualisieren"
    
    log_success "Datenbank und Benutzer wurden eingerichtet."
  else
    log_info "Datenbank existiert bereits."
  fi
  
  # Datenbankschema importieren
  log_info "Importiere Datenbankschema..."
  
  # Hier das Schema aus der Datei importieren oder direkt als Skript ausführen
  cat > "$CONFIG_DIR/db_schema.sql" <<EOL
-- Datenbank Schema für VW Ausbildungsberufe
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS professions (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    duration VARCHAR(50) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    has_knowledge_test BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS requirements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profession_id VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS career_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profession_id VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profession_id VARCHAR(50) NOT NULL,
    text VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gallery_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profession_id VARCHAR(50) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    alt_text VARCHAR(255),
    sort_order INT NOT NULL DEFAULT 0,
    FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS qr_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profession_id VARCHAR(50) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS knowledge_tests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profession_id VARCHAR(50) NOT NULL,
    title VARCHAR(100) NOT NULL,
    intro_text TEXT,
    status ENUM('draft', 'published') DEFAULT 'draft',
    FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE,
    UNIQUE KEY (profession_id)
);

CREATE TABLE IF NOT EXISTS test_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_id INT NOT NULL,
    question TEXT NOT NULL,
    explanation TEXT,
    sort_order INT DEFAULT 0,
    FOREIGN KEY (test_id) REFERENCES knowledge_tests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS answer_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    FOREIGN KEY (question_id) REFERENCES test_questions(id) ON DELETE CASCADE
);

-- Benutzerverwaltung
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'editor') DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOL
  
  mysql "$DB_NAME" < "$CONFIG_DIR/db_schema.sql" || handle_error "Fehler beim Importieren des Datenbankschemas" "critical"
  
  log_success "Datenbankschema wurde importiert."
}

install_nodejs() {
  log_info "Installiere Node.js..."
  
  # Prüfen, ob Node.js bereits installiert ist
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    log_info "Node.js ist bereits installiert: $NODE_VERSION"
    
    # Prüfen, ob die Version aktuell genug ist (mindestens 16)
    NODE_MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d '.' -f 1 | tr -d 'v')
    if [ "$NODE_MAJOR_VERSION" -lt 16 ]; then
      log_warning "Node.js-Version ist zu niedrig. Mindestens v16 wird benötigt."
    else
      log_success "Node.js-Version ist ausreichend."
      return 0
    fi
  fi
  
  # NodeSource-Repository hinzufügen
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash - || handle_error "Fehler beim Einrichten des NodeSource-Repositories" "critical"
  
  # Node.js installieren
  apt install -y nodejs || handle_error "Fehler bei der Installation von Node.js" "critical"
  
  # Version überprüfen
  NODE_VERSION=$(node -v)
  log_success "Node.js wurde installiert: $NODE_VERSION"
  
  # npm Update
  npm install -g npm || handle_error "Fehler beim Aktualisieren von npm"
  log_success "npm wurde aktualisiert: $(npm -v)"
}

install_nginx() {
  log_info "Installiere und konfiguriere Nginx..."
  
  # Prüfen, ob Nginx bereits installiert ist
  if command -v nginx &> /dev/null; then
    log_info "Nginx ist bereits installiert."
  else
    apt install -y nginx || handle_error "Fehler bei der Installation von Nginx" "critical"
    log_success "Nginx wurde installiert."
  fi
  
  # Nginx starten und aktivieren
  systemctl start nginx || handle_error "Konnte Nginx-Dienst nicht starten"
  systemctl enable nginx || handle_error "Konnte Nginx-Dienst nicht aktivieren"
  
  # Nginx-Konfiguration für VW Ausbildungsberufe erstellen
  log_info "Erstelle Nginx-Konfiguration..."
  
  cat > /etc/nginx/sites-available/vw-ausbildung <<EOL
# VW Ausbildungsberufe Nginx-Konfiguration

server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root $WEBSITE_DIR;
    index index.html;

    # Verbessertes Logging
    access_log $LOGS_DIR/nginx_access.log;
    error_log $LOGS_DIR/nginx_error.log;

    server_name _;

    # Gzip-Kompression aktivieren für bessere Performance
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
    
    # Proxy für Backend API
    location /api/ {
        proxy_pass http://localhost:$SERVER_PORT/api/;
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
EOL
  
  # Default-Konfiguration deaktivieren und unsere aktivieren
  if [ -f /etc/nginx/sites-enabled/default ]; then
    rm -f /etc/nginx/sites-enabled/default || handle_error "Konnte default-Konfiguration nicht entfernen"
  fi
  
  ln -sf /etc/nginx/sites-available/vw-ausbildung /etc/nginx/sites-enabled/ || handle_error "Konnte VW-Ausbildung-Konfiguration nicht aktivieren"
  
  # Nginx-Konfiguration überprüfen
  nginx -t || handle_error "Nginx-Konfiguration enthält Fehler" "critical"
  
  # Nginx neustarten
  systemctl restart nginx || handle_error "Konnte Nginx-Dienst nicht neustarten"
  
  log_success "Nginx wurde konfiguriert und neugestartet."
}

# Backend-Server
setup_backend() {
  log_info "Richte Backend-Server ein..."
  
  # Erstelle Verzeichnis für den Server
  mkdir -p "$SERVER_DIR" || handle_error "Konnte Server-Verzeichnis nicht erstellen" "critical"
  
  # package.json erstellen
  cat > "$SERVER_DIR/package.json" <<EOL
{
  "name": "vw-ausbildung-server",
  "version": "2.0.0",
  "description": "Backend-Server für VW Ausbildungsberufe Kiosk-System",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "express-mysql-session": "^3.0.0",
    "express-session": "^1.17.3",
    "formidable": "^2.1.1",
    "mysql2": "^3.2.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOL
  
  # server.js - Hier nur ein Platzhalter, da das Original aus dem Repo kopiert wird
  cat > "$SERVER_DIR/server.js" <<EOL
// Dies ist ein Platzhalter - Die vollständige server.js-Datei wird aus dem Repository kopiert
console.log('Server wird initialisiert...');
EOL
  
  # npm-Pakete installieren
  cd "$SERVER_DIR" || handle_error "Konnte nicht in Server-Verzeichnis wechseln" "critical"
  npm install || handle_error "Fehler bei der Installation der npm-Pakete"
  
  # Systemd-Service für den Backend-Server erstellen
  log_info "Erstelle systemd-Service für den Backend-Server..."
  
  cat > /etc/systemd/system/vw-ausbildung-api.service <<EOL
[Unit]
Description=VW Ausbildung Backend API Server
After=network.target mariadb.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$SERVER_DIR
ExecStart=$(which node) server.js
Restart=on-failure
RestartSec=10
StandardOutput=append:$LOGS_DIR/api_output.log
StandardError=append:$LOGS_DIR/api_error.log
Environment=NODE_ENV=production
Environment=PORT=$SERVER_PORT
Environment=DB_HOST=$DB_HOST
Environment=DB_USER=$DB_USER
Environment=DB_PASS=$DB_PASS
Environment=DB_NAME=$DB_NAME

[Install]
WantedBy=multi-user.target
EOL
  
  # Rechte anpassen
  chmod 644 /etc/systemd/system/vw-ausbildung-api.service || handle_error "Konnte Rechte für Service-Datei nicht ändern"
  
  # systemd aktualisieren
  systemctl daemon-reload || handle_error "Konnte systemd-Daemon nicht neu laden"
  
  # Service aktivieren, aber noch nicht starten
  systemctl enable vw-ausbildung-api.service || handle_error "Konnte API-Service nicht aktivieren"
  
  log_success "Backend-Server wurde eingerichtet."
}

# Kiosk-Modus-Setup
setup_kiosk_mode() {
  if [ "$IS_RPI" = false ]; then
    log_info "Kein Raspberry Pi erkannt - Kiosk-Modus-Setup wird übersprungen."
    return 0
  fi
  
  log_info "Richte Kiosk-Modus für Raspberry Pi ein..."
  
  # Notwendige Pakete installieren
  apt install -y xserver-xorg x11-xserver-utils xinit chromium-browser unclutter || handle_error "Fehler beim Installieren der Kiosk-Modus-Pakete"
  
  # Autologin für den Raspberry Pi-Benutzer einrichten
  if [ -d /etc/lightdm ]; then
    # Für LightDM (neuere Raspberry Pi OS-Versionen)
    cat > /etc/lightdm/lightdm.conf.d/60-autologin.conf <<EOL
[Seat:*]
autologin-user=$RPI_USER
autologin-user-timeout=0
EOL
  elif [ -f /etc/systemd/system/getty@tty1.service.d/autologin.conf ]; then
    # Falls autologin.conf bereits existiert, die relevante Zeile ändern
    sed -i "s/ExecStart=.*/ExecStart=-\/sbin\/agetty --autologin $RPI_USER --noclear %I \$TERM/" /etc/systemd/system/getty@tty1.service.d/autologin.conf
  else
    # Für ältere Raspberry Pi OS-Versionen
    mkdir -p /etc/systemd/system/getty@tty1.service.d/
    cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOL
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $RPI_USER --noclear %I $TERM
EOL
  fi
  
  # Kiosk-Autostart-Skript erstellen
  mkdir -p "$CONFIG_DIR/kiosk" || handle_error "Konnte Kiosk-Konfigurationsverzeichnis nicht erstellen"
  
  cat > "$CONFIG_DIR/kiosk/kiosk.sh" <<EOL
#!/bin/bash

# VW Ausbildungsberufe Kiosk-Modus Autostart
# Startet Chromium im Kiosk-Modus mit der VW Ausbildungsberufe-Webseite

# Logging aktivieren
exec &> $LOGS_DIR/kiosk.log

echo "=== VW Ausbildungsberufe Kiosk-Modus Autostart ==="
echo "Gestartet am: \$(date)"
echo "Ausgeführt als: \$(whoami)"

# Konfiguration
KIOSK_URL="$KIOSK_URL"
DISPLAY_TO_USE=":0"

# Bildschirmschoner deaktivieren und Energiesparoptionen
xset -display \$DISPLAY_TO_USE s off
xset -display \$DISPLAY_TO_USE s noblank
xset -display \$DISPLAY_TO_USE -dpms

# Mauszeiger ausblenden nach 3 Sekunden Inaktivität
unclutter -display \$DISPLAY_TO_USE -idle 3 &

# Warte auf Netzwerk und prüfe, ob der Server läuft
echo "Warte auf API-Server..."
while ! curl -s http://localhost:$SERVER_PORT/api > /dev/null; do
  echo "API-Server ist noch nicht verfügbar, warte 5 Sekunden..."
  sleep 5
done

# Chromium im Kiosk-Modus starten
chromium-browser --noerrdialogs --disable-infobars --disable-translate \
                 --disable-features=TranslateUI --disable-session-crashed-bubble \
                 --kiosk \$KIOSK_URL
EOL
  
  chmod +x "$CONFIG_DIR/kiosk/kiosk.sh" || handle_error "Konnte Kiosk-Skript nicht ausführbar machen"
  
  # Autostart-Eintrag für den Pi-Benutzer erstellen
  RPI_HOME=$(getent passwd "$RPI_USER" | cut -d: -f6)
  mkdir -p "$RPI_HOME/.config/autostart" || handle_error "Konnte Autostart-Verzeichnis nicht erstellen"
  
  cat > "$RPI_HOME/.config/autostart/vw-kiosk.desktop" <<EOL
[Desktop Entry]
Type=Application
Name=VW Ausbildungsberufe Kiosk
Exec=$CONFIG_DIR/kiosk/kiosk.sh
Terminal=false
Hidden=false
EOL
  
  # Eigentümerrechte anpassen
  chown -R "$RPI_USER:$RPI_USER" "$RPI_HOME/.config" || handle_error "Konnte Berechtigungen für Autostart-Verzeichnis nicht setzen"
  
  # systemd-Einheit für den Kiosk-Modus (Alternative zum Autostart)
  cat > /etc/systemd/system/vw-kiosk.service <<EOL
[Unit]
Description=VW Ausbildungsberufe Kiosk-Modus
After=graphical.target vw-ausbildung-api.service

[Service]
Type=simple
User=$RPI_USER
Environment=DISPLAY=:0
ExecStart=$CONFIG_DIR/kiosk/kiosk.sh
Restart=on-failure
RestartSec=10
StandardOutput=append:$LOGS_DIR/kiosk_output.log
StandardError=append:$LOGS_DIR/kiosk_error.log

[Install]
WantedBy=graphical.target
EOL
  
  # Rechte anpassen
  chmod 644 /etc/systemd/system/vw-kiosk.service || handle_error "Konnte Rechte für Kiosk-Service-Datei nicht ändern"
  
  # systemd aktualisieren
  systemctl daemon-reload || handle_error "Konnte systemd-Daemon nicht neu laden"
  
  # Service aktivieren, aber noch nicht starten
  systemctl enable vw-kiosk.service || handle_error "Konnte Kiosk-Service nicht aktivieren"
  
  log_success "Kiosk-Modus wurde eingerichtet."
}

# Raspberry Pi Optimierungen
optimize_raspberry_pi() {
  if [ "$IS_RPI" = false ]; then
    log_info "Kein Raspberry Pi erkannt - Optimierungen werden übersprungen."
    return 0
  fi
  
  log_info "Optimiere Raspberry Pi..."
  
  # Swap-Größe erhöhen
  if [ -f /etc/dphys-swapfile ]; then
    sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/g' /etc/dphys-swapfile || handle_error "Konnte Swap-Größe nicht anpassen"
    /etc/init.d/dphys-swapfile restart || handle_error "Konnte Swap-Dienst nicht neustarten"
    log_success "Swap-Größe wurde auf 1GB erhöht."
  else
    log_warning "dphys-swapfile nicht gefunden. Swap-Größe wurde nicht angepasst."
  fi
  
  # CPU-Leistung optimieren
  if [ -d /sys/devices/system/cpu/cpu0/cpufreq ]; then
    for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
      echo "performance" > "$cpu" || handle_error "Konnte CPU-Governeur nicht setzen"
    done
    
    # Gouverneur dauerhaft einstellen
    echo 'GOVERNOR="performance"' > /etc/default/cpufrequtils || handle_error "Konnte CPU-Governeur-Einstellung nicht speichern"
    log_success "CPU-Leistung wurde optimiert."
  else
    log_warning "CPU-Frequenzsteuerung nicht verfügbar. CPU-Leistung wurde nicht optimiert."
  fi
  
  # Übertaktung (optional)
  log_info "Möchten Sie den Raspberry Pi leicht übertakten für bessere Leistung?"
  log_info "Dies kann die Lebensdauer verkürzen und erfordert möglicherweise aktive Kühlung."
  read -p "Übertakten? (j/N): " OVERCLOCK
  
  if [ "$OVERCLOCK" = "j" ] || [ "$OVERCLOCK" = "J" ]; then
    if [ -f /boot/config.txt ]; then
      cat >> /boot/config.txt <<EOL

# VW Ausbildungsberufe Übertaktungseinstellungen
arm_freq=1750
gpu_freq=600
over_voltage=2
EOL
      log_success "Übertaktungseinstellungen wurden hinzugefügt. Ein Neustart ist erforderlich."
    else
      log_warning "Boot-Konfigurationsdatei nicht gefunden. Übertaktung wurde nicht eingerichtet."
    fi
  else
    log_info "Übertaktung wurde nicht eingerichtet."
  fi
  
  # Energieoptionen (Bildschirm nicht ausschalten)
  if [ -f /etc/xdg/lxsession/LXDE-pi/autostart ]; then
    cat >> /etc/xdg/lxsession/LXDE-pi/autostart <<EOL

# VW Ausbildungsberufe Energieeinstellungen
@xset s off
@xset -dpms
@xset s noblank
EOL
    log_success "Energieeinstellungen wurden angepasst."
  else
    log_warning "LXDE-Autostart-Datei nicht gefunden. Energieeinstellungen wurden nicht angepasst."
  fi
  
  log_success "Raspberry Pi wurde optimiert."
}

# Website-Komponenten
deploy_website() {
  log_info "Deploye Website-Dateien..."
  
  # Temporäres Verzeichnis für Git-Repository
  TEMP_DIR=$(mktemp -d) || handle_error "Konnte temporäres Verzeichnis nicht erstellen" "critical"
  
  # Repository klonen
  log_info "Klone Git-Repository in temporäres Verzeichnis..."
  git clone --depth 1 "$GIT_REPO" -b "$GIT_BRANCH" "$TEMP_DIR" || handle_error "Konnte Repository nicht klonen" "critical"
  
  # Dateien kopieren
  log_info "Kopiere Website-Dateien..."
  
  # Frontend-Dateien
  cp -r "$TEMP_DIR/index.html" "$WEBSITE_DIR/" 2>/dev/null || log_warning "index.html nicht gefunden"
  cp -r "$TEMP_DIR/landing.html" "$WEBSITE_DIR/" 2>/dev/null || log_warning "landing.html nicht gefunden"
  cp -r "$TEMP_DIR/manifest.json" "$WEBSITE_DIR/" 2>/dev/null || log_warning "manifest.json nicht gefunden"
  cp -r "$TEMP_DIR/service-worker.js" "$WEBSITE_DIR/" 2>/dev/null || log_warning "service-worker.js nicht gefunden"
  
  # Verzeichnisse kopieren
  if [ -d "$TEMP_DIR/style" ]; then
    cp -r "$TEMP_DIR/style/." "$WEBSITE_DIR/style/" || handle_error "Konnte Style-Dateien nicht kopieren"
  else
    log_warning "Style-Verzeichnis nicht gefunden"
  fi
  
  if [ -d "$TEMP_DIR/js" ]; then
    cp -r "$TEMP_DIR/js/." "$WEBSITE_DIR/js/" || handle_error "Konnte JS-Dateien nicht kopieren"
  else
    log_warning "JS-Verzeichnis nicht gefunden"
  fi
  
  if [ -d "$TEMP_DIR/img" ]; then
    cp -r "$TEMP_DIR/img/." "$WEBSITE_DIR/img/" || handle_error "Konnte Bild-Dateien nicht kopieren"
  else
    log_warning "Bild-Verzeichnis nicht gefunden"
  fi
  
  if [ -d "$TEMP_DIR/fonts" ]; then
    cp -r "$TEMP_DIR/fonts/." "$WEBSITE_DIR/fonts/" || handle_error "Konnte Font-Dateien nicht kopieren"
  else
    log_warning "Font-Verzeichnis nicht gefunden"
  fi
  
  if [ -d "$TEMP_DIR/tests" ]; then
    cp -r "$TEMP_DIR/tests/." "$WEBSITE_DIR/tests/" || handle_error "Konnte Test-Dateien nicht kopieren"
  else
    log_warning "Test-Verzeichnis nicht gefunden"
  fi
  
  # Insbesondere neue Wissenstests
  if [ -f "$TEMP_DIR/tests/chemielaborant.html" ]; then
    cp -r "$TEMP_DIR/tests/chemielaborant.html" "$WEBSITE_DIR/tests/" || handle_error "Konnte Chemielaborant-Test nicht kopieren"
  fi
  
  if [ -f "$TEMP_DIR/tests/metalltechnik.html" ]; then
    cp -r "$TEMP_DIR/tests/metalltechnik.html" "$WEBSITE_DIR/tests/" || handle_error "Konnte Metalltechnik-Test nicht kopieren"
  fi
  
  if [ -f "$TEMP_DIR/tests/eat.html" ]; then
    cp -r "$TEMP_DIR/tests/eat.html" "$WEBSITE_DIR/tests/" || handle_error "Konnte EAT-Test nicht kopieren"
  fi
  
  # Server-Dateien
  if [ -f "$TEMP_DIR/server.js" ]; then
    cp "$TEMP_DIR/server.js" "$SERVER_DIR/" || handle_error "Konnte server.js nicht kopieren"
    log_success "Server-Skript wurde kopiert."
  else
    log_warning "server.js nicht gefunden im Repository"
  fi
  
  # Translation.js (Übersetzungsdatei)
  if [ -f "$TEMP_DIR/translation.js" ]; then
    cp "$TEMP_DIR/translation.js" "$WEBSITE_DIR/js/" || handle_error "Konnte translation.js nicht kopieren"
    log_success "Übersetzungsdatei wurde kopiert."
  fi
  
  # Berechtigungen anpassen
  log_info "Passe Berechtigungen an..."
  find "$WEBSITE_DIR" -type d -exec chmod 755 {} \; || handle_error "Konnte Berechtigungen für Verzeichnisse nicht setzen"
  find "$WEBSITE_DIR" -type f -exec chmod 644 {} \; || handle_error "Konnte Berechtigungen für Dateien nicht setzen"
  chown -R www-data:www-data "$WEBSITE_DIR" || handle_error "Konnte Eigentümerrechte nicht setzen"
  
  # Upload-Verzeichnisse beschreibbar machen
  chmod -R 775 "$WEBSITE_DIR/uploads" || handle_error "Konnte Berechtigungen für Upload-Verzeichnis nicht setzen"
  
  log_success "Website-Dateien wurden bereitgestellt."
  
  # Temporäres Verzeichnis aufräumen
  rm -rf "$TEMP_DIR" || handle_error "Konnte temporäres Verzeichnis nicht entfernen"
}

# Admin-Benutzer erstellen
create_admin_user() {
  log_info "Erstelle Admin-Benutzer..."
  
  # Zufälliges Passwort generieren
  ADMIN_PASSWORD=$(tr -dc A-Za-z0-9 </dev/urandom | head -c 12)
  
  # Admin-Benutzer erstellen
  cd "$SERVER_DIR" || handle_error "Konnte nicht in Server-Verzeichnis wechseln" "critical"
  
  # Temporäres Skript erstellen
  cat > create_admin.js <<EOL
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function createAdminUser() {
  try {
    // Datenbankverbindung herstellen
    const connection = await mysql.createConnection({
      host: '$DB_HOST',
      user: '$DB_USER',
      password: '$DB_PASS',
      database: '$DB_NAME'
    });
    
    // Prüfen, ob bereits ein Admin existiert
    const [admins] = await connection.execute('SELECT id FROM users WHERE username = ?', ['admin']);
    
    if (admins.length > 0) {
      console.log('Admin-Benutzer existiert bereits.');
      connection.end();
      return false;
    }
    
    // Passwort hashen
    const hashedPassword = await bcrypt.hash('$ADMIN_PASSWORD', 10);
    
    // Admin-Benutzer erstellen
    await connection.execute(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      ['admin', hashedPassword, 'admin']
    );
    
    console.log('Admin-Benutzer wurde erfolgreich erstellt.');
    connection.end();
    return true;
  } catch (error) {
    console.error('Fehler beim Erstellen des Admin-Benutzers:', error);
    return false;
  }
}

createAdminUser();
EOL
  
  # Node.js-Skript ausführen
  if node create_admin.js; then
    log_success "Admin-Benutzer wurde erstellt."
    
    # Zugangsdaten speichern
    echo "Admin-Benutzername: admin" > "$BASE_DIR/admin_credentials.txt"
    echo "Admin-Passwort: $ADMIN_PASSWORD" >> "$BASE_DIR/admin_credentials.txt"
    chmod 600 "$BASE_DIR/admin_credentials.txt" || handle_error "Konnte Berechtigungen für Anmeldedaten-Datei nicht setzen"
    chown "$CURRENT_USER:$CURRENT_USER" "$BASE_DIR/admin_credentials.txt" || handle_error "Konnte Eigentümerrechte für Anmeldedaten-Datei nicht setzen"
    
    log_success "Admin-Anmeldedaten wurden in $BASE_DIR/admin_credentials.txt gespeichert."
  else
    log_error "Fehler beim Erstellen des Admin-Benutzers."
  fi
  
  # Temporäres Skript entfernen
  rm create_admin.js
}

# Starte Dienste
start_services() {
  log_info "Starte Dienste..."
  
  # Neustart von Nginx (falls noch nicht geschehen)
  systemctl restart nginx || handle_error "Konnte Nginx-Dienst nicht neustarten"
  
  # API-Server starten
  systemctl start vw-ausbildung-api.service || handle_error "Konnte API-Server nicht starten"
  
  # Kiosk-Modus starten, falls auf einem Raspberry Pi
  if [ "$IS_RPI" = true ]; then
    log_info "Der Kiosk-Modus wird nach einem Neustart automatisch gestartet."
    log_info "Möchten Sie jetzt manuell neu starten?"
    read -p "Jetzt neustarten? (j/N): " REBOOT_NOW
    
    if [ "$REBOOT_NOW" = "j" ] || [ "$REBOOT_NOW" = "J" ]; then
      log_info "System wird in 5 Sekunden neu gestartet..."
      sleep 5
      reboot
    else
      log_info "System wird nicht neugestartet. Sie können später manuell mit 'sudo reboot' neustarten."
    fi
  else
    log_success "Dienste wurden gestartet."
  fi
}

# Hauptfunktion
# =============
main() {
  echo -e "${BLUE}Willkommen beim VW Ausbildungsberufe Kiosk-System Setup v2.0${NC}"
  echo ""
  echo "Dieses Skript richtet das VW Ausbildungsberufe Kiosk-System auf Ihrem Computer ein."
  echo "Es werden folgende Komponenten installiert und konfiguriert:"
  echo " * Webserver (Nginx)"
  echo " * Datenbank (MariaDB)"
  echo " * Backend-Server (Node.js)"
  echo " * Website-Dateien"
  echo " * Wissenstests"
  
  if [ "$IS_RPI" = true ]; then
    echo " * Kiosk-Modus für Raspberry Pi"
    echo " * Raspberry Pi-Optimierungen"
  fi
  
  echo ""
  echo "WARNUNG: Dieses Skript sollte auf einem frischen System ausgeführt werden."
  echo "Bereits vorhandene Konfigurationen könnten überschrieben werden."
  echo ""
  
  confirm_continue
  
  # Einzelne Installationsschritte ausführen
  check_system
  update_system
  install_base_packages
  setup_directories
  install_mariadb
  install_nodejs
  install_nginx
  setup_backend
  deploy_website
  create_admin_user
  
  if [ "$IS_RPI" = true ]; then
    setup_kiosk_mode
    optimize_raspberry_pi
  fi
  
  start_services
  
  # Installation abgeschlossen
  echo ""
  echo -e "${GREEN}============================================================================${NC}"
  echo -e "${GREEN}  VW Ausbildungsberufe Kiosk-System - Installation abgeschlossen!${NC}"
  echo -e "${GREEN}============================================================================${NC}"
  echo ""
  echo -e "Die Installation wurde erfolgreich abgeschlossen. Sie können auf das System über folgende URLs zugreifen:"
  echo -e "  * Website: ${BLUE}http://localhost${NC}"
  echo -e "  * Admin-Oberfläche: ${BLUE}http://localhost/admin.html${NC}"
  echo ""
  echo -e "Admin-Anmeldedaten:"
  echo -e "  * Benutzername: ${BLUE}admin${NC}"
  echo -e "  * Passwort: ${BLUE}$ADMIN_PASSWORD${NC}"
  echo ""
  echo -e "Diese Informationen wurden auch in folgender Datei gespeichert:"
  echo -e "  * ${BLUE}$BASE_DIR/admin_credentials.txt${NC}"
  echo ""
  
  if [ "$IS_RPI" = true ]; then
    echo -e "${YELLOW}HINWEIS: Bitte starten Sie den Raspberry Pi neu, um den Kiosk-Modus zu aktivieren.${NC}"
    echo -e "Nach dem Neustart wird die Website automatisch im Vollbildmodus gestartet."
    echo ""
  fi
  
  echo -e "Bei Problemen überprüfen Sie bitte die Log-Dateien im Verzeichnis ${BLUE}$LOGS_DIR${NC}"
  echo ""
  echo -e "Die Installationsdetails wurden in der Datei ${BLUE}$LOGFILE${NC} gespeichert."
  echo ""
  echo -e "${GREEN}Vielen Dank für die Installation des VW Ausbildungsberufe Kiosk-Systems!${NC}"
}

# Skript starten
main "$@"