import { Outlet } from 'react-router-dom';

export default function SettingsLayout() {
  return (
    <div className="max-w-[1010px]">
      <Outlet />
    </div>
  );
}
