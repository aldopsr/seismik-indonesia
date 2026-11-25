/* The observed national charts come from saved notebook outputs. */
const researchLayerSelect = document.getElementById('map-layer');
const researchLegend = document.getElementById('research-map-legend');
const researchHazardLayer = document.querySelector('.hazard-layer');
const researchLayerColors = {
  shi: ['#ffffb2', '#fecc5c', '#fd8d3c', '#e31a1c'],
  events: ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'],
  b: ['#3b4cc0', '#7b9ff9', '#cbd6e8', '#e9b4a0', '#b40426']
};

function researchCellColor(cell, layer) {
  if (layer === 'shi') {
    return researchLayerColors.shi[Math.min(3, Math.floor(cell[8] / 25))];
  }
  if (layer === 'events') {
    const index = [50, 100, 200, 500].filter(threshold => cell[3] >= threshold).length;
    return researchLayerColors.events[index];
  }
  if (!cell[7]) return '#9ca3af';
  const index = [.75, 1, 1.25, 1.5].filter(threshold => cell[6] >= threshold).length;
  return researchLayerColors.b[index];
}

function renderResearchLayer() {
  const layer = researchLayerSelect.value;
  const paths = researchHazardLayer.querySelectorAll('.research-cell');
  paths.forEach((path, index) => {
    path.style.fill = researchCellColor(window.SEISMIC_CELLS[index], layer);
  });
  const labels = {
    shi: ['SHI < 25', '25–<50', '50–<75', '≥75'],
    events: ['<50 gempa', '50–99', '100–199', '200–499', '≥500'],
    b: ['b < 0,75', '0,75–<1', '1–<1,25', '1,25–<1,5', '≥1,5']
  };
  researchLegend.replaceChildren();
  labels[layer].forEach((label, index) => {
    const item = document.createElement('span');
    const swatch = document.createElement('i');
    swatch.className = 'swatch';
    swatch.style.backgroundColor = researchLayerColors[layer][index];
    item.append(swatch, document.createTextNode(label));
    researchLegend.append(item);
  });
  if (layer === 'b') {
    const missing = document.createElement('span');
    missing.innerHTML = '<i class="swatch" style="background:#9ca3af"></i> b tidak terukur';
    researchLegend.append(missing);
  }
  const markerKey = document.createElement('span');
  markerKey.innerHTML = '<i class="swatch-dot"></i> Sel terpilih';
  researchLegend.append(markerKey);
}

function renderResearchScope() {
  const province = zoomedProvince;
  document.querySelectorAll('[data-research-scope]').forEach(label => {
    label.textContent = province || 'Indonesia';
  });
  document.getElementById('fmd-image').hidden = Boolean(province);
  document.getElementById('temporal-image').hidden = Boolean(province);
  document.getElementById('fmd-unavailable').hidden = !province;
  document.getElementById('temporal-unavailable').hidden = !province;
  document.querySelectorAll('[data-regional-note]').forEach(note => {
    note.textContent = `Peta sedang menyorot ${province || 'Indonesia'}. Distribusi magnitudo dan deret tahunan per provinsi belum diekspor dari notebook. Grafik nasional tersedia melalui tombol di bawah.`;
  });
  document.querySelectorAll('.province-bar').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.province === province));
  });
}

researchHazardLayer.replaceChildren();
const svgNamespace = 'http://www.w3.org/2000/svg';
const researchPaths = document.createDocumentFragment();
window.SEISMIC_CELLS.forEach(cell => {
  const ring = cell[0];
  const coordinates = [];
  for (let index = 0; index < ring.length; index += 2) {
    coordinates.push(`${projX(ring[index])},${projY(ring[index + 1])}`);
  }
  const polygon = document.createElementNS(svgNamespace, 'path');
  polygon.classList.add('research-cell');
  polygon.setAttribute('d', `M${coordinates.join(' ')}z`);
  const title = document.createElementNS(svgNamespace, 'title');
  title.textContent = `${cell[1]} · SHI ${fmtDec(cell[8], 1)}/100 · ${fmtInt(cell[3])} gempa · b ${cell[7] ? fmtDec(cell[6], 2) : 'tidak terukur'}`;
  polygon.append(title);
  researchPaths.append(polygon);
});
researchHazardLayer.append(researchPaths);
researchLayerSelect.addEventListener('change', renderResearchLayer);
document.querySelectorAll('.show-national').forEach(button => button.addEventListener('click', resetZoom));

const provinceComparison = document.getElementById('province-comparison');
provinceComparison.innerHTML = `
  <div class="figure-heading"><h3 class="panel-title">Rata-rata SHI per provinsi</h3><span class="panel-sub">Sepuluh nilai tertinggi · skala 0–100</span></div>
  <p class="panel-sub">Pilih batang untuk menyorot peta wilayah. Rata-rata dihitung atas sel H3 aktif yang dikelompokkan ke provinsi pada data proyek.</p>
  <div class="province-bars"></div>
`;
const provinceBars = provinceComparison.querySelector('.province-bars');
PROVINCE_DATA.filter(province => province.cells > 0)
  .sort((left, right) => right.mean_shi - left.mean_shi)
  .slice(0, 10)
  .forEach(province => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'province-bar';
    button.dataset.province = province.province;
    button.setAttribute('aria-pressed', 'false');
    const name = document.createElement('span');
    name.textContent = province.province;
    const track = document.createElement('span');
    track.className = 'province-bar-track';
    const fill = document.createElement('span');
    fill.className = 'province-bar-fill';
    fill.style.width = `${province.mean_shi * 100}%`;
    track.append(fill);
    const score = document.createElement('span');
    score.className = 'province-bar-value';
    score.textContent = fmtDec(province.mean_shi * 100, 1);
    button.append(name, track, score);
    button.addEventListener('click', () => selectProvince(province.province));
    provinceBars.append(button);
  });
renderResearchLayer();
renderResearchScope();

function renderPriorityExplanation() {
  const explanations = {
    top20: {
      title: 'Bahaya alam (SHI)',
      meaning: 'Maluku Utara mendominasi Top-20. Peringkat menggabungkan empat indikator, sehingga jumlah gempa saja belum menentukan urutan.',
      action: 'Gunakan daftar ini untuk memilih wilayah kajian aktivitas gempa. Pilih baris untuk melihat lokasi dan komponen skornya.',
      limit: 'SHI menggambarkan bahaya relatif dari katalog. Dampak pada warga bergantung pula pada paparan dan kerentanan.'
    },
    srei: {
      title: 'Risiko penduduk (SREI)',
      meaning: 'SREI menggabungkan skor bahaya, kepadatan penduduk BPS, dan bobot lokasi darat atau laut. Karena itu prioritas dapat bergeser ke Jawa dan Bali.',
      action: 'BNPB, BPBD, dan pemda dapat memakai daftar ini untuk menyaring lokasi kajian kesiapsiagaan, edukasi, dan kebutuhan logistik.',
      limit: 'Indeks ini belum menghitung kerentanan bangunan, jumlah korban, atau kerugian ekonomi. Kepadatan penduduk memakai angka provinsi.'
    },
    tsunami: {
      title: 'Kandidat kajian tsunami',
      meaning: 'Sepuluh contoh berikut berasal dari 74 petak laut dengan proporsi gempa dangkal ≥ 50% dan riwayat M ≥ 6,5 setelah koreksi magnitudo rujukan.',
      action: 'Gunakan sebagai daftar lokasi untuk kajian tsunami lanjutan, terutama di Aceh, Bengkulu, dan Sumatera Barat.',
      limit: 'Potensi pembangkitan tsunami juga memerlukan kajian mekanisme sumber dan kondisi laut. Skor ini belum menentukan wilayah genangan atau rute evakuasi.'
    },
    gap: {
      title: 'Kandidat seismic gap',
      meaning: 'Kriteria proyek memilih petak dengan b terukur < 0,75, riwayat M ≥ 5,5, dan tanpa catatan M ≥ 6,0 pada 2005–2024. Tabel menampilkan sepuluh contoh.',
      action: 'BMKG dan peneliti dapat meninjau kelengkapan katalog, pemantauan, serta bukti geologi di sekitar lokasi.',
      limit: 'Kriteria ini merupakan penanda untuk kajian. Konfirmasi akumulasi tegangan memerlukan data tambahan, termasuk pengukuran deformasi.'
    },
    shaking: {
      title: 'Guncangan daratan',
      meaning: 'Daftar ini menyoroti petak darat dengan skor gabungan bahaya, rasio gempa dangkal, dan magnitudo maksimum.',
      action: 'Gunakan untuk menentukan lokasi yang perlu diperiksa lebih rinci sebelum kajian bangunan atau infrastruktur.',
      limit: 'Skor ini belum menghitung percepatan tanah atau pengaruh kondisi tanah setempat.'
    }
  };
  const explanation = explanations[activeTab];
  const target = document.getElementById('priority-explanation');
  target.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = explanation.title;
  target.append(heading);
  const overview = document.createElement('p');
  overview.textContent = explanation.meaning;
  target.append(overview);
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Penggunaan dan batas analisis';
  details.append(summary);
  for (const [label, text] of [['Penggunaan', explanation.action], ['Batas analisis', explanation.limit]]) {
    const paragraph = document.createElement('p');
    const bold = document.createElement('strong');
    bold.textContent = label + '. ';
    paragraph.append(bold, document.createTextNode(text));
    details.append(paragraph);
  }
  target.append(details);
}

document.querySelectorAll('[data-priority]').forEach(link => {
  link.addEventListener('click', () => {
    tableSearchInput.value = '';
    tableSearch = '';
    document.querySelector(`.comp-tab-btn[data-tab="${link.dataset.priority}"]`).click();
  });
});
renderPriorityExplanation();
