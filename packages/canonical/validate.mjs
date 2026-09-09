// packages/canonical/validate.mjs
//
// Validates a Canonical Chart JSON against schemas/canonical-chart-schema.json.
//
// DEVIATION FROM ORIGINAL SCHEMA (recorded here + CHANGELOG.md, per project
// instructions not to silently overwrite existing structure):
//
//   The original schema (carried over verbatim from the previous project,
//   see schemas/canonical-chart-schema.json) lists "natal" as a REQUIRED
//   top-level field, because that project also computed Western astrology
//   charts. This product excludes Western astrology entirely (see README
//   §1 제품 방향). Deleting the "natal" section from the schema file itself
//   would violate the instruction to keep the existing schema intact, so
//   instead this validator clones the schema at runtime and removes only
//   "natal" from the top-level `required` array before validating. The
//   schema FILE on disk is untouched.
//
// This means: a Canonical JSON with a `natal` block still validates fine
// (for compatibility with the old chart-engine test project), but `natal`
// is no longer mandatory for this app.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const SCHEMA_PATH = path.resolve('./schemas/canonical-chart-schema.json');

let cachedValidator = null;

export async function getValidator() {
  if (cachedValidator) return cachedValidator;

  const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf-8'));

  // Deep clone + strip "natal" from required (see module doc comment above).
  const patchedSchema = JSON.parse(JSON.stringify(schema));
  patchedSchema.required = (patchedSchema.required ?? []).filter((k) => k !== 'natal');
  // ajv resolves $schema against a registered meta-schema URI; rather than
  // wiring up draft-07 meta-schema registration, just drop the pointer —
  // the schema's actual keyword usage (type/properties/required/$defs/etc.)
  // is fully draft-07-compatible and validates identically without it.
  delete patchedSchema.$schema;

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  cachedValidator = ajv.compile(patchedSchema);
  return cachedValidator;
}

/**
 * @param {object} canonicalJson
 * @returns {{ valid: boolean, errors: Array<object> | null }}
 */
export async function validateCanonicalChart(canonicalJson) {
  const validate = await getValidator();
  const valid = validate(canonicalJson);
  return { valid, errors: valid ? null : validate.errors };
}
