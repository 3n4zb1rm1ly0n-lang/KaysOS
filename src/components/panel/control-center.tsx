
import { Bell, Search, Settings } from "lucide-react";

export function ControlCenter() {
    return (
        <div className="flex items-center gap-4">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Ara..."
                    className="pl-9 pr-4 py-2 w-64 bg-secondary/50 border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
            </div>

            <div className="flex items-center ml-auto gap-2 border-l pl-4 dark:border-gray-800">
                <button className="p-2 rounded-full hover:bg-secondary transition-colors relative">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </button>
                <button className="p-2 rounded-full hover:bg-secondary transition-colors">
                    <Settings className="w-5 h-5 text-muted-foreground" />
                </button>
            </div>
        </div>
    );
}
