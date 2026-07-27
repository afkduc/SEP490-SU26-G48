import { Outlet } from 'react-router-dom';

// Module Kho su dung Navbar ben tren de dieu huong, khong con sidebar.
// Layout chi don gian render <Outlet /> cua cac route con.
export default function InventoryLayout() {
  return (
    <div className="inv-layout">
      <Outlet />
    </div>
  );
}