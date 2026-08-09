"use client";
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import Link from "next/link";
import { Home, Receipt } from "lucide-react";
import { usePathname } from "next/navigation";

const config = {
  businessName: "Fandi Boiler",
  subtitle: "Supplier Ayam & Bebek Segar — Bersih, Halal, Higienis & Berkualitas"
};

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isNative, setIsNative] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
    setPrefix(process.env.NODE_ENV === "production" && !Capacitor.isNativePlatform() && window.location.pathname.includes("Invoice-Management") ? "/Invoice-Management" : "");
    setMounted(true);
  }, []);

  const navItems = [
    { name: "Beranda", path: "/", icon: Home },
    { name: "Buat Nota", path: "/invoice", icon: Receipt },
    { name: "Riwayat", path: "/history", icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-history"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg> },
  ];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Universal Top Branding Header */}
      <nav className="header-nav bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 flex items-center justify-center">
              <img src={`${prefix}/logo.png`} alt="Logo" className="max-h-full max-w-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">{config.businessName}</h1>
              <p className="hidden md:block text-xs text-slate-500 font-medium mt-1">{config.subtitle}</p>
            </div>
          </div>
          
          {/* Navigation Links - Hidden on Native, Hidden on Small Web Screens */}
          {!isNative && (
            <div className="hidden md:flex gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.path;
                return (
                  <Link key={item.path} href={item.path} className={`px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-all ${active ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-100"}`}>
                    <Icon size={18} /> {item.name}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      {/* Padding bottom is needed for the bottom navbar on mobile/native */}
      <div className={`flex-1 w-full max-w-[1600px] mx-auto pb-24 md:pb-8`}>
        {children}
      </div>

      {/* Bottom Navbar - Visible on Native OR Small Web Screens */}
      <nav className={`fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 justify-around items-center h-[72px] z-40 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] ${isNative ? 'flex' : 'flex md:hidden'}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.path;
          return (
            <Link key={item.path} href={item.path} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
              <div className={`p-1.5 rounded-full ${active ? 'bg-indigo-50' : ''}`}>
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className="text-[11px] font-bold">{item.name}</span>
            </Link>
          )
        })}
      </nav>
      
    </div>
  );
}
