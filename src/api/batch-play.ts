/**
 * Helper functions for batchPlay API
 * batchPlay is the modern way to execute Photoshop actions in UXP
 */

export interface ActionDescriptor {
  _obj: string;
  [key: string]: unknown;
}

export interface BatchPlayOptions {
  synchronousExecution?: boolean;
  modalBehavior?: 'wait' | 'execute' | 'fail';
}

/**
 * Create a batchPlay command template
 */
export function createBatchPlayCommand(
  action: string,
  params: Record<string, unknown> = {}
): ActionDescriptor {
  return {
    _obj: action,
    ...params,
  };
}

/**
 * Execute batchPlay commands
 */
export function generateBatchPlayScript(
  descriptors: ActionDescriptor[],
  options: BatchPlayOptions = {}
): string {
  return `
const { batchPlay } = require('photoshop').action;

const descriptors = ${JSON.stringify(descriptors)};
const options = ${JSON.stringify({
    synchronousExecution: options.synchronousExecution ?? false,
    modalBehavior: options.modalBehavior ?? 'fail',
  })};

const result = await batchPlay(descriptors, options);
return result;
  `.trim();
}

/**
 * Common batchPlay action descriptors
 */
export const Actions = {
  /**
   * Create a new document
   */
  newDocument: (width: number, height: number, resolution = 72, colorMode = 'RGBColorMode') =>
    createBatchPlayCommand('make', {
      _target: [{ _ref: 'document' }],
      width: { _unit: 'pixelsUnit', _value: width },
      height: { _unit: 'pixelsUnit', _value: height },
      resolution: { _unit: 'densityUnit', _value: resolution },
      mode: { _value: colorMode },
      fill: { _enum: 'fill', _value: 'white' },
    }),

  /**
   * Get active document info
   */
  getDocumentInfo: () =>
    createBatchPlayCommand('get', {
      _target: [{ _property: 'document' }, { _ref: 'application' }],
    }),

  /**
   * Create a text layer
   */
  createTextLayer: (text: string, x = 100, y = 100) =>
    createBatchPlayCommand('make', {
      _target: [{ _ref: 'textLayer' }],
      using: {
        _obj: 'textLayer',
        textKey: text,
        textClickPoint: {
          _obj: 'paint',
          horizontal: { _unit: 'pixelsUnit', _value: x },
          vertical: { _unit: 'pixelsUnit', _value: y },
        },
      },
    }),

  /**
   * Save document
   */
  saveDocument: (path: string, format = 'Photoshop') =>
    createBatchPlayCommand('save', {
      _target: [{ _ref: 'document', _enum: 'ordinal', _value: 'targetEnum' }],
      as: {
        _obj: format,
      },
      in: {
        _path: path,
      },
      copy: false,
    }),

  /**
   * Close document
   */
  closeDocument: (save = false) =>
    createBatchPlayCommand('close', {
      _target: [{ _ref: 'document', _enum: 'ordinal', _value: 'targetEnum' }],
      saving: { _enum: 'yesNo', _value: save ? 'yes' : 'no' },
    }),

  /**
   * Fill layer with color
   */
  fillLayer: (red: number, green: number, blue: number) =>
    createBatchPlayCommand('fill', {
      using: {
        _enum: 'fillContents',
        _value: 'color',
      },
      color: {
        _obj: 'RGBColor',
        red,
        green,
        blue,
      },
      opacity: { _unit: 'percentUnit', _value: 100 },
      mode: { _enum: 'blendMode', _value: 'normal' },
    }),

  /**
   * Create a new layer
   */
  newLayer: (name?: string) =>
    createBatchPlayCommand('make', {
      _target: [{ _ref: 'layer' }],
      ...(name && {
        using: {
          _obj: 'layer',
          name,
        },
      }),
    }),

  /**
   * Delete current layer
   */
  deleteLayer: () =>
    createBatchPlayCommand('delete', {
      _target: [{ _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
    }),

  /**
   * Resize image
   */
  resizeImage: (width: number, height: number) =>
    createBatchPlayCommand('imageSize', {
      width: { _unit: 'pixelsUnit', _value: width },
      height: { _unit: 'pixelsUnit', _value: height },
      interfaceIconFrameDimmed: { _enum: 'interpolationType', _value: 'bicubic' },
    }),
};
