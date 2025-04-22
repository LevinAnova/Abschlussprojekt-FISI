#!/bin/bash

# VW Ausbildungsberufe Kiosk-Modus Autostart
# Stellt sicher, dass server.js mit sudo-Rechten läuft

# Logging aktivieren
exec &> /var/log/vw-kiosk-autostart.log

echo "=== VW Ausbildungsberufe Kiosk-Modus Autostart ==="
echo "Gestartet am: $(date)"

# Konfiguration
SERVER_PATH="/opt/vw-ausbildung-cms"
SERVER_JS="server.js"
WEBSITE_URL="http://localhost/landing.html"
DISPLAY_TO_USE=":0"
API_SERVICE="vw-ausbildung-api.service"

# Sicherstellen, dass die Anzeige gesetzt ist
export DISPLAY=$DISPLAY_TO_USE
export XAUTHORITY="/home/pi/.Xauthority"

# Stellen wir sicher, dass der API-Service mit sudo-Rechten läuft
echo "Überprüfe Status des API-Service..."
if ! systemctl is-active --quiet "$API_SERVICE"; then
    echo "API-Service ist nicht aktiv. Starte $API_SERVICE mit sudo..."
    sudo systemctl start "$API_SERVICE"
    sleep 5
    
    if ! systemctl is-active --quiet "$API_SERVICE"; then
        echo "FEHLER: API-Service konnte nicht gestartet werden!"
        echo "Versuche, server.js direkt mit sudo zu starten..."
        
        # Fallback: Direkt mit sudo starten, falls der Service nicht funktioniert
        if [ -f "$SERVER_PATH/$SERVER_JS" ]; then
            cd "$SERVER_PATH" || { echo "Server-Verzeichnis nicht gefunden!"; exit 1; }
            sudo node "$SERVER_JS" &
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

# Prüfen, ob X-Server bereits läuft
echo "Prüfe, ob X-Server läuft..."
if ! xset q &>/dev/null; then
    echo "X-Server läuft nicht. Starte X-Server..."
    startx -- -nocursor &
    sleep 5
fi

# Chromium starten, falls er nicht bereits läuft
echo "Starte Chromium im Kiosk-Modus..."
if ! pgrep -f "chromium-browser" > /dev/null; then
    # Bildschirmschoner und Energiesparoptionen deaktivieren
    xset s off
    xset -dpms
    xset s noblank
    
    # Chromium im Kiosk-Modus starten
    chromium-browser --kiosk --incognito --noerrdialogs --disable-translate \
        --no-first-run --fast --fast-start --disable-infobars \
        --disable-features=TranslateUI --disk-cache-dir=/dev/null \
        --overscroll-history-navigation=0 --disable-pinch \
        "$WEBSITE_URL" &
    CHROMIUM_PID=$!
    echo "Chromium gestartet mit PID: $CHROMIUM_PID"
else
    echo "Chromium läuft bereits"
fi

echo "Kiosk-Modus Autostart abgeschlossen."