import { Outlet, NavLink } from 'react-router-dom';
import './InventoryLayout.css';

// Chi hien thi cac chuc nang da hoan thien. Phieu nhap / Xuat / Bao cao
// se duoc them vao sau khi chuc nang nhap xuat kho duoc implement.
const MENU = [
  { path: '', label: 'Tong quan', icon: '🏠', end: true },
  { path: 'parts', label: 'Phu tung', icon: '📦' },
  { path: 'stock', label: 'Ton kho', icon: '🗃️' },
  { path: 'suppliers', label: 'Nha cung cap', icon: '🚚' },
];

export default function InventoryLayout() {
  return (
    <div className="inv-layout">
      <aside className="inv-layout__sidebar">
        <h2 className="inv-layout__title">Module Kho</h2>
        <nav className="inv-layout__nav">
          {MENU.map((item) => (
            <NavLink
              key={item.path || 'home'}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `inv-layout__link${isActive ? ' inv-layout__link--active' : ''}`
              }
            >
              <span className="inv-layout__icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="inv-layout__content">
        <Outlet />
      </section>
    </div>
  );
}