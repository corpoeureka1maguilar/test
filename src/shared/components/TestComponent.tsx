import { useState } from 'react';
import styles from './TestComponent.module.css';

interface TestComponentProps {
  initialValue?: number;
}

export function TestComponent({ initialValue = 0 }: TestComponentProps) {
  const [count, setCount] = useState(initialValue);

  return (
    <div className={styles.box}>
      <h3>Componente de Prueba</h3>
      <p>Contador: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Incrementar
      </button>
    </div>
  );
}
