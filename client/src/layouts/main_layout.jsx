import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";

import DesktopLayout from "../components/layout/desktop_layout";
import LeftSidebar from "../components/sidebar/left_sidebar";
import ChatWidget from "../components/chat/chat_widget";
import UserSearch from "../components/user_search/user_search";
import { getFeatureFlags } from "../services/admin_configs_service";

function MainLayout() {
  const [featureFlags, setFeatureFlags] = useState({ chat_enabled: true });
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getFeatureFlags().then((flags) => {
      if (!isMounted) {
        return;
      }

      setFeatureFlags({ chat_enabled: flags.chat_enabled !== false });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    const updateLayout = () => {
      setIsMobileLayout(mediaQuery.matches);
    };

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);

    return () => {
      mediaQuery.removeEventListener("change", updateLayout);
    };
  }, []);

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
      right={
        featureFlags.chat_enabled && !isMobileLayout ? (
          <ChatWidget />
        ) : null
      }
    />
  );
}

export default MainLayout;
