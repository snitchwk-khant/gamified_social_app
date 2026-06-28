import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";

import DesktopLayout from "../components/layout/desktop_layout";
import LeftSidebar from "../components/sidebar/left_sidebar";
import ChatWidget from "../components/chat/chat_widget";
import { getFeatureFlags } from "../services/admin_configs_service";

function MainLayout() {
  const [draft, setDraft] = useState("");
  const [featureFlags, setFeatureFlags] = useState({ chat_enabled: true });

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

  return (
    <DesktopLayout
      left={<LeftSidebar />}
      center={
        <div className="flex h-full flex-col gap-5">
          <div className="flex-1 overflow-auto pb-4">
            <Outlet />
          </div>
        </div>
      }
      right={
        featureFlags.chat_enabled ? (
          <ChatWidget
            messages={[]}
            draft={draft}
            onDraftChange={setDraft}
            onSend={() => {}}
          />
        ) : null
      }
    />
  );
}

export default MainLayout;
