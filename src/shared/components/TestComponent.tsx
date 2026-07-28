import { useState } from 'react';

interface TestComponentProps {
  initialValue?: number;
}

export function TestComponent({ initialValue = 0 }: TestComponentProps) {
  const [count, setCount] = useState(initialValue);

  return (
    <div className="p-4 border border-solid border-[#ccc] rounded">
      <h3>Componente de Prueba</h3>
      <p>Contador: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Incrementar
      </button>
    </div>
  );
}
