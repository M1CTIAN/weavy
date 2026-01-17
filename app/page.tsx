import React from 'react';
import { Navbar } from '@/components/landing/Navbar';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f3f4f6] relative selection:bg-[#F3F878] selection:text-black overflow-x-hidden">
        
        {/* Background Grid Pattern */}
        {/* Simple CSS grid to match the blueprint look */}
        <div 
            className="absolute inset-0 z-0 pointer-events-none opacity-40" 
            style={{
                backgroundImage: `
                    linear-gradient(to right, #d1d5db 1px, transparent 1px),
                    linear-gradient(to bottom, #d1d5db 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px'
            }}
        />

        {/* Navigation */}
        <div className="relative z-50">
            <Navbar />
        </div>

        {/* Hero Content Placeholder */}
        <main className="relative z-10 flex flex-col items-center justify-center pt-32 px-4 text-center max-w-5xl mx-auto">
            <h1 className="text-7xl md:text-9xl font-bold tracking-tighter text-black mb-8 leading-[0.9]">
                Artistic<br/>Intelligence.
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 max-w-2xl leading-relaxed font-light">
                The workflow engine for the AI era. Build, iterate, and scale your generative pipelines with ease.
            </p>
        </main>
    </div>
  );
}