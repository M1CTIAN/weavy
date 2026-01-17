"use client";

import React, { useState } from 'react';
import Link from 'next/link'; // 1. Import Link
import { cn } from '@/lib/utils';

// 2. Add 'href' to your items
const LIBRARY_ITEMS = [
  { 
    id: 1, 
    title: 'Weavy Welcome', 
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
    href: '#' // 👈 Links to your new JSON-based page
  },
  { 
    id: 2, 
    title: 'Weavy Iterators', 
    image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&q=80',
    href: '#' // Placeholder
  },
  { 
    id: 3, 
    title: 'Multiple Image Models', 
    image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&q=80',
    href: '#' 
  },
  { 
    id: 4, 
    title: 'Editing Images', 
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&q=80',
    href: '#' 
  },
  { 
    id: 5, 
    title: 'Compositor Node', 
    image: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=400&q=80',
    href: '#' 
  },
  { 
    id: 6, 
    title: 'Image to Video', 
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&q=80',
    href: '#' 
  },
];

export const WorkflowLibrary = () => {
  const [activeTab, setActiveTab] = useState<'library' | 'tutorials'>('library');

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 mb-10">
      {/* Tabs */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setActiveTab('library')}
          className={cn(
            "px-3 py-1 text-xs font-semibold rounded-md transition-colors",
            activeTab === 'library' ? "bg-[#27272a] text-white" : "text-slate-500 hover:text-slate-300"
          )}
        >
          Workflow library
        </button>
        <button
          onClick={() => setActiveTab('tutorials')}
          className={cn(
            "px-3 py-1 text-xs font-semibold rounded-md transition-colors",
            activeTab === 'tutorials' ? "bg-[#27272a] text-white" : "text-slate-500 hover:text-slate-300"
          )}
        >
          Tutorials
        </button>
      </div>

      {/* Horizontal Scroll Area */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {LIBRARY_ITEMS.map((item) => (
          // 3. Wrap with Link
          <Link 
            key={item.id} 
            href={item.href}
            className="min-w-40 group cursor-pointer relative block" // Added 'block'
          >
            <div className="relative aspect-video rounded-lg overflow-hidden bg-[#202024] border border-[#27272a] group-hover:border-purple-500/50 transition-all">
               <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all z-10" />
               <img 
                 src={item.image} 
                 alt={item.title}
                 className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" 
               />
               <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent z-20" />
               <span className="absolute bottom-2 left-3 right-3 text-[11px] font-medium text-white z-30 truncate">
                 {item.title}
               </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};