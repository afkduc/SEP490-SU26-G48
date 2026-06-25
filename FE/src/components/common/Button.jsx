import { classNames } from '../../utils';

export default function Button({ children, variant = 'primary', className, ...rest }) {
  return (
    <button
      type="button"
      className={classNames('btn', `btn--${variant}`, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
