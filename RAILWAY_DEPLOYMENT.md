# 🚀 Railway Deployment Rehberi
**Kocaeli Gölcük Saha & Üye Yönetim Sistemi**

Bu doküman, uygulamanın [Railway.app](https://railway.app) üzerinde kalıcı SQLite veritabanı ile canlıya (production) alınması için adım adım rehberdir.

---

## 1. Proje Mimarisi ve Railway Uyumluluğu

- **Tek Servis Mimarisi**: Railway projenizde tek bir Web Servisi çalışacaktır.
  - Node.js backend sunucusu (`server/index.js`), derlenmiş olan React/Vite arayüzünü (`client/dist`) otomatik olarak host eder.
  - Express sunucusu `0.0.0.0:$PORT` üzerinden dış dünyaya bağlanır.
- **Otomatik Kurulum (Postinstall)**: Root `package.json` dosyasında `postinstall` script'i tanımlıdır. Railway `npm install` çalıştırdığında hem sunucu (`server`) hem istemci (`client`) bağımlılıklarını otomatik yükler.
- **Otomatik Derleme (Build)**: Railway `npm run build` komutunu çalıştırarak istemciyi (`client/dist`) derler.
- **Başlatma (Start)**: `npm start` komutu ile `node server/index.js` sunucuyu ayağa kaldırır.

---

## 2. Adım Adım Canlıya Alma (Deployment)

### Adım 1: Kodları GitHub'a Gönderin
Projenizi bir GitHub reposuna push edin:
```bash
git add .
git commit -m "Gölcük saha ve üye yönetim sistemi hazır"
git push origin main
```

### Adım 2: Railway Üzerinde Yeni Proje Oluşturun
1. [Railway.app](https://railway.app) hesabınıza giriş yapın.
2. Sağ üstten **New Project** butonuna tıklayın.
3. **Deploy from GitHub repo** seçeneğini seçip ilgili reponuzu bağlayın.
4. Railway otomatik olarak projeyi algılayacak ve build sürecini başlatacaktır.

---

## 3. Kalıcı Veritabanı (Railway Persistent Volume) Kurulumu

> [!IMPORTANT]
> Railway konteynerleri her yeni versiyon deploy edildiğinde yeniden oluşturulur. SQLite dosyanızın (`db.sqlite`) silinmemesi için kalıcı bir **Railway Volume (Disk)** bağlamalısınız.

1. Railway proje panelinizde web servisinizin yanındaki **+ New** butonuna tıklayın.
2. **Volume** seçeneğini seçin.
3. Oluşturulan Volume'u web servisinize bağlayın (Service Settings -> Volumes).
4. **Mount Path** alanına:
   ```text
   /data
   ```
   yazın.

---

## 4. Ortam Değişkenleri (Environment Variables)

Web servisinizin **Variables** sekmesine gidin ve aşağıdaki değişkenleri ekleyin:

| Değişken Adı | Değer | Açıklama |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Üretim modu |
| `JWT_SECRET` | `guclu-ve-rastgele-bir-anahtar-belirleyin` | Kullanıcı oturum güvenliği anahtarı |
| `DATA_DIR` | `/data` | Kalıcı Volume yolu (SQLite buraya yazılır) |
| `DB_PATH` | `/data/db.sqlite` | SQLite veritabanı dosyasının tam yolu |
| `PORT` | *(Railway otomatik atar)* | Manuel girmeye gerek yoktur |
| `ADMIN_EMAIL` | `sizin@eposta-adresiniz` | İlk Genel Yönetici hesabının e-postası |
| `ADMIN_PASSWORD` | *(en az 10 karakter, güçlü bir şifre)* | İlk Genel Yönetici hesabının şifresi |
| `ADMIN_NAME` | `Genel Yönetici` | *(Opsiyonel)* Admin görünen adı |

> [!WARNING]
> `ADMIN_EMAIL` / `ADMIN_PASSWORD` sadece bu e-postaya ait kullanıcı **yoksa** hesap oluşturmak için kullanılır. Mevcut hesabın şifresini değiştirmez. Hesap oluştuktan sonra `ADMIN_PASSWORD` değişkenini silebilirsiniz.

---

## 5. Domain & HTTPS Tanımlama

1. Web servisinizin **Settings** sekmesine gelin.
2. **Networking** bölümünde **Generate Domain** butonuna tıklayın.
3. Size `*.up.railway.app` uzantılı ücretsiz ve otomatik SSL/HTTPS sertifikalı bir link verilecektir (Örn: `golcuk-saha.up.railway.app`).
4. Dilerseniz **Custom Domain** butonuna basarak kendi alan adınızı da (örn: `saha.domain.com`) bağlayabilirsiniz.

---

## 6. Canlıdaki Veritabanını Başlatma ve Üyeleri Yükleme

Railway deploy tamamlandığında sunucu ilk kez başladığında otomatik olarak:
- Tabloları ve indeksleri oluşturur.
- `ADMIN_EMAIL` ve `ADMIN_PASSWORD` tanımlıysa ilk **Genel Yönetici (Admin)** hesabını oluşturur.

> [!IMPORTANT]
> Sistemde sabit/varsayılan şifreli hesap bulunmaz. Admin girişi, 4. adımda tanımladığınız `ADMIN_EMAIL` ve `ADMIN_PASSWORD` bilgileriyle yapılır. Mahalle sorumlusu hesapları admin panelinden açılır (bkz. 7. adım).

### Üye Listesini Aktarma:
1. `ADMIN_EMAIL` / `ADMIN_PASSWORD` bilgileriyle admin olarak giriş yapın.
2. Sol menüden (mobilde alt menüden) **Excel Yükle** sayfasına gidin.
3. Hedef İlçe olarak **Gölcük** seçin.
4. `example_excel/Kocaeli Golcuk Member List.xlsx` dosyasını yükleyin.
5. Sütun eşleştirme ekranında otomatik gelen alanları onaylayıp **Aktarımı Başlat** butonuna basın.
6. 10-15 saniye içinde tüm 1.617 üye mahalleleriyle birlikte canlı sisteme işlenmiş olur.

---

## 7. Mahalle Sorumluları için Hesap Açma

1. Admin panelinde **Kullanıcılar** (Sorumlular) sayfasına gidin.
2. **Yeni Sorumlu Ekle** butonuna tıklayın.
3. Sorumlunun Adını, E-postasını ve Şifresini girin.
4. Rol olarak **Mahalle Sorumlusu** seçin.
5. Sorumlu olacağı mahalleyi (Örn: `DEĞİRMENDERE MERKEZ MAH.`) seçip kaydedin.
6. Bu sorumlu giriş yaptığında:
   - **Sadece kendi mahallesinin istatistiklerini görür.**
   - **Sadece kendi mahallesinin üyelerini listeler ve intiba durumlarını (Destekliyor / Kararsız / Mesafeli / Görüşülmedi) günceller.**
   - Başka mahallelerin üyelerine ve verilerine erişemez.

---

## 8. Veritabanı Yedeğini İndirme

Sistemde istediğiniz zaman veritabanının tam anlık yedeğini alabilirsiniz:
- Masaüstünde Admin Sol Menüsünün en altındaki **"Veritabanı Yedekle"** butonuna basarak tüm SQLite dosyasını bilgisayarınıza indirebilirsiniz.
