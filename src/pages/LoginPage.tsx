import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage } from "../contexts/AuthContext";
import { AuthLayout } from "../components/common/AuthLayout";
import { Input } from "../components/common/Input";
import { Button } from "../components/common/Button";
import type { AuthError } from "@supabase/supabase-js";

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate("/lobby", { replace: true });
  }, [user, navigate]);

  const validate = (): boolean => {
    if (!email.trim()) {
      setError("Email is required.");
      return false;
    }
    if (!password) {
      setError("Password is required.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validate()) return;

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate("/lobby", { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err as AuthError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome Back" subtitle="Sign in to your account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <Button type="submit" isLoading={submitting} fullWidth>
          Sign In
        </Button>

        <p className="text-center text-sm text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="font-medium text-blue-400 hover:text-blue-300"
          >
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
