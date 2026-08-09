"use client";
import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { 
  Plus, Trash2, Download, MessageCircle, RotateCcw, 
  User, Search, Banknote, Tag, Calculator, CheckCircle2, 
  Settings, Receipt, PenLine, CreditCard, Clock, Layers, Copy, Calendar, X, FolderOpen
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */
interface Item { id: number; name: string; qty: number; price: number; }

const STORAGE_KEY = "nota_config";
const defaultConfig = { 
  businessName: "Fandi Boiler", 
  subtitle: "Supplier Ayam & Bebek Segar — Bersih, Halal, Higienis & Berkualitas" 
};

function fmtRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

const prefix = process.env.NODE_ENV === "production" ? "/Invoice-Management" : "";

const parseRp = (val: string): number => {
  const clean = val.replace(/\D/g, "");
  return Math.min(999999999, Number(clean) || 0);
};

const formatRpInput = (val: number): string => {
  if (!val) return "";
  return "Rp " + val.toLocaleString("id-ID");
};

/* ─── Main Page ─────────────────────────────────────────── */
export default function Home() {
  const [mounted, setMounted] = useState(false);
  const config = defaultConfig;

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [bon, setBon] = useState(0);
  const [cash, setCash] = useState(0);
  const [items, setItems] = useState<Item[]>([{ id: Date.now(), name: "", qty: 0, price: 0 }]);
  const [nextId, setNextId] = useState(2);
  const [isSaved, setIsSaved] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [savePromptModal, setSavePromptModal] = useState(false);
  
  const [alertModal, setAlertModal] = useState<{show: boolean, msg: string, title?: string, type: 'info' | 'success' | 'error', onClose?: () => void}>({show: false, msg: '', title: '', type: 'info'});

  const showAlert = (msg: string, type: 'info' | 'success' | 'error' = 'info', title: string = "Informasi", onClose?: () => void) => {
    setAlertModal({show: true, msg, title, type, onClose});
  };

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
      
      // Auto-fill from Contact ID if present
      const params = new URLSearchParams(window.location.search);
      const cid = params.get("contactId");
      
      const storedContacts = localStorage.getItem('app_contacts');
      if (storedContacts) {
        const parsedContacts = JSON.parse(storedContacts);
        setContacts(parsedContacts);
        
        if (cid) {
          const contact = parsedContacts.find((c: any) => c.id === cid);
          if (contact) {
            setCustomerName(contact.name);
            setCustomerPhone(contact.phone || "");
            setContactId(cid);
            
            const storedTxs = localStorage.getItem('app_transactions');
            if (storedTxs) {
              const txs = JSON.parse(storedTxs);
              const hutang = txs.filter((t: any) => t.contactId === cid)
                                .reduce((sum: number, t: any) => sum + (t.type === 'bon' ? t.amount - (t.cash || 0) : -t.amount), 0);
              if (hutang > 0) {
                 setBon(hutang);
              }
            }
          }
        }
      }
    } catch { /* ignore */ }
  }, []);

  const handleSelectContact = (c: any) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone || "");
    setContactId(c.id);
    setShowRecommendations(false);
    
    // Fetch previous debt
    const storedTxs = localStorage.getItem('app_transactions');
    if (storedTxs) {
      const txs = JSON.parse(storedTxs);
      const hutang = txs.filter((t: any) => t.contactId === c.id)
                        .reduce((sum: number, t: any) => sum + (t.type === 'bon' ? t.amount - (t.cash || 0) : -t.amount), 0);
      setBon(Math.max(0, hutang));
    }
  };

  const executeSave = (cid: string) => {
    try {
      const storedTxs = localStorage.getItem('app_transactions');
      const transactions = storedTxs ? JSON.parse(storedTxs) : [];
      let updated = [...transactions];
      
      const itemNames = items.filter(i => i.name.trim()).map(i => i.name).join(", ");
      const noteText = itemNames ? `Nota: ${itemNames}`.substring(0, 50) : "Pembayaran Hutang";
      
      const txDate = new Date(date).toISOString();

      const effectivePayment = Math.min(cash, totalTagihan);

      if (totalBarang > 0) {
        // Record 1 consolidated entry for the invoice to prevent double history
        updated.push({
          id: Date.now().toString() + "-inv",
          contactId: cid,
          date: txDate,
          type: 'bon',
          amount: totalBarang,
          cash: effectivePayment,
          note: noteText,
          items: items.filter(i => i.name.trim() && i.qty > 0)
        });
      } else if (effectivePayment > 0) {
        // If they only pay debt without buying any goods
        updated.push({
          id: Date.now().toString() + "-p",
          contactId: cid,
          date: txDate,
          type: 'payment',
          amount: effectivePayment,
          note: "Pembayaran Hutang"
        });
      }

      localStorage.setItem('app_transactions', JSON.stringify(updated));
      setIsSaved(true);
      showAlert(cid === "general" ? "Data berhasil disimpan ke riwayat tanpa folder." : "Data berhasil disimpan ke folder pelanggan!", "success", "Berhasil");
    } catch(e) {
      console.error(e);
      showAlert("Gagal menyimpan data karena masalah penyimpanan lokal.", "error", "Terjadi Kesalahan");
    }
  };

  const handleCreateAndSelectFolder = (andSave: boolean = false) => {
    const nameToUse = customerName.trim() || "Pelanggan Baru";
    const newId = Date.now().toString();
    const newContact = { id: newId, name: nameToUse, address: "", phone: customerPhone };
    const updatedContacts = [...contacts, newContact];
    setContacts(updatedContacts);
    localStorage.setItem('app_contacts', JSON.stringify(updatedContacts));
    
    setContactId(newId);
    setShowRecommendations(false);
    
    if (andSave) {
      executeSave(newId);
      setSavePromptModal(false);
    } else {
      showAlert(`Folder pelanggan "${nameToUse}" berhasil dibuat!`, "success", "Berhasil");
    }
  };

  const handleSaveOnly = () => {
    if (isSaved) {
      showAlert("Nota ini sudah disimpan sebelumnya.", "info", "Peringatan");
      return;
    }
    if (totalBarang === 0 && cash === 0) {
      showAlert("Nota kosong, tidak ada barang atau pembayaran yang perlu disimpan.", "error", "Data Kosong");
      return;
    }
    
    if (!contactId) {
      setSavePromptModal(true);
      return;
    }

    executeSave(contactId);
  };

  /* ─── Derived Math ─── */
  const totalJenis = items.filter(i => i.name.trim()).length;
  const totalQty   = items.reduce((s, i) => s + (i.qty || 0), 0);
  const totalBarang = items.reduce((s, i) => s + (i.qty * i.price), 0);
  const totalTagihan = totalBarang + bon;
  const grandTotal = totalTagihan - cash; // >0 means Sisa Hutang, <0 means Kembalian
  
  const isLunas = grandTotal <= 0 && totalTagihan > 0;
  const isHutang = grandTotal > 0;

  /* ─── Items CRUD ─── */
  const addItem = () => {
    setItems(prev => [...prev, { id: nextId, name: "", qty: 0, price: 0 }]);
    setNextId(n => n + 1);
    setIsSaved(false);
  };
  const updateItem = (id: number, field: keyof Item, val: string | number) => {
    setIsSaved(false);
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      let sanitizedVal = val;
      if (field === "qty") {
        // Clamp Qty between 0 and 99.999
        sanitizedVal = Math.min(99999, Math.max(0, Number(val) || 0));
      } else if (field === "price") {
        // Clamp Price between 0 and 999.999.999, handling formatted string input safely
        const cleanPrice = String(val).replace(/\D/g, "");
        sanitizedVal = Math.min(999999999, Math.max(0, Number(cleanPrice) || 0));
      } else if (field === "name") {
        // Truncate Name to 40 characters
        sanitizedVal = String(val).substring(0, 40);
      }
      return { ...i, [field]: sanitizedVal };
    }));
  };
  const removeItem = (id: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
    setIsSaved(false);
  };
  const reset = () => {
    setDate(new Date().toISOString().split("T")[0]); 
    setCash(0);
    setItems([{ id: Date.now(), name: "", qty: 0, price: 0 }]); 
    setNextId(2);
    setIsSaved(false);
    
    if (!contactId) {
      setCustomerName(""); 
      setCustomerPhone("");
      setBon(0);
    } else {
      const storedTxs = localStorage.getItem('app_transactions');
      if (storedTxs) {
        const txs = JSON.parse(storedTxs);
        const hutang = txs.filter((t: any) => t.contactId === contactId)
                          .reduce((sum: number, t: any) => sum + (t.type === 'bon' ? t.amount - (t.cash || 0) : -t.amount), 0);
        setBon(Math.max(0, hutang));
      } else {
        setBon(0);
      }
    }
  };

  /* ─── Export & Share ─── */
  const exportPDF = async () => {
    if (!printRef.current) return;
    try {
      const canvas = await html2canvas(printRef.current, { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a5"); // A5 is better for small receipts
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, w, h);
      pdf.save(`Nota-${customerName || "Customer"}.pdf`);
    } catch { showAlert("Gagal export PDF. Silakan coba lagi.", "error", "Terjadi Kesalahan"); }
  };

  const buildText = () => {
    return [
      `*${config.businessName}*`,
      `──────────────────`,
      `Pembeli: *${customerName || "-"}*`,
      `Tanggal: ${new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`,
      ``,
      `*Daftar Barang:*`,
      ...items.filter(i => i.name.trim()).map((i, idx) =>
        `${idx + 1}. ${i.name} — ${i.qty} x ${fmtRp(i.price)} = *${fmtRp(i.qty * i.price)}*`
      ),
      ``,
      `Subtotal Barang: ${fmtRp(totalBarang)}`,
      bon > 0 ? `Hutang Sebelumnya: ${fmtRp(bon)}` : null,
      (bon > 0 && totalBarang > 0) ? `Total Tagihan: ${fmtRp(totalTagihan)}` : null,
      cash > 0 ? `Dibayar (Cash): ${fmtRp(cash)}` : null,
      `──────────────────`,
      `*${grandTotal < 0 ? 'KEMBALIAN' : (grandTotal === 0 ? 'LUNAS' : 'SISA HUTANG')}: ${fmtRp(Math.abs(grandTotal))}*`,
    ].filter(l => l !== null).join("\n");
  };

  const shareWA = async () => {
    if (!printRef.current) return;
    try {
      const canvas = await html2canvas(printRef.current, { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
      
      if (Capacitor.isNativePlatform()) {
        try {
          const base64Image = canvas.toDataURL("image/png");
          const fileName = `Nota-${customerName || "Customer"}-${Date.now()}.png`;
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Image.split(',')[1],
            directory: Directory.Cache
          });

          await Share.share({
            title: "Nota Belanja Fendi Broiler",
            text: "Berikut adalah nota belanja Anda.",
            url: savedFile.uri,
            dialogTitle: "Kirim via WhatsApp"
          });
          return;
        } catch (err) {
          console.error("Capacitor Share error:", err);
          showAlert("Gagal membagikan nota secara native.", "error", "Terjadi Kesalahan");
          return;
        }
      }

      canvas.toBlob(async (blob) => {
        if (!blob) {
          showAlert("Gagal memproses gambar nota.", "error", "Terjadi Kesalahan");
          return;
        }

        const fileName = `Nota-${customerName || "Customer"}.png`;
        const file = new File([blob], fileName, { type: "image/png" });

        // 1. Mobile Share (Direct image attachment in WhatsApp)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: "Nota Belanja Fendi Broiler",
            });
            return;
          } catch (err) {
            console.log("Share cancelled or failed", err);
            return;
          }
        }

        // 2. Desktop Fallback (Copy image to Clipboard + Open WhatsApp)
        try {
          const item = new ClipboardItem({ "image/png": blob });
          await navigator.clipboard.write([item]);
          
          const phoneStr = customerPhone ? customerPhone.replace(/^0/, '62') : "";
          const waUrl = phoneStr ? `https://wa.me/${phoneStr}` : "https://wa.me/";

          showAlert(
            "Gambar Nota telah otomatis disALIN ke Clipboard!\n\nAnda akan dialihkan ke WhatsApp. Di ruang obrolan, silakan langsung tekan Ctrl+V (atau Klik Kanan -> Tempel/Paste) untuk mengirim nota.",
            "success",
            "Berhasil Disalin",
            () => window.open(waUrl, "_blank")
          );
        } catch (clipboardErr) {
          console.error("Clipboard copy failed", clipboardErr);
          showAlert(
            "Browser Anda memblokir salin gambar otomatis.\n\nSilakan gunakan tombol 'Cetak PDF' untuk mengunduh nota, lalu kirim filenya secara manual.",
            "error",
            "Akses Diblokir"
          );
          return;
        }
      }, "image/png");

    } catch (e) {
      showAlert("Gagal memproses gambar nota.", "error", "Terjadi Kesalahan");
    }
  };
  
  const copyText = () => {
    navigator.clipboard.writeText(buildText());
    showAlert("Teks nota berhasil disalin ke Clipboard!", "success", "Berhasil Disalin");
  };

  if (!mounted) return null;

  return (
    <>
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1.618fr_1fr] gap-8 items-start">
          
          {/* ============================================================== */}
          {/* LEFT COLUMN: DATA ENTRY (Form)                                 */}
          {/* ============================================================== */}
          <div className="space-y-6">
            
            {/* 1. Kustomer & Pembayaran */}
            <div className="card p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-50 text-brand"><User size={24} /></div>
                <h2 className="text-xl font-bold text-slate-800">Informasi Dasar</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <label className="lbl">Nama Pembeli</label>
                  <div className="inp-group relative">
                    <PenLine size={20} className="inp-icon" />
                    <input 
                      className={`inp ${contactId ? 'bg-slate-100 text-slate-500 pr-10 cursor-not-allowed' : ''}`} 
                      placeholder="Ketik nama pembeli..." 
                      value={customerName} 
                      onChange={e => {
                        setCustomerName(e.target.value.substring(0, 30));
                        if (!contactId) setShowRecommendations(true);
                      }} 
                      onFocus={() => { if (!contactId && contacts.length > 0) setShowRecommendations(true); }}
                      onBlur={() => setTimeout(() => setShowRecommendations(false), 200)}
                      maxLength={30} 
                      readOnly={!!contactId} 
                    />
                    {contactId && (
                      <button 
                        onClick={() => { setContactId(null); setCustomerName(""); setCustomerPhone(""); setBon(0); setIsSaved(false); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors z-10"
                        title="Hapus / Ganti Pelanggan"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  
                  {/* Recommendations Dropdown */}
                  {showRecommendations && !contactId && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {contacts.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).length > 0 ? (
                        contacts.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).map(c => (
                          <div 
                            key={c.id} 
                            className="px-4 py-3 hover:bg-indigo-50 cursor-pointer text-sm font-semibold text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                            onClick={() => handleSelectContact(c)}
                          >
                            <div className="flex items-center gap-2">
                              <User size={14} className="text-indigo-400" />
                              {c.name}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500 bg-slate-50 border-t border-slate-100">
                          <p className="mb-2 italic text-slate-400">Belum ada folder pelanggan.</p>
                          <button 
                            onMouseDown={(e) => { e.preventDefault(); handleCreateAndSelectFolder(); }}
                            className="w-full py-2 bg-indigo-100 text-indigo-700 font-bold rounded-lg hover:bg-indigo-200 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Plus size={16} /> Bikin Folder "{customerName || 'Baru'}"
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="lbl">Tanggal Transaksi</label>
                  <div className="inp-group">
                    <Calendar size={20} className="inp-icon" />
                    <input className="inp" type="date" value={date} onChange={e => {setDate(e.target.value); setIsSaved(false);}} />
                  </div>
                </div>
                
                <div>
                  <label className="lbl text-emerald-600">Cash (Tunai)</label>
                  <div className="inp-group">
                    <Banknote size={20} className="inp-icon text-emerald-500" />
                    <input className="inp font-bold" type="text" value={formatRpInput(cash)} onChange={e => {setCash(parseRp(e.target.value)); setIsSaved(false);}} placeholder="Rp 0" />
                  </div>
                </div>
                <div>
                  <label className="lbl text-amber-500">Hutang Sebelumnya</label>
                  <div className="inp-group">
                    <Clock size={20} className="inp-icon text-amber-500" />
                    <input className={`inp font-bold ${contactId ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} type="text" value={formatRpInput(bon)} onChange={e => {setBon(parseRp(e.target.value)); setIsSaved(false);}} placeholder="Rp 0" readOnly={!!contactId} />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Daftar Barang */}
            <div className="card p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-500"><Layers size={24} /></div>
                  <h2 className="text-xl font-bold text-slate-800">Daftar Barang</h2>
                </div>
                <button className="btn-secondary !py-2.5 !px-4 text-brand hover:bg-brand/5 border-dashed border-2 hover:border-brand/30 text-sm flex items-center gap-1.5" onClick={addItem}>
                  <Plus size={18} /> Tambah Baris
                </button>
              </div>

              {/* Table Header (Desktop) */}
              <div className="hidden md:grid grid-cols-[40px_4fr_1.5fr_2.5fr_2.5fr_40px] gap-4 px-4 mb-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center">No</div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Nama Barang</div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Jumlah</div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Harga (Rp)</div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Subtotal</div>
                <div></div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={item.id} className="group relative flex flex-col md:grid md:grid-cols-[40px_4fr_1.5fr_2.5fr_2.5fr_40px] gap-3 md:gap-4 items-start md:items-center p-4 md:p-3 bg-white border border-slate-200/60 hover:border-brand/30 hover:shadow-md rounded-2xl transition-all duration-200">
                    
                    {/* MOBILE TOP BAR (Title & Delete Button) */}
                    <div className="w-full flex items-center justify-between md:hidden mb-1">
                      <div className="flex items-center gap-2">
                         <span className="w-6 h-6 rounded bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center">{idx + 1}</span>
                         <label className="lbl !mb-0 text-slate-600">Item Barang</label>
                      </div>
                      <button onClick={() => removeItem(item.id)} disabled={items.length === 1} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-rose-500 hover:!text-white hover:!bg-rose-600 hover:!border-rose-600 flex items-center justify-center disabled:opacity-20 transition-all relative z-10">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* No (Desktop only) */}
                    <div className="hidden md:flex justify-center">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center group-hover:bg-brand/10 group-hover:text-brand transition-colors">
                        {idx + 1}
                      </span>
                    </div>

                    {/* Nama Barang */}
                    <div className="w-full min-w-0">
                      <input className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 text-base font-semibold focus:outline-none focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all placeholder:text-slate-300" placeholder="Ketik nama barang..." value={item.name} onChange={e => updateItem(item.id, "name", e.target.value)} maxLength={40} />
                    </div>
                    
                    {/* MOBILE GRID: Jumlah & Harga */}
                    <div className="w-full grid grid-cols-[1fr_2.5fr] gap-3 md:contents">
                      {/* Jumlah */}
                      <div className="w-full min-w-0">
                        <label className="lbl text-[11px] md:hidden">Jumlah</label>
                        <input className="w-full px-2 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 text-base font-bold text-center focus:outline-none focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all" type="number" max={99999} placeholder="0" value={item.qty || ""} onChange={e => updateItem(item.id, "qty", e.target.value)} />
                      </div>
                      
                      {/* Harga */}
                      <div className="w-full min-w-0">
                        <label className="lbl text-[11px] md:hidden">Harga (Rp)</label>
                        <input className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 text-base font-bold text-right focus:outline-none focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all" type="text" placeholder="Rp 0" value={formatRpInput(item.price)} onChange={e => updateItem(item.id, "price", e.target.value)} />
                      </div>
                    </div>
                    
                    {/* Subtotal */}
                    <div className="w-full flex items-center justify-between md:justify-end gap-3 mt-1 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 md:border-none">
                      <label className="lbl !mb-0 md:hidden">Subtotal</label>
                      <div className="text-lg font-black text-brand text-right pr-2">{fmtRp(item.qty * item.price)}</div>
                    </div>

                    {/* Action (Desktop only) */}
                    <div className="hidden md:flex justify-end">
                      <button onClick={() => removeItem(item.id)} disabled={items.length === 1} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:!text-white hover:!bg-rose-600 hover:!border-rose-600 flex items-center justify-center disabled:opacity-20 transition-all relative z-10">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4"></div>
            </div>

          </div>

          {/* ============================================================== */}
          {/* RIGHT COLUMN: LIVE SUMMARY / ACTIONS                           */}
          {/* ============================================================== */}
          <div>
            <div className="sticky top-28 space-y-6">
              
              {/* Preview Card */}
              <div className="card shadow-xl shadow-slate-200/50 p-6 md:p-8 bg-white">
                <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4 mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Ringkasan Nota</h3>
                    <div className="text-lg font-black text-slate-800 mt-1">{customerName || "Tanpa Nama"}</div>
                  </div>
                  <div className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${isLunas ? 'bg-emerald-100 text-emerald-600' : isHutang ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                    {isLunas ? <CheckCircle2 size={14} /> : isHutang ? <Clock size={14} /> : <Calculator size={14} />}
                    {isLunas ? "LUNAS" : isHutang ? "NGUTANG" : "DRAFT"}
                  </div>
                </div>

                <div className="space-y-4 mb-6 min-h-[120px]">
                  {items.filter(i => i.name.trim()).length === 0 ? (
                    <div className="text-center text-slate-400 text-sm py-8 border-2 border-dashed border-slate-100 rounded-xl">Belum ada barang ditambahkan</div>
                  ) : (
                    items.filter(i => i.name.trim()).map((i, idx) => (
                      <div key={idx} className="flex justify-between items-start text-sm">
                        <div className="flex gap-2">
                          <span className="text-slate-400">{i.qty}x</span>
                          <span className="font-semibold text-slate-700">{i.name}</span>
                        </div>
                        <span className="font-bold text-slate-800">{fmtRp(i.qty * i.price)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-4 border-t-2 border-slate-100 space-y-3">
                  <div className="flex justify-between text-sm text-slate-500 font-medium">
                    <span>Total Item</span><span>{totalQty} Pcs ({totalJenis} Jenis)</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500 font-medium">
                    <span>Subtotal Barang</span><span>{fmtRp(totalBarang)}</span>
                  </div>
                  {bon > 0 && (
                    <div className="flex justify-between text-sm text-amber-600 font-bold bg-amber-50 px-3 py-2 rounded-lg">
                      <span>Hutang Sebelumnya</span><span>{fmtRp(bon)}</span>
                    </div>
                  )}
                  {(bon > 0 && totalBarang > 0) && (
                    <div className="flex justify-between text-sm text-slate-700 font-bold border-b border-slate-100 pb-2">
                      <span>Total Tagihan</span><span>{fmtRp(totalTagihan)}</span>
                    </div>
                  )}
                  {cash > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600 font-bold bg-emerald-50 px-3 py-2 rounded-lg">
                      <span>Dibayar (Cash)</span><span>{fmtRp(cash)}</span>
                    </div>
                  )}
                  
                  <div className={`flex justify-between items-center mt-2 p-4 rounded-2xl shadow-lg ${grandTotal < 0 ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white' : 'bg-gradient-to-r from-slate-800 to-slate-900 text-white'}`}>
                    <span className="font-bold">{grandTotal < 0 ? 'KEMBALIAN' : (grandTotal === 0 ? 'LUNAS' : 'SISA HUTANG')}</span>
                    <span className={`text-2xl font-black ${grandTotal < 0 ? 'text-white' : 'text-brand-light'}`}>{fmtRp(Math.abs(grandTotal))}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <button className="btn-secondary !text-rose-500 hover:!bg-rose-50 hover:!border-rose-200 w-full" onClick={reset}>
                    <RotateCcw size={20} /> Reset Form
                  </button>
                  <button className={`w-full flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-white touch-bounce shadow-md py-3 px-4 ${isSaved ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`} onClick={handleSaveOnly} disabled={isSaved}>
                    {isSaved ? <CheckCircle2 size={20} /> : <Plus size={20} />} {isSaved ? 'Tersimpan' : 'Simpan Data'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button className="btn-success" onClick={exportPDF}>
                    <Download size={20} /> Cetak PDF
                  </button>
                  <button className="btn-wa" onClick={shareWA}>
                    <MessageCircle size={20} /> WhatsApp
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* ── Hidden Print Area ───────────────────────────── */}
      <div className="sr-only">
        <div ref={printRef} style={{ fontFamily: "'Inter', sans-serif", background: "#fff", padding: "40px", width: "800px", minHeight: "210mm", color: "#000" }}>
          
          {/* Header using Table for perfect alignment in html2canvas */}
          <table style={{ width: "100%", marginBottom: "24px", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <tbody>
              <tr>
                {/* Left - Logo (25%) */}
                <td style={{ width: "25%", verticalAlign: "top" }}>
                  <img src={`${prefix}/logo.png`} alt="Logo" style={{ width: "130px", height: "auto", objectFit: "contain", margin: 0, padding: 0 }} />
                </td>
                
                {/* Center - INVOICE (50%) */}
                <td style={{ width: "50%", verticalAlign: "top", textAlign: "center", padding: "0 20px" }}>
                  <h1 style={{ fontSize: "36px", fontWeight: "900", margin: "0 0 10px 0", color: "#000", letterSpacing: "1px" }}>INVOICE</h1>
                  <div style={{ fontSize: "14px", lineHeight: "1.5", color: "#000", margin: "0 auto", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span>Pasar Tegaldanas, Jl. Pasar Tegaldanas, Desa Hegarmukti,</span>
                    <span>Kec. Cikarang Pusat, Kab. Bekasi, Jawa Barat 17530</span>
                  </div>
                </td>

                {/* Right - Info (25%) */}
                <td style={{ width: "25%", verticalAlign: "top" }}>
                  <div style={{ fontSize: "13px", color: "#000", marginTop: "64px", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ display: "flex", marginBottom: "6px" }}>
                        <span style={{ width: "70px", flexShrink: 0 }}>Tanggal :</span>
                        <span>{new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                      </div>
                      <div style={{ display: "flex" }}>
                        <span style={{ width: "70px", flexShrink: 0 }}>Pembeli :</span>
                        <span>{customerName || "-"}</span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ borderTop: "2px solid #000", marginBottom: "16px" }}></div>

          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0", marginBottom: "16px", fontSize: "14px" }}>
            <thead>
              <tr>
                <td style={{ paddingBottom: "16px", paddingLeft: "12px", paddingRight: "12px", textAlign: "left", fontWeight: "600", width: "40px", backgroundColor: "#3b82f6", color: "#fff" }}>No</td>
                <td style={{ paddingBottom: "16px", paddingLeft: "12px", paddingRight: "12px", textAlign: "left", fontWeight: "600", backgroundColor: "#3b82f6", color: "#fff" }}>Nama Barang</td>
                <td style={{ paddingBottom: "16px", paddingLeft: "12px", paddingRight: "12px", textAlign: "center", fontWeight: "600", width: "80px", backgroundColor: "#3b82f6", color: "#fff" }}>Jumlah</td>
                <td style={{ paddingBottom: "16px", paddingLeft: "12px", paddingRight: "12px", textAlign: "right", fontWeight: "600", width: "120px", backgroundColor: "#3b82f6", color: "#fff" }}>Harga/Pcs</td>
                <td style={{ paddingBottom: "16px", paddingLeft: "12px", paddingRight: "12px", textAlign: "right", fontWeight: "600", width: "140px", backgroundColor: "#3b82f6", color: "#fff" }}>Subtotal</td>
              </tr>
            </thead>
            <tbody>
              {items.filter(i => i.name.trim()).length === 0 ? (
                <tr style={{ backgroundColor: "#f8f9fa" }}>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>1</td>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}></td>
                  <td style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>0</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", borderBottom: "1px solid #f1f5f9" }}>Rp 0</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", borderBottom: "1px solid #f1f5f9" }}>Rp 0</td>
                </tr>
              ) : (
                items.filter(i => i.name.trim()).map((item, i) => (
                  <tr key={item.id} style={{ backgroundColor: i % 2 === 0 ? "#f8f9fa" : "#ffffff" }}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>{i + 1}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>{item.name}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>{item.qty}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid #f1f5f9" }}>{fmtRp(item.price)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid #f1f5f9", fontWeight: "bold" }}>{fmtRp(item.qty * item.price)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div style={{ borderTop: "1px solid #000", marginBottom: "16px" }}></div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "14px" }}>
            <div style={{ fontWeight: "500" }}>
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Transfer Via:</div>
              <div>BNI: 1920150577</div>
              <div>a.n. Irfandi</div>
            </div>

            <div style={{ width: "250px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontWeight: "bold" }}>Subtotal Barang</span>
                <span style={{ fontWeight: "bold" }}>{fmtRp(totalBarang)}</span>
              </div>
              {bon > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", color: "#eab308" }}>
                  <span>Hutang Sebelumnya</span>
                  <span>{fmtRp(bon)}</span>
                </div>
              )}
              {(bon > 0 && totalBarang > 0) && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontWeight: "bold" }}>
                  <span>Total Tagihan</span>
                  <span>{fmtRp(totalTagihan)}</span>
                </div>
              )}
              {cash > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", color: "#22c55e" }}>
                  <span>Dibayar (Cash)</span>
                  <span>{fmtRp(cash)}</span>
                </div>
              )}
              <div style={{ borderTop: "2px solid #000", margin: "8px 0" }}></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "16px" }}>
                <span>{grandTotal < 0 ? 'Kembalian :' : (grandTotal === 0 ? 'Lunas :' : 'Sisa Hutang :')}</span>
                <span>{fmtRp(Math.abs(grandTotal))}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "80px", display: "flex", justifyContent: "flex-end", gap: "60px", textAlign: "center", fontSize: "14px", paddingRight: "16px" }}>
            <div style={{ width: "120px" }}>
              <div style={{ borderBottom: "1px solid #000", marginBottom: "8px", height: "0" }}></div>
              <div style={{ fontWeight: "bold" }}>Irfandi</div>
              <div>(Penjual)</div>
            </div>
            <div style={{ width: "120px" }}>
              <div style={{ borderBottom: "1px solid #000", marginBottom: "8px", height: "0" }}></div>
              <div style={{ fontWeight: "bold", minHeight: "20px" }}>{customerName || ""}</div>
              <div>(Pembeli)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Alert */}
      {alertModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-pop text-center border border-slate-200">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${alertModal.type === 'success' ? 'bg-emerald-100 text-emerald-500' : alertModal.type === 'error' ? 'bg-rose-100 text-rose-500' : 'bg-blue-100 text-blue-500'}`}>
              {alertModal.type === 'success' ? <CheckCircle2 size={32} /> : alertModal.type === 'error' ? <X size={32} /> : <MessageCircle size={32} />}
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{alertModal.title}</h3>
            <p className="text-sm text-slate-500 mb-6 whitespace-pre-line leading-relaxed">{alertModal.msg}</p>
            <button 
              onClick={() => { 
                alertModal.onClose?.(); 
                setAlertModal({show: false, msg: '', title: '', type: 'info'}); 
              }} 
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-slate-800 text-white hover:bg-slate-900 shadow-lg shadow-slate-200 transition-all active:scale-[0.98]"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Modal Save Prompt (Tanpa Folder) */}
      {savePromptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-pop text-center border border-slate-200">
            <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <FolderOpen size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Belum Ada Folder</h3>
            <p className="text-sm text-slate-500 mb-6 px-2">Anda belum memilih folder pelanggan. Ingin membuat folder baru atau simpan tanpa folder ke riwayat?</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => handleCreateAndSelectFolder(true)} className="py-3 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 touch-bounce">
                Bikin Folder Baru & Simpan
              </button>
              <button onClick={() => { executeSave("general"); setSavePromptModal(false); }} className="py-3 rounded-xl font-bold text-sm bg-emerald-100 text-emerald-700 hover:bg-emerald-200 touch-bounce">
                Simpan Tanpa Folder
              </button>
              <button onClick={() => setSavePromptModal(false)} className="py-3 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 touch-bounce mt-2">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
