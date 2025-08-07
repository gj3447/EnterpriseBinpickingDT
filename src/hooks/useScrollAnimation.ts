"use client";

import { useRef, RefObject } from "react";
import { useScroll, useTransform, MotionValue } from "framer-motion";

interface ScrollAnimationOutput {
    ref: RefObject<HTMLDivElement>;
    opacity: MotionValue<number>;
    y: MotionValue<string>;
}

export function useScrollAnimation(): ScrollAnimationOutput {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"],
    });

    const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0]);
    const y = useTransform(scrollYProgress, [0, 1], ["50px", "-50px"]);

    return { ref, opacity, y };
}

