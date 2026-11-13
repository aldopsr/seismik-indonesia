# Panduan membaca dashboard Indeks Bahaya Seismik Indonesia (H3-SHI)

Halaman [index.html](index.html) menyajikan ringkasan hasil analisis data gempa Indonesia dari tahun 1960 sampai 2024. Bayangkan peta Indonesia dibagi rata menjadi ribuan petak segi enam menyerupai sarang lebah. Setiap petak luasnya sekitar 252,9 kilometer persegi, dengan panjang sisi sekitar 8,5 km atau bentang sekitar 17 km dari ujung ke ujung. Untuk setiap petak yang pernah mencatat minimal 10 gempa, sistem menggabungkan empat ukuran historis menjadi satu skor dari 0 sampai 1 bernama SHI (*Seismic Hazard Index*).

Skor mendekati 0 menandakan petak tersebut relatif sepi atau tenang menurut catatan sejarah, sedangkan skor mendekati 1 menandakan daerah itu sering mengalami gempa dangkal yang kuat dengan tekanan kerak bumi tinggi. Angka ini berguna untuk membandingkan tingkat kerawanan antarwilayah berdasarkan rekaman masa lalu. Skor SHI tidak meramalkan tanggal kejadian gempa berikutnya dan tidak menghitung seberapa kuat guncangan pada bangunan tertentu.

Dashboard terbagi menjadi dua halaman. Halaman [index.html](index.html) berisi seluruh angka ringkasan, grafik perbandingan, tabel peringkat teratas, dan hasil uji ketahanan agar mudah diperiksa dalam satu layar. Tombol "Buka Peta Interaktif 7.017 Sel (Folium)" di pojok kanan atas dan bagian bawah halaman membuka [indonesia_seismic_hazard_map.html](indonesia_seismic_hazard_map.html), tempat seluruh 7.017 petak digambar di atas peta interaktif yang bisa digeser dan diperbesar.

## Bagian atas halaman dan menu lompat cepat

Tepat di bawah judul utama dashboard tertulis kesimpulan inti proyek: dari 7.017 petak aktif yang dihitung, wilayah berisiko paling tinggi berkumpul di Zona Tumbukan Laut Maluku (17 dari 20 petak peringkat teratas ada di sekitar Maluku Utara), dengan petak peringkat pertama berkode `8568c9affffffff` meraih skor SHI `0,8354`.

Satu baris keterangan kecil di bawahnya merangkum aturan penyaringan data yang dipakai.

| Keterangan pada header | Penjelasan sederhana |
| :--- | :--- |
| `Katalog: 1960 s.d. 2024 (314.023 gempa tersaring dari 322.961 mentah)` | Data sebelum tahun 1960 dibuang karena berasal dari catatan sejarah kuno, jauh sebelum jaringan alat pencatat gempa (seismograf) modern terpasang merata. |
| `Grid: Uber H3 Resolusi 5 (~252,9 km²/sel)` | Peta dibagi menjadi petak segi enam sama besar. Segi enam dipilih karena jarak dari titik tengah ke keenam petak tetangganya selalu sama persis. |
| `Ambang: N_min = 10` | Petak dengan kurang dari 10 catatan gempa disisihkan supaya lokasi yang kebetulan baru terkena satu atau dua gempa tidak ikut naik ke peringkat atas. |
| `Mc = 4,0 (85.413 gempa ≥ Mc)` | Untuk hitungan kepadatan dan tekanan kerak, hanya gempa bermagnitudo 4,0 ke atas yang dipakai karena gempa kecil di lautan jauh sering terlewat oleh sensor. |
| `Bobot utama: Setara (0,25 per kanal)` | Keempat faktor penyusun skor SHI diberi porsi sama rata, masing-masing seperempat bagian (25%). |

Tombol "Mode Gelap" di pojok kanan atas mengubah tampilan warna menjadi latar gelap jika layar terasa terlalu silau. Di bawahnya ada barisan tautan (`Angka Utama`, `Distribusi Tier`, `Penjelas Kanal & Peta`, `Tabel Top-20`, `Uji Sensitivitas`, `Validasi Gempa Besar`, dan `Keterbatasan`) supaya pembaca bisa langsung melompat ke bagian yang ingin dilihat.

## Angka utama di bagian ringkasan

Lima kotak angka di baris pertama memberi gambaran kasar kondisi kegempaan Indonesia sebelum masuk ke grafik.

### Rata-rata SHI nasional: 0,5603

Jika seluruh 7.017 petak dirata-ratakan, skornya berada di angka `0,5603`. Petak aktif dengan skor paling rendah bernilai `0,2733` dan petak tertinggi mencapai `0,8354`. Nilai tengah (median) di `0,5601` hampir persis dengan rata-rata, artinya sebaran skor petak di Indonesia tergolong simetris di sekitar 0,56.

### Dominasi Maluku Utara di Top-20: 17 / 20 sel

Dari 20 petak paling berbahaya di Indonesia, 17 berada di wilayah Maluku Utara, 2 di Sulawesi Utara, dan 1 di daratan Papua. Sebanyak 17 dari 20 petak teratas tersebut terletak di lepas pantai. Secara alamiah kondisi ini masuk akal karena di Laut Maluku terdapat tumbukan ganda: satu lempeng laut menyusup ke dua arah berlawanan sekaligus, ke bawah Pulau Halmahera di timur dan ke bawah Pulau Sangihe di barat, sehingga memicu aktivitas gempa sangat rapat.

### Sel H3 aktif dianalisis: 7.017 sel

Sepanjang 1960 sampai 2024 sebenarnya ada 17.140 petak segi enam yang pernah tersentuh minimal satu gempa. Sebanyak 10.123 petak memiliki kurang dari 10 gempa sehingga tidak diikutkan dalam pemeringkatan, menyisakan 7.017 sel aktif yang datanya cukup banyak untuk dihitung.

### Nilai b acuan nasional: 0,7014

Nilai b mengukur perbandingan jumlah gempa kecil terhadap gempa besar di suatu wilayah. Cara membayangkannya mirip menekan seikat ranting kering. Saat tekanan masih ringan, hanya ranting kecil yang patah berulang kali (nilai b tinggi, sekitar 1,2). Saat tekanan menumpuk berat, batang besar pun ikut patah berkali-kali (nilai b rendah, sekitar 0,6). Jadi nilai b yang rendah menandakan kerak bumi di wilayah itu sedang tegang.

Menghitung nilai b butuh minimal 30 gempa bermagnitudo `≥ 4,0`. Jika satu petak sepi, sistem meminjam data dari 6 petak tetangga di sekelilingnya (disebut pemulusan 1-ring). Cara ini berhasil mengukur nilai b langsung pada `76,1%` wilayah (5.342 sel). Sisa `23,9%` sel yang masih kekurangan sampel diberi nilai acuan nasional `0,7014` sebagai angka titipan sementara (imputasi). Hampir separuh sel (`48,9%` atau 3.433 sel) memiliki tingkat ketelitian tinggi dengan batas kesalahan statistik `sigma_b ≤ 0,1`.

### Magnitudo kelengkapan operasional (Mc): 4,0 Mw/mb

Stasiun pencatat gempa tersebar lebih padat di Jawa dan Sumatra dibandingkan perairan timur Indonesia. Gempa besar (misalnya M 7) pasti tertangkap alat di mana pun letaknya, tetapi gempa kecil (M 2,5) di tengah laut bisa lolos tanpa tercatat. Angka `Mc` adalah batas aman yang memastikan hampir seluruh gempa di atas nilai tersebut berhasil terekam. Meski perhitungan otomatis (`MAXC`) menyarankan angka `3,00`, proyek ini sengaja memilih batas aman `4,0` agar hasil kepadatan tidak berat sebelah ke pulau yang sensornya paling rapat. Ada `85.413` gempa yang melewati batas magnitudo 4,0 tersebut.

## Distribusi tier untuk membaca pembagian kategori bahaya

Bagian kedua menampilkan dua grafik batang mendatar berdampingan. Keduanya membagi 7.017 sel yang sama, hanya cara membuat kelompoknya yang berbeda.

Grafik sebelah kiri (**Distribusi Tier Absolut**) membagi skor menurut batas nilai tetap: `Low` di bawah 0,25, `Moderate` antara 0,25 sampai 0,50, `High` antara 0,50 sampai 0,75, dan `Very High` mulai 0,75 ke atas. Hasilnya tampak menumpuk berat di satu tempat: `Low` kosong (`0 sel`), `Moderate` berisi `1.611 sel` (`22,96%`), `High` menampung `5.351 sel` (`76,26%`), dan hanya `55 sel` (`0,78%`) yang masuk `Very High`.

Mengapa tidak ada satu pun sel yang masuk kategori `Low`? Indonesia secara umum berada di jalur pertemuan lempeng aktif sehingga sebagian besar gempa yang lolos saringan 10 gempa berkarakter dangkal dan bertegangan tinggi. Kondisi alam ini otomatis memberi nilai dasar sekitar 0,39 bagi petak aktif yang paling sepi sekalipun.

Grafik sebelah kanan (**Distribusi Tier Kuartil Relatif**) memecahkan penumpukan tersebut dengan cara mengurutkan semua 7.017 sel dari skor terendah sampai tertinggi, lalu memotongnya menjadi empat kelompok berisi jumlah wilayah sama banyak, mirip membagi peringkat kelas menjadi empat bagian: `Q1` (25% terbawah), `Q2`, `Q3`, dan `Q4` (25% teratas), masing-masing berisi `1.754` hingga `1.755` sel. Gunakan grafik kiri untuk mengetahui berapa banyak wilayah ekstrem yang melampaui ambang 0,75, lalu gunakan grafik kanan saat ingin menyusun prioritas perbandingan antarwilayah.

## Penjelas kanal dan peta ikhtisar Top-20

Bagian ini menjawab pertanyaan **"mengapa suatu sel bisa masuk peringkat atas?"**. Kamu bisa mengganti sel yang dibedah melalui daftar pilihan "Pilih sel Top-20", menekan empat tombol "Lompat cepat", mengeklik titik merah di peta sebelah kanan, atau mengeklik baris mana saja di tabel Top-20. Semuanya otomatis saling terhubung.

### Cara membaca grafik empat batang merah dan garis vertikal hitam

Panel kiri menampilkan empat batang merah pada skala 0,00 sampai 1,00. Setiap batang mewakili satu komponen penyusun skor SHI pada petak pilihanmu, sedangkan garis tegak hitam tebal menunjukkan angka rata-rata seluruh Indonesia (7.017 sel). Jika ujung batang merah melewati garis hitam ke kanan, artinya petak tersebut lebih rawan daripada rata-rata nasional pada faktor itu, dan selisihnya langsung ditulis di ujung kanan batang (misalnya `+0,54 vs rata-rata`).

Komponen pertama adalah `n_norm (Densitas log >= Mc)` yang mengukur seberapa rapat kejadian gempa bermagnitudo minimal 4,0 di petak itu. Hitungannya memakai skala logaritma (kurang lebih mirip menghitung skala kelipatan sepuluh: 10 gempa jauh lebih kecil pengaruhnya dibanding lonjakan linear ribuan gempa) agar lokasi dengan ribuan gempa susulan tidak membuat daerah berpuluhan gempa tampak seolah nol mutlak. Garis rata-rata nasionalnya berada di `0,4181`.

Komponen kedua adalah `s_norm (Rasio dangkal <= 70 km)` yang mengukur porsi gempa dangkal (kedalaman 0 sampai 70 kilometer). Gempa dangkal menimbulkan guncangan lebih merusak di permukaan karena jarak rambat energinya pendek. Untuk mencegah sel bermodal sedikit gempa mendapat skor sempurna 1,0 secara kebetulan, hitungan memakai penyeimbang statistik (*shrinkage* `kappa = 10`) yang menarik estimasi sel sepi sedikit ke arah rata-rata nasional (`0,7617`).

Komponen ketiga adalah `b_inv (Tegangan kerak 1/b)`. Karena nilai b rendah menandakan tegangan tinggi, skalanya dibalik: nilai b `0,5` berubah menjadi skor bahaya penuh `1,0`, sedangkan nilai b `2,0` menjadi `0,0`. Garis rata-rata nasionalnya cukup tinggi di angka `0,8484`.

Komponen keempat adalah `m_norm (Magnitudo maks)` yang mengukur gempa terkuat yang pernah tercatat di petak tersebut dibandingkan terhadap rekor batas atas gempa bumi sebesar 9,5. Garis rata-rata nasionalnya berada di `0,2130`.

Skor SHI utama dihitung dengan merata-ratakan panjang keempat batang merah tadi. Pada sel peringkat `#1` (`8568c9affffffff`), perhitungannya adalah `(0,9594 + 0,9676 + 0,9238 + 0,4909) / 4 = 0,8354`.

Di bawah grafik batang terdapat delapan catatan angka ringkas untuk sel yang sedang dipilih. Satu rincian yang penting dicermati adalah "Kedalaman Default (10/35 km)". Saat stasiun pencatat belum cukup sudut pengamatan untuk memastikan kedalaman gempa, instansi sering mengisi angka patokan `10 km` atau `35 km`. Pada sel `#1`, sebesar `44,2%` gempanya memakai kedalaman patokan itu, sehingga kolom ini membantu pembaca melihat seberapa banyak porsi angka yang berasal dari kedalaman perkiraan standar.

### Cara membaca peta ikhtisar di panel kanan

Peta garis pantai Indonesia di sebelah kanan menaruh dua simbol berbeda. Titik bulat berwarna merah adalah posisi tengah 20 petak paling berbahaya. Sebanyak 19 titik merah berkumpul rapat di Laut Maluku hingga timur laut Sulawesi Utara, sementara 1 titik menyendiri di daratan utara Papua (`#20`, dekat Jayapura pada `-2,56 LS, 140,58 BT`). Mengeklik titik merah mana saja akan langsung memunculkan profil batang sel itu di sebelah kiri.

Kotak putih berbingkai hitam menandai episenter (titik permukaan tepat di atas pusat awal) 6 gempa besar terkenal dalam sejarah Indonesia: Aceh 2004, Nias 2005, Yogyakarta 2006, Padang 2009, Lombok 2018, dan Palu 2018. Keenam lokasi bencana besar ini sengaja diplot sebagai pembanding. Terlihat tidak satu pun dari keenam kotak putih itu berada di klaster titik merah Top-20, dan alasannya dijelaskan di bagian validasi serta keterbatasan.

## Tabel Top-20 dan tombol penyaringan

Tabel ini merinci angka mentah ke-20 petak berperingkat teratas. Semuanya berstatus `Very High` (SHI 0,75 ke atas) dan 100% menyandang tanda `Terukur` pada kolom nilai b, artinya tidak satu pun mengandalkan angka titipan nasional.

Di atas tabel tersedia barisan tombol Provinsi (`Semua (20)`, `Maluku Utara (17)`, `Sulawesi Utara (2)`, dan `Papua (1)`) untuk menyaring baris menurut wilayah terdekat, serta kotak pencarian ("Cari sel / pemicu") jika ingin mencari teks spesifik seperti `Daratan` (ada 3 petak darat di peringkat `#4`, `#15`, dan `#20`) atau `magnitudo` (ada 5 petak yang dipicu kekuatan gempa puncak). Kamu juga bisa mengeklik judul kolom di kepala tabel untuk mengurutkan isi tabel dari terbesar atau terkecil, misalnya mengeklik `Gempa` untuk melihat sel `#8` yang menyimpan kejadian terbanyak (`301` gempa) atau mengeklik `Mag Maks` untuk melihat sel `#2` dengan magnitudo terbesar di Top-20 (`7,2`).

Di sebelah kanan kotak pencarian terdapat tombol Status tampilan (`Data Aktif`, `Memuat`, dan `Galat`). Tombol tersebut digunakan untuk menguji tampilan antarmuka saat tabel sedang memuat atau mengalami kondisi gagal muat. Klik tombol `Data Aktif` bila ingin mengembalikan tabel ke tampilan normal.

Kolom paling kanan bertajuk `Pemicu Risiko` menunjukkan faktor mana yang paling menonjol di atas rata-rata nasional untuk petak tersebut. Sebanyak 15 sel di Top-20 dipimpin oleh `densitas event` (aktivitas gempa sangat sering), sedangkan 5 sel dipimpin oleh `magnitudo maksimum` (pernah diguncang satu gempa sangat besar).

## Uji sensitivitas untuk menguji ketahanan hasil

Empat panel di bagian ini menguji apakah hasil penelitian mudah berubah jika aturan perhitungannya diganti. Jika parameter batas diubah, apakah daftar 20 petak paling berbahaya ikut berantakan atau tetap sama?

### Uji A melihat batas minimal gempa per sel (N_min)

Penguji sering bertanya mengapa batas minimal ditetapkan 10 gempa per sel. Panel ini mencoba melonggarkan batas menjadi `5` gempa (menghasilkan `10.055` sel aktif) dan memperketatnya menjadi `20` gempa (menyisakan `4.132` sel aktif). Pada kolom paling kanan (`Irisan Top-20`), ketiganya tetap menghasilkan **20 / 20** petak teratas yang sama persis.

### Uji B membuang 30,24% gempa berkedalaman patokan

Ada `94.957` gempa di katalog (`30,24%`) yang kedalamannya diisi tepat `10 km` atau `35 km` (`84.528` event di 10 km dan `10.429` event di 35 km). Uji ini membuang seluruh gempa berkedalaman patokan tersebut saat menghitung rasio gempa dangkal (`s_norm`). Rata-rata SHI nasional bergeser sedikit dari `0,5603` turun ke `0,5411`, tetapi 20 petak Top-20 tetap tidak berubah sama sekali (`20 / 20`). Ini membuktikan daerah Laut Maluku tetap didominasi gempa dangkal sungguhan (`90%` sampai `98%`) meski data patokan disisihkan.

### Uji C menguji konversi skala magnitudo dan bobot entropi

Karena data mentah mencampur berbagai jenis ukuran magnitudo, uji ini mengubah sekitar `20,8%` catatan (`mb` dan `Ms`) mendekati skala momen standar (`Mw`) memakai rumus Scordilis (2006), sekaligus membandingkan bobot setara dengan metode pembobotan otomatis bernama **Entropi Shannon**.

Jika skala magnitudo dikonversi pada batas `Mc 4,00` tetap, 18 dari 20 petak teratas masih bertahan dengan kemiripan urutan peringkat (**Spearman rho**) sebesar `0,9779` (angka 1,0 berarti urutan identik persis). Ketika batas `Mc` ikut dinaikkan ke `4,80` agar selaras secara matematis dengan rumus konversi, dua pertiga data terbuang dan persentase sel yang bisa diukur nilai b-nya langsung jatuh dari `76,1%` menjadi `23,0%` (asli) dan `33,9%` (terkonversi). Perbandingan antarbaris memperlihatkan bahwa turunnya kesamaan Top-20 ke `16/20` sebagian besar dipicu oleh menyusutnya jumlah data saat `Mc` dinaikkan ke `4,80`, sementara konversi skalanya sendiri hanya menggeser 2 sel (`18/20` ketika sama-sama dihitung di `Mc 4,80`).

Baris kelima menunjukkan hasil pembobotan otomatis **Entropi Shannon**, yang memberi bobot tinggi ke komponen yang angkanya paling menyebar lebar dan memangkas komponen yang angkanya agak seragam. Karena nilai b di seluruh Indonesia berkerumun cukup rapat, metode entropi otomatis menurunkan bobot tegangan kerak `b_inv` hingga tinggal `0,0185` (kurang dari 2%) dan menumpuk hampir separuh bobot (`0,4824`) pada magnitudo `m_norm` yang sudah saling berkorelasi `0,618` dengan jumlah gempa `n_norm`. Karena alasan ilmiah itulah bobot setara `0,25` tetap dipertahankan sebagai acuan utama, walau urutan peringkat kedua versi tetap searah (`Spearman rho 0,9137`).

### Uji D membandingkan ukuran petak H3 Resolusi 4, 5, dan 6

Grafik batang di panel keempat menjelaskan pertukaran antara ketajaman petak dan kecukupan data. Di **Resolusi 4** (petak besar `1.770,3 km²`), `96,0%` dari `2.144` sel mampu mengukur nilai b langsung. Di **Resolusi 5** (`252,9 km²`), `76,1%` dari `7.017` sel masih bisa mengukur nilai b langsung. Jika diperkecil ke **Resolusi 6** (`36,1 km²`), sebanyak `64.185` petak rontok kekurangan data dan hanya `31,3%` sel yang terukur nilai b-nya sementara `68,7%` sisanya terpaksa meminjam angka nasional, sehingga Resolusi 6 terlalu kosong untuk dipakai.

## Validasi pada enam gempa besar bersejarah

Bagian ini menguji seberapa masuk akal skor H3-SHI bila dihadapkan dengan lokasi enam bencana gempa besar yang sudah dikenal publik luas.

### Cara membaca grafik selisih magnitudo

Di setiap baris peristiwa, titik hitam menunjukkan magnitudo yang tertulis di dalam dataset katalog, sedangkan titik merah menunjukkan magnitudo sebenarnya (`Mw`) menurut literatur ilmiah. Garis merah atau jingga yang menghubungkan keduanya menandakan besarnya selisih pencatatan.

Pada gempa-gempa besar sebelum 2010, tampak penyimpangan besar. Gempa Sumatra-Andaman 2004 yang kekuatannya `Mw 9,1` hanya tercatat `7,1` (`Mw(mB)`) dalam katalog (selisih `-2,0`). Selisih negatif juga muncul di Nias 2005 (`8,6` tertulis `7,7`) dan Padang 2009 (`7,6` tertulis `7,1`). Sebaliknya, gempa lebih baru seperti Lombok 2018 (`6,9`) dan Palu 2018 (`7,5`) sudah tercatat tepat sehingga hanya muncul satu titik hitam tanpa garis selisih (`0,0`). Masalah ini terjadi karena alat pengukur lama berbasis gelombang badan mengalami saturasi: saat gempa raksasa mengguncang tanah selama puluhan detik, jarum bacaan gelombang periode pendek mentok di kisaran M 6,5 sampai 7, sehingga tidak lagi menangkap total energi sesungguhnya.

### Cara membaca tabel validasi gempa rujukan

Lima dari enam titik episenter gempa rujukan masuk ke dalam petak aktif berstatus **High** dengan persentil nasional berkisar antara `76,13%` (Padang 2009) hingga `97,31%` (Palu 2018).

Pada baris Nias 2005, sebagian besar kolom sengaja berisi tanda strip abu-abu (`-`) dan status `Tersaring (< 10 gempa)`. Penyebabnya, satu petak tunggal tepat di titik koordinat awal gempa Nias kebetulan hanya memuat kurang dari 10 gempa sehingga disisihkan oleh aturan `N_min = 10`. Untuk tetap memberi gambaran kawasan di sekitarnya, kolom paling kanan sebelum pemicu (**Maks 1-Ring**) mencatat angka `0,6481`, yaitu skor tertinggi dari enam petak tetangga tepat di sekeliling titik Nias tersebut.

## Keterbatasan data yang perlu dipahami bersama

Empat panel di bagian bawah halaman menjelaskan batas kemampuan metode ini secara jujur agar tidak disalahartikan saat presentasi maupun penulisan laporan.

### Saturasi skala magnitudo pada gempa raksasa

Dataset sumber mencampur 26 jenis skala magnitudo berbeda, didominasi magnitudo lokal (`MLv`) dan gelombang badan (`mb`), sedangkan skala momen murni (`Mw`) hanya berjumlah `1.344` kejadian atau `0,43%` dari seluruh data. Karena efek jenuh pada skala lama, tidak ada satu pun gempa dalam katalog tersaring ini yang melebihi magnitudo `7,90`.

### Perbedaan nilai b antara skala MLv dan mb

Bila diukur terpisah di tingkat nasional, kelompok kejadian berskala `MLv` menghasilkan nilai b tinggi (`1,1835`), sementara kelompok berskala `mb` menghasilkan nilai b rendah (`0,6297`). Kabar baiknya, di dalam masing-masing petak segi enam, kedua skala tersebut tercampur cukup seimbang dengan porsi skala terbanyak rata-rata sekitar `50%`. Karena tercampur merata di hampir semua wilayah, selisih nilai b antarwilayah hanya bergerak sempit di kisaran `0,70` sampai `0,76`, sehingga peta nilai b tidak berubah menjadi peta perbedaan alat ukur antarlembaga.

### Efek lantai ambang absolut

Karena Indonesia merupakan wilayah tektonik sangat aktif dan saringan 10 gempa sudah menyingkirkan area paling sepi, petak terendah pun sudah mendapat nilai SHI `0,2733` dan `76,26%` petak terkumpul di kategori `High`. Pembaca sebaiknya melihat **Tier Kuartil (Q1 sampai Q4)** dan skor desimalnya saat membandingkan tingkat bahaya antarwilayah di Indonesia.

### Satu titik koordinat melawan panjang patahan raksasa

Penguji sering bertanya mengapa lokasi gempa Aceh 2004 tidak menduduki peringkat teratas. Selain efek magnitudo 9,1 yang tercatat mentok di 7,1, katalog gempa hanya menyimpan satu titik awal pecahnya batuan (episenter), padahal patahan gempa Aceh 2004 robek memanjang sekitar `1.300 km`. Sebanyak `3.091` gempa sekuens 2004 hingga 2005 tersebar ke puluhan petak selebar sekitar 17 km di sepanjang robekan tersebut, sehingga satu petak titik awal (`856555c3fffffff`) hanya kebagian `13` gempa (`SHI 0,6320`, maks tetangga `0,7029`). Selain itu, karena keempat faktor penyusun SHI berbagi bobot sama 25%, wilayah yang pernah diguncang satu gempa sangat dahsyat tetapi jumlah gempanya jarang tetap kalah poin dibandingkan zona Laut Maluku yang terus aktif rapat nyaris sepanjang periode pengamatan.

## Alur singkat saat membuka atau mempresentasikan dashboard

Saat menjelaskan isi dashboard ke penguji atau rekan kelompok, ikuti alur halaman [index.html](index.html) dari atas ke bawah: mulai dengan menunjukkan rata-rata `0,5603` dan dominasi `17 / 20` sel di Maluku Utara, lalu jelaskan alasan adanya grafik Tier Kuartil di samping Tier Absolut. Setelah itu, pilih sel `#1` dan `#20 Papua` pada grafik penjelas kanal untuk memperlihatkan perbedaan pemicu antarwilayah, lanjutkan ke Uji A sampai Uji D untuk menunjukkan ketahanan hasil, bahas kasus Aceh dan Nias pada bagian validasi dan keterbatasan, lalu akhiri dengan mengeklik tombol peta menuju [indonesia_seismic_hazard_map.html](indonesia_seismic_hazard_map.html) untuk meninjau keseluruhan `7.017` heksagon di seluruh Indonesia.
