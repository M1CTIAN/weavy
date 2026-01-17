"use client";
import 'reactflow/dist/style.css';
import React, { useRef, useCallback, useEffect, useState, use } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  NodeTypes,
  MiniMap,
  useReactFlow,
  addEdge,     
  Connection,  
  Edge,        
} from 'reactflow';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { BottomBar } from '@/components/BottomBar';
import { TextNode } from '@/components/nodes/TextNode';
import { ImageNode } from '@/components/nodes/ImageNode';
import { VideoNode } from '@/components/nodes/VideoNode';
import { LLMNode } from '@/components/nodes/LLMNode';
import { CropImageNode } from '@/components/nodes/CropImageNode'; 
import { ExtractFrameNode } from '@/components/nodes/ExtractFrameNode'; 
import { HistorySidebar } from '@/components/HistorySidebar';
import { WorkflowToolbar } from '@/components/WorkflowToolbar';
import useFlowStore from '@/store/flowStore';
import { trpc } from '@/utils/trpc';
import { Loader2 } from 'lucide-react'; // Added for loading state

const nodeTypes: NodeTypes = {
  textNode: TextNode,
  imageNode: ImageNode,
  videoNode: VideoNode,
  llmNode: LLMNode,
  cropImageNode: CropImageNode,
  extractFrameNode: ExtractFrameNode, 
};

// --- Custom Edge Styling (Defaults) ---
const defaultEdgeOptions = {
  style: { 
    stroke: '#71717a', 
    strokeWidth: 2 
  },
  markerEnd: undefined,
  animated: false, 
};

const connectionLineStyle = { 
  stroke: '#a1a1aa', 
  strokeWidth: 2 
};

// --------------------------------

export default function EditorPage({ params }: { params: Promise<{ workflowId: string }> }) {
    const { workflowId } = use(params);

    return (
        <ReactFlowProvider>
            <Editor workflowId={workflowId} />
        </ReactFlowProvider>
    );
}

function Editor({ workflowId }: { workflowId: string }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow(); 

  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange, 
    setNodes, 
    setEdges, 
    addNode,
    takeSnapshot,
    reset 
  } = useFlowStore();
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [workflowName, setWorkflowName] = useState("Untitled");
  const [activeTool, setActiveTool] = useState<'select' | 'hand'>('select');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isDataLoaded = useRef(false);
  const originalNameRef = useRef<string>("Untitled");
  const originalNodesRef = useRef<any[]>([]);
  const originalEdgesRef = useRef<any[]>([]);
  const originalNameStateRef = useRef<string>("Untitled");

  // -------------------------------------------------------------------------------
  // ✅ 1. CONNECTION VALIDATION (Moved INSIDE component to access 'nodes' state)
  // -------------------------------------------------------------------------------
  const isValidConnection = useCallback((connection: any) => {
    const { source, targetHandle } = connection;
    // Access the LIVE nodes state
    const sourceNode = nodes.find((n) => n.id === source);
    
    if (!sourceNode) return false;
    const type = sourceNode.type || '';

    // TEXT NODE: Allow connecting to Text inputs AND Image inputs (as URLs)
    if (type === 'textNode') {
      return (
          // Standard Inputs
          ['user', 'system', 'timestamp-input', 'video-input', 
           'config-input', 'x', 'y', 'width', 'height'].includes(targetHandle || '') || 
          // ✅ FIX: Allow Text Nodes to connect to Image Inputs (URL strings)
          targetHandle?.startsWith('images-')
      );
    }

    // IMAGE SOURCES: Allow connecting to any Image Input
    // Consolidates logic for Image, Crop, and Extract Frame
    if (['imageNode', 'cropImageNode', 'extractFrameNode'].includes(type)) {
      return targetHandle?.startsWith('images-') || targetHandle === 'input';
    }

    // VIDEO NODE: Connect to Video Input
    if (type === 'videoNode') {
      return targetHandle === 'video-input'; 
    }
    
    // Default: Allow
    return true;
  }, [nodes]); // Depends on 'nodes' so it always sees the correct types


  // --- Custom onConnect with Coloring Logic ---
  const onConnectCustom = useCallback((params: Connection) => {
    let edgeStyle = {};
    let animated = true; 

    // Determine style based on the TARGET handle
    if (params.targetHandle === 'system' || params.targetHandle === 'config-input') {
       edgeStyle = { stroke: '#4ade80', strokeWidth: 2 }; 
    } 
    else if (['user', 'timestamp-input', 'x', 'y', 'width', 'height'].includes(params.targetHandle || '')) {
       edgeStyle = { stroke: '#ec4899', strokeWidth: 2 }; 
    } 
    else if (params.targetHandle?.startsWith('images-') || params.targetHandle === 'input') {
       edgeStyle = { stroke: '#a855f7', strokeWidth: 2 }; 
    } 
    else if (params.targetHandle === 'video-input') {
       edgeStyle = { stroke: '#3b82f6', strokeWidth: 2 }; 
    } 
    else {
       edgeStyle = { stroke: '#64748b', strokeWidth: 2 };
       animated = false;
    }

    const newEdge = {
        ...params,
        type: 'default',
        animated: animated,
        style: edgeStyle,
    };

    setEdges(addEdge(newEdge, edges));
  }, [setEdges, edges]); 

  // --- Reset & Load Logic ---
  useEffect(() => {
    reset();
    isDataLoaded.current = false; 
    originalNameRef.current = "Untitled";
    originalNodesRef.current = [];
    originalEdgesRef.current = [];
    originalNameStateRef.current = "Untitled";
    setHasUnsavedChanges(false);
  }, [workflowId, reset]);

  const saveMutation = trpc.workflow.save.useMutation();
  const utils = trpc.useContext();
  const stateRef = useRef({ nodes, edges, workflowName });

  useEffect(() => {
    stateRef.current = { nodes, edges, workflowName };
  }, [nodes, edges, workflowName]);

  // Check for unsaved changes
  useEffect(() => {
    if (!isDataLoaded.current) return;
    
    const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(originalNodesRef.current);
    const edgesChanged = JSON.stringify(edges) !== JSON.stringify(originalEdgesRef.current);
    const nameChanged = workflowName !== originalNameStateRef.current;
    
    setHasUnsavedChanges(nodesChanged || edgesChanged || nameChanged);
  }, [nodes, edges, workflowName]);

  // Prevent page reload with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && isDataLoaded.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSave = async (): Promise<boolean> => {
    const { nodes: currentNodes, edges: currentEdges, workflowName: currentName } = stateRef.current;
    const cleanNodes = JSON.parse(JSON.stringify(currentNodes));
    const cleanEdges = JSON.parse(JSON.stringify(currentEdges));
    
    return new Promise((resolve) => {
      saveMutation.mutate({
        id: workflowId,
        name: currentName,
        nodes: cleanNodes,
        edges: cleanEdges
      }, {
        onSuccess: () => {
          originalNodesRef.current = cleanNodes;
          originalEdgesRef.current = cleanEdges;
          originalNameStateRef.current = currentName;
          originalNameRef.current = currentName;
          setHasUnsavedChanges(false);
          utils.workflow.getAll.invalidate();
          resolve(true);
        },
        onError: () => {
          resolve(false);
        }
      });
    });
  };

  // Auto-save on unmount
  useEffect(() => {
    return () => {
        if (!isDataLoaded.current) return;

        const { nodes: currentNodes, edges: currentEdges, workflowName: currentName } = stateRef.current;
        const cleanNodes = JSON.parse(JSON.stringify(currentNodes));
        const cleanEdges = JSON.parse(JSON.stringify(currentEdges));
        
        saveMutation.mutate({
            id: workflowId,
            name: currentName,
            nodes: cleanNodes,
            edges: cleanEdges
        });
    };
  }, []); 

  // --- Data Fetching ---
  const { data, isLoading } = trpc.workflow.getOne.useQuery(
    { id: workflowId },
    { refetchOnWindowFocus: false, refetchOnMount: true }
  ) as any;

  useEffect(() => {
    if (data && !isLoading) {
        if (data.nodes) {
            setNodes(data.nodes);
            setEdges(data.edges);
            originalNodesRef.current = JSON.parse(JSON.stringify(data.nodes));
            originalEdgesRef.current = JSON.parse(JSON.stringify(data.edges));
        }
        if (data.name) {
            setWorkflowName(data.name);
            originalNameRef.current = data.name;
            originalNameStateRef.current = data.name;
        }
        isDataLoaded.current = true;
    }
  }, [data, isLoading, setNodes, setEdges]); 

  // --- Drag & Drop ---
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `${type}-${Date.now()}`, 
        type,
        position,
        data: { label: `New ${type}` },
      };

      addNode(newNode);
    },
    [addNode, screenToFlowPosition] 
  );

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-slate-100 overflow-hidden">
      
      {/* 1. LEFT SIDEBAR */}
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed}
        workflowName={workflowName}
        setWorkflowName={setWorkflowName}
        workflowId={workflowId}
      />
      
      {/* 2. CENTER CONTENT */}
      {/* Added min-w-0 to prevent flex item from overflowing and squishing sidebars */}
      <div className="flex-1 flex flex-col relative h-full min-w-0">
        
        <TopBar 
            workflowId={workflowId} 
            workflowName={workflowName} 
            setWorkflowName={setWorkflowName}
            isSidebarCollapsed={isSidebarCollapsed}
            isLoading={!isDataLoaded.current}
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={handleSave}
            isSaving={saveMutation.isPending}
        />
        
        {/* React Flow Wrapper */}
        {/* Added min-h-0 to ensure it scrolls properly */}
        <div className="flex-1 relative w-full min-h-0" ref={reactFlowWrapper}>
          
          {/* Loading Indicator inside canvas to prevent UI flash */}
          {isLoading ? (
             <div className="flex h-full w-full items-center justify-center gap-2 text-slate-500 bg-[#09090b]">
                <Loader2 className="animate-spin" />
                <span>Loading Workflow...</span>
             </div>
          ) : (
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnectCustom} 
                onDragOver={onDragOver}
                onDrop={onDrop}
                nodeTypes={nodeTypes}
                fitView
                className="bg-[#09090b]"
                onNodeDragStart={() => takeSnapshot()}
                panOnDrag={activeTool === 'hand'}
                selectionOnDrag={activeTool === 'select'}
                panOnScroll={true} 
                zoomOnScroll={true}
                deleteKeyCode={['Backspace', 'Delete']}
                defaultEdgeOptions={defaultEdgeOptions}
                connectionLineStyle={connectionLineStyle}
                // ✅ PASSING THE NEW INTERNAL VALIDATION
                isValidConnection={isValidConnection}
            >
                <Background color="#333" gap={20} size={1} />
                <MiniMap 
                    position="bottom-right"
                    className="bg-[#18181b]! border! border-[#27272a]! rounded-lg! shadow-xl! m-8!"
                    maskColor="#09090b"
                    nodeColor="#27272a"
                    nodeStrokeColor="#3f3f46"
                    zoomable pannable
                />
                <Controls className="hidden" /> 
            </ReactFlow>
          )}
        </div>

        <BottomBar activeTool={activeTool} setActiveTool={setActiveTool} />
      </div>

      {/* 3. RIGHT SIDEBAR */}
      <HistorySidebar workflowId={workflowId} />
    </div>
  );
}