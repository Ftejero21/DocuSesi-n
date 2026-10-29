import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { inputSchema } from '../core/schema';
import { validarInput } from '../core/validacion';

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));

describe('schema y manifiesto', () => {
  const tool = pkg.contributes.languageModelTools[0];

  it('inputSchema de package.json es idéntico a schema.ts', () => {
    assert.deepStrictEqual(tool.inputSchema, inputSchema);
  });

  it('la herramienta se declara como se espera', () => {
    assert.strictEqual(tool.name, 'docusesion_documentar');
    assert.strictEqual(tool.toolReferenceName, 'documentacion');
    assert.strictEqual(tool.canBeReferencedInPrompt, true);
    assert.strictEqual(tool.icon, '$(book)');
    assert.deepStrictEqual(tool.inputSchema.required, ['tipo', 'titulo', 'resumen']);
    assert.ok(!('additionalProperties' in tool.inputSchema));
    assert.deepStrictEqual(pkg.activationEvents, []);
    assert.strictEqual(pkg.engines.vscode, '^1.143.0');
    assert.strictEqual(pkg.devDependencies['@types/vscode'], '1.140.0');
    assert.ok(!pkg.enabledApiProposals);
    assert.strictEqual(pkg.capabilities.untrustedWorkspaces.supported, false);
    assert.strictEqual(pkg.capabilities.virtualWorkspaces, false);
    assert.strictEqual(pkg.contributes.commands[0].command, 'docusesion.documentarCambios');
    assert.strictEqual(pkg.contributes.commands[0].category, 'DocuSesión');
  });

  it('modelDescription incluye las seis instrucciones', () => {
    const d: string = tool.modelDescription;
    for (const clave of ['SCOPE', 'READ BEFORE WRITING', 'NEVER INVENT', '[pendiente de verificar]', 'REAL NAME RESOLUTION', 'VERIFICATION EXAMPLES', 'DOCUMENT CONTENT', 'depende_de_entorno', 'nombreReal', 'invoke the tool again']) {
      assert.ok(d.includes(clave), `falta: ${clave}`);
    }
  });

  it('todos los ajustes tienen scope resource', () => {
    const props = pkg.contributes.configuration.properties;
    assert.deepStrictEqual(Object.keys(props).sort(), [
      'docusesion.idioma',
      'docusesion.permitirRutasFueraDelWorkspace',
      'docusesion.plantillaExcel',
      'docusesion.plantillaWord',
      'docusesion.rutaPorDefecto'
    ]);
    for (const p of Object.values<{ scope: string }>(props)) {
      assert.strictEqual(p.scope, 'resource');
    }
  });

  it('validarInput acepta el mínimo, aplica default de modo y devuelve errores legibles', () => {
    const ok = validarInput({ tipo: 'cambio', titulo: 'T', resumen: 'R' });
    assert.ok(ok.ok);
    if (ok.ok) {
      assert.strictEqual(ok.input.modo, 'auto');
    }
    const mal = validarInput({ tipo: 'otro', titulo: '', mapeoNombres: [{ nombreEnCodigo: 'a' }] });
    assert.ok(!mal.ok);
    if (!mal.ok) {
      const t = mal.errores.join('\n');
      assert.ok(t.includes('tipo'));
      assert.ok(t.includes('resumen'));
      assert.ok(t.includes('nombreReal'));
    }
    assert.ok(validarInput({ tipo: 'cambio', titulo: 'T', resumen: 'R', extra: 1 }).ok, 'tolera propiedades extra');
  });
});
