import { classNames } from '../../utils';

export default function Card({ title, children, className }) {
  return (
    <section className={classNames('card', 'card--boxed', className)}>
      {title ? <header className="card__title">{title}</header> : null}
      <div className="card__body">{children}</div>
    </section>
  );
}
