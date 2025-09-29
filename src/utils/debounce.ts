// 디바운스 훅으로 성능 최적화
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// 무거운 계산을 위한 웹워커 시뮬레이션
export function createAsyncCalculation<T, R>(
  calculation: (input: T) => R,
  delay: number = 0
): (input: T) => Promise<R> {
  return (input: T) => {
    return new Promise((resolve) => {
      if (delay === 0) {
        // 즉시 실행하지만 다음 틱에서 실행하여 UI 블록킹 방지
        setTimeout(() => resolve(calculation(input)), 0);
      } else {
        setTimeout(() => resolve(calculation(input)), delay);
      }
    });
  };
}