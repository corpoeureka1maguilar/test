import { z } from 'zod';

// 1. Definición del esquema que debe cumplir la respuesta del Agente de IA
export const GeneratedComponentSchema = z.object({
  componentName: z
    .string()
    .min(1, "El nombre del componente es requerido")
    .regex(/^[A-Z][a-zA-Z0-9]*$/, "El nombre del componente debe estar en PascalCase (ej: MyComponent)"),
  
  description: z
    .string()
    .min(10, "Proporcioná una descripción clara del componente y su propósito"),
  
  props: z.array(
    z.object({
      name: z.string().min(1, "El nombre de la prop es requerido"),
      type: z.string().min(1, "El tipo de la prop es requerido (ej: string, number, () => void)"),
      required: z.boolean(),
      description: z.string().optional()
    })
  ).default([]),
  
  dependencies: z.array(
    z.string().min(1, "El nombre de la dependencia no puede estar vacío")
  ).default([]),
  
  code: z
    .string()
    .min(10, "El código del componente no puede estar vacío")
    .refine(
      (code) => code.includes("export default") || code.includes(`export const`),
      "El código debe exportar el componente (export default o export const)"
    )
    .refine(
      (code) => !code.includes("import React ") && !code.includes("import React,"),
      "No es necesario importar React en React 17+ / 18+. Usá imports directos si los necesitás."
    )
});

// Tipado TypeScript inferido del esquema
export type GeneratedComponent = z.infer<typeof GeneratedComponentSchema>;

export interface ValidationSuccess {
  success: true;
  data: GeneratedComponent;
}

export interface ValidationFailure {
  success: false;
  /** Errores formateados listos para mandar de vuelta al prompt del Agente */
  errorFeedback: string;
  rawErrors: z.ZodIssue[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Posthook para validar el componente generado por el Agente.
 * Retorna el resultado con feedback amigable para que el agente se auto-corrija.
 */
export function validateGeneratedComponent(payload: unknown): ValidationResult {
  const result = GeneratedComponentSchema.safeParse(payload);

  if (!result.success) {
    // Formateamos los errores para que el LLM entienda exactamente qué falló y dónde
    const errorFeedback = [
      "CRITICAL: El componente generado no cumple con los requisitos mínimos de estructura y calidad.",
      "Errores detectados:",
      ...result.error.issues.map(
        (issue) => `- Campo [${issue.path.join(".") || "raíz"}]: ${issue.message}`
      ),
      "\nPor favor, corregí estos campos y volvé a generar el componente."
    ].join("\n");

    return {
      success: false,
      errorFeedback,
      rawErrors: result.error.issues,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Ejemplo conceptual del pipeline o Loop del Agente (Orquestador)
 */
export async function runGenerationLoop(
  agentGenerateFn: () => Promise<unknown>,
  maxRetries = 3
): Promise<GeneratedComponent> {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    attempts++;
    const rawOutput = await agentGenerateFn();
    const validation = validateGeneratedComponent(rawOutput);

    if (validation.success) {
      return validation.data;
    }

    console.warn(`Intento ${attempts} fallido. Reintentando con feedback...`);
    console.warn(validation.errorFeedback);
    
    // Aquí es donde en tu pipeline real le pasarías validation.errorFeedback al prompt del Agente
    // agentPrompt.addSystemMessage(validation.errorFeedback);
  }

  throw new Error(`No se pudo generar un componente válido después de ${maxRetries} intentos.`);
}
