// src/components/dt/Loader.tsx
import { Html } from '@react-three/drei';

export function Loader() {
    return (
        <Html center>
            <div className="text-lg text-gray-800 dark:text-gray-100 font-semibold">
                데이터를 기다리는 중...
            </div>
        </Html>
    );
}

