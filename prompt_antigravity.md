# Prompt untuk Antigravity — Dashboard H3-SHI

Salin seluruh isi di bawah garis ini ke Antigravity.

---

## Konteks proyek

Saya punya hasil analisis bahaya seismik Indonesia dan butuh dashboard satu halaman untuk
menjelaskannya ke dosen penguji dan anggota kelompok.

**Yang dianalisis.** 314.023 gempa Indonesia 1960–2024 dibagi ke dalam 7.017 sel heksagon
Uber H3 Resolusi 5 (252,9 km² per sel). Pendekatan grid heksagon dipilih menggantikan
clustering jarak (k-means, DBSCAN), karena algoritma itu menghasilkan cluster konveks dan
isotropik sementara seismisitas Indonesia berbentuk linear dan melengkung: megathrust Sunda
sepanjang ~4.000 km, Busur Banda berbentuk tapal kuda, sesar Sumatra dan Palu-Koro berupa
lineamen sempit.

**Indeksnya.** Tiap sel mendapat Seismic Hazard Index (SHI) 0–1 dari rata-rata empat kanal
berbobot sama:

| Kanal | Yang diukur | Rata-rata nasional |
|---|---|---:|
| `n_norm` | kerapatan gempa (log, di atas Mc) | 0,4181 |
| `s_norm` | proporsi gempa dangkal ≤70 km | 0,7617 |
| `b_inv` | tegangan kerak, dari nilai b Gutenberg-Richter terbalik | 0,8484 |
| `m_norm` | magnitudo maksimum historis | 0,2130 |

Nilai b dihitung dengan MLE Aki-Utsu, dimuluskan atas disk 1-ring (sel + 6 tetangganya)
supaya sel sepi tidak menghasilkan estimasi sampah. b rendah berarti tegangan kerak tinggi,
jadi dibalik sebelum masuk indeks.

## Pertanyaan yang harus dijawab dashboard ini

Satu, dan ini menentukan apa yang paling besar di layar:

> **Di mana bahaya seismik Indonesia terkonsentrasi, dan apa yang membuat sel-sel itu
> menonjol?**

Dan satu temuan yang harus terbaca paling awal:

> **17 dari 20 sel paling berbahaya ada di Maluku Utara. Yang membuat mereka menonjol bukan
> kedangkalan gempanya, melainkan kerapatan kejadian.**

Itu masuk akal secara geologi: Zona Tumbukan Laut Maluku punya subduksi ganda, Lempeng Laut
Maluku menunjam ke dua arah sekaligus, ke bawah Halmahera di timur dan Sangihe di barat.

## Angka hasil yang harus tampil

```
sel dianalisis   7.017 dari 17.140 (ambang minimal 10 gempa per sel)
SHI              rentang 0,2733–0,8354, rata-rata 0,5603
tier absolut     Low 0 | Moderate 1.611 | High 5.351 | Very High 55
tier kuartil     1.754 / 1.754 / 1.754 / 1.755
b nasional       0,7014
b terukur        76,1% sel (sisanya imputasi, ditandai)
Mc operasional   4,0 (MAXC menyarankan 3,00)
```

### Bukti kekokohan — ini yang membuat hasilnya bisa dipertahankan

Empat uji sensitivitas, dan semuanya lewat:

| Uji | Hasil |
|---|---|
| Ambang inklusi 5 / 10 / 20 gempa | tumpang-tindih Top-20 **20/20** di semua ambang |
| Kedalaman default dibuang (30,24% katalog) | tumpang-tindih **20/20**, pergeseran SHI cuma 0,003–0,010 |
| Konversi skala magnitudo | tumpang-tindih **18/20** |
| Resolusi 4 / 5 / 6 | b terukur 96,0% / 76,1% / 31,3% |

### Keterbatasan yang juga harus tampil, jangan disembunyikan

Dashboard ini untuk penguji, jadi kejujurannya bagian dari nilainya.

- **Saturasi magnitudo.** Katalog mencatat gempa Aceh 2004 sebagai **7,1** padahal Mw
  sebenarnya **9,1**. Magnitudo terbesar di seluruh katalog cuma 7,90. Penyebabnya katalog
  mencampur 26 tipe magnitudo dan hanya 1.344 dari 314 ribu yang Mw asli.
- **Nilai b berbeda jauh antar-tipe magnitudo**: MLv 1,1835 versus mb 0,6297.
- **Tidak ada sel Low sama sekali**, dan 76% sel masuk tier High. Indeksnya kurang
  diskriminatif karena dua kanal (`b_inv` dan `s_norm`) tinggi dan rata di seluruh Indonesia.
- **Sel episentrum Aceh cuma berisi 13 gempa**, karena rupture 2004 memanjang ~1.300 km
  sementara sel res 5 cuma ~17 km, jadi gempa susulannya tersebar ke ratusan sel.

## Data yang tersedia

Semua di folder `h3shi_output/`. Jangan hitung ulang apa pun, cukup baca.

| Berkas | Isi |
|---|---|
| `top_20_critical_hexagons.csv` | 20 sel teratas, 19 kolom |
| `sensitivity_nmin.csv` | uji ambang inklusi |
| `sensitivity_resolution.csv` | uji resolusi 4/5/6 |
| `sensitivity_default_depth.csv` | uji kedalaman default |
| `sensitivity_magnitude_homogenisation.csv` | uji homogenisasi magnitudo |
| `validation_reference_events.csv` | skor 6 gempa besar yang diketahui |
| `indonesia_seismic_hazard_h3_res5.geojson` | 7.017 heksagon, 8,8 MB |
| `indonesia_seismic_hazard_map.html` | peta folium interaktif, 17,3 MB |
| `h3shi_review.txt` | seluruh angka hasil run |

Kolom `top_20_critical_hexagons.csv`:

```
h3_index, province, location_type, n_provinces, centroid_lat, centroid_lon,
total_events, n_mc, shallow_ratio, default_depth_share, max_magnitude,
b_value_imputed, b_estimated, b_reliable, shi, shi_rank_pct, hazard_level,
hazard_quartile, risk_driver
```

Kolom `validation_reference_events.csv` memuat nilai keempat kanal per event rujukan
(`n_norm`, `s_norm`, `b_inv`, `m_norm`), jadi bisa dipakai untuk panel penjelas.

## Batasan teknis

1. **Satu berkas `index.html` mandiri.** Tanpa framework, tanpa build step, tanpa npm.
   Alasannya praktis: harus bisa di-deploy ke GitHub Pages apa adanya dan dibuka dengan
   dobel-klik tanpa server.
2. **Data CSV ditanam langsung di dalam HTML** sebagai array JavaScript. Semuanya kecil,
   total di bawah 20 KB. Jangan `fetch()` berkas lokal — itu gagal di protokol `file://`.
3. **Jangan tanam GeoJSON 8,8 MB.** Untuk peta ikhtisar, pakai `centroid_lat` dan
   `centroid_lon` dari Top-20 saja. Peta lengkap cukup ditaut sebagai tombol ke
   `indonesia_seismic_hazard_map.html`.
4. **Chart digambar dengan SVG inline**, tanpa pustaka chart. Datanya sedikit dan bentuknya
   sederhana.
5. Font dari Google Fonts boleh. Selain itu tidak ada dependensi eksternal.
6. Bahasa antarmuka: **Indonesia**. Nama kolom teknis boleh tetap Inggris.

## Aturan desain — ikuti ini ketat

Ini **app screen**, bukan landing page. Aturannya berbeda, dan berikut yang berlaku. Semua
angka di bawah berasal dari studi 23 layar produk nyata.

### Yang membedakan dashboard sungguhan dari template

1. **Warna hanya pada data, bukan pada chrome.** Target: sekitar 3% piksel berwarna, maksimum
   5%. Satu hue saja untuk seluruh layar, dan hue itu dipakai pada elemen data utama, bukan
   pada tombol atau sidebar.
2. **KPI itu tipografi, bukan kartu.** Angka telanjang di atas kanvas, atau satu kontainer
   dibagi garis 1px. **Tanpa ikon dalam lingkaran berwarna. Tanpa sparkline. Tanpa tile
   bertint.** Nol dari 23 layar studi memakainya.
3. **Permukaan datar.** Tanpa bayangan pada kartu. Pemisah cukup garis 1px atau satu langkah
   nada.
4. **Tanpa hero header.** Judul layar maksimum 24px. Angka terbesar di layar adalah yang
   menjawab pertanyaan utama, bukan judulnya.
5. **Chart hampir tanpa chrome.** Satu seri per chart, tanpa legenda. Gridline horizontal
   saja, 3–5 garis, 1px solid `#e5e5e5`. Tanpa garis sumbu Y. Baseline satu-satunya garis
   yang lebih tebal.
6. **Tabel adalah garis dan perataan.** Tanpa zebra striping, tanpa pita header berwarna.
   Angka rata kanan dengan `font-variant-numeric: tabular-nums`.
7. **Status data jujur.** Nol dicetak sebagai nol, nilai hilang sebagai strip abu-abu.

### Ukuran

| Elemen | Ukuran |
|---|---|
| Judul layar | ≤ 24px |
| Nilai KPI | 16–40px, idealnya 24–26px |
| Angka jawaban utama | 30–36px, minimal 1,3× KPI lain |
| Label KPI | 12–16px, abu-abu, sentence case |
| Teks tabel | 13–14px |
| Tinggi plot chart | 112–264px |
| Teks apa pun | minimal 11px |

### Yang dilarang

Daftar ini bukan selera, melainkan hasil pengukuran. Dashboard yang dibuat model biasanya
memuat semuanya.

- Sidebar gelap dengan pill berwarna pada item aktif
- Sapaan "Welcome back" atau sejenisnya
- Empat kartu KPI dengan ikon dalam lingkaran bertint
- Delta hijau "+12,5%" dengan sparkline
- Gradien di mana pun, termasuk pada chart area dan tombol
- Zebra striping pada tabel
- Bayangan pada elemen yang diam
- Emoji
- Glassmorphism, backdrop blur, pill navigation mengambang
- Label huruf besar kecil ber-letter-spacing
- Penomoran indeks 01 / 02 / 03
- Angka karangan — setiap angka harus berasal dari CSV

### Warna

Satu hue untuk data. Karena ini tentang bahaya seismik, merah-oranye masuk akal dan
konsisten dengan peta folium yang memakai skala YlOrRd. Selebihnya netral: kanvas terang,
tinta mendekati hitam, abu-abu untuk label sekunder.

Untuk tier bahaya pakai skala berurutan dari satu hue, bukan empat warna berbeda.

### Gerak

Secukupnya. Transisi hover pada baris tabel dan kontrol, entrance halus saat halaman dimuat.
Semuanya `transform` dan `opacity` saja, dengan fallback `prefers-reduced-motion`. Jangan ada
animasi yang menunda terbacanya isi.

## Blok yang harus ada

Setiap blok menjawab satu pertanyaan. Blok tanpa pertanyaan dihapus.

1. **Baris judul.** Judul, satu kalimat temuan utama, dan konfigurasi run (7.017 sel, res 5,
   Mc 4,0, 1960–2024) sebagai teks kecil.
2. **Angka utama.** SHI rata-rata 0,5603 sebagai angka terbesar di layar, dengan rentang
   0,2733–0,8354 sebagai keterangan.
3. **Distribusi tier.** Absolut dan kuartil **berdampingan**, karena perbandingannya itulah
   yang menjelaskan kenapa tier absolut saja tidak cukup untuk prioritisasi.
4. **Tabel Top-20.** Bisa diurutkan. Kolom `b_estimated` ditampilkan sebagai penanda,
   bukan disembunyikan, karena membedakan nilai terukur dari imputasi itu penting.
5. **Penjelas kanal.** Ini blok paling bernilai dan jangan dilewati. Pilih satu sel, lihat
   keempat kanalnya dibandingkan rata-rata nasional sebagai bar menyamping. Inilah yang
   menjawab "kenapa sel ini Very High" dalam sekali lihat. Isi default: sel teratas
   `8568c9affffffff`.
6. **Ringkasan sensitivitas.** Empat uji dalam satu panel, menunjukkan hasilnya bertahan.
7. **Validasi event rujukan.** Tabel 6 gempa besar, dengan kolom selisih magnitudo literatur
   versus katalog yang memperlihatkan saturasi.
8. **Keterbatasan.** Panel tersendiri, bukan catatan kaki.
9. **Tombol ke peta lengkap.**

## Cara verifikasi

Setelah selesai, pakai Chrome DevTools MCP:

1. Buka `index.html`, ambil screenshot pada lebar 1440, 768, dan 390 piksel.
2. **Lihat screenshot-nya**, jangan cuma mengandalkan kode. Kalau masalahnya terlihat di
   gambar, itu nyata.
3. Periksa ini satu per satu:
   - Apakah pertanyaan layar dijawab oleh hal terbesar, dan terbaca pertama?
   - Apakah angka terbesar memang yang menjawab judulnya?
   - Apakah warna hanya pada data? Hitung kira-kira porsinya, target di bawah 5%.
   - Apakah angka-angkanya cocok dengan CSV, dan rata digit per digit?
   - Apakah ada kartu yang berhenti lebih pendek dari tetangganya, atau pita kosong di
     dalam kartu lebih dari 40px?
   - Di lebar 390px, apakah tiap blok masih menjawab pertanyaannya?
4. Periksa console, harus bersih.
5. Perbaiki tiga masalah terburuk, screenshot lagi, lihat lagi. Maksimal tiga putaran.

## Yang tidak perlu dikerjakan

- Jangan membuat backend atau database
- Jangan menambah dependensi npm
- Jangan menghitung ulang SHI atau nilai b, semuanya sudah ada di CSV
- Jangan membuat halaman kedua, cukup satu layar yang bisa di-scroll
- Jangan menambahkan data yang tidak ada di CSV, termasuk tren waktu yang tidak saya hitung
