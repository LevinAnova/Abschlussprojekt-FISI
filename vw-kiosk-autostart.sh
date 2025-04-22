#!/bin/bash

# VW Ausbildungsberufe Kiosk-Modus Autostart
# Mit verbesserter Fehlerbehandlung für X-Server und Chromium

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
if ! DISPLAY=$DISPLAY_TO_USE xdpyinfo >/dev/null 2>&1; then
    echo "X-Server läuft nicht. Starte X-Server..."
    startx -- -nocursor &
    # Längere Wartezeit, damit X-Server vollständig starten kann
    echo "Warte 15 Sekunden auf vollständigen Start des X-Servers..."
    sleep 15
fi

# Prüfe erneut, ob X-Server jetzt läuft
if ! DISPLAY=$DISPLAY_TO_USE xdpyinfo >/dev/null 2>&1; then
    echo "FEHLER: X-Server konnte nicht gestartet werden!"
    exit 1
fi

echo "X-Server läuft. Versuche Bildschirmschoner zu deaktivieren..."

# Bildschirmschoner sicher deaktivieren - mit Fehlerprüfung
if command -v xset >/dev/null 2>&1; then
    # Versuche jeden Befehl einzeln und ignoriere Fehler
    xset s off || echo "xset s off fehlgeschlagen - ignoriere"
    # Die problematische dpms-Option separat versuchen und Fehler ignorieren
    xset -dpms || echo "xset -dpms fehlgeschlagen - ignoriere"
    xset s noblank || echo "xset s noblank fehlgeschlagen - ignoriere"
    echo "Bildschirmschoner-Befehle ausgeführt."
else
    echo "xset nicht gefunden, überspringe Bildschirmschoner-Einstellungen"
fi

# Chromium starten mit verbesserter Fehlerbehandlung
echo "Starte Chromium im Kiosk-Modus..."
if ! pgrep -f "chromium-browser" > /dev/null; then
    # Überprüfe zuerst, ob Chromium überhaupt installiert ist
    if ! command -v chromium-browser >/dev/null 2>&1; then
        echo "FEHLER: chromium-browser ist nicht installiert!"
        # Versuche als Fallback den richtigen Befehlsnamen zu finden
        if command -v chromium >/dev/null 2>&1; then
            CHROMIUM_CMD="chromium"
        else
            echo "KRITISCHER FEHLER: Chromium ist nicht installiert. Bitte installieren mit: sudo apt install chromium-browser"
            exit 1
        fi
    else
        CHROMIUM_CMD="chromium-browser"
    fi
    
    echo "Starte $CHROMIUM_CMD mit folgenden Optionen..."
    $CHROMIUM_CMD --kiosk --incognito --noerrdialogs --disable-translate \
        --no-first-run --fast --fast-start --disable-infobars \
        --disable-features=TranslateUI --disk-cache-dir=/dev/null \
        --overscroll-history-navigation=0 --disable-pinch \
        "$WEBSITE_URL" &
    
    CHROMIUM_PID=$!
    echo "Chromium gestartet mit PID: $CHROMIUM_PID"
    
    # Prüfe, ob Chromium wirklich läuft
    sleep 5
    if kill -0 $CHROMIUM_PID 2>/dev/null; then
        echo "Chromium läuft erfolgreich unter PID: $CHROMIUM_PID"
    else
        echo "FEHLER: Chromium wurde nicht erfolgreich gestartet!"
        # Versuche einen alternativen Start ohne problematische Optionen
        echo "Versuche Chromium mit minimalen Optionen..."
        $CHROMIUM_CMD --kiosk "$WEBSITE_URL" &
    fi
else
    echo "Chromium läuft bereits"
fi

echo "Kiosk-Modus Autostart abgeschlossen."