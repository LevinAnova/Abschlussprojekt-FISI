#!/bin/bash
# Deinstallations-Skript für Volkswagen Ausbildungsberufe CMS auf dem Raspberry Pi 5
# Entfernt alle Installationen und setzt das System zurück

echo "======================================================================"
echo "  Volkswagen Ausbildungsberufe CMS - Deinstallation"
echo "======================================================================"
echo ""

# Prüfen, ob das Skript als Root ausgeführt wird
if [ "$EUID" -ne 0 ]; then
  echo "Dieses Skript muss mit Root-Rechten ausgeführt werden (sudo)."
  exit 1
fi

# Variablen und Konfiguration aus dem Installationsskript übernehmen
WEBSITE_DIR="/var/www/html/vw-ausbildung"
CMS_DIR="/opt/vw-ausbildung-cms"
NGINX_SITE_CONFIG="/etc/nginx/sites-available/vw-ausbildung"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/vw-ausbildung"
USERNAME=$(logname || echo "$SUDO_USER")

# Funktion für Fehlerbehandlung
handle_error() {
    echo "FEHLER: $1" >&2
    echo "Die Deinstallation wird fortgesetzt..."
}

# Funktion zum Anzeigen von Fortschritt
show_progress() {
    echo ""
    echo "[$(($1*100/$2))%] $3"
}

echo "ACHTUNG: Dieses Skript wird alle Komponenten des Volkswagen Ausbildungsberufe CMS"
echo "vom System entfernen. Alle Daten gehen dabei verloren!"
echo ""
read -p "Möchten Sie wirklich fortfahren? (j/N): " CONFIRM

if [ "$CONFIRM" != "j" ] && [ "$CONFIRM" != "J" ]; then
    echo "Deinstallation abgebrochen."
    exit 0
fi

# 1. Direktus-Service stoppen und entfernen
show_progress 1 10 "Direktus-Service wird gestoppt und entfernt..."
systemctl stop directus 2>/dev/null || handle_error "Direktus-Service konnte nicht gestoppt werden"
systemctl disable directus 2>/dev/null || handle_error "Direktus-Service konnte nicht deaktiviert werden"
rm -f /etc/systemd/system/directus.service || handle_error "Direktus-Service-Datei konnte nicht entfernt werden"
systemctl daemon-reload || handle_error "Systemd Daemon-Reload fehlgeschlagen"

# 2. Nginx-Konfiguration zurücksetzen
show_progress 2 10 "Nginx-Konfiguration wird zurückgesetzt..."
rm -f "$NGINX_SITE_ENABLED" || handle_error "Nginx-Site konnte nicht deaktiviert werden"
rm -f "$NGINX_SITE_CONFIG" || handle_error "Nginx-Site-Konfiguration konnte nicht entfernt werden"

# Standardkonfiguration wiederherstellen
if [ ! -f /etc/nginx/sites-enabled/default ] && [ -f /etc/nginx/sites-available/default ]; then
    ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default || handle_error "Nginx-Standard-Site konnte nicht aktiviert werden"
fi

systemctl restart nginx || handle_error "Nginx konnte nicht neu gestartet werden"

# 3. Website-Dateien entfernen
show_progress 3 10 "Website-Dateien werden entfernt..."
if [ -d "$WEBSITE_DIR" ]; then
    rm -rf "$WEBSITE_DIR" || handle_error "Website-Verzeichnis konnte nicht entfernt werden"
    echo "Website-Verzeichnis wurde entfernt."
else
    echo "Website-Verzeichnis wurde nicht gefunden, überspringe..."
fi

# 4. CMS-Verzeichnis entfernen
show_progress 4 10 "CMS-Verzeichnis wird entfernt..."
if [ -d "$CMS_DIR" ]; then
    rm -rf "$CMS_DIR" || handle_error "CMS-Verzeichnis konnte nicht entfernt werden"
    echo "CMS-Verzeichnis wurde entfernt."
else
    echo "CMS-Verzeichnis wurde nicht gefunden, überspringe..."
fi

# 5. Lokale DNS-Einträge entfernen
show_progress 5 10 "Lokale DNS-Einträge werden entfernt..."
if [ -f /etc/hosts ]; then
    sed -i '/# Lokale Einträge für Volkswagen Ausbildungsberufe/d' /etc/hosts || handle_error "Konnte Kommentar aus hosts-Datei nicht entfernen"
    sed -i '/127.0.0.1 vw-ausbildung.local cms.vw-ausbildung.local/d' /etc/hosts || handle_error "Konnte Einträge aus hosts-Datei nicht entfernen"
    echo "DNS-Einträge wurden entfernt."
else
    echo "hosts-Datei wurde nicht gefunden, überspringe..."
fi

# 6. Avahi-Service entfernen
show_progress 6 10 "Avahi-Service wird entfernt..."
if [ -f /etc/avahi/services/vw-ausbildung.service ]; then
    rm -f /etc/avahi/services/vw-ausbildung.service || handle_error "Avahi-Service-Datei konnte nicht entfernt werden"
    systemctl restart avahi-daemon 2>/dev/null || handle_error "Avahi-Daemon konnte nicht neu gestartet werden"
    echo "Avahi-Service wurde entfernt."
else
    echo "Avahi-Service-Datei wurde nicht gefunden, überspringe..."
fi

# 7. Swap-Größe zurücksetzen
show_progress 7 10 "Swap-Größe wird zurückgesetzt..."
if [ -f /etc/dphys-swapfile ]; then
    sed -i 's/CONF_SWAPSIZE=1024/CONF_SWAPSIZE=100/g' /etc/dphys-swapfile || handle_error "Swap-Größe konnte nicht zurückgesetzt werden"
    /etc/init.d/dphys-swapfile restart 2>/dev/null || handle_error "Swap-Dienst konnte nicht neu gestartet werden"
    echo "Swap-Größe wurde zurückgesetzt."
else
    echo "Swap-Konfigurationsdatei wurde nicht gefunden, überspringe..."
fi

# 8. CPU-Governeur zurücksetzen
show_progress 8 10 "CPU-Governeur wird zurückgesetzt..."
if [ -d /sys/devices/system/cpu/cpu0/cpufreq ]; then
    echo "ondemand" > /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || handle_error "CPU-Governeur konnte nicht zurückgesetzt werden"
    if [ -f /etc/default/cpufrequtils ]; then
        rm -f /etc/default/cpufrequtils || echo 'GOVERNOR="ondemand"' > /etc/default/cpufrequtils
    fi
    echo "CPU-Governeur wurde zurückgesetzt."
else
    echo "CPU-Frequenzsteuerung nicht verfügbar, überspringe..."
fi

# 9. Admin-Zugangsdaten entfernen
show_progress 9 10 "Admin-Zugangsdaten werden entfernt..."
if [ -f "/home/$USERNAME/vw-cms-admin-credentials.txt" ]; then
    rm -f "/home/$USERNAME/vw-cms-admin-credentials.txt" || handle_error "Admin-Zugangsdaten konnten nicht entfernt werden"
    echo "Admin-Zugangsdaten wurden entfernt."
else
    echo "Admin-Zugangsdaten wurden nicht gefunden, überspringe..."
fi

# 10. Optional: Installierte Pakete entfernen
show_progress 10 10 "System wird bereinigt..."
echo "Möchten Sie auch die installierten Pakete (Node.js, nginx, etc.) entfernen?"
echo "Dies kann andere Anwendungen beeinträchtigen, die diese Pakete nutzen."
read -p "Pakete entfernen? (j/N): " REMOVE_PACKAGES

if [ "$REMOVE_PACKAGES" = "j" ] || [ "$REMOVE_PACKAGES" = "J" ]; then
    echo "Paketentfernung wurde ausgewählt. Entferne Pakete..."
    
    # Node.js entfernen
    apt remove -y nodejs npm || handle_error "Node.js konnte nicht entfernt werden"
    
    # Entferne NodeSource aus APT-Quellen
    if [ -f /etc/apt/sources.list.d/nodesource.list ]; then
        rm -f /etc/apt/sources.list.d/nodesource.list || handle_error "NodeSource-Quelle konnte nicht entfernt werden"
    fi
    
    # Frage, ob nginx und weitere Tools entfernt werden sollen
    echo "Möchten Sie auch nginx und andere Tools (git, curl, etc.) entfernen?"
    echo "Dies kann andere Webanwendungen beeinträchtigen!"
    read -p "Nginx und Tools entfernen? (j/N): " REMOVE_NGINX
    
    if [ "$REMOVE_NGINX" = "j" ] || [ "$REMOVE_NGINX" = "J" ]; then
        echo "Entferne nginx und Tools..."
        apt remove -y nginx || handle_error "Nginx konnte nicht entfernt werden"
        apt remove -y sqlite3 git zip unzip curl wget imagemagick || handle_error "Tools konnten nicht entfernt werden"
    fi
    
    # System bereinigen
    apt autoremove -y || handle_error "Abhängigkeiten konnten nicht entfernt werden"
    apt clean || handle_error "APT-Cache konnte nicht geleert werden"
    
    echo "Pakete wurden entfernt."
else
    echo "Pakete werden beibehalten."
fi

# Abschluss
echo ""
echo "======================================================================"
echo "  Deinstallation abgeschlossen!"
echo "======================================================================"
echo ""
echo "Die Volkswagen Ausbildungsberufe-Anwendung und das CMS wurden erfolgreich entfernt."
echo "Das System wurde in den Ausgangszustand zurückgesetzt."
echo ""
echo "Wenn Sie das System vollständig zurücksetzen möchten, sollten Sie einen Neustart durchführen:"
echo "sudo reboot"
echo "======================================================================"

exit 0