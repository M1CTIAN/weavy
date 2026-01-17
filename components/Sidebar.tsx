import React, { useState, useEffect } from 'react';
import { 
  Type, 
  Image as ImageIcon, 
  Video, 
  Sparkles, 
  Crop, 
  ScanLine, 
  Home
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs'; // 👈 Import Clerk

interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: (v: boolean) => void;
    workflowName: string;
    setWorkflowName: (name: string) => void;
    workflowId: string;
}

export const Sidebar = ({ 
    isCollapsed, 
    setIsCollapsed, 
    workflowName, 
    setWorkflowName,
    workflowId
}: SidebarProps) => {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab) {
        setIsCollapsed(false);
    } else {
        setIsCollapsed(true);
    }
  }, [activeTab, setIsCollapsed]);

  const handleTabClick = (tab: string) => {
    setActiveTab(activeTab === tab ? null : tab);
  };

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Helper to determine which group to show based on active tab
  const showInputs = ['text', 'image', 'video'].includes(activeTab || '');
  const showModels = activeTab === 'llm';
  const showProcessing = ['crop', 'extract'].includes(activeTab || '');

  return (
    <>
        {/* --- 1. FIXED ICON STRIP --- */}
        <div className="absolute left-0 top-0 h-full w-16 bg-[#09090b] border-r border-[#27272a] flex flex-col items-center py-6 z-50">
            
            {/* Logo (Links to Dashboard) */}
            <div className="relative mb-6">
                <Link href="/workflows">
                    <button className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#27272a] transition-colors" title="Back to Dashboard">
                         <img 
                            src="https://app.weavy.ai/icons/logo.svg" 
                            alt="Weavy Logo" 
                            className="w-8 h-8 object-contain invert brightness-0 opacity-80 hover:opacity-100 transition-opacity" 
                        />
                    </button>
                </Link>
            </div>

            {/* --- TOOL BUTTONS --- */}
            <div className="flex flex-col gap-2 w-full px-2">
                
                <IconBtn 
                    icon={<Type size={20} />} 
                    label="Text Input" 
                    isActive={activeTab === 'text'} 
                    onClick={() => handleTabClick('text')} 
                />

                <IconBtn 
                    icon={<ImageIcon size={20} />} 
                    label="Upload Image" 
                    isActive={activeTab === 'image'} 
                    onClick={() => handleTabClick('image')} 
                />

                <IconBtn 
                    icon={<Video size={20} />} 
                    label="Upload Video" 
                    isActive={activeTab === 'video'} 
                    onClick={() => handleTabClick('video')} 
                />

                <div className="w-full h-px bg-[#27272a] my-1" />

                <IconBtn 
                    icon={<Sparkles size={20} />} 
                    label="LLM Processor" 
                    isActive={activeTab === 'llm'} 
                    onClick={() => handleTabClick('llm')} 
                />

                <div className="w-full h-px bg-[#27272a] my-1" />

                <IconBtn 
                    icon={<Crop size={20} />} 
                    label="Crop Image" 
                    isActive={activeTab === 'crop'} 
                    onClick={() => handleTabClick('crop')} 
                />

                <IconBtn 
                    icon={<ScanLine size={20} />} 
                    label="Extract Frame" 
                    isActive={activeTab === 'extract'} 
                    onClick={() => handleTabClick('extract')} 
                />
            </div>

            {/* Spacer to push UserButton to bottom */}
            <div className="flex-1" />

            {/* --- AUTH BUTTON --- */}
            <div className="mt-4">
                <UserButton 
                    afterSignOutUrl="/" 
                    appearance={{
                        elements: {
                            avatarBox: "w-8 h-8 hover:opacity-80 transition-opacity"
                        }
                    }}
                />
            </div>
        </div>

        {/* --- 2. SLIDING DRAWER PANEL --- */}
        <div 
            className={cn(
                "absolute top-0 h-full bg-[#131316] border-r border-[#27272a] transition-all duration-300 ease-in-out z-40 flex flex-col",
                activeTab ? "left-16 w-64 opacity-100" : "left-0 w-0 opacity-0 overflow-hidden"
            )}
        >
            <div className="p-5 h-full overflow-y-auto w-64">
                
                <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                    <h2 className="text-lg font-bold text-white mb-1">Toolbox</h2>
                    <p className="text-xs text-slate-500 mb-6">Drag components to canvas</p>

                    {/* GROUP: INPUTS */}
                    {showInputs && (
                        <div className="mb-6">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Inputs</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <DraggableCard 
                                    type="textNode" 
                                    label="Text" 
                                    icon={<Type size={20} />} 
                                    onDragStart={onDragStart}
                                />
                                <DraggableCard 
                                    type="imageNode" 
                                    label="Image" 
                                    icon={<ImageIcon size={20} />} 
                                    onDragStart={onDragStart}
                                />
                                <DraggableCard 
                                    type="videoNode" 
                                    label="Video" 
                                    icon={<Video size={20} />} 
                                    onDragStart={onDragStart}
                                />
                            </div>
                        </div>
                    )}

                    {/* GROUP: AI MODELS */}
                    {showModels && (
                         <div className="mb-6">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">AI Models</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <DraggableCard 
                                    type="llmNode" 
                                    label="Gemini Pro" 
                                    icon={<Sparkles size={20} />} 
                                    onDragStart={onDragStart}
                                />
                            </div>
                        </div>
                    )}

                    {/* GROUP: PROCESSING */}
                    {showProcessing && (
                         <div className="mb-6">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Processing</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <DraggableCard 
                                    type="cropImageNode" 
                                    label="Crop" 
                                    icon={<Crop size={20} />} 
                                    onDragStart={onDragStart}
                                />
                                <DraggableCard 
                                    type="extractFrameNode" 
                                    label="Extract" 
                                    icon={<ScanLine size={20} />} 
                                    onDragStart={onDragStart}
                                />
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    </>
  );
};

// --- HELPER COMPONENTS ---

interface IconBtnProps {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const IconBtn = ({ icon, label, isActive, onClick }: IconBtnProps) => {
    return (
        <div className="relative group w-full flex justify-center">
            <button
                onClick={onClick}
                className={cn(
                    "p-3 rounded-xl transition-all duration-200 hover:bg-[#27272a] text-slate-500 hover:text-slate-200",
                    isActive && "text-white bg-[#27272a]"
                )}
            >
                {icon}
            </button>
            {/* Tooltip */}
            <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-black border border-[#27272a] text-white text-xs px-2 py-1.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-60 shadow-xl">
                <span className="font-semibold">{label}</span>
            </div>
        </div>
    )
}

const DraggableCard = ({ type, label, icon, onDragStart }: any) => {
    return (
        <div 
            className="flex flex-col items-center justify-center gap-3 p-4 bg-[#18181b] border border-[#27272a] rounded-xl cursor-grab hover:bg-[#27272a] hover:border-slate-600 transition-all group"
            draggable
            onDragStart={(e) => onDragStart(e, type)}
        >
            <div className="text-slate-400 group-hover:text-white transition-colors">
                {icon}
            </div>
            <span className="text-xs font-medium text-slate-300 text-center">{label}</span>
        </div>
    )
}