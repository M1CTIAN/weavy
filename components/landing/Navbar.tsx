"use client";

import React from 'react';
import Link from 'next/link';

export function Navbar() {
    return (
        <div className="w-full font-sans z-50 relative flex flex-col">

            {/* 1. TOP ANNOUNCEMENT BANNER */}
            <div className="w-full bg-black h-12.5 flex items-center justify-center text-[13px] font-medium tracking-wide z-20">
                <div className="flex items-center gap-3  transition-opacity cursor-pointer">
                    <img
                        src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/69032e91ec29a8f27508fa9c_Image-Figma_acc.avif"
                        alt="Figma x Weavy"
                        className="h-5 w-auto object-contain"
                    />
                    <span className='text-white'>Weavy is now a part of Figma</span>
                </div>
            </div>

            {/* 2. MAIN NAVIGATION */}
            <nav className="w-full h-22 bg-[#f3f4f6]/80 backdrop-blur-md flex items-stretch justify-between pr-0 z-10">

                {/* LEFT: LOGO AREA */}
                <div className="flex items-center h-full pb-12">
                    <Link href="/" className="h-full block">
                        <img
                            src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/682350d42a7c97b440a58480_Nav%20left%20item%20-%20DESKTOP.svg"
                            alt="Weavy Artistic Intelligence"
                            className="h-full w-auto object-contain invert hover:opacity-70 transition-opacity duration-200 cursor-pointer"
                        />
                    </Link>
                </div>

                {/* RIGHT: LINKS & CTA */}
                <div className="flex items-stretch h-full">

                    {/* Navigation Links */}
                    {/* Updated: items-start + pt-7 to stick them to the top area */}
                    <div className="hidden xl:flex gap-8 pt-3 mr-5">
                        {['COLLECTIVE', 'ENTERPRISE', 'PRICING', 'REQUEST A DEMO', 'SIGN IN'].map((item) => (
                            <Link
                                key={item}
                                href="#"
                                className="text-[13px] font-bold text-[#1a1a1a] hover:text-black tracking-tight uppercase transition-colors"
                            >
                                {item}
                            </Link>
                        ))}
                    </div>

                    <Link
                        href="/editor/new"
                        className="h-full pr-8 hover:text-white px-2 bg-[#F7FF9E] hover:bg-black text-black text-[38px] leading-none font-normal tracking-tight flex justify-center transition-colors rounded-bl-[10px]"
                    >
                        <span className='pt-9'>Start Now</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}