export default function Footer() {
  return (
    <footer className="mt-12 border-t border-[var(--border)]">
      <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
        <p className="text-center text-xs text-zinc-400">
          © {new Date().getFullYear()} CorpMult
        </p>
      </div>
    </footer>
  );
}
