import { Outlet, Link } from 'react-router-dom';
import { Sparkles, TerminalSquare } from 'lucide-react';

export default function Layout() {
  return (
    <div className="min-h-screen bg-stone-50 text-zinc-900 flex flex-col font-sans">
      <header className="h-20 px-8 flex items-center justify-between border-b border-zinc-200 bg-white sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-12 group">
          <span className="text-3xl font-black tracking-tighter uppercase text-zinc-900 group-hover:opacity-80 transition-opacity">Trendies</span>
        </Link>
        <nav className="flex items-center gap-8 text-xs font-bold tracking-widest uppercase text-zinc-400">
          <Link to="/" className="text-zinc-900 border-b-2 border-zinc-900 pb-1">Découvrir</Link>
          <Link to="/admin" className="hover:text-zinc-600 transition-colors flex items-center gap-1">
            <TerminalSquare size={14} /> Admin
          </Link>
        </nav>
      </header>
      <main className="flex-grow">
        <Outlet />
      </main>
      <footer className="h-10 px-8 flex items-center justify-end bg-zinc-100 border-t border-zinc-200">
        <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 font-sans">
          &copy; {new Date().getFullYear()} Trendies IA System
        </div>
      </footer>
    </div>
  );
}
