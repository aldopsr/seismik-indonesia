# Pencerdasan — Memahami Proyek H3-SHI dari Nol

Dokumen ini menjelaskan apa yang sebenarnya kamu kerjakan, kenapa tiap langkah ada, dan
potongan kodenya. Ditulis supaya bisa dibaca dari atas ke bawah tanpa perlu buka
notebook, tapi tiap bagian menunjuk ke bagian notebook yang bersangkutan.

---

## 1. Masalahnya apa

Kamu ingin membuat peta: **wilayah mana di Indonesia yang paling berbahaya secara
seismik?**

Cara naif: ambil data gempa, kelompokkan dengan k-means atau DBSCAN, lihat mana cluster
yang paling padat. Dan di sinilah masalahnya.

### Kenapa clustering jarak tidak cocok

Bayangkan kamu menaburkan beras mengikuti garis panjang yang melengkung, lalu menyuruh
komputer "kelompokkan beras ini jadi 10 tumpukan".

- **k-means** akan membuat 10 tumpukan yang bentuknya **bulat-bulat**. Garis melengkungmu
  akan terpotong jadi banyak bulatan, atau satu bulatan akan menelan dua bagian garis
  yang sebenarnya tidak berhubungan.
- **DBSCAN** menumbuhkan cluster ke segala arah dengan radius seragam. Hasilnya sama:
  bentuk yang dipaksakan.

Sekarang ganti "garis melengkung" dengan kenyataan tektonik Indonesia:

- **Megathrust Sunda** membentang melengkung sepanjang ±4.000 km dari Aceh sampai Nusa
  Tenggara
- **Busur Banda** melengkung seperti tapal kuda
- **Sesar Sumatra** dan **Palu-Koro** berupa garis sempit memanjang

Semuanya linear atau melengkung. Tidak ada yang bulat. Memaksakan cluster bulat ke
fitur-fitur ini pasti menghasilkan pengelompokan yang salah.

### Solusinya: jangan menebak bentuk sama sekali

Daripada membiarkan algoritma menebak bentuk cluster, kita **tetapkan gridnya di awal**.
Bagi seluruh Indonesia jadi heksagon berukuran sama, hitung statistik di tiap heksagon,
dan biarkan polanya muncul sendiri dari angka-angka itu.

Itulah **Discrete Global Grid System (DGGS)**, dan implementasi yang kita pakai adalah
**Uber H3**.

> **Intinya:** k-means menanyakan "bentuk cluster-nya seperti apa?" dan menebak salah.
> H3 tidak bertanya sama sekali — ia cuma membagi peta jadi kotak-kotak (heksagon) dan
> menghitung isi tiap kotak.

---

## 2. Bahan dan alat

### Data

**Katalog gempa Indonesia 88 M – 2024**, 322.961 baris. Tiap baris satu gempa, dengan
kolom penting: tanggal, lintang, bujur, kedalaman, magnitudo, dan tipe magnitudo.

**Batas provinsi GADM level 1**, 34 provinsi, untuk menjawab "heksagon ini ada di
provinsi mana?"

### Alat

| Alat | Fungsinya |
|---|---|
| **Uber H3 v4** | membagi bumi jadi heksagon |
| **pandas** | mengolah tabel 314 ribu baris |
| **numpy** | hitungan numerik cepat |
| **geopandas** | operasi peta: poligon, spatial join |
| **folium** | peta interaktif (pembungkus Leaflet) |
| **matplotlib / seaborn** | grafik statis |
| **Google Colab** | tempat menjalankan semuanya |

---

## 3. Langkah 1 — Membersihkan data

*Notebook Bagian 2*

Data mentah tidak bisa langsung dipakai. Ada empat saringan, masing-masing punya alasan.

```python
# 1. Hanya era instrumental (1960 ke atas)
df["year"] = pd.to_numeric(df["Year"], errors="coerce")
df = df[df["year"] >= 1960]

# 2. Kotak pembatas Indonesia
df = df[df["latitude"].between(-11.0, 6.0) & df["longitude"].between(95.0, 141.0)]

# 3. Buang baris yang kolom numeriknya kosong
df = df.dropna(subset=["latitude", "longitude", "depth", "magnitude"])

# 4. Kedalaman yang masuk akal secara fisika
df = df[df["depth"].between(0.0, 700.0)]
```

**Kenapa 1960?** Katalognya mundur sampai tahun 88 Masehi, tapi gempa tahun 88 tercatat
karena ada yang menulis babad, bukan karena ada seismograf. Kalau dicampur, "jumlah
gempa per wilayah" jadi mengukur rajin-tidaknya orang mencatat sejarah, bukan aktivitas
seismik.

**Kenapa kotak, bukan garis pantai?** Karena gempa terjadi di laut juga, bahkan
kebanyakan. Megathrust Sunda ada di dasar laut. Konsekuensinya: nanti banyak heksagon
berbahaya yang tidak masuk provinsi mana pun, dan itu ditangani di Bagian 9.

Hasilnya: **322.961 → 314.023 baris** (97,23% bertahan).

### Temuan dari audit: 30% kedalamannya palsu

```python
depth_counts = df["depth"].value_counts()
print(depth_counts.head(12))
```

Keluarannya:

```
10.0    84528   <- mencurigakan
35.0    10429   <- mencurigakan juga
11.0     5716
12.0     5396
13.0     4814
```

Kenapa ada 84 ribu gempa yang kedalamannya **persis** 10,0 km? Karena itu nilai
**default**. Ketika stasiun seismik tidak cukup untuk menghitung kedalaman, katalog
menuliskan 10 km begitu saja. Sama dengan 35 km.

Totalnya **30,24%** dari katalog. Ini penting karena nanti ada kanal yang mengukur
"proporsi gempa dangkal (≤70 km)", dan 10 km jelas di bawah 70 km. Jadi 30% dari sinyal
"dangkal" itu sebenarnya "tidak tahu". Bagian 7.4 mengukur dampaknya.

---

## 4. Langkah 2 — Membagi Indonesia jadi heksagon

*Notebook Bagian 3*

Inti H3 cuma satu baris:

```python
df["h3_index"] = [h3.latlng_to_cell(lat, lon, 5) for lat, lon in zip(lats, lons)]
```

Setiap gempa diberi **ID heksagon** berdasarkan koordinatnya. Angka `5` adalah
resolusinya.

### Kenapa heksagon, bukan kotak?

Kalau kamu pakai grid kotak-kotak, setiap kotak punya 8 tetangga: 4 di sisi, 4 di sudut.
Masalahnya **jaraknya tidak sama**. Tetangga di sudut lebih jauh daripada tetangga di
sisi. Jadi "tetangga" artinya ambigu.

Heksagon punya 6 tetangga, dan **semuanya berjarak sama dari pusat**. Ini bukan detail
sepele: nanti kita akan menghitung sesuatu "dari heksagon ini plus semua tetangganya",
dan itu cuma adil kalau jaraknya seragam.

### Soal resolusi

Resolusi H3 bekerja seperti zoom. Tiap naik satu level, luas sel dibagi tujuh:

| Resolusi | Luas sel |
|---|---:|
| 4 | 1.770,3 km² |
| **5** | **252,9 km²** |
| 6 | 36,1 km² |

> **Catatan penting:** PRD awal menulis res 5 = 1.570 km². Itu salah; angka itu milik
> res 4. Kesalahan ini sempat lolos berbulan-bulan sampai tabel sensitivitas resolusi
> menampilkan luas sel sebenarnya.

Hasilnya: **7.017 heksagon aktif** dari 17.140 yang pernah tersentuh gempa (sisanya
dibuang karena terlalu sedikit datanya, lihat Bagian 7).

---

## 5. Langkah 3 — Mc, batas kejujuran katalog

*Notebook Bagian 4*

Ini konsep yang tidak intuitif tapi penting sekali.

**Katalog gempa tidak lengkap untuk gempa kecil.** Gempa M 7 pasti tercatat, di mana pun
terjadinya. Gempa M 2,5 di tengah Laut Banda, jauh dari stasiun mana pun, kemungkinan
besar tidak tercatat sama sekali.

Jadi kalau kamu menghitung "ada berapa gempa M 2,5 di Indonesia", jawabannya bukan
jumlah gempa yang terjadi, melainkan jumlah yang **berhasil terdeteksi**. Beda jauh.

**Magnitudo kelengkapan (Mc)** adalah batas di mana katalognya bisa dipercaya lengkap.
Di atas Mc, hampir semua gempa tercatat. Di bawahnya, banyak yang lolos.

### Cara mencarinya: metode MAXC

```python
mag_binned = (df["magnitude"] / 0.1).round() * 0.1
mc_maxc = mag_binned.value_counts().idxmax() + 0.2
```

Logikanya: kalau katalognya lengkap, jumlah gempa makin kecil magnitudonya makin banyak,
terus-menerus. Tapi karena deteksi mulai gagal di bawah Mc, grafiknya **berbalik arah**.
Titik balik itulah Mc. `idxmax()` mencari bin magnitudo dengan jumlah terbanyak, yaitu
puncak sebelum berbalik. Tambahan +0,2 adalah koreksi bias yang sudah dikenal.

Hasilnya: **MAXC menyarankan 3,00, tapi kita pakai 4,0.**

Kenapa lebih tinggi dari saran? Karena memakai Mc terlalu tinggi itu **aman** (cuma
membuang data), sedangkan terlalu rendah **membiaskan** semua hitungan setelahnya.
Tapi selisih 1,0 itu besar dan harus kamu argumentasikan di laporan.

---

## 6. Langkah 4 — Nilai b, mengukur tegangan kerak bumi

*Notebook Bagian 5*

Ini jantung ilmiah proyekmu.

### Hukum Gutenberg-Richter

Ada pola yang berlaku di seluruh dunia: **gempa kecil jauh lebih sering daripada gempa
besar, dengan perbandingan yang teratur.**

$$\log_{10} N = a - bM$$

Artinya: setiap kali magnitudo naik 1 satuan, jumlah gempanya turun sekitar 10 kali
lipat. Nilai **b** adalah kemiringan hubungan itu.

### Kenapa b penting

| b | Artinya |
|---|---|
| **b tinggi** (~1,2) | gempa kecil mendominasi, tegangan kerak relatif rendah |
| **b rendah** (~0,6) | proporsi gempa besar lebih tinggi, **tegangan kerak tinggi** |

Analogi: bayangkan ranting kering. Kalau kamu tekan pelan-pelan, yang patah ranting
kecil-kecil saja (b tinggi). Kalau tekanannya sudah sangat besar, batang besar ikut
patah (b rendah). **b rendah = daerah yang sudah "tegang" dan berpotensi melepas gempa
besar.**

Karena itu dalam indeks kita, b rendah berarti bahaya tinggi.

### Menghitungnya: MLE Aki-Utsu

```python
b = np.log10(np.e) / (mean_mag - (mc - delta_m / 2.0))
```

Cuma satu baris. `mean_mag` adalah rata-rata magnitudo gempa di atas Mc. Semakin
rata-ratanya mendekati Mc (artinya didominasi gempa kecil), semakin besar b.

### Masalahnya: sel yang sepi

Heksagon res 5 itu kecil (253 km²). Banyak heksagon cuma punya 5-10 gempa di atas Mc.
Menghitung b dari 5 gempa menghasilkan angka sampah.

### Solusinya: pemulusan 1-ring

```python
disk = h3.grid_disk(cell, 1)          # sel ini + 6 tetangganya
n_disk = sum(n_lookup.get(nbr, 0) for nbr in disk)
sum_mag = sum(s_lookup.get(nbr, 0.0) for nbr in disk)

if n_disk >= 30:                       # cukup data?
    b = np.log10(np.e) / (sum_mag / n_disk - (mc - delta_m / 2.0))
    b = np.clip(b, 0.5, 2.0)           # batasi ke rentang yang masuk akal
else:
    b = np.nan                         # tidak cukup, tandai kosong
```

`grid_disk(cell, 1)` mengembalikan 7 sel: sel itu sendiri plus 6 tetangganya. Kita
gabungkan datanya, baru hitung b.

**Kenapa boleh begitu?** Karena tegangan kerak bumi tidak berhenti mendadak di batas
heksagon. Batas itu buatan kita, bukan buatan alam. Jadi meminjam data tetangga masuk
akal secara fisika.

**Kenapa clip ke [0,5 – 2,0]?** Karena nilai b di luar rentang itu secara fisika tidak
realistis untuk zona tektonik. Kalau rumus mengeluarkan b = 5, itu tanda datanya aneh,
bukan penemuan.

**Sel yang tetap tidak cukup data** (`n_disk < 30`) diberi nilai b nasional, dan
ditandai `b_estimated = False` supaya tidak tertukar dengan hasil pengukuran sungguhan.

Hasil: **76,1% sel punya b terukur**, sisanya hasil imputasi.

---

## 7. Langkah 5 — Empat kanal jadi satu angka

*Notebook Bagian 5*

SHI menggabungkan empat hal yang berbeda jadi satu skor 0–1.

### Kanal 1: Kepadatan gempa

```python
h3_summary["log_events"] = np.log10(h3_summary["n_mc"] + 1.0)
h3_summary["n_norm"] = min_max(h3_summary["log_events"])
```

**Kenapa pakai log?** Karena satu sekuens gempa susulan bisa menghasilkan ribuan gempa
di satu titik, sementara daerah lain punya puluhan. Tanpa log, satu sel akan menelan
seluruh skala. Log meredam dominasi itu.

**Kenapa `n_mc`, bukan total gempa?** `n_mc` adalah jumlah gempa di atas Mc. Kalau pakai
total, yang terukur sebagian adalah kerapatan stasiun seismograf — Jawa dan Sumatra
punya stasiun jauh lebih rapat daripada Indonesia timur, jadi hasilnya akan terlihat
"lebih berbahaya" padahal cuma lebih terpantau.

### Kanal 2: Proporsi gempa dangkal

```python
p_nat = df["is_shallow"].mean()        # rata-rata nasional
s["shallow_ratio"] = (s["shallow_events"] + 10.0 * p_nat) / (s["total_events"] + 10.0)
```

Gempa dangkal (≤70 km) jauh lebih merusak daripada gempa dalam, karena energinya tidak
sempat meredam sebelum sampai permukaan.

**Apa itu angka 10 di situ?** Itu namanya **shrinkage**, dan ini trik statistik yang
penting.

Bayangkan sel yang cuma punya 1 gempa, dan kebetulan dangkal. Rasio mentahnya 1/1 =
**1,0**, skor sempurna. Padahal itu cuma satu titik data, tidak membuktikan apa-apa.

Shrinkage menambahkan "10 gempa bayangan" yang berperilaku seperti rata-rata nasional.
Jadi sel dengan 1 gempa dangkal jadi (1 + 10×0,77)/(1 + 10) = **0,80**, bukan 1,0. Sel
dengan 500 gempa hampir tidak terpengaruh, karena 10 tambahan itu kecil dibanding 500.

> **Intinya:** shrinkage membuat sel ber-data sedikit "tidak berani" memberi skor
> ekstrem. Semakin banyak datanya, semakin dipercaya angkanya sendiri.

### Kanal 3: Tegangan dari nilai b

```python
h3_summary["b_inv"] = 1.0 - (h3_summary["b_value_imputed"] - 0.5) / (2.0 - 0.5)
```

Karena b rendah = bahaya tinggi, kita **balik** skalanya. b = 0,5 jadi skor 1,0; b = 2,0
jadi skor 0,0.

Perhatikan pembaginya memakai **0,5 dan 2,0 yang tetap**, bukan nilai minimum-maksimum
dari data. Ini disengaja: kalau pakai min-max dari data, satu sel outlier akan menggeser
skala semua sel lain, dan hasil run hari ini tidak bisa dibandingkan dengan run besok.

### Kanal 4: Magnitudo terbesar yang pernah terjadi

```python
h3_summary["m_norm"] = ((h3_summary["max_magnitude"] - MC) / (9.5 - MC)).clip(0.0, 1.0)
```

Angka 9,5 adalah magnitudo terbesar yang pernah tercatat secara instrumental di dunia.
Dipakai sebagai plafon tetap, lagi-lagi supaya antar-run sebanding.

### Menggabungkan

```python
X = s[["n_norm", "s_norm", "b_inv", "m_norm"]].to_numpy()
w_equal = np.full(4, 0.25)
s["shi"] = X @ w_equal                 # rata-rata tertimbang
```

Bobot sama rata, 25% masing-masing. Lalu dikelompokkan jadi tingkat bahaya:

```python
TIER_EDGES = [0.0, 0.25, 0.50, 0.75, np.inf]
s["hazard_level"] = pd.cut(s["shi"], bins=TIER_EDGES,
                           labels=["Low", "Moderate", "High", "Very High"],
                           right=False)
```

> **`right=False` itu penting.** Default pandas membuat interval tertutup di kanan
> `(0,25 ; 0,50]`, sehingga SHI tepat 0,25 masuk **Low** — satu tingkat di bawah yang
> tabelmu nyatakan. Bug ini senyap dan cuma muncul di nilai batas.

### Satu keputusan yang sering disalahpahami

Versi awal menambahkan satu langkah lagi: normalisasi min-max pada hasil akhirnya,
supaya SHI "membentang penuh dari 0 sampai 1". **Langkah itu dibuang**, dan alasannya
penting.

Kalau dinormalisasi, secara otomatis akan selalu ada tepat satu sel bernilai 0,0 dan
satu bernilai 1,0 — apa pun datanya. Jadi "ada 55 sel Very High" bukan lagi pernyataan
tentang bahaya, melainkan akibat penskalaan. Dan SHI dari resolusi 4 tidak bisa
dibandingkan dengan resolusi 5.

Tanpa normalisasi, SHI punya makna absolut. Harganya: rentangnya jadi sempit
(0,27–0,84, tidak sampai 0 atau 1). Itu kenyataan, bukan cacat.

---

## 8. Langkah 6 — Validasi: kenapa ada 14 assertion

*Notebook Bagian 6*

```python
assert s["shi"].between(0.0, 1.0).all(),            "SHI di luar [0,1]"
assert s["shi"].notna().all(),                      "ada NaN di SHI"
assert s["b_value_imputed"].between(0.5, 2.0).all(), "b di luar domain clipping"
assert s["h3_index"].is_unique,                     "ada h3_index duplikat"
```

Ini bukan formalitas. Pipeline-nya panjang (10 menit), dan kalau ada yang rusak di
tengah, kamu baru sadar saat melihat peta yang aneh — atau lebih buruk, tidak sadar
sama sekali.

Assertion membuat notebook **berhenti dengan pesan jelas** alih-alih menulis hasil yang
diam-diam salah ke disk.

Yang paling penting ini:

```python
empty_mc = s[s["n_mc"] == 0]
assert empty_mc["shi"].lt(0.50).all(), "sel tanpa event di atas Mc mencapai High"
```

Ini menjaga bug nyata yang pernah terjadi. Di versi awal, sel dengan **1 gempa** bisa
masuk tier High, karena rasio dangkalnya 1,0 dan b-nya hasil imputasi. Assertion ini
memastikan itu tidak terulang.

---

## 9. Langkah 7 — Sensitivitas: empat pertanyaan penguji

*Notebook Bagian 7*

Setiap keputusan yang kamu ambil bisa ditanya "kenapa segitu?". Analisis sensitivitas
menjawabnya dengan menjalankan ulang pipeline dengan angka yang berbeda.

### 7.1 "Kenapa minimal 10 gempa per sel?"

| N_min | Sel | b terukur | Overlap Top-20 |
|---|---:|---:|---:|
| 5 | 10.055 | 60,1% | 20/20 |
| **10** | **7.017** | **76,1%** | **20/20** |
| 20 | 4.132 | 87,9% | 20/20 |

**Jawaban: tidak berpengaruh ke peringkat sama sekali.** Overlap 20/20 di semua ambang.
Yang berubah cuma berapa sel yang dilaporkan dan kualitas estimasi b.

### 7.2 "Kenapa bobotnya sama rata, bukan dihitung otomatis?"

Ada metode bernama **pembobotan entropi** yang menghitung bobot dari sebaran data:
kanal yang nilainya bervariasi dapat bobot besar, yang nilainya seragam dapat bobot
kecil. Terdengar lebih objektif.

Hasilnya:

| Kanal | Sama rata | Entropi |
|---|---:|---:|
| n_norm | 0,2500 | 0,3317 |
| s_norm | 0,2500 | 0,1673 |
| **b_inv** | 0,2500 | **0,0185** |
| **m_norm** | 0,2500 | **0,4824** |

**Entropi hampir menghapus `b_inv`** (bobot 0,0185) dan memberi `m_norm` hampir separuh
bobot. Padahal `b_inv` adalah satu-satunya kanal yang mengukur fisika tegangan kerak,
sementara `m_norm` korelasinya 0,618 dengan `n_norm` — artinya sebagian cuma mengulang
informasi yang sama.

> **Pelajaran:** entropi menghargai **variasi**, bukan **relevansi**. Nilai b di
> Indonesia berkerumun sempit (karena memang seluruh Indonesia bertektonik aktif), jadi
> entropi menganggapnya tidak informatif dan membuangnya. Itu keliru secara ilmiah.

Karena itu bobot sama rata dipertahankan. Spearman ρ 0,9137 menunjukkan urutannya mirip,
jadi ini soal interpretasi, bukan hasil yang berbeda total.

### 7.3 "Kenapa resolusi 5?"

| Resolusi | Luas sel | Sel | b terukur |
|---|---:|---:|---:|
| 4 | 1.770,3 km² | 2.144 | **96,0%** |
| 5 | 252,9 km² | 7.017 | 76,1% |
| 6 | 36,1 km² | 7.102 | 31,3% |

Perhatikan res 6: menghasilkan 7.102 sel, **hampir sama** dengan res 5 yang 7.017,
padahal 64.185 sel dibuang karena kosong. Jadi res 6 tidak menambah detail apa pun tapi
merusak kualitas b. Jangan dipakai.

Dan res 4 punya b terukur 96%, jauh lebih baik. Jujurnya, **alasan pemilihan resolusi
yang ditulis di PRD justru menunjuk ke res 4**, bukan 5.

### 7.4 "30% kedalamannya palsu, hasilmu masih sah?"

Diuji dengan menghitung ulang kanal dangkal **hanya dari gempa yang kedalamannya
diketahui**:

```
mean s_norm   : 0,7617 -> 0,6849
mean SHI      : 0,5603 -> 0,5411
overlap Top-20: 20/20
```

**Jawaban: ya, masih sah.** Seluruh 20 sel teratas bertahan, dengan pergeseran SHI cuma
0,003–0,010.

Alasannya terlihat di datanya: sel-sel Top-20 punya `shallow_ratio` 0,90–0,98. Setelah
gempa berkedalaman default dibuang, yang tersisa **tetap** didominasi gempa dangkal.
Jadi daerah itu memang benar dangkal, bukan tampak dangkal karena data hilang.

---

## 10. Langkah 8 — Uji kewajaran, dan temuan terbesar

*Notebook Bagian 12 dan 13*

Menampilkan Top-20 saja tidak membuktikan indeksnya masuk akal. Uji yang lebih tajam:
ambil gempa besar yang **semua orang sudah tahu**, lalu lihat skor apa yang diberikan
indeks ini.

### Hasilnya mengejutkan

```python
near = df[(df["latitude"] - lat).abs().le(0.5) & (df["longitude"] - lon).abs().le(0.5)]
mag_katalog = near["magnitude"].max()      # magnitudo terbesar di sekitar titik itu
```

| Event | Mw sebenarnya | Di katalog | Tipe | Selisih |
|---|---:|---:|---|---:|
| **Aceh 2004** | **9,1** | **7,1** | `Mw(mB)` | **−2,0** |
| Nias 2005 | 8,6 | 7,7 | `Mw(mB)` | −0,9 |
| Padang 2009 | 7,6 | 7,1 | `mb` | −0,5 |
| Yogyakarta 2006 | 6,3 | 6,0 | `mb` | −0,3 |
| Lombok 2018 | 6,9 | 6,9 | `M` | 0,0 |
| Palu 2018 | 7,5 | 7,5 | `Mw` | 0,0 |

**Gempa Aceh 2004 yang sebenarnya Mw 9,1 tercatat sebagai 7,1 di katalogmu.** Magnitudo
terbesar di seluruh katalog cuma **7,90**.

### Kenapa bisa begitu: saturasi magnitudo

Perhatikan polanya: **makin besar gempanya, makin besar selisihnya**, dan selisihnya
mengikuti **tipe magnitudo**. Event bertipe `Mw` asli akurat sempurna. Yang bertipe `mb`
dan `Mw(mB)` meleset, makin besar makin meleset.

Ini fenomena seismologi yang sudah dikenal namanya **saturasi**. Magnitudo gelombang
badan (`mb`) dihitung dari amplitudo gelombang periode pendek. Untuk gempa raksasa,
rupture-nya berlangsung berpuluh detik dan gelombang periode pendek tidak lagi
merepresentasikan energi totalnya. Jadi angkanya "mentok" sekitar 6,5–7.

Katalogmu memuat **26 tipe magnitudo** yang berbeda:

```
MLv  100.393     mb  76.301     M  32.178
NaN   98.088     ... Mw asli cuma 1.344 dari 314 ribu (0,4%)
```

Padahal rumus Gutenberg-Richter mengasumsikan **satu skala magnitudo saja**.

### Seberapa parah dampaknya

Nilai b dihitung terpisah per tipe, semuanya pada Mc yang sama:

| Tipe | n di atas Mc | b |
|---|---:|---:|
| MLv | 17.784 | **1,1835** |
| (tanpa tipe) | 5.255 | 0,8482 |
| M | 10.398 | 0,7925 |
| mb | 50.913 | **0,6297** |

**b berkisar 0,63 sampai 1,18 hanya karena perbedaan tipe magnitudo.** Nilai nasional
0,7014 itu cuma rata-rata tertimbang dari populasi yang tidak sebanding.

### Kabar baiknya

Pertanyaan yang sesungguhnya menakutkan: **apakah peta b-mu sebenarnya cuma peta lembaga
pelapor?** Kalau Maluku Utara didominasi satu tipe dan Sumatra tipe lain, maka pola yang
kamu temukan bukan tektonik melainkan administratif.

```python
tipe_per_sel = df.groupby(["h3_index", "_t"]).size().unstack(fill_value=0)
share = tipe_per_sel.div(tipe_per_sel.sum(axis=1), axis=0)
```

| Tipe dominan | Jumlah sel | b rata-rata |
|---|---:|---:|
| (tanpa tipe) | 2.364 | 0,7548 |
| MLv | 2.181 | 0,7593 |
| mb | 2.174 | 0,7062 |

**Median porsi tipe dominan cuma 50%** — tidak ada sel yang dikuasai satu sumber. Dan
selisih b antar-sel menurut tipe dominannya cuma 0,70–0,76, jauh lebih sempit daripada
sebaran nasional 0,63–1,18.

**Jadi tidak, peta b-mu bukan peta lembaga pelapor.** Pencampuran spasial meredam
sebagian besar efeknya. Ini pembelaan terkuat untuk laporanmu.

### Dan kenapa memperbaikinya tidak sesederhana itu

Ada relasi konversi standar di literatur (Scordilis 2006) untuk mengubah `mb` jadi `Mw`:

```python
KONVERSI_MW = {
    "mb": [(3.5, 6.2, 0.85, 1.03)],      # Mw = 0,85*mb + 1,03, berlaku 3,5-6,2
    "MS": [(3.0, 6.1, 0.67, 2.07), (6.2, 8.2, 0.99, 0.08)],
    "Mw": [(0.0, 10.0, 1.0, 0.0)],
}
```

Perhatikan **rentang keberlakuannya berhenti di mb 6,2**. Dan tipe `Mw(mB)` tidak punya
relasi tepercaya sama sekali. Hasilnya, dari enam event rujukan, rata-rata selisih cuma
bergerak dari **0,617 ke 0,595**. Hanya Yogyakarta yang membaik.

**Koreksinya berhenti persis di tempat masalahnya dimulai.**

Dan ada jebakan kedua. Kalau magnitudonya dikonversi, **ambang kelengkapan Mc juga
harus ikut digeser**:

| Tipe | Mc 4,0 jadi |
|---|---:|
| MS | 4,750 |
| mb | 4,430 |
| tidak dikonversi | 4,000 |

Ambang global harus setinggi yang tertinggi: **Mc = 4,80**. Dan akibatnya:

```
asli (Mc 4,00)            b terukur 76,1%   SHI rata-rata 0,5603
terhomogenisasi (Mc 4,80) b terukur 33,9%   SHI rata-rata 0,4646

b nasional     : 0,7014 -> 0,9854
overlap Top-20 : 16/20
Spearman rho   : 0,9145
```

Menaikkan Mc ke 4,80 **membuang dua pertiga data**. Jadi konversi generik memaksa
memilih antara dua hal yang sama-sama buruk: ambang yang sah tapi kehilangan sebagian
besar data, atau data utuh dengan ambang yang tidak sah.

> **Menariknya**, b nasional naik ke **0,9854** — mendekati nilai tektonik tipikal ~1,0.
> Itu justru tanda arah homogenisasinya benar, cuma harganya terlalu mahal.

Peringkatnya sendiri cukup bertahan: overlap Top-20 **16/20** dan Spearman ρ **0,9145**.
Lebih rendah dari perbandingan sebelumnya yang memakai Mc keliru (18/20 dan 0,9779), jadi
pengaruh pencampuran skala ternyata sedikit lebih besar dari dugaan awal.

> **Satu hal yang belum terpisah.** Perbandingan di atas mengubah **dua** hal sekaligus:
> skala magnitudonya dan ambang Mc-nya. Jadi penurunan ke 16/20 belum bisa dipastikan
> murni akibat homogenisasi, karena menaikkan Mc saja sudah membuang dua pertiga data.
> Untuk memisahkannya perlu satu run tambahan: katalog **asli** pada Mc 4,80. Itu
> pekerjaan satu baris, dan layak dikerjakan sebelum angka ini masuk laporan.

**Rekomendasi:** tambal magnitudo event besar dari katalog GCMT atau USGS. Gempa M ≥ 6,5
di wilayah dan periode ini cuma ratusan, jadi layak dikerjakan dan langsung menyasar
sumber distorsi terbesar.

---

## 11. Hasil akhir dan cara membacanya

```
sel           7.017 dari 17.140
SHI           [0,2733 ; 0,8354]   rata-rata 0,5603
tier          Low 0 | Moderate 1.611 | High 5.351 | Very High 55
```

### Top-20 didominasi Maluku Utara

17 dari 20 sel teratas ada di Maluku Utara, 2 di Sulawesi Utara, 1 di Papua. Tujuh belas
di antaranya lepas pantai.

**Apakah ini masuk akal?** Ya. Zona tumbukan Laut Maluku adalah tempat yang sangat tidak
biasa secara geologi: ada **subduksi ganda** di sana, Lempeng Laut Maluku menunjam ke
dua arah sekaligus, ke bawah Halmahera di timur dan ke bawah Sangihe di barat. Itu salah
satu zona paling aktif di dunia.

Semua sel Top-20 punya b terukur dan andal, tidak ada yang hasil imputasi.

### Tapi Sumatra dan Jawa tidak muncul sama sekali

Ini yang akan ditanya penguji pertama kali. Ada **tiga** penyebab terpisah:

**1. Saturasi magnitudo.** Aceh tercatat 7,1, bukan 9,1. Kanal `m_norm` bekerja di atas
angka yang salah.

**2. Sel episentrum Aceh nyaris kosong — karena selnya terlalu kecil.** Sel yang memuat
koordinat Aceh 2004 cuma punya **13 gempa**, dengan magnitudo maksimum 5,5.

Dugaan awal kami kotak pembatas yang memotong di 6°LU. **Dugaan itu diuji dan ternyata
salah.** Hanya 1,0% sekuens 2004–2005 yang jatuh di atas 6°LU, dan pita 9–20°LU benar-
benar kosong — katalognya memang tidak memuat gempa sejauh itu ke utara.

Penjelasan yang benar lebih sederhana. Rupture 2004 memanjang sekitar **1.300 km**,
sementara sel res 5 cuma ~17 km. Jadi 3.091 gempa susulannya tersebar ke ratusan sel,
dan tidak ada satu pun yang menumpuk banyak. Bukan datanya yang hilang, melainkan
selnya yang terlalu halus untuk fitur sepanjang itu.

> Ini contoh bagus kenapa **memeriksa dugaan itu penting**. Penjelasan "kotak pembatas
> memotong rupture" terdengar sangat masuk akal dan sempat ditulis di dokumen selama
> beberapa hari. Satu cell diagnostik membantahnya dalam hitungan detik.

**3. Batas struktural indeksnya sendiri.** Ini bisa dihitung tanpa data:

```
ambang bawah Top-20                     : 0,7807
sel dengan Mw 9,1 -> m_norm 0,927       : sumbangan 0,2318
tiga kanal lain harus menyumbang        : >= 0,5489  (rata-rata 0,732/kanal)
rata-rata nasional ketiga kanal itu     :             0,676
```

Artinya: **sel yang memuat gempa terbesar dalam sejarah Indonesia, tapi biasa-biasa saja
pada kerapatan, kedalaman, dan nilai b, tetap tidak akan masuk Top-20.** Dengan bobot
sama rata, `m_norm` cuma memegang 25%.

Apakah itu salah? Tergantung pertanyaanmu:

- "Di mana bahaya seismik **kumulatif** paling tinggi?" → sifat ini benar
- "Di mana gempa **paling merusak** bisa terjadi?" → sifat ini salah, `m_norm` perlu
  bobot lebih besar

**Tulis pilihan ini eksplisit di Diskusi.** Jangan biarkan jadi kebetulan.

### Kenapa tidak ada sel Low, dan 76% masuk High

Rata-rata `b_inv` 0,8484 dan `s_norm` 0,7617. Dua kanal ini **tinggi dan rata di seluruh
Indonesia**, jadi menyumbang ~0,40 ke setiap sel sebelum variasi apa pun. Indeksnya
berjalan di atas "lantai" yang tinggi.

Secara ilmiah itu masuk akal — Indonesia memang seluruhnya bertektonik aktif. Tapi untuk
prioritisasi, indeks di mana 76% wilayah masuk satu kategori tidak banyak membantu.

**Saran:** laporkan tier absolut apa adanya, tapi tambahkan tier berbasis kuartil dari
`shi_rank_pct` untuk keperluan prioritisasi.

---

### Berkas keluaran dan di mana tersimpannya

Notebook menghasilkan 12 berkas. Semuanya ditulis ke satu folder:

```python
OUT_DIR = "/content/drive/MyDrive/h3shi_output" if IN_COLAB else "."
os.makedirs(OUT_DIR, exist_ok=True)

def out(nama):
    return os.path.join(OUT_DIR, nama)
```

Di Colab berkasnya masuk ke **`MyDrive/h3shi_output/`**. Kalau dijalankan lokal, ke
folder notebook itu sendiri.

| Berkas | Isinya |
|---|---|
| `indonesia_seismic_hazard_map.html` | peta interaktif, buka di browser |
| `indonesia_seismic_hazard_h3_res5.geojson` | 7.017 heksagon + semua metriknya |
| `top_20_critical_hexagons.csv` | tabel 20 sel teratas + provinsi |
| `sensitivity_nmin.csv` | hasil uji ambang inklusi |
| `sensitivity_resolution.csv` | hasil uji resolusi 4/5/6 |
| `sensitivity_default_depth.csv` | hasil uji kedalaman default |
| `sensitivity_magnitude_homogenisation.csv` | hasil uji homogenisasi magnitudo |
| `validation_reference_events.csv` | skor enam gempa besar yang diketahui |
| `fig_frequency_magnitude_distribution.png` | plot penentuan Mc |
| `fig_hazard_panels.png` | tiga panel: densitas, nilai b, SHI |
| `fig_distributions.png` | histogram SHI, nilai b, pemicu risiko |
| `h3shi_review.txt` | ringkasan semua angka dalam satu berkas teks |

> **Kenapa ini sempat jadi masalah.** Versi sebelumnya memakai path relatif seperti
> `"indonesia_seismic_hazard_map.html"` tanpa folder. Di Colab, path relatif jatuh ke
> `/content`, yaitu folder sesi yang **dihapus begitu runtime terputus**. Jadi setiap
> selesai Run all, semua berkas itu lenyap kecuali sempat diunduh manual satu per satu.
> Hanya `h3shi_review.txt` yang selamat karena path-nya memang sudah mengarah ke Drive.
>
> Pelajarannya berlaku umum di Colab: **apa pun yang ingin kamu simpan harus ditulis ke
> `/content/drive/MyDrive/...`**, bukan ke folder kerja.

---

## 12. Kamus istilah

| Istilah | Artinya dalam proyek ini |
|---|---|
| **DGGS** | sistem grid global diskret, membagi bumi jadi sel berukuran sama |
| **H3** | implementasi DGGS dari Uber, memakai heksagon |
| **Resolusi** | tingkat zoom H3; makin tinggi makin kecil selnya |
| **Mc** | magnitudo kelengkapan, batas di mana katalog bisa dipercaya lengkap |
| **MAXC** | metode mencari Mc dari bin magnitudo paling sering muncul |
| **Nilai b** | kemiringan Gutenberg-Richter; rendah = tegangan tinggi |
| **MLE Aki-Utsu** | rumus menghitung b dari rata-rata magnitudo |
| **1-ring / grid_disk** | sel plus 6 tetangganya |
| **Shrinkage** | menarik estimasi sel ber-data sedikit ke arah rata-rata nasional |
| **Imputasi** | mengisi nilai yang tidak bisa diukur dengan nilai pengganti |
| **Saturasi magnitudo** | magnitudo gelombang badan "mentok" untuk gempa raksasa |
| **Kanal** | satu dari empat komponen penyusun SHI |
| **Spearman ρ** | ukuran kemiripan **urutan** dua daftar, 1,0 = identik |
| **Assertion** | pernyataan yang menghentikan program kalau tidak benar |

---

## 13. Ringkasan satu halaman

**Yang dibangun:** peta bahaya seismik Indonesia berbasis grid heksagon H3, bukan
clustering jarak, karena seismisitas Indonesia berbentuk linear dan melengkung.

**Caranya:** 314 ribu gempa dibagi ke 7.017 heksagon res 5. Tiap heksagon dihitung nilai
b Gutenberg-Richter (dengan pemulusan 1-ring), kepadatan gempa, proporsi gempa dangkal,
dan magnitudo maksimum. Keempatnya digabung jadi indeks 0–1.

**Hasilnya:** 20 sel paling berbahaya didominasi Maluku Utara, yang masuk akal secara
geologi karena subduksi ganda Laut Maluku.

**Yang kuat:** peringkat Top-20 tahan terhadap perubahan ambang inklusi (20/20),
terhadap kedalaman default (20/20), dan sebagian besar terhadap pencampuran skala
magnitudo (16/20, ρ 0,91). Tipe magnitudo tercampur rata secara spasial, jadi peta b
bukan peta lembaga pelapor.

**Yang lemah, dan harus diakui di laporan:** katalognya mengalami saturasi magnitudo
parah (Aceh 9,1 tercatat 7,1), Mc 4,0 berbeda 1,0 dari saran MAXC, kotak pembatas
memotong rupture Aceh, dan indeksnya tidak diskriminatif (76% sel masuk satu tier).

**Yang harus dikerjakan berikutnya:** tambal magnitudo event M ≥ 6,5 dari GCMT atau USGS.
