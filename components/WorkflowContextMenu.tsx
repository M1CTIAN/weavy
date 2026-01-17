"use client";

import React, { ReactNode, useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useRouter } from 'next/navigation';
import { trpc } from '@/utils/trpc';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Props: The workflow object + children (the card or row to wrap)
interface WorkflowContextMenuProps {
    workflow: any;
    children: ReactNode;
}

export const WorkflowContextMenu = ({ workflow, children }: WorkflowContextMenuProps) => {
    const router = useRouter();
    const utils = trpc.useContext();
    const [isRenaming, setIsRenaming] = useState(false);

    // --- ACTIONS ---

    // 1. OPEN
    const handleOpen = () => router.push(`/editor/${workflow.id}`);

    // 2. OPEN NEW TAB
    const handleOpenNewTab = () => window.open(`/editor/${workflow.id}`, '_blank');

    // 3. DUPLICATE (Creates a copy)
    const duplicateMutation = trpc.workflow.save.useMutation({
        onSuccess: () => {
            toast.success("Workflow duplicated");
            utils.workflow.getAll.invalidate();
        }
    });
    const handleDuplicate = () => {
        duplicateMutation.mutate({
            name: `${workflow.name} (Copy)`,
            nodes: workflow.nodes,
            edges: workflow.edges
        });
    };

    // 4. RENAME (Simple prompt for now, or we can make inline edit later)
    const renameMutation = trpc.workflow.save.useMutation({
        onSuccess: () => {
            toast.success("Renamed successfully");
            utils.workflow.getAll.invalidate();
        }
    });
    const handleRename = () => {
        const newName = prompt("Enter new name:", workflow.name);
        if (newName && newName !== workflow.name) {
            renameMutation.mutate({
                ...workflow, // Keep nodes/edges same
                id: workflow.id, // UPDATE existing ID
                name: newName
            });
        }
    };

    // 5. DELETE
    const deleteMutation = trpc.workflow.delete.useMutation({
        onSuccess: () => {
            toast.success("Workflow deleted");
            utils.workflow.getAll.invalidate();
        }
    });
    const handleDelete = () => {
        if (confirm("Are you sure you want to delete this file?")) {
            deleteMutation.mutate({ id: workflow.id });
        }
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger>{children}</ContextMenuTrigger>
            
            <ContextMenuContent className="w-56 bg-[#18181b] border-[#27272a] text-slate-300">
                <ContextMenuItem onClick={handleOpen} className="hover:bg-[#27272a] hover:text-white cursor-pointer">
                    Open
                </ContextMenuItem>
                <ContextMenuItem onClick={handleOpenNewTab} className="hover:bg-[#27272a] hover:text-white cursor-pointer">
                    Open in a new tab
                </ContextMenuItem>
                
                <ContextMenuSeparator className="bg-[#27272a]" />
                
                <ContextMenuItem onClick={handleDuplicate} className="hover:bg-[#27272a] hover:text-white cursor-pointer">
                    Duplicate
                </ContextMenuItem>
                <ContextMenuItem disabled className="text-slate-600 cursor-not-allowed">
                    Move
                </ContextMenuItem>
                <ContextMenuItem onClick={handleRename} className="hover:bg-[#27272a] hover:text-white cursor-pointer">
                    Rename
                </ContextMenuItem>

                <ContextMenuSeparator className="bg-[#27272a]" />

                <ContextMenuItem onClick={handleDelete} className="hover:bg-red-900/20 text-red-400 hover:text-red-300 cursor-pointer">
                    Delete
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};