#!/bin/bash

# VW Ausbildungsberufe Kiosk-Modus Autostart
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

# X-Server als pi-Benutzer starten, wenn er nicht läuft
if id "$PI_USER" &>/dev/null; then
    PI_HOME=$(getent passwd $PI_USER | cut -d: -f6)
    if [ -z "$PI_HOME" ]; then
        echo "FEHLER: Heimatverzeichnis für Benutzer $PI_USER nicht gefunden!"
        PI_HOME="/home/$PI_USER"  # Fallback
    fi
    
    # Überprüfen, ob der X-Server läuft
    if ! sudo -u $PI_USER DISPLAY=$DISPLAY_TO_USE xset q &>/dev/null; then
        echo "X-Server läuft nicht oder kann nicht zugegriffen werden."
        echo "Starte X-Server als $PI_USER..."
        
        # Als pi-Benutzer starten
        sudo -u $PI_USER startx -- -nocursor &
        echo "Warte 15 Sekunden auf vollständigen Start des X-Servers..."
        sleep 15
    else
        echo "X-Server läuft bereits und ist zugänglich."
    fi
else
    echo "FEHLER: Benutzer $PI_USER existiert nicht!"
    exit 1
fi

# D-Bus-Session identifizieren oder starten für den pi-Benutzer
DBUS_SESSION_FILE="$PI_HOME/.dbus/session-bus/$(dbus-uuidgen --get)-0"
if [ -f "$DBUS_SESSION_FILE" ]; then
    echo "Benutze existierende D-Bus-Session von $DBUS_SESSION_FILE"
    # Laden der D-Bus-Umgebungsvariablen aus der Sitzungsdatei
    source "$DBUS_SESSION_FILE"
else
    echo "Keine D-Bus-Session gefunden, starte eine neue..."
    # D-Bus-Adresse für den pi-Benutzer erzeugen
    DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u $PI_USER)/bus"
    
    # Prüfen, ob der D-Bus-Daemon läuft, sonst starten
    if ! sudo -u $PI_USER pgrep -f "dbus-daemon --session" > /dev/null; then
        echo "Starte D-Bus-Daemon für $PI_USER..."
        sudo -u $PI_USER dbus-daemon --session --address="$DBUS_SESSION_BUS_ADDRESS" --fork
        sleep 2
    fi
fi

# Bildschirmschoner deaktivieren
echo "Versuche Bildschirmschoner zu deaktivieren..."
sudo -u $PI_USER DISPLAY=$DISPLAY_TO_USE DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS xset s off 2>/dev/null || echo "xset s off fehlgeschlagen"
sudo -u $PI_USER DISPLAY=$DISPLAY_TO_USE DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS xset -dpms 2>/dev/null || echo "xset -dpms fehlgeschlagen"
sudo -u $PI_USER DISPLAY=$DISPLAY_TO_USE DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS xset s noblank 2>/dev/null || echo "xset s noblank fehlgeschlagen"

# Chromium starten
echo "Starte Chromium als Benutzer $PI_USER im Kiosk-Modus..."
if ! pgrep -f "chromium-browser" > /dev/null; then
    CHROMIUM_CMD="/usr/bin/chromium-browser"  # Wir wissen aus dem Log, dass der Pfad gefunden wurde
    
    # Erstelle ein temporäres Startskript, das D-Bus und X11 korrekt einrichtet
    START_SCRIPT=$(mktemp)
    
    cat << EOF > $START_SCRIPT
#!/bin/bash
export DISPLAY=$DISPLAY_TO_USE
export XAUTHORITY=$PI_HOME/.Xauthority
export DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS
export $(sudo -u $PI_USER dbus-launch)

# X11 und D-Bus sollten jetzt korrekt konfiguriert sein
$CHROMIUM_CMD --kiosk --disable-infobars --disable-features=TranslateUI "$WEBSITE_URL"
EOF
    
    chmod +x $START_SCRIPT
    chown $PI_USER:$PI_USER $START_SCRIPT
    
    echo "Starte Chromium mit dem temporären Skript: $START_SCRIPT"
    sudo -u $PI_USER $START_SCRIPT &
    
    # Gib Chromium etwas Zeit zum Starten
    sleep 5
    
    # Prüfe, ob Chromium läuft
    if sudo -u $PI_USER pgrep -f "chromium-browser" > /dev/null; then
        echo "Chromium läuft erfolgreich."
    else
        echo "FEHLER: Chromium wurde nicht erfolgreich gestartet!"
        echo "Versuche alternativen Start mit minimalem Befehl..."
        
        # Einfacher Neustart-Versuch ohne komplexe Optionen
        sudo -u $PI_USER bash -c "DISPLAY=$DISPLAY_TO_USE chromium-browser --kiosk '$WEBSITE_URL'" &
    fi
else
    echo "Chromium läuft bereits."
fi

echo "Kiosk-Modus Autostart abgeschlossen."