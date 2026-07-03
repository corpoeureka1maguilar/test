import { useState } from 'react';

interface TestComponentProps {
  initialValue?: number;
}

export function TestComponent({ initialValue = 0 }: TestComponentProps) {
  const [count, setCount] = useState(initialValue);

  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
      <h3>Componente de Prueba</h3>
      <p>Contador: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Incrementar
      </button>
    </div>
  );
}
