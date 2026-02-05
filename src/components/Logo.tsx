import React from "react";

export const Logo = () => (
    <svg className="app-logo" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
            <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="45%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
            <filter id="logo-shadow">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
            </filter>
        </defs>
        {/* Outer shell – matches icon style */}
        <rect x="6" y="6" width="108" height="108" rx="26" fill="#374151" opacity="0.12" />
        <rect x="14" y="14" width="92" height="92" rx="22" fill="url(#logo-grad)" filter="url(#logo-shadow)" />
        <path d="M44 36 L44 84 L88 84 L88 52 L72 36 L44 36 Z M72 36 L72 52 L88 52 L72 36 Z" fill="white" fillOpacity="0.95" />
        <line x1="50" y1="58" x2="82" y2="58" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        <line x1="50" y1="66" x2="78" y2="66" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <line x1="50" y1="74" x2="80" y2="74" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
);
