'use client';

import Auth from "@/components/Auth";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/admin');
      }
    });
    return () => unsubscribe();
  }, [router]);

  return (
    <div className="login">
      <div className="login__bg" />

      <header className="login__header">
        <div className="login__brand">NISCHAY SHARMA</div>
        <button onClick={() => router.push('/')} className="login__close-btn">
          Esc — Close
        </button>
      </header>

      <section className="login__content">
        <div className="login__box">
          <h1 className="login__title">Sign In</h1>
          <span className="login__subtitle">Admin Control Panel</span>
          <Auth />
        </div>
      </section>

      <footer className="login__footer">
        <div className="login__footer-text">
          Unauthorized access is strictly prohibited
        </div>
      </footer>
    </div>
  );
}
