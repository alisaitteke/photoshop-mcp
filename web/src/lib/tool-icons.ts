import type { Component } from 'vue';
import {
  Activity,
  BoxSelect,
  CircleDot,
  Crop,
  Eraser,
  Eye,
  FileImage,
  History,
  ImageDown,
  Info,
  Layers,
  PaintBucket,
  Play,
  Redo2,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Type,
  Undo2,
  Wand2,
  Wrench,
} from 'lucide-vue-next';
import { displayToolName } from './tool-display';

type IconMatcher = {
  test: (name: string) => boolean;
  icon: Component;
};

const EXACT_ICONS: Record<string, Component> = {
  photoshop_create_document: FileImage,
  photoshop_open_image: FileImage,
  photoshop_save_document: FileImage,
  photoshop_close_document: FileImage,
  photoshop_get_document_info: Info,
  photoshop_get_version: Tag,
  photoshop_ping: Activity,
  photoshop_fill_layer: PaintBucket,
  photoshop_flatten_image: ImageDown,
  photoshop_undo: Undo2,
  photoshop_redo: Redo2,
  photoshop_get_history: History,
  photoshop_get_state: Eye,
  photoshop_get_preview: Eye,
  photoshop_get_capabilities: Eye,
  photoshop_play_action: Play,
  photoshop_execute_script: Play,
  photoshop_content_aware_fill: Eraser,
  photoshop_deselect: BoxSelect,
  photoshop_invert_selection: BoxSelect,
  photoshop_select_subject: BoxSelect,
  photoshop_list_fonts: Type,
};

const PATTERN_ICONS: IconMatcher[] = [
  { test: (n) => n.startsWith('photoshop_recipe_'), icon: Wand2 },
  { test: (n) => n.startsWith('photoshop_select_'), icon: BoxSelect },
  { test: (n) => n.includes('_mask'), icon: CircleDot },
  { test: (n) => n.includes('_text'), icon: Type },
  { test: (n) => n.includes('_layer'), icon: Layers },
  {
    test: (n) =>
      n.includes('_blur') ||
      n.includes('apply_noise') ||
      n.includes('apply_sharpen'),
    icon: Sparkles,
  },
  {
    test: (n) =>
      n.startsWith('photoshop_adjust_') ||
      n.startsWith('photoshop_auto_') ||
      n === 'photoshop_desaturate' ||
      n === 'photoshop_invert',
    icon: SlidersHorizontal,
  },
  {
    test: (n) =>
      n === 'photoshop_resize_image' ||
      n === 'photoshop_crop_document' ||
      n === 'photoshop_place_image',
    icon: Crop,
  },
];

export function getToolIcon(name: string): Component {
  const normalized = displayToolName(name);
  if (!normalized || normalized === '…') return Wrench;

  if (EXACT_ICONS[normalized]) return EXACT_ICONS[normalized];

  for (const { test, icon } of PATTERN_ICONS) {
    if (test(normalized)) return icon;
  }

  return Wrench;
}
