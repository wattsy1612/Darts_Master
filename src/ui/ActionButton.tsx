import type { ComponentProps } from 'react';
type Props = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger';
  pending?: boolean;
};
export default function ActionButton({
  variant = 'primary',
  pending = false,
  className = '',
  disabled,
  type = 'button',
  children,
  ...props
}: Props) {
  return (
    <button
      {...props}
      type={type}
      className={`button ${variant} ${className}`.trim()}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {children}
    </button>
  );
}
