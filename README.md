# H3-SHI: Pemetaan Bahaya Seismik Indonesia Berbasis Discrete Global Grid System (Uber H3)

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Uber H3](https://img.shields.io/badge/Uber%20H3-v4.0%2B-orange.svg)](https://h3geo.org/)
[![GeoPandas](https://img.shields.io/badge/GeoPandas-0.14%2B-green.svg)](https://geopandas.org/)
[![Folium](https://img.shields.io/badge/Folium-Leaflet-brightgreen.svg)](https://python-visualization.github.io/folium/)
[![Catalog](https://img.shields.io/badge/Catalog-314k%20Records%20(1960--2024)-red.svg)](#ringkasan-dataset)

Proyek ini memetakan indeks kerawanan bahaya gempa bumi (*Seismic Hazard Index* / SHI) di seluruh wilayah Indonesia dengan mempartisi ruang menggunakan sistem heksagonal berukuran seragam (**Uber H3 Resolution 5**).

---

## Daftar Isi
1. [Latar Belakang dan Masalah](#latar-belakang-dan-masalah)
2. [Metodologi H3-SHI](#metodologi-h3-shi)
3. [Ringkasan Dataset](#ringkasan-dataset)
4. [Temuan Utama](#temuan-utama)
5. [Struktur Repositori](#struktur-repositori)
6. [Panduan Instalasi dan Menjalankan Kode](#panduan-instalasi-dan-menjalankan-kode)
7. [Dashboard dan Peta Interaktif](#dashboard-dan-peta-interaktif)
8. [Uji Sensitivitas dan Validasi](#uji-sensitivitas-dan-validasi)
9. [Batasan Penelitian](#batasan-penelitian)

---

## Latar Belakang dan Masalah

Pendekatan umum dalam analisis spasial gempa adalah pengelompokan (*spatial clustering*) seperti K-Means atau DBSCAN. Namun, pendekatan ini memiliki kelemahan mendasar jika diterapkan pada tektonik Indonesia:

* **Bentuk cluster konvensional bersifat bulat (isotropik).** K-Means membagi ruang menjadi sel Voronoi konveks.
* **Seismisitas Indonesia bersifat linear dan melengkung.** Zona Megathrust Sunda membentang sepanjang 4.000 km, sedangkan Busur Banda melengkung membentuk tapal kuda.
* Memaksakan pengelompokan bulat pada struktur linear menyebabkan patahan terpecah menjadi banyak cluster tak alami, atau menggabungkan dua sesar aktif berbeda ke dalam satu kelompok.

### Solusi: Discrete Global Grid System (DGGS)
Proyek ini tidak menebak atau memaksakan bentuk kelompok. Ruang dibagi sejak awal menjadi **7.017 petak heksagonal seragam** seluas ~252,9 km² per sel (Uber H3 Resolusi 5). Karakteristik bahaya seismik muncul murni dari statistik gempa pada masing-masing sel.

---

## Metodologi H3-SHI

Indeks Bahaya Seismik (*Seismic Hazard Index* / SHI) bernilai antara 0 hingga 1. Indeks ini merupakan rata-rata tertimbang dari 4 kanal fisik:

$$\text{SHI}_i = \sum_{k=1}^4 w_k x_{ik}, \qquad \sum_{k=1}^4 w_k = 1$$

Pada model dasar (*baseline*), masing-masing kanal diberi bobot seimbang $w_k = 0{,}25$:

| Kanal | Nama Komponen | Formulasi Matematis | Rentang Domain | Interpretasi Geologi |
|---|---|---|---|---|
| $N_{\text{norm}}$ | Frekuensi Gempa | $\frac{\log_{10}(N^{M_c} + 1)}{\max(\dots)}$ | $[0\,; 1]$ | Kerapatan aktivitas pelepasan energi gempa pada magnitudo lengkap ($M \ge 4{,}0$). |
| $S$ | Rasio Dangkal Tersusut | $\frac{N_{\text{shallow}} + \kappa \cdot \bar{S}_{\text{nat}}}{N_{\text{total}} + \kappa}$ | $[0\,; 1]$ | Proporsi gempa dengan kedalaman $< 50\text{ km}$. Gempa dangkal memiliki daya rusak terbesar di permukaan. Shrinkage ($\kappa = 10$) mencegah bias pada sel dengan data sedikit. |
| $B_{\text{inv}}$ | Inversi Nilai $b$ | $1 - \frac{b - 0{,}5}{1{,}5}$ | Tetap $[0{,}5\,; 2{,}0]$ | Estimasi tegangan kerak bumi (*crustal stress*). Nilai $b$ dihitung dengan metode MLE Aki-Utsu dan pemulusan spasial 1-ring (*spatial neighbor smoothing*). Nilai $b$ rendah menandakan batuan sedang menahan tegangan geser tinggi. |
| $M_{\text{norm}}$ | Magnitudo Maksimum | $\frac{M_{\max} - M_c}{9{,}5 - M_c}$ | Tetap $[M_c\,; 9{,}5]$ | Potensi magnitudo terburuk yang pernah terjadi di sel tersebut, dinormalisasi ke batas atas teoritis tektonik bumi (9,5). |

> **Catatan Normalisasi:** Model ini tidak menerapkan post-normalisasi min-max pada nilai akhir SHI. Hal ini menjaga agar nilai SHI absolut dapat dibandingkan antar-skenario dan antar-resolusi secara adil.

---

## Ringkasan Dataset

* **Sumber Data:** Katalog Gempa BMKG / Standardized Earthquake Catalog (periode 1960 hingga 2024).
* **Penyaringan Kualitas Data:**
  * Total data mentah: 322.961 peristiwa gempa.
  * Lolos audit kualitas (wilayah Indonesia, kedalaman valid, magnitudo lengkap): **314.023 peristiwa**.
* **Batas Magnitudo Kelengkapan ($M_c$):** Ditetapkan $M_c = 4{,}0$ (uji MAXC merekomendasikan 3,00; ambang 4,0 dipilih untuk menjamin stabilitas estimasi nilai $b$ secara nasional).
* **Unit Spasial:** Uber H3 Resolusi 5 (luas ~252,9 km² per sel, panjang sisi ~9,8 km).
* **Sel Aktif Teranalisis:** 7.017 sel (dengan syarat minimal 10 peristiwa per sel).

---

## Temuan Utama

1. **Dominasi Zona Tumbukan Laut Maluku:**
   17 dari 20 petak paling berbahaya (Top-20 SHI) berada di Provinsi Maluku Utara, 2 sel di Sulawesi Utara, dan 1 sel di daratan Papua. Wilayah ini merupakan zona subduksi ganda (*Halmahera-Sangihe collision zone*) yang sangat aktif. Sel berperingkat tertinggi (#1) memiliki indeks SHI sebesar **0,8354**.
2. **Kestabilan Peringkat Top-20:**
   Peringkat 20 sel teratas terbukti kokoh. Saat data gempa dengan kedalaman *default* dieliminasi, seluruh 20 sel tetap bertahan (overlap 20/20) dengan deviasi skor yang sangat kecil (hanya 0,003 hingga 0,010).
3. **Temuan Ilmiah Saturasi Magnitudo Katalog:**
   Katalog gempa historis pra-2010 mengalami fenomena saturasi gelombang badan (*body-wave saturation*). Gempa Megathrust Aceh 2004 (Mw 9,1) tercatat hanya berkekuatan 7,1 karena menggunakan skala `Mw(mB)`. Nilai magnitudo tertinggi di seluruh katalog tersaring tertahan di 7,90.
4. **Analisis Sel Episentrum Aceh 2004:**
   Sel H3 yang memuat titik episentrum Aceh 2004 hanya memuat 13 peristiwa gempa tercatat. Investigasi membuktikan ini bukan karena batasan koordinat yang terpotong, melainkan karena panjang retakan (*rupture length*) gempa mencapai 1.300 km, sehingga ribuan gempa susulan tersebar meluas ke puluhan sel H3 berukuran 17 km.

---

## Struktur Repositori

```text
├── H3_SHI_Seismic_Hazard.ipynb         # Notebook utama pipeline data (71 cell, 14 bagian)
├── index.html                          # Dashboard analitik interaktif (single-file HTML/CSS/JS)
├── indonesia_seismic_hazard_map.html   # Peta choropleth Folium interaktif (7.017 sel H3)
├── pencerdasan_dashboard.md            # Panduan membaca dashboard untuk orang awam
├── pencerdasan.md                      # Panduan teknis isi notebook dan metodologi
├── progress.md                         # Catatan penelitian, audit data, dan log pengujian
├── naskah_demo.md                      # Naskah presentasi dan alur demonstrasi 5 menit
├── Project Big Data_Walkthrough.md     # PRD dan dokumentasi teknis lengkap
└── README.md                           # Dokumentasi utama proyek
```

---

## Panduan Instalasi dan Menjalankan Kode

### 1. Kloning Repositori
```bash
git clone https://github.com/althof/seismik-indonesia.git
cd seismik-indonesia
```

### 2. Menyiapkan Lingkungan Python
Gunakan lingkungan virtual (disarankan Python 3.10 atau 3.11):

```bash
# Menggunakan venv
python -m venv .venv
source .venv/bin/activate  # Untuk Linux/macOS
# .venv\Scripts\activate   # Untuk Windows

# Instal dependensi
pip install pandas numpy geopandas shapely folium matplotlib seaborn h3
```

> **Penting untuk Library H3:** Pastikan menginstal Uber H3 versi 4 (`pip install "h3>=4.0.0"`). API H3 versi 3 memiliki penamaan fungsi yang berbeda.

### 3. Menjalankan Pipeline Analisis
Buka dan jalankan seluruh cell pada notebook:
```bash
jupyter notebook H3_SHI_Seismic_Hazard.ipynb
```
Notebook akan membaca katalog gempa, menjalankan audit kualitas, menghitung nilai $b$ per sel, menyusun skor SHI, melakukan uji sensitivitas, dan mengekspor berkas GeoJSON serta peta HTML.

---

## Dashboard dan Peta Interaktif

Repositori ini menyediakan dua visualisasi siap pakai tanpa perlu instalasi server rumit:

1. **Dashboard Analitik ([index.html](index.html)):**
   * Dashboard berbasis web mandiri (*zero external dependencies*, tanpa Node.js/build step).
   * Fitur: Indikator KPI nasional, visualisasi perbandingan Absolute Tier vs Quartile Tier, kalkulator dekomposisi 4 kanal, peta ikhtisar 20 sel teratas, tabel interaktif dengan pencarian dan filter provinsi, serta simulasi pengujian sensitivitas A sampai D.
   * Cukup klik ganda berkas `index.html` untuk membuka di peramban apa pun.
2. **Peta Choropleth Lengkap ([indonesia_seismic_hazard_map.html](indonesia_seismic_hazard_map.html)):**
   * Visualisasi interaktif berbasis Leaflet dan Folium yang merender seluruh 7.017 heksagon di atas peta dasar Esri Canvas Dark/Light.
   * Klik pada heksagon untuk melihat detail koordinat, jumlah gempa, nilai $b$, dan skor SHI lengkap.

---

## Uji Sensitivitas dan Validasi

Untuk memastikan model tidak rapuh terhadap perubahan parameter, dilakukan empat uji ketahanan:

* **Uji Sensitivitas Bobot:** Menguji skenario bobot seimbang (0,25) dibandingkan variasi bobot dominan frekuensi, dominan kedalaman dangkal, dan bobot berbasis entropi. Korelasi peringkat Spearman tetap tinggi ($\rho > 0{,}91$).
* **Uji Ambang Sampel Minimum ($N_{\min}$):** Menguji variasi nilai ambang keaktifan sel ($N_{\min} = 5, 10, 20$).
* **Uji Kedalaman Default:** Menguji stabilitas model saat data dengan kedalaman default (10 km dan 33 km) dihilangkan. Seluruh Top-20 bertahan 100%.
* **Validasi Sejarah Gempa:** Memverifikasi posisi 6 gempa besar (Aceh 2004, Nias 2005, Padang 2009, Yogyakarta 2006, Lombok 2018, Palu 2018). Seluruh wilayah terdampak terkonfirmasi berada dalam sel risiko tinggi atau moderat tinggi.

---

## Batasan Penelitian

Hasil pemodelan ini perlu dipahami dengan memperhatikan batasan ilmiah berikut:

1. **Bukan Prediksi Waktu Gempa:** Model ini memetakan bahaya relatif jangka panjang (*spatial hazard index*), bukan alat prediksi deterministik untuk meramal hari, tanggal, atau jam terjadinya gempa berikutnya.
2. **Efek Ukuran Sel terhadap Patahan Panjang:** Gempa megathrust dengan retakan ratusan kilometer menyebarkan gempa susulannya ke banyak sel heksagon. Hasil perbandingan menunjukkan H3 Resolusi 4 (~1.770 km²) berpotensi menangkap kluster gempa susulan megathrust lebih baik dibanding Resolusi 5.
3. **Heterogenitas Skala Magnitudo:** Katalog historis menggabungkan lebih dari 20 tipe skala magnitudo (MLv, mb, Mw, M). Analisis spasial membuktikan pencampuran skala ini merata di seluruh wilayah Indonesia (median dominansi per sel hanya 50%), sehingga variasi nilai $b$ antar-sel murni mencerminkan heterogenitas tektonik dan bukan artefak lembaga pelapor.

---

## Kontribusi dan Lisensi

Proyek ini dikembangkan sebagai Proyek Akhir Mata Kuliah Teknologi Big Data (Kelompok 8). Seluruh kode dan dokumentasi dirilis untuk tujuan akademis, riset, dan edukasi kebencanaan terbuka.
