import type { Tool, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP tool annotations advertised on tools/list.
 * readOnlyHint is true only when the tool does not change Photoshop, the filesystem, or local config.
 * destructiveHint is true when the call can destroy pixels, layers, or the current history state.
 * idempotentHint is true when the same arguments leave the document in the same state on a second call.
 * openWorldHint is true when the call can reach the network or run arbitrary code.
 */
export type PhotoshopToolAnnotations = Required<
  Pick<ToolAnnotations, 'readOnlyHint' | 'destructiveHint' | 'idempotentHint' | 'openWorldHint'>
>;

function ann(
  readOnlyHint: boolean,
  destructiveHint: boolean,
  idempotentHint: boolean,
  openWorldHint = false,
): PhotoshopToolAnnotations {
  return { readOnlyHint, destructiveHint, idempotentHint, openWorldHint };
}

/** Document is not modified. */
const read = ann(true, false, true);
/** Changes state without destroying pixels or layers. */
const edit = (idempotent: boolean, openWorld = false) => ann(false, false, idempotent, openWorld);
/** Can destroy pixels, layers, or the current history state. */
const harm = (idempotent: boolean, openWorld = false) => ann(false, true, idempotent, openWorld);

export const TOOL_ANNOTATIONS: Record<string, PhotoshopToolAnnotations> = {
  photoshop_ping: edit(true),
  photoshop_submit_feedback: edit(false, true),
  photoshop_get_version: read,
  photoshop_get_state: read,
  photoshop_get_preview: edit(true),
  photoshop_get_capabilities: read,

  photoshop_create_document: edit(false),
  photoshop_get_document_info: read,
  photoshop_list_documents: edit(true),
  photoshop_set_active_document: edit(true),
  photoshop_save_document: harm(true),
  photoshop_close_document: harm(false),

  photoshop_create_layer: edit(false),
  photoshop_delete_layer: harm(false),
  photoshop_create_text_layer: edit(false),
  photoshop_fill_layer: harm(true),
  photoshop_fill_gradient: harm(true),
  photoshop_get_layers: read,
  photoshop_select_layer_by_name: edit(true),

  photoshop_resize_image: harm(false),
  photoshop_crop_document: harm(false),
  photoshop_place_image: edit(false),
  photoshop_open_image: edit(false),

  photoshop_convert_to_smart_object: edit(false),
  photoshop_replace_smart_object_contents: harm(true),
  photoshop_edit_smart_object_contents: edit(false),
  photoshop_create_smart_object_via_copy: edit(false),

  photoshop_fit_layer_to_document: harm(false),
  photoshop_scale_layer: harm(false),
  photoshop_move_layer: edit(false),
  photoshop_rotate_layer: harm(false),

  photoshop_rasterize_layer: harm(false),
  photoshop_set_layer_opacity: edit(true),
  photoshop_set_layer_blend_mode: edit(true),
  photoshop_set_layer_visibility: edit(true),
  photoshop_set_layer_locked: edit(true),
  photoshop_rename_layer: edit(true),
  photoshop_duplicate_layer: edit(false),
  photoshop_merge_visible_layers: harm(false),
  photoshop_flatten_image: harm(false),

  photoshop_apply_gaussian_blur: harm(false),
  photoshop_apply_sharpen: harm(false),
  photoshop_apply_noise: harm(false),
  photoshop_apply_motion_blur: harm(false),
  photoshop_apply_high_pass: harm(false),
  photoshop_apply_smart_blur: harm(false),

  photoshop_adjust_brightness_contrast: harm(false),
  photoshop_adjust_hue_saturation: harm(false),
  photoshop_auto_levels: harm(false),
  photoshop_auto_contrast: harm(false),
  photoshop_adjust_curves: edit(false),
  photoshop_desaturate: harm(true),
  photoshop_invert: harm(false),

  photoshop_list_fonts: read,
  photoshop_install_font: edit(false),
  photoshop_set_text_font: edit(true),
  photoshop_set_text_color: edit(true),
  photoshop_set_text_alignment: edit(true),
  photoshop_update_text_content: edit(true),
  photoshop_set_text_style: edit(true),
  photoshop_set_text_ranges: edit(true),

  photoshop_get_selection_bounds: read,
  photoshop_select_ellipse: edit(false),
  photoshop_expand_selection: edit(false),
  photoshop_contract_selection: edit(false),
  photoshop_feather_selection: edit(false),
  photoshop_save_selection: edit(false),
  photoshop_select_rectangle: edit(false),
  photoshop_select_all: edit(true),
  photoshop_deselect: edit(true),
  photoshop_invert_selection: edit(false),
  photoshop_create_layer_mask: edit(false),
  photoshop_delete_layer_mask: harm(false),
  photoshop_apply_layer_mask: harm(false),
  photoshop_select_subject: edit(false),
  photoshop_content_aware_fill: harm(false),

  photoshop_apply_gradient_mask: harm(false),
  photoshop_create_clipping_mask: edit(true),
  photoshop_release_clipping_mask: edit(true),

  photoshop_play_action: harm(false),
  photoshop_execute_script: harm(false, true),

  photoshop_undo: harm(false),
  photoshop_redo: harm(false),
  photoshop_get_history: read,

  photoshop_move_layer_to_position: edit(false),
  photoshop_move_layer_to_top: edit(true),
  photoshop_move_layer_to_bottom: edit(true),
  photoshop_move_layer_up: edit(false),
  photoshop_move_layer_down: edit(false),

  photoshop_generative_fill: harm(false, true),
  photoshop_generative_remove: harm(false, true),
  photoshop_generative_expand: harm(false, true),
  photoshop_generative_upscale: harm(false, true),
  photoshop_sky_replacement: harm(false),
  photoshop_generate_image: edit(false, true),
  photoshop_neural_filter: harm(false, true),

  photoshop_apply_layer_style: edit(true),

  photoshop_apply_lut: edit(false),
  photoshop_adjust_vibrance: edit(false),
  photoshop_adjust_exposure: edit(false),
  photoshop_apply_photo_filter: edit(false),
  photoshop_apply_gradient_map: edit(false),

  photoshop_list_datasets: read,
  photoshop_import_datasets: edit(false),
  photoshop_generate_from_datasets: edit(false),
  photoshop_image_stack: edit(false),

  photoshop_export_as: edit(false),
  photoshop_list_artboards: read,
  photoshop_create_artboard: edit(false),
  photoshop_set_active_artboard: edit(true),
  photoshop_export_artboards: edit(false),

  photoshop_recipe_remove_background: edit(false),
  photoshop_recipe_enhance_portrait: edit(false),
  photoshop_recipe_prepare_for_web: edit(false),
  photoshop_recipe_export_social_variants: edit(false),
  photoshop_recipe_apply_color_grade: edit(false),
  photoshop_recipe_frequency_separation: edit(false),
  photoshop_recipe_batch_mockup_replace: harm(false),
  photoshop_recipe_organize_layers: edit(false),
  photoshop_recipe_gradient_fade: harm(false),
  photoshop_recipe_sky_blend: edit(false),
  photoshop_recipe_dodge_burn: edit(false),
  photoshop_recipe_remove_distraction: harm(false),
  photoshop_recipe_split_carousel: edit(false),
  photoshop_recipe_batch_watermark: edit(false),
  photoshop_recipe_passport_photo: edit(false),
  photoshop_recipe_csv_to_cards: edit(false),
};

export function withToolAnnotations(tool: Tool): Tool {
  const annotations = TOOL_ANNOTATIONS[tool.name];
  if (!annotations) {
    throw new Error(`Missing MCP annotations for tool ${tool.name}`);
  }
  if (annotations.readOnlyHint && annotations.destructiveHint) {
    throw new Error(`readOnlyHint contradicts destructiveHint on ${tool.name}`);
  }
  return { ...tool, annotations };
}
