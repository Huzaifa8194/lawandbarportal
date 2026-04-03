export default function FormSection({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
