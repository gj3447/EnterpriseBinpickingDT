"use client";

import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { AbstractVisual } from "./AbstractVisual";

export function HeroSection() {
    return (
        <div className="h-screen w-full relative flex flex-col items-center justify-center">
            <div className="absolute inset-0 z-0">
                <AbstractVisual />
            </div>
            
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="relative z-10 text-center"
            >
                <h1 
                    className="text-6xl md:text-8xl font-bold tracking-tighter text-gray-800 dark:text-gray-100"
                    style={{ textShadow: '0 4px 20px rgba(0,0,0,0.25)' }}
                >
                    Enterprise BinPicking DT
                </h1>
                <p 
                    className="mt-4 text-lg md:text-xl text-gray-600 dark:text-gray-300"
                    style={{ textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}
                >
                    미래의 생산성을 지금 바로 경험하세요
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 1, repeat: Infinity, repeatType: "reverse" }}
                className="absolute bottom-10 z-10"
            >
                <ArrowDown className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </motion.div>
        </div>
    );
}

