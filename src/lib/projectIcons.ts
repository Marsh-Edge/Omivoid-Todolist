import {
  BookOpen,
  Briefcase,
  Code,
  Dumbbell,
  Folder,
  GraduationCap,
  Heart,
  Home,
  Lightbulb,
  Plane,
  ShoppingCart,
  Star,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated project icons. We deliberately keep this a small, explicit allowlist
 * (instead of wildcard-importing all of lucide-react) so the icon set stays
 * tree-shakeable and the bundle small. Names are stored verbatim in
 * `Project.icon` and must match an entry here to render.
 */
export const PROJECT_ICONS: ReadonlyArray<{
  name: string;
  Icon: LucideIcon;
}> = [
  { name: "Folder", Icon: Folder },
  { name: "Briefcase", Icon: Briefcase },
  { name: "Home", Icon: Home },
  { name: "Star", Icon: Star },
  { name: "Heart", Icon: Heart },
  { name: "BookOpen", Icon: BookOpen },
  { name: "Code", Icon: Code },
  { name: "GraduationCap", Icon: GraduationCap },
  { name: "ShoppingCart", Icon: ShoppingCart },
  { name: "Plane", Icon: Plane },
  { name: "Dumbbell", Icon: Dumbbell },
  { name: "Lightbulb", Icon: Lightbulb },
];

const byName = new Map(PROJECT_ICONS.map((entry) => [entry.name, entry.Icon]));

/**
 * Name → component lookup. Exposed as a plain record so callers can index it
 * in render (e.g. `PROJECT_ICON_MAP[project.icon]`) without the React Compiler
 * treating the result as a component created during render.
 */
export const PROJECT_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  byName,
);
