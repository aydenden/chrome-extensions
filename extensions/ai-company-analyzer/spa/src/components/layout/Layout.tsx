import { type ReactNode } from 'react';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
  isConnected?: boolean;
}

export default function Layout({ children, isConnected = false }: LayoutProps) {
  return (
    <div className="min-h-screen bg-paper">
      <Header isConnected={isConnected} />
      <main className="py-8">{children}</main>
    </div>
  );
}
