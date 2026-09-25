"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export function AdminMotion({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 24 }}
    >
      {children}
    </motion.div>
  );
}
