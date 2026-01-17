import { create } from 'zustand';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from 'reactflow';

type HistorySnapshot = {
  nodes: Node[];
  edges: Edge[];
};

type RFState = {
  nodes: Node[];
  edges: Edge[];
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  undo: () => void;
  redo: () => void;
  takeSnapshot: () => void;
  reset: () => void;
  deleteSelected: () => void;
};

const useFlowStore = create<RFState>((set, get) => ({
  nodes: [],
  edges: [],
  past: [],
  future: [],

  reset: () => {
    set({ nodes: [], edges: [], past: [], future: [] });
  },

  takeSnapshot: () => {
    set((state) => ({
      past: [...state.past, { nodes: state.nodes, edges: state.edges }],
      future: [], 
    }));
  },

  deleteSelected: () => {
    const { nodes, edges } = get();
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedEdges = edges.filter((e) => e.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    get().takeSnapshot();

    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));

    const nextNodes = nodes.filter((n) => !n.selected);
    const nextEdges = edges.filter((e) => {
      const isSelected = e.selected;
      const isConnectedToDeleted = selectedNodeIds.has(e.source) || selectedNodeIds.has(e.target);
      return !isSelected && !isConnectedToDeleted;
    });

    set({ nodes: nextNodes, edges: nextEdges });
  },

  undo: () => {
    const { past, future, nodes, edges } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    set({ nodes: previous.nodes, edges: previous.edges, past: newPast, future: [{ nodes, edges }, ...future] });
  },

  redo: () => {
    const { past, future, nodes, edges } = get();
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    set({ nodes: next.nodes, edges: next.edges, past: [...past, { nodes, edges }], future: newFuture });
  },

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

  // --- UPDATED CONNECT LOGIC: No Label, No Arrow ---
  onConnect: (connection: Connection) => {
    get().takeSnapshot(); 
    const { nodes, edges } = get();

    // 1. Determine Color based on Source Node Type
    const sourceNode = nodes.find((n) => n.id === connection.source);
    
    let edgeColor = '#71717a'; // Default Grey

    if (sourceNode?.type === 'textNode') {
        edgeColor = '#ec4899'; // Pink
    } else if (sourceNode?.type === 'imageNode') {
        edgeColor = '#a855f7'; // Purple
    } else if (sourceNode?.type === 'videoNode') {
        edgeColor = '#a855f7'; // Purple
    }

    // 2. Create Clean Edge (No Label, No Arrow)
    const newEdgeOption = {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        style: { 
            stroke: edgeColor, 
            strokeWidth: 3,
        },
        animated: true,
        // REMOVED: label, labelStyle, etc.
        // REMOVED: markerEnd (the arrow)
    };

    // 3. One-Input Rule (Remove existing edges on target handle)
    const existingEdge = edges.find(
      (edge) => 
        edge.target === connection.target && 
        edge.targetHandle === connection.targetHandle
    );

    let newEdges = edges;
    if (existingEdge) {
      newEdges = edges.filter((edge) => edge.id !== existingEdge.id);
    }

    set({
      edges: addEdge(newEdgeOption, newEdges),
    });
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) => {
    get().takeSnapshot(); 
    set({ nodes: [...get().nodes, node] });
  },
}));

export default useFlowStore;