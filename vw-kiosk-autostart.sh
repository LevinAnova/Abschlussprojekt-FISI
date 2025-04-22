#!/bin/bash

# VW Ausbildungsberufe Kiosk-Modus Autostart
# Mit X-Session-Behandlung für die Ausführung als root

# Logging aktivieren
exec &> /var/log/vw-kiosk-autostart.log

echo "=== VW Ausbildungsberufe Kiosk-Modus Autostart ==="
echo "Gestartet am: $(date)"
echo "Ausgeführt als: $(whoami)"

# Konfiguration
SERVER_PATH="/opt/vw-ausbildung-cms"
SERVER_JS="server.js"
WEBSITE_URL="http://localhost/landing.html"
DISPLAY_TO_USE=":0"
API_SERVICE="vw-ausbildung-api.service"
PI_USER="pi"  # Der standardmäßige Desktop-Benutzer auf dem Raspberry Pi

# Stellen wir sicher, dass der API-Service mit sudo-Rechten läuft
echo "Überprüfe Status des API-Service..."
if ! systemctl is-active --quiet "$API_SERVICE"; then
    echo "API-Service ist nicht aktiv. Starte $API_SERVICE mit sudo..."
    systemctl start "$API_SERVICE"
    sleep 5
    
    if ! systemctl is-active --quiet "$API_SERVICE"; then
        echo "FEHLER: API-Service konnte nicht gestartet werden!"
        echo "Versuche, server.js direkt zu starten..."
        
        # Fallback: Direkt starten, falls der Service nicht funktioniert
        if [ -f "$SERVER_PATH/$SERVER_JS" ]; then
            cd "$SERVER_PATH" || { echo "Server-Verzeichnis nicht gefunden!"; exit 1; }
            node "$SERVER_JS" &
            SERVER_PID=$!
            echo "Server direkt gestartet mit PID: $SERVER_PID"
            sleep 5
        else
            echo "KRITISCHER FEHLER: server.js nicht gefunden unter $SERVER_PATH/$SERVER_JS"
        fi
    else
        echo "API-Service wurde erfolgreich gestartet."
    fi
else
    echo "API-Service läuft bereits."
fi

# X-Server als pi-Benutzer starten
if id "$PI_USER" &>/dev/null; then
    # Prüfe, ob der X-Server läuft
    if ! sudo -u $PI_USER DISPLAY=$DISPLAY_TO_USE xset q &>/dev/null; then
        echo "X-Server läuft nicht oder kann nicht zugegriffen werden."
        echo "Starte X-Server als $PI_USER..."
        
        # Als pi-Benutzer starten
        sudo -u $PI_USER startx -- -nocursor &
        echo "Warte 15 Sekunden auf vollständigen Start des X-Servers..."
        sleep 15
        
        # Erneut prüfen
        if ! sudo -u $PI_USER DISPLAY=$DISPLAY_TO_USE xset q &>/dev/null; then
            echo "WARNUNG: X-Server scheint nicht richtig zu starten oder ist nicht zugänglich."
            # Wir versuchen trotzdem fortzufahren
        fi
    else
        echo "X-Server läuft bereits und ist zugänglich."
    fi
else
    echo "FEHLER: Benutzer $PI_USER existiert nicht!"
fi

# X-Server-Autorisierung für den aktuellen Benutzer einrichten
PI_HOME=$(getent passwd $PI_USER | cut -d: -f6)
if [ -z "$PI_HOME" ]; then
    echo "FEHLER: Heimatverzeichnis für Benutzer $PI_USER nicht gefunden!"
    PI_HOME="/home/$PI_USER"  # Fallback
fi

# XAUTHORITY-Datei aus dem Home-Verzeichnis des pi-Benutzers verwenden
export XAUTHORITY="$PI_HOME/.Xauthority"
export DISPLAY=$DISPLAY_TO_USE

echo "Verwende DISPLAY=$DISPLAY und XAUTHORITY=$XAUTHORITY"

# Bildschirmschoner deaktivieren, aber als pi-Benutzer
echo "Versuche Bildschirmschoner zu deaktivieren..."
sudo -u $PI_USER DISPLAY=$DISPLAY_TO_USE xset s off 2>/dev/null || echo "xset s off fehlgeschlagen"
sudo -u $PI_USER DISPLAY=$DISPLAY_TO_USE xset -dpms 2>/dev/null || echo "xset -dpms fehlgeschlagen"
sudo -u $PI_USER DISPLAY=$DISPLAY_TO_USE xset s noblank 2>/dev/null || echo "xset s noblank fehlgeschlagen"

# Chromium starten, aber als pi-Benutzer
echo "Starte Chromium als Benutzer $PI_USER im Kiosk-Modus..."
if ! pgrep -f "chromium-browser" > /dev/null; then
    # Überprüfe welcher Chromium-Befehl verfügbar ist
    if sudo -u $PI_USER command -v chromium-browser >/dev/null 2>&1; then
        CHROMIUM_CMD="chromium-browser"
    elif sudo -u $PI_USER command -v chromium >/dev/null 2>&1; then
        CHROMIUM_CMD="chromium"
    else
        echo "FEHLER: Chromium ist nicht installiert!"
        exit 1
    fi
    
    # Starte Chromium als pi-Benutzer
    echo "Starte $CHROMIUM_CMD als Benutzer $PI_USER..."
    
    # Ausführen des Chromium als pi-Benutzer mit korrekten Umgebungsvariablen
    sudo -u $PI_USER bash -c "DISPLAY=$DISPLAY_TO_USE XAUTHORITY=$XAUTHORITY $CHROMIUM_CMD --kiosk --incognito --noerrdialogs --disable-translate --no-first-run --fast --fast-start --disable-infobars --disable-features=TranslateUI '$WEBSITE_URL'" &
    
    CHROMIUM_PID=$!
    echo "Chromium-Befehl wurde gestartet mit PID: $CHROMIUM_PID"
    
    # Prüfe, ob Chromium wirklich läuft
    sleep 5
    if sudo -u $PI_USER pgrep -f "$CHROMIUM_CMD" > /dev/null; then
        echo "Chromium läuft erfolgreich."
    else
        echo "FEHLER: Chromium wurde nicht erfolgreich gestartet!"
        echo "Versuche vereinfachten Start..."
        # Vereinfachter Start mit minimalen Optionen
        sudo -u $PI_USER bash -c "DISPLAY=$DISPLAY_TO_USE XAUTHORITY=$XAUTHORITY $CHROMIUM_CMD --kiosk '$WEBSITE_URL'" &
    fi
else
    echo "Chromium läuft bereits."
fi

echo "Kiosk-Modus Autostart abgeschlossen."