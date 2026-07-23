const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Intentamos importar Zod desde los node_modules del proyecto
let z;
try {
  z = require('zod').z;
} catch {
  console.warn("Zod no está instalado en node_modules. Saltando validación por Zod.");
  process.exit(0);
}

// 1. Esquema mínimo de Zod para evaluar el archivo físico del componente generado
const ComponentFileSchema = z.object({
  componentName: z
    .string()
    .regex(/^[A-Z][a-zA-Z0-9]*$/, "El nombre del archivo/componente debe estar en PascalCase"),
  code: z
    .string()
    .min(10, "El código del componente está demasiado vacío")
    .refine(
      (code) => code.includes("export default") || code.includes("export const") || code.includes("export function"),
      "El componente debe exportarse usando 'export default', 'export const' o 'export function'"
    )
    .refine(
      (code) => !code.includes("import React ") && !code.includes("import React,"),
      "No uses 'import React' innecesarios en React 17/18+"
    )
});

try {
  // 2. Obtener los archivos .tsx creados o modificados en el git stage/cambios locales
  const gitOutput = execSync('git status --porcelain', { encoding: 'utf8' });
  const modifiedFiles = gitOutput
    .split('\n')
    .map(line => line.trim())
    .filter(line => (line.startsWith('A') || line.startsWith('M') || line.startsWith('??')) && line.endsWith('.tsx'))
    .map(line => line.split(/\s+/)[1]);

  if (modifiedFiles.length === 0) {
    process.exit(0);
  }

  console.log(`\n🔍 AGY PostInvocation: Validando ${modifiedFiles.length} componente(s) generado(s)...`);
  let hasErrors = false;

  for (const relativePath of modifiedFiles) {
    const absolutePath = path.resolve(process.cwd(), relativePath);
    if (!fs.existsSync(absolutePath)) continue;

    const code = fs.readFileSync(absolutePath, 'utf8');
    const componentName = path.basename(relativePath, '.tsx');

    // Validamos el código del componente con el esquema de Zod
    const validation = ComponentFileSchema.safeParse({
      componentName,
      code
    });

    if (!validation.success) {
      hasErrors = true;
      console.error(`\n❌ ERROR DE VALIDACIÓN en [${relativePath}]:`);
      validation.error.issues.forEach(issue => {
        console.error(`  - ${issue.message}`);
      });
    } else {
      console.log(`  ✅ [${relativePath}] es un componente válido.`);
    }
  }

  if (hasErrors) {
    console.error("\nCRITICAL: Uno o más componentes generados no cumplen con el schema de Zod.");
    process.exit(1); // Detiene el flujo de AGY/Antigravity indicando que falló el hook
  }

} catch (error) {
  console.error("Error al ejecutar el hook de validación:", error.message);
  process.exit(0); // No bloqueamos el pipeline ante un fallo del script del hook en sí
}
