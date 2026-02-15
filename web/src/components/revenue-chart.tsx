"use client"

import React from 'react'

interface DataPoint {
    date: string;
    amount: number;
}

interface RevenueChartProps {
    data: DataPoint[];
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
    if (!data || data.length === 0) return (
        <div className="h-48 w-full border border-nimbus/20 flex items-center justify-center bg-white/50 animate-pulse">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Calibrating Profit Curves...</span>
        </div>
    );

    const maxVal = Math.max(...data.map(d => d.amount), 10);
    const width = 400;
    const height = 150;
    const padding = 20;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
        const y = height - ((d.amount / maxVal) * (height - padding * 2) + padding);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="w-full h-48 relative group">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full preserve-3d">
                <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 4" />

                {/* Area Shadow */}
                <path
                    d={`M ${padding},${height - padding} L ${points} L ${width - padding},${height - padding} Z`}
                    fill="url(#chartGradient)"
                    className="transition-all duration-700 opacity-0 group-hover:opacity-100"
                />

                {/* Trend Line */}
                <polyline
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                    className="drop-shadow-2xl"
                />

                {/* Pulse Points */}
                {data.map((d, i) => {
                    const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
                    const y = height - ((d.amount / maxVal) * (height - padding * 2) + padding);
                    return (
                        <circle key={i} cx={x} cy={y} r="2" fill="var(--primary)" className="animate-pulse" />
                    );
                })}
            </svg>

            <div className="absolute top-0 right-0 p-4">
                <span className="text-[8px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Daily Ingest Trend</span>
            </div>
        </div>
    );
}
