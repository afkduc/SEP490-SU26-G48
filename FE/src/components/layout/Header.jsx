import { APP_NAME } from '../../config';

export default function Header() {
  return (
    <header className="layout-header">
      <div className="layout-header__brand">{APP_NAME}</div>
      <nav className="layout-header__nav" aria-label="Main navigation">
        <a href="/">Home</a>
      </nav>
    </header>
  );
}
