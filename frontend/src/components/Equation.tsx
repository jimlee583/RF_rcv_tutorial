import katex from 'katex';
import 'katex/dist/katex.min.css';

interface EquationProps {
  /** Display-math source. Static author text, not user input. */
  tex: string;
}

/** Render one display equation, left-aligned inside the Learn article box. */
export function Equation({ tex }: EquationProps) {
  const html = katex.renderToString(tex.trim(), {
    displayMode: true,
    throwOnError: true,
    fleqn: true,
    output: 'htmlAndMathml',
  });
  return <div className="equation" dangerouslySetInnerHTML={{ __html: html }} />;
}
