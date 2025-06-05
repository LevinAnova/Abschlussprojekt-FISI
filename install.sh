#!/bin/bash
set -e

# Simple installation script for VW Ausbildung project

APP_DIR=/opt/vw-ausbildung
WEB_DIR="$APP_DIR/public"
DB_NAME=vw_ausbildung
DB_USER=vwapp
DB_PASS=fisi
PORT=4848

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root" >&2
  exit 1
fi

# install Node.js if missing
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
fi

apt-get update
apt-get install -y mariadb-server

systemctl enable --now mariadb

mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';"
mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"
mysql $DB_NAME < dbconf.txt

mkdir -p "$WEB_DIR" "$APP_DIR" "/var/www/html/vw-ausbildung/uploads/gallery" "/var/www/html/vw-ausbildung/uploads/qr_codes"

cp server.js "$APP_DIR/"

cp -r fonts img style tests "$WEB_DIR/"
cp admin.html index.html landing.html login.html cms.js translation.js manifest.json service-worker.js "$WEB_DIR/"

cat > "$APP_DIR/package.json" <<'PKG'
{
  "name": "vw-ausbildung",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "express-mysql-session": "^3.0.0",
    "express-session": "^1.17.3",
    "formidable": "^2.1.1",
    "mysql2": "^3.2.0"
  }
}
PKG

cd "$APP_DIR"
npm install --production

cat > /etc/systemd/system/vw-ausbildung.service <<SERVICE
[Unit]
Description=VW Ausbildung Server
After=network.target mariadb.service

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/server.js
Restart=on-failure
Environment=PORT=$PORT
Environment=DB_HOST=localhost
Environment=DB_USER=$DB_USER
Environment=DB_PASS=$DB_PASS
Environment=DB_NAME=$DB_NAME

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now vw-ausbildung.service

echo "Installation complete. Access the app on port $PORT."
