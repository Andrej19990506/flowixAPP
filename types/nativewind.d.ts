declare module 'nativewind' {
  import type { ComponentType, ComponentPropsWithRef } from 'react';

  type StyledProps = {
    className?: string;
    style?: any;
    contentContainerClassName?: string;
  };

  export function styled<T extends ComponentType<any>>(
    component: T
  ): ComponentType<ComponentPropsWithRef<T> & StyledProps>;

  export const NativeWindStyleSheet: {
    setOutput: (options: { default: 'native' | 'web' }) => void;
  };
}

