import { useState, type ReactNode } from 'react';

interface Topic {
  id: string;
  title: string;
  content: ReactNode;
}

const TOPICS: Topic[] = [
  {
    id: 'nonlinear',
    title: 'What causes nonlinear distortion',
    content: (
      <>
        <p>
          A linear two-port produces an output that is a scaled, delayed copy of
          its input. Real RF devices — transistors, diodes, saturated magnetics —
          have a transfer curve that bends. For a memoryless weakly nonlinear
          device the output can be written as a power series
        </p>
        <div className="equation">v_out = a1 v_in + a2 v_in² + a3 v_in³ + …</div>
        <p>
          The linear term a1 is the small-signal voltage gain. The even-order
          terms (a2, a4, …) generate DC offsets and sum/difference products. The
          odd-order terms (a3, a5, …) generate gain compression and
          intermodulation that lands close to the original tones.
        </p>
        <p>
          The series is only useful while the device is still “weakly”
          nonlinear. Once a stage is compressing, higher-order terms dominate
          and the cubic IP3 model no longer predicts measured IM3. That is why
          this lab draws IP3 as an extrapolation and stops the solid traces at
          P1dB (or IIP3 − 10 dB).
        </p>
      </>
    ),
  },
  {
    id: 'amp-im',
    title: 'How amplifiers generate intermodulation',
    content: (
      <>
        <p>
          Start from the weakly nonlinear transfer and drive it with two
          in-band tones of equal amplitude. Equal amplitude means equal power,
          because both tones see the same resistance:
        </p>
        <div className="equation">
          v_out = a1 v_in + a2 v_in² + a3 v_in³ + …
          <br />
          v_in = A cos(2π f1 t) + A cos(2π f2 t)
        </div>
        <p>
          The linear term copies the two tones to the output at amplitude
          a1 A. Even-order terms produce a DC offset, second harmonics, and
          the sum and difference f1 ± f2, which sit far from a narrow channel.
          The tones that land beside the original pair come from the cubic.
          Write ω1 = 2π f1 and ω2 = 2π f2, and substitute the two-tone input:
        </p>
        <div className="equation">
          a3 v_in³ = a3 A³ [cos(ω1 t) + cos(ω2 t)]³
          <br />
          = a3 A³ [ cos³(ω1 t) + cos³(ω2 t)
          <br />
          &nbsp;&nbsp;+ 3 cos²(ω1 t) cos(ω2 t) + 3 cos(ω1 t) cos²(ω2 t) ]
        </div>
        <p>
          Each pure cube, cos³(ω t) = [3 cos(ω t) + cos(3ω t)] / 4, only
          rebuilds the original tone and adds a third harmonic at 3f1 or 3f2.
          The new nearby frequencies are in the cross terms. Expand one of
          them with cos² θ = (1 + cos 2θ) / 2 and
          cos α cos β = (1/2) [cos(α + β) + cos(α − β)]:
        </p>
        <div className="equation">
          3 cos²(ω1 t) cos(ω2 t)
          <br />
          = (3/2) [1 + cos(2ω1 t)] cos(ω2 t)
          <br />
          = (3/2) cos(ω2 t) + (3/2) cos(2ω1 t) cos(ω2 t)
          <br />
          = (3/2) cos(ω2 t)
          <br />
          &nbsp;&nbsp;+ (3/4) [cos((2ω1 + ω2) t) + cos((2ω1 − ω2) t)]
          <br />
          = (3/2) cos(ω2 t)
          <br />
          &nbsp;&nbsp;+ (3/4) cos((2ω1 + ω2) t)
          <br />
          &nbsp;&nbsp;+ (3/4) cos((2ω1 − ω2) t)
        </div>
        <p>
          Multiply back by a3 A³. The last line is a tone at 2f1 − f2 with
          voltage amplitude (3/4) a3 A³. The other cross term produces the
          same amplitude at 2f2 − f1. The (3/2) cos(ω2 t) piece, and the
          on-tone piece of each pure cube, fall back on the original tones.
          That is gain compression. The IP3 lines use the small-signal
          fundamental a1 A and leave that compression out. The sum
          frequencies 2f1 + f2 and 2f2 + f1 fall far above the band.
        </p>
        <p>
          Where the products sit depends on the tone spacing. Let
          f2 = f1 + Δf:
        </p>
        <div className="equation">
          2f1 − f2 = 2f1 − (f1 + Δf) = f1 − Δf
          <br />
          2f2 − f1 = 2(f1 + Δf) − f1 = f1 + 2Δf
        </div>
        <p>
          The lower product is Δf below f1 and 2Δf below f2. The upper product
          is Δf above f2 and 2Δf above f1. Both often fall inside the channel
          filter, so they cannot be removed after the fact.
        </p>
        <p>
          Power is proportional to voltage squared. The small-signal
          fundamental of each tone has amplitude a1 A, and each IM3 product
          has amplitude (3/4) a3 A³. IIP3 is the input power of each tone at
          which those two extrapolated amplitudes would match:
        </p>
        <div className="equation">
          |a1| A_IP = (3/4) |a3| A_IP³
          <br />
          A_IP² = (4/3) |a1 / a3|
        </div>
        <p>
          At a general drive A the voltage ratio is then
        </p>
        <div className="equation">
          V_IM3 / V_fund = [(3/4) |a3| A³] / (|a1| A) = A² / A_IP²
        </div>
        <p>
          Each tone’s power scales as A², so in linear units
          Pin / IIP3 = A² / A_IP². Squaring the voltage ratio turns that into
          the power ratio:
        </p>
        <div className="equation">
          P_IM3,out / P_fund,out = (V_IM3 / V_fund)² = (Pin / IIP3)²
        </div>
        <p>
          Convert the ratio to decibels. 10 log10 of a square is twice
          10 log10 of the ratio, and the fundamental output is the tone plus
          the stage gain, P_fund,out = Pin + G:
        </p>
        <div className="equation">
          P_IM3,out = P_fund,out + 2 (Pin − IIP3)
          <br />
          = (Pin + G) + 2 Pin − 2 IIP3
          <br />
          = 3 Pin + G − 2 IIP3
        </div>
        <p>
          This lab refers the product back to the input by subtracting G.
          The gain cancels, which leaves the equation used everywhere else
          in the lab:
        </p>
        <div className="equation">
          P_IM3 (dBm) = P_IM3,out − G = 3 Pin − 2 IIP3
          <br />
          &nbsp;&nbsp;(equal tones, input-referred)
        </div>
        <p>
          Example: IIP3 = 0 dBm and two tones at −40 dBm each. Then each IM3
          product is 3×(−40) − 2×(0) = −120 dBm. Raise the tones 1 dB, to
          −39 dBm, and the same formula gives 3×(−39) = −117 dBm, up 3 dB.
          Raise IIP3 1 dB, to +1 dBm, and it gives 3×(−40) − 2×(1) = −122 dBm,
          down 2 dB. That 3-for-1 / 2-for-1 geometry is the whole IP3 plot.
        </p>
        <p>
          Unequal tones use the same cross term with unequal amplitudes,
          v_in = A1 cos(ω1 t) + A2 cos(ω2 t). The product at 2f1 − f2 then
          has amplitude (3/4) a3 A1² A2 instead of (3/4) a3 A³. Power follows
          A1⁴ A2², which is two parts of the first tone and one part of the
          second:
        </p>
        <div className="equation">
          P(2f1 − f2) = 2 P1 + P2 − 2 IIP3
          <br />
          P(2f2 − f1) = 2 P2 + P1 − 2 IIP3
        </div>
        <p>
          Equal tones are the special case P1 = P2 = Pin, and both lines
          collapse to 3 Pin − 2 IIP3. A strong blocker next to a weak desired
          signal therefore degrades the weaker tone’s neighborhood more than
          a casual “two equal tones” calculation suggests: the product beside
          the weak tone carries the blocker twice.
        </p>
      </>
    ),
  },
  {
    id: 'mixer-conv',
    title: 'How mixers perform frequency conversion',
    content: (
      <>
        <p>
          A mixer is a multiplier. In the frequency domain, multiplying by a
          local oscillator at f_LO produces copies of the RF spectrum at
          |f_RF ± f_LO|. A downconverting receiver keeps the difference
          (lower sideband); an upconverter keeps the sum (upper sideband).
        </p>
        <div className="equation">
          f_IF = |f_RF − f_LO| &nbsp;(lower) &nbsp; or &nbsp; f_RF + f_LO &nbsp;(upper)
        </div>
        <p>
          The default lab case is two RF tones at 2.09 GHz and 2.11 GHz with
          an LO at 2.00 GHz, lower sideband. The wanted IF tones land at
          90 MHz and 110 MHz. The RF IM3 products at 2.07 GHz and 2.13 GHz
          convert to 70 MHz and 130 MHz — still near the IF, which is why
          IP3 of the RF chain matters after the mixer as well as before it.
        </p>
        <p>
          Conversion gain (or loss) replaces the amplifier’s S21 in the
          cascade. A passive diode mixer is typically −6 to −8 dB; an active
          mixer can have positive conversion gain but usually a worse IIP3.
          The image frequency (the other RF that also converts to the same IF)
          must be rejected by the RF filter in front of the mixer.
        </p>
      </>
    ),
  },
  {
    id: 'spurs-vs-im',
    title: 'Mixer spurs versus intermodulation',
    content: (
      <>
        <p>
          Intermodulation is generated by a nonlinearity acting on two (or
          more) RF tones: 2f1 − f2 is an IM3 product. A mixer spur is a
          different mechanism: the mixer also multiplies harmonics of the RF
          by harmonics of the LO,
        </p>
        <div className="equation">f_spur = |m · f_RF ± n · f_LO|</div>
        <p>
          Those (m × n) products exist even with a single RF tone. A classic
          example is the 2 × 2 spur of a diode mixer, |2 f_RF − 2 f_LO|,
          which for the lab’s default case sits at 180 MHz and 220 MHz — not
          at the IM3 frequencies. Treating an LO harmonic as if it were
          third-order intermodulation will put the spur in the wrong place
          and at the wrong level.
        </p>
        <p>
          Spur amplitudes in this lab are labeled <em>illustrative</em> unless
          you paste a measured spur table. A real mixer’s spur table is taken
          at a stated RF drive and LO power; it does not scale like the
          two-tone IM3 law, and it is not interchangeable with IIP3.
        </p>
      </>
    ),
  },
  {
    id: 'im2-im3',
    title: 'Second-order versus third-order distortion',
    content: (
      <>
        <p>
          Second-order products from two tones sit at f1 + f2 and |f1 − f2|.
          For a 2.1 GHz pair 20 MHz apart those are 4.2 GHz and 20 MHz —
          usually far from the RF channel. A half-IF spur (f_LO + f_IF/2)
          is the case where IM2 actually matters in a downconverter: a
          blocker at that frequency mixes with itself (or with the LO’s
          second harmonic) into the IF.
        </p>
        <div className="equation">
          P_IM2 = P1 + P2 − IIP2 &nbsp;&nbsp;&nbsp; P_IM3 = 2P1 + P2 − 2 IIP3
        </div>
        <p>
          IM2 therefore rises 2 dB per dB of input (slope 2 on a Pout-vs-Pin
          plot) and IM3 rises 3 dB per dB. Differential / balanced circuits
          suppress even-order terms, which is why a well-designed LNA often
          quotes IIP2 tens of dB above IIP3 and why this lab omits IM2 unless
          you enter an IIP2.
        </p>
        <p>
          Narrowband receivers worry about IM3. Wideband, zero-IF, and
          poorly filtered front-ends have to budget IM2 as well.
        </p>
      </>
    ),
  },
  {
    id: 'iip3-oip3',
    title: 'Input IP3 versus output IP3',
    content: (
      <>
        <p>
          IP3 is the fictitious input (or output) power at which the
          extrapolated fundamental and IM3 curves meet. It is not a power
          the device can deliver.
        </p>
        <div className="equation">OIP3 = IIP3 + G &nbsp;&nbsp;(dBm, G in dB)</div>
        <p>
          Quote IIP3 when you care about what the preceding stage may send
          you (blockers at the antenna, mixer input). Quote OIP3 when you
          care about what you hand the next stage. Cascading is done
          input-referred: each stage’s IIP3 is divided by the linear gain in
          front of it, then the reciprocals are summed. A high-gain LNA with
          a modest IIP3 will often set the receiver IIP3 even if the mixer’s
          standalone IIP3 looks worse on the data sheet.
        </p>
        <p>
          On the IP3 tab the intercept is the point (IIP3, OIP3). Moving
          gain slides that point vertically; moving IIP3 slides it along
          the 1 dB/dB line.
        </p>
      </>
    ),
  },
  {
    id: 'nf-sens',
    title: 'Noise figure and receiver sensitivity',
    content: (
      <>
        <p>
          Thermal noise in a bandwidth B at temperature T is kTB. At the
          IEEE standard T0 = 290 K that is −173.98 dBm/Hz, usually rounded
          to −174 dBm/Hz. A 1 MHz channel is then −114 dBm before any
          receiver noise is added.
        </p>
        <div className="equation">N (dBm) = kTB + NF &nbsp;&nbsp;&nbsp; MDS = N + SNR_min</div>
        <p>
          Noise figure is how much worse than kTB the receiver is. Friis’
          formula says the first stages dominate: an LNA with NF = 1.2 dB
          and 18 dB of gain makes a mixer NF of 8 dB contribute only about
          0.1 dB to the cascade. That is why the lab’s default chain puts
          the LNA first after a low-loss preselect filter.
        </p>
        <p>
          Sensitivity (MDS) is the noise floor plus whatever SNR the
          demodulator needs. A 10 dB SNR requirement on a −110 dBm noise
          floor is an MDS of −100 dBm. Filtering a blocker does not change
          kTB in the desired channel; it only changes how much of the
          blocker reaches a nonlinear stage.
        </p>
      </>
    ),
  },
  {
    id: 'noise-floor',
    title: 'How the noise floor is calculated',
    content: (
      <>
        <p>
          Every noise-floor readout in this lab is the same calculation:
          thermal noise power in a stated bandwidth, converted to dBm, then
          raised by the noise figure. The code evaluates it from Boltzmann’s
          constant, k = 1.380649×10⁻²³ J/K.
        </p>
        <div className="equation">
          kTB (W) = k · T · B
          <br />
          N (dBm) = 10 log10(kTB × 1000) + NF
        </div>
        <p>
          T is the temperature in the panel, 290 K unless you change it.
          B is the Bandwidth field, in hertz. Multiplying by 1000 converts
          watts to milliwatts, which is what puts the logarithm in dBm. NF,
          in dB, is added after that conversion, so one extra decibel of
          noise figure lifts the floor by one decibel. On the Cascade tab
          that NF is the Friis total for the chain. On the IP3 and Spectrum
          tabs it is the Noise figure field, which tracks the cascade while
          the tab is linked.
        </p>
        <p>
          At 290 K, kT is −173.98 dBm in a 1 Hz bandwidth. Hand calculation
          rounds that to −174 dBm/Hz and folds the bandwidth in as
          10 log10(B):
        </p>
        <div className="equation">
          N (dBm) ≈ −174 + 10 log10(B) + NF &nbsp;&nbsp;(T = 290 K)
        </div>
        <p>
          A 1 MHz bandwidth with NF = 0 dB is −174 + 60 + 0 = −114 dBm. The
          same bandwidth with NF = 5 dB is −109 dBm. Doubling B adds 3.01 dB;
          doubling T does the same, and any temperature other than 290 K goes
          back through the kTB expression above. The IP3 tab’s “Spec example”
          sets B ≈ 251 kHz and NF = 0 dB so this formula returns −120 dBm.
        </p>
        <p>
          Gain is applied after the sum. The Cascade summary, the RF
          spectrum, and SFDR use this input-referred N. The output-referred
          floor — “N (output)” on the IP3 tab, and the IF spectrum — is the
          same number plus the gain:
        </p>
        <div className="equation">N_out (dBm) = N + G</div>
        <p>
          The spectrum analyzer trace repeats the formula with the resolution
          bandwidth in place of B. On the IF side that trace floor is also
          shifted by G.
        </p>
        <div className="equation">
          trace (dBm) = 10 log10(k · T · RBW · 1000) + NF
        </div>
        <p>
          Leave Analyzer RBW blank and it equals B, so the trace sits on the
          receiver floor. An RBW of B/100 drops the trace 20 dB. The labeled
          receiver floor and SFDR keep using the Bandwidth field, so they
          stay put when only RBW changes.
        </p>
      </>
    ),
  },
  {
    id: 'sfdr',
    title: 'Spurious-free dynamic range',
    content: (
      <>
        <p>
          Third-order SFDR is the input-power range over which a two-tone
          signal stays above the noise floor while its IM3 products stay
          below it. Geometrically it is the vertical green span on the IP3
          plot, or the horizontal span from N to the Pin where IM3 crosses N.
        </p>
        <div className="equation">SFDR3 = (2/3) (IIP3 − N)</div>
        <p>
          The spec’s check case: IIP3 = 0 dBm, N = −120 dBm → SFDR = 80 dB.
          Two equal tones at −40 dBm sit exactly at that upper edge — each
          IM3 product is −120 dBm, on the noise floor. The “Spec example”
          button on the IP3 tab loads this picture (B ≈ 251 kHz, NF = 0 dB,
          T = 290 K).
        </p>
        <p>
          SFDR is not the same as compression dynamic range (P1dB − N). A
          receiver can have plenty of SFDR and still compress on a single
          strong carrier, or the reverse if P1dB is far below the IP3
          extrapolation. This lab reports both when a P1dB is available.
        </p>
      </>
    ),
  },
  {
    id: 'ip3-n-sfdr',
    title: 'IP3, noise floor, and SFDR',
    content: (
      <>
        <p>
          Three numbers fix the two-tone picture: IIP3, N, and G. G only
          slides the plot up and down. IIP3 and N set the SFDR:
        </p>
        <div className="equation">
          Pin | IM3 = N &nbsp;=&nbsp; (N + 2 IIP3) / 3
          <br />
          SFDR3 &nbsp;=&nbsp; Pin|IM3=N − N &nbsp;=&nbsp; (2/3)(IIP3 − N)
        </div>
        <p>
          Improving IIP3 6 dB (a better mixer, or less gain in front of a
          weak stage) buys 4 dB of SFDR. Narrowing B by 4× (6 dB less noise)
          also buys 4 dB of SFDR. Those two knobs are not interchangeable
          on the bench: reducing bandwidth will not help you if the IM3
          products already sit inside the channel, and a better IIP3 will
          not help you if the noise floor is the limit on a single weak
          carrier.
        </p>
        <p>
          Change IIP3, NF, or B on the IP3 tab and watch the green SFDR
          span move. The change strip above the plot states the 2/3 and
          2× scaling so the geometry stays attached to the algebra.
        </p>
      </>
    ),
  },
  {
    id: 'p1db',
    title: 'Gain compression and P1dB',
    content: (
      <>
        <p>
          P1dB is the power at which the fundamental is 1 dB below the
          small-signal gain line — a measured compression point, not an
          extrapolation. Input-referred (IP1dB) and output-referred (OP1dB)
          differ by the compressed gain, which is 1 dB less than the
          small-signal gain, so OP1dB ≈ IP1dB + G − 1 dB.
        </p>
        <p>
          A common amplifier rule of thumb is IP1dB ≈ IIP3 − 9 to −12 dB.
          It is a rule of thumb, not a law: some linearized stages are
          farther apart, and a mixer’s P1dB vs IIP3 ratio depends on LO
          drive. This lab never computes cascaded P1dB by adding stage
          P1dB values. It reports the first stage that would compress,
          referred to the input through the preceding small-signal gain,
          and labels it an estimate.
        </p>
        <p>
          Above P1dB the IP3 plot is not physical. IM3 no longer follows
          a 3 dB/dB line, gain is dropping, and a single-tone blocker can
          desensitize the receiver by compressing the LNA. Use P1dB (or
          the IIP3 − 10 dB stand-in) as the right-hand edge of any claim
          you take off this plot.
        </p>
      </>
    ),
  },
  {
    id: 'limits',
    title: 'Engineering limitations of this lab',
    content: (
      <>
        <p>
          The calculations are the standard small-signal cascade model.
          They are technically defensible inside that model and misleading
          outside it.
        </p>
        <ul>
          <li>
            IP3 is an extrapolated intercept, not a saturation power. Do
            not treat IIP3 as a level the receiver can accept.
          </li>
          <li>
            The cubic IM3 law is only valid well below compression. Solid
            traces stop at P1dB or IIP3 − 10 dB; dashed traces are there
            so you can see the geometry, not so you can read a power off
            them.
          </li>
          <li>
            Cascaded P1dB is an estimate from the first-compressing stage,
            not a sum of stage P1dB values.
          </li>
          <li>
            Mixer spur levels and LO-harmonic suppression are illustrative
            unless you supply a measured spur table. LO harmonics are not
            IM3 products.
          </li>
          <li>
            Frequency responses are flat inside each part’s declared band.
            A real filter attenuates each interferer differently; a blocker
            in the stopband does not arrive at the LNA at the power you
            typed.
          </li>
          <li>
            Passive NF equals insertion loss (resistive, matched, T = T0).
            A cool filter in front of a cryogenic LNA is a different
            problem.
          </li>
          <li>
            Input-referred and output-referred numbers differ by the
            cascade gain. The RF spectrum plot is input-referred; the IF
            plot is output-referred.
          </li>
        </ul>
        <p>
          Default component values are representative of a 2 GHz
          downconverter. They are not a specification of real hardware.
        </p>
      </>
    ),
  },
];

export function LearnTab() {
  const [id, setId] = useState(TOPICS[0].id);
  const topic = TOPICS.find((t) => t.id === id) ?? TOPICS[0];

  return (
    <div>
      <div className="callout">
        Practical notes on the models this lab uses. Parameter tooltips on
        every tab repeat the same definitions in short form.
      </div>
      <div className="learn-layout">
        <div className="panel">
          <h2>Topics</h2>
          <ul className="topics">
            {TOPICS.map((t) => (
              <li key={t.id}>
                <button
                  className={t.id === topic.id ? 'active' : ''}
                  onClick={() => setId(t.id)}
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel article">
          <h2>{topic.title}</h2>
          {topic.content}
        </div>
      </div>
    </div>
  );
}
