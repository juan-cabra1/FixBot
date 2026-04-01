"use client";
// lib/auth.ts — Auth helpers and useAuth hook
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TOKEN_KEY = "token";

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

// Hook: redirect to /login if not authenticated
export function useAuth(): { loading: boolean } {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    } else {
      setLoading(false);
    }
  }, [router]);

  return { loading };
}
