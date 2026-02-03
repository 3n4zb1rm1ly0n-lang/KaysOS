import { Sidebar } from "@/components/panel/sidebar";
import { MobileNav } from "@/components/panel/mobile-nav";

export default function PanelLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-[#0B0F14] text-[#E5E7EB] font-sans flex-col md:flex-row">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 overflow-y-auto text-foreground bg-background">
                {children}
            </main>
        </div>
    );
}
