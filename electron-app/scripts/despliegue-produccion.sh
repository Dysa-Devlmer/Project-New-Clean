#!/bin/bash

# ========================================
# DYSA Point - Script de Despliegue en Producción (Linux)
# Sistema automatizado de instalación para restaurantes
# Versión: 2.0.14
# Fecha: 2025-10-13 20:30
# ========================================

set -e  # Salir en caso de error

echo ""
echo "==============================================="
echo " DYSA Point POS v2.0.14 - Despliegue Producción"
echo " Sistema Empresarial para Restaurantes"
echo "==============================================="
echo ""

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ ERROR: Este script debe ejecutarse como root"
    echo "   Ejecute: sudo $0"
    exit 1
fi

echo "✅ Privilegios de administrador verificados"
echo ""

# Variables de configuración
INSTALL_DIR="/opt/dysa-point"
SERVICE_NAME="dysa-point-pos"
DB_NAME="dysa_point"
DB_USER="dysa_user"
DB_PASS=$(openssl rand -base64 12)
NODE_VERSION="18"

echo "📁 Configuración de instalación:"
echo "   Directorio: $INSTALL_DIR"
echo "   Servicio: $SERVICE_NAME"
echo "   Base de datos: $DB_NAME"
echo "   Usuario DB: $DB_USER"
echo ""

# Detectar distribución Linux
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    echo "❌ No se pudo detectar la distribución Linux"
    exit 1
fi

echo "🐧 Sistema detectado: $OS $VER"
echo ""

# Actualizar sistema
echo "🔄 Actualizando sistema..."
if command -v apt-get &> /dev/null; then
    apt-get update && apt-get upgrade -y
elif command -v yum &> /dev/null; then
    yum update -y
elif command -v dnf &> /dev/null; then
    dnf update -y
else
    echo "⚠️ Gestor de paquetes no soportado"
fi

echo ""

# Instalar Node.js
echo "🔍 Verificando Node.js..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | sed 's/v//') -lt $NODE_VERSION ]]; then
    echo "📦 Instalando Node.js $NODE_VERSION LTS..."

    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -

    if command -v apt-get &> /dev/null; then
        apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        yum install -y nodejs npm
    elif command -v dnf &> /dev/null; then
        dnf install -y nodejs npm
    fi

    echo "✅ Node.js instalado: $(node -v)"
else
    echo "✅ Node.js encontrado: $(node -v)"
fi

echo ""

# Instalar MySQL
echo "🔍 Verificando MySQL Server..."
if ! command -v mysql &> /dev/null; then
    echo "📦 Instalando MySQL Server..."

    if command -v apt-get &> /dev/null; then
        # Ubuntu/Debian
        apt-get install -y mysql-server
        systemctl enable mysql
        systemctl start mysql

        # Configuración segura básica
        mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root123';"

    elif command -v yum &> /dev/null; then
        # CentOS/RHEL
        yum install -y mysql-server
        systemctl enable mysqld
        systemctl start mysqld

    elif command -v dnf &> /dev/null; then
        # Fedora
        dnf install -y mysql-server
        systemctl enable mysqld
        systemctl start mysqld
    fi

    echo "✅ MySQL Server instalado"
else
    echo "✅ MySQL Server encontrado"
fi

echo ""

# Instalar dependencias adicionales
echo "📦 Instalando dependencias adicionales..."
if command -v apt-get &> /dev/null; then
    apt-get install -y curl wget unzip git build-essential python3 nginx certbot
elif command -v yum &> /dev/null; then
    yum install -y curl wget unzip git gcc-c++ make python3 nginx certbot
elif command -v dnf &> /dev/null; then
    dnf install -y curl wget unzip git gcc-c++ make python3 nginx python3-certbot-nginx
fi

echo ""

# Crear usuario del sistema
echo "👤 Creando usuario del sistema..."
if ! id "dysa-point" &>/dev/null; then
    useradd -r -s /bin/false -d $INSTALL_DIR dysa-point
    echo "✅ Usuario dysa-point creado"
else
    echo "✅ Usuario dysa-point ya existe"
fi

echo ""

# Crear directorio de instalación
echo "📁 Creando directorio de instalación..."
mkdir -p $INSTALL_DIR/{logs,backups,config,certificates,temp}
chown -R dysa-point:dysa-point $INSTALL_DIR
chmod -R 755 $INSTALL_DIR

echo "✅ Estructura de directorios creada"
echo ""

# Copiar archivos del sistema
echo "📋 Copiando archivos del sistema..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
rsync -av --exclude='node_modules' --exclude='.git' --exclude='backups' --exclude='logs' --exclude='temp' "$SCRIPT_DIR/../" $INSTALL_DIR/

chown -R dysa-point:dysa-point $INSTALL_DIR
echo "✅ Archivos copiados correctamente"
echo ""

# Instalar dependencias de Node.js
echo "📦 Instalando dependencias de Node.js..."
cd $INSTALL_DIR
sudo -u dysa-point npm install --production

echo "✅ Dependencias instaladas correctamente"
echo ""

# Configurar base de datos
echo "🗄️ Configurando base de datos..."

# Crear base de datos y usuario
mysql -u root -proot123 <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

echo "✅ Base de datos y usuario creados"

# Ejecutar migraciones
echo "🔄 Ejecutando migraciones de base de datos..."
for migration in $INSTALL_DIR/server/database/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "   Ejecutando: $(basename $migration)"
        mysql -u $DB_USER -p$DB_PASS $DB_NAME < "$migration"
    fi
done

echo "✅ Migraciones completadas"
echo ""

# Crear configuración de producción
echo "⚙️ Creando configuración de producción..."
cat > $INSTALL_DIR/config/produccion.json <<EOF
{
  "sistema": {
    "nombre": "DYSA Point POS",
    "version": "2.0.14",
    "ambiente": "production",
    "fecha_instalacion": "$(date -Iseconds)"
  },
  "servidor": {
    "puerto": 8547,
    "https_habilitado": false
  },
  "base_datos": {
    "host": "localhost",
    "puerto": 3306,
    "nombre": "$DB_NAME",
    "usuario": "$DB_USER",
    "password": "$DB_PASS"
  },
  "backup": {
    "habilitado": true,
    "frecuencia_horas": 6,
    "retention_dias": 30
  },
  "logs": {
    "nivel": "info",
    "archivo": "$INSTALL_DIR/logs/system.log"
  }
}
EOF

chown dysa-point:dysa-point $INSTALL_DIR/config/produccion.json
chmod 600 $INSTALL_DIR/config/produccion.json

echo "✅ Configuración de producción creada"
echo ""

# Crear servicio systemd
echo "🔧 Configurando servicio systemd..."
cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=DYSA Point POS System v2.0.14 - Sistema empresarial para restaurantes
After=network.target mysql.service
Requires=mysql.service

[Service]
Type=simple
User=dysa-point
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=CONFIG_FILE=$INSTALL_DIR/config/produccion.json
ExecStart=/usr/bin/node $INSTALL_DIR/server/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$SERVICE_NAME

# Configuración de recursos
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $SERVICE_NAME

echo "✅ Servicio systemd configurado"
echo ""

# Configurar Nginx como proxy inverso
echo "🌐 Configurando Nginx..."
cat > /etc/nginx/sites-available/dysa-point <<EOF
server {
    listen 80;
    server_name localhost;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:8547;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout       60s;
        proxy_send_timeout          60s;
        proxy_read_timeout          60s;
    }

    # Archivos estáticos
    location /static/ {
        alias $INSTALL_DIR/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Logs específicos
    access_log /var/log/nginx/dysa-point-access.log;
    error_log /var/log/nginx/dysa-point-error.log;
}
EOF

# Habilitar sitio
ln -sf /etc/nginx/sites-available/dysa-point /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Verificar configuración y reiniciar Nginx
nginx -t && systemctl restart nginx
systemctl enable nginx

echo "✅ Nginx configurado como proxy inverso"
echo ""

# Configurar firewall
echo "🔥 Configurando firewall..."
if command -v ufw &> /dev/null; then
    # Ubuntu/Debian
    ufw allow 22/tcp   # SSH
    ufw allow 80/tcp   # HTTP
    ufw allow 443/tcp  # HTTPS
    ufw --force enable
elif command -v firewall-cmd &> /dev/null; then
    # CentOS/RHEL/Fedora
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --reload
fi

echo "✅ Firewall configurado"
echo ""

# Configurar backup automático con crontab
echo "💾 Configurando backup automático..."
# Crear script de backup
cat > $INSTALL_DIR/scripts/backup_automatico.sh <<'EOF'
#!/bin/bash
# Backup automático para DYSA Point
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/opt/dysa-point/backups/database"
DB_NAME="dysa_point"
DB_USER="dysa_user"
DB_PASS="DB_PASS_PLACEHOLDER"

# Crear backup
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > "$BACKUP_DIR/dysa_point_$DATE.sql.gz"

# Limpiar backups antiguos (más de 30 días)
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup completado: dysa_point_$DATE.sql.gz"
EOF

# Reemplazar placeholder con la contraseña real
sed -i "s/DB_PASS_PLACEHOLDER/$DB_PASS/g" $INSTALL_DIR/scripts/backup_automatico.sh
chmod +x $INSTALL_DIR/scripts/backup_automatico.sh
chown dysa-point:dysa-point $INSTALL_DIR/scripts/backup_automatico.sh

# Agregar al crontab del usuario dysa-point
sudo -u dysa-point crontab -l 2>/dev/null | { cat; echo "0 */6 * * * $INSTALL_DIR/scripts/backup_automatico.sh"; } | sudo -u dysa-point crontab -

echo "✅ Backup automático configurado (cada 6 horas)"
echo ""

# Configurar logs rotativos
echo "📋 Configurando rotación de logs..."
cat > /etc/logrotate.d/dysa-point <<EOF
$INSTALL_DIR/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
    postrotate
        systemctl reload $SERVICE_NAME > /dev/null 2>&1 || true
    endscript
}
EOF

echo "✅ Rotación de logs configurada"
echo ""

# Iniciar servicios
echo "🚀 Iniciando servicios..."
systemctl start $SERVICE_NAME
sleep 5

# Verificar que el servicio esté corriendo
if systemctl is-active --quiet $SERVICE_NAME; then
    echo "✅ Servicio $SERVICE_NAME iniciado correctamente"
else
    echo "❌ Error iniciando el servicio $SERVICE_NAME"
    journalctl -u $SERVICE_NAME --no-pager --lines=20
fi

echo ""

# Crear documentación de instalación
echo "📚 Generando documentación..."
cat > $INSTALL_DIR/INSTALACION_COMPLETADA.txt <<EOF
========================================
DYSA Point POS v2.0.14 - Instalación Completada
Fecha: $(date)
========================================

INFORMACIÓN DE LA INSTALACIÓN:
  Directorio: $INSTALL_DIR
  Servicio: $SERVICE_NAME
  Puerto interno: 8547
  Puerto público: 80
  Base de datos: $DB_NAME
  Usuario BD: $DB_USER
  Contraseña BD: $DB_PASS

URLS DE ACCESO:
  Panel Principal: http://localhost (o http://IP-del-servidor)
  API Health: http://localhost/health
  Configuración: http://localhost/api/configuracion/estado

COMANDOS ÚTILES:
  Estado del servicio: systemctl status $SERVICE_NAME
  Iniciar servicio: systemctl start $SERVICE_NAME
  Detener servicio: systemctl stop $SERVICE_NAME
  Reiniciar servicio: systemctl restart $SERVICE_NAME
  Ver logs: journalctl -u $SERVICE_NAME -f
  Backup manual: $INSTALL_DIR/scripts/backup_automatico.sh

ARCHIVOS IMPORTANTES:
  Configuración: $INSTALL_DIR/config/produccion.json
  Logs: $INSTALL_DIR/logs/
  Backups: $INSTALL_DIR/backups/
  Scripts: $INSTALL_DIR/scripts/

NGINX:
  Configuración: /etc/nginx/sites-available/dysa-point
  Logs acceso: /var/log/nginx/dysa-point-access.log
  Logs error: /var/log/nginx/dysa-point-error.log

SEGURIDAD:
  - Configure HTTPS con Let's Encrypt: certbot --nginx -d su-dominio.com
  - Cambie contraseñas por defecto
  - Configure backups externos
  - Monitoreé logs regularmente
EOF

chown dysa-point:dysa-point $INSTALL_DIR/INSTALACION_COMPLETADA.txt

echo "✅ Documentación generada: $INSTALL_DIR/INSTALACION_COMPLETADA.txt"
echo ""

echo "==============================================="
echo "✅ INSTALACIÓN COMPLETADA EXITOSAMENTE"
echo "==============================================="
echo ""
echo "🎉 DYSA Point POS v2.0.14 ha sido instalado correctamente"
echo ""
echo "📋 PRÓXIMOS PASOS:"
echo "   1. Accede a http://$(hostname -I | awk '{print $1}') en tu navegador"
echo "   2. Configura el restaurante usando la API de configuración"
echo "   3. Verifica que todos los sistemas estén operativos"
echo ""
echo "📞 INFORMACIÓN IMPORTANTE:"
echo "   - Usuario BD: $DB_USER"
echo "   - Contraseña BD: $DB_PASS"
echo "   - Puerto interno: 8547"
echo "   - Puerto público: 80"
echo "   - Servicio: $SERVICE_NAME"
echo ""
echo "💾 Esta información se ha guardado en:"
echo "   $INSTALL_DIR/INSTALACION_COMPLETADA.txt"
echo ""
echo "⚠️ RECORDATORIO DE SEGURIDAD:"
echo "   - Configure HTTPS: certbot --nginx -d su-dominio.com"
echo "   - Cambie las contraseñas por defecto"
echo "   - Configure backups externos"
echo "   - Monitoreé los logs del sistema"
echo ""
echo "🔍 VERIFICAR INSTALACIÓN:"
echo "   systemctl status $SERVICE_NAME"
echo "   curl http://localhost/health"
echo ""

exit 0