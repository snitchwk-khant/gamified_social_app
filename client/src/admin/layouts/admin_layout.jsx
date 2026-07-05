import { useState } from "react";
import { Outlet } from "react-router-dom";
import SafeAreaLayout from "../../components/layout/SafeAreaLayout";
import AdminHeader from "../components/admin_header";
import AdminSidebar from "../components/admin_sidebar";

function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <SafeAreaLayout className="min-h-screen bg-[#f8fafc] text-slate-900">
      <div className="flex min-h-screen">
        <AdminSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader onMenuClick={() => setIsSidebarOpen(true)} />
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SafeAreaLayout>
  );
}

export default AdminLayout;
