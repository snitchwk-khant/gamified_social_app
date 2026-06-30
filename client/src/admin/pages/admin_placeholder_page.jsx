function AdminPlaceholderPage({ title, children }) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-8">
      <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

export default AdminPlaceholderPage;
