# RAD-V Mapping + Spreadsheet

Dashboard RAD-V sekarang menampilkan:
1. Monitoring sensor.
2. Peta GPS dari koordinat Spreadsheet.
3. Jalur/lintasan RAD-V.
4. Marker posisi terbaru.
5. Tabel isi Google Spreadsheet.
6. Klik baris tabel untuk memusatkan peta ke koordinat tersebut.
7. Refresh otomatis setiap 10 detik.

## Struktur data
Google Spreadsheet menjadi sumber data utama:

ESP32 -> Google Apps Script -> Google Spreadsheet
                                      |
                    +-----------------+-----------------+
                    |                                   |
                    v                                   v
              map.js / GitHub                     Tabel HTML
                    |
                    v
              Leaflet Map
                    |
                    v
             Marker + Route

## Persiapan Spreadsheet
Baris pertama harus berisi header. Minimal:
- Latitude
- Longitude
- CPM
- μSv/h / uSv/h / usv

Kolom lain yang ada di Spreadsheet juga akan otomatis ditampilkan pada tabel.

## Akses Spreadsheet
Pastikan Spreadsheet dapat dibaca dari browser. Untuk pengujian paling mudah:
Share -> General access -> Anyone with the link -> Viewer.

## Jika nama sheet bukan Sheet1
Edit:
const SHEET_NAME = "Sheet1";
di map.js.

## GitHub Pages
Upload:
- index.html
- style.css
- map.js
- script.js

Kemudian aktifkan GitHub Pages dari repository.

## Catatan penelitian
Ambang warna marker di map.js saat ini adalah:
- < 0.3 μSv/h: hijau
- 0.3 sampai < 1.0 μSv/h: kuning
- >= 1.0 μSv/h: merah

Ambang tersebut adalah konfigurasi visual dashboard, bukan penetapan batas keselamatan radiasi. Untuk laporan penelitian, sesuaikan dengan acuan/kalibrasi yang digunakan.
