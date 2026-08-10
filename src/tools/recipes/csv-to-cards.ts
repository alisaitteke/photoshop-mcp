import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ToolDefinition, ToolResult } from '../../core/tool-registry.js';
import { PhotoshopConnection } from '../../platform/connection.js';
import { executeStandaloneRecipe, jsString } from './_shared.js';
import { readFileSync } from 'node:fs';

const TOOL_NAME = 'photoshop_recipe_csv_to_cards';

const OUTPUT_FORMATS = ['JPEG', 'PNG'] as const;

export function bindCsvToCards(connection: PhotoshopConnection): ToolDefinition {
  return {
    tool: {
      name: TOOL_NAME,
      description:
        'Data-driven graphics batch: convert a CSV file into Photoshop data sets, apply each row to the active template document and export one image per row. "Mail merge for images" — name cards, badges, certificates, personalized banners.\n' +
        '\n' +
        'Users often say: csv to images, batch name cards, personalized banners, generate badges from spreadsheet, sertifika bastır.\n' +
        '\n' +
        'CSV rules: first row = variable names matching the variables defined in the template PSD (Image > Variables > Define). ' +
        'A cell holding an absolute path to an image file (.png/.jpg/.webp/.tif/.psd) is treated as a pixel-replacement variable.\n' +
        '\n' +
        'Use when: the user has a template PSD with variable-bound layers and a CSV of rows.\n' +
        'Do NOT use when: the document has no variables defined — define them in Photoshop first (Image > Variables > Define).\n' +
        '\n' +
        'Returns: { ok, summary, details: { rows, exported, output_paths, xml_path } }.\n' +
        '\n' +
        'Preconditions: active document with variable-bound layers; readable CSV file.\n' +
        'Side effects: writes a temp variables XML and one output file per row into output_dir.',
      inputSchema: {
        type: 'object',
        properties: {
          csv_path: {
            type: 'string',
            description: 'Absolute path to the CSV file (first row = variable names)',
          },
          output_dir: {
            type: 'string',
            description: 'Directory for generated files (created if missing)',
          },
          format: {
            type: 'string',
            enum: OUTPUT_FORMATS,
            description: 'Output format (default JPEG)',
            default: 'JPEG',
          },
        },
        required: ['csv_path', 'output_dir'],
      },
    },
    handler: async (args) => runCsvToCards(connection, args),
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const IMAGE_CELL = /\.(png|jpe?g|webp|tiff?|psd|gif)$/i;

function buildVariablesXml(columns: string[], dataRows: string[][]): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE variables PUBLIC "-//Adobe//DTD Variables 1.0//EN" "variables.dtd">',
    '<variables xmlns:v="http://ns.adobe.com/Variables/1.0/">',
  ];
  for (const col of columns) {
    lines.push(
      `  <variable var="${xmlEscape(col)}" kind="text" visibility="visible" trait="textcontent" category=""></variable>`
    );
  }
  lines.push('  <dataSetSet>');
  dataRows.forEach((cells, idx) => {
    lines.push(`    <dataSet v:name="row_${idx + 1}">`);
    columns.forEach((col, c) => {
      const value = cells[c] ?? '';
      if (IMAGE_CELL.test(value.trim())) {
        lines.push(
          `      <variable var="${xmlEscape(col)}" kind="pixel" trait="fileref" category="image"><value>${xmlEscape(value.trim())}</value></variable>`
        );
      } else {
        lines.push(
          `      <variable var="${xmlEscape(col)}"><value>${xmlEscape(value)}</value></variable>`
        );
      }
    });
    lines.push('    </dataSet>');
  });
  lines.push('  </dataSetSet>', '</variables>');
  return lines.join('\n');
}

async function runCsvToCards(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const csvPath = typeof args.csv_path === 'string' ? args.csv_path.trim() : '';
  const outputDir = typeof args.output_dir === 'string' ? args.output_dir.trim() : '';
  const format = OUTPUT_FORMATS.includes(args.format as (typeof OUTPUT_FORMATS)[number])
    ? (args.format as (typeof OUTPUT_FORMATS)[number])
    : 'JPEG';

  if (!csvPath || !outputDir) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            ok: false,
            code: 'invalid_args',
            message: 'csv_path and output_dir are required',
          }),
        },
      ],
      isError: true,
    };
  }

  let csvText: string;
  try {
    csvText = readFileSync(csvPath, 'utf8');
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            ok: false,
            code: 'file_not_found',
            message: `Cannot read CSV: ${error instanceof Error ? error.message : String(error)}`,
          }),
        },
      ],
      isError: true,
    };
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            ok: false,
            code: 'empty_csv',
            message: 'CSV needs a header row plus at least one data row',
          }),
        },
      ],
      isError: true,
    };
  }

  const columns = rows[0].map((c) => c.trim()).filter(Boolean);
  const dataRows = rows.slice(1);
  const xml = buildVariablesXml(columns, dataRows);
  const xmlPath = join(tmpdir(), `photoshop-mcp-datasets-${Date.now()}.xml`);
  writeFileSync(xmlPath, xml, 'utf8');

  const ext = format === 'PNG' ? 'png' : 'jpg';
  const body = `
    if (app.documents.length === 0) {
      return { ok: false, code: 'no_active_document', message: 'Open the template PSD first', suggested_next_tool: 'photoshop_open_image' };
    }
    var doc = app.activeDocument;
    var xmlFile = new File("${jsString(xmlPath)}");
    if (!xmlFile.exists) {
      return { ok: false, code: 'file_not_found', message: 'variables XML missing: ${jsString(xmlPath)}' };
    }
    var folder = new Folder("${jsString(outputDir)}");
    if (!folder.exists && !folder.create()) {
      return { ok: false, code: 'output_dir_not_writable', message: 'Cannot create output_dir: ${jsString(outputDir)}' };
    }

    try {
      doc.importVariables(xmlFile);
    } catch (eImport) {
      return {
        ok: false,
        code: 'import_failed',
        message: 'importVariables failed (does the template have variable-bound layers?): ' + (eImport.message || eImport),
        suggested_next_tool: 'photoshop_list_datasets'
      };
    }
    if (!doc.dataSets || doc.dataSets.length === 0) {
      return {
        ok: false,
        code: 'no_datasets',
        message: 'XML imported but no data sets appeared — verify variable names match the template (Image > Variables > Define)',
        suggested_next_tool: 'photoshop_list_datasets'
      };
    }

    var outputs = [];
    for (var i = 0; i < doc.dataSets.length; i++) {
      var set = doc.dataSets[i];
      doc.activeDataSet = set;
      var base = "${jsString(outputDir)}/" + set.name.replace(/[^a-zA-Z0-9_\\-]+/g, '_');
      if ('${format}' === 'PNG') {
        doc.saveAs(new File(base + '.${ext}'), new PNGSaveOptions(), true, Extension.LOWERCASE);
      } else {
        var jpg = new JPEGSaveOptions();
        jpg.quality = 10;
        doc.saveAs(new File(base + '.${ext}'), jpg, true, Extension.LOWERCASE);
      }
      outputs.push(base + '.${ext}');
    }

    return {
      ok: true,
      summary: 'Generated ' + outputs.length + ' card(s) from CSV rows',
      undo_history_states_consumed: 0,
      next_suggested_tool: 'photoshop_get_preview',
      details: {
        rows: ${dataRows.length},
        exported: outputs.length,
        output_paths: outputs,
        output_dir: "${jsString(outputDir)}",
        format: '${format}',
        xml_path: "${jsString(xmlPath)}"
      }
    };
  `;

  return executeStandaloneRecipe(connection, body);
}
