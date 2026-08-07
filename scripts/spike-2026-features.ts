/**
 * Dev-only ExtendScript probe runner for Photoshop 2026 (v27.x) feature research.
 * Run: npm run spike:2026
 *
 * Requires Photoshop v27.6+ on macOS/Windows with an active session.
 * Probes: reflection removal, distraction removal (wires), dynamic text,
 * partner-model generative fill, generate similar.
 * Writes machine-readable report to scripts/output/spike-2026-report.json and stdout.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PhotoshopConnection } from '../src/platform/connection.js';
import { parseExtendScriptPayload } from '../src/utils/extendscript-result.js';

const SPIKE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = join(SPIKE_ROOT, 'scripts', 'output', 'spike-2026-report.json');

export type SpikeStatus = 'scriptable' | 'partial' | 'manual_only';

export interface SpikeRow {
  action_id: string;
  descriptor: string | null;
  status: SpikeStatus;
  ps_version_tested: string;
  notes: string;
}

const SPIKE_RUNTIME = `
function __spike_s2t(s) { return app.stringIDToTypeID(s); }
function __spike_c2t(s) { return app.charIDToTypeID(s); }

function __spike_newDoc() {
  return app.documents.add(
    UnitValue(512, 'px'),
    UnitValue(512, 'px'),
    72,
    'MCP Spike 2026',
    NewDocumentMode.RGB,
    DocumentFill.WHITE
  );
}

function __spike_historyIndex(doc) {
  return doc.activeHistoryState.index;
}

function __spike_revertTo(doc, index) {
  try {
    doc.activeHistoryState = doc.historyStates[index];
  } catch (e) {}
}

function __spike_fillLayer(doc) {
  var color = new SolidColor();
  color.rgb.red = 120;
  color.rgb.green = 140;
  color.rgb.blue = 160;
  doc.selection.selectAll();
  doc.selection.fill(color);
  doc.selection.deselect();
}

function __spike_probeResult(actionId, descriptor, status, notes) {
  return {
    action_id: actionId,
    descriptor: descriptor,
    status: status,
    notes: notes
  };
}

function __spike_finish(row) {
  return __spike_json_stringify(row);
}

function __spike_json_stringify(value) {
  if (value === null) return 'null';
  var t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') return isFinite(value) ? String(value) : 'null';
  if (t === 'string') {
    return '"' + value
      .replace(/\\\\/g, '\\\\\\\\')
      .replace(/"/g, '\\\\"')
      .replace(/\\n/g, '\\\\n')
      .replace(/\\r/g, '\\\\r')
      .replace(/\\t/g, '\\\\t') + '"';
  }
  if (value instanceof Array) {
    var items = [];
    for (var i = 0; i < value.length; i++) {
      items.push(__spike_json_stringify(value[i]));
    }
    return '[' + items.join(',') + ']';
  }
  if (t === 'object') {
    var pairs = [];
    for (var key in value) {
      if (!value.hasOwnProperty(key)) continue;
      pairs.push(__spike_json_stringify(String(key)) + ':' + __spike_json_stringify(value[key]));
    }
    return '{' + pairs.join(',') + '}';
  }
  return 'null';
}
`;

function wrapProbe(body: string): string {
  return `
${SPIKE_RUNTIME}
app.displayDialogs = DialogModes.NO;
${body}
`.trim();
}

/** Mirror ExtendScriptPhotoshopAPI.wrapInErrorHandling so returns work via evalFile. */
function wrapForExternalExecution(script: string): string {
  return `
(function() {
  var __originalRulerUnits = null;
  try { __originalRulerUnits = app.preferences.rulerUnits; } catch (e) {}

  try {
    try { app.preferences.rulerUnits = Units.PIXELS; } catch (e) {}

    var result = (function() {
      ${script}
    })();
    if (typeof result === 'object' && result !== null) {
      return result.toSource ? result.toSource() : String(result);
    }
    return String(result);
  } catch (error) {
    return 'ERROR: ' + (error.message || String(error));
  } finally {
    try { if (__originalRulerUnits !== null) app.preferences.rulerUnits = __originalRulerUnits; } catch (e) {}
  }
})();
`.trim();
}

const PROBES: Array<{
  action_id: string;
  descriptor: string;
  timeoutMs: number;
  script: string;
}> = [
  {
    action_id: 'reflection_removal',
    descriptor: "executeAction('removeReflections'|'deReflect') + Camera Raw filter fallback",
    timeoutMs: 120_000,
    script: wrapProbe(`
      var doc = __spike_newDoc();
      var hist = __spike_historyIndex(doc);
      __spike_fillLayer(doc);
      var candidates = ['removeReflections', 'reflectionRemoval', 'deReflect', 'removeReflection'];
      var lastError = '';
      for (var i = 0; i < candidates.length; i++) {
        var actionId = candidates[i];
        try {
          executeAction(__spike_s2t(actionId), new ActionDescriptor(), DialogModes.NO);
          return __spike_finish(__spike_probeResult(
            'reflection_removal',
            "executeAction('" + actionId + "')",
            'partial',
            'Action accepted via ' + actionId
          ));
        } catch (e) {
          lastError = actionId + ': ' + (e.message || String(e));
          __spike_revertTo(doc, hist);
        }
      }
      // Camera Raw path: reflection removal shipped in ACR — probe the AM filter key.
      try {
        var desc = new ActionDescriptor();
        var rawDesc = new ActionDescriptor();
        rawDesc.putBoolean(__spike_s2t('removeReflections'), true);
        desc.putObject(__spike_s2t('cameraRawOptions'), __spike_s2t('cameraRawOptions'), rawDesc);
        executeAction(__spike_s2t('Adobe Camera Raw Filter'), desc, DialogModes.NO);
        return __spike_finish(__spike_probeResult(
          'reflection_removal',
          "executeAction('Adobe Camera Raw Filter') w/ removeReflections option",
          'partial',
          'Camera Raw filter accepted reflection-removal descriptor'
        ));
      } catch (eAcr) {
        lastError += ' | ACR: ' + (eAcr.message || String(eAcr));
      }
      try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
      return __spike_finish(__spike_probeResult(
        'reflection_removal',
        "executeAction('removeReflections')",
        'manual_only',
        lastError || 'No reflection-removal action ID succeeded'
      ));
    `),
  },
  {
    action_id: 'distraction_removal_wires',
    descriptor: "executeAction('findDistractions'|'removeDistractions') on Remove tool",
    timeoutMs: 120_000,
    script: wrapProbe(`
      var doc = __spike_newDoc();
      var hist = __spike_historyIndex(doc);
      __spike_fillLayer(doc);
      var candidates = [
        'findDistractions',
        'detectDistractions',
        'removeDistractions',
        'removeWiresAndCables',
        'removeTool'
      ];
      var lastError = '';
      for (var i = 0; i < candidates.length; i++) {
        var actionId = candidates[i];
        try {
          executeAction(__spike_s2t(actionId), new ActionDescriptor(), DialogModes.NO);
          return __spike_finish(__spike_probeResult(
            'distraction_removal_wires',
            "executeAction('" + actionId + "')",
            'partial',
            'Action accepted via ' + actionId
          ));
        } catch (e) {
          lastError = actionId + ': ' + (e.message || String(e));
          __spike_revertTo(doc, hist);
        }
      }
      try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
      return __spike_finish(__spike_probeResult(
        'distraction_removal_wires',
        "executeAction('findDistractions')",
        'manual_only',
        lastError || 'No distraction-removal action ID succeeded'
      ));
    `),
  },
  {
    action_id: 'dynamic_text',
    descriptor: "AM 'set' textLayer with textShape circle/arch/bow",
    timeoutMs: 30_000,
    script: wrapProbe(`
      var doc = __spike_newDoc();
      var hist = __spike_historyIndex(doc);
      try {
        var layer = doc.artLayers.add();
        layer.kind = LayerKind.TEXT;
        layer.textItem.contents = 'Dynamic Text Spike';
        var shapeCandidates = ['circle', 'arch', 'bow'];
        var keyCandidates = ['textShape', 'dynamicTextShape', 'dynamicText'];
        var lastError = '';
        for (var k = 0; k < keyCandidates.length; k++) {
          for (var s = 0; s < shapeCandidates.length; s++) {
            try {
              var desc = new ActionDescriptor();
              var ref = new ActionReference();
              ref.putEnumerated(__spike_c2t('Lyr '), __spike_c2t('Ordn'), __spike_c2t('Trgt'));
              desc.putReference(__spike_c2t('null'), ref);
              var textDesc = new ActionDescriptor();
              var shapeDesc = new ActionDescriptor();
              shapeDesc.putEnumerated(
                __spike_s2t('textShape'),
                __spike_s2t('textShapeType'),
                __spike_s2t(shapeCandidates[s])
              );
              textDesc.putObject(__spike_s2t(keyCandidates[k]), __spike_s2t(keyCandidates[k]), shapeDesc);
              desc.putObject(__spike_c2t('T   '), __spike_c2t('TxLr'), textDesc);
              executeAction(__spike_c2t('setd'), desc, DialogModes.NO);
              return __spike_finish(__spike_probeResult(
                'dynamic_text',
                "setd textLayer." + keyCandidates[k] + "=" + shapeCandidates[s],
                'partial',
                'Descriptor accepted: ' + keyCandidates[k] + '=' + shapeCandidates[s]
              ));
            } catch (e) {
              lastError = keyCandidates[k] + '/' + shapeCandidates[s] + ': ' + (e.message || String(e));
              __spike_revertTo(doc, hist);
            }
          }
        }
        return __spike_finish(__spike_probeResult(
          'dynamic_text',
          "setd textLayer.textShape",
          'manual_only',
          lastError || 'No dynamic-text descriptor accepted'
        ));
      } catch (eOuter) {
        return __spike_finish(__spike_probeResult(
          'dynamic_text',
          "setd textLayer.textShape",
          'manual_only',
          eOuter.message || String(eOuter)
        ));
      } finally {
        try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
      }
    `),
  },
  {
    action_id: 'partner_model_generative_fill',
    descriptor: "generative fill descriptor with model key (firefly/partner)",
    timeoutMs: 120_000,
    script: wrapProbe(`
      var doc = __spike_newDoc();
      var hist = __spike_historyIndex(doc);
      __spike_fillLayer(doc);
      doc.selection.select([
        [UnitValue(128, 'px'), UnitValue(128, 'px')],
        [UnitValue(384, 'px'), UnitValue(128, 'px')],
        [UnitValue(384, 'px'), UnitValue(384, 'px')],
        [UnitValue(128, 'px'), UnitValue(384, 'px')]
      ]);
      var fillIds = ['generativeFill', 'generativeFillEdit', 'syntheticFill'];
      var modelKeys = ['generativeModel', 'aiModel', 'model', 'engine'];
      var lastError = '';
      for (var f = 0; f < fillIds.length; f++) {
        for (var m = 0; m < modelKeys.length; m++) {
          try {
            var desc = new ActionDescriptor();
            desc.putString(__spike_s2t('prompt'), 'a red apple');
            desc.putString(__spike_s2t(modelKeys[m]), 'firefly');
            executeAction(__spike_s2t(fillIds[f]), desc, DialogModes.NO);
            return __spike_finish(__spike_probeResult(
              'partner_model_generative_fill',
              fillIds[f] + ' w/ ' + modelKeys[m] + '=firefly',
              'partial',
              'Fill accepted model key ' + modelKeys[m] + ' (verify model picker really switched in UI)'
            ));
          } catch (e) {
            lastError = fillIds[f] + '/' + modelKeys[m] + ': ' + (e.message || String(e));
            __spike_revertTo(doc, hist);
            doc.selection.select([
              [UnitValue(128, 'px'), UnitValue(128, 'px')],
              [UnitValue(384, 'px'), UnitValue(128, 'px')],
              [UnitValue(384, 'px'), UnitValue(384, 'px')],
              [UnitValue(128, 'px'), UnitValue(384, 'px')]
            ]);
          }
        }
      }
      try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
      return __spike_finish(__spike_probeResult(
        'partner_model_generative_fill',
        'generativeFill w/ model key',
        'manual_only',
        lastError || 'No generative-fill model key accepted'
      ));
    `),
  },
  {
    action_id: 'generate_similar',
    descriptor: "executeAction('generateSimilar'|'generativeVariations')",
    timeoutMs: 120_000,
    script: wrapProbe(`
      var doc = __spike_newDoc();
      var hist = __spike_historyIndex(doc);
      __spike_fillLayer(doc);
      var candidates = ['generateSimilar', 'generativeVariations', 'generateVariations', 'syntheticVariations'];
      var lastError = '';
      for (var i = 0; i < candidates.length; i++) {
        var actionId = candidates[i];
        try {
          executeAction(__spike_s2t(actionId), new ActionDescriptor(), DialogModes.NO);
          return __spike_finish(__spike_probeResult(
            'generate_similar',
            "executeAction('" + actionId + "')",
            'partial',
            'Action accepted via ' + actionId
          ));
        } catch (e) {
          lastError = actionId + ': ' + (e.message || String(e));
          __spike_revertTo(doc, hist);
        }
      }
      try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
      return __spike_finish(__spike_probeResult(
        'generate_similar',
        "executeAction('generateSimilar')",
        'manual_only',
        lastError || 'No generate-similar action ID succeeded'
      ));
    `),
  },
];

function parseProbePayload(raw: unknown): Omit<SpikeRow, 'ps_version_tested'> | null {
  const payload = parseExtendScriptPayload(raw);
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      return parseProbeRecord(parsed);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== 'object') return null;
  return parseProbeRecord(payload as Record<string, unknown>);
}

function parseProbeRecord(rec: Record<string, unknown>): Omit<SpikeRow, 'ps_version_tested'> | null {
  const status = rec.status;
  if (status !== 'scriptable' && status !== 'partial' && status !== 'manual_only') return null;
  return {
    action_id: typeof rec.action_id === 'string' ? rec.action_id : 'unknown',
    descriptor: typeof rec.descriptor === 'string' ? rec.descriptor : null,
    status,
    notes: typeof rec.notes === 'string' ? rec.notes : '',
  };
}

async function runProbe(
  connection: PhotoshopConnection,
  probe: (typeof PROBES)[number],
  psVersion: string
): Promise<SpikeRow> {
  try {
    const raw = await connection.executeScript(
      wrapForExternalExecution(probe.script),
      probe.timeoutMs
    );
    const parsed = parseProbePayload(raw);
    if (!parsed) {
      return {
        action_id: probe.action_id,
        descriptor: probe.descriptor,
        status: 'manual_only',
        ps_version_tested: psVersion,
        notes: `Unparseable probe result: ${typeof raw === 'string' ? raw.slice(0, 200) : JSON.stringify(raw)}`,
      };
    }
    return { ...parsed, ps_version_tested: psVersion };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status: SpikeStatus = /timeout/i.test(message) ? 'partial' : 'manual_only';
    return {
      action_id: probe.action_id,
      descriptor: probe.descriptor,
      status,
      ps_version_tested: psVersion,
      notes: message,
    };
  }
}

async function main(): Promise<void> {
  const connection = new PhotoshopConnection();
  const reachable = await connection.ping();
  if (!reachable) {
    console.error(JSON.stringify({ error: 'Photoshop not detected on this machine.' }));
    process.exit(1);
  }

  const psVersion = await connection.getVersion();
  const rows: SpikeRow[] = [];

  for (const probe of PROBES) {
    const row = await runProbe(connection, probe, psVersion);
    rows.push(row);
  }

  const report = {
    generated_at: new Date().toISOString(),
    ps_version: psVersion,
    probes: rows,
    winning_action_ids: Object.fromEntries(
      rows
        .filter((r) => r.status !== 'manual_only')
        .map((r) => [r.action_id, r.descriptor])
    ),
  };

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
