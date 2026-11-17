import type { ReactNode } from 'react';

/** Topic ids match TOPICS in components/LearnTab.tsx. */
export type LearnTopicId =
  | 'nonlinear'
  | 'amp-im'
  | 'mixer-conv'
  | 'diode-mixer'
  | 'spurs-vs-im'
  | 'im2-im3'
  | 'iip3-oip3'
  | 'iip3-cascade'
  | 'nf-sens'
  | 'noise-floor'
  | 'sfdr'
  | 'ip3-n-sfdr'
  | 'p1db'
  | 'limits';

export interface NumericQuestion {
  id: string;
  kind: 'numeric';
  title: string;
  /** Shown in the question list. */
  shortTitle: string;
  prompt: ReactNode;
  /** Answer in the stated units. */
  answer: number;
  /** Absolute tolerance in the same units as `answer`. */
  tolerance: number;
  /** Units label shown next to the input (e.g. "dBm", "dB"). */
  units: string;
  /** TeX source for the formula shown in the explanation. */
  formulaTex: string;
  /** Prose rationale shown after submit. */
  explanation: ReactNode;
  topic: LearnTopicId;
}

export interface Choice {
  id: string;
  label: string;
  /** Short note shown after submit when this option is picked. */
  note: string;
}

export interface ChoiceQuestion {
  id: string;
  kind: 'choice';
  title: string;
  shortTitle: string;
  prompt: ReactNode;
  choices: Choice[];
  correctId: string;
  explanation: ReactNode;
  topic: LearnTopicId;
  /** Optional second topic for scenarios that straddle two articles. */
  secondaryTopic?: LearnTopicId;
}

export type Question = NumericQuestion | ChoiceQuestion;

/**
 * 7 numeric items + 4 design scenarios.
 *
 * Numeric items use the formulas derived in the matching Learn topic.
 * Tolerances are 0.1 dB for exact arithmetic and 0.5 dB for the noise-floor
 * item, which uses the -174 dBm/Hz rounding from the `noise-floor` article.
 */
export const QUESTIONS: Question[] = [
  {
    id: 'pim3-equal',
    kind: 'numeric',
    title: 'PIM3 from equal tones',
    shortTitle: 'PIM3, equal tones',
    prompt:
      'Two equal tones arrive at an amplifier at Pin = -20 dBm each. ' +
      'The stage IIP3 = +5 dBm. What is the input-referred IM3 power of ' +
      'each product, in dBm?',
    answer: -70,
    tolerance: 0.1,
    units: 'dBm',
    formulaTex: String.raw`P_{\mathrm{IM3}} = 3\,P_{\mathrm{in}} - 2\,\mathrm{IIP3} = 3(-20) - 2(+5) = -70\,\mathrm{dBm}`,
    explanation:
      'The 3-for-1 slope is the whole point of IP3. Each product rises 3 dB ' +
      'for every 1 dB of tone power and drops 2 dB for every 1 dB you buy ' +
      'back in IIP3.',
    topic: 'amp-im',
  },
  {
    id: 'im3-slope',
    kind: 'numeric',
    title: 'IM3 slope',
    shortTitle: 'IM3 slope on +2 dB',
    prompt:
      'Starting from the previous question (Pin = -20 dBm each, IIP3 = +5 dBm, ' +
      'PIM3 = -70 dBm), both tones are raised 2 dB to -18 dBm. What is the ' +
      'new PIM3, in dBm?',
    answer: -64,
    tolerance: 0.1,
    units: 'dBm',
    formulaTex: String.raw`\Delta P_{\mathrm{IM3}} = 3\,\Delta P_{\mathrm{in}} = 3(2) = 6\,\mathrm{dB} \;\Rightarrow\; -70 + 6 = -64\,\mathrm{dBm}`,
    explanation:
      'IM3 lifts 3 dB per dB of tone. That is why a blocker only 3 dB over ' +
      'the limit lands 9 dB higher on the product.',
    topic: 'amp-im',
  },
  {
    id: 'oip3',
    kind: 'numeric',
    title: 'OIP3 from IIP3 and gain',
    shortTitle: 'OIP3 from IIP3 and G',
    prompt:
      'A stage has IIP3 = -8 dBm and small-signal gain G = 35 dB. What is ' +
      'its OIP3, in dBm?',
    answer: 27,
    tolerance: 0.1,
    units: 'dBm',
    formulaTex: String.raw`\mathrm{OIP3} = \mathrm{IIP3} + G = -8 + 35 = +27\,\mathrm{dBm}`,
    explanation:
      'The intercept moves with gain. Quote IIP3 when you care about what ' +
      'the preceding stage may hand you; quote OIP3 when you care about ' +
      'what you hand the next stage.',
    topic: 'iip3-oip3',
  },
  {
    id: 'noise-floor',
    kind: 'numeric',
    title: 'Noise floor from bandwidth and NF',
    shortTitle: 'Noise floor, B and NF',
    prompt:
      'At T = 290 K, a receiver has a 100 kHz channel bandwidth and a ' +
      'cascaded noise figure of 3 dB. What is the input-referred noise ' +
      'floor, in dBm?',
    answer: -121,
    tolerance: 0.5,
    units: 'dBm',
    formulaTex: String.raw`N \approx -174 + 10\log_{10}(B) + \mathrm{NF} = -174 + 50 + 3 = -121\,\mathrm{dBm}`,
    explanation:
      'The -174 dBm/Hz rounding from Learn gives an answer within about 0.02 dB ' +
      'of the exact kTB value. Doubling B adds 3 dB; one more dB of NF lifts ' +
      'the floor by one dB.',
    topic: 'noise-floor',
  },
  {
    id: 'mds',
    kind: 'numeric',
    title: 'MDS from noise floor and SNR',
    shortTitle: 'MDS from N and SNR',
    prompt:
      'A demodulator needs at least 10 dB of SNR. The input-referred noise ' +
      'floor of the receiver is -110 dBm. What is the minimum discernible ' +
      'signal (MDS), in dBm?',
    answer: -100,
    tolerance: 0.1,
    units: 'dBm',
    formulaTex: String.raw`\mathrm{MDS} = N + \mathrm{SNR}_{\min} = -110 + 10 = -100\,\mathrm{dBm}`,
    explanation:
      'Filtering a blocker does not change kTB in the desired channel. ' +
      'Sensitivity moves only with the noise floor or the required SNR.',
    topic: 'nf-sens',
  },
  {
    id: 'sfdr',
    kind: 'numeric',
    title: 'Third-order SFDR',
    shortTitle: 'SFDR from IIP3 and N',
    prompt:
      'A chain has IIP3 = -10 dBm (input-referred) and noise floor ' +
      'N = -100 dBm. What is the third-order SFDR, in dB?',
    answer: 60,
    tolerance: 0.1,
    units: 'dB',
    formulaTex: String.raw`\mathrm{SFDR}_3 = \tfrac{2}{3}(\mathrm{IIP3} - N) = \tfrac{2}{3}(-10 - (-100)) = \tfrac{2}{3}(90) = 60\,\mathrm{dB}`,
    explanation:
      'A 6 dB improvement in IIP3 only buys 4 dB of SFDR because the 2/3 ' +
      'factor is doing the work. Narrowing B by 4x (6 dB less noise) buys ' +
      'the same 4 dB.',
    topic: 'sfdr',
  },
  {
    id: 'cascade-iip3',
    kind: 'numeric',
    title: 'Two-stage cascaded IIP3',
    shortTitle: 'Cascaded IIP3, 2 stages',
    prompt:
      'Stage 1 is an amplifier with G = 10 dB (linear 10) and IIP3 = ' +
      '+10 dBm (10 mW). Stage 2 that follows it has IIP3 = +20 dBm (100 mW). ' +
      'What is the input-referred cascaded IIP3 of the two-stage chain, in dBm?',
    answer: 7.0,
    tolerance: 0.2,
    units: 'dBm',
    formulaTex: String.raw`\begin{aligned}
      \frac{1}{\mathrm{IIP3}_{\mathrm{mW}}} &= \frac{1}{10} + \frac{10}{100} = 0.2 \\
      \mathrm{IIP3} &= 10\log_{10}(1/0.2) = 10\log_{10}(5) \approx 6.99\,\mathrm{dBm}
    \end{aligned}`,
    explanation:
      'Gain in front of a stage multiplies that stage term. With 10 dB of ' +
      'gain ahead of stage 2, its term is 10/100 = 0.1 mW^-1, equal to ' +
      "stage 1's own 1/10. Both stages count the same, and the cascade " +
      'sits 3 dB below either stage alone.',
    topic: 'iip3-cascade',
  },
  {
    id: 'design-sensitivity',
    kind: 'choice',
    title: 'Sensitivity without giving up linearity',
    shortTitle: 'Design: MDS vs IIP3',
    prompt:
      'The receiver is 3 dB short on MDS. The IIP3 cascade is already ' +
      "dominated by the IF amplifier's input-referred term; the LNA " +
      'contributes less than 5% of the IIP3 sum. Which single change best ' +
      'improves sensitivity without hurting the cascade IIP3?',
    choices: [
      {
        id: 'nf',
        label:
          'Lower the front-end noise figure (quieter LNA, or less preselect loss) at the same LNA gain.',
        note:
          'Correct. Friis is dominated by the front-end NF, and leaving the ' +
          'gain in front of later stages unchanged keeps the IIP3 terms ' +
          'where they are.',
      },
      {
        id: 'if-gain',
        label: 'Add 10 dB of gain at the IF amplifier.',
        note:
          'Trap. IF gain comes after the chain is set and does not change ' +
          'the input-referred MDS. It only makes the output louder.',
      },
      {
        id: 'lna-gain',
        label: 'Add 10 dB more gain at the LNA.',
        note:
          'Trap. More LNA gain multiplies every later IIP3 term, so the ' +
          'cascade IIP3 drops roughly 10 dB while the NF barely moves.',
      },
      {
        id: 'bandwidth',
        label: 'Widen the channel bandwidth to let more signal through.',
        note:
          'Wrong direction. Doubling B raises the noise floor 3 dB; the ' +
          'desired signal power in the channel does not grow with the filter.',
      },
    ],
    correctId: 'nf',
    explanation:
      'Sensitivity is set by the first few stages. If the IF amp already ' +
      'dominates IIP3, do not add gain in front of it; attack NF where the ' +
      'Friis sum is actually dominated.',
    topic: 'nf-sens',
    secondaryTopic: 'iip3-cascade',
  },
  {
    id: 'design-in-band-im3',
    kind: 'choice',
    title: 'In-band IM3 from nearby blockers',
    shortTitle: 'Design: in-band IM3',
    prompt:
      'Two strong CW blockers sit a few channels away from the desired ' +
      'signal. Their IM3 products at 2f1 - f2 and 2f2 - f1 land inside the ' +
      'channel filter, on top of the wanted signal. Which change gives the ' +
      'largest reduction in in-band IM3?',
    choices: [
      {
        id: 'attenuate',
        label:
          'Add selective attenuation (a sharper preselect or a notch) so the blockers reach the nonlinear stage 3 dB weaker.',
        note:
          'Correct. PIM3 scales 3 dB per dB of blocker, so 3 dB less blocker ' +
          'is 9 dB less product.',
      },
      {
        id: 'narrow',
        label: 'Narrow the channel bandwidth so the IM3 products fall outside it.',
        note:
          'Wrong. The products already landed inside the channel; a narrower ' +
          'filter after the nonlinear stage will not remove them.',
      },
      {
        id: 'more-gain',
        label: 'Increase LNA gain to bring the wanted signal above the products.',
        note:
          'Backwards. Gain lifts the blockers along with the signal, so the ' +
          'nonlinear stage sees even more drive and the IM3 grows.',
      },
      {
        id: 'ignore',
        label: 'Rely on cascaded IIP3 alone; nothing else helps once the products are in the channel.',
        note:
          'Not true. Reducing the blocker reaching the nonlinear stage is ' +
          'the standard fix and is often cheaper than chasing IIP3.',
      },
    ],
    correctId: 'attenuate',
    explanation:
      'Products inside the channel cannot be filtered away after the fact. ' +
      'Attack the blocker, not the bandwidth.',
    topic: 'ip3-n-sfdr',
  },
  {
    id: 'design-im2-budget',
    kind: 'choice',
    title: 'Which distortion to budget',
    shortTitle: 'Design: IM2 vs IM3',
    prompt:
      'You are picking IP specs for the front end of two radios: ' +
      '(A) a narrowband 2 GHz superhet with a tight preselector and a 20 MHz IF, and ' +
      '(B) a wideband zero-IF direct-conversion receiver covering several hundred MHz. ' +
      'Which statement is correct?',
    choices: [
      {
        id: 'zero-if-im2',
        label:
          'The zero-IF wideband receiver has to budget IIP2 as well as IIP3; the narrowband superhet can usually treat IM2 as out-of-band.',
        note:
          'Correct. In a narrowband superhet, f1 + f2 and |f1 - f2| fall ' +
          'far from the channel. In a wideband zero-IF, the difference tone ' +
          'can land right on DC.',
      },
      {
        id: 'both-im3-only',
        label: 'Both radios only need IIP3. IM2 is handled automatically by any balanced mixer.',
        note:
          'Wrong. Balanced circuits suppress IM2, but the wideband zero-IF ' +
          'case is sensitive enough that IIP2 is still a spec you buy.',
      },
      {
        id: 'superhet-im2',
        label: 'The narrowband superhet needs IIP2 more than the zero-IF because the IF is lower.',
        note:
          'Backwards. A low IF makes it easier to place f1 + f2 and ' +
          '|f1 - f2| outside the channel, not harder.',
      },
      {
        id: 'iip2-irrelevant',
        label: 'IIP2 is never worth specifying; only IIP3 appears in the SFDR equation.',
        note:
          'IIP2 is absent from SFDR_3, but it governs the half-IF spur and ' +
          'the DC blocker problem in a zero-IF front end.',
      },
    ],
    correctId: 'zero-if-im2',
    explanation:
      'Architecture decides which distortion matters. Narrowband superhets ' +
      'push IM2 out of band; zero-IF receivers cannot.',
    topic: 'im2-im3',
  },
  {
    id: 'design-p1db-vs-iip3',
    kind: 'choice',
    title: 'IIP3 is not a power the receiver can accept',
    shortTitle: 'Design: P1dB vs IIP3',
    prompt:
      'An LNA has IIP3 = +15 dBm. Its measured IP1dB is about 10 dB lower, ' +
      'around +5 dBm. A +8 dBm single-tone blocker shows up at the antenna. ' +
      'Which conclusion is correct?',
    choices: [
      {
        id: 'past-p1db',
        label:
          'The blocker is above IP1dB, so the LNA is compressing: the cubic IM3 line is no longer valid and the wanted signal can desense.',
        note:
          'Correct. Past P1dB the gain is dropping and higher-order terms ' +
          'dominate. Nothing you read off an extrapolated IP3 plot applies.',
      },
      {
        id: 'fine',
        label:
          'The blocker is still 7 dB below IIP3, so the stage is safely in its linear region.',
        note:
          'Trap. IIP3 is an extrapolated intercept, not a power the receiver ' +
          'can accept. IP1dB is usually 9 to 12 dB below IIP3 and is the ' +
          'right ceiling.',
      },
      {
        id: 'add-gain',
        label: 'Add gain in front of the LNA to lift the wanted signal above the noise.',
        note:
          'Wrong. More front-end gain makes the blocker reach the LNA at an ' +
          'even higher power; the compression gets worse.',
      },
      {
        id: 'sfdr-ok',
        label: 'If SFDR says the two-tone case is fine at this level, the single-tone case is fine too.',
        note:
          'SFDR is a two-tone small-signal metric. A single strong blocker ' +
          'can compress a stage that still has plenty of SFDR.',
      },
    ],
    correctId: 'past-p1db',
    explanation:
      'IIP3 is an extrapolation, not a saturation limit. P1dB (or IIP3 - 10 dB ' +
      'as a stand-in) is the edge of the region where the IP3 picture applies.',
    topic: 'p1db',
  },
];

/**
 * Parse a user answer like "-70", "-70 dBm", "+27dBm", " 60 db ". Returns
 * null when the input is empty or does not contain a number. Units are
 * accepted but not required and are not checked (the question states them).
 */
export function parseNumericAnswer(raw: string): number | null {
  const match = raw.trim().match(/^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}
