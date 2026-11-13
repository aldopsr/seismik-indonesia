# Tempel sebagai cell BARU di paling bawah notebook Colab, lalu jalankan.
#
# Syarat: notebook sudah Run all sampai selesai di sesi yang masih hidup, karena cell
# ini membaca variabel yang sudah ada di memori. Kalau sesinya sudah mati, Run all dulu.
#
# Hasilnya ditulis sebagai file teks kecil di Drive, supaya bisa dibaca dari luar Colab,
# sekaligus dicetak di bawah cell kalau mau langsung di-copy.

REVIEW_PATH = "/content/drive/MyDrive/h3shi_review.txt"

lines = []
def w(s=""):
    lines.append(str(s))

w("== KONFIGURASI ==")
w(f"CSV_PATH    : {CSV_PATH}")
w(f"ADM_PATH    : {ADM_PATH}")
w(f"record      : {len(df_raw):,} -> {len(df):,}")
w(f"periode     : {df['year'].min():.0f}-{df['year'].max():.0f}")
w(f"Mc          : {MC}  (MAXC {mc_maxc:.2f})")
w(f"resolusi    : {META['h3_res']}")
w(f"N_min       : {META['min_cell_events']}")
w(f"sel         : {META['cells_kept']:,} / {META['cells_total']:,}")
w(f"national_b  : {META['national_b']:.4f}")
w(f"p_shallow   : {META['p_shallow_national']:.4f}")
w(f"L_min/L_max : {META['L_min']:.4f} / {META['L_max']:.4f}")
w(f"b terukur   : {h3_summary['b_estimated'].mean():.1%}")
w(f"b andal     : {h3_summary['b_reliable'].mean():.1%}")
w(f"depth 10 km : {fixed_depth_share:.2%}")
w()
w("== NILAI KEDALAMAN TERSERING ==")
w(df["depth"].value_counts().head(10).to_string())

w()
w("== AUDIT PENYARINGAN ==")
w(audit.to_string(index=False))

w()
w("== MAGNITUDE TYPE ==")
_mt = [c for c in df_raw.columns if c.lower() in ("magnitude type", "magnitude_type")]
if _mt:
    w(df_raw[_mt[0]].value_counts(dropna=False).head(12).to_string())
else:
    w("(kolom tidak ada)")

w()
w("== BOBOT KANAL ==")
for n, we, wh in zip(CHANNELS, META["w_equal"], META["w_entropy"]):
    w(f"{n:8s} equal={we:.4f} entropy={wh:.4f} std={h3_summary[n].std():.4f} "
      f"mean={h3_summary[n].mean():.4f}")

w()
w("== KORELASI KANAL ==")
w(h3_summary[CHANNELS].corr().round(3).to_string())

w()
w("== SHI ==")
w(f"range equal   : [{h3_summary['shi'].min():.4f}, {h3_summary['shi'].max():.4f}]")
w(f"range entropy : [{h3_summary['shi_entropy'].min():.4f}, {h3_summary['shi_entropy'].max():.4f}]")
w(f"mean / median : {h3_summary['shi'].mean():.4f} / {h3_summary['shi'].median():.4f}")
w(f"spearman rho  : {h3_summary['shi'].corr(h3_summary['shi_entropy'], method='spearman'):.4f}")
w(h3_summary["hazard_level"].value_counts().reindex(TIER_LABELS, fill_value=0).to_string())

w()
w("== PEMICU RISIKO DOMINAN ==")
w(h3_summary["risk_driver"].value_counts().to_string())

w()
w("== DISTRIBUSI b TERUKUR ==")
_m = h3_summary[h3_summary["b_estimated"]]["b_value"]
w(_m.describe().round(4).to_string())
w(f"sel di batas bawah 0,5 : {(_m <= 0.5).sum():,}")
w(f"sel di batas atas 2,0  : {(_m >= 2.0).sum():,}")

w()
w("== TOP 20 ==")
w(top20_out[["h3_index", "province", "location_type", "total_events", "n_mc",
             "max_magnitude", "b_value_imputed", "b_estimated", "b_reliable",
             "shi", "hazard_level", "risk_driver"]].round(4).to_string(index=False))

w()
w("== SENSITIVITAS N_min ==")
w(nmin_table.to_string(index=False))

w()
w("== SENSITIVITAS RESOLUSI ==")
w(res_table.to_string(index=False))

w()
w("== SENSITIVITAS KEDALAMAN DEFAULT ==")
w(dd_table.to_string(index=False))
w(f"mean s_norm : {h3_summary['s_norm'].mean():.4f} -> {s_dd['s_norm'].mean():.4f}")
w(f"mean shi    : {h3_summary['shi'].mean():.4f} -> {s_dd['shi'].mean():.4f}")
w(f"overlap top20 : {len(top20_base & top20_dd)}/20")
w()
w(dd_check.round(4).to_string(index=False))

w()
w("== FILE OUTPUT ==")
for f in (OUT_GEOJSON, OUT_MAP, "top_20_critical_hexagons.csv",
          "sensitivity_nmin.csv", "sensitivity_resolution.csv",
          "sensitivity_default_depth.csv"):
    w(f"{f:<50} {os.path.getsize(f)/1e6:.2f} MB" if os.path.exists(f)
      else f"{f:<50} TIDAK ADA")

text = "\n".join(lines)
with open(REVIEW_PATH, "w", encoding="utf-8") as fh:
    fh.write(text)

print(f"Ditulis ke {REVIEW_PATH}  ({len(text):,} karakter)\n")
print(text)
