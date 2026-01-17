import React, { useRef } from 'react';
import { useReactFlow } from 'reactflow';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

// Optional: Accept className to allow custom positioning if needed elsewhere
export function WorkflowToolbar({ className = "" }: { className?: string }) {
  const { getNodes, getEdges, getViewport, setNodes, setEdges, setViewport } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- EXPORT FUNCTION ---
  const handleExport = () => {
    const flow = {
      nodes: getNodes(),
      edges: getEdges(),
      viewport: getViewport(),
      version: "1.0.0"
    };

    const jsonString = JSON.stringify(flow, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `workflow-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Workflow exported successfully!");
  };

  // --- IMPORT FUNCTION ---
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (typeof result !== 'string') return;
        const flow = JSON.parse(result);

        if (!flow.nodes || !flow.edges) throw new Error("Invalid workflow file structure");

        setNodes(flow.nodes || []);
        setEdges(flow.edges || []);
        if (flow.viewport) {
          const { x, y, zoom } = flow.viewport;
          setViewport({ x, y, zoom });
        }
        toast.success("Workflow loaded successfully!");
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse workflow file.");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    // ✅ CHANGED: Removed 'absolute top-4 right-4 z-50'
    // Now it's just a flex container that will sit nicely next to your buttons
    <div className={`flex gap-2 ${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        onClick={handleImportClick}
        className="
          flex items-center gap-2 px-3 py-2 bg-[#1E1E21] border border-[#2A2A2E] 
          text-slate-300 text-xs font-medium rounded-lg 
          hover:bg-[#27272a] hover:border-slate-500 hover:text-white transition-all
        "
        title="Import Workflow JSON"
      >
        <Upload size={14} />
        Import
      </button>

      <button
        onClick={handleExport}
        className="
          flex items-center gap-2 px-3 py-2 bg-[#1E1E21] border border-[#2A2A2E] 
          text-slate-300 text-xs font-medium rounded-lg 
          hover:bg-[#27272a] hover:border-slate-500 hover:text-white transition-all
        "
        title="Export Workflow JSON"
      >
        <Download size={14} />
        Export
      </button>
    </div>
  );
}