"use client";

import { motion } from "framer-motion";
import { QuantumVisual } from "./QuantumVisual";
import { ConnectivityVisual } from "./ConnectivityVisual";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

import { NeuralNetworkVisual } from "./NeuralNetworkVisual";

export function FeatureSection({ 
  title, 
  description,
  visual 
}: { 
  title: string, 
  description: string,
  visual: 'quantum' | 'connectivity' | 'neuralNetwork'
}) {
  const { ref, opacity, y } = useScrollAnimation();

  return (
    <motion.section
      ref={ref}
      className="h-screen w-full relative flex items-center justify-center"
    >
      <div className="absolute inset-0 z-0">
        {visual === 'quantum' && <QuantumVisual />}
        {visual === 'connectivity' && <ConnectivityVisual />}
        {visual === 'neuralNetwork' && <NeuralNetworkVisual />}
      </div>
      <motion.div
        style={{ opacity, y }}
        className="relative z-10 text-center px-8"
      >
        <h2 className="text-5xl md:text-7xl font-bold text-gray-800 dark:text-gray-100 mb-4">{title}</h2>
        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">{description}</p>
      </motion.div>
    </motion.section>
  );
}

