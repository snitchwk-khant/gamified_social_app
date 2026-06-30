import { Outlet } from "react-router-dom";

import DesktopLayout from "../components/layout/desktop_layout";
import LeftSidebar from "../components/sidebar/left_sidebar";
import UserSearch from "../components/user_search/user_search";

function MainLayout() {
  return (
    <DesktopLayout
      left={<LeftSidebar />}
      center={
        <div className="flex h-full min-w-0 flex-col gap-4 sm:gap-5">
          <div className="xl:hidden">
            <UserSearch inputId="mobile-user-search" />
          </div>
          <div className="min-w-0 flex-1 overflow-auto pb-4">
            <Outlet />
          </div>
        </div>
      }
      right={null}
    />
  );
}

export default MainLayout;
