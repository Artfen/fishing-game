> Research notes behind `docs/WATER.md`, kept as they were written (17 Nov 2026) so each recommendation can be traced to its source. Claims are marked by how far they were checked; nothing here is code taken from anywhere. Ideas from repositories whose licences don't allow reuse are used as ideas only.

# Boat feel: what is missing or could be better (research notes)

Prepared 2026-11-17 for a three.js / plain-JS browser boating and fishing game. Boats are 3–10 m. Physics runs on the CPU at 1/120–1/240 s substeps, with a budget of about 1 ms per boat per frame on phones.

**How this was researched.** The built-in web fetcher could not reach most hosts from this session. Pages were downloaded with `curl` through the session proxy and converted with pandoc or pdftotext. Some publishers refused automated download: DTIC, Springer (the article page), MDPI and the Unreal EULA page. For those the notes cite the paper by its bibliographic details, or a mirror that was actually read, and say so. Licences were checked by reading the LICENSE file on `raw.githubusercontent.com` (default branch, HEAD) for every repository listed in section 6.

**Confidence labels.** Items marked **(verified)** were read in the source during this session. **(secondary)** means the claim came from a second-hand summary or mirror. **(my estimate)** marks engineering judgement, not a citation.

---

## 0. Ranked list (feel gained per unit of cost)

| # | Improvement | Feel gained | CPU cost (JS) | Dev cost |
|---|---|---|---|---|
| 1 | Use the water's own velocity (wave orbital motion, current, wakes) in every drag, pressure, foil and propeller term. Also make wave pressure fade with depth (Froude–Krylov "Smith effect"). | High: surfing, wave push, broaching precursors, current drift, correct response to short chop | +15–35% of the panel loop | Low–medium |
| 2 | Added mass in heave, pitch, roll and sway, treated implicitly through the mass matrix, plus Coriolis terms. Calibrate against natural periods. | High: heave/pitch/roll periods stop looking toy-like (without it, heave is probably about 1.4–1.7× too fast) | ≈0 | Medium |
| 3 | Calibrate roll period and damping. Add movable crew/angler mass. | High for a fishing game at rest | 0 | Low |
| 4 | Apparent wind on topsides, gusts, leeway calibrated to field data, drift sock | High for drift fishing and docking | +0–10% | Low |
| 5 | Propeller, engine and rudder: K_T(J) with RPM/torque, prop wash over the rudder, prop walk astern, shift delay, ventilation hysteresis | Medium–high (docking, hole shot, blow-outs) | ≈0 | Medium |
| 6 | Planing validation against Savitsky (trim, porpoising limit, impact g), trim tabs, optionally Wagner/Zarnick strip slamming | Medium–high for fast boats | ≈0–5% | Medium–high |
| 7 | Shallow-water effects that depend on the depth Froude number (resistance, wake angle, squat) | Medium (flats and estuaries) | ≈0 | Low |
| 8 | Anchors: catenary, holding by bottom type, setting and dragging | Medium | ≈0 | Low |
| 9 | Validation scenarios: Kerner's targets, following-sea surf-riding, drift and decay tests. Also check whether added resistance H²/L is counted twice. | Indirect but large | 0 | Low |
| 10 | Sails as ORC-style polars or coefficients (only if sailboats exist). Boat-boat suction and bank effect. | Low–medium | ≈0 | Medium |

The sections below follow this order.

---

## 1. Velocity relative to the water (orbital, current, wake) and depth-attenuated wave pressure

**What it is**

Every velocity-dependent term should use the velocity of the hull panel relative to the local water particle. That includes Kerner-style pressure drag, viscous drag, slamming, foils, the rudder and the propeller inflow. The relative velocity is:

v_rel = v_panel − (u_orbital + u_current + u_wake)

Today the game probably uses the panel velocity relative to still water. In that case a boat sitting on a crest is "dragged" by water that is in fact moving with it.

The second part concerns how pressure is computed in waves. The game takes hydrostatic pressure at the panel's depth below the local surface. Linear theory says the wave part of the pressure decays with depth:

p = ρ g ζ_a e^{k z} cos(…) − ρ g z  (z negative down)

The hydrostatic-below-local-surface model ignores the e^{kz} factor, so it over-predicts wave forcing on deeper panels in short waves. This is the "Smith effect".

**Why it matters for small craft**

- Froude–Krylov (FK) forces dominate when the wavelength λ is much longer than the hull, roughly λ > 5 L.
- Diffraction and radiation matter when the wavelength approaches the hull length. Their main effects are added mass and wave damping (section 2) and some reduction of exciting force in short waves.
- For a 6 m boat in wind chop of λ = 5–15 m, a 0.4 m draft gives e^{−kd} ≈ 0.6–0.85. That is not negligible.
- Maki et al. derive the FK surge force for surf-riding using exactly this depth decay. They approximate it per section as e^{−k d(x)/2} **(verified)**.

**What the player would notice**

- The boat is carried forward on a crest and runs down the face.
- In a following sea the rudder loses bite on the crest, because the orbital flow reduces rudder inflow. This is the broaching precursor.
- A drifting boat moves with the swell's orbital motion instead of being "held" by fake drag.
- The boat drifts with the tide or river current.
- Small boats respond less violently to very short chop.

**Formulas and values**

- Deep-water linear wave: surface orbital speed is a·ω, decaying as e^{kz}.
  - Example: H = 1 m and T = 6 s give a = 0.5 m and ω = 1.05 rad/s, so about 0.5 m/s at the surface.
- From the FFT: the velocity spectrum is iω·ĥ for the vertical component and (k̂·g/ω)·ĥ-type terms for the horizontal components, attenuated by E(k, y) = e^{ky} below the surface (1 + ky above it).
  - Arc Blanc (JCGT 2025) gives this formula and uses it to drive per-triangle drag computed from relative velocity **(verified)**. Their drag per triangle is F_d = −½ C_d ρ A⊥ |v_rel| v_rel, with v_rel = v_i − v_medium, applied to both water and air **(verified)**.
- Cheap alternative if the CPU-side water patch has no velocity: finite-difference the sampled patch between frames.
  - ∂η/∂t gives the vertical surface velocity.
  - The time difference of the choppy horizontal displacement gives the horizontal velocity.
  - Scale both by e^{k_p z}, where k_p is the peak wavenumber of the spectrum.
- Smith correction, cheapest form: p_panel = ρ g [(η_local − z_still) · e^{k_p·depth}] + ρ g (−z_still). In words, only the wave elevation part is attenuated. A per-sea-state k_p is good enough **(my estimate)**.
  - The fuller version samples a low-pass-filtered surface for deep panels.
- Currents: one 2-D current field lookup per boat, or per vertex. Tidal 0.2–2 m/s and river flow are the typical fishing-game cases.

**Sources**

- Algis, Bramas, Darles, Aveneau, "Arc Blanc: a real time ocean simulation framework", JCGT 14(1), 2025. https://jcgt.org/published/0014/01/05/ **(verified)**. The article text is CC BY-ND 3.0; no code was found.
- Maki, Sakai, Ueta, "Review of the analytical prediction method of surf-riding threshold in following sea…" arXiv:2406.12853. https://arxiv.org/abs/2406.12853 **(verified)**. It also states the IMO second-generation criteria level-1 surf-riding check: vulnerable when Fn > 0.3. Every planing boat exceeds that.
- Tessendorf, "Simulating Ocean Water" course notes. https://jtessen.people.clemson.edu/reports/papers_files/coursenotes2004.pdf (secondary; standard reference).

**CPU cost**

Measured with the micro-benchmark in section 7:
- three extra bilinear lookups per vertex for the velocity field: +15–35% of the panel loop;
- one `exp` per vertex for the Smith correction: about +10%.

At 400 triangles that is roughly +10 µs per substep on a 2.1 GHz desktop core.

---

## 2. Added mass, done implicitly, with natural periods as the target

**What it is**

When the hull accelerates, it must also accelerate water. Kerner did not ship this in Just Cause 3. He writes that "a fourth force, the added mass force, didn't make it in the model in the end… We made some attempts at implementing it but didn't get what we hoped for" **(verified, Kerner Part 2)**.

The game already has a surge factor and the Munk moment. Both are added-mass effects in surge and sway. Heave, pitch and roll added mass appear to be missing, and those dominate how a small boat moves at rest in swell.

**What the player would notice**

Heave and pitch "bobbing" slows to realistic periods. Boats look heavier and less "toy". The motion lags the waves correctly, and slams land at the right moment.

**Formulas and values**

Natural period in heave:

T_3 = 2π √((m + a_33) / (ρ g A_wp))

The same form applies in pitch, with I_55 + a_55 over ρ g I_L, and in roll, with I_44 + a_44 over Δ·GM.

**Size of a_33 for small, beamy, shallow hulls (estimate from the 2-D, high-frequency strip limit):**
- A flat strip of half-beam b on the free surface has a_33 per metre = ρπb²/2.
- For B = 2 m and T = 0.25 m, that is 1.57ρ per metre, against a displaced mass of 0.5ρ per metre. That makes a_33 ≈ 3 × displacement in 2-D.
- 3-D end effects and deadrise reduce it. Lower frequencies increase it.
- So a_33 ≈ 1–2 × displacement is a reasonable starting range for skiffs and runabouts **(my estimate, from the standard 2-D result)**.
- For ship-like hulls the MMG paper's KVLCC2 values give surge m_x ≈ 7% and sway m_y ≈ 76% of ship mass. Those come from the non-dimensional m′_x = 0.022, m′_y = 0.223, J′_z = 0.011 in its Table 3 **(verified)**.

**Example: 5 m skiff**
- Δ = 600 kg, A_wp ≈ 6 m², so the heave stiffness is about 61 kN/m.
- T_3 without added mass: 0.62 s. With a_33 = 1.5Δ: about 0.98 s.
- A 1.6× difference in heave frequency is easily visible.

**Roll added inertia.** IMO's roll-period formula gives an implied radius of gyration that already includes added inertia:
- T_φ = 2·C·B/√GM, with C = 0.373 + 0.023·B/d − 0.043·L_wl/100 (IMO 2008 Intact Stability Code; reproduced by many secondary sources, confirmed only as secondary here).
- That works out to k_virtual ≈ C·B ≈ 0.37–0.45·B.
- The dry radius of gyration of small hard-chine models was set to k_44 ≈ 0.40·B in the Naples Systematic Series tests **(verified, De Luca et al. 2024, Table 1)**.

**Planing at speed.** Faltinsen's planing-hull added mass in heave and pitch (Hydrodynamics of High-Speed Marine Vehicles, §9.4.1) is coded in `openplaning.get_mass_matrix()` **(verified, MIT)**.

**Implementation**

- Use M_eff = M_RB + M_A in the body frame, a constant 6×6 matrix per hull, and solve accelerations with M_eff⁻¹. Precompute the inverse.
- Add the added-mass Coriolis/centripetal term C_A(ν)ν. It is the same expression Fossen uses (`m2c` in PythonVehicleSimulator, MIT). It reproduces the Munk moment the game already has, so the existing Munk term should not be added on top.
- Scale M_A by how much of the hull is submerged, for example by the submerged-waterplane fraction. A boat in the air must not carry added mass.

**Do not** apply added mass as an explicit force −A·a_measured. When added mass is comparable to or larger than the body mass, that is the classic "added-mass instability" of partitioned fluid–structure coupling. See Causin, Gerbeau & Nobile, "Added-mass effect in the design of partitioned algorithms for fluid–structure problems", Comput. Methods Appl. Mech. Eng. 194 (2005) (cited from knowledge, not re-opened). It is probably why Kerner's attempts failed **(my inference)**.

**Option: precompute per hull offline.** Run each hull mesh offline through Capytaine (Apache-2.0) or NEMOH (Apache-2.0) to get added mass and radiation damping at the natural frequency. Fossen's MSS has a Capytaine pipeline: its `otter.m` small USV model uses "MSS-Capytaine power-based added mass, radiation damping" **(verified, MSS README)**. This is offline only and costs nothing at runtime.

**Sources**

- Kerner, Part 2. https://www.gamedeveloper.com/programming/water-interaction-model-for-boats-in-video-games-part-2 **(verified)**
- Journée & Massie, *Offshore Hydromechanics*, TU Delft (2001): ch. 6 (mass–spring, added mass) and ch. 7 (2-D potential theory, free-decay tests). https://ocw.tudelft.nl/wp-content/uploads/Introduction_Offshore_Hydromechanics.pdf (contents verified)
- Yasukawa & Yoshimura 2015, MMG (see §5) **(verified)**
- Fossen PythonVehicleSimulator `gnc.py` (`m2c`, `crossFlowDrag`, `forceLiftDrag`). https://github.com/cybergalactic/PythonVehicleSimulator **(verified)**

**CPU cost.** A 6×6 matrix-vector product per substep: in the noise of the benchmark (under 1 µs).

---

## 3. Roll period, roll damping, and moving people

**What it is**

Calibrate the roll behaviour at rest, because at rest is where a fishing game spends most of its time. The pressure-drag term can easily over-damp roll at rest, or under-damp it.

**Targets**

- **Period, UK rule.** UK MCA small fishing vessel roll test: "If the time for one average roll in seconds is less than the beam of the vessel in metres the vessel can be said to be stiff" **(verified)**. So for typical small craft, T_φ (s) ≲ B (m).
  https://www.gov.uk/government/publications/the-code-of-practice-for-the-safety-of-small-fishing-vessels-of-less-than-15m-length-overall/annex-7a-conducting-fishing-vessel-roll-test
- **Period, IMO formula.** T_φ = 2·C·B/√GM (see §2). Beamy skiffs typically land at about 1.5–3 s.
- **Damping, hard-chine planing models at zero speed (Naples Systematic Series).** Roll decay fits φ̈ + 2μφ̇ + β φ̇|φ̇| + ω₀²φ = 0 gave:
  - μ ≈ 0.02–0.12 s⁻¹ and β ≈ 0.5–1.1 rad⁻¹ at model scale, with ω₀ ≈ 4.3–5.1 rad/s;
  - an equivalent linear μ_e at 5° of 0.14–0.25 s⁻¹, which is a damping ratio ζ = μ_e/ω₀ ≈ 0.03–0.05 **(verified, De Luca et al., Ocean Eng. 296, 2024, Tables 2–6)**.
  - Consequence: a released 10° heel should ring for about 4–6 visible cycles. If the game's boats stop after one or two cycles, roll is over-damped **(my estimate from those numbers)**.
  - https://www.iris.unina.it/retrieve/e9ff2850-c512-49c6-a971-fcb7d47e6e90/1-s2.0-S0029801824004347-main.pdf
- **Damping at speed.** Damping rises strongly with speed. The extra comes from lift on the hull and appendages (the game's foils already supply some) and from chine separation. The same paper notes that at higher speed, hard-chine hulls damp much more than round-bilge hulls **(verified)**.
- **Ikeda's method** splits roll damping into five parts: friction, wave, eddy, hull lift and bilge keel. It is the ITTC procedure 7.5-02-07-04.5 (2011); the procedure text came only from mirrors here, so treat it as secondary. Its one practical lesson for games: eddy damping is quadratic and appears at chines and bilge keels. Small craft rarely have bilge keels.

**Implementation**

Run an automated "heel 10°, release" test per hull. Fit μ and β, then adjust the pressure-drag exponents or coefficients, or add an explicit roll damping moment −(2μ I_v ω_x + β I_v ω_x|ω_x|) scaled by immersion, until the targets match. Optionally add a speed-proportional lift-damping term.

**Moving crew and angler mass.** People are a large fraction of displacement on a small boat. Add them as point masses on the rigid body, or as a moving offset of the centre of gravity.

- Heel from moving a mass w by a distance y: tan φ ≈ w·y/(Δ·GM).
- Example: a 90 kg angler stepping 0.8 m sideways on a 600 kg skiff with GM ≈ 0.8 m gives about 8–9° of heel.

This is standard hydrostatics (Journée & Massie ch. 2). Players feel it immediately: the boat tips when the angler stands at the gunwale or a fish runs under the side. It costs nothing, provided crew mass feeds the inertia too.

---

## 4. Wind on topsides, gusts and leeway (drift fishing)

**What it is**

Apply air pressure drag to above-water panels using apparent wind:

v_app = U_wind(z) − v_panel

The game already identifies submerged panels, and the rest are dry. The Arc Blanc and Habrador implementations both do exactly this **(verified)**. Habrador's version: air resistance ½ρ_air C |v|v A, applied only when the panel faces the flow.

Use the marine wind profile U(z) = U₁₀ (z/10)^α with α ≈ 0.11–0.14 over open water (commonly cited, e.g. DNV-RP-C205; not re-verified here). Add gusts with a filtered-noise (Ornstein–Uhlenbeck) process at roughly 10–15% turbulence intensity **(my estimate; tune)**.

**What the player would notice**

- An idling or drifting boat lies beam-on or bow-off depending on its windage.
- Centre-console bows blow off when docking.
- The boat at anchor sails back and forth (anchor sheering).
- Drift speed is correct for drift fishing, and a drift sock visibly slows it.

**Calibration target, from field data on a real small craft**

In 2009 field trials (Fedje, Norway), a 4.15 m open shallow-V skiff drifted at:
- leeway speed = 2.49% × U₁₀ + 0.147 m/s,
- downwind component = 2.52% × U₁₀ + 0.134 m/s,
- crosswind component ≈ 1.07% of U₁₀,

all from unconstrained linear regressions **(verified, Allen, Roth, Maisondieu, Breivik & Forest, MET report 17/2010, Table 8)**. Other objects in the same trials: Sunfish dinghy 1.78%, 20 ft container 1.22%, person in water 1.10%. So in a 10 m/s wind an empty skiff should drift at about 0.4 m/s (0.8 kn).

- https://www.met.no/publikasjoner/met-report/met-report-2010/_/attachment/download/a8b16efd-55af-4418-b403-f14aa924b723:14e9e81be5596a1ff441ca0e93eb4c6b2b4348c9/MET-report-17-2010.pdf
- Method paper: Breivik et al., "Wind-induced drift of objects at sea: the leeway field method", arXiv:1111.0750 https://arxiv.org/abs/1111.0750 **(verified)**

**Parameters**

- C_D ≈ 1.0–1.2 per flat-ish panel, with ρ_air = 1.225 kg/m³. Tune until the leeway matches.
- Drift sock (sea anchor): F = ½ ρ C_D A_mouth |v_rel| v_rel with C_D ≈ 1–1.4 **(my estimate; no authoritative small-drogue source found)**. Attach it with the existing rope system.

**CPU cost.** One cheap loop over dry panels (−5% to +10% in the benchmark, within noise). It could run at frame rate instead of substep rate, because wind loads change slowly.

---

## 5. Propeller, engine and rudder model

### 5a. Thrust versus advance ratio, and engine matching

- T = ρ n² D⁴ K_T(J), with J = u_a/(nD) and u_a = u(1 − w_P).
- K_T(J) ≈ k₀ + k₁J + k₂J². The MMG example uses (0.2931, −0.2753, −0.1385) for a ship propeller **(verified, Yasukawa & Yoshimura 2015)**.
- Torque Q = ρ n² D⁵ K_Q(J). Engine RPM then follows from I_eng ṅ = Q_engine(n, throttle) − Q_prop/gear.

What the player gets:
- the "hole shot";
- RPM that rises as the boat gets on plane and the propeller unloads, which can also drive engine sound;
- RPM that drops when towing or trimmed down;
- correct idle-in-gear trolling speed, which matters a great deal for trolling in a fishing game. Typical outboard idle-in-gear speed is about 2–4 kn **(my estimate)**.

Add gear-shift dwell through neutral (about 0.5–1 s, **my estimate**) and reverse thrust at roughly 40–60% of forward thrust for fixed-pitch propellers **(my estimate; propellers are much less efficient astern)**.

### 5b. Prop wash over the rudder (inboard/rudder boats)

The MMG standard method gives the rudder inflow velocity **(verified)**:

u_R = ε u (1 − w_P) √( η {1 + κ (√(1 + 8K_T/(πJ²)) − 1)}² + (1 − η) )

- η = D_P / H_R (propeller diameter over rudder span); KVLCC2 values are ε = 1.09 and κ = 0.50.
- Rudder normal force: F_N = ½ ρ A_R U_R² f_α sin α_R, with f_α = 6.13Λ/(Λ + 2.25) (Fujii) and α_R ≈ δ − atan(v_R/u_R).
- Hull–rudder interaction (minus signs follow the usual MMG convention; they were lost in the PDF text extraction):
  - X_R = −(1 − t_R) F_N sin δ
  - Y_R = −(1 + a_H) F_N cos δ
  - N_R = −(x_R + a_H x_H) F_N cos δ
  - typical values a_H ≈ 0.3–0.4 and x_H ≈ −0.45 L **(verified)**.

What the player gets: a "kick" of throttle steers a stopped inboard boat. At zero thrust and low speed the rudder is nearly useless. Outboards and sterndrives already vector their thrust, so this mainly matters for inboard/rudder boats.

- Yasukawa & Yoshimura, "Introduction of MMG standard method for ship maneuvering predictions", J. Mar. Sci. Technol. 20:37–52 (2015). https://doi.org/10.1007/s00773-014-0293-y (read via the typeset.io copy).
- MIT Python implementation: https://github.com/nikpau/mmgdynamics

### 5c. Prop walk (paddle-wheel effect)

Going astern, a right-handed propeller walks the stern to port (standard seamanship teaching, from knowledge). One exam-prep page found in search claims the opposite, so the sources conflict and the direction should be checked against a seamanship text.

The effect is much weaker ahead, because the rudder hides it. No reliable published magnitude was found. Model it as a lateral force at the propeller of a few percent of thrust, larger astern, and tune it **(my estimate)**.

The reaction to propeller torque also heels light boats slightly and gives outboards their steering torque.

### 5d. Ventilation (better than "out of water means no thrust")

- **Thrust versus immersion.** In URANS calculations matched against experiments, at bollard pull and high RPM:
  - shaft immersed one radius (h/R = 1.0): thrust ratio below 60%;
  - shaft at the surface (h/R = 0): below 20%;
  - the thrust ratio relates to the torque ratio as β_T = β_Q^{1/m}, with m ≈ 0.9 **(verified, Lee & Paik, Brodogradnja 69(1), 2018)**. https://hrcak.srce.hr/file/279022
- **Mechanisms.** Califano & Steen describe a free-surface vortex at deeper immersion and tip-vortex ventilation at moderate immersion, depending on load and J (secondary, via Lee & Paik).
- **Hysteresis.** Ventilation takes time to establish and to clear, and wave heave raises the losses (Koushan, secondary).
- **Game model.** Keep a ventilated flag per propeller.
  - Set it when (h/R < ~1–1.5 and high load), or in a hard turn with the leg trimmed out, or when the propeller leaves the water.
  - Clear it only when h/R > ~1.5–2 and the throttle is eased.
  - While set, thrust is about 0.2–0.5 × normal, the engine's RPM limit rises (the propeller "blows out"), and there is a sound cue.
  - The thresholds are **my estimate**, shaped by the cited data.
- **Cavitation** (cavitation number σ = (p_atm + ρgh − p_v)/(½ρV²)) matters little for feel at recreational speeds. Low priority.

### 5e. Rudder and helm rate limits

- SOLAS requires a ship's steering gear to go from 35° on one side to 30° on the other in at most 28 s (from knowledge).
- Small-boat hydraulic helms run about 3–5 wheel turns lock-to-lock. A helmsman can do that in about 1.5–4 s. Tillers are near-instant **(my estimate)**.
- Use a rate limit on δ plus a little steering-load feedback.

**CPU cost (all of §5).** A few dozen flops per propeller per substep; within the benchmark noise.

---

## 6. Planing: Savitsky as a validation harness, trim tabs, better slamming

The game already gets planing lift from the velocity-dependent pressure term, as Kerner does. In Kerner's words: "The drag force is normal to the surface of the boat. It serves as a planing force at speed" **(verified)**.

The recommendation is not to replace that term with Savitsky. Instead, run Savitsky as an automated check per hull, and add the few things the panel model cannot produce.

### 6a. Savitsky (1964) equations (verified in openplaning source, MIT)

- Zero-deadrise lift: C_L0 = τ^1.1 (0.012 λ^0.5 + 0.0055 λ^2.5 / C_V²)
  - τ is trim in degrees; λ is mean wetted length over beam, (L_K + L_C)/(2b); C_V = V/√(g b).
- With deadrise: C_Lβ = C_L0 − 0.0065 β C_L0^0.6 (β in degrees). Lift = C_Lβ · ½ρV² b².
- Centre of pressure from the transom: l_p = λ b (0.75 − 1/(5.21 (C_V/λ)² + 2.39)).
- Validity: 0.6 ≤ C_V ≤ 13, λ ≤ 4, 2° ≤ τ ≤ 15°.
- Keel wetted length (Faltinsen eq. 9.50): L_K = LCG + VCG/tan τ − z_wl/sin τ.
- Porpoising limit (Savitsky chart, as fitted in openplaning):
  - x = √(C_LΔ/2), with C_LΔ = Δ/(½ρV²b²).
  - τ_crit(β = 0°) = −376.37x³ + 329.74x² − 38.485x + 1.3415
  - τ_crit(β = 10°) = −356.05x³ + 314.36x² − 41.674x + 3.5786
  - τ_crit(β = 20°) = −254.51x³ + 239.65x² − 23.936x + 3.0195
  - Interpolate in β. Valid for 0.13 ≤ x ≤ 0.3 and β ≤ 20°.
  - Trimmed above τ_crit, the boat should porpoise. With trim/tilt on the leg, that becomes a skill the player learns.

### 6b. Trim tabs (Savitsky & Brown 1976, verified in openplaning source)

- F_z = 0.046 · l_f · δ · σ · b · ½ρV², with δ in degrees and σ the flap span over beam.
- F_x = 0.0052 · F_z · (τ + δ).
- Lever from the transom: 0.6·b + l_f(1 − σ).
- Validity: δ 0–15°, C_V 2–7, l_f ≤ 10% of mean wetted length.

Trim tabs are cheap and common on 5–10 m boats. They give the player bow-down control in chop and list correction.

### 6c. Rough-water targets (Savitsky & Brown 1976, verified in openplaning)

Average impact acceleration at the CG, in g (US units: L, b, H in ft; V in kn; C_Δ = Δ/(w b³)):

n_cg = 0.0104 (H_⅓/b + 0.084) (τ/4) (5/3 − β/30) (V_k/√L)² (L/b) / C_Δ

and at the bow, n_bow = n_cg (1 + 3.8(L/b − 2.25)/(V_k/√L)). Use these to tune slam severity.

Savitsky & Brown also give added resistance in waves for planing hulls at V_k/√L = 2, 4 and 6, for example:

R_AW,4 = Δ (0.3 H/b)/(1 + 2H/b) (1.76 − τ/6 − 2 tan³β)

This is a better small-craft replacement for the generic "∝ H²/L". **But see §9: the panel model may already produce wave resistance, so check for double counting first.**

### 6d. A better slamming and bottom-lift model (optional, bigger change)

Zarnick's 2-D+t momentum-strip model, the basis of most planing-in-waves simulators, gives the normal force per unit length on a section as:

f = −[ D(m_a V)/Dt + C_Dc ρ b V² ]

where:
- D(m_a V)/Dt = m_a V̇ + V ṁ_a − U ∂(m_a V)/∂ξ;
- m_a = k_a (π/2) ρ b², with k_a ≈ 1;
- b = (π/2) d cot β (Wagner pile-up factor π/2), up to the chine, after which m_a is held constant;
- C_Dc = 1.0·cos β **(verified, Zarnick 1978, DTNSRDC-78/032, eqs. 2–5 and appendix)**.

The V·ṁ_a term is the physical slam. It replaces Kerner's "F_stop" blend, which Kerner himself calls a shortcut that starts from a perfectly stiff response and relaxes it. The −U ∂(m_a V)/∂ξ term is the steady planing lift.

**Implementation.** Use 10–20 sections along the bottom, using the panel clipping already done for wetted depth per section. Use this model for bottom panels and keep the Kerner terms for topsides and sides.

**What the player would notice.** Slams scale correctly with deadrise (deep-V hulls ride softer), trim and speed. Running trim and lift come out right without per-hull fudge, and a chine-walk or porpoising tendency emerges.

**Sources**

- Zarnick, "A nonlinear mathematical model of motions of a planing boat in regular waves" (1978). https://archive.org/details/nonlinearmathema00zarn **(verified, OCR text)**
- Faltinsen, *Hydrodynamics of High-Speed Marine Vehicles*, Cambridge UP (2005), chapters 8–9.
- Savitsky, "Hydrodynamic design of planing hulls", Marine Technology 1(1):71–94 (1964).
- Savitsky & Brown, "Procedures for hydrodynamic evaluation of planing hulls in smooth and rough water", Marine Technology 13(4):381–400 (1976).
- OpenPlaning code: https://github.com/elcf/python-openplaning **(MIT, verified)**

**CPU cost.** The Savitsky check can run once per second, or offline: free. The 20-strip Wagner model was within the benchmark noise (under about 5 µs per substep).

---

## 7. Shallow water (flats, estuaries, beaches)

- **Depth Froude number** Fn_h = V/√(g h). Regimes:
  - subcritical, 0.4 < Fn_h < 1;
  - critical, Fn_h ≈ 1 (in practice 0.88–0.96 depending on fullness). The wave angle approaches 90° and the wave system becomes a single crest moving with the boat;
  - supercritical, Fn_h > 1: divergent waves only, with sin θ = 1/Fn_h **(verified, Mauro et al., HSMV 2023)**. https://arts.units.it/retrieve/7d24c506-66e7-4488-9433-aeaf604c7dba/HSMV_2024.pdf
  - The deep-water Kelvin half-angle is 19.47°.
- **Why this matters for small boats.** Many flats are 1–3 m deep. A 6 m boat at 10 kn (5.1 m/s) in 2.6 m of water is at Fn_h = 1.0. Typical fishing boats regularly pass through the critical regime there, so the effect is real for this game.
- **Resistance (Schlichting, subcritical).** In depth h, the wave (residual) resistance at speed V_h equals the deep-water value at the speed V_∞ that produces the same wavelength:
  - V_h/V_∞ ≈ √tanh(g h/V_∞²);
  - add a friction penalty for the increased flow under the hull;
  - valid for Fn_h < ~0.7–0.9;
  - the game can remap its own measured resistance curve with this;
  - past critical speed, wave resistance falls below the deep-water value. Fit a hump near Fn_h ≈ 0.9–1.0 by hand.
- **Wake.** Widen the Kelvin-wake angle with Fn_h, and make wakes in shallow water steeper and more damaging. Players will see it.
- **Squat.** Barrass's short-cut S_max ≈ C_B V_k²/100 m (open water) is meant for ships (secondary sources). Small craft at displacement speed squat only centimetres. It matters for grounding near the bottom, but its effect on feel is small.
- **Bank effect / bank suction:** the stern is sucked toward the bank and the bow is pushed off. Only relevant in narrow creeks. Low priority.

**CPU cost.** One depth lookup and a tanh per frame: negligible.

---

## 8. Anchors (catenary, holding, dragging)

- **Catenary** (chain or heavy rode). With depth plus fairlead height d, submerged weight per length w, and fairlead tension F:
  - suspended length S = √(d(2F/w − d));
  - horizontal span X = (F/w − d)·ln((S + F/w)/(F/w − d));
  - horizontal tension at the anchor H = F − w d.
  - These are derived from the standard catenary and match the form given in the Vryhof manual, whose own formulas are printed as images.
  - Rode lying on the seabed transmits no uplift. Solve with 3–6 Newton steps per frame.
  - Mixed nylon-plus-chain rodes: solve the chain catenary and put the elastic nylon (already in the game) in series.
- **Holding** = efficiency × anchor weight. The efficiency depends heavily on anchor type and soil. Vryhof's indicative classes, for a 10 t anchor in good soil **(verified, Vryhof Anchor Manual 2015, "Characteristics of anchor types")**:
  - Class A (modern high-holding): 33–50;
  - Class B: 17–25;
  - Class C: 14–26;
  - Class D (Danforth-type): 8–15;
  - Class E (AC-14): 8–11;
  - Class F (stockless): 4–6;
  - Class G: under 6.
  - The manual adds that efficiency falls as anchor size grows, so small anchors can do better.
  - Mud lets an anchor bury deeply; sand and firm clay give shallow embedment and "only take small uplift loads".
  - Weed and rock should give low, random holding **(my estimate)**.
  - https://www.plaisance-pratique.com/IMG/pdf/Vryhof_Anchor_Manual2015.pdf (third-party mirror of the Vryhof PDF)
- **Setting and dragging.** In model tests, holding force rises steeply after initial penetration and converges to a maximum as the anchor drags **(verified, Shin, Seo & Lee, IJNAOE 3:193–200, 2011)**.
  - Game model:
    - holding rises from about 10% to 100% over a few shank-lengths of drag;
    - it collapses if the rode angle at the seabed exceeds about 5–10° (too little scope);
    - after breaking out, the anchor resets with some probability **(my estimate)**.
  - Gameplay follows from this: scope matters (5:1–7:1), gusts break anchors out, and some bottoms hold badly.
  - Doc: https://ancientportsantiques.com/wp-content/uploads/Documents/ETUDESarchivees/Navires/Anchors/AnchorHoldingPower-Shin2011.pdf
- Combined with wind (§4), this gives anchor sheering for free.

**CPU cost.** Microseconds per rode.

---

## 9. Validation scenarios and notes on what already exists

**Kerner's targets for planing boats, from his Part 2 references (Faltinsen; Ikeda et al.)** **(verified)**:
- running trim of about 4°;
- slip angle of about 20° in hard turns;
- banking inward 25° or more.

Kerner says that once they stopped trying to suppress slip angle, tuning moved much faster. Script these as automated tests per hull. Displacement boats should heel *outward* in a turn.

Kerner's other "what does a real boat do" questions are worth scripting too:
- time to top speed and time to stop;
- roll period at rest;
- speed lost in a turn.

**Added resistance ∝ H²/L.** The panel model already integrates wave pressure over a moving hull, so some added resistance in waves already emerges, together with surge forces. Measure resistance in waves with the extra term switched off first; otherwise it may be counted twice. For planing hulls use Savitsky & Brown (§6c) as the check.

**Slamming.** Kerner's slam force is his acknowledged shortcut: a stop-in-one-frame force F_stop = m v (2A/S), blended by clamp(Γ/Γ_max)^p · cos θ with p ≥ 2. If the game uses a similar form, either calibrate it against Savitsky & Brown n_cg (§6c) or move to §6d.

**Do not copy Habrador's tutorial code blindly.** Its `PressureDragForce` sets `velocityReference = velocity`, so the normalised speed is always 1 (and 0/0 = NaN at rest). Pressure drag therefore becomes speed-independent. Its `SlammingForce` sets `acc_max = acc`, so the clamp is always 1 **(verified in the published tutorial code)**.

**Wave sampling.** With choppy (horizontally displaced) FFT waves, the height at a world point needs inverting the displacement. Crest and Atlas both use fixed-point iteration (Atlas does not state the iteration count; Arc Blanc uses 4) **(verified)**:
- Atlas GDC 2019: https://gpuopen.com/gdc-presentations/2019/gdc-2019-agtd6-interactive-water-simulation-in-atlas.pdf
- Bowles, GDC 2016, "Fixed Point Iteration": https://www.gdcvault.com/play/1023011/Fixed-Point-Iteration-A-Simple

Crest also low-pass filters collision queries with a "Min Spatial Length" set to the boat's width, which removes waves shorter than half that **(verified)**. That is a principled version of "sample under length and beam".

**Integration.** Kerner used forward Euler with separate, separately tunable forces **(verified)**. The game's 120–240 Hz substeps are fine. With added mass included in the mass matrix, nothing stiffer is needed.

**Surf-riding and broaching test.** Run a following sea with wave celerity c ≈ boat speed; a small boat at Fn > 0.3 is in the IMO "vulnerable" range (Maki et al.). With §1, §2 and §5b in place, the boat should catch waves, accelerate down the face, and lose rudder authority on the back of the crest.

**Boat–boat interaction.** The game has wake lift. Passing suction (attraction, then yaw) between two hulls at small gap is well documented for ships, for example in Vantorre, Verzhbitskaya & Laforce, "Model test based formulations of ship–ship interaction forces", Ship Technology Research 49(3):124–141, 2002 (bibliographic record only). https://marineinfo.org/id/publication/124199 For 3–10 m boats it only matters when coming alongside or in narrow channels. A cheap gap-dependent lateral attraction force ∝ ρ U² L T f(gap/B) is enough **(my estimate)**. Low priority.

**Sails (only if sailboats are planned).** The ORC VPP treats each sail as a maximum lift coefficient C_Lmax(AWA) and parasitic drag C_D0(AWA) curve, with:
- induced drag ∝ C_L²;
- a "flat" depowering factor from 1.0 down to 0.42 and a "reef" area factor;
- centre-of-effort heights for the heel moment;
- a wind gradient;
- at an apparent wind angle of 180°, C_L → 0 and C_D → 1.0 **(verified, ORC VPP Documentation 2023 §5)**. https://orc2.orc.org/rules/ORC%20VPP%20Documentation%202023.pdf

In a rigid-body game, apply these sail forces at the centre of effort. The keel and rudder foils the game already has close the loop. A VPP polar is then only a validation target, not the model. Virtual Regatta-style games are kinematic: speed is looked up from a polar against true wind angle and speed, with GRIB winds (secondary: SailGrib documentation of its VR mode, https://sailgrib.com/en/apps/sailgrib-wr/aide/routing/routing-for-virtual-regattas/).

---

## 10. What the well-known games and engines are documented to do

| Title / engine | What is publicly documented | Source |
|---|---|---|
| **Just Cause 3** (Avalanche) | The most detailed public account (see the summary after the table). | Kerner Part 1 (27 Feb 2015) https://www.gamedeveloper.com/programming/water-interaction-model-for-boats-in-video-games ; Part 2 (dated 8 Jan 2016 on the site) https://www.gamedeveloper.com/programming/water-interaction-model-for-boats-in-video-games-part-2 **(verified)** |
| **Atlas** (Grapeshot, GDC 2019) | Per-sample Archimedes buoyancy was dropped: it was noisy and the server ran below 10 Hz. Instead they fit a plane through the wave samples (Eberly's eigen-solver) and pull the ship to it with a spring. Fixed-point height inversion. | https://gpuopen.com/gdc-presentations/2019/gdc-2019-agtd6-interactive-water-simulation-in-atlas.pdf **(verified)** |
| **Sea of Thieves** (Rare) | SIGGRAPH 2018 talk: FFT (Tessendorf) ocean, GPU shallow-water splashes on deck, analytic catenary ropes. Nothing on ship buoyancy or hydrodynamics was found. | https://history.siggraph.org/wp-content/uploads/2022/09/2018-Talks-Ang_The-Technical-Art-of-Sea-of-Thieves.pdf **(verified)** |
| **Assassin's Creed IV** | The GDC 2014 talk was about rendering (Wronski). The ocean tech is attributed to Ubisoft Singapore; Havok press material mentions ships. No technical account of the boat model was found. | https://www.gdcvault.com/play/1020397/Assassin-s-Creed-IV-Black (secondary) |
| **Crest** (Unity water) | "Buoyancy physics for boats is not a core focus". `SimpleFloatingObject` matches height and normal. `BoatProbes` applies forces at force points. It recommends NWH's DWP2 for "professional" physics, and offers wavelength-filtered collision queries. | https://crest.readthedocs.io/en/latest/user/collision-shape-and-buoyancy-physics.html **(verified)** |
| **Unreal Water plugin** | `BuoyancyComponent` approximates the hull with spheres ("pontoons"). It has a buoyancy coefficient, linear and quadratic Z damping ("Buoyancy Damp/Damp2"), linear and quadratic drag, angular drag, a max drag speed, and river-flow forces. | https://dev.epicgames.com/documentation/en-us/unreal-engine/water-buoyancy-component-in-unreal-engine **(verified)** |
| **VRX** (Gazebo, maritime robotics) | A WAM-V USV with cylinder "Surface" buoyancy plus Fossen-style linear and quadratic damping (xU = 100, xUU = 150, …). Added mass is set to 0 in the shipped config, likely for stability. | https://github.com/osrf/vrx (verified config) |
| **Godot** | Hydro module (MIT, WIP), Halyard (MIT: submerged-volume buoyancy, axis-independent hull drag, Verlet ropes), FloatableBody / WaterBox / Buoyancy (MIT, simple), godot4-oceanfft (MIT, "basic buoyancy"). | GitHub (licences verified) |
| **Sailaway, Ship Simulator, Fishing Planet, Ultimate Fishing Simulator, NWH DWP2** | No public technical description of their boat models was found in this session. The game feel cannot be attributed to any specific technique without guessing. | — |

**Just Cause 3 in more detail (Kerner).**
- Per-triangle hull clipping against a sampled water height-field patch:
  - first height above water per vertex;
  - then 0, 1 or 2 submerged sub-triangles per triangle;
  - simplified cases, such as single crossings per edge.
- Pressure is taken as constant per triangle (Appendix A gives the exact centre of pressure).
- Viscous drag from ITTC-1957 C_F = 0.075/(log₁₀Rn − 2)², applied to tangential flow.
- Pressure and suction drag: (C₁ v/v_ref + C₂ (v/v_ref)²) · A · cos θ^f, with f < 1.
- Slamming as a blend toward a stop-in-one-frame force.
- No added mass.
- Budget under 1 ms per boat. Boats from 2 m jet skis to a 50 m corvette, with mostly shared constants.
- Kerner hit porpoising, cork-screwing and chine-walking as real phenomena.
- Water came from NVIDIA WaveWorks.

---

## 11. Open-source code and licences (LICENSE files read on GitHub HEAD this session)

"Code reuse in a paid game" means copying or porting the code into a closed-source commercial JS game, keeping the notice.

| Repository | What it is | Licence (file read) | Code reusable commercially? |
|---|---|---|---|
| Habrador/Unity-Boat-physics-Tutorial | C# port of Kerner's model (Unity) | MIT, © 2020 Erik Nordeus | **Yes**, keep the MIT notice. Fix the bugs listed in §9. |
| gauravnba/WaterInteractionModel_UE4 | Kerner model in UE4 + WaveWorks | **No licence file** (all rights reserved by default) | **No**: ideas only |
| Unity-Technologies/BoatAttack | Unity demo with boat physics | Unity Companion License: use only "in connection with" content made under a Unity engine licence | **No** for a three.js game; ideas only |
| wave-harmonic/crest (Crest 4, built-in pipeline) | Unity ocean, BoatProbes | MIT, © 2019 Wave Harmonic | Yes (MIT). The newer Crest 4 URP/HDRP and Crest 5 are paid Asset Store products: ideas only. |
| elcf/python-openplaning | Savitsky / Faltinsen planing (Python) | MIT, © 2021–2025 E. L. Castro-Feliciano | **Yes**, porting the formulas with the notice |
| nikpau/mmgdynamics | MMG manoeuvring model (Python) | MIT, © 2022–2026 N. Paulig | **Yes** |
| cybergalactic/PythonVehicleSimulator | Fossen marine craft models (Python) | MIT text, but the copyright line is the template "© 2018 The Python Packaging Authority" | Yes (MIT). Also credit Fossen; the copyright line is a template mistake. |
| cybergalactic/MSS | Fossen Marine Systems Simulator (MATLAB), Capytaine pipeline, small USV "Otter" | MIT, © 2004 Thor I. Fossen | **Yes** |
| capytaine/capytaine | BEM potential-flow solver (offline added mass and damping) | Apache-2.0 | Yes, but use it offline; its outputs are just data |
| LHEEA/Nemoh, YingyiLiu/HAMS | BEM solvers | Apache-2.0 | Yes (offline) |
| WEC-Sim/WEC-Sim | Time-domain wave-body simulator (MATLAB) | Apache-2.0 | Yes |
| osrf/vrx | Gazebo maritime simulator (C++) | Apache-2.0 | Yes (keep NOTICE; patent grant) |
| uuvsimulator/uuv_simulator | Fossen-style underwater vehicle plugins | Apache-2.0 | Yes |
| Tearth/Real-Ship-Physics | Voxel ship buoyancy and flooding (Unity) | Apache-2.0 | Yes |
| godot-extended-libraries/hydro | Godot buoyancy module | MIT, © 2019 Jon Ring | Yes |
| mikest/halyard | Godot ropes plus volume buoyancy (C++) | MIT (several authors) | Yes |
| saurus/Buoyancy, Adisoreq/godot-waterbox | Godot buoyancy | MIT | Yes |
| tessarakkt/godot4-oceanfft | Godot FFT ocean with basic buoyancy | MIT | Yes |
| jbouny/ocean, jbouny/fft-ocean | three.js oceans | MIT | Yes |
| mrdoob/three.js; pmndrs/cannon-es | Renderer; JS physics | MIT; MIT | Yes |
| dimforge/rapier.js | WASM physics | Apache-2.0 | Yes |
| bridgecommand/bc | Ship simulator (Bridge Command) | **GPL-2.0**; some bundled models may only be used with Bridge Command | **No** for closed source; ideas only |
| patrykcieslak/stonefish | Marine robotics simulator | README says **GPL-3.0** (no LICENSE at the common paths) | **No**; ideas only |
| OpenFOAM | CFD | GPL-3.0 (well known; file not re-read) | No, but offline CFD *results* used as tuning data are fine |
| Unreal Engine Water plugin | Engine plugin | Unreal Engine EULA (proprietary; engine code is for Unreal-based products; the EULA page was not reachable to re-read) | **No** outside Unreal; ideas only |
| NWH Dynamic Water Physics 2 | Unity asset | Proprietary (Asset Store EULA) | **No**; ideas only |
| corentin-ryr/Boat-Simulation, gameidea-org/3d-boat-physics | Small demos | No licence file found | **No**; ideas only |

**Note.** Equations, physical constants and published empirical formulas (Savitsky, MMG, ITTC-57, Zarnick, catenary) are not protected by copyright. They can be implemented from the papers whatever the licence of any repository that also implements them. Cite the papers. Copying a specific implementation's code is what triggers its licence.

---

## 12. CPU cost: micro-benchmark

(The benchmark script was a throwaway stand-in, not the game's code, and isn't kept.)

**Setup.**
- A V-hull of 231 vertices and 400 triangles.
- A 16×16 bilinear water patch.
- Kerner-style clipping, hydrostatic, pressure-drag, viscous and slam terms.
- Node 22 on a 2.1 GHz Xeon; best of 5 runs of 20,000 substeps; noise about ±10%.

| Variant | µs/substep | ms/frame at 4 substeps |
|---|---|---|
| Baseline panel loop | 44–46 | 0.18 |
| + Smith depth decay (an exp per vertex) | 50 | 0.20 |
| + orbital velocity (3 extra lookups per vertex) | 53–62 | 0.21–0.25 |
| + air drag on dry panels | 40–44 (noise) | 0.17 |
| + 20-strip Wagner/Zarnick | 45–53 | 0.18–0.21 |
| + 6×6 added-mass solve | 41 (noise) | 0.17 |
| + catenary Newton, 1 rode | 47–56 | 0.19–0.22 |
| + MMG propeller and rudder | 42–48 | 0.17–0.19 |
| **All of the above** | **70–83** | **0.28–0.33** |

At 800 triangles the baseline is about 98 µs and everything together about 171 µs.

Mid-range phones run JIT-compiled JS roughly 2–4× slower than this desktop core **(my estimate)**. So "everything" is about 0.6–1.3 ms per boat per frame at 4 substeps. The biggest cost is still the existing panel loop.

**Cheap ways to stay under 1 ms on phones (my suggestions):**
- Evaluate the orbital-velocity patch and the air panels at frame rate, not at substep rate.
- Use typed arrays and no allocation inside the loop. The benchmark's `lerp` allocates and still fits.
- Use 2 substeps when a boat is far from the camera.
- Run the Savitsky checks offline.

---

## 13. Open uncertainties

- The ranking is engineering judgement. It is not measured player-perception data.
- Several numbers are **my estimates** and are marked as such:
  - a_33 range;
  - drift sock C_D;
  - prop-walk magnitude;
  - ventilation thresholds;
  - helm rates;
  - gust intensity;
  - anchor break-out angle.
- The IMO roll-period formula, Barrass squat, ITTC roll-damping procedure, Unreal EULA terms, the SOLAS steering requirement, Causin et al. and DNV-RP-C205 were not re-read in primary form this session. They are cited from secondary copies or from knowledge.
- No public technical material was found for Sea of Thieves' ship physics, AC IV's boat model, Sailaway, Ship Simulator, Fishing Planet, Ultimate Fishing Simulator or NWH DWP2.
- The year of Kerner's Part 2: the publisher page shows 8 January 2016, while the brief said 2015. Part 1 is dated 27 February 2015.
