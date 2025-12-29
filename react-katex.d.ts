declare module 'react-katex' {
  import { ComponentType } from 'react';

  export interface MathProps {
    math: string;
    errorColor?: string;
    renderError?: (error: Error) => React.ReactNode;
  }

  export interface BlockMathProps extends MathProps {
    math: string;
  }

  export interface InlineMathProps extends MathProps {
    math: string;
  }

  export const BlockMath: ComponentType<BlockMathProps>;
  export const InlineMath: ComponentType<InlineMathProps>;
}
