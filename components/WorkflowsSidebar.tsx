"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  Plus, 
  Folder, 
  Users, 
  LayoutGrid, 
  Loader2, 
  LogOut 
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useUser, useClerk } from '@clerk/nextjs'; // 👈 Import Clerk hooks

export const WorkflowsSidebar = () => {
  const router = useRouter();
  const utils = trpc.useContext();
  const { user } = useUser(); // Get user data
  const { signOut } = useClerk(); // Get sign out function

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Create Workflow Mutation
  const createMutation = trpc.workflow.save.useMutation({
    onSuccess: (data: any) => {
        toast.success("Workflow created!");
        utils.workflow.getAll.invalidate(); 
        if (data?.id) {
            router.push(`/editor/${data.id}`);
        }
    },
    onError: (error: any) => {
        toast.error(`Failed to create workflow: ${error.message}`);
    }
  });

  const handleCreate = () => {
      createMutation.mutate({
          name: "Untitled Workflow", 
          nodes: [],
          edges: []
      });
  };

  const handleSignOut = async () => {
      await signOut();
      router.push("/");
  };

  return (
    <div className="w-64 h-screen bg-[#09090b] border-r border-[#27272a] flex flex-col p-4 fixed left-0 top-0 z-50 font-sans">
        
        {/* User Profile Dropdown */}
        <div className="relative mb-6">
            <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center gap-3 px-2 py-2 cursor-pointer hover:bg-[#27272a] rounded-lg transition-colors group text-left border border-transparent hover:border-[#3f3f46]/50"
            >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 shrink-0 overflow-hidden">
                    {user?.imageUrl && (
                        <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                    )}
                </div>
                
                {/* Name & Email */}
                <div className="flex flex-col flex-1 overflow-hidden">
                    <span className="text-sm font-semibold text-white truncate">
                        {user?.fullName || user?.firstName || "User"}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate">
                        {user?.primaryEmailAddress?.emailAddress}
                    </span>
                </div>
                
                <ChevronDown size={14} className={`text-slate-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute top-full left-0 w-full mt-2 bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl py-1 z-20 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                        <button 
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-red-400 hover:bg-[#27272a] hover:text-red-300 transition-colors text-left font-medium"
                        >
                            <LogOut size={14} />
                            Sign Out
                        </button>
                    </div>
                </>
            )}
        </div>

        {/* Create Button */}
        <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="w-full bg-[#DFFF5E] hover:bg-[#cfee5e] text-black font-semibold mb-6 justify-start px-4 h-10 relative"
        >
            {createMutation.isPending ? (
                <Loader2 size={18} className="mr-2 animate-spin" />
            ) : (
                <Plus size={18} className="mr-2" />
            )}
            Create New File
        </Button>

        {/* Navigation Group */}
        <div className="space-y-1">
            <NavItem icon={<Folder size={18} />} label="My Files" active hasAction />
            <NavItem icon={<Users size={18} />} label="Shared with me" />
            <NavItem icon={<LayoutGrid size={18} />} label="Apps" />
        </div>

        {/* Bottom Actions (Discord) */}
        <div className="mt-auto">
             <a href="#" className="flex items-center gap-3 text-slate-400 hover:text-white px-4 py-2 text-sm font-medium transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1432-.1064.2868-.2132.4233-.3219a.0757.0757 0 00.0288-.0718c3.9635 1.8098 8.242 1.8098 12.163 0a.077.077 0 00.0288.0718c.1365.1087.28.2155.4218.3219a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                </svg>
                Discord
            </a>
        </div>
    </div>
  );
};

const NavItem = ({ icon, label, active, hasAction }: { icon: React.ReactNode, label: string, active?: boolean, hasAction?: boolean }) => (
    <div className={`flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${active ? 'bg-[#18181b] text-white' : 'text-slate-400 hover:text-white hover:bg-[#18181b]'}`}>
        {icon}
        {label}
        {hasAction && <Plus size={14} className="ml-auto text-slate-500 hover:text-white transition-colors" />} 
    </div>
);