import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * SkillMentor AI Utility: cn
 * Safely merges Tailwind classes and resolves conflicts.
 * Essential for March 2026 Tailwind v4 workflows.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Utility to safely extract week ranges from roadmap phases.
 * Fixes the "possibly undefined" errors when accessing phase weeks.
 */
export function getWeekRange(duration_weeks?: number[], weeks?: number[]) {
  const activeWeeks = duration_weeks ?? weeks ?? [0];
  const start = activeWeeks[0];
  const end = activeWeeks[activeWeeks.length - 1];
  return { start, end };
}