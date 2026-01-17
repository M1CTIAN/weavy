import React, { useState } from 'react';
import { useReactFlow, useViewport } from 'reactflow';
import { MousePointer2, Hand, ChevronDown, ChevronUp, Check, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import useFlowStore from '@/store/flowStore';

// Custom Undo/Redo SVG
const UndoIcon = ({ className }: { className?: string }) => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
        d="M7.125 12.75L2.625 8.25L7.125 3.75" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    />
    <path 
        d="M7.125 18.75H15.375C16.7674 18.75 18.1027 18.1969 19.0873 17.2123C20.0719 16.2277 20.625 14.8924 20.625 13.5C20.625 12.1076 20.0719 10.7723 19.0873 9.78769C18.1027 8.80312 16.7674 8.25 15.375 8.25H2.625" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    />
  </svg>
);

// Define Props
interface BottomBarProps {
    activeTool: 'select' | 'hand';
    setActiveTool: (tool: 'select' | 'hand') => void;
}

export const BottomBar = ({ activeTool, setActiveTool }: BottomBarProps) => {
  const { fitView, zoomIn, zoomOut, zoomTo } = useReactFlow();
  const { zoom } = useViewport();
  const [isOpen, setIsOpen] = useState(false);
  const zoomPercent = Math.round(zoom * 100);

  const undo = useFlowStore((state) => state.undo);
  const redo = useFlowStore((state) => state.redo);
  const past = useFlowStore((state) => state.past);
  const future = useFlowStore((state) => state.future);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center bg-[#18181b] border border-[#27272a] p-1 rounded-xl shadow-2xl z-50">
        
        {/* --- GROUP 1: TOOLS --- */}
        <div className="flex items-center gap-1 px-1">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setActiveTool('select')}
                className={cn(
                    "h-8 w-8 rounded-lg transition-all",
                    activeTool === 'select' 
                        ? "bg-[#DFFF5E] text-black hover:bg-[#DFFF5E] hover:text-black" // Active State (Yellow)
                        : "text-slate-400 hover:text-white hover:bg-[#27272a]"
                )}
            >
                <MousePointer2 size={16} fill={activeTool === 'select' ? "currentColor" : "none"} />
            </Button>
            
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setActiveTool('hand')}
                className={cn(
                    "h-8 w-8 rounded-lg transition-all",
                    activeTool === 'hand' 
                         ? "bg-[#DFFF5E] text-black hover:bg-[#DFFF5E] hover:text-black" 
                         : "text-slate-400 hover:text-white hover:bg-[#27272a]"
                )}
            >
                <Hand size={16} />
            </Button>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-[#27272a] mx-2" />

        {/* --- GROUP 2: UNDO/REDO --- */}
        <div className="flex items-center gap-1">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={undo}
                disabled={!canUndo}
                className={cn(
                    "h-8 w-8 rounded-lg transition-colors",
                    !canUndo ? "text-slate-600 cursor-not-allowed" : "text-slate-400 hover:text-white hover:bg-[#27272a]"
                )}
            >
                <UndoIcon />
            </Button>

            <Button 
                variant="ghost" 
                size="icon" 
                onClick={redo}
                disabled={!canRedo}
                className={cn(
                    "h-8 w-8 rounded-lg transition-colors",
                    !canRedo ? "text-slate-600 cursor-not-allowed" : "text-slate-400 hover:text-white hover:bg-[#27272a]"
                )}
            >
                <UndoIcon className="scale-x-[-1]" />
            </Button>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-[#27272a] mx-2" />

        {/* --- GROUP 3: ZOOM DROPDOWN --- */}
        <div className="relative px-1">
            <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="h-8 text-sm font-medium text-slate-200 hover:text-white hover:bg-[#27272a] gap-2 px-2 rounded-lg transition-colors"
            >
            <span>{zoomPercent}%</span>
            <ChevronDown size={14} className="text-slate-400" />
            </Button>

            {/* Dropdown Menu */}
            {isOpen && (
            <>
                <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl py-1 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <MenuItem label="Zoom in" shortcut="Ctrl +" onClick={() => zoomIn()} />
                    <MenuItem label="Zoom out" shortcut="Ctrl -" onClick={() => zoomOut()} />
                    <MenuItem label="Zoom to 100%" shortcut="Ctrl 0" onClick={() => zoomTo(1)} isChecked={zoomPercent === 100}/>
                    <div className="h-px bg-[#27272a] my-1 mx-2" />
                    <MenuItem label="Zoom to fit" shortcut="Ctrl 1" onClick={() => fitView({ padding: 0.2, duration: 800 })} />
                </div>
            </>
            )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-[#27272a] mx-2" />

        {/* --- GROUP 4: FIT VIEW BUTTON --- */}
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => fitView({ padding: 0.2, duration: 800 })} 
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-[#27272a] rounded-lg transition-colors"
            title="Fit to Screen (Ctrl+1)"
        >
            <Maximize size={16} />
        </Button>
    </div>
  );
};

// --- Helper Component ---
interface MenuItemProps {
  label: string;
  shortcut?: string;
  onClick: () => void;
  isChecked?: boolean;
}

const MenuItem = ({ label, shortcut, onClick, isChecked }: MenuItemProps) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-[#27272a] hover:text-white transition-colors text-left"
    >
      <div className="flex items-center gap-2">
        <div className="w-4 flex justify-center">
          {isChecked && <Check size={14} className="text-purple-400" />}
        </div>
        <span>{label}</span>
      </div>
      {shortcut && <span className="text-slate-500 font-mono">{shortcut}</span>}
    </button>
  );
};