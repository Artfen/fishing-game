> Research notes behind `docs/WATER.md`, kept as they were written (17 Nov 2026) so each recommendation can be traced to its source. Claims are marked by how far they were checked; nothing here is code taken from anywhere. Ideas from repositories whose licences don't allow reuse are used as ideas only.

# What the best real-time oceans do that this game doesn't yet

Research notes, 17 Nov 2026. Scope: a three.js / WebGL2 fishing and boating game that has to run on phones and offline, with no paid assets or services. The goal is a ranked list of techniques from the best real-time ocean renderers, judged by visible impact per unit of browser and mobile cost.

## Method and caveats

- I downloaded and read these primary sources as text: the Atlas GDC 2019 slides, the Sea of Thieves SIGGRAPH 2018 talk paper, Bruneton et al. 2010, Horvath 2015, Dupuy & Bruneton 2012, the Crest SIGGRAPH 2017 and 2019 decks (including speaker notes), the War Thunder ocean talk (CGDC 2015), the Uncharted GDC 2012 slides, the Arc Blanc (2025) arXiv paper, and the Crest, Unity HDRP and Unreal docs. Formulas quoted below come from those texts. Where I say "estimate", I have no measurement behind it.
- I checked licences by fetching each repository's own LICENSE file from raw.githubusercontent.com (default branch, HEAD) on 17 Nov 2026. github.com HTML pages and the GitHub API were blocked in this session. For two repos I listed files by shallow `git clone --no-checkout` to look for licence headers.
- **Not found or not retrieved:** I found no dedicated ocean or water rendering talk for Ghost of Tsushima or Just Cause. The only Ghost of Tsushima water description I found was a forum post, which I don't count as a source. An Assassin's Creed III talk exists ("Rendering Assassin's Creed III", Jean-François St-Amour, GDC 2013, which covers ocean rendering), but I couldn't retrieve its slides, so nothing below relies on it. The Black Flag material I found was marketing.
- **No phone measurements.** All mobile costs are reasoned estimates, flagged as such. Benchmark on real devices before committing.

## What the game does today (read-only look at `src/world/water.js`, `ocean.js`, `oceangpu.js`, `sky.js`, `waterfx.js`, `quality.js`)

These details matter for the gaps below.

- **Long wind-sea band:** CPU FFT, N=64 over 140 m (2.19 m cells), handing over to the short band at k = 2π/8.5 to 2π/6. It is laid twice, the second copy turned and shifted. Updated at 20 Hz.
- **Short band** (GPU, "Full" mode only): N=128 over **23.7 m**, so cells are 0.185 m and the finest resolved wavelength is **about 0.37 m**, not centimetres. Below that the shader uses procedural `ngrad` noise ("ruffle"), faded with distance. The textures are mipmapped "so far off they blur rather than glitter".
- **Sun:** a Phong-like lobe, `pow(dot(R,L), mix(220,45,rough))`, where `rough = smoothstep(25,260,dist)` is a distance heuristic. Sparkle comes from procedural hash-cell glints.
- **Fresnel:** `0.035 + 0.66·(1−N·V)^4`, an ad-hoc curve rather than Schlick with F0 = 0.02.
- **Sky in the reflection:** a two-colour gradient `mix(uHorizon, uZenith, R.y*1.5)`, plus a planar mirror render at the higher graphics settings. `reflection: 0` means "sky colours only". So on Low and on phones the sea reflects no sunset glow, no sun-side horizon warmth and no clouds.
- **Water body:** artist colours (shallow, mid, deep) mixed by **vertical** depth from the heightmap, then scalar alpha blending. There is no refraction distortion and no per-wavelength absorption along the view path.
- **Fog:** height-dependent exponential fog in one colour. It is not sun-aware, though the sky dome does have a sun-side horizon glow.
- **Mesh:** a snapped clipmap near sheet, then a flat `RingGeometry` out to 6 km with no waves.
- **Interaction and lighting:** ripples are drawn analytic packets (`RippleField`), not a simulation, and wakes are analytic. The water shader has no shadow-map lookup. Antialiasing is MSAA (`antialias:true`), with ACES tone mapping and bloom.

---

## Ranked recommendations (visible impact per cost)

### 1. Slope-variance ocean BRDF: correct sun glitter, sky sheen and horizon at every distance

**What it is.** Treat the waves too small to see in a pixel statistically. Each pixel keeps the slope **variance** of everything filtered out (by mipmaps, distance fades or the band cut) and shades with an anisotropic Gaussian (Beckmann) microfacet BRDF with Smith masking. This is the Ross BRDF in Bruneton 2010; LEAN mapping and the moment maps in Atlas are the same idea. Details filtered out of the geometry are put back into the BRDF, so the image keeps the same energy and no wave detail "disappears" with distance.

**Visible difference.**
- **Low sun and sunset:** the glitter path becomes the real tall column. Its width follows the wind; it is narrow and mirror-like in calm, wide and broken in a breeze, and it widens correctly with distance.
- **Distance:** the far sea gets the correct sheen and horizon brightness instead of turning into a mirror (from blurred mipmaps) or a uniformly rough surface (from the heuristic).
- **Calm versus storm:** a calm sea is bright at the horizon; a rough sea has a darker horizon band, because the average Fresnel falls as roughness rises.
- **Close up:** shimmer and specular aliasing go away.

**Key formulas.**
- **Slope moments:** store E[sx], E[sz], E[sx²], E[sz²] and E[sx·sz] (mipmapped). Then σ²x = E[sx²] − E[sx]², and similarly for z and the covariance. Atlas sums moments across bands with E[x²] = E1[x²] + E2[x²] + 2·E1[x]·E2[x].
- **Bilinear magnification is not a linear operator** (Atlas fix): E_new[x²] = lerp(E[x]², E[x²], clamp(0.25·mip, 0, 1)). Atlas also fades each band's displacement from about 30 world-space periods from the camera.
- **Unresolved variance:** σ²_unres = σ²_total(wind) − σ²_resolved. Bruneton computes the total on the CPU from the spectrum. A practical stand-in is Cox & Munk 1954 for a clean sea, with U in m/s at 12.5 m:
  - σ²_up = 3.16e-3·U
  - σ²_cross = 0.003 + 1.92e-3·U
  - σ²_total = 0.003 + 5.12e-3·U ± 0.004
  - The upwind variance can be about twice the crosswind, so the distribution is anisotropic and aligned with the wind.
  - In this game, also add the variance of the procedural `ngrad` layers wherever they are faded out.
- **Sun term** (Bruneton/Dupuy shader, `reflectedSunRadiance`): `p = exp(−½(ζx²/σx² + ζy²/σy²)) / (2π σx σy)`, `F = 0.02 + 0.98(1−V·H)^5`, then `I_sun = L_sun · F · p / (4 · zV · zH⁴ · (1 + Λ(L) + Λ(V)))`. Smith Λ uses an erfc approximation. Clamp σ² to a minimum for the sun's angular size. Sea of Thieves instead uses a sphere-light "closest point" area specular (Karis 2013) for the big low sun.
- **Mean Fresnel over the rough surface** (Bruneton eq. 26, also in Atlas): `F̄ = R + (1−R)·(1−cosθv)^(5·exp(−2.69σv)) / (1 + 22.7·σv^1.5)`, with R = 0.02 and σv² = σx²cos²φv + σy²sin²φv.
- **Sky term:** `I_sky = F̄ · L_sky` filtered by an ellipse of axes 2σx and 2σy (`texture2DGrad`, or a mip level chosen from σ). The light from inside the water is `(1−F̄)·L_sea`.

**Sources.**
- Bruneton, Neyret & Holzschuch 2010, CGF 29(2): https://hal.science/inria-00443630v3. Reports 52 fps on an 8800 GTS at 1024×768, and that a manual 9-tap anisotropic filter costs about 2.5 ms on that GPU.
- Shader code (BSD-3, INRIA): `ocean.glsl` in https://github.com/jdupuy/whitecaps.
- Atlas GDC 2019 (Mihelich & Tcheblokov): https://gpuopen.com/gdc-presentations/2019/gdc-2019-agtd6-interactive-water-simulation-in-atlas.pdf
- LEAN mapping, Olano & Baker 2010: https://www.csee.umbc.edu/~olano/papers/lean/
- Cox & Munk 1954, via Mobley's Ocean Optics Web Book: https://oceanopticsbook.info/view/surfaces/cox-munk-sea-surface-slope-statistics
- Sea of Thieves: https://history.siggraph.org/wp-content/uploads/2022/09/2018-Talks-Ang_The-Technical-Art-of-Sea-of-Thieves.pdf
- Noniv/web-ocean (MIT) does LEAN moments and a roughness-filtered environment map in WebGPU.
- Unity HDRP itself only fades smoothness over a distance range, which is a heuristic close to the game's present approach.

**Cost (browser and mobile).** Low.
- One extra RGBA16F target (x², z², xz) for the GPU short band, written in the same pass as the slopes (MRT), plus its mips: 128² × 8 B, which is trivial. The CPU long band adds three floats per cell to an existing upload.
- Shader: roughly 30–50 extra ALU operations and 2–3 `exp` calls per water pixel. Replace the `atan` calls in the reference code with dot-product forms.
- A good fit for phones because it *replaces* the hash-glint and distance-heuristic code. Estimate: under 0.3 ms at 1080p on a mid-range phone.

**Optional extra.** Keep sparkle at middle distance with stochastic glints whose probability follows the same D(h), for example Deliot & Belcour 2023 (CGF 42(8), https://diglib.eg.org/handle/10.1111/cgf14866). That costs more; I'd only try it on desktop.

### 2. Reflect the real sky (sun-side glow, sunset colours, clouds) instead of a two-colour gradient

**What it is.** Give the water the same sky radiance the dome shows. Either:
- **(a)** evaluate the sky dome's own function at the reflected direction R, widening the sun-glow lobe by σ from item 1; or
- **(b)** render the dome, plus far hills and clouds if wanted, into a small cube map (32–64 px faces) every few seconds, prefilter it (three.js `PMREMGenerator`, or manual mips), and sample with LOD from σ. Bruneton uses a stereographic 2D sky map, `u = r.xy/(1+r.z)`, sampled with `texture2DGrad` over the slope ellipse. web-ocean rebuilds a cube map every frame with roughness mips, and tilts the reflected direction at grazing angles towards the facets you can actually see.

**Visible difference.** Sunrise and sunset: the sea turns orange and pink toward the sun and blue-violet away from it. In overcast or stormy weather the sea takes the grey of the sky. Cloud reflections appear in calm water even on Low quality and phones, where the planar mirror is off. Biggest at dawn and dusk; noticeable all day at grazing angles.

**Formulas.** As in item 1: `I_sky = F̄ · L_sky(R, σ)`. Below-horizon reflected rays: Bruneton approximates them as average Fresnel × sky irradiance.

**Sources.** Bruneton 2010 §5.2; web-ocean README (MIT): https://github.com/Noniv/web-ocean; three.js PMREMGenerator and CubeCamera (MIT).

**Cost.** Very low. Option (a) is ALU only. Option (b) costs a few ms on a phone each time the map is rebuilt, which can be spread over frames (one face per frame), plus one texture fetch per pixel.

### 3. Sun-aware haze, and a horizon where sea and sky meet without a seam

**What it is.**
- **Fog colour depends on the angle to the sun:** `fogColor = mix(hazeColor, sunHazeColor, pow(max(dot(rd, sunDir), 0), 8))`.
- **Split extinction from in-scatter, per channel:** `final = col·exp(−d·be) + fogCol·(1 − exp(−d·bi))`. Blue in-scatter and red extinction give natural aerial perspective.
- **Make the far sea converge to the sky's horizon colour** times the mean Fresnel of item 1. Without this you get the common "darker band of sea under a bright horizon", which web-ocean lists as a known limitation of its own renderer.
- **Extend the flat far ring.** The horizon is about 3.57·√h km away for an eye h metres up: 5 km at 2 m, 11 km at 10 m, 36 km from 100 m. The current 6 km ring can end before the horizon when seen from cliffs or hills.
- A fuller treatment is Hillaire's sky and aerial-perspective lookup tables (sebh/UnrealEngineSkyAtmosphere, MIT; web-ocean follows this approach).

**Visible difference.** At distance, at sunset and in hazy mornings, the sun-side haze glows and distant headlands sink into warm or blue air instead of one flat grey.

**Sources.** Íñigo Quílez, "Fog": https://iquilezles.org/articles/fog/ (an article, not a licensed code drop; re-implement it, it's three lines). Hillaire 2020 implementation: https://github.com/sebh/UnrealEngineSkyAtmosphere (MIT, Epic Games).

**Cost.** Negligible: a few ALU operations in the shared `fog_fragment` chunk the game already overrides in `sky.js`. Extending the ring is a few hundred triangles.

### 4. Foam that holds up at distance, persists properly and has a bubble layer under it

The game already has Jacobian whitecaps with Monahan coverage and fading lace. The state of the art is notably better in three ways.

**(a) Statistically correct coverage at distance** (Dupuy & Bruneton 2012).
- Store the Jacobian j and j² in mipmapped textures, then `W = ½ + ½·erf((ε − μ_A) / (√2·σ_A))`, where μ_A is the mipmapped j and σ_A² = E[j²] − μ_A².
- Foam is Lambertian with reflectance about 0.4. They use four FFT patterns summed; the paper reports under 10 ms per frame at 1280×720 on a GTX 560 Ti.
- Without this, a mip-blurred Jacobian rarely crosses the threshold far away, so a storm sea loses its whitecaps toward the horizon or flickers.
- Shader `whitecapCoverage()` is BSD-3 in jdupuy/whitecaps `ocean.glsl`. The paper is https://hal.science/hal-00967078.

**(b) Persistent per-texel foam.**
- Atlas and War Thunder inject "turbulent energy" where J falls below a threshold M (about 0.3–0.5), then dissipate it exponentially over time **and blur it in space**. War Thunder also lets surface stretching thin the foam and squeezing thicken it.
- gasgiant/FFT-Ocean (MIT) uses a one-liner: `T = min(J, T + dt·0.5/max(J, 0.5))`, then `foam = saturate(threshold − T)`.
- Crest advects persistent foam with only part of the horizontal displacement so it "swims".
- Sea of Thieves blurs the foam buffer progressively with feedback and adds intersection foam around objects by comparing against the depth buffer.

**(c) Two layers.**
- Crest shades white surface foam plus a blue-ish additive *underwater* bubble layer.
- War Thunder adds energy-modulated "milkiness" to the refraction colour.
- Uncharted 3's "churn" uses a foam channel to change the depth colouring, which reads as pseudo-volumetric.
- **Visible result:** the turquoise glow under breaking crests and wakes. Biggest close up in a breeze, in storms and behind fast boats.

**Sources.**
- Atlas slides (above).
- War Thunder, Tcheblokov, CGDC 2015: https://developer.download.nvidia.com/assets/gameworks/downloads/regular/events/cgdc15/CGDC2015_ocean_simulation_en.pdf
- Crest SIGGRAPH 2017 deck: https://advances.realtimerendering.com/s2017/Ocean_SIGGRAPH17_Final.pptx
- gasgiant `WavesTexturesMerger.compute`.
- Uncharted GDC 2012: https://cgzoo.files.wordpress.com/2012/04/water-technology-of-uncharted-gdc-2012.pdf

**Cost.** Low.
- (a) is one extra channel and mips, plus `erf`.
- (b) for the GPU band is a ping-pong 128² RGBA16F texture (a sub-millisecond estimate on phones). The CPU band's foam is already persistent.
- (c) is ALU only.

### 5. Water colour from per-wavelength absorption and scattering (Beer–Lambert) along the real light path

**What it is.**
- Replace the shallow, mid and deep colour mix with physical extinction σ_t = σ_a + σ_s per RGB channel along the refracted view path, plus single-scattered in-scatter.
- **Seabed seen through water:** `T = exp(−σ_t · (d + d / cosθ_t))`, with sinθ_t = sinθ_v / 1.333. Light goes down d, then the view path is d / cosθ_t.
- **Water-leaving radiance:** roughly `(σ_s / σ_t′) · phase(g) · E · (1 − T)`.
- **Combination:** `L = F̄·L_sky + (1−F̄)·(L_inscatter + T·L_bed)`.
- **Pure-water absorption** (Pope & Fry 1997, OMLC table, converted from 1/cm): 450 nm 0.0092, 500 nm 0.0204, 550 nm 0.0565, 600 nm 0.222, 650 nm 0.34, 700 nm 0.624 m⁻¹.
  - Coastal Atlantic water absorbs far more blue and green (dissolved organic matter, phytoplankton, sediment) and scatters more. Treat these numbers as a floor, and tune σ_a and σ_s per region (clear Las Brasas versus silty, turbid estuary) rather than inventing values.
- Unreal's Single Layer Water exposes exactly these inputs: scattering coefficients, absorption coefficients and PhaseG (Schlick phase).

**Visible difference.** Close up and in calm or clear water:
- Turquoise over sand, which comes out of the physics automatically.
- Water looks clearer looking straight down and more opaque at a slant.
- The seabed reddens and then disappears with depth, red first.
- Hulls and fish below the waterline tint correctly.

**Sources.**
- Pope & Fry 1997 data: https://omlc.org/spectra/water/abs/pope97.html
- Unreal docs: https://dev.epicgames.com/documentation/en-us/unreal-engine/single-layer-water-shading-model-in-unreal-engine
- Unity HDRP has "absorption distance" and separate scattering terms (ambient, height, displacement, direct tip and body).
- Bruneton 2010, `L_sea · (1−F̄)`.

**Cost.**
- **Low** if it stays in the water shader using the heightmap depth the game already samples: ALU only.
- Exact per-channel see-through over *other* geometry needs either two blend passes (a multiply pass with `blendFunc(ZERO, SRC_COLOR)`, then an add pass), which doubles water fill on phones, or the refraction copy in item 8.

### 6. Spectrum refinements from Horvath 2015, plus a calibrated short-wave tail

**What it is.**
- **Frequency-dependent directional spreading** (Mitsuyasu, Hasselmann or Donelan–Banner). Waves near the spectral peak are long-crested and short waves spread widely. The cos² family stretches every wavelength equally.
  - Mitsuyasu: `D = Q(s)|cos(θ/2)|^(2s)`, with `s = s_p(ω/ω_p)^5` for ω ≤ ω_p, `s_p(ω/ω_p)^−2.5` above, and `s_p = 11.5(ω_p U/g)^−2.5`.
  - Hasselmann: `s = 6.97(ω/ω_p)^4.06` for ω ≤ ω_p, otherwise `9.77(ω/ω_p)^(−2.33 − 1.45(Uω_p/g − 1.17))`.
  - Donelan–Banner: `D = β / (2 tanh(βπ)) · sech²(βθ)`, with β = 2.61(ω/ω_p)^1.3 below 0.95, 2.28(ω/ω_p)^−1.3 up to 1.6, and 10^ε above, where ε = −0.4 + 0.8393·exp(−0.567·ln((ω/ω_p)²)).
- **Swell parameter:** `D_ξ = Q_ξ|cos(θ/2)|^(2s_ξ)`, with `s_ξ = 16·tanh(ω_p/ω)·ξ²`, multiplied onto any base spreading and renormalised.
- **TMA shallow-water attenuation:** `S_TMA = S_JONSWAP·Φ(ω_h)`, with ω_h = ω√(h/g). Φ ≈ ½ω_h² for ω_h ≤ 1, and 1 − ½(2 − ω_h)² above.
- **Finite-depth plus capillary dispersion:** `ω² = (gk + (σ/ρ)k³)·tanh(kh)`, with σ = 0.074 N/m.
- **Short-wave tail:** the Bruneton/Dupuy demo uses a spectrum whose equations and constants (c_m = 0.23, k_m = 370 rad/m, "Eq 59") match Elfouhaily et al. 1997's unified long- and short-wave spectrum. It has the gravity-capillary bump that produces glitter. At minimum, scale the short band so its slope variance matches Cox–Munk for the wind.

**Visible difference.** In breeze and moderate seas: the character of the wind sea (cross-hatched short chop riding long-crested peaks), less "cartoonish" waves in shallow bays, and wave speed and shape correct near shore. Subtle per frame but it shows in motion.

**Sources.**
- Horvath 2015, DigiPro: https://cdn.shopify.com/s/files/1/0134/1131/9867/files/EmpiricalDirectionalWaveSpectra_DigiPro2015_Jun20_2015_Optimized.pdf
- 2Retr0/GodotOceanWaves (MIT) implements TMA with Hasselmann/flat spreading plus swell.
- web-ocean (MIT) uses JONSWAP + Donelan–Banner + swell + capillary dispersion.

**Cost.** About zero at runtime: spectrum initialisation only, when the wind or region changes. TMA needs depth. Use one spectrum per depth class (deep, shelf, bay) and blend, or apply it to the shallow-water swell components the game already shoals.

### 7. One more GPU cascade for centimetre-scale waves, with distance fades and staggered updates

**What it is.** The leaders use three to six FFT cascades with **incommensurate** patch sizes, each owning a wavenumber band:

| Renderer | Patch sizes (m) | Band split |
|---|---|---|
| gasgiant/FFT-Ocean | 250 / 17 / 5 | boundary at k = 6·2π/L_next |
| Arc Blanc (2025) | 256 / 16 / 4 | same rule |
| Bruneton/Dupuy demo | 893 / 101 / 21 / 11 | lower cut of each grid at the previous grid's Nyquist, πN/L_prev |
| War Thunder | four cascades, 1 km down to 5 m | not stated |
| Atlas | four bands | not stated |
| web-ocean | six of 256², 1103 m down to 0.26 m | not stated |
| HDRP | up to three bands (two swell, one ripple) | per-band repetition size |

War Thunder and HDRP **fade out and skip cascades with distance**. The game's GPU band stops at λ ≈ 0.37 m. A third patch of about 2.5–4 m at 128² (λ down to 4–6 cm) would give real near-field sparkle and texture where the noise ruffle is now.

**Visible difference.** Close up and in calm-to-breezy conditions from the boat: crisp, physically moving capillary texture and glints right beside the hull. Little effect at distance once item 1 is in.

**Sources.** gasgiant `WavesGenerator.cs` (MIT); Arc Blanc, https://export.arxiv.org/abs/2503.03326; War Thunder slides; Horvath (above). GodotOceanWaves load-balances cascades by updating only one per frame.

**Cost.** Medium on phones; keep it in "Full" only.
- **Estimate:** a 128² fragment-shader FFT is about 14 passes. A mid-range phone takes roughly 0.5–1.5 ms per cascade per update, dominated by pass and render-target-switch overhead, about 4× the fragments at 256². Desktop is 0.1–0.3 ms.
- **Reference point:** Atlas reports 0.5 ms for its wind-wave simulation on an RTX 2080 or Radeon VII.
- **Mitigation:** update the fine cascade at 20–30 Hz, or one cascade per frame. Its waves move fast but are tiny, so temporal blending hides it.

### 8. Screen-space refraction (opaque scene colour plus depth, read by the water)

**What it is.** Render opaque geometry first, keep a colour copy and a depth texture, and in the water shader read them at UVs offset by the surface normal × min(depth difference, clamp). The true view-path length through water then feeds item 5. Unreal Single Layer Water does this, optionally from a downsampled copy, and falls back to plain translucency on mobile. Uncharted 3 used depth-based jitter and colouring; War Thunder uses "distorted, simple, none" by distance.

**Visible difference.** Clear shallows, harbour, the hull below the waterline, pilings, fish and the bobber: things under water wobble and bend with the waves, and the colour depends on real thickness (not heightmap depth, which ignores boats, rocks and fish).

**Sources.** Unreal docs (above), War Thunder, Uncharted 2012.

**Cost.** Medium on mobile. It's an extra full-screen copy and resolve, and reading depth breaks tile-based GPUs' on-chip efficiency. Use half resolution and only above the Medium setting. Desktop cost is small.

### 9. An interactive wave layer (simulated, not drawn)

**What it is.** A height and velocity grid around the camera or boat, where objects push the surface and waves propagate, interfere and reflect from hulls, rocks and quays.
- **Crest dynamic waves:** 2D wave equation, explicit Euler, CFL condition `2·c·Δt/Δx < C` with C = 0.6, using substeps. Wave speed is set per cascade to approximate dispersion. Horizontal displacement comes from the height gradient × the cascade's middle wavelength × an artistic factor, which the Crest authors say "vastly improves" the look. They report 0.6 ms on a GTX 1070 for 512²×8 cascades (8 km range).
- **Atlas:** prototyped Tessendorf's eWave: a frequency-domain exponential solver with exact dispersion, using two forward and four inverse FFTs. They damp it exponentially at the domain edges and inject foam with the same mathematics as the wind waves. Reported cost: 0.6–0.8 ms.
- **Alternatives:** Yuksel wave particles 2007, used in Uncharted for detail; iWave (Tessendorf 2004, a convolution kernel); Jeschke & Wojtan wave packets 2017 and surface wavelets 2018 (the Crest authors quote 12.7 ms versus 0.6 ms for theirs).

**Visible difference.** Calm harbour and close-up play: ripples from casts, fish, rain and a drifting hull that bounce off the boat and the quay, wakes that cross and interfere, the boat's own slap. The game's analytic Kelvin wakes already cover the open-water case well, so this mostly adds interaction close by.

**Sources.**
- Crest 2019 deck: https://advances.realtimerendering.com/s2019/CrestSIGGRAPH2019-Final-for_web.pptx
- Atlas slides.
- Tessendorf "Interactive Water Surfaces": https://jtessen.people.clemson.edu/reports/papers_files/Interactive_Water_Surfaces.pdf
- eWave note: https://jtessen.people.clemson.edu/reports/papers_files/ewavealgorithm.pdf
- Wave particles: http://www.cemyuksel.com/research/waveparticles/
- Wave packets: https://visualcomputing.ist.ac.at/publications/2017/WWP

**Cost.** Low to medium: one 256²–512² ping-pong RGBA16F texture with 1–3 steps per frame. On phones, estimate under 1 ms at 256². It is comparable to the 2048² ripple texture the game already draws into, and could replace it on high settings.

### 10. Spray and spindrift off breaking crests in storms

**What it is.** Spawn particles only where the whitecap or foam mask exceeds a threshold, with a velocity from wind plus crest motion. Atlas emits particles everywhere in view, samples the whitecap mask in the GPU simulation and kills those not on whitecaps. GodotOceanWaves does the same with GPUParticles culled by foam. In this game the long-band foam lives on the CPU, so the CPU can pick fresh breaking cells in view and emit into the existing spray system: no GPU readback needed.

**Visible difference.** Storms with 4–7 m seas: crests smoking off downwind. This complements the blown foam streaks already in the game.

**Sources.** Atlas slides; GodotOceanWaves README (MIT).

**Cost.** Low to medium: a CPU scan of a 64² foam field plus some additive sprites. Fill rate is the risk on phones; cap the particle count.

### 11. Shadows on the water body

**What it is.** Look up the sun shadow map in the water shader and use it to attenuate the sun glitter and the sun-lit part of the upwelling and through-crest scattering (not the sky reflection). Crest keeps a shadow simulation in its level-of-detail data; Bruneton notes that shadows are easily handled with a shadow map.

**Visible difference.** The boat's and the cliffs' shadows show in clear shallows and in evening light; the glitter is cut off under the hull's shadow.

**Cost.** Low if a shadow map already covers the area (one lookup per pixel). Nothing if not.

### 12. Wet, reflective sand where the swash drains

**What it is.** War Thunder's shore system makes sand wet and reflective as water and foam roll back. The game has wet-sand colour and swash run-up. Add a fading specular and sky reflection (glossy, low F0, rough) where the swash has just retreated, using the same distance-to-shore and swash phase.

**Visible difference.** At beaches with a low sun: a mirror sheen on the beach face that dries out between waves.

**Cost.** Low (terrain shader ALU).

### Smaller items where the leaders do notably better than the game's existing features

**Through-crest glow (subsurface scattering).** The game's term is close to common practice. Refinements:
- **Atlas:** `L_scatter = (k1·H·⟨L·−V⟩⁴·(0.5 − 0.5·L·N)³ + k2·⟨V·N⟩²)·C_ss·L_sun / (1 + Λ(L)) + k3·⟨L·N⟩·C_ss·L_sun + k4·P_b·C_b·L_sun`, with H = max(0, height) and P_b the bubble density, which links to item 4(c). The result is multiplied by (1−F).
- **Crest and Sea of Thieves:** drive the mask by *horizontal displacement ÷ wavelength*, so small waves glow too and the tuning survives changes in sea state.
- **HDRP:** splits the scattering into ambient, height, displacement, direct "tip" and "body" terms.

**Reflections.** The game's planar mirror is standard (three.js `Water.js` does the same). The leaders use screen-space reflections plus probes:
- Unreal runs SSR on screen tiles over the water.
- three.js has `SSRPass` (`WebGLRenderer`) and `SSRNode` (`WebGPURenderer`/TSL).
- On phones, the item 2 sky plus the existing low-resolution mirror is the right trade. Unreal itself drops SSR on mobile.

**Geometry level of detail.** On a par with the leaders: Crest's snapped clipmap with taxicab-distance blending, War Thunder's quadtree with geomorphing, CDLOD (Strugar 2009, MIT code). Possible upgrades:
- Crest's **altitude-dependent ×2 scale steps**, so high viewpoints get range rather than wasted dense rings under the camera.
- A skirt to the horizon (item 3).
- The projected grid (Johanson 2004, https://fileadmin.cs.lth.se/graphics/theses/projects/projgrid/; used by jbouny/fft-ocean and Bruneton) is an alternative but swims at the screen edges; the clipmap is fine.

**Temporal antialiasing.** Not recommended as the first fix for water shimmer in WebGL2:
- three.js `TAARenderPass` "uses no reprojection" (still camera only).
- A reprojecting `TRAANode` exists only for three.js's node/TSL renderer (`WebGPURenderer`), not the classic `WebGLRenderer` the game uses.
- Displaced water needs per-vertex motion vectors and ghosts.
- Prefiltering (item 1) plus the existing MSAA is the browser-friendly route. GodotOceanWaves also blends bicubic and bilinear sampling by texel density to cut texture aliasing; Atlas uses bicubic for its finest band.

**Underwater, caustics, Snell's window.** On a par: Sea of Thieves also does Snell's window from below.

---

## Licences: can the code be reused in a future paid commercial game?

Checked from each repository's LICENSE file on 17 Nov 2026. MIT, BSD and Apache allow commercial reuse provided the copyright and licence notice is kept in the source and shipped with the game (a credits or licences page). They are not legal advice.

### Permissive: code reuse OK with attribution

| Repository | Licence (from LICENSE) | Notes |
|---|---|---|
| wave-harmonic/crest | MIT ("Wave Harmonic and contributors", 2019) | Only the GitHub repo, which is **Crest 4 for the built-in renderer**. Crest 4 URP/HDRP and **Crest 5 are paid Asset Store products**, not open source; don't copy from those. Code is Unity C# and HLSL, so it needs porting to GLSL. |
| huwb/crest-oceanrender | MIT | Older Crest. |
| gasgiant/FFT-Ocean | MIT (Ivan Pensionerov, 2020) | Three cascades, foam, buoyancy readback. Unity compute shaders. |
| Popov72/OceanDemo | MIT (the LICENSE carries Pensionerov's copyright) | Babylon.js WebGPU port of gasgiant. |
| 2Retr0/GodotOceanWaves | MIT (Ethan Truong, 2024) | TMA, Hasselmann + swell, Atlas-style BSDF with GGX, foam, spray. Godot compute shaders. |
| GarrettGunnell/Water (Acerola) | MIT (2023) | Dual JONSWAP in four bands, Beckmann, approximate SSS. |
| jbouny/fft-ocean, jbouny/ocean | MIT (2014, 2013) | three.js, projected grid. Old. |
| dli/waves | MIT (2014) | WebGL FFT. |
| evanw/webgl-water | MIT | No LICENSE file; stated in the `index.html` header ("Released under the MIT license"). |
| mrdoob/three.js | MIT | Includes `Water.js`, `Water2.js`, `WaterMesh.js`, `Sky.js`, `SkyMesh.js`, `Reflector.js`, `SSRPass`, `TRAANode`. |
| Noniv/web-ocean | MIT (2026) | Pure WebGPU and WGSL, six cascades, LEAN, environment cube map, CDLOD to 160 km. Its README says it was made with Claude Code. WGSL compute would need porting to WebGL2 fragment passes. |
| BarthPaleologue/WebTide | MIT (2024) | WebGPU FFT ocean. |
| tessarakkt/godot4-oceanfft | MIT-style text in LICENSE.txt | Copyright Tessa Avery and Achal Pandey. |
| achalpandeyy/OceanFFT | MIT | |
| iamyoukou/fftWater | MIT | Stated in the README; no separate LICENSE file found. |
| Scrawk/Ceto | MIT | Unity. |
| Scrawk/Brunetons-Ocean | MIT | Unity port of Bruneton's code; I didn't check that the INRIA BSD notices were kept. |
| fstrugar/CDLOD | MIT | |
| ColinLeung-NiloCat/UnityURP-MobileScreenSpacePlanarReflection | MIT | Mobile screen-space planar reflection. Needs compute atomics, which WebGL2 lacks. |
| sebh/UnrealEngineSkyAtmosphere | MIT (Epic Games) | Hillaire sky and aerial perspective. |
| ebruneton/precomputed_atmospheric_scattering | BSD-3 | |
| jdupuy/whitecaps | **Mixed** | `ocean.glsl` and `atmosphere.glsl` carry **BSD-3 (INRIA 2009/2008)** headers; authors Bruneton & Dupuy. These hold the ocean BRDF, mean Fresnel, filtered sky and whitecap coverage, and are reusable with the notice. **The rest of the repo (`main.cpp`, `variances.glsl`, FFT shaders and others) has no licence**, so for those files the ideas are free to use but the code is not. |
| BabylonJS/Babylon.js | Apache-2.0 | |

### Ideas only, no code

| Source | Licence | Why ideas only |
|---|---|---|
| Unity-Technologies/BoatAttack | **Unity Companion License** ("for Unity-dependent projects") | Not usable in a three.js game. |
| Unity HDRP Water (Unity-Technologies/Graphics) | **Unity Companion License** | Same restriction. |
| Unreal Engine Water and Single Layer Water | Unreal Engine EULA | Engine code is only for use with Unreal. I didn't re-read the EULA this session. |
| BarthPaleologue/CosmosJourneyer | **AGPL-3.0** | Would force the game itself under AGPL. |
| jeschke/water-wave-packets | No LICENSE file found at the repo root | All rights reserved by default. |
| Frederoche/Webgl-FFT-Ocean- | No LICENSE file found | All rights reserved by default. |
| Shadertoy shaders (e.g. "Seascape") | Default reportedly **CC BY-NC-SA 3.0** unless the author states otherwise | Non-commercial. I confirmed this only from secondary sources; shadertoy.com/terms returned 403 here. |
| Papers and talks (Bruneton, Horvath, Atlas, Sea of Thieves, War Thunder, Crest decks) | Text is copyrighted | The techniques and formulas are free to implement; copy the code only where a repo licenses it (above). |

## Source list (all read or fetched in this session unless noted)

- **Bruneton, Neyret & Holzschuch 2010:** https://hal.science/inria-00443630v3. Code: `ocean.glsl` (BSD-3) in https://github.com/jdupuy/whitecaps.
- **Dupuy & Bruneton 2012**, "Real-time Animation and Rendering of Ocean Whitecaps": https://hal.science/hal-00967078
- **Horvath 2015**, "Empirical directional wave spectra for computer graphics": the shopify-hosted PDF above.
- **Atlas, GDC 2019** (Mihelich & Tcheblokov): https://gpuopen.com/gdc-presentations/2019/gdc-2019-agtd6-interactive-water-simulation-in-atlas.pdf
- **Sea of Thieves, SIGGRAPH 2018 talk** (Ang et al.): the history.siggraph.org PDF above.
- **Crest:**
  - SIGGRAPH 2017 deck: https://advances.realtimerendering.com/s2017/Ocean_SIGGRAPH17_Final.pptx
  - SIGGRAPH 2019 deck: https://advances.realtimerendering.com/s2019/CrestSIGGRAPH2019-Final-for_web.pptx
  - Docs: https://crest.readthedocs.io/en/4.9/user/technical-information.html and https://crest.readthedocs.io/en/4.11/user/ocean-simulation.html
- **War Thunder** (Tcheblokov, CGDC 2015): the nvidia.com PDF above.
- **Uncharted, GDC 2012** (Gonzalez-Ochoa & Holder): the cgzoo PDF above.
- **Arc Blanc** (Algis et al. 2025): https://export.arxiv.org/abs/2503.03326
- **Unity HDRP water docs:** https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.0/manual/water-water-system-simulation.html and https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.0/manual/settings-and-properties-related-to-the-water-system.html
- **Unreal Single Layer Water docs:** URL above.
- **Cox & Munk** via Mobley's Ocean Optics Web Book: URL above.
- **Pope & Fry 1997** data: https://omlc.org/spectra/water/abs/pope97.html
- **Íñigo Quílez, "Fog":** https://iquilezles.org/articles/fog/
- **LEAN mapping:** https://www.csee.umbc.edu/~olano/papers/lean/ (search result; PDF not opened).
- **CDLOD:** https://github.com/fstrugar/CDLOD (search result; README read).
- **Projected grid:** https://fileadmin.cs.lth.se/graphics/theses/projects/projgrid/ (search result; not opened).
- **Tessendorf iWave and eWave:** Clemson URLs above (search results; not opened).
- **Wave particles:** http://www.cemyuksel.com/research/waveparticles/ (page returned 406 to my fetch; cited from the Crest deck and water-resources list).
- **Water wave packets:** https://visualcomputing.ist.ac.at/publications/2017/WWP (search result).
- **Deliot & Belcour 2023**, glints: https://diglib.eg.org/handle/10.1111/cgf14866 (search result).
- **Wave Harmonic's curated bibliography:** https://github.com/wave-harmonic/water-resources (README read).
- **GodotOceanWaves, web-ocean, gasgiant, Barth Paléologue's blog** (https://barthpaleologue.github.io/Blog/posts/ocean-simulation-webgpu): READMEs and code read.
