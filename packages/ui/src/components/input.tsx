import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

// Thin wrappers over the native elements whose only job is to flip the default:
// browsers autofill text fields unless told otherwise, which is rarely what a
// tool like this wants. `autoComplete` defaults to 'off'; pass a real token
// (e.g. autoComplete="email") to opt a field back in. Styling stays with the
// caller — these add no classes of their own.

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { autoComplete, ...props },
  ref,
) {
  return <input ref={ref} autoComplete={autoComplete ?? 'off'} {...props} />;
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { autoComplete, ...props },
  ref,
) {
  return <textarea ref={ref} autoComplete={autoComplete ?? 'off'} {...props} />;
});
