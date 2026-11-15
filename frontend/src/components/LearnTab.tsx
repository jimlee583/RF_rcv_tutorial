import { useState, type ReactNode } from 'react';

import { PassiveDiodeMixerFigures } from './DiodeMixerFigure';
import { Equation } from './Equation';

interface Topic {
  id: string;
  title: string;
  /** Let the diagram use the column while body text stays at the usual measure. */
  wide?: boolean;
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
          have a transfer curve that bends. Call that curve f. A memoryless
          device has an output voltage that depends only on the input voltage
          at the same instant:
        </p>
        <Equation
          tex={String.raw`v_{\mathrm{out}}(t) = f\bigl(v_{\mathrm{in}}(t)\bigr)`}
        />
        <p>
          v_in and v_out are the RF swings measured from the DC bias, so f is
          expanded about the bias point and the constant term is the bias
          itself. A small swing stays on the straight part of the curve. A
          larger swing reaches the bend, where the transistor’s
          transconductance changes or the stage begins to compress. Any smooth
          curve has a Taylor series about that point:
        </p>
        <Equation
          tex={String.raw`v_{\mathrm{out}} = f'(0)\,v_{\mathrm{in}} + \frac{1}{2}f''(0)\,v_{\mathrm{in}}^{2} + \frac{1}{6}f'''(0)\,v_{\mathrm{in}}^{3} + \cdots`}
        />
        <p>
          Folding each factorial into its coefficient gives the power series
          used for a weakly nonlinear device:
        </p>
        <Equation
          tex={String.raw`v_{\mathrm{out}} = a_1 v_{\mathrm{in}} + a_2 v_{\mathrm{in}}^{2} + a_3 v_{\mathrm{in}}^{3} + \cdots`}
        />
        <p>
          The linear term a1 = f'(0) is the small-signal voltage gain.
          a2 = f''(0)/2 and a3 = f'''(0)/6 are the curvature. The even-order
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
        <Equation
          tex={String.raw`\begin{aligned}
            v_{\mathrm{out}} &= a_1 v_{\mathrm{in}} + a_2 v_{\mathrm{in}}^{2} + a_3 v_{\mathrm{in}}^{3} + \cdots \\
            v_{\mathrm{in}} &= A \cos(2\pi f_1 t) + A \cos(2\pi f_2 t)
          \end{aligned}`}
        />
        <p>
          The linear term copies the two tones to the output at amplitude
          a1 A. Even-order terms produce a DC offset, second harmonics, and
          the sum and difference f1 ± f2, which sit far from a narrow channel.
          The tones that land beside the original pair come from the cubic.
          Write ω1 = 2π f1 and ω2 = 2π f2, and substitute the two-tone input:
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            a_3 v_{\mathrm{in}}^{3} &= a_3 A^{3} \bigl[\cos(\omega_1 t) + \cos(\omega_2 t)\bigr]^{3} \\
            &= a_3 A^{3} \bigl[\cos^{3}(\omega_1 t) + \cos^{3}(\omega_2 t) \\
            &\qquad + 3\cos^{2}(\omega_1 t)\cos(\omega_2 t) + 3\cos(\omega_1 t)\cos^{2}(\omega_2 t)\bigr]
          \end{aligned}`}
        />
        <p>
          Each pure cube, cos³(ω t) = [3 cos(ω t) + cos(3ω t)] / 4, only
          rebuilds the original tone and adds a third harmonic at 3f1 or 3f2.
          The new nearby frequencies are in the cross terms. Expand one of
          them with cos² θ = (1 + cos 2θ) / 2 and
          cos α cos β = (1/2) [cos(α + β) + cos(α − β)]:
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            3\cos^{2}(\omega_1 t)\cos(\omega_2 t)
            &= \tfrac{3}{2}\bigl[1 + \cos(2\omega_1 t)\bigr]\cos(\omega_2 t) \\
            &= \tfrac{3}{2}\cos(\omega_2 t) + \tfrac{3}{2}\cos(2\omega_1 t)\cos(\omega_2 t) \\
            &= \tfrac{3}{2}\cos(\omega_2 t) \\
            &\qquad + \tfrac{3}{4}\bigl[\cos((2\omega_1 + \omega_2)t) + \cos((2\omega_1 - \omega_2)t)\bigr] \\
            &= \tfrac{3}{2}\cos(\omega_2 t) \\
            &\qquad + \tfrac{3}{4}\cos((2\omega_1 + \omega_2)t) \\
            &\qquad + \tfrac{3}{4}\cos((2\omega_1 - \omega_2)t)
          \end{aligned}`}
        />
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
        <Equation
          tex={String.raw`\begin{aligned}
            2f_1 - f_2 &= 2f_1 - (f_1 + \Delta f) = f_1 - \Delta f \\
            2f_2 - f_1 &= 2(f_1 + \Delta f) - f_1 = f_1 + 2\Delta f
          \end{aligned}`}
        />
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
        <Equation
          tex={String.raw`\begin{aligned}
            |a_1| \, A_{\mathrm{IP}} &= \tfrac{3}{4} \, |a_3| \, A_{\mathrm{IP}}^{3} \\
            A_{\mathrm{IP}}^{2} &= \tfrac{4}{3} \left|\frac{a_1}{a_3}\right|
          \end{aligned}`}
        />
        <p>
          At a general drive A the voltage ratio is then
        </p>
        <Equation
          tex={String.raw`\frac{V_{\mathrm{IM3}}}{V_{\mathrm{fund}}} = \frac{\tfrac{3}{4}\,|a_3|\,A^{3}}{|a_1|\,A} = \frac{A^{2}}{A_{\mathrm{IP}}^{2}}`}
        />
        <p>
          Each tone’s power scales as A², so in linear units
          Pin / IIP3 = A² / A_IP². Squaring the voltage ratio turns that into
          the power ratio:
        </p>
        <Equation
          tex={String.raw`\frac{P_{\mathrm{IM3,out}}}{P_{\mathrm{fund,out}}} = \left(\frac{V_{\mathrm{IM3}}}{V_{\mathrm{fund}}}\right)^{2} = \left(\frac{P_{\mathrm{in}}}{\mathrm{IIP3}}\right)^{2}`}
        />
        <p>
          Convert the ratio to decibels. 10 log10 of a square is twice
          10 log10 of the ratio, and the fundamental output is the tone plus
          the stage gain, P_fund,out = Pin + G:
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            P_{\mathrm{IM3,out}} &= P_{\mathrm{fund,out}} + 2\,(P_{\mathrm{in}} - \mathrm{IIP3}) \\
            &= (P_{\mathrm{in}} + G) + 2\,P_{\mathrm{in}} - 2\,\mathrm{IIP3} \\
            &= 3\,P_{\mathrm{in}} + G - 2\,\mathrm{IIP3}
          \end{aligned}`}
        />
        <p>
          This lab refers the product back to the input by subtracting G.
          The gain cancels, which leaves the equation used everywhere else
          in the lab:
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            P_{\mathrm{IM3}}\ (\mathrm{dBm}) &= P_{\mathrm{IM3,out}} - G = 3\,P_{\mathrm{in}} - 2\,\mathrm{IIP3} \\
            &\text{(equal tones, input-referred)}
          \end{aligned}`}
        />
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
        <Equation
          tex={String.raw`\begin{aligned}
            P(2f_1 - f_2) &= 2\,P_1 + P_2 - 2\,\mathrm{IIP3} \\
            P(2f_2 - f_1) &= 2\,P_2 + P_1 - 2\,\mathrm{IIP3}
          \end{aligned}`}
        />
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
        <Equation
          tex={String.raw`f_{\mathrm{IF}} = |f_{\mathrm{RF}} - f_{\mathrm{LO}}|\ \text{(lower)} \quad\text{or}\quad f_{\mathrm{RF}} + f_{\mathrm{LO}}\ \text{(upper)}`}
        />
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
          must be rejected by the RF filter in front of the mixer. How a
          diode ring does this multiply, and where that conversion loss comes
          from, is the next topic.
        </p>
      </>
    ),
  },
  {
    id: 'diode-mixer',
    title: 'How passive diode mixers work',
    wide: true,
    content: (
      <>
        <p>
          A passive diode mixer has no DC supply. The local oscillator is
          large enough to turn the diodes on and off, and that switching
          multiplies the RF. The product appears at the sum and at the
          difference of the two frequencies, and it is smaller than the RF
          at the input: the stage has conversion loss, where an amplifier
          would have had gain. The default “Downconverting mixer” in this
          lab is that part — conversion gain −7 dB, LO at +7 dBm.
        </p>
        <p>
          The multiply comes from the junction law. A Schottky diode follows
          the Shockley equation. Split the voltage into the large LO and the
          small RF:
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            i &= I_s \bigl(\exp(v / (n V_T)) - 1\bigr) \\
            v &= v_{\mathrm{LO}} + v_{\mathrm{RF}}, \quad |v_{\mathrm{RF}}| \ll |v_{\mathrm{LO}}|
          \end{aligned}`}
        />
        <p>
          VT = kT/q is about 26 mV at room temperature, and n is near 1 for
          a Schottky junction. The lab’s +7 dBm LO, delivered into 50 Ω, is
          about 0.71 V peak:
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            P &= 10^{((7 - 30)/10)} \approx 5.0\,\mathrm{mW} \\
            V_{\mathrm{peak}} &= \sqrt{2 \cdot P \cdot R} \approx 0.71\,\mathrm{V} \quad (R = 50\,\Omega) \\
            V_{\mathrm{peak}} / V_T &\approx 27
          \end{aligned}`}
        />
        <p>
          The exponent swings through tens of VT over an LO cycle, and the
          junction current changes by orders of magnitude. That is a switch.
          The power series in the distortion topic is this same exponential
          when the swing is only a few VT, which is how an amplifier is
          usually driven. Around the LO waveform, the piece of current linear
          in the small RF is a conductance times v_RF:
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            i_{\mathrm{RF}}(t) &\approx g(t) \cdot v_{\mathrm{RF}}(t) \\
            g(t) &= \mathrm{d}i/\mathrm{d}v \ \text{evaluated at}\ v_{\mathrm{LO}}(t)
          \end{aligned}`}
        />
        <p>
          g(t) repeats every LO cycle, so it has a Fourier series: a DC term
          that passes the RF, a term at f_LO that converts, and higher
          harmonics that become spurs. The converting term is a product. For
          one sinusoidal piece of g(t):
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            \cos(\omega_{\mathrm{RF}} t) \cdot \cos(\omega_{\mathrm{LO}} t)
            &= \tfrac{1}{2} \bigl[\cos((\omega_{\mathrm{RF}} + \omega_{\mathrm{LO}})t) + \cos((\omega_{\mathrm{RF}} - \omega_{\mathrm{LO}})t)\bigr]
          \end{aligned}`}
        />
        <p>
          Sum and difference come out at the same amplitude. With the lab
          defaults — an RF tone at 2.09 GHz, LO at 2.00 GHz, lower sideband —
          the kept tone is 90 MHz and the sum is 4.09 GHz. The spectrum tab
          draws that other sideband at the same level as the wanted IF. An
          IF filter keeps one and rejects the other.
        </p>
        <p>
          Driven this hard, each diode is either on or off. Its conductance
          is one-sided. The ring turns those two states into a multiply by
          ±1: one LO half-cycle connects the RF to the IF in one polarity,
          and the next half-cycle crosses the connection, which flips the
          sign. The effective transfer s(t) is a square wave at f_LO, and a
          square wave contains only odd harmonics:
        </p>
        <Equation
          tex={String.raw`s(t) = \frac{4}{\pi}\bigl[\sin(\omega_{\mathrm{LO}} t) + \tfrac{1}{3}\sin(3\omega_{\mathrm{LO}} t) + \tfrac{1}{5}\sin(5\omega_{\mathrm{LO}} t) + \cdots\bigr]`}
        />
        <p>
          Keep the fundamental and multiply by an RF tone A cos(ω_RF t).
          With sin A cos B = (1/2) [sin(A + B) + sin(A − B)]:
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            \frac{4}{\pi}\sin(\omega_{\mathrm{LO}} t) \cdot A\cos(\omega_{\mathrm{RF}} t)
            &= \frac{2A}{\pi}\bigl[\sin((\omega_{\mathrm{LO}} + \omega_{\mathrm{RF}})t) + \sin((\omega_{\mathrm{LO}} - \omega_{\mathrm{RF}})t)\bigr]
          \end{aligned}`}
        />
        <p>
          Each sideband has voltage amplitude (2/π) A. Into the same
          resistance, power follows voltage squared, so the ideal conversion
          loss of one sideband is
        </p>
        <Equation
          tex={String.raw`L_c = -20\log_{10}(2/\pi) = 20\log_{10}(\pi/2) \approx 3.9\,\mathrm{dB}`}
        />
        <p>
          That loss assumes a perfect switch, lossless baluns, and equal
          RF and IF resistances. Diode series resistance, transformer loss,
          and a finite switching time add a few decibels. A Schottky ring is
          typically 6 to 8 dB of conversion loss. The lab enters the default
          mixer as a conversion gain of −7 dB. For a passive, matched mixer
          at the standard temperature the noise figure equals that loss,
          which is why the default NF is 7 dB as well.
        </p>
        <PassiveDiodeMixerFigures />
        <p>
          The 1/3 and 1/5 coefficients are spurs from a single RF tone. The
          k-th odd harmonic of s(t) is 1/k in amplitude, or 20 log10(k) dB
          below the fundamental term — about 9.5 dB for the third harmonic.
          Even harmonics are absent from the square wave. The two halves of
          the ring also drive equal and opposite LO current into the IF tap,
          so the LO cancels there. A single diode multiplies by the same
          junction law, and both the LO and the RF reach its output pin. The
          ring is the circuit that suppresses them. The default LO-to-RF
          isolation of 25 dB is that cancellation, with the balance a real
          transformer actually achieves. The lab’s illustrative spur model
          follows the series: odd LO orders fall as 20 log10(n), and even
          orders take another 35 dB for the balance. A measured spur table
          replaces those levels.
        </p>
        <p>
          The LO has to be the voltage that decides which diodes are on.
          When the RF becomes comparable to the LO, g(t) depends on both
          voltages, the square wave softens, and conversion loss rises. That
          rise is compression. The default mixer puts input P1dB at +5 dBm,
          under the +7 dBm LO, and IIP3 at +15 dBm. A higher-level mixer is
          the same ring with a larger LO, often +13 dBm or +17 dBm, so the
          diodes stay switched out to a larger RF. Compression and IP3 both
          move up with that drive.
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
        <Equation
          tex={String.raw`f_{\mathrm{spur}} = |m \cdot f_{\mathrm{RF}} \pm n \cdot f_{\mathrm{LO}}|`}
        />
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
        <Equation
          tex={String.raw`P_{\mathrm{IM2}} = P_1 + P_2 - \mathrm{IIP2} \qquad P_{\mathrm{IM3}} = 2P_1 + P_2 - 2\,\mathrm{IIP3}`}
        />
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
        <Equation
          tex={String.raw`\mathrm{OIP3} = \mathrm{IIP3} + G \quad (\mathrm{dBm},\ G\ \text{in dB})`}
        />
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
    id: 'iip3-cascade',
    title: 'IIP3',
    content: (
      <>
        <p>
          Cascaded IIP3 is the input-referred intercept of the whole chain.
          Powers are in milliwatts and gains are linear power ratios,
          G = 10^(G_dB/10) and IIP3_mW = 10^(IIP3_dBm/10). Each stage’s
          intercept is divided by the gain in front of it, and those
          reciprocals are summed. G_prev of the first stage is 1. A stage
          with no IIP3 — a filter, an attenuator, or an amplifier left blank —
          is treated as ideally linear and adds nothing to the sum. Its gain
          still sits in G_prev of every stage after it. When a part quotes
          OIP3 and leaves IIP3 blank, the stage intercept is OIP3 − G.
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            \frac{1}{\mathrm{IIP3}_{\mathrm{mW}}} &= \sum_i \frac{G_{\mathrm{prev},i}}{\mathrm{IIP3}_{i,\mathrm{mW}}} \\
            \mathrm{IIP3}\ (\mathrm{dBm}) &= 10\log_{10}(\mathrm{IIP3}_{\mathrm{mW}}) \\
            G_{\mathrm{prev},1} &= 1, \quad G_{\mathrm{prev},i} = G_1 \cdot G_2 \cdots G_{i-1}
          \end{aligned}`}
        />
        <p>
          The lab default chain is the worked case. The two filters have no
          IIP3. The LNA quotes OIP3 = 30 dBm at 20 dB of gain, so its IIP3
          is 10 dBm (10 mW). The mixer quotes IIP3 = 15 dBm (31.62 mW). The
          IF amplifier quotes OIP3 = 35 dBm at 30 dB of gain, so its IIP3 is
          5 dBm (3.162 mW). Linear gains along the chain are 0.7943, 100,
          0.1995, 0.6310, and 1000.
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            \text{LNA:} \quad & G_{\mathrm{prev}} = 0.7943 \\
            & \text{term} = 0.7943 / 10 = 0.0794 \\
            \text{Mixer:} \quad & G_{\mathrm{prev}} = 0.7943 \times 100 = 79.43 \\
            & \text{term} = 79.43 / 31.62 = 2.512 \\
            \text{IF amp:} \quad & G_{\mathrm{prev}} = 79.43 \times 0.1995 \times 0.6310 = 10.00 \\
            & \text{term} = 10.00 / 3.162 = 3.162 \\
            & 1 / \mathrm{IIP3}_{\mathrm{mW}} = 0.0794 + 2.512 + 3.162 = 5.753 \\
            & \mathrm{IIP3} = 10\log_{10}(1 / 5.753) = -7.60\,\mathrm{dBm}
          \end{aligned}`}
        />
        <p>
          The ΣIIP3 column is this same sum stopped at the current stage.
          After the LNA the only term is 0.0794, so ΣIIP3 is +11.0 dBm: the
          LNA’s own +10 dBm, raised 1 dB by the preselect loss in front of
          it. Adding the mixer brings the sum to 2.591 and ΣIIP3 to −4.13 dBm.
          The IF filter adds no term, so ΣIIP3 stays −4.13 dBm through that
          stage. The IF amplifier then takes the cascade to −7.60 dBm.
        </p>
        <p>
          Total gain is −1 + 20 − 7 − 2 + 30 = 40 dB, so the output intercept
          of the chain is
        </p>
        <Equation
          tex={String.raw`\mathrm{OIP3} = \mathrm{IIP3} + G = -7.60 + 40 = 32.40\,\mathrm{dBm}`}
        />
        <p>
          Gain in front of a stage multiplies that stage’s term and lowers
          the cascade IIP3. The IF amplifier’s own intercept is 5 dBm, and
          10 dB of gain sits in front of it, so the intercept referred to
          the antenna is −5 dBm. That term is the largest of the three, and
          it sets the receiver. The LNA’s term is about 1% of the sum,
          because the only thing in front of it is 1 dB of filter loss.
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
        <Equation
          tex={String.raw`N\ (\mathrm{dBm}) = kTB + \mathrm{NF} \qquad \mathrm{MDS} = N + \mathrm{SNR}_{\min}`}
        />
        <p>
          Noise figure is how much worse than kTB the receiver is. For a
          chain of stages the total is Friis’ formula. Noise factor F and
          gain G are linear ratios, F = 10^(NF/10) and G = 10^(G_dB/10).
          The gain in each denominator is the product of the gains in front
          of that stage:
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            F_{\mathrm{total}} &= F_1 + \frac{F_2 - 1}{G_1} + \frac{F_3 - 1}{G_1 G_2} + \frac{F_4 - 1}{G_1 G_2 G_3} + \cdots \\
            \mathrm{NF}_{\mathrm{total}}\ (\mathrm{dB}) &= 10\log_{10}(F_{\mathrm{total}})
          \end{aligned}`}
        />
        <p>
          The first stage is taken in full. Each later stage is divided by
          the gain ahead of it, so a noisy stage after a lot of gain barely
          moves the total. A gain below 1 in front of a stage makes that
          stage count for more than its own noise figure.
        </p>
        <p>
          The lab default chain is the worked case. A passive filter’s noise
          figure equals its insertion loss, and its gain is that loss with a
          minus sign. In order: RF preselect (NF 1 dB, G −1 dB), LNA (NF 1 dB,
          G 20 dB), mixer (NF 7 dB, G −7 dB), IF filter (NF 2 dB, G −2 dB),
          IF amplifier (NF 3 dB, G 30 dB).
        </p>
        <Equation
          tex={String.raw`\begin{aligned}
            F &= 1.2589 + \frac{1.2589 - 1}{0.7943} + \frac{5.0119 - 1}{79.43} \\
            &\quad + \frac{1.5849 - 1}{15.85} + \frac{1.9953 - 1}{10} \\
            F &= 1.2589 + 0.3260 + 0.0505 + 0.0369 + 0.0995 = 1.7718 \\
            \mathrm{NF} &= 10\log_{10}(1.7718) = 2.48\,\mathrm{dB}
          \end{aligned}`}
        />
        <p>
          The preselect and the LNA account for 2.00 dB of that 2.48 dB.
          The mixer’s own NF is 7 dB, and it sits behind 19 dB of gain, so
          its term is 0.0505 and it adds 0.14 dB to the cascade. The IF
          amplifier still adds 0.25 dB: the mixer and the IF filter have
          given 9 dB of that gain back, and the gain in front of the IF
          amplifier is only 10 dB. At the default 1 MHz bandwidth and 290 K,
          the input noise floor is −114 dBm + 2.48 dB, about −111.5 dBm.
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
        <Equation
          tex={String.raw`\begin{aligned}
            kTB\ (\mathrm{W}) &= k \cdot T \cdot B \\
            N\ (\mathrm{dBm}) &= 10\log_{10}(kTB \times 1000) + \mathrm{NF}
          \end{aligned}`}
        />
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
        <Equation
          tex={String.raw`N\ (\mathrm{dBm}) \approx -174 + 10\log_{10}(B) + \mathrm{NF} \quad (T = 290\,\mathrm{K})`}
        />
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
        <Equation tex={String.raw`N_{\mathrm{out}}\ (\mathrm{dBm}) = N + G`} />
        <p>
          The spectrum analyzer trace repeats the formula with the resolution
          bandwidth in place of B. On the IF side that trace floor is also
          shifted by G.
        </p>
        <Equation
          tex={String.raw`\mathrm{trace}\ (\mathrm{dBm}) = 10\log_{10}(k \cdot T \cdot \mathrm{RBW} \cdot 1000) + \mathrm{NF}`}
        />
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
        <Equation
          tex={String.raw`\mathrm{SFDR}_3 = \tfrac{2}{3}\,(\mathrm{IIP3} - N)`}
        />
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
        <Equation
          tex={String.raw`\begin{aligned}
            \left. P_{\mathrm{in}} \right|_{\mathrm{IM3} = N} &= \frac{N + 2\,\mathrm{IIP3}}{3} \\
            \mathrm{SFDR}_3 &= \left. P_{\mathrm{in}} \right|_{\mathrm{IM3} = N} - N = \tfrac{2}{3}\,(\mathrm{IIP3} - N)
          \end{aligned}`}
        />
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
        <div
          className={topic.wide ? 'panel article article-wide' : 'panel article'}
          id={`learn-${topic.id}`}
        >
          <h2>{topic.title}</h2>
          {topic.content}
        </div>
      </div>
    </div>
  );
}
