# Project Requirements Document & Technical Walkthrough (v3.4)
## Seismic Hazard Mapping Platform using Uber H3 Discrete Global Grid System (DGGS) & Gutenberg-Richter Law

> **Changelog v2.0 → v3.4.** Thirty-six changes, each recorded with its reason in Section 7. The two that alter published results: a minimum-event guard plus shrinkage on the shallow ratio, which stopped near-empty cells from scoring in the **High** tier, and removal of the final post-normalization, which had made the index ordinal and incomparable across runs. Four previously promised items now have code: data-driven $M_c$ estimation, Shannon entropy weighting, the administrative spatial join, and an assertion cell that halts the notebook if any invariant breaks.

---

## 1. Project Identity & Objective

* **Project Name:** Indonesian Seismic Hazard Indexing via Discrete Global Grid System (H3-SHI)
* **Course:** Final Project - Teknologi Big Data
* **Target Deliverables:**
  1. **Reproducible Jupyter Notebook (`.ipynb`):** Execution pipeline from ingestion and spatial binning through administrative spatial joins to interactive cartographic visualization.
  2. **Formal PDF Technical Report:** Documentation covering spatial findings, seismological methodology, weight sensitivity, and regional vulnerability rankings.
  3. **Draft Academic Paper:** Structured under the IMRaD format (Introduction, Methods, Results, and Discussion) targeted for geospatial/geohazards publication.
* **Core Problem Statement:** Conventional clustering algorithms (such as $k$-means or DBSCAN with Euclidean metrics) impose spherical or isotropic geometry onto tectonic events, distorting the linear and curvilinear reality of fault lines, trench geometry, and subduction zones. This project replaces arbitrary distance-based clustering with the Uber H3 Hexagonal Discrete Global Grid System (DGGS) at Resolution 5. This spatial discretization, augmented with 1-ring topological neighborhood smoothing, allows localized seismic risk across Indonesia to be quantified through empirical Gutenberg-Richter $b$-value estimation and an entropy-validated multi-criteria Seismic Hazard Index (SHI).

### 1.1 What the SHI Is and Is Not

The SHI is a **relative, catalog-derived hazard ranking on an absolute 0–1 scale**. Three of its four channels ($S$, $B_{\text{inv}}$, $M_{\text{norm}}$) are normalized against fixed physical reference domains, so their values are comparable across runs and across H3 resolutions. The fourth ($N_{\text{norm}}$) uses run-specific min-max scaling and is therefore the one channel that requires its scaling constants to be reported alongside results (Step 6 prints them).

The SHI is not a probabilistic seismic hazard assessment. It carries no return period, no ground-motion model, no site-response term, and no exposure or vulnerability layer. It ranks grid cells by catalog-observable hazard proxies. Comparison against PusGen maps in the Discussion must be framed as a spatial-pattern comparison, not a numerical validation.

---

## 2. Dataset Specifications & Environmental Schema

### 2.1 Dataset Profile

* **Primary File Name:** `Integrated_Standardized_Earthquake_Catalogue_Indonesia_88AD_2024.csv`
  (copies downloaded from Drive may carry a ` (1)` suffix; Step 1 resolves the path by
  pattern rather than exact name)
* **Volume:** $\approx 322,961$ records, 41 MB
* **Actual schema as delivered**, verified against the file rather than assumed:

  ```
  No, Event_ID, Date, Year, Time_UTC, Time_Local, Latitude, Longitude,
  Depth_km, Magnitude, Magnitude Type, Catalog_Source, Source_Event_ID,
  Magnitude_Source/Author, Magnitudo_Relation, Region, Remarks
  ```

  The file opens with a UTF-8 BOM, so it must be read with `encoding="utf-8-sig"` or the
  first column is named `﻿No`. Missing values are the string `NA`, which pandas
  already treats as null. `Remarks` holds free prose of mixed type, so `low_memory=False`
  avoids a `DtypeWarning`.

* **Field mapping to the pipeline's convention.** Four columns are renamed once at load
  time, after which the rest of the notebook works in one naming convention:

  | In the file | In the pipeline | Notes |
  | :-- | :-- | :-- |
  | `Latitude` | `latitude` | float, domain $[-11.0, 6.0]$ after filtering |
  | `Longitude` | `longitude` | float, domain $[95.0, 141.0]$ after filtering |
  | `Depth_km` | `depth` | hypocentral focus depth, km |
  | `Magnitude` | `magnitude` | standardized magnitude ($M_w$, $M_s$, or equivalent) |

* **Year source.** The catalog carries both `Date` and `Year`. `Date` is unparseable for
  pre-instrumental events, which appear as placeholders such as `00-000-0088`, so the
  pipeline reads `Year` directly as an integer. Parsing `Date` would coerce those rows to
  `NaT` and reach the same filtered result, but by accident rather than by design.
* **`Magnitude Type` is present**, which makes the magnitude-homogeneity check of
  Section 5.1 item 3 a real test rather than a formality. Report its value counts and
  state whether a single scale dominates.
* **Magnitude homogeneity caveat:** The Gutenberg-Richter MLE assumes a single magnitude scale. The catalog name asserts standardization; the Data Quality Audit must verify this (check for a magnitude-type column, and look for discontinuities in the frequency-magnitude distribution around $M \approx 5.5$ where $M_s$/$M_w$ conversions typically introduce steps). State the finding in the report either way.
* **Secondary Spatial Dataset (Administrative Overlay):**
  * Indonesian Administrative Boundaries (Level 1/Province via GADM or BIG Shapefile/GeoJSON) for Top-20 critical hexagon profiling.

### 2.2 Environment & Dependencies

```bash
pip install "h3>=4.0" pandas numpy scipy geopandas folium matplotlib seaborn branca shapely
```

The `h3>=4.0` pin matters. The v3 API uses `geo_to_h3` / `k_ring` / `h3_to_geo_boundary`; every call in this walkthrough uses the v4 names (`latlng_to_cell`, `grid_disk`, `cell_to_boundary`). Mixing versions produces `AttributeError`, not wrong numbers, so it fails fast.

---

## 3. Mathematical & Algorithmic Formulation

### 3.1 Spatial Discretization & Topological Neighborhood (Uber H3 DGGS)

Each seismic epicenter coordinate pair $(\phi_i, \lambda_i)$ (latitude, longitude) is projected into a hexagonal cell index $h_i$ at Resolution 5 ($\text{area} \approx 252.9 \text{ km}^2$, average edge length $\approx 8.5 \text{ km}$):

$$h_i = \text{latLngToCell}(\phi_i, \lambda_i, \text{resolution}=5)$$

Hexagonal tessellations reduce quantization error and edge-effect distortion relative to rectangular planar grids, because all six neighbors sit at a uniform centroid distance.

**Correction to the stated cell geometry.** Versions up to v2.1 of this document gave Resolution 5 as $\approx 1{,}570 \text{ km}^2$ with a $\approx 25 \text{ km}$ edge. That is wrong, and the error matters for the choice of resolution. The H3 averages, confirmed against `h3.average_hexagon_area` in the executed run, are:

| Resolution | Average area | Average edge | Cells with a measured $b$ |
| :-- | --: | --: | --: |
| 4 | 1,770.3 km² | ≈ 22.6 km | 96.0 % |
| **5** | **252.9 km²** | **≈ 8.5 km** | **76.1 %** |
| 6 | 36.1 km² | ≈ 3.2 km | 31.3 % |

The figures previously attributed to Resolution 5 belong to Resolution 4. Each step up in resolution divides cell area by roughly seven.

This is not only a numerical slip. The rationale given for the choice — the scale at which $b$-value estimation has enough events per cell — points to Resolution 4, where 96 % of cells support a measured $b$, rather than Resolution 5, where 24 % of cells fall back to $b_{\text{national}}$. Resolution 5 is kept as the baseline for continuity with earlier runs, but the report must state the choice deliberately and present Resolution 4 alongside it. Resolution 6 should not be offered as a headline result at all: at 31 % measured $b$, more than two cells in three carry an imputed value.

**Spatial Smoothing ($k$-Ring Neighborhood):** Crustal stress and fault ruptures are continuous across discrete cell boundaries, so sparse boundary cells suffer sample-size starvation. To avoid artificial boundary cliffs in $b$-value estimation, a 1-ring topological disk $D_1(h_i)$ is defined as the center hexagon plus its 6 immediate neighbors:

$$D_1(h_i) = \text{gridDisk}(h_i, k=1)$$

Smoothing is applied to the $b$-value channel only. Event counts, shallow ratio, and maximum magnitude are reported per cell without smoothing, because those are descriptive statistics of the cell itself rather than estimates of a spatially continuous field.

### 3.2 Gutenberg-Richter Frequency-Magnitude Relationship

The Gutenberg-Richter empirical relation describes the frequency distribution of earthquakes in a given region:

$$\log_{10} N(M) = a - bM$$

Where:
* $N(M)$ is the cumulative frequency of earthquakes with magnitude $\ge M$.
* $a$ reflects the general seismic activity level.
* $b$ defines the scaling ratio between smaller and larger seismic ruptures (inversely proportional to differential crustal stress).

**Completeness magnitude ($M_c$).** $M_c$ is estimated from the data by the MAXC method: the magnitude bin with the highest non-cumulative frequency, plus a $+0.2$ correction for the known negative bias of the estimator. The estimate is reported next to the frequency-magnitude distribution plot, and the operating value is then set explicitly. A hardcoded $M_c$ with no supporting plot is the weakest point in any $b$-value study, so this step produces evidence rather than an assumption. Baseline operating value: $M_c = 4.0$, retained only if MAXC supports it.

*Note on Catalog Declustering:* This platform evaluates the **non-declustered instrumental catalog** ($\ge 1960$) to capture cumulative seismic energy release and localized aftershock hazard potential, with logarithmic density dampening (Section 3.3) limiting the influence of single mega-sequence aftershock swarms on the density channel.

A second consequence of not declustering deserves explicit treatment in the Discussion. Aftershock swarms are rich in small events, which **raises** the local mean magnitude denominator less than it raises event count, producing **higher** $b$-values and therefore **lower** $B_{\text{inv}}$ scores. Mega-sequence regions such as Aceh 2004 may thus score lower on the stress channel than their tectonic setting suggests. This is the correct reading of the $b$-value as a physical quantity, and it is a limitation of using $b$ as a hazard proxy on a non-declustered catalog.

For hexagonal neighborhoods meeting the statistical significance threshold ($N_{\text{disk}} \ge 30$ events above $M_c$), the $b$-value and its Aki-Utsu standard error ($\sigma_b$) are computed via **Maximum Likelihood Estimation (MLE)**:

$$b = \frac{\log_{10}(e)}{\bar{M} - \left(M_c - \frac{\Delta M}{2}\right)}, \quad \sigma_b = \frac{b}{\sqrt{N_{\text{disk}}}}$$

Where:
* $\bar{M}$: Mean magnitude of all recorded events within the evaluation domain where $M \ge M_c$.
* $M_c$: Completeness magnitude threshold.
* $\Delta M$: Catalog magnitude binning precision ($\Delta M = 0.1$).
* **Physical Domain Clipping:** Valid $b$-values are bounded to the physically realistic tectonic domain $[0.5, 2.0]$.
* **Fallback Imputation:** Cells failing the $N_{\text{disk}} \ge 30$ threshold inherit the nationwide baseline $b$-value ($b_{\text{national}}$) and are flagged `b_estimated = False`. The flag is carried into the GeoJSON, the map tooltip, and the Top-20 table, so an imputed $b$ is never mistaken for a measured one.
* **Uncertainty flag:** Cells are flagged `b_reliable` when $\sigma_b \le 0.1$. The count of reliable cells is reported, and the Results section discusses whether the low-$b$ anomalies it identifies fall inside that set.

### 3.3 Seismic Hazard Index (SHI) Formulation

Four sub-indices bounded to $[0, 1]$ are calculated per active cell $i$. Normalization reference domains are fixed wherever a physical bound exists, so that values do not shift when the catalog is extended or the resolution is changed.

**Cell inclusion criterion.** A cell enters the index only when $N_i \ge 10$. Below that, every channel becomes unstable in the same direction: a single shallow event yields $S_i = 1.0$, an unmeasurable $b$ is imputed at $b_{\text{national}} \approx 0.8$ which sits in the lower fifth of the clipping domain and therefore scores high on $B_{\text{inv}}$, and the result is a near-empty cell presented as high hazard. The threshold is a judgment call rather than a derived quantity; Section 5.1 requires a sensitivity check at $N_{\min} \in \{5, 10, 20\}$.

1. **Log-Transformed Event Density ($N_{\text{norm}}$):** Earthquake frequencies follow a power law, so raw counts are strongly right-skewed during major aftershock sequences (2004 Aceh, 2018 Palu). A $\log_{10}$ transformation is applied before Min-Max scaling. The count used is $N_i^{M_c}$, the number of events above $M_c$, matching the event basis of the $b$-value channel. Counting all events instead would measure seismograph network density as much as seismicity, since station coverage on Java and Sumatra is far denser than in eastern Indonesia:
   $$L_i = \log_{10}(N_i^{M_c} + 1), \quad N_{\text{norm}, i} = \frac{L_i - L_{\min}}{L_{\max} - L_{\min}}$$
   This is the only run-dependent channel. $L_{\min}$ and $L_{\max}$ must be reported as run metadata to allow cross-resolution comparison.

2. **Shrunk Shallow Depth Ratio ($S$):** Proportion of high-damage-potential crustal and shallow subduction ruptures ($\text{depth} \le 70\text{ km}$), shrunk toward the national ratio $p_{\text{nat}}$ with pseudo-count $\kappa = 10$ so that low-$N$ cells cannot reach the extremes of the scale on one or two observations:
   $$S_i = \frac{N_{\text{shallow}, i} + \kappa \, p_{\text{nat}}}{N_i + \kappa}$$
   Many catalogs assign a default depth of 10 km to events without a depth solution. In this catalog the 10 km population alone is **26.9 %**, and a second fixed-depth spike at 35 km brings it to about **30 %**, and because 10 km sits below the 70 km cut-off every one of those events counts as shallow. A quarter of this channel therefore measures missing depth solutions rather than shallow seismicity.

   Section 7.4 quantifies the consequence with a parallel run in which $S$ is computed from known-depth events only, under the same $\kappa = 10$ shrinkage:

   $$S_i^{\text{known}} = \frac{N_{\text{shallow}, i}^{\text{known}} + \kappa \, p_{\text{nat}}^{\text{known}}}{N_i^{\text{known}} + \kappa}$$

   Events carrying a default depth stay in the density and maximum-magnitude channels, since the earthquake did occur and only its depth is unknown. Isolating the change this way tests the depth channel alone instead of confounding it with a smaller event count. A cell whose events all sit at the default depth has $N_i^{\text{known}} = 0$, and the shrinkage term returns $p_{\text{nat}}^{\text{known}}$ rather than dividing by zero.

   Removing the default-depth population lowers the national shallow rate from 0.773 to 0.689. The per-cell effect is much larger where the contamination concentrates: a cell with 80 % default depths falls by about 0.45 on this channel, which is 0.11 of SHI under equal weights, while a cell with none moves by under 0.01. A `default_depth_share` column is therefore carried into the Top-20 export so each row can be read with the right amount of caution.

3. **Inverted Stress Factor ($B_{\text{inv}}$):** Lower $b$-values indicate higher tectonic shear stress and an elevated probability of large-magnitude ruptures. Normalization uses the fixed clipping domain $[b_{\min}, b_{\max}] = [0.5, 2.0]$ rather than the empirical range, so a single outlier cell cannot rescale every other cell:
   $$B_{\text{inv}, i} = 1 - \frac{b_i - 0.5}{2.0 - 0.5}$$

4. **Maximum Historical Magnitude ($M_{\text{norm}}$):** Normalized against the fixed interval from $M_c$ to a physical ceiling of $M_w\,9.5$, the largest instrumentally recorded earthquake:
   $$M_{\text{norm}, i} = \text{clip}\!\left(\frac{M_{\max, i} - M_c}{9.5 - M_c},\, 0,\, 1\right)$$
   $M_{\max,i}$ is an extreme-value statistic and is therefore partly a function of $N_i$: more events sampled means a higher expected maximum. It correlates with $N_{\text{norm}}$ by construction. Entropy weighting is the mechanism that keeps this correlation from silently double-counting activity; the report must include the correlation matrix of the four channels.

#### Composite Index

The composite score combines the four sub-indices using weights $w_k$ with $\sum w_k = 1$:

$$\text{SHI}_i = w_1 N_{\text{norm}, i} + w_2 S_i + w_3 B_{\text{inv}, i} + w_4 M_{\text{norm}, i}$$

Two weight vectors are computed and compared:

* **Baseline equal weights:** $w_k = 0.25$.
* **Shannon entropy weights:** derived from the dispersion of each channel. For channel $k$ with values $x_{ik} \ge 0$ over $n$ cells:
  $$p_{ik} = \frac{x_{ik}}{\sum_{j} x_{jk}}, \quad e_k = -\frac{1}{\ln n}\sum_{i} p_{ik} \ln p_{ik}, \quad d_k = 1 - e_k, \quad w_k = \frac{d_k}{\sum_{l} d_l}$$
  with the convention $0 \ln 0 = 0$. A channel that is nearly constant across cells has high entropy, low $d_k$, and therefore low weight. $B_{\text{inv}}$ is expected to be the low-variance channel, since Indonesian $b$-values cluster in a narrow band; entropy weighting will downweight it accordingly, and the equal-weight baseline will not.

The SHI is **not** rescaled after compositing. Version 2.0 applied a final min-max to force the index across the full unit interval; that step is removed. It made the index purely ordinal: by construction exactly one cell scored 0.0 and one scored 1.0, so the distribution of risk tiers became an artifact of normalization rather than a statement about hazard, and SHI values from different resolutions or catalog vintages were not comparable. Because each $w_k$ sums to 1 and each channel is already bounded to $[0,1]$, the composite is bounded to $[0,1]$ without further scaling.

A consequence worth stating plainly in the Results: the unrescaled SHI may leave the **Very High** tier empty, or place most cells in Moderate and High. That is a finding about absolute hazard level under this weighting, not a defect. A separate `shi_rank_pct` column carries the within-run percentile rank for the Top-20 discussion, where relative ordering is what matters.

#### Risk Classification Matrix

| Hazard Tier | SHI Range | Description |
| :--- | :--- | :--- |
| **Low** | $0.00 \le \text{SHI} < 0.25$ | Sparse seismicity, intermediate/deep focal depth, normal stress regime |
| **Moderate** | $0.25 \le \text{SHI} < 0.50$ | Moderate seismicity with localized crustal events |
| **High** | $0.50 \le \text{SHI} < 0.75$ | Frequent shallow events, lower $b$-value (elevated shear stress) |
| **Very High** | $0.75 \le \text{SHI} \le 1.00$ | Major tectonic convergence, shallow hypocenters, high rupture potential |

These cut-offs are absolute. The choropleth uses the same four breaks, so map colors and table tiers always agree.

---

## 4. Implementation Walkthrough (Colab / Jupyter)

### Step 1: Environment Initialization & Ingestion

```python
import h3
import folium
import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Polygon
import matplotlib.pyplot as plt
import seaborn as sns

# Check the call we actually depend on, not a version string
assert hasattr(h3, 'latlng_to_cell'), "Needs the h3 v4 API: pip install 'h3>=4'"

import glob, os

# Resolved by pattern, not exact name: Drive downloads often append " (1)", and on
# Colab the folder's location inside MyDrive is not known in advance.
PATTERN = "Integrated_Standardized_Earthquake_Catalogue*.csv"
SEARCH_DIRS = ['.', '/content', '/content/drive/MyDrive', '/content/drive/My Drive']

hits = []
for base in SEARCH_DIRS:
    if os.path.isdir(base):
        hits += glob.glob(os.path.join(base, '**', PATTERN), recursive=True)
assert hits, f"Catalog not found. Searched {PATTERN!r} in {SEARCH_DIRS}."
CSV_PATH = sorted(hits, key=len)[0]      # shortest name = the copy without " (1)"

# utf-8-sig strips the BOM, which would otherwise name the first column "﻿No".
# low_memory=False avoids a DtypeWarning from the mixed-type Remarks column.
df_raw = pd.read_csv(CSV_PATH, encoding='utf-8-sig', low_memory=False)
print(f"Raw record count: {len(df_raw):,}")

# This catalog capitalizes its columns and names depth differently from the pipeline.
# Mapped once here, so the rest of the notebook works in one convention.
RENAME = {'Latitude': 'latitude', 'Longitude': 'longitude',
          'Depth_km': 'depth', 'Magnitude': 'magnitude'}
df_raw = df_raw.rename(columns={k: v for k, v in RENAME.items() if k in df_raw.columns})

REQUIRED = ['latitude', 'longitude', 'depth', 'magnitude']
missing = [c for c in REQUIRED if c not in df_raw.columns]
assert not missing, f"Missing required columns: {missing}. Add them to RENAME."

# Year source. This catalog has a clean integer `Year`, while `Date` is a placeholder
# such as "00-000-0088" for pre-instrumental events and will not parse.
YEAR_SOURCE = 'Year' if 'Year' in df_raw.columns else next(
    c for c in ('time', 'Date', 'date', 'datetime') if c in df_raw.columns)
print(f"Year source: {YEAR_SOURCE}")
```

### Step 2: Spatial-Temporal Preprocessing & Data Quality Audit

```python
df = df_raw.copy()

# Instrumental era filtering (1960 onwards for catalog completeness)
if YEAR_SOURCE == 'Year':
    df['year'] = pd.to_numeric(df['Year'], errors='coerce')
else:
    df['year'] = pd.to_datetime(df[YEAR_SOURCE], errors='coerce').dt.year
df = df[df['year'] >= 1960]

# Restrict to the Indonesian tectonic bounding box. This is a box, not a coastline:
# it includes open ocean and slivers of neighbouring territory. Intended for tectonics,
# but it is why Step 7 has to handle offshore cells in the administrative join.
df = df[
    (df['latitude'].between(-11.0, 6.0)) &
    (df['longitude'].between(95.0, 141.0))
]

df = df.dropna(subset=['latitude', 'longitude', 'depth', 'magnitude']).copy()

# Reject physically impossible depths (negative values, below the deepest recorded focus)
n_before = len(df)
df = df[df['depth'].between(0.0, 700.0)]
print(f"Dropped {n_before - len(df):,} records with out-of-range depth")

# Default-depth audit: many catalogs assign 10 km when no depth solution exists.
# A large spike here means the shallow-ratio channel partly measures missing data.
fixed_depth_share = (df['depth'] == 10.0).mean()
print(f"Share of events at exactly 10.0 km: {fixed_depth_share:.2%}")

print(f"Cleaned instrumental dataset count: {len(df):,}")
print(df[['latitude', 'longitude', 'depth', 'magnitude']].describe())
```

### Step 3: H3 Grid Assignment

A list comprehension over NumPy arrays, which avoids the per-row overhead of `pandas.apply(axis=1)`. It is not vectorized in the SIMD sense; `h3.latlng_to_cell` is a scalar C call made once per record.

```python
H3_RES = 5

lats = df['latitude'].to_numpy()
lngs = df['longitude'].to_numpy()
df['h3_index'] = [h3.latlng_to_cell(lat, lng, H3_RES) for lat, lng in zip(lats, lngs)]

print(f"Total active hexagonal cells: {df['h3_index'].nunique():,}")
```

### Step 4: Completeness Magnitude Estimation

```python
DELTA_M = 0.1

# MAXC: the modal magnitude bin marks the rollover of the frequency-magnitude
# distribution. The +0.2 correction compensates the estimator's known negative bias.
mag_binned = (df['magnitude'] / DELTA_M).round() * DELTA_M
mc_maxc = mag_binned.value_counts().idxmax() + 0.2
print(f"MAXC estimate of Mc: {mc_maxc:.2f}")

MC = 4.0   # operating value; justified against mc_maxc and the plot below
print(f"Operating Mc: {MC:.2f}  (MAXC suggests {mc_maxc:.2f})")

# Frequency-magnitude distribution: the evidence for the chosen Mc
incremental = mag_binned.value_counts().sort_index()
cumulative = incremental[::-1].cumsum()[::-1]

fig, ax = plt.subplots(figsize=(7, 5))
ax.semilogy(incremental.index, incremental.values, 'o', ms=3, label='Incremental')
ax.semilogy(cumulative.index, cumulative.values, 's', ms=3, label='Cumulative')
ax.axvline(MC, color='crimson', ls='--', label=f'Operating $M_c$ = {MC}')
ax.axvline(mc_maxc, color='orange', ls=':', label=f'MAXC = {mc_maxc:.2f}')
ax.set(xlabel='Magnitude', ylabel='Count', title='Frequency-Magnitude Distribution')
ax.legend()
plt.tight_layout()
plt.show()

df_mc = df[df['magnitude'] >= MC].copy()
print(f"Events above Mc: {len(df_mc):,} of {len(df):,} ({len(df_mc)/len(df):.1%})")
```

### Step 5: Spatial Aggregation & Cell Inclusion

```python
MIN_CELL_EVENTS = 10

df['is_shallow'] = (df['depth'] <= 70.0).astype(int)

h3_summary = df.groupby('h3_index', as_index=False).agg(
    total_events=('magnitude', 'count'),
    shallow_events=('is_shallow', 'sum'),
    max_magnitude=('magnitude', 'max'),
    mean_magnitude=('magnitude', 'mean')
)

# Count above Mc, so the density channel shares the b-value channel's event basis
n_mc_per_cell = df_mc.groupby('h3_index', as_index=False).agg(n_mc=('magnitude', 'count'))
h3_summary = h3_summary.merge(n_mc_per_cell, on='h3_index', how='left')
h3_summary['n_mc'] = h3_summary['n_mc'].fillna(0).astype(int)

# Drop cells too sparse for any channel to be stable (see Section 3.3)
n_cells_all = len(h3_summary)
h3_summary = h3_summary[h3_summary['total_events'] >= MIN_CELL_EVENTS].reset_index(drop=True)
print(f"Cells retained: {len(h3_summary):,} of {n_cells_all:,} "
      f"(dropped {n_cells_all - len(h3_summary):,} with < {MIN_CELL_EVENTS} events)")

# Shrunk shallow ratio: pulls low-N cells toward the national rate
KAPPA = 10.0
p_nat = df['is_shallow'].mean()
h3_summary['shallow_ratio'] = (
    (h3_summary['shallow_events'] + KAPPA * p_nat) / (h3_summary['total_events'] + KAPPA)
)
print(f"National shallow rate: {p_nat:.3f}")
```

### Step 6: 1-Ring Smoothed Aki-Utsu $b$-value

```python
MIN_EVENTS = 30
B_MIN, B_MAX = 0.5, 2.0

national_b = np.log10(np.e) / (df_mc['magnitude'].mean() - (MC - DELTA_M / 2.0))
print(f"National baseline b-value: {national_b:.3f}")

# Lookup built from the full above-Mc catalog, not from the filtered cell list,
# so neighbours dropped at Step 5 still contribute to a disk sum.
cell_mc_stats = df_mc.groupby('h3_index').agg(
    n_mc=('magnitude', 'count'),
    sum_mag_mc=('magnitude', 'sum')
)
n_lookup = cell_mc_stats['n_mc'].to_dict()
s_lookup = cell_mc_stats['sum_mag_mc'].to_dict()

# A few thousand cells x 7 dict lookups. Loop is fine here; the cost is elsewhere.
b_values, b_errors = [], []
for cell in h3_summary['h3_index']:
    disk = h3.grid_disk(cell, 1)
    n_disk = sum(n_lookup.get(nbr, 0) for nbr in disk)
    sum_mag_disk = sum(s_lookup.get(nbr, 0.0) for nbr in disk)

    if n_disk >= MIN_EVENTS:
        mean_mag_disk = sum_mag_disk / n_disk
        b_est = np.log10(np.e) / (mean_mag_disk - (MC - DELTA_M / 2.0))
        b_est = np.clip(b_est, B_MIN, B_MAX)
        b_err = b_est / np.sqrt(n_disk)
    else:
        b_est, b_err = np.nan, np.nan

    b_values.append(b_est)
    b_errors.append(b_err)

h3_summary['b_value'] = b_values
h3_summary['b_std_error'] = b_errors
h3_summary['b_estimated'] = h3_summary['b_value'].notna()
h3_summary['b_value_imputed'] = h3_summary['b_value'].fillna(national_b)
h3_summary['b_reliable'] = h3_summary['b_std_error'] <= 0.1

print(f"Cells with measured b: {h3_summary['b_estimated'].sum():,} "
      f"({h3_summary['b_estimated'].mean():.1%})")
print(f"Cells with sigma_b <= 0.1: {h3_summary['b_reliable'].sum():,}")
```

### Step 7: Normalization, Entropy Weighting & SHI

```python
M_CEILING = 9.5   # largest instrumentally recorded magnitude; fixed reference

def min_max(series):
    lo, hi = series.min(), series.max()
    return (series - lo) / (hi - lo) if hi > lo else series * 0.0

# 1. Log-transformed density of above-Mc events (the one run-dependent channel)
h3_summary['log_events'] = np.log10(h3_summary['n_mc'] + 1.0)
h3_summary['n_norm'] = min_max(h3_summary['log_events'])
print(f"Run metadata for cross-resolution comparison: "
      f"L_min={h3_summary['log_events'].min():.4f}, L_max={h3_summary['log_events'].max():.4f}")

# 2. Shrunk shallow ratio, already bounded [0, 1]
h3_summary['s_norm'] = h3_summary['shallow_ratio']

# 3. Inverted stress factor on the fixed clipping domain, not the empirical range
h3_summary['b_inv'] = 1.0 - (h3_summary['b_value_imputed'] - B_MIN) / (B_MAX - B_MIN)

# 4. Max magnitude against the fixed interval [Mc, 9.5]
h3_summary['m_norm'] = ((h3_summary['max_magnitude'] - MC) / (M_CEILING - MC)).clip(0.0, 1.0)

CHANNELS = ['n_norm', 's_norm', 'b_inv', 'm_norm']

def entropy_weights(X):
    """Shannon entropy weights. Low dispersion -> high entropy -> low weight."""
    P = X / X.sum(axis=0)
    logP = np.zeros_like(P)                  # pre-zeroed, so the 0*ln0 = 0
    np.log(P, out=logP, where=P > 0)         # convention needs no special-casing
    E = -(P * logP).sum(axis=0) / np.log(len(X))
    d = 1.0 - E
    return d / d.sum()

X = h3_summary[CHANNELS].to_numpy(dtype=float)
w_equal = np.full(4, 0.25)
w_entropy = entropy_weights(X)

print("\nWeight comparison")
for name, we, wh in zip(CHANNELS, w_equal, w_entropy):
    print(f"  {name:8s}  equal={we:.3f}  entropy={wh:.3f}")

# Channel correlation: m_norm and n_norm are coupled by construction
print("\nChannel correlation matrix")
print(h3_summary[CHANNELS].corr().round(3))

# Baseline index is equal-weight; entropy variant retained for sensitivity analysis.
# No post-normalization: each channel is already in [0,1] and the weights sum to 1.
h3_summary['shi'] = X @ w_equal
h3_summary['shi_entropy'] = X @ w_entropy
h3_summary['shi_rank_pct'] = h3_summary['shi'].rank(pct=True)

# right=False gives left-closed intervals [lo, hi), matching the Section 3.3 table.
# pd.cut defaults to right=True, which would put SHI exactly 0.25 in Low and 0.50 in
# Moderate, one tier below what the table states. The top edge is inf so that SHI = 1.0
# lands in Very High rather than falling outside the bins as NaN.
TIER_EDGES = [0.0, 0.25, 0.50, 0.75, np.inf]
MAP_BINS   = [0.0, 0.25, 0.50, 0.75, 1.0]      # folium needs finite edges
labels = ['Low', 'Moderate', 'High', 'Very High']

h3_summary['hazard_level'] = pd.cut(
    h3_summary['shi'], bins=TIER_EDGES, labels=labels, right=False
).astype(str)   # str, not Categorical: the GeoJSON driver rejects categorical dtypes

print(f"\nSHI range: [{h3_summary['shi'].min():.4f}, {h3_summary['shi'].max():.4f}]")
print(h3_summary['hazard_level'].value_counts())

# Rank agreement between weighting schemes, for the sensitivity section
print(f"\nSpearman rho (equal vs entropy): "
      f"{h3_summary['shi'].corr(h3_summary['shi_entropy'], method='spearman'):.4f}")
```

### Step 8: Validation Cell

Place this directly after Step 7. It fails the notebook loudly rather than exporting a quietly broken index.

```python
s = h3_summary

assert s['shi'].between(0.0, 1.0).all(),            "SHI outside [0,1]"
assert s['shi'].notna().all(),                      "NaN in SHI"
assert s['total_events'].ge(MIN_CELL_EVENTS).all(), "cell below inclusion threshold survived"
assert s['b_value_imputed'].between(B_MIN, B_MAX).all(), "b outside clipping domain"
assert s[CHANNELS].apply(lambda c: c.between(0, 1).all()).all(), "sub-index outside [0,1]"
assert np.isclose(w_entropy.sum(), 1.0),            "entropy weights do not sum to 1"
assert s['shallow_ratio'].between(0.0, 1.0).all(),  "shrunk shallow ratio out of bounds"
assert s['hazard_level'].ne('nan').all(),           "unbinned SHI value"

# Tier boundaries are left-closed, as published
assert s.loc[s['shi'] < 0.25, 'hazard_level'].eq('Low').all()
assert s.loc[s['shi'].between(0.25, 0.50, inclusive='left'), 'hazard_level'].eq('Moderate').all()
assert s.loc[s['shi'].between(0.50, 0.75, inclusive='left'), 'hazard_level'].eq('High').all()
assert s.loc[s['shi'] >= 0.75, 'hazard_level'].eq('Very High').all()

# The v2.0 failure mode: a near-empty cell riding an imputed b and an unshrunk
# shallow ratio into the High tier. A cell with no above-Mc events has max_magnitude
# < Mc, so m_norm clips to 0 and n_norm is 0, leaving SHI = 0.25*(S + b_inv) <= 0.45
# for any plausible national_b. If this fires, national_b has collapsed toward 0.5
# and the catalog needs checking, which is worth halting for.
empty_mc = s[s['n_mc'] == 0]
assert empty_mc['shi'].lt(0.50).all(), \
    f"{empty_mc['shi'].ge(0.50).sum()} cells with no above-Mc events reached High"

# Not an error, but read the list before trusting the Top-20: sparse cells whose
# b was imputed yet still score High on the strength of a single large event.
watch = s[(s['total_events'] < 20) & (~s['b_estimated']) & (s['shi'] >= 0.50)]
if len(watch):
    print(f"NOTE: {len(watch)} sparse cells with imputed b scored High. Inspect:")
    print(watch[['h3_index', 'total_events', 'n_mc', 'max_magnitude', 'shi']].to_string(index=False))

print(f"All checks passed on {len(s):,} cells.")
```

### Step 9: GeoJSON Synthesis & Administrative Spatial Join

```python
def cell_to_polygon(cell):
    boundary = h3.cell_to_boundary(cell)
    return Polygon([[p[1], p[0]] for p in boundary])   # GeoJSON wants (lon, lat)

centroids = [h3.cell_to_latlng(c) for c in h3_summary['h3_index']]
h3_summary['centroid_lat'] = [c[0] for c in centroids]
h3_summary['centroid_lon'] = [c[1] for c in centroids]

h3_summary['geometry'] = h3_summary['h3_index'].apply(cell_to_polygon)
gdf_h3 = gpd.GeoDataFrame(h3_summary, geometry='geometry', crs="EPSG:4326")

output_geojson = "indonesia_seismic_hazard_h3_res5.geojson"
gdf_h3.to_file(output_geojson, driver="GeoJSON")
print(f"Exported {len(gdf_h3):,} cells to {output_geojson}")
```

```python
# Administrative attribution. Because the spatial filter is a bounding box, a large
# share of high-hazard cells sit offshore over the Sunda trench and intersect no
# province. Those are labelled with the nearest province and marked offshore, rather
# than left as NaN or silently presented as being on land.
# ADM_PATH is resolved in Step 1 by the same pattern search as the catalog, and is None
# when no boundary file is present. The os.path.isfile() filter there is load-bearing:
# extracting the GADM download commonly produces a DIRECTORY named
# "gadm41_IDN_1.json" holding a file of the same name. The glob pattern matches that
# directory too, os.path.exists() returns True for it, and gpd.read_file() then fails
# on a directory instead of skipping cleanly.
gdf_adm = gpd.read_file(ADM_PATH)
assert 'NAME_1' in gdf_adm.columns, f"{ADM_PATH} is not GADM level 1"
gdf_adm = gdf_adm[['NAME_1', 'geometry']].rename(columns={'NAME_1': 'province'})

top20 = gdf_h3.nlargest(20, 'shi').copy()

# A res-5 hexagon covers ~253 km2 and can still straddle a provincial border, so
# intersects can return several rows per cell. Keeping the first picks an arbitrary one;
# note in the report that these cells span provinces rather than belong to one.
onshore = gpd.sjoin(top20, gdf_adm, how='inner', predicate='intersects')
onshore['n_provinces'] = onshore.groupby('h3_index')['province'].transform('size')
onshore['location_type'] = 'onshore'
onshore = onshore.drop(columns='index_right').drop_duplicates(subset='h3_index')

offshore = top20[~top20['h3_index'].isin(onshore['h3_index'])].copy()
if len(offshore):
    # Nearest join needs a projected CRS; EPSG:3857 is adequate for ranking by proximity
    nearest = gpd.sjoin_nearest(
        offshore.to_crs(3857), gdf_adm.to_crs(3857), how='left'
    ).to_crs(4326).drop(columns='index_right').drop_duplicates(subset='h3_index')
    nearest['location_type'] = 'offshore (nearest province)'
    top20_adm = pd.concat([onshore, nearest])
else:
    top20_adm = onshore

top20_adm = top20_adm.sort_values('shi', ascending=False)
print(f"Top-20 composition: {top20_adm['location_type'].value_counts().to_dict()}")

REPORT_COLS = ['h3_index', 'province', 'location_type', 'n_provinces',
               'centroid_lat', 'centroid_lon',
               'total_events', 'n_mc', 'shallow_ratio', 'max_magnitude',
               'b_value_imputed', 'b_estimated', 'b_reliable', 'shi', 'shi_rank_pct',
               'hazard_level']
top20_adm[REPORT_COLS].to_csv("top_20_critical_hexagons.csv", index=False)
```

### Step 10: Interactive Choropleth Map

```python
m = folium.Map(location=[-2.5, 118.0], zoom_start=5, tiles='CartoDB dark_matter')

folium.Choropleth(
    geo_data=output_geojson,
    name="Seismic Hazard Index",
    data=h3_summary,
    columns=["h3_index", "shi"],
    key_on="feature.properties.h3_index",
    fill_color="YlOrRd",
    # Same breaks as the risk tier table, so colours and labels cannot disagree.
    # Folium's default is quantile binning, which would contradict the tiers.
    bins=MAP_BINS,
    fill_opacity=0.75,
    line_opacity=0.25,
    legend_name="Seismic Hazard Index (SHI)"
).add_to(m)

style_function = lambda x: {
    'fillColor': '#ffffff', 'color': '#000000', 'fillOpacity': 0.05, 'weight': 0.2
}
highlight_function = lambda x: {
    'fillColor': '#00ffff', 'color': '#ffffff', 'fillOpacity': 0.4, 'weight': 1.5
}

tooltip = folium.features.GeoJson(
    output_geojson,
    style_function=style_function,
    control=False,
    highlight_function=highlight_function,
    tooltip=folium.features.GeoJsonTooltip(
        fields=['h3_index', 'n_mc', 'max_magnitude', 'b_value_imputed',
                'b_estimated', 'shi', 'hazard_level'],
        aliases=['H3 Index:', 'Events (>=Mc):', 'Max Mag:', 'b-value (1-ring):',
                 'b measured:', 'SHI:', 'Risk Class:'],
        style="background-color: #1e1e1e; color: #ffffff; font-family: monospace; "
              "font-size: 11px; padding: 8px; border-radius: 4px;"
    )
)

m.add_child(tooltip)
folium.LayerControl().add_to(m)
m.save("indonesia_seismic_hazard_map.html")
print("Interactive map saved to indonesia_seismic_hazard_map.html")
```

Note on cost: this loads the same GeoJSON twice, once for the fill and once for the hover layer. With a few thousand hexagons the HTML runs to tens of megabytes and is the slowest cell in the notebook. If it becomes unworkable, drop the tooltip layer and keep the choropleth, or restrict the tooltip layer to cells with `shi >= 0.5`.

---

## 5. Blueprint for Deliverables

### 5.1 Jupyter Notebook Structure (`.ipynb`)

1. **Title & Problem Statement:** Theoretical limitation of isotropic clustering ($k$-means, DBSCAN) versus Discrete Global Grid Systems for linear and curvilinear tectonic belts.
2. **Environment & Ingestion:** Dependency checks including the `h3>=4` assertion, schema validation, timestamp column resolution.
3. **Data Quality Audit & Filtering:** Pre- and post-filtering counts, missing value handling, temporal filtering ($\ge 1960$), depth range rejection, default-depth (10 km) share, magnitude-scale homogeneity check, non-declustered catalog rationale.
4. **H3 Transformation & Spatial Binning:** Index assignment at Resolution 5, validation of spatial coverage, cell count before and after the $N_{\min}$ inclusion filter.
5. **Completeness Magnitude:** MAXC estimate, frequency-magnitude distribution plot with both the MAXC and operating $M_c$ marked, and the justification for the operating value.
6. **Seismological Computations:** 1-ring `grid_disk` Aki-Utsu MLE $b$-value, standard error $\sigma_b$, domain clipping $[0.5, 2.0]$, fallback imputation with the `b_estimated` flag, and the `b_reliable` count.
7. **Hazard Index Synthesis:** Log-density scaling on above-$M_c$ counts, shrunk shallow ratio, fixed-domain $B_{\text{inv}}$ and $M_{\text{norm}}$, equal versus entropy weights, channel correlation matrix, absolute tier assignment.
8. **Validation Cell:** The assertion block from Step 8. Must run before any export.
9. **Sensitivity Analysis:** Three checks, each one table or one plot.
   * $N_{\min} \in \{5, 10, 20\}$: effect on retained cell count and on Top-20 membership.
   * Equal versus entropy weights: Spearman rank correlation and Top-20 overlap.
   * Default depth: $S$ from all events versus from known-depth events only, with Top-20 overlap and the `default_depth_share` of each baseline Top-20 cell.
   * H3 resolution $\in \{4, 5, 6\}$: because the SHI is now absolute in three of four channels, values are comparable across these runs once $L_{\min}$ and $L_{\max}$ are reported.
10. **Spatial Visualization:** Static side-by-side plots (log event density, $b$-value field, composite SHI) plus the embedded Folium choropleth.
11. **Run Summary File:** Section 12 writes every figure the report and the paper need to `h3shi_review.txt`, so a run can be read, compared against another run, or handed to someone else without opening a multi-megabyte `.ipynb`.
12. **Top 20 Critical Hexagons & Administrative Overlay:** Tabular export with centroid coordinates, province attribution separated into onshore and offshore-nearest, `b_estimated` and `b_reliable` flags, and the dominant risk driver per cell (the channel contributing most to its SHI).

### 5.2 Technical Report & Academic Paper Structure (IMRaD)

1. **Introduction:** Geodynamic context of the Sunda megathrust, Banda Arc, and strike-slip systems (Great Sumatran, Palu-Koro fault); geometric distortion of conventional point-pattern clustering.
2. **Methodology:** H3 DGGS topological properties, 1-ring smoothing rationale and why it is applied only to the $b$-value channel, Aki-Utsu MLE, MAXC completeness estimation, logarithmic density dampening, fixed-domain normalization, shrinkage estimator for the shallow ratio, entropy weighting formulation.
3. **Results:** Spatial distribution of low $b$-values (high shear stress anomalies), high-risk cluster identification, catalog statistical summaries, observed SHI range and tier distribution, weight sensitivity.
   Report the reference-event validation as a table of its own: a hazard index that cannot account for where the Sunda megathrust lands is not yet defensible, and the structural limit in Section 12 of the notebook shows that a single great rupture cannot reach the top rank under equal weights.
4. **Discussion:**
   * Spatial-pattern comparison against official Indonesian hazard maps (PusGen), framed as pattern agreement rather than numerical validation (Section 1.1).
   * Why aftershock-rich regions can score *lower* on the stress channel, and what that implies for using $b$ as a hazard proxy on a non-declustered catalog (Section 3.2).
   * Correlation between $N_{\text{norm}}$ and $M_{\text{norm}}$, and how entropy weighting addresses it.
   * Network-density confounding: whether the $M_c$ threshold fully removes the eastern Indonesia detection gap.
   * Declustering (Gardner-Knopoff, Reasenberg) as future work.
   * Multi-resolution sensitivity results.

---

## 6. Execution Verification Checklist

1. [ ] Notebook runs end-to-end via `Runtime -> Restart and Run All` with zero errors and zero Pandas deprecation warnings.
2. [ ] Step 8 validation cell passes, including the sparse-imputed-cell guard.
3. [ ] H3 assignment and groupby aggregation complete in $< 5$ s on $\approx 322$k rows.
4. [ ] GeoJSON export and Folium rendering complete within Colab RAM. These are the slow steps, not the aggregation; record the wall time for each.
5. [ ] `indonesia_seismic_hazard_h3_res5.geojson` reopens cleanly in GeoPandas with all flag columns intact.
6. [ ] Map legend breaks match the risk tier table exactly (0.25 / 0.50 / 0.75).
7. [ ] Folium map renders with no blank tiles and no broken polygon references. Open the saved HTML and confirm the basemap draws: a tile provider that has moved behind an API key still answers 200 and fails silently, showing placeholder tiles instead of a map.
8. [ ] Every cell in the Top-20 table carries a province label and an onshore/offshore marker; none is NaN.
9. [ ] `b_estimated` is visible in the tooltip and the Top-20 table, so imputed $b$-values are never read as measured.
10. [ ] Observed SHI range is reported honestly, including an empty **Very High** tier if that is the result.
11. [ ] $L_{\min}$ and $L_{\max}$ are recorded in the report, so the density channel can be rescaled for cross-resolution comparison.
12. [ ] The MAXC plot is included and the operating $M_c$ is argued against it, not merely stated.

---

## 7. Record of Corrections from v2.0

Kept for the report's methodology section, so reviewers can see which choices were deliberate.

| # | v2.0 behaviour | Problem | v2.1 |
| :-- | :--- | :--- | :--- |
| 1 | No minimum event count per cell | A cell with one shallow event scored $S = 1.0$; its unmeasurable $b$ was imputed at $b_{\text{national}} \approx 0.8$, scoring $B_{\text{inv}} \approx 0.8$. Composite $\approx 0.53$ placed near-empty cells in the **High** tier and risked filling the Top-20 with them. | $N_i \ge 10$ inclusion filter, $\kappa = 10$ shrinkage on the shallow ratio, `b_estimated` flag, and an assertion that catches the pattern directly. |
| 2 | Final min-max rescale of the composite | Forced exactly one cell to 0.0 and one to 1.0, so tier counts were an artifact of normalization. SHI values were not comparable across resolutions or catalog vintages, which contradicted the planned multi-resolution sensitivity analysis. | Rescale removed. Composite is bounded by construction. `shi_rank_pct` carries relative ordering where that is what is needed. |
| 3 | `b_inv` and `m_norm` normalized on empirical min/max | One outlier cell rescaled every other cell, and no run was comparable to another. | Fixed reference domains: $[0.5, 2.0]$ for $b$, $[M_c, 9.5]$ for maximum magnitude. |
| 4 | Density from all events; $b$-value from events above $M_c$ | Mismatched event bases. Total counts measure seismograph network density as much as seismicity, biasing toward Java and Sumatra. | Both channels use the above-$M_c$ count. |
| 5 | `folium.Choropleth` with default binning | Quantile breaks contradicted the fixed 0.25/0.50/0.75 tier table; map and table told different stories. | `bins` set to the tier cut-offs. |
| 6 | `hazard_level` left as a pandas Categorical before `to_file` | Some pyogrio versions reject categorical dtypes on GeoJSON export. | Cast to `str`. |
| 7 | $M_c = 4.0$ hardcoded, described as "determination" | No supporting evidence; the most exposed assumption in any $b$-value study. | MAXC estimate plus frequency-magnitude plot; operating value stated and argued. |
| 8 | $\sigma_b$ computed and never used | Dead column. | `b_reliable` flag ($\sigma_b \le 0.1$), reported and carried into the Top-20 table. |
| 9 | Entropy weighting named as a deliverable, no formula and no code | Unimplementable as written. | Formula in Section 3.3, `entropy_weights` in Step 7, Spearman comparison against equal weights. |
| 10 | Administrative spatial join promised in the blueprint, absent from the code | Missing deliverable, and a naive `sjoin` would have returned NaN for the many offshore high-hazard cells. | Step 9 implements it, separating onshore intersection from offshore nearest-province attribution. |
| 11 | Comment claimed a pyarrow ingestion engine that was never passed | Comment contradicted the code. | Comment removed; `pyarrow` dropped from the dependency list. |
| 12 | `df['time']` hardcoded against a schema documenting `time` / `Date` | `KeyError` on any release using the other name. | Year source resolved at load time; see also item 17. |
| 13 | No depth validity filter | Negative and absurd depths passed through; default 10 km assignments silently inflated the shallow ratio. | Range filter $[0, 700]$ km and a reported share of events at exactly 10 km. |
| 14 | Code described as "vectorized" throughout | List comprehensions and a Python loop. A reviewer will ask. | Wording corrected; the loop is justified where it is cheap. |
| 15 | No executable check on any of the logic | A broken index would export silently. | Step 8 assertion cell, required before export by checklist item 2. |
| 16 | `pd.cut` called with its default `right=True` | Intervals were right-closed, so SHI exactly 0.25 was labelled **Low** and exactly 0.50 **Moderate**, one tier below what the Section 3.3 table states. Silent, and it only shows up on boundary values. | `right=False` with an infinite top edge, plus four boundary assertions in Step 8. |
| 17 | Schema documented from assumption, not from the file | The delivered catalog uses `Latitude` / `Longitude` / `Depth_km` / `Magnitude`, not the lowercase names the pipeline expected, and opens with a UTF-8 BOM. The notebook would have halted at the schema assertion on the first run. `Date` is also unparseable for pre-1900 rows. | Section 2.1 records the real schema; load-time `RENAME` map, `encoding="utf-8-sig"`, `low_memory=False`, and `Year` used directly as the year source. |
| 18 | `ADM_PATH` a bare relative string, guarded by `os.path.exists` | Extracting the GADM download produces a directory named `gadm41_IDN_1.json` containing a file of the same name. `os.path.exists` returns True for that directory, so `gpd.read_file` crashed on it rather than skipping the join. The bare relative path also could not reach a boundary file sitting in Drive under Colab. | Resolved in Step 1 by the same recursive pattern search as the catalog, filtered through `os.path.isfile`, accepting `.json` / `.geojson` / `.shp`, and reported up front so a missing file is known before the pipeline runs. |
| 19 | Resolution 5 documented as 1,570 km² with a 25 km edge | Those are Resolution 4's figures. Res 5 is 252.9 km² with an 8.5 km edge. The stated rationale for the resolution choice therefore argued for res 4, not res 5, and res 5 leaves 24% of cells on an imputed $b$. | Section 3.1 corrected with the measured table; the choice of res 5 is now stated as a continuity decision, with res 4 to be reported alongside. |
| 20 | `rows` reused by both sensitivity loops | Section 7.3 overwrote Section 7.1's results, so the $N_{\min}$ table was unrecoverable after the run and any later reference printed the resolution table instead. | Renamed to `rows_nmin` / `rows_res`, each kept as its own DataFrame and written to its own CSV. |
| 21 | `risk_driver` taken as `idxmax` of the raw channel values | It reported whichever channel has the highest national mean, not what distinguishes a cell. With mean $B_{	ext{inv}} = 0.85$ and mean $M_{	ext{norm}} = 0.21$, $B_{	ext{inv}}$ won 3,952 cells and $M_{	ext{norm}}$ won none at all, whatever the cell contained. | Computed from standardized scores, so it names the channel on which the cell most deviates from the national mean. |
| 22 | Default-depth contamination flagged but never quantified | 26.9 % of events carry a 10 km default depth and every one counted as shallow, yet nothing measured what the channel looks like without them. 14 of the 20 highest-ranked cells are driven by that channel. | Section 7.4 reruns the pipeline with $S$ from known-depth events only, reports Top-20 overlap and per-cell deltas, and adds `default_depth_share` to the Top-20 export. |
| 23 | Folium map embedded inline below a 20 MB threshold | The threshold measured the map FILE, not the notebook. `display(m)` wrote the 15.4 MB map into the `.ipynb` as cell output and the deliverable grew from 0.6 MB to 22.9 MB, which is slow to open, heavy to sync and will not render on GitHub. The map's value is its interactivity, which only works in a browser anyway. | Inline embedding removed. The map is saved as a file and the reader opens it; the static SHI panel in Section 8 is what goes into the report. |
| 24 | Run summary existed only as a cell pasted in by hand | On one run the paste was lost when a fresh notebook was uploaded, so that run produced no recoverable numbers at all. | Promoted to Section 12 of the notebook, so `Run all` always writes `h3shi_review.txt`, to Drive under Colab and beside the notebook locally. |
| 25 | A single default depth assumed at 10 km | The depth histogram from the executed run shows a second fixed-depth population at 35 km (10,429 events against a local background near 5,000), so the contamination was understated at 26.9 %. 33 km is the classic ISC/NEIC default and sits near its neighbours, making it a borderline case. | `DEFAULT_DEPTHS` is a tuple, and Section 2 prints a spike test comparing each candidate against its ±2 km neighbours so the list is auditable from the data rather than assumed. |
| 26 | Validation rested on inspecting the Top-20 | Showing which cells rank highest cannot show whether the index is sensible. The run's own Top-20 contains no Sumatra or Java cell and tops out at magnitude 7.2, which a reviewer will ask about immediately and the notebook had no answer for. | Section 12 scores six known events, reports whether the catalogue even holds their mainshock magnitude, names the channels holding each one back, and reports the 1-ring maximum so the result does not hinge on epicentre precision. |
| 27 | Basemap tiles taken from CartoDB `dark_matter` | Carto moved its basemaps behind an API key. Keyless requests still return HTTP 200, but the body is a placeholder tile reading "API KEY REQUIRED", so the failure is silent and the exported map loses its basemap entirely while the hexagons still draw. Verified by inspection: a Carto tile carries 16 unique colours, a real tile carries hundreds. | Switched to Esri World Dark Gray Base, which needs no key and has nearly the same mean luminance (43.5 against Carto's 40.1), with OpenStreetMap added as a second selectable layer. The `{z}/{y}/{x}` axis order ArcGIS requires was confirmed against an OSM tile for the same location. |
| 28 | OpenStreetMap added as a fallback basemap, and both tile layers drawn at once | Two problems at once. Folium draws every `TileLayer` it is given, so the one added last sits on top whatever the layer control says, and OSM was added last. OSM then answered 403 "Access blocked" for a local HTML file, because its usage policy refuses unidentified apps, and its block tile is opaque white, so it hid the working Esri layer underneath. | OSM dropped. The second base layer is Esri Light Gray with `show=False`, so exactly one basemap draws and the other is only reachable from the layer control. Twelve Esri tiles spanning Indonesia were checked: all 200, 140-372 unique colours. |
| 29 | Magnitude heterogeneity named as a caveat, never measured | The catalogue mixes 12 magnitude types and only 1,344 of 314k are true Mw. Section 12 showed the error scales with magnitude and tracks type, so the b-value field may partly map which agency reported what rather than tectonic stress. | Section 13 measures it: b per magnitude type, the spatial distribution of type composition and its correlation with b, a search for cross-type duplicate pairs, a partial homogenisation run with coverage reported, and a moment-magnitude-only bound. Arithmetic on the Section 12 pairs shows the Scordilis relations move the mean absolute error only from 0.617 to 0.595, so the section states plainly that generic conversion does not fix this catalogue and recommends patching large-event magnitudes from GCMT or USGS instead. |
| 30 | Homogenised run reused $M_c = 4.0$ on a rescaled magnitude axis | The mb relation maps 4.0 to 4.43, so holding $M_c$ fixed compares two different completeness levels. A GR simulation shows the threshold choice alone shifts $b$ by 0.038 and changes the above-threshold population by 122%, as large as the effect being measured, and its direction depends on the distribution rather than being predictable. | Section 13.5 re-estimates $M_c$ by MAXC on the converted scale and additionally prints a deliberately mismatched run so the trap is visible. Section 13.1 now reports the unclipped $b$ and flags types whose mean-minus-$M_c$ shows they are not complete at that threshold. |
| 31 | $M_c$ for the homogenised run re-estimated by MAXC | MAXC runs on the pooled catalogue, but only 20.8% of events are converted, so the mode is still set by the 79% that are not and MAXC returned the same value as before. The correction became a no-op and the "corrected" and "deliberately wrong" rows printed identically. | The threshold is now derived from the conversion relations themselves: each converted type maps $M_c$ to $aM_c + b$, and the global threshold takes the highest of those, giving 4.80. An assertion fails the cell if it does not exceed the original $M_c$. Raising $M_c$ from 4.0 to 4.80 leaves roughly 28% of events, which is itself the argument that generic conversion is a dead end here. |
| 32 | Output paths left relative | On Colab a relative path resolves to `/content`, the session folder, which is wiped when the runtime disconnects. The map, GeoJSON, five CSVs and three figures were therefore lost on every session end unless downloaded by hand; only the review file went to Drive. | A single `OUT_DIR` resolves to `MyDrive/h3shi_output` under Colab and to the notebook's own folder locally, and every write goes through an `out()` helper. |
| 33 | Latitude cut-off never tested against the 2004 rupture | The Aceh epicentre cell holds only 13 events, and the explanation offered was a guess. | Section 12.5 counts events in the 92-100E Sumatra-Andaman corridor by latitude band, directly from `df_raw`, and isolates the 2004-2005 sequence so the share falling above the 6N cut-off is measured rather than assumed. |
| 34 | A single absolute tier scale | Fixed 0.25/0.50/0.75 cut-offs are correct as a statement of hazard level, but with all of Indonesia tectonically active most cells pile into one tier, which is useless for deciding what to address first. | A second `hazard_quartile` column derived from `shi_rank_pct` is reported beside the absolute tier. The two answer different questions and are presented together, not as a replacement. |
| 35 | Homogenisation comparison changed two things at once | Comparing original@Mc 4.0 against homogenised@Mc 4.80 moves both the magnitude scale and the completeness threshold, so neither effect could be read on its own. | A fourth run, original@Mc 4.80, splits them: Top-20 overlap is now reported for threshold-only, conversion-only, and both together. |
| 36 | Two new diagnostics printed only to the notebook | Section 12.5's latitude test and Section 13.5's three-way Top-20 breakdown were never written to `h3shi_review.txt`, so the run that produced them left no recoverable record of either. | Both are now included in the review file. The rule this follows: a diagnostic that is not in the review file did not happen, because the notebook's own output is not what gets read back. |
