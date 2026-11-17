import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import {
  QUESTIONS,
  parseNumericAnswer,
  type ChoiceQuestion,
  type LearnTopicId,
  type NumericQuestion,
  type Question,
} from '../testQuestions';
import { Equation } from './Equation';

/** Per-question state. */
export interface AnswerState {
  /** Raw text from the numeric input. */
  text: string;
  /** Picked choice id for multiple-choice questions. */
  choiceId: string | null;
  /** True once the user submits and we evaluate. */
  submitted: boolean;
  /** Evaluation of the submitted answer. */
  correct: boolean;
}

const EMPTY: AnswerState = {
  text: '',
  choiceId: null,
  submitted: false,
  correct: false,
};

export type AnswerMap = Record<string, AnswerState>;

export interface TestStore {
  currentId: string;
  setCurrentId: (id: string) => void;
  answers: AnswerMap;
  setAnswers: Dispatch<SetStateAction<AnswerMap>>;
}

/**
 * Lifted so the score and submitted answers survive switching away from the
 * Test tab (e.g. to review a Learn article and come back).
 */
export function useTestStore(): TestStore {
  const [currentId, setCurrentId] = useState<string>(QUESTIONS[0].id);
  const [answers, setAnswers] = useState<AnswerMap>({});
  // DEBUG
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __tsCalls?: number; __tsAnswers?: AnswerMap };
    w.__tsCalls = (w.__tsCalls ?? 0) + 1;
    w.__tsAnswers = answers;
  }
  return { currentId, setCurrentId, answers, setAnswers };
}

interface TestTabProps {
  store: TestStore;
  /** Switch to the Learn tab and open the given topic. */
  onReviewInLearn: (topicId: LearnTopicId) => void;
}

function getState(answers: AnswerMap, id: string): AnswerState {
  return answers[id] ?? EMPTY;
}

export function TestTab({ store, onReviewInLearn }: TestTabProps) {
  const { currentId, setCurrentId, answers, setAnswers } = store;

  const current = QUESTIONS.find((q) => q.id === currentId) ?? QUESTIONS[0];

  const tally = useMemo(() => {
    let correct = 0;
    let submitted = 0;
    for (const q of QUESTIONS) {
      const s = answers[q.id];
      if (s?.submitted) {
        submitted += 1;
        if (s.correct) correct += 1;
      }
    }
    return { correct, submitted, total: QUESTIONS.length };
  }, [answers]);

  function updateAnswer(id: string, patch: Partial<AnswerState>) {
    setAnswers((prev) => {
      const prior = prev[id] ?? EMPTY;
      return { ...prev, [id]: { ...prior, ...patch } };
    });
  }

  function submit(q: Question) {
    const s = getState(answers, q.id);
    if (q.kind === 'numeric') {
      const parsed = parseNumericAnswer(s.text);
      const correct =
        parsed !== null && Math.abs(parsed - q.answer) <= q.tolerance;
      updateAnswer(q.id, { submitted: true, correct });
    } else {
      const correct = s.choiceId === q.correctId;
      updateAnswer(q.id, { submitted: true, correct });
    }
  }

  function tryAgain(q: Question) {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[q.id];
      return next;
    });
  }

  function statusMark(q: Question): 'correct' | 'missed' | 'unanswered' {
    const s = answers[q.id];
    if (!s?.submitted) return 'unanswered';
    return s.correct ? 'correct' : 'missed';
  }

  return (
    <div>
      <div className="callout">
        Check your grip on the RF chain. Each question links to the Learn
        topic where its formula or idea is worked out. Submit to see the
        formula and a short reason, then <em>Try again</em> if you want
        another pass.
        <div style={{ marginTop: 6, color: 'var(--fg-dim)' }}>
          Score: <strong style={{ color: 'var(--fg)' }}>{tally.correct}</strong>{' '}
          correct of <strong style={{ color: 'var(--fg)' }}>{tally.submitted}</strong>{' '}
          submitted ({tally.total} total)
        </div>
      </div>

      <div className="learn-layout">
        <div className="panel">
          <h2>Questions</h2>
          <ul className="topics test-list">
            {QUESTIONS.map((q) => {
              const mark = statusMark(q);
              return (
                <li key={q.id}>
                  <button
                    className={q.id === current.id ? 'active' : ''}
                    onClick={() => setCurrentId(q.id)}
                  >
                    <span className={`test-mark test-mark-${mark}`} aria-hidden>
                      {mark === 'correct' ? '+' : mark === 'missed' ? 'x' : '-'}
                    </span>
                    <span className="test-short-title">{q.shortTitle}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="panel article">
          <h2>{current.title}</h2>
          <QuestionBody
            question={current}
            state={getState(answers, current.id)}
            onChange={(patch) => updateAnswer(current.id, patch)}
            onSubmit={() => submit(current)}
            onTryAgain={() => tryAgain(current)}
            onReview={() => onReviewInLearn(current.topic)}
            onReviewSecondary={
              current.kind === 'choice' && current.secondaryTopic
                ? () => onReviewInLearn(current.secondaryTopic as LearnTopicId)
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}

interface QuestionBodyProps {
  question: Question;
  state: AnswerState;
  onChange: (patch: Partial<AnswerState>) => void;
  onSubmit: () => void;
  onTryAgain: () => void;
  onReview: () => void;
  onReviewSecondary?: () => void;
}

function QuestionBody({
  question,
  state,
  onChange,
  onSubmit,
  onTryAgain,
  onReview,
  onReviewSecondary,
}: QuestionBodyProps) {
  return (
    <>
      <p>{question.prompt}</p>
      {question.kind === 'numeric' ? (
        <NumericAnswer
          question={question}
          state={state}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      ) : (
        <ChoiceAnswer
          question={question}
          state={state}
          onChange={onChange}
        />
      )}

      {!state.submitted && question.kind === 'choice' && (
        <div style={{ marginTop: 10 }}>
          <button
            className="primary"
            onClick={onSubmit}
            disabled={state.choiceId === null}
          >
            Check answer
          </button>
        </div>
      )}

      {state.submitted && (
        <Feedback
          question={question}
          state={state}
          onTryAgain={onTryAgain}
          onReview={onReview}
          onReviewSecondary={onReviewSecondary}
        />
      )}
    </>
  );
}

interface NumericAnswerProps {
  question: NumericQuestion;
  state: AnswerState;
  onChange: (patch: Partial<AnswerState>) => void;
  onSubmit: () => void;
}

function NumericAnswer({ question, state, onChange, onSubmit }: NumericAnswerProps) {
  return (
    <div className="test-numeric">
      <label htmlFor={`answer-${question.id}`}>Your answer</label>
      <div className="test-numeric-row">
        <input
          id={`answer-${question.id}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={`e.g. -70 ${question.units}`}
          value={state.text}
          disabled={state.submitted}
          onChange={(e) => onChange({ text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !state.submitted && state.text.trim().length > 0) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <span className="test-units">{question.units}</span>
        {!state.submitted && (
          <button
            className="primary"
            onClick={onSubmit}
            disabled={state.text.trim().length === 0}
          >
            Check answer
          </button>
        )}
      </div>
      <div className="test-hint">
        Units are optional in your answer; the units label here states them.
        Tolerance: +/- {question.tolerance} {question.units}.
      </div>
    </div>
  );
}

interface ChoiceAnswerProps {
  question: ChoiceQuestion;
  state: AnswerState;
  onChange: (patch: Partial<AnswerState>) => void;
}

function ChoiceAnswer({ question, state, onChange }: ChoiceAnswerProps) {
  return (
    <ul className="test-choices">
      {question.choices.map((c) => {
        const picked = state.choiceId === c.id;
        const isCorrect = c.id === question.correctId;
        let marker = '';
        if (state.submitted) {
          if (isCorrect) marker = 'test-choice-correct';
          else if (picked) marker = 'test-choice-missed';
        } else if (picked) {
          marker = 'test-choice-picked';
        }
        return (
          <li key={c.id} className={marker}>
            <label className="test-choice-label">
              <input
                type="radio"
                name={`choice-${question.id}`}
                value={c.id}
                checked={picked}
                disabled={state.submitted}
                onChange={() => onChange({ choiceId: c.id })}
              />
              <span>{c.label}</span>
            </label>
            {state.submitted && (picked || isCorrect) && (
              <div className="test-choice-note">{c.note}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface FeedbackProps {
  question: Question;
  state: AnswerState;
  onTryAgain: () => void;
  onReview: () => void;
  onReviewSecondary?: () => void;
}

function Feedback({
  question,
  state,
  onTryAgain,
  onReview,
  onReviewSecondary,
}: FeedbackProps) {
  return (
    <div className={`test-feedback ${state.correct ? 'ok' : 'miss'}`}>
      <div className="test-feedback-head">
        {state.correct ? 'Correct.' : 'Not quite.'}
        {question.kind === 'numeric' && (
          <>
            {' '}Expected{' '}
            <strong>
              {question.answer} {question.units}
            </strong>{' '}
            (tolerance +/- {question.tolerance} {question.units}).
          </>
        )}
      </div>
      {question.kind === 'numeric' && (
        <Equation tex={question.formulaTex} />
      )}
      <p>{question.explanation}</p>
      <div className="test-actions">
        <button onClick={onTryAgain}>Try again</button>
        <button onClick={onReview}>Review in Learn</button>
        {onReviewSecondary && (
          <button onClick={onReviewSecondary}>Also see related topic</button>
        )}
      </div>
    </div>
  );
}
