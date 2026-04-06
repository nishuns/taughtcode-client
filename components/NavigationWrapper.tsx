'use client';

import React from 'react';
import Header from './Header';
import Menu from './Menu';
import { useStore } from '@/store/useStore';

export default function NavigationWrapper() {
  const { isMenuOpen, toggleMenu } = useStore();

  return (
    <>
      <Header />
      <Menu isOpen={isMenuOpen} onClose={() => toggleMenu()} />
    </>
  );
}
