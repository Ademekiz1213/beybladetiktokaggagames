# VPS Kurulum (Ubuntu 22.04/24.04)

Bu proje tek VPS'te `Node.js + PM2 + Nginx + SSL` ile yayinlanir.

## 0) Firebase Auth hazirlik

1. Firebase Console'da proje olustur.
2. Authentication > Sign-in method > `Email/Password` secenegini ac.
3. Project settings > General > Web App olustur.
4. Asagidaki dosyayi gercek degerlerle doldur:

`client/js/firebase-config.js`

5. `server/ecosystem.config.cjs` icindeki su alanlari doldur:

- `FIREBASE_WEB_API_KEY`: Firebase Web API key
- `PREMIUM_ADMIN_EMAILS`: Premium listesi gorecek admin email(ler), virgulle ayir
- `PREMIUM_CODES`: Aylik kodlar

Ornek:

```txt
PREMIUM_ADMIN_EMAILS=seninemailin@gmail.com
PREMIUM_CODES=AYLIK-2026-02|30|0|28,AYLIK-2026-03|30|0|28
```

`PREMIUM_CODES` formati: `KOD|sureGun|maxKullanim|tekrarCooldownGun`

### TikTok proxy (opsiyonel)

Bazı yayıncılarda bölgesel/hat kaynaklı bağlantı sorunu varsa proxy aç:

```txt
TIKTOK_PROXY_ENABLED=true
TIKTOK_PROXY_INCLUDE_DIRECT=true
TIKTOK_PROXY_CONNECT_TIMEOUT_MS=15000
TIKTOK_PROXY_URLS=http://user:pass@ip1:port1,http://user:pass@ip2:port2,socks5://ip3:port3
```

Not: Bu sürümde `proxy-agent` bağımlılığı projeye eklendi. `git pull` sonrası `npm ci --omit=dev` çalıştırman yeterli.

## 1) Sunucuyu hazirla

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

## 2) Projeyi VPS'e al

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone <REPO_URL> beyblade
sudo chown -R $USER:$USER /var/www/beyblade
cd /var/www/beyblade/server
npm ci --omit=dev
```

## 3) PM2 ile calistir

```bash
sudo mkdir -p /var/log/beyblade
sudo chown -R $USER:$USER /var/log/beyblade
cd /var/www/beyblade/server
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u $USER --hp $HOME
```

`pm2 startup` ciktisinda verdigi komutu bir kere daha calistir.

## 4) Nginx reverse proxy

```bash
sudo cp /var/www/beyblade/deploy/nginx.beyblade.conf /etc/nginx/sites-available/beyblade
sudo nano /etc/nginx/sites-available/beyblade
```

- `server_name oyun.senin-domainin.com;` satirini kendi domaininle degistir.

```bash
sudo ln -s /etc/nginx/sites-available/beyblade /etc/nginx/sites-enabled/beyblade
sudo nginx -t
sudo systemctl restart nginx
```

## 5) SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d oyun.senin-domainin.com
```

## 6) Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 7) Kontrol

```bash
curl http://127.0.0.1:3000/health
pm2 status
pm2 logs beyblade --lines 100
```

Beklenen saglik ciktisi:

```json
{"ok":true,"service":"beyblade-tiktok-server"}
```

## 8) Guncelleme akisi

```bash
cd /var/www/beyblade
git pull
cd /var/www/beyblade/server
npm ci --omit=dev
pm2 restart beyblade
```
