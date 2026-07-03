import { describe, it, expect } from 'vitest';
import { validateGeneratedComponent } from './agentValidator';

describe('validateGeneratedComponent (Posthook Zod)', () => {
  it('debería rechazar un componente inválido y dar feedback detallado', () => {
    // Payload con varios errores a propósito:
    // 1. componentName en minúscula (debe ser PascalCase)
    // 2. description muy corta (mínimo 10 caracteres)
    // 3. props sin el tipo especificado
    // 4. code no tiene "export default" ni "export const"
    const invalidPayload = {
      componentName: "myInvalidComponent", 
      description: "corta", 
      props: [
        {
          name: "title",
          required: true
          // Falta 'type'
        }
      ],
      dependencies: ["react"],
      code: "const MyComponent = () => <div>Hello</div>;" 
    };

    const result = validateGeneratedComponent(invalidPayload);

    expect(result.success).toBe(false);
    
    if (!result.success) {
      console.log("=== FEEDBACK GENERADO POR EL POSTHOOK ===");
      console.log(result.errorFeedback);
      console.log("=========================================");

      // Verificamos que contenga los errores esperados
      expect(result.errorFeedback).toContain("componentName");
      expect(result.errorFeedback).toContain("description");
      expect(result.errorFeedback).toContain("props.0.type");
      expect(result.errorFeedback).toContain("code");
    }
  });

  it('debería aceptar un componente que cumple con el schema', () => {
    const validPayload = {
      componentName: "UserProfile",
      description: "Componente que muestra la tarjeta del perfil de un usuario.",
      props: [
        {
          name: "username",
          type: "string",
          required: true
        }
      ],
      dependencies: [],
      code: "export const UserProfile = ({ username }) => <div>{username}</div>;"
    };

    const result = validateGeneratedComponent(validPayload);
    expect(result.success).toBe(true);
  });
});
