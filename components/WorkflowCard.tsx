import React from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Network } from 'lucide-react';
import Link from 'next/link';

interface WorkflowCardProps {
    id: string;
    name: string;
    updatedAt: Date;
}

export const WorkflowCard = ({ id, name, updatedAt }: WorkflowCardProps) => {
  // Simple date formatting
  const formattedDate = new Date(updatedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Link href={`/editor/${id}`} className="block group">
        <Card className="bg-[#1E1E21] border-0 overflow-hidden rounded-xl transition-all duration-200 hover:ring-2 hover:ring-purple-500 cursor-pointer">
            {/* Placeholder icon area matching the screenshot */}
            <CardContent className="p-0 h-40 bg-[#262629] flex items-center justify-center relative group-hover:bg-[#2d2d30] transition-colors">
                 <Network size={48} className="text-slate-600 opacity-50" />
            </CardContent>
            
            <CardFooter className="p-4 flex flex-col items-start gap-1 bg-[#1E1E21]">
                <h3 className="text-slate-100 font-semibold text-sm truncate w-full">{name || "Untitled"}</h3>
                <p className="text-xs text-slate-500">Last edited: {formattedDate}</p>
            </CardFooter>
        </Card>
    </Link>
  );
};