# Progress — H3-SHI Seismic Hazard Indexing

**Proyek Akhir Teknologi Big Data, Kelompok 8**
Terakhir diperbarui: 10 November 2026, notebook v3.4

---

## 1. Apa yang dikerjakan

Memetakan bahaya seismik Indonesia dengan mengganti clustering jarak (k-means, DBSCAN)
menjadi grid heksagonal **Uber H3** sebagai unit analisis. Alasannya geometris: k-means
memartisi ruang jadi sel Voronoi yang konveks dan isotropik, sementara seismisitas
Indonesia mengikuti megathrust Sunda sebagai jalur melengkung sepanjang ~4.000 km dan
Busur Banda sebagai tapal kuda. Memaksakan cluster bulat ke fitur linear berujung pada
satu sesar terpecah jadi banyak cluster, atau satu sesar melebur dengan seismisitas tak
berhubungan di sebelahnya.

DGGS menghindari itu dengan tidak menyimpulkan bentuk sama sekali. Grid ditetapkan di
awal, struktur spasialnya muncul dari statistik per sel.

Per sel dihitung **nilai b Gutenberg-Richter** (MLE Aki-Utsu, dengan pemulusan 1-ring),
lalu empat kanal digabung jadi **Seismic Hazard Index** 0–1.

---

## 2. Teknologi yang dipakai

| Komponen | Pilihan | Catatan |
|---|---|---|
| Grid spasial | **Uber H3 v4**, Resolusi 5 | wajib `h3>=4`, API v3 beda nama fungsi |
| Pengolahan data | pandas, numpy | 314 ribu record |
| Geospasial | geopandas, shapely | ekspor GeoJSON, spatial join provinsi |
| Peta interaktif | folium (Leaflet) | basemap **Esri Canvas** |
| Plot statis | matplotlib, seaborn | tiga panel + histogram |
| Batas administratif | **GADM level 1** | 34 provinsi, kolom `NAME_1` |
| Lingkungan | **Google Colab** | dataset di Google Drive |

### Catatan pemilihan basemap

Sempat dua kali salah dan keduanya gagal secara senyap.

- **CartoDB dark_matter** kini di balik API key. Permintaan tanpa kunci tetap dijawab
  HTTP 200, tapi isinya ubin bertuliskan "API KEY REQUIRED". Terbukti dari isi piksel:
  ubin Carto cuma punya 16 warna unik, ubin peta sungguhan ratusan.
- **OpenStreetMap** menjawab 403 "Access blocked" untuk berkas HTML lokal, karena
  kebijakan penggunaan ubin mereka menolak aplikasi tak teridentifikasi. Ubin blokirnya
  opak putih sehingga justru menutupi lapisan di bawahnya.

Sekarang dipakai **Esri Canvas** (Dark Gray default, Light Gray opsional). Sudah diuji
di dua belas ubin yang menutupi Indonesia: semua 200, 140–372 warna unik.

Pelajaran yang berlaku umum: lapisan kedua **wajib** `show=False`, karena folium
menggambar semua `TileLayer` sekaligus dan yang ditambahkan terakhir menutupi yang
pertama, terlepas dari isi kontrol lapisan.

---

## 3. Status deliverable

| Deliverable | Status |
|---|---|
| Notebook `.ipynb` | **Selesai**, 71 cell, 14 bagian, jalan end-to-end |
| Laporan teknis PDF | **Belum mulai** |
| Draft paper IMRaD | **Belum mulai** |

Dokumen pendukung: `Project Big Data_Walkthrough.md` (PRD v3.4, memuat rumus, rasional
metodologis, dan 38 baris catatan perubahan beserta alasannya).

---

## 4. Isi notebook

| Bagian | Isi |
|---|---|
| 1 | Ingesti, resolusi path otomatis, pemetaan nama kolom |
| 2 | Audit kualitas: penyaringan bertahap, kedalaman default, skala magnitudo |
| 3 | Binning H3 dan laporan cakupan |
| 4 | Estimasi $M_c$ metode MAXC + plot frequency-magnitude |
| 5 | Pipeline SHI (`build_shi`), empat kanal, bobot entropi |
| 6 | 14 assertion validasi |
| 7 | Sensitivitas: N_min, bobot, resolusi, kedalaman default |
| 8 | Tiga panel statis + histogram distribusi |
| 9 | Ekspor GeoJSON, spatial join GADM, Top-20 |
| 10 | Choropleth folium interaktif |
| 11 | Ringkasan konfigurasi run |
| 12 | Uji kewajaran terhadap gempa besar yang diketahui |
| 13 | Homogenitas skala magnitudo |
| 14 | Penulisan berkas review teks |

Pipeline intinya satu fungsi `build_shi()`, bukan kode lurus, karena Bagian 7
menjalankannya ulang tujuh kali untuk sensitivitas.

### Formulasi SHI

$$\text{SHI}_i = \sum_k w_k x_{ik}, \qquad \sum_k w_k = 1$$

| Kanal | Definisi | Domain rujukan |
|---|---|---|
| $N_{\text{norm}}$ | $\log_{10}(N^{M_c}+1)$ min-max | per run |
| $S$ | rasio dangkal tersusut, $\kappa=10$ | absolut |
| $B_{\text{inv}}$ | $1-(b-0{,}5)/1{,}5$ | tetap $[0{,}5\,;2{,}0]$ |
| $M_{\text{norm}}$ | $(M_{\max}-M_c)/(9{,}5-M_c)$ | tetap $[M_c\,;9{,}5]$ |

Tidak ada post-normalisasi. Versi awal memakainya dan itu membuat indeksnya ordinal
belaka: selalu ada tepat satu sel bernilai 0,0 dan satu bernilai 1,0, sehingga jumlah
per tier jadi artefak penskalaan dan antar-run tidak sebanding.

---

## 5. Hasil run terakhir

```
record        322.961 -> 314.023        periode 1960-2024
Mc            4,0  (MAXC menyarankan 3,00)
resolusi      5  (252,9 km2 per sel)
sel           7.017 dari 17.140  (N_min = 10)
b nasional    0,7014        b terukur 76,1%,  b andal 48,9%
SHI           [0,2733 ; 0,8354]   rata-rata 0,5603
tier          Low 0 | Moderate 1.611 | High 5.351 | Very High 55
```

Berkas keluaran: GeoJSON 8,61 MB, peta HTML 16,86 MB, plus lima CSV
(Top-20, tiga tabel sensitivitas, validasi event rujukan).

---

## 6. Temuan utama

### 6.1 Katalognya mengalami saturasi magnitudo — ini temuan terpenting

Magnitudo terbesar di seluruh katalog tersaring hanya **7,90**. Gempa Aceh 2004 yang
sebenarnya Mw 9,1 tercatat sebagai **7,1**.

| Event | Mw literatur | Katalog | Tipe | Selisih |
|---|---:|---:|---|---:|
| Sumatra-Andaman 2004 | 9,1 | 7,1 | `Mw(mB)` | **−2,0** |
| Nias 2005 | 8,6 | 7,7 | `Mw(mB)` | −0,9 |
| Padang 2009 | 7,6 | 7,1 | `mb` | −0,5 |
| Yogyakarta 2006 | 6,3 | 6,0 | `mb` | −0,3 |
| Lombok 2018 | 6,9 | 6,9 | `M` | 0,0 |
| Palu 2018 | 7,5 | 7,5 | `Mw` | 0,0 |

Polanya tegas: **selisihnya membesar seiring magnitudo, dan mengikuti tipe magnitudo.**
Event ber-tipe `Mw` asli akurat. Yang bertipe `mb` dan `Mw(mB)` tersaturasi, makin besar
gempanya makin besar kekurangannya. Ini saturasi gelombang badan, fenomena seismologi
yang sudah dikenal.

Sebaran tipe magnitudo menjelaskan kenapa:

```
MLv 100.393    NaN 98.088    mb 76.301    M 32.178
...    Mw asli hanya 1.344 dari 314 ribu
```

Dua belas tipe magnitudo dalam satu katalog bernama "Standardized". Yang benar-benar
Mw cuma 0,4%.

**Konsekuensinya berlapis:**

1. Kanal $M_{\text{norm}}$ dinormalisasi terhadap plafon 9,5, tapi katalog tak pernah
   melewati 7,9. Jadi kanal itu efektifnya cuma memakai rentang $[0 ; 0{,}71]$, dan
   rata-ratanya memang cuma 0,213.
2. Nilai b nasional 0,7014 ada di bawah tipikal tektonik (~1,0). Pencampuran skala
   magnitudo adalah kandidat utama penyebabnya, dan harus dijawab sebelum anomali b
   rendah diklaim sebagai tegangan tektonik.
3. Megathrust Sunda absen dari Top-20 sebagian karena ini.

### 6.1b Konversi magnitudo generik tidak menyelesaikannya

Bagian 13 menindaklanjuti temuan di atas. Relasi Scordilis (2006) untuk mb hanya berlaku
sampai $m_b = 6{,}2$, sementara tipe `Mw(mB)` tidak punya relasi tepercaya sama sekali.
Diterapkan ke enam event rujukan, rata-rata selisih mutlaknya cuma bergerak dari **0,617
ke 0,595**. Hanya Yogyakarta yang membaik; Aceh, Nias, dan Padang tidak tersentuh.

Koreksinya berhenti persis di tempat masalahnya dimulai.

**Jalan yang realistis:** tambal magnitudo event besar dari GCMT atau USGS. Gempa
$M \ge 6{,}5$ di wilayah dan periode ini hanya ratusan, jadi ini layak dikerjakan dan
langsung menyasar sumber distorsi terbesar. Event kecil boleh dibiarkan karena saturasi
tidak menyentuhnya, padahal merekalah yang mendominasi estimasi $b$.

Yang tidak boleh dilakukan: menjalankan konversi generik lalu menyebut katalognya sudah
terhomogenisasi.

### 6.1c Nilai b berbeda sampai dua kali lipat antar-tipe magnitudo

Hasil run Bagian 13.1, semuanya pada $M_c$ yang sama:

| Tipe | n di atas Mc | mean − Mc | b |
|---|---:|---:|---:|
| MLv | 17.784 | 0,317 | **1,1835** |
| (tanpa tipe) | 5.255 | 0,462 | 0,8482 |
| M | 10.398 | 0,498 | 0,7925 |
| mb | 50.913 | 0,640 | **0,6297** |
| Mw | 1.063 | 1,181 | 0,5000 (terpotong) |

Di antara tipe yang benar-benar lengkap pada $M_c = 4{,}0$, b berkisar **0,63 sampai
1,18**. Nilai nasional 0,7014 hanyalah rata-rata tertimbang dari populasi yang tidak
sebanding.

Angka 0,5000 untuk tipe keluarga Mw adalah artefak, bukan pengukuran. Lembaga hanya
menghitung magnitudo momen untuk gempa besar, jadi mean − Mc mencapai 1,18 dan b
mentahnya jatuh di bawah lantai clipping. Subset itu bukan katalog lengkap pada Mc 4,0.

Satu koreksi untuk catatan sebelumnya: katalog ini memuat **26 tipe magnitudo**, bukan
12. Angka 12 berasal dari `head(12)` pada daftar yang terpotong.

### 6.1d Kabar baiknya: tipe tercampur rata secara spasial

Ini kekhawatiran terbesar, dan hasilnya melegakan.

| Tipe dominan | Jumlah sel | b rata-rata |
|---|---:|---:|
| (tanpa tipe) | 2.364 | 0,7548 |
| MLv | 2.181 | 0,7593 |
| mb | 2.174 | 0,7062 |
| M | 184 | 0,7562 |
| MD | 64 | 0,6036 |

Median porsi tipe dominan hanya **50%**, jadi tidak ada sel yang dikuasai satu lembaga.
Dan selisih b antar-sel menurut tipe dominannya cuma 0,70 sampai 0,76, jauh lebih sempit
daripada sebaran nasional 0,63–1,18. Pencampuran spasial meredam sebagian besar efeknya.

Jadi peta b-mu **bukan** sekadar peta lembaga pelapor. Itu pembelaan yang kuat dan harus
masuk laporan.

### 6.1e Run homogenisasi: peringkat bertahan, tapi jalannya buntu

```
event dikonversi : 20,8%       mag maksimum : 7,90 -> 7,90
overlap Top-20   : 18/20       Spearman rho : 0,9779
b nasional       : 0,7014 -> 0,5939
```

Magnitudo maksimum tidak bergerak sama sekali, persis seperti perkiraan: event terbesar
bertipe `Mw(mB)` atau di atas plafon mb 6,2, jadi tidak tersentuh konversi.

Spearman 0,9779 dan overlap 18/20 adalah bagian yang bisa dipegang. Pencampuran skala
menggeser nilai absolut SHI, bukan membalik peringkat selnya.

**Tapi perbandingan angka absolutnya belum sah**, dan dua percobaan memperbaikinya justru
menunjukkan kenapa jalan ini buntu.

Percobaan pertama memakai Mc = 4,0 di kedua skala, padahal konversi menggeser skalanya.
Percobaan kedua mengestimasi ulang Mc dengan MAXC pada skala terkonversi, dan itu
**tidak melakukan apa-apa**: karena hanya 20,8% event yang terkonversi, modus distribusi
gabungan masih ditentukan oleh 79% sisanya, jadi MAXC mengembalikan nilai yang sama.
Baris "terkoreksi" dan baris "sengaja keliru" keluar identik.

Perbaikan di v3.1 menghitung ambangnya dari relasi konversinya sendiri:

| Tipe | Ambang tersirat |
|---|---:|
| MS | 4,750 |
| mb | 4,430 |
| Mw / tidak dikonversi | 4,000 |

Ambang global harus setinggi yang tertinggi, yaitu **Mc = 4,80**. Dan di situlah
persoalannya: menaikkan Mc dari 4,0 ke 4,8 menyisakan sekitar 28% event saja.

Hasil run v3.1 dengan ambang yang benar:

```
asli (Mc 4,00)            b terukur 76,1%   SHI rata-rata 0,5603   tier 0/1611/5351/55
terhomogenisasi (Mc 4,80) b terukur 33,9%   SHI rata-rata 0,4646   tier 24/4709/2275/9

b nasional     : 0,7014 -> 0,9854
overlap Top-20 : 16/20        Spearman rho : 0,9145
```

Dua catatan. **b nasional naik ke 0,9854**, mendekati nilai tektonik tipikal ~1,0, jadi
arah homogenisasinya benar. Dan peringkatnya **kurang stabil dari dugaan awal**: 16/20
dan 0,9145, bukan 18/20 dan 0,9779 seperti yang dilaporkan dari perbandingan ber-Mc
keliru.

Perbandingan ini masih mengubah dua hal sekaligus, skala magnitudo dan ambang Mc. Untuk
memisahkannya perlu satu run tambahan: katalog asli pada Mc 4,80.

**Kesimpulan untuk laporan.** Konversi generik memaksa memilih antara dua hal yang
sama-sama buruk: ambang yang sah tetapi membuang dua pertiga data, atau data utuh dengan
ambang yang tidak sah. Karena itu rekomendasinya tetap menambal magnitudo event besar
dari GCMT atau USGS, bukan mengkonversi seluruh katalog.

### 6.1f Efek ambang jauh lebih besar daripada efek homogenisasi

Run keempat memisahkan dua hal yang sebelumnya tercampur:

| Konfigurasi | SHI rata-rata | b terukur | Very High |
|---|---:|---:|---:|
| asli, Mc 4,00 | 0,5603 | 76,1% | 55 |
| **asli, Mc 4,80** | **0,4141** | **23,0%** | **0** |
| terhomogenisasi, Mc 4,80 | 0,4646 | 33,9% | 9 |
| terhomogenisasi, Mc 4,00 (keliru) | 0,5893 | 81,0% | 127 |

Baris kedua itu kuncinya. **Menaikkan Mc saja, tanpa menyentuh skala magnitudo, sudah
menghapus seluruh tier Very High** (55 menjadi 0) dan menjatuhkan b terukur ke 23%.
Homogenisasi di atasnya justru sedikit memulihkan (0 menjadi 9, 23,0% menjadi 33,9%),
karena konversi menaikkan magnitudo sehingga lebih banyak event melewati ambang.

Pemisahannya sekarang terukur, lewat tumpang-tindih Top-20:

```
asli@4,0  vs asli@4,80              : 16/20   <- pengaruh ambang saja
asli@4,80 vs terhomogenisasi@4,80   : 18/20   <- pengaruh konversi saja
asli@4,0  vs terhomogenisasi@4,80   : 16/20   <- keduanya
```

**Ambang menjelaskan hampir seluruh perubahan.** Konversi magnitudo sendiri hanya
menggeser 2 dari 20 sel. Jadi saturasi magnitudo memang tidak banyak mengubah peringkat,
dan ini kabar baik: masalah terbesar katalogmu tidak merusak kesimpulan spasialnya.

### 6.2 Sel episentrum Aceh 2004 nyaris kosong, dan penyebabnya bukan yang diduga

Sel yang memuat koordinat episentrum Aceh hanya punya **13 event, 7 di atas Mc, dan
magnitudo maksimum 5,5**, padahal ada 749 event dalam radius 0,5°.

Dugaan awal kami: kotak pembatas memotong di 6°LU sementara rupture 2004 memanjang ke
utara, sehingga sebagian besar gempa susulannya di luar wilayah studi. **Dugaan itu
diuji di Bagian 12.5 dan ternyata salah.**

```
koridor 92-100 BT, >= 1960 : 28.581 event
  pita 3..6 LU   : 8.708 event   (di dalam bbox)
  pita 6..9 LU   :   178 event   (terbuang)
  pita 9..20 LU  :     0 event

di atas 6 LU, terbuang : 178 (0,6%)
sekuens 2004-2005      : 3.091 event, terbuang 30 (1,0%)
lintang maksimum sekuens : 7,00 LU
```

Hanya **1% sekuens 2004–2005 yang terbuang**, dan pita 9–20°LU benar-benar kosong.
Katalognya memang tidak pernah memuat gempa di atas ~7°LU di koridor itu, kemungkinan
karena cakupannya dibatasi ke wilayah Indonesia saat disusun. Memperlebar kotak
pembatas tidak akan menambah apa pun.

**Penjelasan yang benar jauh lebih sederhana: selnya terlalu kecil.** Rupture 2004
memanjang sekitar 1.300 km, sehingga 3.091 gempa susulannya tersebar di sangat banyak
sel res 5 yang masing-masing cuma ~17 km. Tidak ada satu sel pun yang menumpuk banyak
event, termasuk sel episentrumnya.

Ini justru memperkuat argumen res 4 di 6.5: sel yang tujuh kali lebih besar akan
menangkap jauh lebih banyak gempa susulan per sel untuk rupture memanjang seperti ini.

### 6.3 Peringkat Top-20 terbukti kokoh

Seluruh 20 sel bertahan saat event berkedalaman default dibuang (overlap **20/20**),
dengan delta SHI cuma −0,003 sampai −0,010. Sel-sel itu punya `shallow_ratio` 0,90–0,98,
jadi setelah kedalaman default dibuang pun event tersisa tetap didominasi gempa dangkal.
Mereka memang benar dangkal, bukan tampak dangkal karena data hilang.

Isinya 17 sel Maluku Utara, 2 Sulawesi Utara, 1 Papua; 17 lepas pantai, 3 di darat.
Semuanya punya nilai b terukur dan andal, tak satu pun hasil imputasi. Secara geologi
masuk akal: zona tumbukan Laut Maluku dengan subduksi ganda Halmahera-Sangihe memang
salah satu yang paling aktif di dunia.

### 6.4 Pembobotan entropi gagal di sini

```
          sama rata   entropi
n_norm       0,2500    0,3317
s_norm       0,2500    0,1673
b_inv        0,2500    0,0185   <- kanal tegangan praktis dihapus
m_norm       0,2500    0,4824   <- kanal paling bias ukuran sampel
```

Entropi menghargai dispersi, bukan relevansi fisis. Nilai b Indonesia berkerumun sempit
sehingga `b_inv` nyaris dibuang, sementara `m_norm` yang korelasinya 0,618 dengan
`n_norm` justru dapat bobot terbesar. Versi entropi di sini **lebih buruk**, bukan lebih
objektif. Bobot sama rata dipertahankan sebagai baseline, dan Spearman ρ 0,9137
menunjukkan peringkatnya tetap mirip.

### 6.5 Resolusi 5 mungkin bukan pilihan terbaik

| Resolusi | Luas sel | Sel | b terukur |
|---|---:|---:|---:|
| 4 | 1.770,3 km² | 2.144 | **96,0%** |
| 5 | 252,9 km² | 7.017 | 76,1% |
| 6 | 36,1 km² | 7.102 | 31,3% |

PRD awal menyebut res 5 seluas 1.570 km² dengan sisi 25 km. Itu keliru, dan angka itu
sebenarnya milik res 4. Alasan pemilihan resolusi yang ditulis, "skala di mana estimasi
b punya cukup event per sel", justru menunjuk ke **res 4**.

Res 6 jelas tidak layak: hanya menghasilkan 7.102 sel, nyaris sama dengan res 5, padahal
64.185 sel terbuang dan b terukur anjlok ke 31,3%.

### 6.6 Indeksnya kurang diskriminatif

Tidak ada sel Low sama sekali, dan 76% sel masuk High. Penyebabnya `b_inv` rata-rata
0,8484 dan `s_norm` 0,7617: dua kanal yang tinggi dan rata di seluruh Indonesia,
menyumbang ~0,40 ke setiap sel sebelum variasi apa pun. Ambang 0,25/0,50/0,75 tidak
cocok dengan distribusi yang sebenarnya.

Saran: tetap laporkan tier absolut apa adanya, tapi tambahkan tier berbasis kuartil dari
`shi_rank_pct` untuk prioritisasi.

---

## 7. Yang sudah diverifikasi

- Seluruh 43 cell kode lolos `compile()`, dan analisis aliran nama memastikan tidak ada
  cell yang membaca variabel yang belum didefinisikan cell sebelumnya
- 14 assertion invariant lolos pada 7.017 sel
- Bobot entropi, batas tier, dan invariant sel sparse diuji terpisah dengan stdlib
- Urutan sumbu ubin ArcGIS `{z}/{y}/{x}` diuji terhadap ubin OSM di koordinat sama
- GeoJSON lolos baca-ulang dengan seluruh kolom flag utuh

## 8. Yang masih terbuka

| Prioritas | Isu |
|---|---|
| Sedang | Saturasi magnitudo. Sudah diukur di Bagian 13, dan pengaruhnya ke peringkat ternyata kecil (18/20). Cukup dilaporkan sebagai limitasi; penambalan GCMT tidak mendesak |
| **Tinggi** | $M_c$ 4,0 versus MAXC 3,00, selisih 1,0. Arahnya aman tapi harus diargumentasikan |
| ~~Tinggi~~ | ~~Kotak pembatas memotong rupture Aceh 2004~~ — **terbantahkan** di Bagian 12.5: hanya 1% sekuens yang terbuang. Penyebabnya ukuran sel, bukan batas wilayah |
| **Tinggi** | Pilihan res 5 versus res 4. Temuan 6.2 menambah alasan untuk res 4: sel besar lebih cocok untuk rupture memanjang |
| ~~Sedang~~ | ~~Ambang tier tidak cocok dengan distribusi~~ — **selesai**, kolom `hazard_quartile` dilaporkan berdampingan |
| Sedang | 30,24% event berkedalaman default. Dampaknya sudah diukur dan kecil, tapi harus dilaporkan |
| Rendah | Katalog tanpa declustering, Gardner-Knopoff sebagai pekerjaan lanjutan |
| Rendah | 33 km sebagai kandidat kedalaman default ketiga, uji lonjakan sudah terpasang |

---

## 9. Cara menjalankan

1. Upload `H3_SHI_Seismic_Hazard.ipynb` ke Google Colab
2. Lepas komentar baris `pip install` di cell pertama
3. Jalankan cell mount Drive, setujui izinnya
4. Runtime → Run all

Dataset dan GADM dicari otomatis dengan pencocokan pola di `MyDrive`, jadi letak
foldernya tidak perlu diatur. Perkirakan 10–15 menit; Bagian 7 menjalankan pipeline
tujuh kali.

Semua keluaran (peta, GeoJSON, CSV, gambar, berkas review) otomatis ditulis ke
`MyDrive/h3shi_output/` sehingga tetap ada setelah sesi Colab berakhir.

### Berkas di repositori

| Berkas | Isi |
|---|---|
| `H3_SHI_Seismic_Hazard.ipynb` | notebook utama |
| `Project Big Data_Walkthrough.md` | PRD v2.8 |
| `progress.md` | dokumen ini |
| `pencerdasan.md` | penjelasan rinci tiap langkah beserta contoh kodenya |
| `indonesia_seismic_hazard_map.html` | peta interaktif hasil run |
| `gadm41_IDN_1.json/` | batas provinsi GADM |
| `cell_ringkasan_review.py` | **usang**, isinya sudah jadi Bagian 13 notebook |
| `*.bak` | cadangan tambalan basemap, aman dihapus |

---

## 10. Langkah berikutnya

1. Putuskan sikap terhadap saturasi magnitudo. Ini menentukan apakah angka SHI bisa
   dipertahankan di depan penguji
2. Argumentasikan $M_c$ 4,0 terhadap plot MAXC
3. Pertimbangkan memperlebar batas lintang utara agar rupture Aceh 2004 tercakup
4. Mulai laporan teknis, dengan tabel validasi event rujukan sebagai bagian tersendiri
5. Susun draft paper IMRaD

Catatan: semua angka di atas berasal dari run v3.1 dan sudah final, kecuali pemisahan
efek homogenisasi dari efek ambang yang masih perlu satu run tambahan.
